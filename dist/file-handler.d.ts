import type { ActionConfig, MarkdownFile } from './types';
export declare class FileHandler {
    constructor(config: ActionConfig);
    readMarkdownFiles(directory: string): Promise<MarkdownFile[]>;
    writeMarkdownFile(filePath: string, content: string): Promise<void>;
    deleteMarkdownFile(filePath: string): Promise<void>;
    private removeEmptyDirectories;
    sanitizeFileName(name: string): string;
    convertPathToWikiName(filePath: string): string;
    convertWikiNameToPath(wikiName: string, baseDir?: string): string;
    ensureDirectoryExists(dirPath: string): Promise<void>;
}
//# sourceMappingURL=file-handler.d.ts.map