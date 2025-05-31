import { Logger } from '@nestjs/common';

/**
 * Configuration for retry mechanism
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay between retries in milliseconds */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Jitter factor (0-1) to randomize delay slightly */
  jitterFactor: number;
  /** List of status codes to retry on */
  retryableStatusCodes: number[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Sleep for given milliseconds
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute an async function with retry logic using exponential backoff
 *
 * @param fn Function to execute
 * @param options Retry configuration
 * @param logger Optional logger instance
 * @returns Result of the executed function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryConfig> = {},
  logger?: Logger,
): Promise<T> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };
  const log = logger || new Logger('RetryUtil');

  let lastError: Error;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry based on error
      if (!isRetryableError(error, config)) {
        log.error(`Non-retryable error: ${error.message}`, error.stack);
        throw error;
      }

      // Check if we've exhausted retries
      if (attempt >= config.maxRetries) {
        log.error(
          `Maximum retries (${config.maxRetries}) exceeded: ${error.message}`,
          error.stack,
        );
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(
        config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelayMs,
      );

      // Add jitter (±jitterFactor%)
      const jitter =
        1 - config.jitterFactor + Math.random() * config.jitterFactor * 2;
      const delay = Math.floor(baseDelay * jitter);

      log.warn(
        `Request failed with error: ${
          error.message
        }. Retrying in ${delay}ms (attempt ${attempt + 1}/${
          config.maxRetries
        })`,
      );

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never happen due to the throw in the loop, but TypeScript needs it
  throw lastError;
}

/**
 * Check if an error is retryable based on configuration
 */
function isRetryableError(error: any, config: RetryConfig): boolean {
  // Check for status code in error message
  if (typeof error.message === 'string') {
    if (
      error.message.includes('status code: 429') ||
      error.message.includes('Too Many Requests')
    ) {
      return true;
    }

    // Check for other status codes in error message
    for (const code of config.retryableStatusCodes) {
      if (error.message.includes(`status code: ${code}`)) {
        return true;
      }
    }
  }

  // Check for status code in error object
  if (error.status && config.retryableStatusCodes.includes(error.status)) {
    return true;
  }

  // Check for specific Sui SDK error patterns
  if (error.code && error.code === 'RATE_LIMITED') {
    return true;
  }

  return false;
}
