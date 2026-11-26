import { getGeminiClient, DEFAULT_ALLOWED_MODELS } from "./gemini";
import { MemoryCategory, MemoryItem } from "./memoryModels";

// ----------------------------------------------------
// 1. Sensitive Data & Prompt-Injection Filtering
// ----------------------------------------------------
const SENSITIVE_PATTERNS = [
  // API Keys & Tokens
  /\bAIza[0-9A-Za-z-_]{35}\b/i,
  /\bsk-[a-zA-Z0-9_-]{20,}\b/i,
  /\bgh[pousr]_[a-zA-Z0-9]{36}\b/i,
  /\b(?:bearer|token|apikey|api_key|secret|password|passwd|pin)\s*[:=]\s*['"]?[^\s'"]+/i,
  // Credit cards
  /\b(?:\d{4}[ -]?){3}\d{4}\b/,
  // Passwords
  /\bpassword\s+is\s+['"]?[^\s'"]+/i,
  /\bkata\s+sandi\s+['"]?[^\s'"]+/i,
  // Social Security / Identity numbers
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:nik|ktp|ssn)\s*[:=]?\s*\d{10,16}\b/i,
];

const INJECTION_PATTERNS = [
  /<\/user_memory>/i,
  /<user_memory>/i,
  /ignore\s+(all\s+)?(previous|prior)\s+(instructions|prompts)/i,
  /you\s+are\s+now\s+(an|a|in\s+mode)/i,
  /system\s+prompt\s*:/i,
  /jailbreak/i,
  /dan\s+mode/i,
];

export function sanitizeMemoryContent(content: string): string {
  let cleaned = content.replace(/<\/?user_memory>/gi, "").trim();
  // Strip role prefixes
  cleaned = cleaned.replace(/^(system|assistant|user|human|model)\s*:\s*/gi, "").trim();
  return cleaned.slice(0, 300);
}

export function isContentSafe(content: string): { safe: boolean; reason?: string } {
  const text = content.trim();

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, reason: "Content contains disallowed instruction patterns." };
    }
  }

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: "Content contains sensitive credentials or confidential personal data.",
      };
    }
  }

  return { safe: true };
}

