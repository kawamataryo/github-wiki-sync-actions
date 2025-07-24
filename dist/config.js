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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
class ConfigManager {
    config = {};
    async load() {
        try {
            // GitHub Actions の入力パラメータを読み込む
            this.config.token = core.getInput('token', { required: true });
            this.config.syncFolder = core.getInput('sync-folder') || 'docs';
            this.config.conflictStrategy = (core.getInput('conflict-strategy') ||
                'repo-wins');
            // GitHub コンテキストから情報を取得
            const context = github.context;
            this.config.repository = `${context.repo.owner}/${context.repo.repo}`;
            this.config.owner = context.repo.owner;
            this.config.repo = context.repo.repo;
            // Wiki リポジトリの URL を構築
            this.config.wikiRepo = `https://${this.config.token}@github.com/${this.config.repository}.wiki.git`;
            // 削除同期の設定
            const syncDeletes = core.getInput('sync-deletes');
            this.config.syncDeletes = syncDeletes === '' ? true : syncDeletes === 'true';
            // 設定の検証
            await this.validate();
        }
        catch (error) {
            throw new Error(`Configuration loading failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async validate() {
        // 必須パラメータの検証
        if (!this.config.token) {
            throw new Error('GitHub token is required');
        }
        if (!this.config.repository) {
            throw new Error('Repository information is missing');
        }
        // 競合戦略の検証
        const validStrategies = [
            'repo-wins',
            'wiki-wins',
            'manual',
            'skip',
        ];
        if (!this.config.conflictStrategy || !validStrategies.includes(this.config.conflictStrategy)) {
            throw new Error(`Invalid conflict strategy: ${this.config.conflictStrategy}. Valid options: ${validStrategies.join(', ')}`);
        }
        // 同期フォルダパスの検証
        if (this.config.syncFolder?.startsWith('/')) {
            throw new Error('Sync folder path should be relative, not absolute');
        }
        core.info('Configuration validated successfully');
    }
    get token() {
        if (!this.config.token)
            throw new Error('Token not loaded');
        return this.config.token;
    }
    get repository() {
        if (!this.config.repository)
            throw new Error('Repository not loaded');
        return this.config.repository;
    }
    get owner() {
        if (!this.config.owner)
            throw new Error('Owner not loaded');
        return this.config.owner;
    }
    get repo() {
        if (!this.config.repo)
            throw new Error('Repo not loaded');
        return this.config.repo;
    }
    get syncFolder() {
        if (!this.config.syncFolder)
            throw new Error('Sync folder not loaded');
        return this.config.syncFolder;
    }
    get wikiRepo() {
        if (!this.config.wikiRepo)
            throw new Error('Wiki repo not loaded');
        return this.config.wikiRepo;
    }
    get conflictStrategy() {
        if (!this.config.conflictStrategy)
            throw new Error('Conflict strategy not loaded');
        return this.config.conflictStrategy;
    }
    get syncDeletes() {
        return this.config.syncDeletes ?? true;
    }
    getConfig() {
        if (!this.config.token ||
            !this.config.repository ||
            !this.config.owner ||
            !this.config.repo ||
            !this.config.syncFolder ||
            !this.config.wikiRepo ||
            !this.config.conflictStrategy) {
            throw new Error('Configuration not fully loaded');
        }
        return this.config;
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=config.js.map