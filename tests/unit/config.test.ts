import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as core from '@actions/core'
import { ConfigManager } from '../../src/config'

describe('ConfigManager', () => {
  let configManager: ConfigManager

  beforeEach(() => {
    vi.clearAllMocks()
    configManager = new ConfigManager()
  })

  describe('load', () => {
    it('should load configuration with default values', async () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        if (name === 'token') return 'test-token'
        if (name === 'sync-folder') return ''
        if (name === 'conflict-strategy') return ''
        if (name === 'sync-deletes') return ''
        return ''
      })

      await configManager.load()

      expect(configManager.token).toBe('test-token')
      expect(configManager.syncFolder).toBe('docs')
      expect(configManager.conflictStrategy).toBe('repo-wins')
      expect(configManager.repository).toBe('test-owner/test-repo')
      expect(configManager.syncDeletes).toBe(true)
    })

    it('should load configuration with custom values', async () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        if (name === 'token') return 'custom-token'
        if (name === 'sync-folder') return 'custom-docs'
        if (name === 'conflict-strategy') return 'wiki-wins'
        if (name === 'sync-deletes') return 'false'
        return ''
      })

      await configManager.load()

      expect(configManager.token).toBe('custom-token')
      expect(configManager.syncFolder).toBe('custom-docs')
      expect(configManager.conflictStrategy).toBe('wiki-wins')
      expect(configManager.syncDeletes).toBe(false)
    })

    it('should throw error if token is missing', async () => {
      vi.mocked(core.getInput).mockImplementation((name, options) => {
        if (name === 'token' && options?.required) {
          throw new Error('Input required and not supplied: token')
        }
        return ''
      })

      await expect(configManager.load()).rejects.toThrow()
    })
  })

  describe('validate', () => {
    it('should reject invalid conflict strategy', async () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        if (name === 'token') return 'test-token'
        if (name === 'conflict-strategy') return 'invalid-strategy'
        return ''
      })

      await expect(configManager.load()).rejects.toThrow('Invalid conflict strategy')
    })

    it('should reject absolute sync folder path', async () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        if (name === 'token') return 'test-token'
        if (name === 'sync-folder') return '/absolute/path'
        return ''
      })

      await expect(configManager.load()).rejects.toThrow('Sync folder path should be relative')
    })
  })

  describe('getters', () => {
    it('should throw error when accessing unloaded configuration', () => {
      expect(() => configManager.token).toThrow('Token not loaded')
      expect(() => configManager.repository).toThrow('Repository not loaded')
      expect(() => configManager.owner).toThrow('Owner not loaded')
      expect(() => configManager.repo).toThrow('Repo not loaded')
      expect(() => configManager.syncFolder).toThrow('Sync folder not loaded')
      expect(() => configManager.wikiRepo).toThrow('Wiki repo not loaded')
      expect(() => configManager.conflictStrategy).toThrow('Conflict strategy not loaded')
    })

    it('should return configuration after loading', async () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        if (name === 'token') return 'test-token'
        return ''
      })

      await configManager.load()

      const config = configManager.getConfig()
      expect(config).toMatchObject({
        token: 'test-token',
        repository: 'test-owner/test-repo',
        owner: 'test-owner',
        repo: 'test-repo',
        syncFolder: 'docs',
        conflictStrategy: 'repo-wins',
      })
    })
  })
})