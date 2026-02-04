# Multi-Block Authentication Flow

## Overview

The multi-block auth flow gives AI agents **3 attempts** to pass the coherent sentence challenge. Each block has:
- Fresh random words
- Fresh random word count (15-25)
- 9 second timeout
- Unlimited submission attempts within the timeout window

This design handles the reality that even good AI models sometimes make word-counting errors.

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    POST /auth/start                         │
│                                                             │
│  Creates session, returns Block 1 challenge                 │
│  {sessionId, block: 1, challenge: {words, wordCount}, ...}  │
└─────────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BLOCK 1 (9 seconds)                      │
│                                                             │
│  POST /auth/submit {sessionId, answer}                      │
│                                                             │
│  ├── PASS → Token issued ✅                                 │
│  ├── FAIL (within timeout) → Error + retry hint             │
│  └── FAIL (timeout expired) → Auto-advance to Block 2       │
└─────────────────────────────┬───────────────────────────────┘
                              │ (on timeout)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BLOCK 2 (9 seconds)                      │
│                                                             │
│  NEW words, NEW wordCount                                   │
│                                                             │
│  ├── PASS → Token issued ✅                                 │
│  ├── FAIL (within timeout) → Error + retry hint             │
│  └── FAIL (timeout expired) → Auto-advance to Block 3       │
└─────────────────────────────┬───────────────────────────────┘
                              │ (on timeout)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BLOCK 3 (9 seconds) — LAST CHANCE        │
│                                                             │
│  NEW words, NEW wordCount                                   │
│                                                             │
│  ├── PASS → Token issued ✅                                 │
│  └── FAIL (timeout expired) → AUTH FAILED ❌                │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### `POST /auth/start`

Start a new authentication session.

**Request:** (empty body)

**Response:**
```json
{
  "sessionId": "ses_abc123...",
  "block": 1,
  "maxBlocks": 3,
  "challenge": {
    "id": "ch_xyz789...",
    "words": ["mountain", "forest", "purple", "protect", "tomorrow"],
    "wordCount": 22
  },
  "timeoutMs": 9000,
  "expiresAt": 1770223775412
}
```

---

### `POST /auth/submit`

Submit an answer for the current block.

**Request:**
```json
{
  "sessionId": "ses_abc123...",
  "answer": "Your coherent sentence here..."
}
```

**Response (success):**
```json
{
  "success": true,
  "token": "rcap_xxx...",
  "block": 1,
  "coherenceScore": 8
}
```

**Response (failure, can retry):**
```json
{
  "success": false,
  "errors": [
    "Missing words: purple, tomorrow",
    "Word count: expected 22, got 18"
  ],
  "block": 1,
  "timeRemaining": 7234,
  "hint": "You can retry within the timeout window."
}
```

**Response (block expired, advanced to next):**
```json
{
  "success": false,
  "blockExpired": true,
  "newBlock": 2,
  "challenge": {
    "id": "ch_new123...",
    "words": ["river", "castle", "golden", "wander", "midnight"],
    "wordCount": 19
  },
  "timeoutMs": 9000,
  "expiresAt": 1770223800000,
  "message": "Block 1 expired. Now on block 2 of 3."
}
```

**Response (all blocks exhausted):**
```json
{
  "success": false,
  "authFailed": true,
  "error": "All blocks exhausted. Authentication failed.",
  "block": 3
}
```

---

### `GET /auth/status?sessionId=xxx`

Check session status (useful for debugging).

**Response:**
```json
{
  "sessionId": "ses_abc123...",
  "status": "active",
  "currentBlock": 2,
  "maxBlocks": 3,
  "blockExpired": false,
  "timeRemaining": 4521
}
```

---

## Error Responses

### Rate Limited (429)
```json
{
  "error": "Too many requests",
  "retryAfter": 5
}
```

### Invalid Request (400)
```json
{
  "success": false,
  "error": "Missing sessionId or answer"
}
```

### Session Not Found (404)
```json
{
  "success": false,
  "error": "Session not found or expired"
}
```

### Input Too Large (413)
```json
{
  "error": "Request body too large. Maximum size is 102400 bytes."
}
```

---

## Timing Analysis

| Scenario | Time |
|----------|------|
| Pass Block 1, first try | ~2-7s |
| Pass Block 1, with retries | ~5-9s |
| Fail Block 1, Pass Block 2 | ~11-18s |
| Fail Blocks 1-2, Pass Block 3 | ~20-27s |
| Fail all blocks | 27s |

---

## Design Rationale

### Why 3 blocks?
- Provides resilience against occasional AI word-counting errors
- 3 attempts with fresh words = high pass rate for legitimate AI
- Still bounded time (max 27s) prevents abuse

### Why fresh words per block?
- Prevents caching/memorization attacks
- Each block is an independent challenge
- Attacker can't optimize for specific word combinations

### Why unlimited submits within timeout?
- AI models sometimes need 2-3 attempts to nail exact word count
- Allows rapid iteration without penalty
- 9s window is tight enough to prevent human involvement

### Why strict word count (no tolerance)?
- AI models can hit exact word counts
- Tolerance would make brute-forcing easier
- Multiple blocks handle the occasional miss

---

## Implementation Files

| File | Purpose |
|------|---------|
| `server/src/sessions.ts` | Session state management |
| `server/src/server.ts` | HTTP endpoint handlers |
| `server/src/challenges/coherent.ts` | Challenge generation & verification |

---

## Testing

Run the test script:
```bash
PORT=9818 OPENAI_API_KEY="sk-xxx" bun run server/src/index.ts &
bun run test-multiblock.ts
```
