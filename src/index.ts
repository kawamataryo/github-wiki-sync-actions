import * as core from '@actions/core'
import { ConfigManager } from './config'
import { FileHandler } from './file-handler'
import { GitHubClient } from './github-client'
import { SyncEngine } from './sync-engine'

export async function run(): Promise<void> {
  try {
    // 設定の読み込みと検証
    const config = new ConfigManager()
    await config.load()

    core.info('GitHub Wiki Sync Action started')
    core.info(`Repository: ${config.repository}`)
    core.info(`Sync folder: ${config.syncFolder}`)

    // 各コンポーネントの初期化
    const githubClient = new GitHubClient(config)
    const fileHandler = new FileHandler(config)
    const syncEngine = new SyncEngine(githubClient, fileHandler, config)

    // 同期処理の実行
    core.info('Starting synchronization...')
    const result = await syncEngine.sync()

    // 結果の出力
    core.info(`Synchronization completed. Changes applied: ${result.changesApplied}`)

    if (result.errors.length > 0) {
      core.warning(`Errors encountered: ${result.errors.length}`)
      for (const error of result.errors) {
        core.error(error.error)
      }
    }

    // GitHub Actions の出力設定
    core.setOutput('changes-count', result.changesApplied)
    core.setOutput('sync-status', result.success ? 'success' : 'failed')

    if (!result.success) {
      core.setFailed('Synchronization failed with errors')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    core.setFailed(`Action failed: ${message}`)
    if (error instanceof Error && error.stack) {
      core.error(error.stack)
    }
  }
}

// アクションの実行（モジュールが直接実行された場合のみ）
if (require.main === module) {
  run()
}
