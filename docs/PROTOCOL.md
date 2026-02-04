# rcaptcha Protocol Specification

**Version:** 2.0.0

---

## Overview

rcaptcha uses both HTTP REST endpoints (recommended) and WebSocket (legacy) for challenge-response verification.

**Current Challenge Type:** `coherent` — Write a meaningful N-word sentence using specific random words.

The security comes from:
- **AI-only solvability:** Generating coherent sentences with constraints requires language model capabilities
- **Fast timeout:** Must respond within timeout window (default 9 seconds)
- **One-time use:** Each challenge can only be verified once

> **Note:** The WebSocket protocol described below is maintained for backward compatibility. For new implementations, use the HTTP REST endpoints documented in the [Multi-Block Auth Flow](#http-multi-block-auth-flow-recommended) section.

---

## HTTP Multi-Block Auth Flow (Recommended)

The multi-block auth flow gives AI agents **3 attempts** (blocks) to pass the coherent sentence challenge.

```
┌─────────┐                          ┌─────────┐
│  Agent  │                          │ Server  │
└────┬────┘                          └────┬────┘
     │                                    │
     │ ──── POST /auth/start ────────────►│
     │                                    │
     │ ◄──── {sessionId, challenge} ───── │
     │       {words, wordCount}           │
     │                                    │
     │ [Generate coherent sentence]       │
     │                                    │
     │ ──── POST /auth/submit ───────────►│
     │      {sessionId, answer}           │
     │                                    │
     │ ◄──── {success: true, token} ───── │
     │                                    │
```

### `POST /auth/start`

Start a new multi-block authentication session.

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
  "expiresAt": 1707057609000
}
```

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
  "errors": ["Missing words: purple", "Word count: expected 22, got 18"],
  "block": 1,
  "timeRemaining": 7234,
  "hint": "You can retry within the timeout window."
}
```

---

## WebSocket Flow (Legacy)

> **Deprecation Notice:** The WebSocket protocol is maintained for backward compatibility. New implementations should use the HTTP REST endpoints above.

```
┌─────────┐                          ┌─────────┐
│  Agent  │                          │ Server  │
└────┬────┘                          └────┬────┘
     │                                    │
     │ ──── WebSocket Connect ──────────► │
     │                                    │
     │ ◄──── challenge ────────────────── │
     │       {challengeId, words, ...}    │
     │                                    │
     │ ──── verify ──────────────────────►│
     │      {challengeId, answer}         │
     │                                    │
     │ ◄──── result ───────────────────── │
     │       {success: true, token}       │
     │                                    │
     │ ──── Connection Closes ──────────► │
     │                                    │
```

---

## Message Types

### Server → Client

#### `challenge`
Sent immediately after WebSocket connection opens.

```json
{
  "type": "challenge",
  "challengeId": "ch_lxyz123_abc456def789",
  "challengeType": "coherent",
  "words": ["apple", "telescope", "wednesday", "purple", "whisper"],
  "wordCount": 17,
  "instruction": "Write a meaningful 17-word sentence using ALL of these words: apple, telescope, wednesday, purple, whisper",
  "timeoutMs": 9000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"challenge"` |
| `challengeId` | string | Unique challenge identifier |
| `challengeType` | string | Always `"coherent"` |
| `words` | string[] | 5 random words to include in the sentence |
| `wordCount` | number | Required sentence length (15-25 words) |
| `instruction` | string | Human-readable instruction |
| `timeoutMs` | number | Milliseconds until challenge expires (default 9000) |

#### `result`
Sent after client submits verification.

```json
{
  "type": "result",
  "challengeId": "ch_8F5F4BEB9C6C534Cml84ieyw",
  "success": true,
  "token": "rcap_zIZYucP6hpyYdJBVqCN6KkPYwNdQDBrLIINxNvBesDQ"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"result"` |
| `challengeId` | string | The challenge that was verified |
| `success` | boolean | Whether verification succeeded |
| `token` | string? | Token if successful (format: `rcap_<base64>`) |
| `message` | string? | Error message if failed |

