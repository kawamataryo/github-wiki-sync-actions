import * as fs from 'node:fs/promises';
import * as path from 'node:path';
export class FileHandler {
    constructor(config) {
        // ConfigはFileHandlerでは使用しないが、将来の拡張性のため引数として受け取る
        void config;
    }
    async readMarkdownFiles(directory) {
        const files = [];
        try {
            const entries = await fs.readdir(directory, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);
                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    // サブディレクトリを再帰的に処理
                    const subFiles = await this.readMarkdownFiles(fullPath);
                    files.push(...subFiles);
                }
                else if (entry.isFile() && entry.name.endsWith('.md')) {
                    // Markdownファイルを読み込む
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const stats = await fs.stat(fullPath);
                    files.push({
                        path: fullPath,
                        relativePath: path.relative(directory, fullPath),
                        name: entry.name,
                        content,
                        lastModified: stats.mtime,
                    });
                }
            }
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                // ディレクトリが存在しない場合
                return [];
            }
            throw error;
        }
        return files;
    }
    async writeMarkdownFile(filePath, content) {
        // ディレクトリが存在しない場合は作成
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        // ファイルを書き込む
        await fs.writeFile(filePath, content, 'utf-8');
    }
    async deleteMarkdownFile(filePath) {
        try {
            await fs.unlink(filePath);
            // 空のディレクトリを削除
            const dir = path.dirname(filePath);
            await this.removeEmptyDirectories(dir);
        }
        catch (error) {
            if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
                throw error;
            }
        }
    }
    async removeEmptyDirectories(directory) {
        try {
            const entries = await fs.readdir(directory);
            if (entries.length === 0) {
                await fs.rmdir(directory);
                const parent = path.dirname(directory);
                if (parent !== directory) {
                    await this.removeEmptyDirectories(parent);
                }
            }
        }
        catch {
            // エラーは無視（ディレクトリが空でない、または削除できない場合）
        }
    }
    sanitizeFileName(name) {
        // ファイル名から無効な文字を削除
        let sanitized = name;
        // Windowsで無効な文字を置換
        sanitized = sanitized.replace(/[<>:"|?*]/g, '_');
        // 制御文字を削除
        // biome-ignore lint/suspicious/noControlCharactersInRegex: Control characters need to be removed for file sanitization
        sanitized = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');
        // 先頭と末尾の空白を削除
        sanitized = sanitized.trim();
        // 空白を単一のスペースに正規化
        sanitized = sanitized.replace(/\s+/g, ' ');
        return sanitized;
    }
    convertPathToWikiName(filePath) {
        // ファイルパスをWikiページ名に変換
        let wikiName = filePath;
        // .md拡張子を削除
        wikiName = wikiName.replace(/\.md$/i, '');
        // パス区切り文字をハイフンに変換
        wikiName = wikiName.replace(/[/\\]/g, '-');
        // 複数のハイフンを単一のハイフンに正規化
        wikiName = wikiName.replace(/-+/g, '-');
        // 先頭と末尾のハイフンを削除
        wikiName = wikiName.replace(/^-+|-+$/g, '');
        return wikiName;
    }
    convertWikiNameToPath(wikiName, baseDir = '') {
        // Wikiページ名をファイルパスに変換
        let filePath = wikiName;
        // ハイフンをパス区切り文字に戻す（最初のハイフンのみ）
        const parts = filePath.split('-');
        if (parts.length > 1) {
            // 最後の部分をファイル名として扱い、それ以外をディレクトリとして扱う
            const fileName = parts[parts.length - 1];
            const dirs = parts.slice(0, -1);
            filePath = dirs.length > 0 ? path.join(...dirs, fileName) : fileName;
        }
        // .md拡張子を追加
        if (!filePath.endsWith('.md')) {
            filePath += '.md';
        }
        // ベースディレクトリと結合
        if (baseDir) {
            filePath = path.join(baseDir, filePath);
        }
        return filePath;
    }
    async ensureDirectoryExists(dirPath) {
        await fs.mkdir(dirPath, { recursive: true });
    }
}
//# sourceMappingURL=file-handler.js.map