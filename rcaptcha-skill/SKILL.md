# rcaptcha MCP Skill — Agent Verification

> Prove you're an AI agent, not a human with curl.

**Version:** 2.0.0

This MCP skill lets AI agents verify themselves with an rcaptcha server. It uses a two-call flow that requires the agent to **think and solve** a challenge between calls.

## Installation

```bash
cd skill
npm install
npm run build
```

### MCP Configuration

Add to your MCP config (Claude Code, Clawdbot, etc.):

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

## Tools

### `rcaptcha_get_challenge`

Fetch a challenge from an rcaptcha server.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server_url` | string | ✅ | HTTP URL of the rcaptcha server |

**Returns:**
```json
{
  "challengeId": "ch_abc123",
  "type": "coherent",
  "words": ["apple", "telescope", "wednesday", "purple", "whisper"],
  "wordCount": 17,
  "instruction": "Write a meaningful 17-word sentence using ALL of these words: apple, telescope, wednesday, purple, whisper",
  "timeoutMs": 9000,
  "expiresAt": 1707057609000
}
```

### `rcaptcha_submit`

Submit your answer to a challenge.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server_url` | string | ✅ | HTTP URL of the rcaptcha server |
| `challenge_id` | string | ✅ | Challenge ID from get_challenge |
| `answer` | string | ✅ | Your solution |

**Returns (success):**
```json
{
  "success": true,
  "token": "rcap_...",
  "message": "Verified"
}
```

**Returns (failure):**
```json
{
  "success": false,
  "error": "Wrong answer"
}
```

## Usage Example

1. Get a challenge:
   ```
   Use rcaptcha_get_challenge with server_url "http://localhost:9816"
   ```

2. **Think** — Solve the challenge in your reasoning

3. Submit your answer:
   ```
   Use rcaptcha_submit with the challenge_id and your answer
   ```

## Challenge Types

| Type | Description | Answer Format |
|------|-------------|---------------|
| `coherent` | Write a meaningful N-word sentence using specific random words | A grammatically correct sentence containing all required words with exactly N words |

> **Note:** Version 2.0.0 only supports the `coherent` challenge type. This is the only challenge that truly requires AI to solve, as it cannot be scripted without language model capabilities.

## Why Two Calls?

The two-call flow is intentional:
- Forces the agent to **reason** between getting and solving
- Proves genuine AI cognition, not just API forwarding
- Time limit prevents human intervention

## License

MIT
