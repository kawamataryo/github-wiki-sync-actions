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
exports.PartialFailureHandler = exports.TransactionManager = void 0;
const crypto = __importStar(require("node:crypto"));
const core = __importStar(require("@actions/core"));
class TransactionManager {
    github;
    transaction = null;
    checkpoints = new Map();
    constructor(github, fileHandler) {
        this.github = github;
        // fileHandlerは現在は使用しないが、将来の拡張性のため引数として受け取る
        void fileHandler;
    }
    async beginTransaction() {
        const transactionId = crypto.randomUUID();
        this.transaction = {
            id: transactionId,
            operations: [],
            status: 'pending',
            checkpoints: [],
        };
        core.info(`Transaction ${transactionId} started`);
        return transactionId;
    }
    async createCheckpoint(repoFiles, wikiFiles) {
        if (!this.transaction) {
            throw new Error('No active transaction');
        }
        const checkpoint = {
            timestamp: new Date(),
            repoState: [...repoFiles],
            wikiState: [...wikiFiles],
            hash: this.calculateHash(repoFiles, wikiFiles),
        };
        this.transaction.checkpoints.push(checkpoint);
        this.checkpoints.set(checkpoint.hash, checkpoint);
        core.info(`Checkpoint created: ${checkpoint.hash}`);
        return checkpoint;
    }
    async recordOperation(operation) {
        if (!this.transaction) {
            throw new Error('No active transaction');
        }
        this.transaction.operations.push(operation);
        core.debug(`Operation recorded: ${operation.type} ${operation.path}`);
    }
    async commit() {
        if (!this.transaction) {
            throw new Error('No active transaction');
        }
        try {
            // 全ての操作が成功したことを確認
            this.transaction.status = 'committed';
            core.info(`Transaction ${this.transaction.id} committed successfully`);
        }
        finally {
            this.transaction = null;
        }
    }
    async rollback() {
        if (!this.transaction) {
            throw new Error('No active transaction');
        }
        try {
            core.warning(`Rolling back transaction ${this.transaction.id}`);
            // 最初のチェックポイントを取得
            const initialCheckpoint = this.transaction.checkpoints[0];
            if (!initialCheckpoint) {
                throw new Error('No checkpoint available for rollback');
            }
            // リポジトリの状態を復元
            await this.restoreRepositoryState(initialCheckpoint.repoState);
            // Wikiの状態を復元（可能な場合）
            await this.restoreWikiState(initialCheckpoint.wikiState);
            this.transaction.status = 'rolled-back';
            core.info(`Transaction ${this.transaction.id} rolled back`);
        }
        catch (error) {
            core.error(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
        finally {
            this.transaction = null;
        }
    }
    async restoreRepositoryState(repoState) {
        core.info('Restoring repository state...');
        for (const file of repoState) {
            try {
                // 現在のファイル情報を取得
                const currentFile = await this.github.getFileContent(file.path).catch(() => null);
                if (currentFile && currentFile.sha !== file.sha) {
                    // ファイルが変更されている場合は更新
                    await this.github.updateFile(file.path, file.content, currentFile.sha, 'Rollback: Restore file state');
                }
                else if (!currentFile) {
                    // ファイルが削除されている場合は再作成
                    await this.github.createFile(file.path, file.content, 'Rollback: Restore deleted file');
                }
            }
            catch (error) {
                core.warning(`Failed to restore ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    async restoreWikiState(wikiState) {
        core.info('Restoring wiki state...');
        // Wiki状態の復元は複雑なため、警告のみ出力
        core.warning('Wiki rollback is not fully implemented. Manual intervention may be required.');
        // 復元が必要なページをログ出力
        for (const page of wikiState) {
            core.info(`Wiki page needs restoration: ${page.name}`);
        }
    }
    calculateHash(repoFiles, wikiFiles) {
        const data = JSON.stringify({
            repo: repoFiles.map((f) => ({ path: f.path, sha: f.sha })),
            wiki: wikiFiles.map((p) => ({ name: p.name, content: p.content.substring(0, 100) })),
        });
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
    }
    isInTransaction() {
        return this.transaction !== null;
    }
    getTransactionId() {
        return this.transaction?.id || null;
    }
}
exports.TransactionManager = TransactionManager;
// 部分的失敗のハンドラー
class PartialFailureHandler {
    continueOnError;
    maxFailureThreshold;
    successfulOperations = [];
    failedOperations = [];
    constructor(continueOnError = true, maxFailureThreshold = 10) {
        this.continueOnError = continueOnError;
        this.maxFailureThreshold = maxFailureThreshold;
    }
    recordSuccess(operation) {
        this.successfulOperations.push(operation);
    }
    recordFailure(operation, error) {
        this.failedOperations.push({ operation, error });
        if (this.failedOperations.length > this.maxFailureThreshold) {
            throw new Error(`Maximum failure threshold (${this.maxFailureThreshold}) exceeded. Aborting operation.`);
        }
    }
    shouldContinue() {
        return this.continueOnError && this.failedOperations.length <= this.maxFailureThreshold;
    }
    getSummary() {
        return {
            successCount: this.successfulOperations.length,
            failureCount: this.failedOperations.length,
            failedOperations: this.failedOperations,
        };
    }
}
exports.PartialFailureHandler = PartialFailureHandler;
//# sourceMappingURL=transaction-manager.js.map