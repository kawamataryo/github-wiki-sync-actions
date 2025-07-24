import * as core from '@actions/core'

export enum ErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  AUTH_ERROR = 'AUTH_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface ErrorContext {
  type: ErrorType
  message: string
  details?: unknown
  retryable: boolean
  fatal: boolean
}

export class ErrorHandler {
  private static readonly ERROR_PATTERNS = new Map<RegExp, ErrorType>([
    [/rate limit/i, ErrorType.RATE_LIMIT],
    [/403|forbidden/i, ErrorType.RATE_LIMIT],
    [/401|unauthorized/i, ErrorType.AUTH_ERROR],
    [/enoent|not found/i, ErrorType.FILE_NOT_FOUND],
    [/network|timeout|econnrefused/i, ErrorType.NETWORK_ERROR],
    [/conflict/i, ErrorType.CONFLICT],
  ])

  static classify(error: unknown): ErrorContext {
    const message = ErrorHandler.getErrorMessage(error)
    const type = ErrorHandler.detectErrorType(error, message)

    return {
      type,
      message,
      details: error,
      ...ErrorHandler.getRecoveryStrategy(type),
    }
  }

  private static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message)
    }
    return String(error)
  }

  private static detectErrorType(error: unknown, message: string): ErrorType {
    // HTTPステータスコードによる分類
    if (error && typeof error === 'object' && 'status' in error) {
      const status = Number(error.status)
      if (status === 403) return ErrorType.RATE_LIMIT
      if (status === 401) return ErrorType.AUTH_ERROR
      if (status === 404) return ErrorType.FILE_NOT_FOUND
    }

    // エラーコードによる分類
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'ENOENT') return ErrorType.FILE_NOT_FOUND
      if (error.code === 'ECONNREFUSED') return ErrorType.NETWORK_ERROR
    }

    // メッセージパターンによる分類
    for (const [pattern, type] of ErrorHandler.ERROR_PATTERNS) {
      if (pattern.test(message)) {
        return type
      }
    }

    return ErrorType.UNKNOWN
  }

  private static getRecoveryStrategy(errorType: ErrorType): { retryable: boolean; fatal: boolean } {
    const strategies: Record<ErrorType, { retryable: boolean; fatal: boolean }> = {
      [ErrorType.RATE_LIMIT]: { retryable: true, fatal: false },
      [ErrorType.AUTH_ERROR]: { retryable: false, fatal: true },
      [ErrorType.FILE_NOT_FOUND]: { retryable: false, fatal: false },
      [ErrorType.NETWORK_ERROR]: { retryable: true, fatal: false },
      [ErrorType.CONFLICT]: { retryable: false, fatal: false },
      [ErrorType.VALIDATION_ERROR]: { retryable: false, fatal: true },
      [ErrorType.UNKNOWN]: { retryable: true, fatal: false },
    }

    return strategies[errorType]
  }

  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000,
  ): Promise<T> {
    let lastError: unknown

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        const errorContext = ErrorHandler.classify(error)

        if (!errorContext.retryable || attempt === maxRetries) {
          throw error
        }

        const delay = Math.min(baseDelay * 2 ** (attempt - 1), 30000)
        core.warning(
          `Attempt ${attempt} failed: ${errorContext.message}. Retrying in ${delay}ms...`,
        )

        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  static logError(error: unknown, context?: string): void {
    const errorContext = ErrorHandler.classify(error)
    const prefix = context ? `[${context}] ` : ''

    core.error(`${prefix}${errorContext.message}`)

    if (error instanceof Error && error.stack) {
      core.debug(error.stack)
    }

    // 構造化ログ出力
    core.debug(
      JSON.stringify({
        type: errorContext.type,
        message: errorContext.message,
        retryable: errorContext.retryable,
        fatal: errorContext.fatal,
        details: errorContext.details,
      }),
    )
  }
}

// Circuit Breaker実装
export class CircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private readonly threshold = 5,
    private readonly timeout = 60000,
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await operation()
      if (this.state === 'HALF_OPEN') {
        this.reset()
      }
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  private recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN'
      core.warning(`Circuit breaker opened after ${this.failureCount} failures`)
    }
  }

  private reset(): void {
    this.failureCount = 0
    this.state = 'CLOSED'
    core.info('Circuit breaker reset')
  }
}
