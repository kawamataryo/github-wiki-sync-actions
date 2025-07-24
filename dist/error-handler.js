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
exports.CircuitBreaker = exports.ErrorHandler = exports.ErrorType = void 0;
const core = __importStar(require("@actions/core"));
var ErrorType;
(function (ErrorType) {
    ErrorType["RATE_LIMIT"] = "RATE_LIMIT";
    ErrorType["AUTH_ERROR"] = "AUTH_ERROR";
    ErrorType["FILE_NOT_FOUND"] = "FILE_NOT_FOUND";
    ErrorType["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorType["CONFLICT"] = "CONFLICT";
    ErrorType["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorType["UNKNOWN"] = "UNKNOWN";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
class ErrorHandler {
    static ERROR_PATTERNS = new Map([
        [/rate limit/i, ErrorType.RATE_LIMIT],
        [/403|forbidden/i, ErrorType.RATE_LIMIT],
        [/401|unauthorized/i, ErrorType.AUTH_ERROR],
        [/enoent|not found/i, ErrorType.FILE_NOT_FOUND],
        [/network|timeout|econnrefused/i, ErrorType.NETWORK_ERROR],
        [/conflict/i, ErrorType.CONFLICT],
    ]);
    static classify(error) {
        const message = ErrorHandler.getErrorMessage(error);
        const type = ErrorHandler.detectErrorType(error, message);
        return {
            type,
            message,
            details: error,
            ...ErrorHandler.getRecoveryStrategy(type),
        };
    }
    static getErrorMessage(error) {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        if (error && typeof error === 'object' && 'message' in error) {
            return String(error.message);
        }
        return String(error);
    }
    static detectErrorType(error, message) {
        // HTTPステータスコードによる分類
        if (error && typeof error === 'object' && 'status' in error) {
            const status = Number(error.status);
            if (status === 403)
                return ErrorType.RATE_LIMIT;
            if (status === 401)
                return ErrorType.AUTH_ERROR;
            if (status === 404)
                return ErrorType.FILE_NOT_FOUND;
        }
        // エラーコードによる分類
        if (error && typeof error === 'object' && 'code' in error) {
            if (error.code === 'ENOENT')
                return ErrorType.FILE_NOT_FOUND;
            if (error.code === 'ECONNREFUSED')
                return ErrorType.NETWORK_ERROR;
        }
        // メッセージパターンによる分類
        for (const [pattern, type] of ErrorHandler.ERROR_PATTERNS) {
            if (pattern.test(message)) {
                return type;
            }
        }
        return ErrorType.UNKNOWN;
    }
    static getRecoveryStrategy(errorType) {
        const strategies = {
            [ErrorType.RATE_LIMIT]: { retryable: true, fatal: false },
            [ErrorType.AUTH_ERROR]: { retryable: false, fatal: true },
            [ErrorType.FILE_NOT_FOUND]: { retryable: false, fatal: false },
            [ErrorType.NETWORK_ERROR]: { retryable: true, fatal: false },
            [ErrorType.CONFLICT]: { retryable: false, fatal: false },
            [ErrorType.VALIDATION_ERROR]: { retryable: false, fatal: true },
            [ErrorType.UNKNOWN]: { retryable: true, fatal: false },
        };
        return strategies[errorType];
    }
    static async retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                const errorContext = ErrorHandler.classify(error);
                if (!errorContext.retryable || attempt === maxRetries) {
                    throw error;
                }
                const delay = Math.min(baseDelay * 2 ** (attempt - 1), 30000);
                core.warning(`Attempt ${attempt} failed: ${errorContext.message}. Retrying in ${delay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }
    static logError(error, context) {
        const errorContext = ErrorHandler.classify(error);
        const prefix = context ? `[${context}] ` : '';
        core.error(`${prefix}${errorContext.message}`);
        if (error instanceof Error && error.stack) {
            core.debug(error.stack);
        }
        // 構造化ログ出力
        core.debug(JSON.stringify({
            type: errorContext.type,
            message: errorContext.message,
            retryable: errorContext.retryable,
            fatal: errorContext.fatal,
            details: errorContext.details,
        }));
    }
}
exports.ErrorHandler = ErrorHandler;
// Circuit Breaker実装
class CircuitBreaker {
    threshold;
    timeout;
    failureCount = 0;
    lastFailureTime = 0;
    state = 'CLOSED';
    constructor(threshold = 5, timeout = 60000) {
        this.threshold = threshold;
        this.timeout = timeout;
    }
    async execute(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
            }
            else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        try {
            const result = await operation();
            if (this.state === 'HALF_OPEN') {
                this.reset();
            }
            return result;
        }
        catch (error) {
            this.recordFailure();
            throw error;
        }
    }
    recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.threshold) {
            this.state = 'OPEN';
            core.warning(`Circuit breaker opened after ${this.failureCount} failures`);
        }
    }
    reset() {
        this.failureCount = 0;
        this.state = 'CLOSED';
        core.info('Circuit breaker reset');
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=error-handler.js.map