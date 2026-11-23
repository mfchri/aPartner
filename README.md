# 🪟 Glass Chat – Private Glassmorphism AI Chat (Gemini Flash)

A sleek, responsive, private web-based AI chat application powered by Google Gemini Flash. Designed with modern Glassmorphism (layered translucent blurs, soft lighting, and smooth orbs), customized AI personas, and enterprise-grade abuse protection for public internet deployment without user accounts or server databases.

---

## ✨ Features

- **💎 Glassmorphism Design System**: Dynamic backdrop blurs (10–40px), layered translucent cards, soft inner glows, and GPU-accelerated animated gradient orbs (with `prefers-reduced-motion` compliance).
- **⚡ Real-Time Streaming Responses**: Instant Server-Sent Events (SSE) streaming with live cursor typing indicator, client-side abort (Stop generation), message regeneration, and copy-to-clipboard.
- **🛡️ Rock-Solid Public Security**:
  - **Passcode Gate**: Single-passcode entry with constant-time comparison (`timingSafeEqual`) to prevent timing side channels.
  - **Signed 30-Day Cookie**: Secure, HttpOnly, SameSite=Lax JWT signed with `AUTH_SECRET`.
  - **Brute-Force Guard**: IP-based rate limiting (max 5 failed attempts per 15 minutes) on the passcode endpoint.
  - **DDoS & Quota Rate Limiting**: Upstash Redis sliding window (15 requests/min, 300 requests/day per session) with in-memory fallback for local development.
  - **Hardened Inputs**: Strict Zod validation, 100 KB payload limit, 8,000 char message cap, 4,000 char custom prompt limit, and cross-site origin verification.
  - **No Search Engine Indexing**: `robots: noindex, nofollow` metadata and `robots.txt` disallow to protect private endpoints.
  - **Strict CSP Headers**: Content Security Policy, X-Frame-Options (`DENY`), and Permissions-Policy blocking camera/mic/geo.
- **🎨 Custom AI Persona & Talking Style**:
  - **Persona**: AI Name (default "Aria"), User Name, Custom Greeting (with `{{name}}` interpolation), and Custom System Instructions.
  - **Tone Presets**: Friendly, Casual, Professional, Playful, or Concise.
  - **Language Directives**: Auto-detect, Bahasa Indonesia, or English.
  - **Length & Emojis**: Short, Balanced, or Detailed; Emoji usage from Off to Lots.
  - Server-side system prompt assembly (`buildSystemPrompt.ts`) ensures instructions are strictly enforced.
- **🌓 Light, Dark & Accent Modes**: Seamless theme switching without flash, 6 accent color presets (Blue, Emerald, Violet, Rose, Amber, Cyan), and dynamic glass blur sliders.
- **🔒 100% Client-Side Privacy**:
  - All chat sessions and history are stored exclusively in your browser via `localStorage`.
  - Zero database, zero server-side conversation logs.
  - Full JSON backup export and import, plus instant "Clear All Data" and "Lock App / Sign Out".
- **📱 Mobile-First PWA**: Responsive slide-over drawer sidebar, viewport-aware input that sits cleanly above virtual keyboards (`dvh`), and web app manifest for home-screen installation.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v18.17+ or v20+ (tested on Node v24)
- **npm** (or pnpm/yarn)

### 2. Clone and Install
```bash
git clone <your-repo-url> glass-chat
cd glass-chat
npm install
```

### 3. Environment Variables
Copy the example environment file:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your preferred values:
```env
# Required for AI responses:
GEMINI_API_KEY=your_gemini_api_key_here

# Required for Passcode Gate:
APP_PASSCODE=your_secret_passcode

# Optional (recommended for production):
AUTH_SECRET=a_random_32_character_string_for_jwt_signing
GEMINI_MODEL=gemini-2.5-flash
GEMINI_ALLOWED_MODELS=gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash,gemini-2.5-flash-lite

# Optional in local dev (in-memory rate limiting is used if omitted):
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token_here
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Enter your `APP_PASSCODE` to unlock the chat.

---

## 🔑 Obtaining Free API Keys

### 1. Google Gemini API Key (Free Tier)
1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google Account.
3. Click **"Get API key"** and create a new key.
4. Copy the API key and paste it as `GEMINI_API_KEY` in your `.env.local` or hosting provider.

### 2. Upstash Redis (Free Serverless Rate Limiting)
1. Go to [Upstash](https://upstash.com/) and create a free account.
2. Click **"Create Database"**, choose a region close to your Vercel deployment (e.g. `us-east-1` or `iad1`), and select the Free plan.
3. In the database details, scroll to **"REST API"** and copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Paste these into your environment configuration.

---

## 🚢 Deploy to Vercel

Glass Chat is optimized for deployment on Vercel with streaming support.

### Step-by-Step Deployment:
1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit: Glass Chat"
   git push origin main
   ```
