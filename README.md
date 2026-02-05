# rCAPTCHA

**Reverse CAPTCHA — Prove you're an AI, not a human.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/roffellos3/rcaptcha/actions/workflows/ci.yml/badge.svg)](https://github.com/roffellos3/rcaptcha/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](CHANGELOG.md)

---

## The Problem

Humans can grab an API key and `curl` your agent platform, pretending to be an AI.

CAPTCHAs stop bots. But what stops humans from sneaking into AI-only spaces?

**Can't prove:** that a request is from a fully autonomous agent, or that no human prompted it.

**Can prove:** that AI actually ran the request — not just a random human with curl.

> CAPTCHA = bot protection  
> rCAPTCHA = human protection

### Why does this help? 

We can verify that every request comes from an AI agent, even if the human prompted it. This prevents mass-botting (like what happened to Moltbook) and ensures that only actual AI agents connect to the platform. 

## The Solution

A challenge that is:

- ✅ **Trivial for AI** — any LLM solves it quickly
- ✅ **Hard for humans** — can't be done manually in under 9 seconds
- ✅ **Can't be pre-scripted** — no deterministic code solves it without AI

---

## 🚀 Try It Now

### Live Demo Server

Public test server running on Railway:

```
https://rcaptcha-production.up.railway.app
```

**Test it:**

```bash
# Health check
curl https://rcaptcha-production.up.railway.app/health

# Start a challenge
curl -X POST https://rcaptcha-production.up.railway.app/auth/start

# Submit your answer
curl -X POST https://rcaptcha-production.up.railway.app/auth/submit \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"YOUR_SESSION_ID","answer":"Your coherent sentence here."}'
```

### MCP Skill for AI Agents

Drop-in integration for Claude Code, OpenClaw, and other MCP-compatible agents.

**Install:**

```bash
cd rcaptcha-skill
npm install && npm run build
```

**Add to MCP config:**

```json
{
  "mcpServers": {
    "rcaptcha": {
      "command": "node",
      "args": ["/path/to/rcaptcha-skill/dist/index.js"]
    }
  }
}
```

**Available tools:**

| Tool | Description |
|------|-------------|
| `rcaptcha_get_challenge` | Fetch a challenge from an rCAPTCHA server |
| `rcaptcha_submit` | Submit your answer and receive a verification token |

The two-call flow is intentional: it forces agents to reason between getting and solving, proving genuine AI cognition.

See [`rcaptcha-skill/SKILL.md`](rcaptcha-skill/SKILL.md) for full documentation.

---

## How It Works

### The Challenge: Coherent Sentence

```
Write a meaningful 17-word sentence using: apple, telescope, wednesday, purple, whisper
```

**Why this works:**

| Actor | Can solve? | Reason |
|-------|------------|--------|
| AI Agent | ✅ Yes | Trivial language task |
| Human (manual) | ❌ No | Can't compose 17 perfect words in 5 seconds |
| Script (no AI) | ❌ No | Can't generate coherent sentences |
| Script + AI | ✅ Yes | Had to run through AI agent = success! |

### Verification (Fast & Cheap)

1. **Contains all required words?** → String match
2. **Exactly N words?** → Count
3. **Proper formatting?** → Regex (capital start, punctuation end)
4. **Coherent sentence?** → LLM scoring (~$0.0001/check)

**Cost:** ~$100 per 1 million verifications.

### Multi-Block Authentication

Each auth session gives **3 attempts** (blocks), each with:
- Fresh random words and word count
- 9 second timeout
- Unlimited retries within the window

Pass any block → token issued. Fail all 3 → auth denied.

### Current Limitations

Currently we issue auth tokens, which means humans could technically copy a token and send requests without AI involvement. 

Ideally, EVERY request would go through rCAPTCHA. For some apps this is possible, but solving takes ~8 seconds depending on the model — too slow for every request.

We're exploring solutions. Ideas welcome!

---

## Quick Start

### Installation

```bash
git clone https://github.com/roffellos3/rcaptcha.git
cd rcaptcha/server
bun install
```

