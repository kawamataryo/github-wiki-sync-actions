import * as crypto from 'node:crypto'
import * as core from '@actions/core'
import type { FileHandler } from './file-handler'
import type { GitHubClient } from './github-client'
import type { Checkpoint, FileState, PageState, SyncOperation, SyncTransaction } from './types'

export class TransactionManager {
  private transaction: SyncTransaction | null = null
  private checkpoints: Map<string, Checkpoint> = new Map()

  constructor(
    private github: GitHubClient,
    fileHandler: FileHandler,
  ) {
    // fileHandlerは現在は使用しないが、将来の拡張性のため引数として受け取る
    void fileHandler
  }

  async beginTransaction(): Promise<string> {
    const transactionId = crypto.randomUUID()

    this.transaction = {
      id: transactionId,
      operations: [],
      status: 'pending',
      checkpoints: [],
    }

    core.info(`Transaction ${transactionId} started`)
    return transactionId
  }

  async createCheckpoint(repoFiles: FileState[], wikiFiles: PageState[]): Promise<Checkpoint> {
    if (!this.transaction) {
      throw new Error('No active transaction')
    }

    const checkpoint: Checkpoint = {
      timestamp: new Date(),
      repoState: [...repoFiles],
      wikiState: [...wikiFiles],
      hash: this.calculateHash(repoFiles, wikiFiles),
    }

    this.transaction.checkpoints.push(checkpoint)
    this.checkpoints.set(checkpoint.hash, checkpoint)

    core.info(`Checkpoint created: ${checkpoint.hash}`)
    return checkpoint
  }

  async recordOperation(operation: SyncOperation): Promise<void> {
    if (!this.transaction) {
      throw new Error('No active transaction')
    }

    this.transaction.operations.push(operation)
    core.debug(`Operation recorded: ${operation.type} ${operation.path}`)
  }

  async commit(): Promise<void> {
    if (!this.transaction) {
      throw new Error('No active transaction')
    }

    try {
      // 全ての操作が成功したことを確認
      this.transaction.status = 'committed'
      core.info(`Transaction ${this.transaction.id} committed successfully`)
    } finally {
      this.transaction = null
    }
  }

  async rollback(): Promise<void> {
    if (!this.transaction) {
      throw new Error('No active transaction')
    }

    try {
      core.warning(`Rolling back transaction ${this.transaction.id}`)

      // 最初のチェックポイントを取得
      const initialCheckpoint = this.transaction.checkpoints[0]
      if (!initialCheckpoint) {
        throw new Error('No checkpoint available for rollback')
      }

      // リポジトリの状態を復元
      await this.restoreRepositoryState(initialCheckpoint.repoState)

      // Wikiの状態を復元（可能な場合）
      await this.restoreWikiState(initialCheckpoint.wikiState)

      this.transaction.status = 'rolled-back'
      core.info(`Transaction ${this.transaction.id} rolled back`)
    } catch (error) {
      core.error(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    } finally {
      this.transaction = null
    }
  }

  private async restoreRepositoryState(repoState: FileState[]): Promise<void> {
    core.info('Restoring repository state...')

    for (const file of repoState) {
      try {
        // 現在のファイル情報を取得
        const currentFile = await this.github.getFileContent(file.path).catch(() => null)

        if (currentFile && currentFile.sha !== file.sha) {
          // ファイルが変更されている場合は更新
          await this.github.updateFile(
            file.path,
            file.content,
            currentFile.sha,
            'Rollback: Restore file state',
          )
        } else if (!currentFile) {
          // ファイルが削除されている場合は再作成
          await this.github.createFile(file.path, file.content, 'Rollback: Restore deleted file')
        }
      } catch (error) {
        core.warning(
          `Failed to restore ${file.path}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  private async restoreWikiState(wikiState: PageState[]): Promise<void> {
    core.info('Restoring wiki state...')

    // Wiki状態の復元は複雑なため、警告のみ出力
    core.warning('Wiki rollback is not fully implemented. Manual intervention may be required.')

    // 復元が必要なページをログ出力
    for (const page of wikiState) {
      core.info(`Wiki page needs restoration: ${page.name}`)
    }
  }

  private calculateHash(repoFiles: FileState[], wikiFiles: PageState[]): string {
    const data = JSON.stringify({
      repo: repoFiles.map((f) => ({ path: f.path, sha: f.sha })),
      wiki: wikiFiles.map((p) => ({ name: p.name, content: p.content.substring(0, 100) })),
    })

    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8)
  }

  isInTransaction(): boolean {
    return this.transaction !== null
  }

  getTransactionId(): string | null {
    return this.transaction?.id || null
  }
}

// 部分的失敗のハンドラー
export class PartialFailureHandler {
  private successfulOperations: SyncOperation[] = []
  private failedOperations: Array<{ operation: SyncOperation; error: unknown }> = []

  constructor(
    private continueOnError = true,
    private maxFailureThreshold = 10,
  ) {}

  recordSuccess(operation: SyncOperation): void {
    this.successfulOperations.push(operation)
  }

  recordFailure(operation: SyncOperation, error: unknown): void {
    this.failedOperations.push({ operation, error })

    if (this.failedOperations.length > this.maxFailureThreshold) {
      throw new Error(
        `Maximum failure threshold (${this.maxFailureThreshold}) exceeded. Aborting operation.`,
      )
    }
  }

  shouldContinue(): boolean {
    return this.continueOnError && this.failedOperations.length <= this.maxFailureThreshold
  }

  getSummary(): {
    successCount: number
    failureCount: number
    failedOperations: Array<{ operation: SyncOperation; error: unknown }>
  } {
    return {
      successCount: this.successfulOperations.length,
      failureCount: this.failedOperations.length,
      failedOperations: this.failedOperations,
    }
  }
}
