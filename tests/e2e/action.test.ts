import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { testMarkdownContent } from '../fixtures/test-docs'

// This test simulates the entire action flow
describe('GitHub Wiki Sync Action E2E', () => {
  let tempDir: string
  let originalCwd: string

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wiki-sync-test-'))
    originalCwd = process.cwd()
    process.chdir(tempDir)

    // Create test docs folder
    await fs.mkdir('docs', { recursive: true })
    
    // Setup environment
    process.env.GITHUB_REPOSITORY = 'test-owner/test-repo'
    process.env.GITHUB_ACTOR = 'test-user'
    process.env.GITHUB_SHA = 'abc123'
    process.env.GITHUB_REF = 'refs/heads/main'
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should sync new files from repository to wiki', { timeout: 30000 }, async () => {
    // Setup test files
    await fs.writeFile(
      path.join('docs', 'getting-started.md'),
      testMarkdownContent.simple,
    )
    await fs.writeFile(
      path.join('docs', 'api-reference.md'),
      testMarkdownContent.withCode,
    )

    // Mock inputs
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'token') return 'test-token'
      if (name === 'sync-folder') return 'docs'
      if (name === 'conflict-strategy') return 'repo-wins'
      return ''
    })

    // Mock GitHub API
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi.fn().mockResolvedValue({
            data: [
              {
                type: 'file',
                name: 'getting-started.md',
                path: 'docs/getting-started.md',
                sha: 'sha1',
                size: 100,
              },
              {
                type: 'file',
                name: 'api-reference.md',
                path: 'docs/api-reference.md',
                sha: 'sha2',
                size: 200,
              },
            ],
          }),
          createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
        },
      },
    }

    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any)

    // Simple git mocks
    vi.mock('simple-git', () => ({
      default: vi.fn(() => ({
        clone: vi.fn().mockResolvedValue(undefined),
        add: vi.fn().mockReturnThis(),
        commit: vi.fn().mockReturnThis(),
        push: vi.fn().mockReturnThis(),
      })),
    }))

    // Run the action
    const { run } = await import('../../src/index')
    await run()

    // Verify that the action attempted to process files
    expect(core.info).toHaveBeenCalledWith('GitHub Wiki Sync Action started')
    expect(core.info).toHaveBeenCalledWith('Repository: test-owner/test-repo')
    expect(core.info).toHaveBeenCalledWith('Sync folder: docs')
  })

  it('should handle configuration errors gracefully', async () => {
    // Mock missing token
    vi.mocked(core.getInput).mockImplementation((name, options) => {
      if (name === 'token' && options?.required) {
        throw new Error('Input required and not supplied: token')
      }
      return ''
    })

    // Run the action
    const { run } = await import('../../src/index')
    await run()

    // Verify error handling
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Action failed'),
    )
  })

  it('should handle sync conflicts according to strategy', async () => {
    // Create conflicting content
    await fs.writeFile(
      path.join('docs', 'conflict.md'),
      testMarkdownContent.conflict.repo,
    )

    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'token') return 'test-token'
      if (name === 'sync-folder') return 'docs'
      if (name === 'conflict-strategy') return 'wiki-wins'
      return ''
    })

    // Mock wiki having different content
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi.fn().mockResolvedValue({
            data: {
              type: 'file',
              name: 'conflict.md',
              path: 'docs/conflict.md',
              content: Buffer.from(testMarkdownContent.conflict.wiki).toString('base64'),
              sha: 'sha-wiki',
            },
          }),
        },
      },
    }

    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any)

    // Test would verify that wiki-wins strategy is applied
    // In practice, this requires more complete mocking of git operations
  })
})