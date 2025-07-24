import type { FileHandler } from './file-handler';
import type { GitHubClient } from './github-client';
import type { ActionConfig, Change, SyncResult } from './types';
export declare class SyncEngine {
    private github;
    private fileHandler;
    private config;
    private wikiPath;
    private transactionManager;
    private circuitBreaker;
    constructor(githubClient: GitHubClient, fileHandler: FileHandler, config: ActionConfig);
    sync(): Promise<SyncResult>;
    detectChanges(): Promise<Change[]>;
    private getRepoFiles;
    private getWikiFiles;
    private applyChange;
    private resolveConflict;
    private cleanup;
    private getCurrentRepoState;
    private getCurrentWikiState;
}
//# sourceMappingURL=sync-engine.d.ts.map