### Run the Server

```bash
OPENAI_API_KEY="sk-..." bun run src/index.ts
```

Server starts on `http://localhost:9816`

### Test It

```bash
# Start auth session
curl -X POST "http://localhost:9816/auth/start"

# Response:
# {
#   "sessionId": "ses_abc123",
#   "block": 1,
#   "challenge": {
#     "id": "ch_xyz789",
#     "words": ["apple", "telescope", "wednesday", "purple", "whisper"],
#     "wordCount": 17
#   },
#   "timeoutMs": 9000
# }

# Submit your answer
curl -X POST "http://localhost:9816/auth/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "ses_abc123",
    "answer": "On a purple wednesday morning, I used my telescope to whisper secrets about the ancient apple tree growing nearby."
  }'

# Response:
# {"success": true, "token": "rcap_xyz789", "coherenceScore": 9}
```

---

## API Reference

### Core Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/validate` | Validate an existing token |

### Multi-Block Auth (Recommended)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/start` | Start auth session, receive first challenge |
| `POST` | `/auth/submit` | Submit answer, auto-advances through blocks |
| `GET` | `/auth/status` | Check session status |

### Token Validation

Protected services verify tokens server-side:

```bash
curl -X POST "https://rcaptcha-production.up.railway.app/validate" \
  -H "Content-Type: application/json" \
  -d '{"token": "rcap_xyz789"}'
```

Response:
```json
{"valid": true, "expiresAt": 1234567890}
```

---

## Authentication Flow

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│   AI Agent  │          │  rCAPTCHA   │          │  Protected  │
│             │          │   Server    │          │   Service   │
└──────┬──────┘          └──────┬──────┘          └──────┬──────┘
       │                        │                        │
       │ POST /auth/start       │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │ Challenge (words, N)   │                        │
       │<───────────────────────│                        │
       │                        │                        │
       │ [Generate sentence]    │                        │
       │                        │                        │
       │ POST /auth/submit      │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │ Token (rcap_xxx)       │                        │
       │<───────────────────────│                        │
       │                        │                        │
       │ Request + Token        │                        │
       │────────────────────────────────────────────────>│
       │                        │                        │
       │                        │ POST /validate (token) │
       │                        │<───────────────────────│
       │                        │                        │
       │                        │ {valid: true}          │
       │                        │───────────────────────>│
       │                        │                        │
       │ Access Granted         │                        │
       │<────────────────────────────────────────────────│
```

---

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `9816` | Server port |
| `CHALLENGE_TIMEOUT_MS` | `9000` | Time limit to solve challenge (ms) |
| `TOKEN_EXPIRY_MS` | `60000` | Token validity duration (ms) |
| `OPENAI_API_KEY` | — | **Required** for coherence checking |
| `CORS_ORIGINS` | — | Comma-separated allowed origins |

---

## Security

rCAPTCHA has been tested against bypass attempts. See [`docs/RED-TEAM-REPORT.md`](docs/RED-TEAM-REPORT.md) for the full security analysis.

**Key properties:**
- Time-bounded challenges prevent human relay attacks
- Coherence checking cannot be faked without AI computation
- Token validation is cryptographically secure

---

## Project Structure

```
rcaptcha/
├── server/           # Main server implementation
│   └── src/
│       └── index.ts  # Entry point
├── rcaptcha-skill/            # MCP skill for AI agent integration
│   └── src/
│       └── index.ts  # MCP server entry point
├── docs/             # Documentation
└── README.md
```

---

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development

```bash
# Run tests
bun test

# Run server in development
bun run --watch src/index.ts
```

---

## Authors

Built by [Roff](https://github.com/roffellos3) and [Henry](https://github.com/Henry-Roff-AI) 🧸

Henry is an AI agent running on [OpenClaw](https://openclaw.ai). Yes, an AI helped build the thing that verifies AIs. The irony isn't lost on us.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>rCAPTCHA</strong> — Because sometimes you need to prove you're <em>not</em> human.
</p>
