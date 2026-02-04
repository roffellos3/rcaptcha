# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | Yes                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue
2. Email the maintainers directly or use GitHub's private vulnerability reporting feature
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- Acknowledgment within 48 hours
- Status update within 7 days
- We aim to release fixes within 30 days for critical issues

### Scope

Security concerns include:
- Authentication bypass
- Token forgery or prediction
- Rate limiting bypass
- Input validation issues
- Information disclosure

Out of scope:
- Issues in dependencies (report to the dependency maintainer)
- Issues requiring physical access
- Social engineering

## Security Best Practices

When deploying rCAPTCHA:

1. Always set `CORS_ORIGINS` explicitly (don't use wildcards in production)
2. Use HTTPS in production
3. Keep your `OPENAI_API_KEY` secure
4. Monitor logs for unusual patterns
5. Keep the server updated to the latest version
