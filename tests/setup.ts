import { vi } from 'vitest'

// GitHub Actions環境変数のモック
process.env.GITHUB_REPOSITORY = 'test-owner/test-repo'
process.env.GITHUB_ACTOR = 'test-user'
process.env.GITHUB_SHA = 'abc123'
process.env.GITHUB_REF = 'refs/heads/main'

// @actions/core のモック
vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}))

// @actions/github のモック
vi.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
    sha: 'abc123',
    ref: 'refs/heads/main',
  },
  getOctokit: vi.fn(() => ({
    rest: {
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
        deleteFile: vi.fn(),
      },
    },
  })),
}))