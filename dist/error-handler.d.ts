export declare enum ErrorType {
    RATE_LIMIT = "RATE_LIMIT",
    AUTH_ERROR = "AUTH_ERROR",
    FILE_NOT_FOUND = "FILE_NOT_FOUND",
    NETWORK_ERROR = "NETWORK_ERROR",
    CONFLICT = "CONFLICT",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    UNKNOWN = "UNKNOWN"
}
export interface ErrorContext {
    type: ErrorType;
    message: string;
    details?: unknown;
    retryable: boolean;
    fatal: boolean;
}
export declare class ErrorHandler {
    private static readonly ERROR_PATTERNS;
    static classify(error: unknown): ErrorContext;
    private static getErrorMessage;
    private static detectErrorType;
    private static getRecoveryStrategy;
    static retryWithBackoff<T>(operation: () => Promise<T>, maxRetries?: number, baseDelay?: number): Promise<T>;
    static logError(error: unknown, context?: string): void;
}
export declare class CircuitBreaker {
    private readonly threshold;
    private readonly timeout;
    private failureCount;
    private lastFailureTime;
    private state;
    constructor(threshold?: number, timeout?: number);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    private recordFailure;
    private reset;
}
//# sourceMappingURL=error-handler.d.ts.map