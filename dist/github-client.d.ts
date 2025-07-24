import type { ActionConfig, FileInfo, WikiPage } from './types';
export declare class GitHubClient {
    private config;
    private octokit;
    private git;
    constructor(config: ActionConfig);
    getRepositoryFiles(syncPath: string): Promise<FileInfo[]>;
    getFileContent(filePath: string): Promise<{
        content: string;
        sha: string;
    }>;
    createFile(filePath: string, content: string, message?: string): Promise<void>;
    updateFile(filePath: string, content: string, sha: string, message?: string): Promise<void>;
    deleteFile(filePath: string, sha: string, message?: string): Promise<void>;
    cloneWiki(localPath: string): Promise<string>;
    getWikiPages(wikiPath: string): Promise<WikiPage[]>;
    commitWikiChanges(wikiPath: string, message: string): Promise<void>;
    pushWikiChanges(wikiPath: string): Promise<void>;
    private getAllMarkdownFiles;
    private filePathToWikiName;
}
//# sourceMappingURL=github-client.d.ts.map