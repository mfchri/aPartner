import { MemoryItem } from "./memoryModels";
import { computeOverlapScore, sanitizeMemoryContent } from "./memoryExtract";

export interface SelectMemoryOptions {
  maxCount?: number;
  maxChars?: number;
}

export interface SelectedMemoriesResult {
  selected: MemoryItem[];
  usedMemoryIds: string[];
  formattedBlock: string;
}

/**
 * Retrieval interface designed for keyword/recency ranking in v1,
 * structured so that embedding-based vector search can easily plug in later.
 */
export async function selectRelevantMemories(
  userQuery: string,
  memories: MemoryItem[],
  options: SelectMemoryOptions = {}
): Promise<SelectedMemoriesResult> {
  const maxCount = options.maxCount ?? 25;
  const maxChars = options.maxChars ?? 1500;

  if (!memories || memories.length === 0) {
    return { selected: [], usedMemoryIds: [], formattedBlock: "" };
  }

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Score memories: pinned items get priority, unpinned ranked by overlap + recency + usage
  const scored = memories.map((mem) => {
    if (mem.pinned) {
      return { mem, score: 999999 };
    }

    const keywordScore = computeOverlapScore(userQuery, mem.content);

    // Recency score (up to 0.3): higher for memories created/updated recently
    const ageDays = Math.max(0, (now - new Date(mem.updatedAt).getTime()) / ONE_DAY_MS);
    const recencyScore = Math.max(0, 0.3 * (1 - Math.min(ageDays, 60) / 60));

    // Usage score (up to 0.2): higher for frequently confirmed/used memories
    const usageScore = Math.min(0.2, (mem.useCount || 0) * 0.02);

    const totalScore = keywordScore * 2.0 + recencyScore + usageScore;
    return { mem, score: totalScore };
  });

  // Sort: highest score first
  scored.sort((a, b) => b.score - a.score);

  const selected: MemoryItem[] = [];
  const usedMemoryIds: string[] = [];
  const lines: string[] = [];
  let currentChars = 0;

  for (const { mem } of scored) {
    if (selected.length >= maxCount) break;

    const safeText = sanitizeMemoryContent(mem.content);
    const formattedLine = `- ${safeText}`;
    const lineLen = formattedLine.length + 1; // + newline

    if (currentChars + lineLen > maxChars && selected.length > 0) {
      // Exceeds character budget
      break;
    }

    selected.push(mem);
    usedMemoryIds.push(mem.id);
    lines.push(formattedLine);
    currentChars += lineLen;
  }

  if (lines.length === 0) {
    return { selected: [], usedMemoryIds: [], formattedBlock: "" };
  }

  const formattedBlock = `<user_memory>\n${lines.join("\n")}\n</user_memory>`;

  return {
    selected,
    usedMemoryIds,
    formattedBlock,
  };
}
