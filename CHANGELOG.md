# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of GitHub Wiki Sync Action
- Bidirectional synchronization between repository and wiki
- Multiple conflict resolution strategies (repo-wins, wiki-wins, manual, skip)
- Transaction management with rollback capability
- Advanced error handling with retry mechanisms
- Circuit breaker pattern for fault tolerance
- Comprehensive test suite with Vitest
- TypeScript implementation for type safety
- Biome for code formatting and linting
- GitHub Actions workflows for CI/CD
- Support for nested folder structures
- Automatic file name conversion between repo and wiki formats
- Detailed logging and progress reporting
- GitHub Actions Marketplace compatibility

### Security
- Secure token handling
- Input validation and sanitization
- Safe file path handling
