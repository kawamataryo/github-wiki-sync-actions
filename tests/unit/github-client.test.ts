import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as github from '@actions/github'
import simpleGit from 'simple-git'
import { GitHubClient } from '../../src/github-client'
import type { ActionConfig } from '../../src/types'

vi.mock('simple-git', () => ({
  default: vi.fn(() => ({
    clone: vi.fn(),
    add: vi.fn().mockReturnThis(),
    commit: vi.fn().mockReturnThis(),
    push: vi.fn().mockReturnThis(),
  })),
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}))

describe('GitHubClient', () => {
  let githubClient: GitHubClient
  let mockOctokit: any

  const mockConfig: ActionConfig = {
    token: 'test-token',
    repository: 'test-owner/test-repo',
    owner: 'test-owner',
    repo: 'test-repo',
    syncFolder: 'docs',
    wikiRepo: 'https://test-token@github.com/test-owner/test-repo.wiki.git',
    conflictStrategy: 'repo-wins',
    syncDeletes: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockOctokit = {
      rest: {
        repos: {
          getContent: vi.fn(),
          createOrUpdateFileContents: vi.fn(),
          deleteFile: vi.fn(),
        },
      },
    }

    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit)
    githubClient = new GitHubClient(mockConfig)
  })

  describe('getRepositoryFiles', () => {
    it('should get files from repository', async () => {
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: [
          { type: 'file', name: 'file1.md', path: 'docs/file1.md', sha: 'sha1', size: 100 },
          { type: 'file', name: 'file2.txt', path: 'docs/file2.txt', sha: 'sha2', size: 200 },
          { type: 'dir', name: 'subdir', path: 'docs/subdir' },
        ],
      })

      const files = await githubClient.getRepositoryFiles('docs')

      expect(files).toHaveLength(1)
      expect(files[0]).toMatchObject({
        name: 'file1.md',
        path: 'docs/file1.md',
        sha: 'sha1',
        size: 100,
      })
    })

    it('should handle single file response', async () => {
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: {
          type: 'file',
          name: 'single.md',
          path: 'docs/single.md',
          sha: 'sha123',
          size: 50,
        },
      })

      const files = await githubClient.getRepositoryFiles('docs/single.md')

      expect(files).toHaveLength(1)
      expect(files[0].name).toBe('single.md')
    })

    it('should return empty array for non-existent path', async () => {
      mockOctokit.rest.repos.getContent.mockRejectedValue({ status: 404 })

      const files = await githubClient.getRepositoryFiles('non-existent')

      expect(files).toEqual([])
    })

    it('should recursively fetch subdirectories', async () => {
      mockOctokit.rest.repos.getContent
        .mockResolvedValueOnce({
          data: [{ type: 'dir', name: 'subdir', path: 'docs/subdir' }],
        })
        .mockResolvedValueOnce({
          data: [
            { type: 'file', name: 'nested.md', path: 'docs/subdir/nested.md', sha: 'sha3', size: 75 },
          ],
        })

      const files = await githubClient.getRepositoryFiles('docs')

      expect(files).toHaveLength(1)
      expect(files[0].path).toBe('docs/subdir/nested.md')
    })
  })

  describe('getFileContent', () => {
    it('should get file content', async () => {
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: {
          type: 'file',
          content: Buffer.from('# Test Content').toString('base64'),
          sha: 'sha123',
        },
      })

      const result = await githubClient.getFileContent('test.md')

      expect(result.content).toBe('# Test Content')
      expect(result.sha).toBe('sha123')
    })

    it('should throw error for non-file', async () => {
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: { type: 'dir' },
      })

      await expect(githubClient.getFileContent('test-dir')).rejects.toThrow('is not a file')
    })
  })

  describe('createFile', () => {
    it('should create a file', async () => {
      await githubClient.createFile('new.md', 'New content', 'Create new file')

      expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'new.md',
        message: 'Create new file',
        content: Buffer.from('New content').toString('base64'),
      })
    })

    it('should use default message', async () => {
      await githubClient.createFile('new.md', 'New content')

      expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Create new.md',
        }),
      )
    })
  })

  describe('updateFile', () => {
    it('should update a file', async () => {
      await githubClient.updateFile('existing.md', 'Updated content', 'sha456', 'Update file')

      expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'existing.md',
        message: 'Update file',
        content: Buffer.from('Updated content').toString('base64'),
        sha: 'sha456',
      })
    })
  })

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      await githubClient.deleteFile('delete.md', 'sha789', 'Remove file')

      expect(mockOctokit.rest.repos.deleteFile).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'delete.md',
        message: 'Remove file',
        sha: 'sha789',
      })
    })
  })

  describe('Wiki operations', () => {
    it('should clone wiki', async () => {
      const mockGit = simpleGit()
      await githubClient.cloneWiki('/tmp/wiki')

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://test-token@github.com/test-owner/test-repo.wiki.git',
        '/tmp/wiki',
      )
    })

    it('should commit wiki changes', async () => {
      await githubClient.commitWikiChanges('/tmp/wiki', 'Update wiki')

      const git = simpleGit('/tmp/wiki')
      expect(git.add).toHaveBeenCalledWith('.')
      expect(git.commit).toHaveBeenCalledWith('Update wiki')
    })

    it('should push wiki changes', async () => {
      await githubClient.pushWikiChanges('/tmp/wiki')

      const git = simpleGit('/tmp/wiki')
      expect(git.push).toHaveBeenCalled()
    })
  })
})