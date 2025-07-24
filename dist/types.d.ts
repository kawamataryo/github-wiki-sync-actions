export interface ActionConfig {
    token: string;
    repository: string;
    owner: string;
    repo: string;
    syncFolder: string;
    wikiRepo: string;
    conflictStrategy: 'repo-wins' | 'wiki-wins' | 'manual' | 'skip';
    syncDeletes?: boolean;
}
export interface FileInfo {
    path: string;
    name: string;
    sha: string;
    size: number;
}
export interface MarkdownFile {
    path: string;
    relativePath?: string;
    name: string;
    content: string;
    sha?: string;
    lastModified: Date;
}
export interface WikiPage {
    name: string;
    path: string;
    content: string;
    lastModified?: Date;
}
export type ChangeType = 'create' | 'update' | 'delete';
export type ChangeSource = 'repo' | 'wiki';
export type ChangeDirection = 'repo-to-wiki' | 'wiki-to-repo';
export interface Change {
    type: ChangeType;
    source: ChangeSource;
    direction?: ChangeDirection;
    filePath: string;
    wikiName: string;
    content?: string;
    oldContent?: string;
    repoModified?: Date;
    wikiModified?: Date;
}
export interface SyncResult {
    success: boolean;
    changesApplied: number;
    errors: Array<{
        change?: Change;
        phase?: string;
        error: string;
    }>;
    conflicts: Conflict[];
    summary: string;
}
export interface Conflict {
    filePath: string;
    wikiName: string;
    repoContent: string;
    wikiContent: string;
    resolution?: string;
}
export interface ConflictResolution {
    strategy: 'repo-wins' | 'wiki-wins' | 'merge' | 'manual' | 'skip';
    reason: string;
    originalContent: string;
    conflictingContent: string;
    resolvedContent?: string;
    timestamp: Date;
}
export interface SyncTransaction {
    id: string;
    operations: SyncOperation[];
    status: 'pending' | 'committed' | 'rolled-back';
    checkpoints: Checkpoint[];
}
export interface SyncOperation {
    type: ChangeType;
    path: string;
    content?: string;
    previousContent?: string;
}
export interface Checkpoint {
    timestamp: Date;
    repoState: FileState[];
    wikiState: PageState[];
    hash: string;
}
export interface FileState {
    path: string;
    sha: string;
    content: string;
}
export interface PageState {
    name: string;
    content: string;
}
//# sourceMappingURL=types.d.ts.map