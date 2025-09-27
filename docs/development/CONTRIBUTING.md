# Contributing to PlayClone

Thank you for your interest in contributing to PlayClone! This document provides guidelines and instructions for contributing to the project.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Issue Reporting](#issue-reporting)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:
- Be respectful and considerate
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/PlayClone.git
   cd PlayClone
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/johnjhusband/PlayClone.git
   ```
4. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Prerequisites
- Node.js 20+ (recommended) or 18.19+ (minimum)
- npm 8+
- Git

### Installation
```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Build the project
npm run build

# Run tests to verify setup
npm test
```

### Development Workflow
```bash
# Start development mode with watch
npm run build:watch

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint

# Format code
npm run format

# Type checking
npm run typecheck
```

## How to Contribute

### Types of Contributions

#### 1. Bug Fixes
- Check existing issues for known bugs
- Create a minimal reproduction case
- Submit a PR with the fix and test case

#### 2. New Features
- Open an issue to discuss the feature first
- Get feedback from maintainers
- Implement with tests and documentation
- Submit PR for review

#### 3. Documentation
- Fix typos or clarify existing docs
- Add examples and use cases
- Improve API documentation
- Create tutorials

#### 4. Tests
- Add missing test coverage
- Improve test reliability
- Add performance benchmarks
- Create integration tests

#### 5. Performance Improvements
- Profile and identify bottlenecks
- Implement optimizations
- Include benchmarks showing improvements
- Ensure no functionality regression

## Pull Request Process

### Before Submitting

1. **Update your fork**:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Rebase your feature branch**:
   ```bash
   git checkout feature/your-feature
   git rebase main
   ```

3. **Run all checks**:
   ```bash
   npm run lint
   npm run format:check
   npm run typecheck
   npm test
   npm run test:self
   ```

### PR Guidelines

1. **Title**: Use conventional commit format
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `test:` Test additions/changes
   - `perf:` Performance improvements
   - `refactor:` Code refactoring
   - `chore:` Maintenance tasks

2. **Description**: Include:
   - What changes were made
   - Why they were necessary
   - Any breaking changes
   - Related issues

3. **Testing**: Ensure:
   - All tests pass
   - New code has test coverage
   - Self-tests still work
   - No performance regression

4. **Documentation**: Update:
   - JSDoc comments for new APIs
   - README if needed
   - API_REFERENCE.md for new methods
   - USAGE_GUIDE.md for new features

### Review Process

1. Maintainers will review your PR
2. Address any feedback or requested changes
3. Once approved, PR will be merged
4. Your contribution will be included in the next release

## Coding Standards

### TypeScript Style

- Use TypeScript strict mode
- Prefer interfaces over type aliases for objects
- Use explicit return types for public methods
- Document all public APIs with JSDoc
- Use meaningful variable and function names

### Code Organization

```typescript
// Good: Clear, self-documenting code
interface BrowserOptions {
  headless?: boolean;
  viewport?: { width: number; height: number };
}

class BrowserManager {
  /**
   * Launches a new browser instance
   * @param options - Browser configuration options
   * @returns Promise resolving to browser instance
   */
  async launch(options: BrowserOptions = {}): Promise<Browser> {
    // Implementation
  }
}

// Avoid: Unclear code without types or documentation
class Manager {
  async start(opts: any) {
    // Implementation
  }
}
```

### Error Handling

- Use custom error classes from `src/errors/`
- Provide helpful error messages
- Include context and recovery suggestions
- Handle edge cases gracefully

## Testing Guidelines

### Test Structure

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should handle normal case', async () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = await component.method(input);
      
      // Assert
      expect(result).toBe('expected');
    });

    it('should handle edge case', async () => {
      // Test edge cases
    });

    it('should handle errors gracefully', async () => {
      // Test error scenarios
    });
  });
});
```

### Test Coverage

- Aim for >80% code coverage
- Test happy paths and edge cases
- Include error scenarios
- Add integration tests for complex features
- Create self-tests for new functionality

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- BrowserManager

# Run with coverage
npm test -- --coverage

# Run self-tests
npm run test:self

# Run stress tests
npm run test:stress
```

## Documentation

### JSDoc Comments

```typescript
/**
 * Navigates to the specified URL
 * 
 * @param url - The URL to navigate to
 * @param options - Navigation options
 * @param options.timeout - Maximum navigation time in milliseconds
 * @param options.waitUntil - When to consider navigation complete
 * @returns Promise with navigation result
 * @throws {NavigationError} If navigation fails
 * 
 * @example
 * ```typescript
 * const result = await playclone.navigate('https://example.com', {
 *   timeout: 30000,
 *   waitUntil: 'networkidle'
 * });
 * ```
 */
```

### README Updates

Update README.md when:
- Adding new features
- Changing installation process
- Modifying API
- Adding requirements

### Examples

Create examples for:
- New features
- Complex use cases
- Integration patterns
- Best practices

## Issue Reporting

### Bug Reports

Include:
1. **Description**: Clear explanation of the issue
2. **Reproduction**: Minimal code to reproduce
3. **Expected**: What should happen
4. **Actual**: What actually happens
5. **Environment**: Node version, OS, browser
6. **Screenshots**: If applicable
7. **Logs**: Error messages or stack traces

### Feature Requests

Include:
1. **Use Case**: Why is this needed?
2. **Proposed Solution**: How should it work?
3. **Alternatives**: Other approaches considered
4. **Examples**: Code showing desired usage

## Community

- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Report bugs and request features
- **Discord**: Join our community (coming soon)
- **Twitter**: Follow for updates (coming soon)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to open an issue or discussion if you have questions about contributing!

Thank you for helping make PlayClone better! 🚀