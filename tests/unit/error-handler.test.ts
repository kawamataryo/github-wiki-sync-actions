import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as core from '@actions/core'
import { ErrorHandler, ErrorType, CircuitBreaker } from '../../src/error-handler'

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('classify', () => {
    it('should classify rate limit errors', () => {
      const error403 = { status: 403, message: 'API rate limit exceeded' }
      const errorContext = ErrorHandler.classify(error403)

      expect(errorContext.type).toBe(ErrorType.RATE_LIMIT)
      expect(errorContext.retryable).toBe(true)
      expect(errorContext.fatal).toBe(false)
    })

    it('should classify auth errors', () => {
      const error401 = { status: 401, message: 'Unauthorized' }
      const errorContext = ErrorHandler.classify(error401)

      expect(errorContext.type).toBe(ErrorType.AUTH_ERROR)
      expect(errorContext.retryable).toBe(false)
      expect(errorContext.fatal).toBe(true)
    })

    it('should classify file not found errors', () => {
      const errorENOENT = { code: 'ENOENT', message: 'File not found' }
      const errorContext = ErrorHandler.classify(errorENOENT)

      expect(errorContext.type).toBe(ErrorType.FILE_NOT_FOUND)
      expect(errorContext.retryable).toBe(false)
      expect(errorContext.fatal).toBe(false)
    })

    it('should classify network errors', () => {
      const errorNetwork = { code: 'ECONNREFUSED', message: 'Connection refused' }
      const errorContext = ErrorHandler.classify(errorNetwork)

      expect(errorContext.type).toBe(ErrorType.NETWORK_ERROR)
      expect(errorContext.retryable).toBe(true)
      expect(errorContext.fatal).toBe(false)
    })

    it('should classify unknown errors', () => {
      const errorUnknown = new Error('Something went wrong')
      const errorContext = ErrorHandler.classify(errorUnknown)

      expect(errorContext.type).toBe(ErrorType.UNKNOWN)
      expect(errorContext.retryable).toBe(true)
      expect(errorContext.fatal).toBe(false)
    })

    it('should handle string errors', () => {
      const errorContext = ErrorHandler.classify('Simple error string')

      expect(errorContext.type).toBe(ErrorType.UNKNOWN)
      expect(errorContext.message).toBe('Simple error string')
    })
  })

  describe('retryWithBackoff', () => {
    it('should retry on retryable errors', async () => {
      let attempts = 0
      const operation = vi.fn(async () => {
        attempts++
        if (attempts < 3) {
          throw { status: 403, message: 'Rate limit' }
        }
        return 'success'
      })

      const result = await ErrorHandler.retryWithBackoff(operation, 3, 10)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should not retry on non-retryable errors', async () => {
      const operation = vi.fn(async () => {
        throw { status: 401, message: 'Unauthorized' }
      })

      await expect(ErrorHandler.retryWithBackoff(operation, 3, 10)).rejects.toMatchObject({
        status: 401,
      })

      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should throw after max retries', async () => {
      const operation = vi.fn(async () => {
        throw new Error('Network error')
      })

      await expect(ErrorHandler.retryWithBackoff(operation, 2, 10)).rejects.toThrow(
        'Network error',
      )

      expect(operation).toHaveBeenCalledTimes(2)
    })
  })

  describe('logError', () => {
    it('should log error with context', () => {
      const error = new Error('Test error')
      error.stack = 'Error stack trace'

      ErrorHandler.logError(error, 'TestContext')

      expect(core.error).toHaveBeenCalledWith('[TestContext] Test error')
      expect(core.debug).toHaveBeenCalledWith(error.stack)
    })

    it('should log error without context', () => {
      const error = { message: 'Simple error' }

      ErrorHandler.logError(error)

      expect(core.error).toHaveBeenCalledWith('Simple error')
    })
  })
})

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should open after threshold failures', async () => {
    const breaker = new CircuitBreaker(3, 1000)
    const operation = vi.fn().mockRejectedValue(new Error('Failed'))

    // First 3 failures
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(operation)).rejects.toThrow('Failed')
    }

    // Circuit should be open now
    await expect(breaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('should enter half-open state after timeout', async () => {
    const breaker = new CircuitBreaker(1, 1000)
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce('Success')

    // Trigger circuit opening
    await expect(breaker.execute(operation)).rejects.toThrow('Failed')

    // Circuit is open
    await expect(breaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN')

    // Wait for timeout
    vi.advanceTimersByTime(1100)

    // Should succeed and reset
    const result = await breaker.execute(operation)
    expect(result).toBe('Success')
    expect(core.info).toHaveBeenCalledWith('Circuit breaker reset')
  })

  it('should allow successful operations', async () => {
    const breaker = new CircuitBreaker()
    const operation = vi.fn().mockResolvedValue('Success')

    const result = await breaker.execute(operation)

    expect(result).toBe('Success')
    expect(operation).toHaveBeenCalledTimes(1)
  })
})