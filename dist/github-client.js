"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubClient = void 0;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const github = __importStar(require("@actions/github"));
const simple_git_1 = __importDefault(require("simple-git"));
class GitHubClient {
    config;
    octokit;
    git;
    constructor(config) {
        this.config = config;
        this.octokit = github.getOctokit(config.token);
        this.git = (0, simple_git_1.default)();
    }
    // リポジトリ操作
    async getRepositoryFiles(syncPath) {
        try {
            const response = await this.octokit.rest.repos.getContent({
                owner: this.config.owner,
                repo: this.config.repo,
                path: syncPath,
            });
            const data = response.data;
            if (Array.isArray(data)) {
                // ディレクトリの場合
                const files = [];
                for (const item of data) {
                    if (item.type === 'file' && item.name.endsWith('.md')) {
                        files.push({
                            path: item.path,
                            name: item.name,
                            sha: item.sha,
                            size: item.size,
                        });
                    }
                    else if (item.type === 'dir') {
                        // サブディレクトリを再帰的に処理
                        const subFiles = await this.getRepositoryFiles(item.path);
                        files.push(...subFiles);
                    }
                }
                return files;
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
                ];
            }
            return [];
        }
        catch (error) {
            if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
                // フォルダが存在しない場合
                return [];
            }
            throw error;
        }
    }
    async getFileContent(filePath) {
        const response = await this.octokit.rest.repos.getContent({
            owner: this.config.owner,
            repo: this.config.repo,
            path: filePath,
        });
        const data = response.data;
        if (!('type' in data) || data.type !== 'file') {
            throw new Error(`${filePath} is not a file`);
        }
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return {
            content,
            sha: data.sha,
        };
    }
    async createFile(filePath, content, message) {
        await this.octokit.rest.repos.createOrUpdateFileContents({
            owner: this.config.owner,
            repo: this.config.repo,
            path: filePath,
            message: message || `Create ${filePath}`,
            content: Buffer.from(content).toString('base64'),
        });
    }
    async updateFile(filePath, content, sha, message) {
        await this.octokit.rest.repos.createOrUpdateFileContents({
            owner: this.config.owner,
            repo: this.config.repo,
            path: filePath,
            message: message || `Update ${filePath}`,
            content: Buffer.from(content).toString('base64'),
            sha,
        });
    }
    async deleteFile(filePath, sha, message) {
        await this.octokit.rest.repos.deleteFile({
            owner: this.config.owner,
            repo: this.config.repo,
            path: filePath,
            message: message || `Delete ${filePath}`,
            sha,
        });
    }
    // Wiki操作
    async cloneWiki(localPath) {
        await this.git.clone(this.config.wikiRepo, localPath);
        return localPath;
    }
    async getWikiPages(wikiPath) {
        const pages = [];
        const files = await this.getAllMarkdownFiles(wikiPath);
        for (const file of files) {
            const content = await fs.readFile(file, 'utf-8');
            const stats = await fs.stat(file);
            const relativePath = path.relative(wikiPath, file);
            const pageName = this.filePathToWikiName(relativePath);
            pages.push({
                name: pageName,
                path: relativePath,
                content,
                lastModified: stats.mtime,
            });
        }
        return pages;
    }
    async commitWikiChanges(wikiPath, message) {
        const git = (0, simple_git_1.default)(wikiPath);
        await git.add('.');
        await git.commit(message);
    }
    async pushWikiChanges(wikiPath) {
        const git = (0, simple_git_1.default)(wikiPath);
        await git.push();
    }
    // ヘルパーメソッド
    async getAllMarkdownFiles(dir) {
        const files = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                const subFiles = await this.getAllMarkdownFiles(fullPath);
                files.push(...subFiles);
            }
            else if (entry.isFile() && entry.name.endsWith('.md')) {
                files.push(fullPath);
            }
        }
        return files;
    }
    filePathToWikiName(filePath) {
        // ファイルパスをWikiページ名に変換
        // 例: docs/guide/getting-started.md -> guide-getting-started
        let name = filePath.replace(/\.md$/, '');
        name = name.replace(/\//g, '-');
        return name;
    }
}
exports.GitHubClient = GitHubClient;
//# sourceMappingURL=github-client.js.map