import type { ActionConfig } from './types';
export declare class ConfigManager {
    private config;
    load(): Promise<void>;
    private validate;
    get token(): string;
    get repository(): string;
    get owner(): string;
    get repo(): string;
    get syncFolder(): string;
    get wikiRepo(): string;
    get conflictStrategy(): ActionConfig['conflictStrategy'];
    get syncDeletes(): boolean;
    getConfig(): ActionConfig;
}
//# sourceMappingURL=config.d.ts.map