#### `timeout`
Sent if client doesn't respond in time.

```json
{
  "type": "timeout",
  "challengeId": "ch_8F5F4BEB9C6C534Cml84ieyw",
  "message": "Challenge timed out"
}
```

#### `error`
Sent on protocol errors.

```json
{
  "type": "error",
  "message": "Invalid message format"
}
```

---

### Client → Server

#### `verify`
Submit verification response.

```json
{
  "type": "verify",
  "challengeId": "ch_lxyz123_abc456def789",
  "answer": "On a purple wednesday morning, I used my telescope to whisper secrets about the ancient apple tree growing nearby."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"verify"` |
| `challengeId` | string | Must match the received challenge |
| `answer` | string | A coherent sentence containing all required words with exactly N words |

---

## HTTP Endpoints

### `GET /health`
Health check.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1707057600000,
  "version": "1.0.0"
}
```

### `POST /validate`
Validate a token.

**Request:**
```json
{
  "token": "rcap_zIZYucP6hpyYdJBVqCN6KkPYwNdQDBrLIINxNvBesDQ"
}
```

**Response (valid):**
```json
{
  "valid": true,
  "challengeId": "ch_8F5F4BEB9C6C534Cml84ieyw",
  "issuedAt": 1707057600000,
  "expiresAt": 1707061200000
}
```

**Response (invalid):**
```json
{
  "valid": false,
  "error": "Token expired"
}
```

---

## Token Format

Tokens are base64-encoded and prefixed with `rcap_`:

```
rcap_<base64-encoded-payload>
```

The payload contains:
- Challenge ID
- Issue timestamp
- Expiry timestamp
- Client IP (hashed)
- HMAC signature

Default expiry: 60 seconds (configurable).

---

## Error Codes

| Code | Message | Cause |
|------|---------|-------|
| `INVALID_CHALLENGE` | Challenge not found or expired | Bad challengeId |
| `EXPIRED` | Challenge timed out | Took too long |
| `INVALID_NONCE` | Invalid nonce | Wrong nonce value |
| `ALREADY_VERIFIED` | Challenge already verified | Replay attempt |
| `TIMEOUT` | Challenge timed out | Server-side timeout |

---

## Security Considerations

### Why This Works

1. **Same-connection requirement:** The nonce is only sent over the WebSocket. You can't get it from a REST call and submit via another connection.

2. **Timing:** The challenge expires server-side. Even if someone intercepts the nonce, they'd need to submit before timeout.

3. **One-time use:** Each challenge can only be verified once. No replay attacks.

4. **Nonce unpredictability:** 32 hex characters = 128 bits of entropy. Can't be guessed.

### What This Doesn't Prevent

- An AI agent helping a human (but AI is in the loop = goal achieved)
- Automated scripts that integrate a real AI API (that's the point!)
- Someone running their own AI locally

### Recommended Timeouts

| Use Case | Timeout | Notes |
|----------|---------|-------|
| High security | 5-7s | Tight, requires fast AI response |
| Standard | 9s | Good balance (default) |
| Accessible | 15s | For high-latency scenarios |

---

## Implementation Notes

### Server
- Use in-memory store for challenges (Redis for production scale)
- Clean up expired challenges periodically
- Log verification attempts for monitoring

### Client (MCP Skill)
- Set client-side timeout slightly higher than server timeout
- Handle all message types gracefully
- Report challenge code in results for debugging

---

## Example Implementation

### Minimal Client (JavaScript)
```javascript
const ws = new WebSocket('ws://localhost:9816');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.type === 'challenge') {
    ws.send(JSON.stringify({
      type: 'verify',
      challengeId: msg.challengeId,
      nonce: msg.nonce
    }));
  }
  
  if (msg.type === 'result' && msg.success) {
    console.log('Token:', msg.token);
    ws.close();
  }
};
```

### Using MCP Skill
```bash
mcporter call rcaptcha.rcaptcha_verify server_url=ws://localhost:9816
```

---

## Changelog

### v1.0.0
- Initial protocol specification
- WebSocket challenge-response flow
- Token generation and validation
