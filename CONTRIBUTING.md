# Contributing to rCAPTCHA

Thank you for your interest in contributing to rCAPTCHA! This document provides guidelines and instructions for contributing.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Set up the development environment
4. Create a feature branch
5. Make your changes
6. Submit a pull request

## Development Setup

### Prerequisites
- [Bun](https://bun.sh/) >= 1.0.0
- An OpenAI API key for testing coherence checking

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/rcaptcha.git
cd rcaptcha

# Install dependencies
cd server
bun install

# Set up environment
export OPENAI_API_KEY="sk-your-key-here"
export CORS_ORIGINS="http://localhost:3000"

# Run in development mode
bun run dev
```

### Running Tests

```bash
cd server
bun test
```

### Type Checking

```bash
cd server
bun run typecheck
```

## Code Style

### TypeScript Guidelines
- Use TypeScript for all new code
- Enable strict mode
- Prefer `const` over `let` where possible
- Use explicit types for function parameters and return values
- Avoid `any` type - use `unknown` if type is truly unknown

### Formatting
- Use 2 spaces for indentation
- Use single quotes for strings
- No trailing whitespace
- End files with a newline
- Use LF line endings

### Naming Conventions
- `camelCase` for variables and functions
- `PascalCase` for types, interfaces, and classes
- `UPPER_SNAKE_CASE` for constants
- Descriptive names that convey intent

### File Organization
- One module per file
- Group related exports
- Place types at the top of the file
- Place helper functions before main exports

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format
```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning (formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or correcting tests
- `chore`: Changes to build process or auxiliary tools

### Examples
```
feat(server): add rate limiting for challenge endpoints
fix(sessions): use cryptographically secure random IDs
docs(readme): update environment variable documentation
```

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines

3. **Write/update tests** for your changes

4. **Run the test suite** and ensure all tests pass:
   ```bash
   bun test
   bun run typecheck
   ```

5. **Commit your changes** using conventional commit messages

6. **Push to your fork** and create a pull request

7. **Fill out the PR template** completely

8. **Address review feedback** promptly

### PR Requirements
- All CI checks must pass
- At least one maintainer approval required
- No merge conflicts with `main`
- Documentation updated if needed

## Testing

### Writing Tests
- Place tests in `server/src/__tests__/` or alongside source files as `*.test.ts`
- Use descriptive test names
- Test both success and failure cases
- Mock external dependencies (e.g., OpenAI API)

### Test Structure
```typescript
import { describe, it, expect } from 'bun:test';

describe('moduleName', () => {
  describe('functionName', () => {
    it('should do something when condition', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## Reporting Issues

### Bug Reports
- Use the bug report template
- Include reproduction steps
- Include environment information
- Include relevant logs

### Feature Requests
- Use the feature request template
- Explain the use case
- Describe alternatives considered

### Security Vulnerabilities
Do NOT report security vulnerabilities through public issues. See [SECURITY.md](SECURITY.md) for our security policy.

## Questions?

Feel free to open an issue for questions or reach out to the maintainers.

Thank you for contributing!