2. **Import Project to Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new) and select your GitHub repository.
3. **Configure Environment Variables** in the Vercel project dashboard under **Settings > Environment Variables**:
   | Variable | Value | Description |
   |---|---|---|
   | `GEMINI_API_KEY` | `AIzaSy...` | Your Google Gemini API Key |
   | `APP_PASSCODE` | `YourSecret123` | Passcode required to unlock the web app |
   | `AUTH_SECRET` | 32+ character random string | Secret used to sign session cookies |
   | `UPSTASH_REDIS_REST_URL` | `https://...upstash.io` | Upstash Redis REST URL |
   | `UPSTASH_REDIS_REST_TOKEN` | `A...` | Upstash Redis REST Token |
   | `GEMINI_MODEL` | `gemini-2.5-flash` | Default Gemini Flash model |
   | `GEMINI_ALLOWED_MODELS` | `gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash,gemini-2.5-flash-lite` | Allowlist of selectable models |

4. **Deploy**:
   - Click **Deploy**. Vercel will build the project and output your live deployment URL.
5. **Verify**:
   - Open your deployed URL. The glass passcode screen will greet you.
   - Enter your passcode, send a prompt, and observe smooth SSE streaming.

---

## 🔒 Privacy & Free-Tier Quota Notice

> [!WARNING] **Google Gemini Free-Tier Data Privacy Notice**
> Under Google's free-tier terms for the Gemini API, prompts and generated responses may be reviewed by human reviewers and used by Google to train and improve its products and machine-learning models.
> **Do not input confidential, sensitive, proprietary, or personal identifying information (PII).**

> [!NOTE] **Shared Free Quota**
> Free-tier Gemini models enforce rate limits (e.g., 15 RPM and 1,500 RPD on Flash). This quota is shared across any device or person using your `APP_PASSCODE`. Glass Chat enforces client rate limiting (15 requests/min and 300 requests/day) to prevent unexpected quota exhaustion.

---

## 🛠️ Project Architecture

```
├── app/
│   ├── api/
│   │   ├── auth/route.ts       # Passcode verification, JWT cookie, brute-force guard
│   │   └── chat/route.ts       # Gemini streaming handler, rate limiter, input validation
│   ├── globals.css             # Glassmorphism utilities, CSS themes, code highlight styles
│   ├── layout.tsx              # Root HTML, fonts, PWA tags, security meta
│   ├── page.tsx                # Main coordinating page & auth state manager
│   └── robots.ts               # Robots noindex / nofollow rules
├── components/
│   ├── ChatInput.tsx           # Floating glass input, auto-resize, abort button
│   ├── ChatWindow.tsx          # Chat thread, SSE stream processor, regenerate
│   ├── GlassBackground.tsx     # Animated gradient mesh & floating blurred orbs
│   ├── MessageBubble.tsx       # Safe markdown rendering, code highlight, copy buttons
│   ├── PasscodeGate.tsx        # Glass passcode unlock screen with shake feedback
│   ├── Providers.tsx           # Next-themes and glass CSS variable synchronizer
│   ├── SettingsDialog.tsx      # Persona, style, model, theme, backup & logout modal
│   ├── Sidebar.tsx             # Drawer navigation, session list, search, auto-title
│   └── ThemeToggle.tsx         # Light / Dark / System cycle toggle
├── lib/
│   ├── auth.ts                 # Constant-time comparison & JWT session management
│   ├── buildSystemPrompt.ts    # Server-side persona & directive compiler
│   ├── gemini.ts               # Official @google/genai SDK stream handler
│   ├── rateLimit.ts            # Upstash sliding-window + dev in-memory fallback
│   ├── storage.ts              # JSON backup export and import parser
│   ├── utils.ts                # Tailwind class merge utility
│   └── validation.ts           # Zod request hardening schemas
├── store/
│   ├── useChatStore.ts         # Persistent browser session store (Zustand)
│   └── useSettingsStore.ts     # Persistent user customization store (Zustand)
├── middleware.ts               # Edge-safe route gatekeeper & CSRF check
├── next.config.ts              # CSP, X-Frame-Options, Permissions-Policy headers
└── tailwind.config.ts          # Custom glassmorphism and animation keyframes
```

---

## 🧪 Verification & Security Checks

- **Production Build**: Verified with Next.js App Router (`npm run build`).
- **Secret Isolation**: Client bundle scanned for leakages (`0 secrets found`).
- **Input Hardening**: Rejects payloads exceeding 100 KB, enforces 40 message history cap, rejects unauthorized schema keys.
- **Timing Protection**: `timingSafeEqualString` bitwise constant-time comparison prevents side-channel timing attacks.

---

## 📄 License
MIT License. Open source and built for private, personalized AI workflows.
