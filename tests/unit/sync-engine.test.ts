import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as core from '@actions/core'
import { SyncEngine } from '../../src/sync-engine'
import { GitHubClient } from '../../src/github-client'
import { FileHandler } from '../../src/file-handler'
import type { ActionConfig, MarkdownFile, WikiPage } from '../../src/types'

vi.mock('node:fs/promises')
vi.mock('../../src/github-client')
vi.mock('../../src/file-handler')

describe('SyncEngine', () => {
  let syncEngine: SyncEngine
  let mockGithubClient: jest.Mocked<GitHubClient>
  let mockFileHandler: jest.Mocked<FileHandler>

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
    vi.mocked(fs.mkdtemp).mockResolvedValue('/tmp/wiki-sync-123456789')
    vi.spyOn(Date, 'now').mockReturnValue(123456789)

    mockGithubClient = new GitHubClient(mockConfig) as jest.Mocked<GitHubClient>
    mockFileHandler = new FileHandler(mockConfig) as jest.Mocked<FileHandler>
    syncEngine = new SyncEngine(mockGithubClient, mockFileHandler, mockConfig)
  })

  describe('sync', () => {
    it('should perform successful sync with no changes', async () => {
      mockGithubClient.cloneWiki.mockResolvedValue('/tmp/wiki-sync-123456789')
      mockGithubClient.getWikiPages.mockResolvedValue([])
      mockFileHandler.readMarkdownFiles.mockResolvedValue([])

      const result = await syncEngine.sync()

      expect(result.success).toBe(true)
      expect(result.changesApplied).toBe(0)
      expect(result.errors).toHaveLength(0)
      expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining('wiki-sync-123456789'), {
        recursive: true,
        force: true,
      })
    })

    it('should sync new files from repository to wiki', async () => {
      const repoFiles: MarkdownFile[] = [
        {
          path: '/project/docs/new.md',
          relativePath: 'new.md',
          name: 'new.md',
          content: '# New File',
          lastModified: new Date(),
        },
      ]

      mockGithubClient.cloneWiki.mockResolvedValue('/tmp/wiki-sync-123456789')
      mockGithubClient.getWikiPages.mockResolvedValue([])
      mockFileHandler.readMarkdownFiles.mockResolvedValue(repoFiles)
      mockFileHandler.convertPathToWikiName.mockReturnValue('new')
      mockFileHandler.writeMarkdownFile.mockResolvedValue(undefined)
      mockGithubClient.commitWikiChanges.mockResolvedValue(undefined)
      mockGithubClient.pushWikiChanges.mockResolvedValue(undefined)

      const result = await syncEngine.sync()

      expect(result.success).toBe(true)
      expect(result.changesApplied).toBe(1)
      expect(mockFileHandler.writeMarkdownFile).toHaveBeenCalledWith(
        expect.stringContaining('wiki-sync-123456789/new.md'),
        '# New File',
      )
      expect(mockGithubClient.commitWikiChanges).toHaveBeenCalled()
      expect(mockGithubClient.pushWikiChanges).toHaveBeenCalled()
    })

    it('should sync updated files with conflict resolution', async () => {
      const repoFiles: MarkdownFile[] = [
        {
          path: '/project/docs/existing.md',
          relativePath: 'existing.md',
          name: 'existing.md',
          content: '# Updated from repo',
          lastModified: new Date(),
        },
      ]

      const wikiPages: WikiPage[] = [
        {
          name: 'existing',
          path: 'existing.md',
          content: '# Original wiki content',
          lastModified: new Date(),
        },
      ]

      mockGithubClient.cloneWiki.mockResolvedValue('/tmp/wiki-sync-123456789')
      mockGithubClient.getWikiPages.mockResolvedValue(wikiPages)
      mockFileHandler.readMarkdownFiles.mockResolvedValue(repoFiles)
      mockFileHandler.convertPathToWikiName.mockReturnValue('existing')
      mockFileHandler.writeMarkdownFile.mockResolvedValue(undefined)
      mockGithubClient.commitWikiChanges.mockResolvedValue(undefined)
      mockGithubClient.pushWikiChanges.mockResolvedValue(undefined)

      const result = await syncEngine.sync()

      expect(result.success).toBe(true)
      expect(result.changesApplied).toBe(1)
      // With repo-wins strategy, repo content should be written
      expect(mockFileHandler.writeMarkdownFile).toHaveBeenCalledWith(
        expect.stringContaining('wiki-sync-123456789/existing.md'),
        '# Updated from repo',
      )
    })

    it('should handle errors during sync', async () => {
      mockGithubClient.cloneWiki.mockRejectedValue(new Error('Clone failed'))

      await expect(syncEngine.sync()).rejects.toThrow('Clone failed')
    })

    it('should handle partial failures', async () => {
      const repoFiles: MarkdownFile[] = [
        {
          path: '/project/docs/file1.md',
          relativePath: 'file1.md',
          name: 'file1.md',
          content: '# File 1',
          lastModified: new Date(),
        },
        {
          path: '/project/docs/file2.md',
          relativePath: 'file2.md',
          name: 'file2.md',
          content: '# File 2',
          lastModified: new Date(),
        },
      ]

      mockGithubClient.cloneWiki.mockResolvedValue('/tmp/wiki-sync-123456789')
      mockGithubClient.getWikiPages.mockResolvedValue([])
      mockFileHandler.readMarkdownFiles.mockResolvedValue(repoFiles)
      mockFileHandler.convertPathToWikiName.mockImplementation((path) =>
        path.replace('.md', ''),
      )
      
      // First file succeeds, second fails
      mockFileHandler.writeMarkdownFile
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Write failed'))

      mockGithubClient.commitWikiChanges.mockResolvedValue(undefined)
      mockGithubClient.pushWikiChanges.mockResolvedValue(undefined)

      const result = await syncEngine.sync()

      expect(result.success).toBe(true)
      expect(result.changesApplied).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Partial sync completed'))
    })
  })

  describe('detectChanges', () => {
    beforeEach(async () => {
      // detectChangesテストのためにwikiPathを直接設定
      syncEngine['wikiPath'] = '/tmp/wiki-sync-123456789'
    })

    it('should detect files to create in wiki', async () => {
      const repoFiles: MarkdownFile[] = [
        {
          path: '/project/docs/new.md',
          relativePath: 'new.md',
          name: 'new.md',
          content: '# New File',
          lastModified: new Date(),
        },
      ]

      mockFileHandler.readMarkdownFiles.mockResolvedValue(repoFiles)
      mockGithubClient.getWikiPages.mockResolvedValue([])
      mockFileHandler.convertPathToWikiName.mockReturnValue('new')

      const changes = await syncEngine.detectChanges()

      expect(changes).toHaveLength(1)
      expect(changes[0]).toMatchObject({
        type: 'create',
        source: 'repo',
        direction: 'repo-to-wiki',
        wikiName: 'new',
        content: '# New File',
      })
    })

    it('should detect files to create in repository', async () => {
      const wikiPages: WikiPage[] = [
        {
          name: 'wiki-only',
          path: 'wiki-only.md',
          content: '# Wiki Only',
        },
      ]

      mockFileHandler.readMarkdownFiles.mockResolvedValue([])
      mockGithubClient.getWikiPages.mockResolvedValue(wikiPages)
      mockFileHandler.convertWikiNameToPath.mockReturnValue('docs/wiki-only.md')
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'))

      const changes = await syncEngine.detectChanges()

      // syncDeletes=trueなので、createとdeleteの2つのchangeが期待される
      expect(changes).toHaveLength(2)
      
      const createChange = changes.find(c => c.type === 'create')
      expect(createChange).toMatchObject({
        type: 'create',
        source: 'wiki',
        direction: 'wiki-to-repo',
        wikiName: 'wiki-only',
        content: '# Wiki Only',
      })
      
      const deleteChange = changes.find(c => c.type === 'delete')
      expect(deleteChange).toMatchObject({
        type: 'delete',
        source: 'repo',
        direction: 'repo-to-wiki',
        wikiName: 'wiki-only',
      })
    })

    it('should detect deletions when syncDeletes is enabled', async () => {
      const wikiPages: WikiPage[] = [
        {
          name: 'to-delete',
          path: 'to-delete.md',
          content: '# To Delete',
        },
      ]

      mockFileHandler.readMarkdownFiles.mockResolvedValue([])
      mockGithubClient.getWikiPages.mockResolvedValue(wikiPages)
      mockFileHandler.convertWikiNameToPath.mockReturnValue('to-delete.md')

      const changes = await syncEngine.detectChanges()

      expect(changes).toHaveLength(2) // One create in repo, one delete from wiki
      const deleteChange = changes.find((c) => c.type === 'delete')
      expect(deleteChange).toMatchObject({
        type: 'delete',
        source: 'repo',
        direction: 'repo-to-wiki',
        wikiName: 'to-delete',
      })
    })
  })

  describe('conflict resolution', () => {
    it('should apply repo-wins strategy', async () => {
      const config = { ...mockConfig, conflictStrategy: 'repo-wins' as const }
      syncEngine = new SyncEngine(mockGithubClient, mockFileHandler, config)

      const repoFiles: MarkdownFile[] = [
        {
          path: '/project/docs/conflict.md',
          relativePath: 'conflict.md',
          name: 'conflict.md',
          content: '# Repo Version',
          lastModified: new Date(),
        },
      ]

      const wikiPages: WikiPage[] = [
        {
          name: 'conflict',
          path: 'conflict.md',
          content: '# Wiki Version',
          lastModified: new Date(),
        },
      ]

      mockGithubClient.cloneWiki.mockResolvedValue('/tmp/wiki-sync-123456789')
      mockGithubClient.getWikiPages.mockResolvedValue(wikiPages)
      mockFileHandler.readMarkdownFiles.mockResolvedValue(repoFiles)
      mockFileHandler.convertPathToWikiName.mockReturnValue('conflict')
      mockFileHandler.writeMarkdownFile.mockResolvedValue(undefined)
      mockGithubClient.commitWikiChanges.mockResolvedValue(undefined)
      mockGithubClient.pushWikiChanges.mockResolvedValue(undefined)

      await syncEngine.sync()

      expect(mockFileHandler.writeMarkdownFile).toHaveBeenCalledWith(
        expect.any(String),
        '# Repo Version',
      )
    })

    it('should apply wiki-wins strategy', async () => {
      const config = { ...mockConfig, conflictStrategy: 'wiki-wins' as const }
      syncEngine = new SyncEngine(mockGithubClient, mockFileHandler, config)

      const repoFiles: MarkdownFile[] = [
        {
          path: '/project/docs/conflict.md',
          relativePath: 'conflict.md',
          name: 'conflict.md',
          content: '# Repo Version',
          lastModified: new Date(),
        },
      ]

      const wikiPages: WikiPage[] = [
        {
          name: 'conflict',
          path: 'conflict.md',
          content: '# Wiki Version',
          lastModified: new Date(),
        },
      ]

      mockGithubClient.cloneWiki.mockResolvedValue('/tmp/wiki-sync-123456789')
      mockGithubClient.getWikiPages.mockResolvedValue(wikiPages)
      mockFileHandler.readMarkdownFiles.mockResolvedValue(repoFiles)
      mockFileHandler.convertPathToWikiName.mockReturnValue('conflict')
      mockFileHandler.writeMarkdownFile.mockResolvedValue(undefined)
      mockGithubClient.commitWikiChanges.mockResolvedValue(undefined)
      mockGithubClient.pushWikiChanges.mockResolvedValue(undefined)

      await syncEngine.sync()

      expect(mockFileHandler.writeMarkdownFile).toHaveBeenCalledWith(
        expect.any(String),
        '# Wiki Version',
      )
    })
  })
})