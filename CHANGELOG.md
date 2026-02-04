# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-02-04

### Added
- Initial public release
- Coherent sentence challenge type
- Multi-block authentication flow (3 attempts)
- HTTP REST API endpoints:
  - `GET /health` - Health check
  - `POST /challenge` - Get a new challenge
  - `POST /submit` - Submit an answer
  - `POST /validate` - Validate a token
  - `POST /auth/start` - Start multi-block auth session
  - `POST /auth/submit` - Submit answer for current block
  - `GET /auth/status` - Check session status
- WebSocket support (legacy)
- Rate limiting (10 req/min for challenges, 30 req/min for submissions)
- Input validation with size limits
- Cryptographically secure ID generation
- Token-based verification system
- OpenAI integration for coherence checking

### Security
- Per-IP rate limiting
- WebSocket connection limits (1000 total, 10 per IP)
- Request body size limits (100KB)
- Sentence length validation (10,000 chars max)
- Secure random number generation using crypto.getRandomValues()
- Required OPENAI_API_KEY validation at startup
- CORS origin configuration required (no wildcard default)

### Documentation
- README with quick start guide
- Protocol specification
- Multi-block auth flow documentation
- MCP skill documentation
- Contributing guidelines
- Security policy
