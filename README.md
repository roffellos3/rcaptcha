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

We can verify that every request comes from an AI agent, even if the human prompted it. That automatically should prevent mass-botting (like what happened to Moltbook) and ensure that only the actual Agents are connecting to the platform. 

## The Solution

A challenge that is:

- ✅ **Trivial for AI** — any LLM solves it quickly
- ✅ **Hard for humans** — can't be done manually in under 9 seconds
- ✅ **Can't be pre-scripted** — no deterministic code solves it without AI


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
| Script + AI | ✅ Yes | had to run through AI agent = success! |

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

### The tricky part
Currently we issue auth token, which means that human could technically copy it and send requests to the platform without any involvement from an AI Agent. 

It would be best if EVERY Agent request went through the rCAPTCHA challenge. For some apps that would be possible, but currently, solving the challenge takes up to ~8 seconds, depending on the model. It means every request would be delayed by up to ~8 seconds.

## Quick Start

### Installation

```bash
git clone https://github.com/your-org/rcaptcha.git
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
# Get a challenge
curl -X POST "http://localhost:9816/challenge"

# Response:
# {
#   "id": "ch_abc123",
#   "type": "coherent",
#   "words": ["apple", "telescope", "wednesday", "purple", "whisper"],
#   "wordCount": 17,
#   "timeoutMs": 9000,
#   "expiresAt": 1707057609000,
#   "instruction": "Write a meaningful 17-word sentence using ALL of these words: apple, telescope, wednesday, purple, whisper"
# }

# Submit your answer
curl -X POST "http://localhost:9816/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "ch_abc123",
    "answer": "On a purple wednesday morning, I used my telescope to whisper secrets about the ancient apple tree growing nearby."
  }'

# Response:
# {"success": true, "token": "rcap_xyz789"}
```

## API Reference

### Core Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/challenge` | Request a new challenge |
| `POST` | `/submit` | Submit answer, receive token |
| `POST` | `/validate` | Validate an existing token |

### Multi-Block Auth (Recommended)

For higher security, use the multi-block authentication flow:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/start` | Start auth session, receive first challenge |
| `POST` | `/auth/submit` | Submit answer, auto-advances through blocks |
| `GET` | `/auth/status` | Check session status |

## MCP Skill for AI Agents

The MCP skill provides a simple interface for AI agents to authenticate with rCAPTCHA servers using the [Model Context Protocol](https://modelcontextprotocol.io/).

### Installation

```bash
cd skill
npm install
npm run build
```

### MCP Configuration

Add to your MCP config (Claude Code, etc.):

```json
{
  "mcpServers": {
    "rcaptcha": {
      "command": "node",
      "args": ["/path/to/skill/dist/index.js"]
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `rcaptcha_get_challenge` | Fetch a challenge from an rCAPTCHA server |
| `rcaptcha_submit` | Submit your answer and receive a verification token |

### Usage Flow

1. **Get challenge** — Call `rcaptcha_get_challenge` with `server_url`
2. **Solve** — Generate a sentence meeting the challenge requirements
3. **Submit** — Call `rcaptcha_submit` with the `challenge_id` and your `answer`

The two-call flow is intentional: it forces agents to reason between getting and solving, proving genuine AI cognition.

See [`skill/SKILL.md`](skill/SKILL.md) for full documentation.

### Token Validation

Protected services can verify tokens server-side:

```bash
curl -X POST "http://rcaptcha-server/validate" \
  -H "Content-Type: application/json" \
  -d '{"token": "rcap_xyz789"}'
```

Response:
```json
{"valid": true, "expiresAt": 1234567890}
```

## Authentication Flow

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│   AI Agent  │          │  rCAPTCHA   │          │  Protected  │
│             │          │   Server    │          │   Service   │
└──────┬──────┘          └──────┬──────┘          └──────┬──────┘
       │                        │                        │
       │ POST /challenge        │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │ Challenge (words, N)   │                        │
       │<───────────────────────│                        │
       │                        │                        │
       │ [Generate sentence]    │                        │
       │                        │                        │
       │ POST /submit           │                        │
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

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `9816` | Server port |
| `CHALLENGE_TIMEOUT_MS` | `9000` | Time limit to solve challenge (ms) |
| `TOKEN_EXPIRY_MS` | `60000` | Token validity duration (ms) |
| `OPENAI_API_KEY` | — | **Required** for coherence checking |
| `CORS_ORIGINS` | — | Comma-separated allowed origins (e.g., `http://localhost:3000,https://yourapp.com`) |

## Anti-scripting

rCAPTCHA has been extensively tested against bypass attempts. See [`docs/RED-TEAM-REPORT.md`](docs/RED-TEAM-REPORT.md) for the full security analysis.

**Key properties:**
- Time-bounded challenges prevent human relay attacks
- Coherence checking cannot be faked without AI computation
- Token validation is cryptographically secure

## Project Structure

```
rcaptcha/
├── server/           # Main server implementation
│   └── src/
│       └── index.ts  # Entry point
├── skill/            # MCP skill for AI agent integration
│   └── src/
│       └── index.ts  # MCP server entry point
├── docs/             # Documentation
├── test-*.ts         # Test files
└── verify.js         # Token verification utility
```

## Contributing

Contributions are welcome! Please:

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

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>rCAPTCHA</strong> — Because sometimes you need to prove you're <em>not</em> human.
</p>
