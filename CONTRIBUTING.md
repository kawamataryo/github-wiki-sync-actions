# Contributing to GitHub Wiki Sync Action

Thank you for your interest in contributing to GitHub Wiki Sync Action! This document provides guidelines and instructions for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/wiki-sync.git
cd wiki-sync

# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Development Workflow

### Building

```bash
# Build TypeScript files
npm run build

# Build for production (with ncc)
npm run package
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- config.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Code Quality

```bash
# Run linter
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

## Project Structure

```
wiki-sync/
├── src/                    # Source code
│   ├── index.ts           # Entry point
│   ├── config.ts          # Configuration management
│   ├── github-client.ts   # GitHub API wrapper
│   ├── file-handler.ts    # File system operations
│   ├── sync-engine.ts     # Sync logic
│   ├── error-handler.ts   # Error handling
│   ├── transaction-manager.ts  # Transaction support
│   └── types.ts           # TypeScript types
├── tests/                  # Test files
│   ├── unit/              # Unit tests
│   ├── e2e/               # End-to-end tests
│   └── fixtures/          # Test fixtures
├── .github/               # GitHub specific files
│   └── workflows/         # GitHub Actions workflows
├── action.yml             # Action metadata
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript configuration
├── biome.json            # Biome configuration
└── vitest.config.ts      # Vitest configuration
```

## Architecture Overview

The action is built with the following components:

1. **ConfigManager**: Validates and manages action inputs
2. **GitHubClient**: Wraps GitHub API and Git operations
3. **FileHandler**: Handles file system operations and Markdown processing
4. **SyncEngine**: Core synchronization logic and conflict resolution
5. **ErrorHandler**: Error classification and retry mechanisms
6. **TransactionManager**: Provides atomic operations and rollback capability

## Testing Guidelines

### Unit Tests

- Test files should be placed in `tests/unit/`
- Use descriptive test names
- Mock external dependencies
- Aim for high code coverage

Example:
```typescript
describe('ConfigManager', () => {
  it('should validate required token', async () => {
    // Test implementation
  })
})
```

### E2E Tests

- Test files should be placed in `tests/e2e/`
- Test the entire action flow
- Use realistic scenarios

## Code Style

- We use TypeScript for type safety
- Code formatting is handled by Biome
- Follow the existing code style
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

## Commit Guidelines

- Use clear and descriptive commit messages
- Follow conventional commits format:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `test:` for test changes
  - `refactor:` for code refactoring
  - `chore:` for maintenance tasks

Examples:
```
feat: add support for custom conflict resolution
fix: handle empty wiki repositories correctly
docs: update README with new examples
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Run linter and formatter (`npm run lint && npm run format`)
7. Commit your changes
8. Push to your fork
9. Create a Pull Request

### PR Requirements

- All tests must pass
- Code must be properly formatted
- New features must include tests
- Update documentation if needed
- PR description should clearly explain the changes

## Release Process

Releases are automated using GitHub Actions:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create a new tag (`git tag v1.0.0`)
4. Push the tag (`git push origin v1.0.0`)
5. GitHub Actions will automatically create a release

## Getting Help

- Check existing [issues](https://github.com/your-username/wiki-sync/issues)
- Join discussions in [pull requests](https://github.com/your-username/wiki-sync/pulls)
- Ask questions in issues with the `question` label

## License

By contributing to GitHub Wiki Sync Action, you agree that your contributions will be licensed under the MIT License.