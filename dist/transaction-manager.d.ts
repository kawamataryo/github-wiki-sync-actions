import type { FileHandler } from './file-handler';
import type { GitHubClient } from './github-client';
import type { Checkpoint, FileState, PageState, SyncOperation } from './types';
export declare class TransactionManager {
    private github;
    private transaction;
    private checkpoints;
    constructor(github: GitHubClient, fileHandler: FileHandler);
    beginTransaction(): Promise<string>;
    createCheckpoint(repoFiles: FileState[], wikiFiles: PageState[]): Promise<Checkpoint>;
    recordOperation(operation: SyncOperation): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    private restoreRepositoryState;
    private restoreWikiState;
    private calculateHash;
    isInTransaction(): boolean;
    getTransactionId(): string | null;
}
export declare class PartialFailureHandler {
    private continueOnError;
    private maxFailureThreshold;
    private successfulOperations;
    private failedOperations;
    constructor(continueOnError?: boolean, maxFailureThreshold?: number);
    recordSuccess(operation: SyncOperation): void;
    recordFailure(operation: SyncOperation, error: unknown): void;
    shouldContinue(): boolean;
    getSummary(): {
        successCount: number;
        failureCount: number;
        failedOperations: Array<{
            operation: SyncOperation;
            error: unknown;
        }>;
    };
}
//# sourceMappingURL=transaction-manager.d.ts.map