import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { FileHandler } from '../../src/file-handler'
import type { ActionConfig } from '../../src/types'

vi.mock('node:fs/promises')

describe('FileHandler', () => {
  let fileHandler: FileHandler
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
    fileHandler = new FileHandler(mockConfig)
  })

  describe('readMarkdownFiles', () => {
    it('should read markdown files from directory', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'file1.md', isDirectory: () => false, isFile: () => true } as any,
        { name: 'file2.txt', isDirectory: () => false, isFile: () => true } as any,
        { name: 'subdir', isDirectory: () => true, isFile: () => false } as any,
      ])

      vi.mocked(fs.readFile).mockImplementation((filePath) => {
        if (filePath.toString().endsWith('file1.md')) {
          return Promise.resolve('# File 1 content')
        }
        return Promise.reject(new Error('File not found'))
      })

      vi.mocked(fs.stat).mockResolvedValue({
        mtime: new Date('2023-01-01'),
      } as any)

      const files = await fileHandler.readMarkdownFiles('/test/dir')

      expect(files).toHaveLength(1)
      expect(files[0]).toMatchObject({
        name: 'file1.md',
        content: '# File 1 content',
        lastModified: new Date('2023-01-01'),
      })
    })

    it('should handle non-existent directory', async () => {
      const error = new Error('ENOENT') as any
      error.code = 'ENOENT'
      vi.mocked(fs.readdir).mockRejectedValue(error)

      const files = await fileHandler.readMarkdownFiles('/non-existent')
      expect(files).toEqual([])
    })

    it('should recursively read subdirectories', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce([
          { name: 'subdir', isDirectory: () => true, isFile: () => false } as any,
        ])
        .mockResolvedValueOnce([
          { name: 'nested.md', isDirectory: () => false, isFile: () => true } as any,
        ])

      vi.mocked(fs.readFile).mockResolvedValue('# Nested content')
      vi.mocked(fs.stat).mockResolvedValue({ mtime: new Date() } as any)

      const files = await fileHandler.readMarkdownFiles('/test/dir')

      expect(files).toHaveLength(1)
      expect(files[0].name).toBe('nested.md')
    })
  })

  describe('writeMarkdownFile', () => {
    it('should create directory if not exists', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)

      await fileHandler.writeMarkdownFile('/test/dir/file.md', 'content')

      expect(fs.mkdir).toHaveBeenCalledWith('/test/dir', { recursive: true })
      expect(fs.writeFile).toHaveBeenCalledWith('/test/dir/file.md', 'content', 'utf-8')
    })
  })

  describe('deleteMarkdownFile', () => {
    it('should delete file and clean empty directories', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined)
      vi.mocked(fs.readdir).mockResolvedValue([])
      vi.mocked(fs.rmdir).mockResolvedValue(undefined)

      await fileHandler.deleteMarkdownFile('/test/dir/file.md')

      expect(fs.unlink).toHaveBeenCalledWith('/test/dir/file.md')
      expect(fs.readdir).toHaveBeenCalled()
    })

    it('should ignore ENOENT errors', async () => {
      const error = new Error('ENOENT') as any
      error.code = 'ENOENT'
      vi.mocked(fs.unlink).mockRejectedValue(error)

      await expect(fileHandler.deleteMarkdownFile('/non-existent.md')).resolves.not.toThrow()
    })
  })

  describe('sanitizeFileName', () => {
    it('should remove invalid characters', () => {
      expect(fileHandler.sanitizeFileName('file<>:"|?*.md')).toBe('file______.md')
      expect(fileHandler.sanitizeFileName('file name.md')).toBe('file name.md')
      expect(fileHandler.sanitizeFileName('  file  name  .md  ')).toBe('file name .md')
    })
  })

  describe('convertPathToWikiName', () => {
    it('should convert file path to wiki name', () => {
      expect(fileHandler.convertPathToWikiName('docs/guide/getting-started.md')).toBe(
        'docs-guide-getting-started',
      )
      expect(fileHandler.convertPathToWikiName('README.md')).toBe('README')
      expect(fileHandler.convertPathToWikiName('path/to/file.MD')).toBe('path-to-file')
    })

    it('should handle edge cases', () => {
      expect(fileHandler.convertPathToWikiName('//multiple//slashes//.md')).toBe(
        'multiple-slashes',
      )
      expect(fileHandler.convertPathToWikiName('-leading-trailing-.md')).toBe('leading-trailing')
    })
  })

  describe('convertWikiNameToPath', () => {
    it('should convert wiki name to file path', () => {
      expect(fileHandler.convertWikiNameToPath('guide-getting-started')).toBe(
        'guide/getting-started.md',
      )
      expect(fileHandler.convertWikiNameToPath('README')).toBe('README.md')
      expect(fileHandler.convertWikiNameToPath('single', 'docs')).toBe('docs/single.md')
    })

    it('should handle files already with .md extension', () => {
      expect(fileHandler.convertWikiNameToPath('file.md')).toBe('file.md')
    })
  })
})