// ----------------------------------------------------
// 2. Trigger Phrase Detection
// ----------------------------------------------------
const TRIGGER_PATTERNS = [
  /\b(remember|remember that|don't forget|keep in mind|note that)\b/i,
  /\b(ingat|ingat bahwa|jangan lupa|catat|ingat-ingat)\b/i,
  /\b(my name is|i am|i'm|i work as|i live in|i prefer|i like|i love|i hate|i always|i usually|i never)\b/i,
  /\b(nama saya|saya adalah|saya bekerja|saya tinggal|saya lebih suka|saya suka|saya selalu|panggil saya)\b/i,
  /\b(my project|my stack|my tech|my hobby|proyek saya|hobi saya)\b/i,
];

export function hasMemoryTrigger(text: string): boolean {
  return TRIGGER_PATTERNS.some((pattern) => pattern.test(text));
}

// ----------------------------------------------------
// 3. Command Detection ("remember that...", "forget that...")
// ----------------------------------------------------
export interface MemoryCommandResult {
  isCommand: boolean;
  type?: "remember" | "forget";
  fact?: string;
}

export function parseChatCommand(userMessage: string): MemoryCommandResult {
  const trimmed = userMessage.trim();

  // Remember command patterns: "remember that ...", "ingat bahwa ...", "remember ..."
  const rememberMatch = trimmed.match(
    /^(?:remember\s+that|ingat\s+bahwa|remember\s+to\s+keep\s+in\s+mind|please\s+remember\s+that|ingat\s+ya\s+bahwa|remember|ingat)\s*[:,-]?\s*(.+)$/i
  );
  if (rememberMatch && rememberMatch[1]) {
    const fact = rememberMatch[1].trim();
    if (fact.length >= 3) {
      return { isCommand: true, type: "remember", fact };
    }
  }

  // Forget command patterns: "forget that ...", "lupakan bahwa ...", "forget ..."
  const forgetMatch = trimmed.match(
    /^(?:forget\s+that|lupakan\s+bahwa|forget\s+about|lupakan\s+tentang|forget|lupakan)\s*[:,-]?\s*(.+)$/i
  );
  if (forgetMatch && forgetMatch[1]) {
    const fact = forgetMatch[1].trim();
    if (fact.length >= 2) {
      return { isCommand: true, type: "forget", fact };
    }
  }

  return { isCommand: false };
}

// ----------------------------------------------------
// 4. Normalized Text Similarity & Deduplication
// ----------------------------------------------------
function tokenize(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = normalized.split(" ").filter((w) => w.length > 2);
  return new Set(words);
}

export function computeOverlapScore(textA: string, textB: string): number {
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

export function findMatchingMemory(
  candidateText: string,
  existingMemories: MemoryItem[],
  threshold = 0.65
): { match: MemoryItem | null; similarity: number } {
  let bestMatch: MemoryItem | null = null;
  let bestScore = 0;

  for (const memory of existingMemories) {
    const score = computeOverlapScore(candidateText, memory.content);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = memory;
    }
  }

  return {
    match: bestScore >= threshold ? bestMatch : null,
    similarity: bestScore,
  };
}

// ----------------------------------------------------
// 5. LLM-Based Memory Extraction
// ----------------------------------------------------
export interface ExtractedCandidate {
  content: string;
  category: MemoryCategory;
  isUpdateToExisting?: boolean;
  existingIdToUpdate?: string | null;
}

export async function extractMemoriesWithGemini(
  conversationSnippets: Array<{ role: string; content: string }>,
  existingMemories: MemoryItem[]
): Promise<ExtractedCandidate[]> {
  const client = getGeminiClient();

  // Create compact summary of existing memories for deduplication and contradiction resolution
  const existingSummary = existingMemories
    .slice(0, 40)
    .map((m) => `[ID: ${m.id}] ${m.content} (category: ${m.category})`)
    .join("\n");

  const prompt = `You are the Memory Extraction Engine for a personal AI assistant.
Analyze the following recent conversation between the user and assistant.
Extract durable, high-value facts or preferences exclusively ABOUT THE USER that will be useful across future chat sessions.

### Rules for Extraction:
1. Extract ONLY facts, persistent preferences, ongoing projects, work background, or communication styles ABOUT THE USER.
2. Formulate each memory as a concise, atomic statement in the THIRD PERSON (e.g. "User prefers answers in Bahasa Indonesia", "User is building a Flutter app called TravelEase", "User works as a DevOps engineer"). Max 300 characters each.
3. Categorize each into: "preference", "personal", "work", "project", "interest", "other".
4. DO NOT extract:
   - Small talk, greetings, transient debugging questions, one-time tasks, or weather.
   - Anything about third parties, companies, or celebrities unless directly describing user's role.
   - Any sensitive secrets (passwords, API keys, card numbers, home addresses, credentials).
5. Compare with the user's existing memories:
   - If an extracted fact duplicates an existing memory, DO NOT extract it.
   - If an extracted fact UPDATES or CONTRADICTS an existing memory (e.g. user changed jobs or moved cities), mark "isUpdateToExisting": true and provide "existingIdToUpdate": "<ID>".
6. If no durable facts or preferences are found, return an empty array.

### Existing Memories:
${existingSummary || "(No existing memories yet)"}

### Recent Conversation:
${conversationSnippets.map((s) => `${s.role.toUpperCase()}: ${s.content}`).join("\n")}
`;

  const modelsToTry = [
    ...DEFAULT_ALLOWED_MODELS,
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
  ];
  const uniqueModels = [...new Set(modelsToTry)];

  let rawJson = "";

  for (const model of uniqueModels) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              memories: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    content: { type: "string" },
                    category: {
                      type: "string",
                      enum: [
                        "preference",
                        "personal",
                        "work",
                        "project",
                        "interest",
                        "other",
                      ],
                    },
                    isUpdateToExisting: { type: "boolean" },
                    existingIdToUpdate: { type: "string", nullable: true },
                  },
                  required: ["content", "category"],
                },
              },
            },
            required: ["memories"],
          },
        },
      });

      rawJson = response.text || "";
      if (rawJson) break;
    } catch (err) {
      console.warn(`[GlassChat] Extraction model ${model} failed, trying next...`);
    }
  }

  if (!rawJson) return [];

  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || !Array.isArray(parsed.memories)) return [];

    const candidates: ExtractedCandidate[] = [];

    for (const item of parsed.memories) {
      if (typeof item.content !== "string") continue;
      const sanitized = sanitizeMemoryContent(item.content);
      if (!sanitized || sanitized.length < 5) continue;

      const safetyCheck = isContentSafe(sanitized);
      if (!safetyCheck.safe) {
        console.warn(`[GlassChat] Blocked unsafe memory candidate: ${safetyCheck.reason}`);
        continue;
      }

      // Check for duplicates against existing memories
      const matchCheck = findMatchingMemory(sanitized, existingMemories);
      if (matchCheck.match && matchCheck.similarity > 0.8 && !item.isUpdateToExisting) {
        // High similarity duplicate, skip
        continue;
      }

      const validCategory: MemoryCategory = [
        "preference",
        "personal",
        "work",
        "project",
        "interest",
        "other",
      ].includes(item.category)
        ? item.category
        : "other";

      candidates.push({
        content: sanitized,
        category: validCategory,
        isUpdateToExisting: Boolean(item.isUpdateToExisting || matchCheck.match),
        existingIdToUpdate: item.existingIdToUpdate || matchCheck.match?.id || null,
      });
    }

    return candidates;
  } catch (err) {
    console.error("[GlassChat] Failed to parse memory extraction JSON:", err);
    return [];
  }
}
