import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as github from '@actions/github'
import simpleGit, { type SimpleGit } from 'simple-git'
import type { ActionConfig, FileInfo, WikiPage } from './types'

export class GitHubClient {
  private config: ActionConfig
  private octokit: ReturnType<typeof github.getOctokit>
  private git: SimpleGit

  constructor(config: ActionConfig) {
    this.config = config
    this.octokit = github.getOctokit(config.token)
    this.git = simpleGit()
  }

  // リポジトリ操作
  async getRepositoryFiles(syncPath: string): Promise<FileInfo[]> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: syncPath,
      })

      const data = response.data

      if (Array.isArray(data)) {
        // ディレクトリの場合
        const files: FileInfo[] = []
        for (const item of data) {
          if (item.type === 'file' && item.name.endsWith('.md')) {
            files.push({
              path: item.path,
              name: item.name,
              sha: item.sha,
              size: item.size,
            })
          } else if (item.type === 'dir') {
            // サブディレクトリを再帰的に処理
            const subFiles = await this.getRepositoryFiles(item.path)
            files.push(...subFiles)
          }
        }
        return files
      }
      if ('type' in data && data.type === 'file') {
        // 単一ファイルの場合
        return [
          {
            path: data.path,
            name: data.name,
            sha: data.sha,
            size: data.size,
          },
        ]
      }

      return []
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        // フォルダが存在しない場合
        return []
      }
      throw error
    }
  }

  async getFileContent(filePath: string): Promise<{ content: string; sha: string }> {
    const response = await this.octokit.rest.repos.getContent({
      owner: this.config.owner,
      repo: this.config.repo,
      path: filePath,
    })

    const data = response.data

    if (!('type' in data) || data.type !== 'file') {
      throw new Error(`${filePath} is not a file`)
    }

    const content = Buffer.from(data.content, 'base64').toString('utf-8')
    return {
      content,
      sha: data.sha,
    }
  }

  async createFile(filePath: string, content: string, message?: string): Promise<void> {
    await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.config.owner,
      repo: this.config.repo,
      path: filePath,
      message: message || `Create ${filePath}`,
      content: Buffer.from(content).toString('base64'),
    })
  }

  async updateFile(
    filePath: string,
    content: string,
    sha: string,
    message?: string,
  ): Promise<void> {
    await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.config.owner,
      repo: this.config.repo,
      path: filePath,
      message: message || `Update ${filePath}`,
      content: Buffer.from(content).toString('base64'),
      sha,
    })
  }

  async deleteFile(filePath: string, sha: string, message?: string): Promise<void> {
    await this.octokit.rest.repos.deleteFile({
      owner: this.config.owner,
      repo: this.config.repo,
      path: filePath,
      message: message || `Delete ${filePath}`,
      sha,
    })
  }

  // Wiki操作
  async cloneWiki(localPath: string): Promise<string> {
    await this.git.clone(this.config.wikiRepo, localPath)
    
    // クローン後のリポジトリでGit設定を行う
    const clonedGit = simpleGit(localPath)
    await clonedGit.addConfig('user.name', 'github-actions[bot]')
    await clonedGit.addConfig('user.email', '41898282+github-actions[bot]@users.noreply.github.com')
    
    return localPath
  }

  async getWikiPages(wikiPath: string): Promise<WikiPage[]> {
    const pages: WikiPage[] = []
    const files = await this.getAllMarkdownFiles(wikiPath)

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8')
      const stats = await fs.stat(file)
      const relativePath = path.relative(wikiPath, file)
      const pageName = this.filePathToWikiName(relativePath)

      pages.push({
        name: pageName,
        path: relativePath,
        content,
        lastModified: stats.mtime,
      })
    }

    return pages
  }

  async commitWikiChanges(wikiPath: string, message: string): Promise<void> {
    const git = simpleGit(wikiPath)
    
    // Git作者情報を設定（GitHub Actionsで必要）
    await git.addConfig('user.name', 'github-actions[bot]')
    await git.addConfig('user.email', '41898282+github-actions[bot]@users.noreply.github.com')
    
    await git.add('.')
    await git.commit(message)
  }

  async pushWikiChanges(wikiPath: string): Promise<void> {
    const git = simpleGit(wikiPath)
    await git.push()
  }

  // ヘルパーメソッド
  private async getAllMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = []
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const subFiles = await this.getAllMarkdownFiles(fullPath)
        files.push(...subFiles)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath)
      }
    }

    return files
  }

  private filePathToWikiName(filePath: string): string {
    // ファイルパスをWikiページ名に変換
    // 例: docs/guide/getting-started.md -> guide-getting-started
    let name = filePath.replace(/\.md$/, '')
    name = name.replace(/\//g, '-')
    return name
  }
}
