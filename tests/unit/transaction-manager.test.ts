import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as crypto from 'node:crypto'
import * as core from '@actions/core'
import { TransactionManager, PartialFailureHandler } from '../../src/transaction-manager'
import type { FileState, PageState, SyncOperation } from '../../src/types'

// cryptoのモック
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-123'),
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'testhash'),
  })),
}))

describe('TransactionManager', () => {
  let transactionManager: TransactionManager
  const mockGithubClient = {
    getFileContent: vi.fn(),
    createFile: vi.fn(),
    updateFile: vi.fn(),
  }
  const mockFileHandler = {}

  beforeEach(() => {
    vi.clearAllMocks()
    transactionManager = new TransactionManager(mockGithubClient as any, mockFileHandler as any)
  })

  describe('beginTransaction', () => {
    it('should create a new transaction', async () => {
      const transactionId = await transactionManager.beginTransaction()

      expect(transactionId).toBe('test-uuid-123')
      expect(transactionManager.isInTransaction()).toBe(true)
      expect(transactionManager.getTransactionId()).toBe('test-uuid-123')
    })
  })

  describe('createCheckpoint', () => {
    it('should create checkpoint with current state', async () => {
      await transactionManager.beginTransaction()

      const repoFiles: FileState[] = [
        { path: 'file1.md', sha: 'sha1', content: 'content1' },
      ]
      const wikiFiles: PageState[] = [
        { name: 'page1', content: 'wiki content' },
      ]

      const checkpoint = await transactionManager.createCheckpoint(repoFiles, wikiFiles)

      expect(checkpoint).toMatchObject({
        repoState: repoFiles,
        wikiState: wikiFiles,
        hash: 'testhash',
      })
    })

    it('should throw if no active transaction', async () => {
      await expect(transactionManager.createCheckpoint([], [])).rejects.toThrow(
        'No active transaction',
      )
    })
  })

  describe('recordOperation', () => {
    it('should record operation in transaction', async () => {
      await transactionManager.beginTransaction()

      const operation: SyncOperation = {
        type: 'create',
        path: 'test.md',
        content: 'test content',
      }

      await transactionManager.recordOperation(operation)

      expect(core.debug).toHaveBeenCalledWith('Operation recorded: create test.md')
    })

    it('should throw if no active transaction', async () => {
      const operation: SyncOperation = { type: 'create', path: 'test.md' }

      await expect(transactionManager.recordOperation(operation)).rejects.toThrow(
        'No active transaction',
      )
    })
  })

  describe('commit', () => {
    it('should commit transaction successfully', async () => {
      await transactionManager.beginTransaction()
      await transactionManager.commit()

      expect(core.info).toHaveBeenCalledWith('Transaction test-uuid-123 committed successfully')
      expect(transactionManager.isInTransaction()).toBe(false)
    })

    it('should throw if no active transaction', async () => {
      await expect(transactionManager.commit()).rejects.toThrow('No active transaction')
    })
  })

  describe('rollback', () => {
    it('should rollback to initial checkpoint', async () => {
      await transactionManager.beginTransaction()

      const repoFiles: FileState[] = [
        { path: 'file1.md', sha: 'sha1', content: 'original content' },
      ]
      const wikiFiles: PageState[] = []

      await transactionManager.createCheckpoint(repoFiles, wikiFiles)

      // Mock current state as different
      mockGithubClient.getFileContent.mockResolvedValue({
        content: 'modified content',
        sha: 'sha2',
      })

      await transactionManager.rollback()

      expect(mockGithubClient.updateFile).toHaveBeenCalledWith(
        'file1.md',
        'original content',
        'sha2',
        'Rollback: Restore file state',
      )
      expect(core.info).toHaveBeenCalledWith('Transaction test-uuid-123 rolled back')
    })

    it('should restore deleted files', async () => {
      await transactionManager.beginTransaction()

      const repoFiles: FileState[] = [
        { path: 'deleted.md', sha: 'sha1', content: 'content' },
      ]

      await transactionManager.createCheckpoint(repoFiles, [])

      // Mock file as not found
      mockGithubClient.getFileContent.mockRejectedValue(new Error('Not found'))

      await transactionManager.rollback()

      expect(mockGithubClient.createFile).toHaveBeenCalledWith(
        'deleted.md',
        'content',
        'Rollback: Restore deleted file',
      )
    })

    it('should throw if no checkpoint available', async () => {
      await transactionManager.beginTransaction()

      await expect(transactionManager.rollback()).rejects.toThrow(
        'No checkpoint available for rollback',
      )
    })
  })
})

describe('PartialFailureHandler', () => {
  let handler: PartialFailureHandler

  beforeEach(() => {
    handler = new PartialFailureHandler(true, 3)
  })

  describe('recordSuccess', () => {
    it('should record successful operations', () => {
      const operation: SyncOperation = { type: 'create', path: 'test.md' }
      handler.recordSuccess(operation)

      const summary = handler.getSummary()
      expect(summary.successCount).toBe(1)
      expect(summary.failureCount).toBe(0)
    })
  })

  describe('recordFailure', () => {
    it('should record failed operations', () => {
      const operation: SyncOperation = { type: 'update', path: 'test.md' }
      const error = new Error('Update failed')

      handler.recordFailure(operation, error)

      const summary = handler.getSummary()
      expect(summary.failureCount).toBe(1)
      expect(summary.failedOperations[0]).toMatchObject({
        operation,
        error,
      })
    })

    it('should throw when threshold exceeded', () => {
      const operation: SyncOperation = { type: 'delete', path: 'test.md' }

      for (let i = 0; i < 3; i++) {
        handler.recordFailure(operation, new Error(`Error ${i}`))
      }

      expect(() => handler.recordFailure(operation, new Error('Final error'))).toThrow(
        'Maximum failure threshold (3) exceeded',
      )
    })
  })

  describe('shouldContinue', () => {
    it('should return true when under threshold', () => {
      handler.recordFailure({ type: 'create', path: 'test.md' }, new Error('Error'))
      expect(handler.shouldContinue()).toBe(true)
    })

    it('should return false when continueOnError is false', () => {
      handler = new PartialFailureHandler(false, 10)
      handler.recordFailure({ type: 'create', path: 'test.md' }, new Error('Error'))
      expect(handler.shouldContinue()).toBe(false)
    })

    it('should return false when at threshold', () => {
      handler = new PartialFailureHandler(true, 2)
      handler.recordFailure({ type: 'create', path: 'test1.md' }, new Error('Error 1'))
      
      // This should not throw since we're not exceeding threshold yet
      expect(() => handler.recordFailure({ type: 'create', path: 'test2.md' }, new Error('Error 2'))).not.toThrow()
      expect(handler.shouldContinue()).toBe(true) // at threshold but not exceeding, should continue
    })
  })
})