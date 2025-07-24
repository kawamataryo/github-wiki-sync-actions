import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as core from '@actions/core'
import { CircuitBreaker, ErrorHandler } from './error-handler'
import type { FileHandler } from './file-handler'
import type { GitHubClient } from './github-client'
import { PartialFailureHandler, TransactionManager } from './transaction-manager'
import type {
  ActionConfig,
  Change,
  FileState,
  MarkdownFile,
  PageState,
  SyncResult,
  WikiPage,
} from './types'

export class SyncEngine {
  private github: GitHubClient
  private fileHandler: FileHandler
  private config: ActionConfig
  private wikiPath: string | null = null
  private transactionManager: TransactionManager
  private circuitBreaker: CircuitBreaker

  constructor(githubClient: GitHubClient, fileHandler: FileHandler, config: ActionConfig) {
    this.github = githubClient
    this.fileHandler = fileHandler
    this.config = config
    this.transactionManager = new TransactionManager(githubClient, fileHandler)
    this.circuitBreaker = new CircuitBreaker()
  }

  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      changesApplied: 0,
      errors: [],
      conflicts: [],
      summary: '',
    }

    let transactionId: string | null = null

    try {
      // トランザクション開始
      transactionId = await this.transactionManager.beginTransaction()

      // 一時ディレクトリにWikiをクローン
      this.wikiPath = path.join(os.tmpdir(), `wiki-sync-${Date.now()}`)
      await ErrorHandler.retryWithBackoff(async () => {
        if (!this.wikiPath) throw new Error('Wiki path not initialized')
        await this.github.cloneWiki(this.wikiPath)
      })
      core.info(`Wiki cloned to: ${this.wikiPath}`)

      // 現在の状態を記録（チェックポイント作成）
      const currentRepoState = await this.getCurrentRepoState()
      const currentWikiState = await this.getCurrentWikiState()
      await this.transactionManager.createCheckpoint(currentRepoState, currentWikiState)

      // 変更を検出
      const changes = await this.detectChanges()
      core.info(`Detected ${changes.length} changes`)

      // 部分的失敗ハンドラー
      const failureHandler = new PartialFailureHandler()

      // 変更を適用
      for (const change of changes) {
        try {
          await this.circuitBreaker.execute(async () => {
            await this.applyChange(change)
          })

          // 操作を記録
          await this.transactionManager.recordOperation({
            type: change.type,
            path: change.filePath,
            content: change.content,
            previousContent: change.oldContent,
          })

          failureHandler.recordSuccess({
            type: change.type,
            path: change.filePath,
            content: change.content,
          })

          result.changesApplied++
          core.info(`Applied change: ${change.type} ${change.filePath || change.wikiName}`)
        } catch (error) {
          ErrorHandler.logError(error, 'Apply change')

          const errorContext = ErrorHandler.classify(error)
          result.errors.push({
            change,
            error: errorContext.message,
          })

          failureHandler.recordFailure(
            {
              type: change.type,
              path: change.filePath,
              content: change.content,
            },
            error,
          )

          if (errorContext.fatal || !failureHandler.shouldContinue()) {
            throw new Error(`Fatal error or too many failures: ${errorContext.message}`)
          }
        }
      }

      // 部分的失敗のサマリを記録
      const failureSummary = failureHandler.getSummary()
      if (failureSummary.failureCount > 0) {
        core.warning(
          `Partial sync completed: ${failureSummary.successCount} succeeded, ${failureSummary.failureCount} failed`,
        )
      }

      // Wikiの変更をコミット＆プッシュ
      if (result.changesApplied > 0) {
        await ErrorHandler.retryWithBackoff(async () => {
          if (!this.wikiPath) throw new Error('Wiki path not initialized')
          await this.github.commitWikiChanges(
            this.wikiPath,
            `Sync from repository: ${result.changesApplied} changes`,
          )
          await this.github.pushWikiChanges(this.wikiPath)
        })
        core.info('Wiki changes pushed successfully')
      }

      // トランザクションをコミット
      await this.transactionManager.commit()

      result.summary = `Synchronization completed: ${result.changesApplied} changes applied, ${result.errors.length} errors`
    } catch (error) {
      ErrorHandler.logError(error, 'Sync operation')
      result.success = false
      result.errors.push({
        phase: 'sync',
        error: error instanceof Error ? error.message : String(error),
      })

      // トランザクションがアクティブな場合はロールバック
      if (transactionId && this.transactionManager.isInTransaction()) {
        try {
          await this.transactionManager.rollback()
        } catch (rollbackError) {
          core.error(
            `Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
          )
        }
      }

      throw error
    } finally {
      // クリーンアップ
      if (this.wikiPath) {
        await this.cleanup()
      }
    }

    return result
  }

  async detectChanges(): Promise<Change[]> {
    const changes: Change[] = []

    // リポジトリとWikiのファイルを取得
    const repoFiles = await this.getRepoFiles()
    const wikiFiles = await this.getWikiFiles()

    // ファイルマッピングを作成
    const repoFileMap = new Map<string, MarkdownFile>()
    const wikiFileMap = new Map<string, WikiPage>()

    for (const repoFile of repoFiles) {
      const wikiName = this.fileHandler.convertPathToWikiName(
        repoFile.relativePath || repoFile.path,
      )
      repoFileMap.set(wikiName, repoFile)
    }

    for (const wikiFile of wikiFiles) {
      wikiFileMap.set(wikiFile.name, wikiFile)
    }

    // リポジトリ -> Wiki の変更を検出
    for (const [wikiName, repoFile] of repoFileMap) {
      const wikiFile = wikiFileMap.get(wikiName)

      if (!wikiFile) {
        // リポジトリに存在するがWikiに存在しない -> 新規作成
        changes.push({
          type: 'create',
          source: 'repo',
          direction: 'repo-to-wiki',
          filePath: repoFile.relativePath || repoFile.path,
          wikiName,
          content: repoFile.content,
        })
      } else if (repoFile.content !== wikiFile.content) {
        // 両方に存在するが内容が異なる -> 更新または競合
        changes.push({
          type: 'update',
          source: 'repo',
          direction: 'repo-to-wiki',
          filePath: repoFile.relativePath || repoFile.path,
          wikiName,
          content: repoFile.content,
          oldContent: wikiFile.content,
          repoModified: repoFile.lastModified,
          wikiModified: wikiFile.lastModified,
        })
      }
    }

    // Wiki -> リポジトリ の変更を検出
    for (const [wikiName, wikiFile] of wikiFileMap) {
      const repoFile = repoFileMap.get(wikiName)
      const repoPath = this.fileHandler.convertWikiNameToPath(wikiName, this.config.syncFolder)

      if (!repoFile) {
        // Wikiに存在するがリポジトリに存在しない
        const fullPath = path.join(process.cwd(), repoPath)

        // ファイルが実際に存在しないか確認（マッピングの問題を回避）
        try {
          await fs.access(fullPath)
        } catch {
          // ファイルが存在しない -> 新規作成
          changes.push({
            type: 'create',
            source: 'wiki',
            direction: 'wiki-to-repo',
            filePath: repoPath,
            wikiName,
            content: wikiFile.content,
          })
        }
      }
    }

    // 削除の検出（オプション: 削除同期を有効にする場合）
    if (this.config.syncDeletes !== false) {
      // リポジトリから削除されたファイルをWikiからも削除
      for (const [wikiName] of wikiFileMap) {
        if (!repoFileMap.has(wikiName)) {
          changes.push({
            type: 'delete',
            source: 'repo',
            direction: 'repo-to-wiki',
            wikiName,
            filePath: this.fileHandler.convertWikiNameToPath(wikiName),
          })
        }
      }
    }

    return changes
  }

  private async getRepoFiles(): Promise<MarkdownFile[]> {
    const repoPath = path.join(process.cwd(), this.config.syncFolder)
    const files = await this.fileHandler.readMarkdownFiles(repoPath)

    return files.map((file) => ({
      ...file,
      relativePath: path.relative(repoPath, file.path),
    }))
  }

  private async getWikiFiles(): Promise<WikiPage[]> {
    if (!this.wikiPath) {
      throw new Error('Wiki path not initialized')
    }
    const wikiPages = await this.github.getWikiPages(this.wikiPath)
    return wikiPages
  }

  private async applyChange(change: Change): Promise<void> {
    switch (change.type) {
      case 'create':
        if (change.direction === 'repo-to-wiki' && this.wikiPath) {
          // リポジトリからWikiへ新規作成
          const wikiFilePath = path.join(this.wikiPath, `${change.wikiName}.md`)
          await this.fileHandler.writeMarkdownFile(wikiFilePath, change.content || '')
        } else if (change.direction === 'wiki-to-repo') {
          // Wikiからリポジトリへ新規作成
          const repoFilePath = path.join(process.cwd(), change.filePath)
          await this.fileHandler.writeMarkdownFile(repoFilePath, change.content || '')
          // GitHubAPIでコミット
          await this.github.createFile(
            change.filePath,
            change.content || '',
            `Create ${change.filePath} from wiki`,
          )
        }
        break

      case 'update':
        if (change.direction === 'repo-to-wiki' && this.wikiPath) {
          // リポジトリからWikiへ更新
          const wikiFilePath = path.join(this.wikiPath, `${change.wikiName}.md`)

          // 競合解決
          const resolvedContent = await this.resolveConflict(change)
          await this.fileHandler.writeMarkdownFile(wikiFilePath, resolvedContent)
        } else if (change.direction === 'wiki-to-repo') {
          // Wikiからリポジトリへ更新
          const fileInfo = await this.github.getFileContent(change.filePath)
          await this.github.updateFile(
            change.filePath,
            change.content || '',
            fileInfo.sha,
            `Update ${change.filePath} from wiki`,
          )
        }
        break

      case 'delete':
        if (change.direction === 'repo-to-wiki' && this.wikiPath) {
          // Wiki側で削除されたファイルを削除
          const wikiFilePath = path.join(this.wikiPath, `${change.wikiName}.md`)
          await this.fileHandler.deleteMarkdownFile(wikiFilePath)
        } else if (change.direction === 'wiki-to-repo') {
          // リポジトリ側でファイルを削除
          const fileInfo = await this.github.getFileContent(change.filePath)
          await this.github.deleteFile(
            change.filePath,
            fileInfo.sha,
            `Delete ${change.filePath} from wiki sync`,
          )
        }
        break

      default:
        throw new Error(`Unknown change type: ${change.type}`)
    }
  }

  private async resolveConflict(change: Change): Promise<string> {
    // 競合解決戦略に基づいて内容を決定
    switch (this.config.conflictStrategy) {
      case 'repo-wins':
        return change.content || ''

      case 'wiki-wins':
        return change.oldContent || ''

      case 'skip':
        throw new Error('Skipping due to conflict')

      case 'manual':
        // マニュアルモードでは競合をログに出力して新しい内容を適用
        core.warning(`Conflict detected in ${change.filePath}`)
        core.warning('Applying repository version (manual resolution required)')
        return change.content || ''

      default:
        return change.content || ''
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.wikiPath) {
        await fs.rm(this.wikiPath, { recursive: true, force: true })
        core.info('Cleanup completed')
      }
    } catch (error) {
      core.warning(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async getCurrentRepoState(): Promise<FileState[]> {
    const repoFiles = await this.getRepoFiles()
    return repoFiles.map((file) => ({
      path: file.relativePath || file.path,
      sha: file.sha || '',
      content: file.content,
    }))
  }

  private async getCurrentWikiState(): Promise<PageState[]> {
    const wikiFiles = await this.getWikiFiles()
    return wikiFiles.map((page) => ({
      name: page.name,
      content: page.content,
    }))
  }
}
