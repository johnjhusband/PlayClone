/**
 * Retry logic with exponential backoff for PlayClone
 * Provides intelligent retry mechanisms for transient failures
 */

import { 
  PlayCloneError, 
  isRetryableError, 
  createRetryableError,
  TimeoutError 
} from './errors';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  
  /** Exponential backoff factor (default: 2) */
  backoffFactor?: number;
  
  /** Add randomization to delays to prevent thundering herd (default: true) */
  jitter?: boolean;
  
  /** Overall timeout for all attempts in milliseconds (default: 120000) */
  timeout?: number;
  
  /** Function to determine if error is retryable (default: isRetryableError) */
  isRetryable?: (error: any) => boolean;
  
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, delay: number, error: any) => void;
  
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  timeout: 120000,
  isRetryable: isRetryableError,
  onRetry: () => {},
  signal: undefined as any,
};

/**
 * Calculate delay with exponential backoff
 */
export function calculateBackoffDelay(
  attempt: number,
  options: RetryOptions = {}
): number {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  
  // Calculate base delay with exponential backoff
  let delay = config.initialDelay * Math.pow(config.backoffFactor, attempt - 1);
  
  // Cap at maximum delay
  delay = Math.min(delay, config.maxDelay);
  
  // Add jitter to prevent thundering herd
  if (config.jitter) {
    // Random factor between 0.5 and 1.5
    const jitterFactor = 0.5 + Math.random();
    delay = Math.floor(delay * jitterFactor);
  }
  
  return delay;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  context?: { action?: string; selector?: string; url?: string }
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const startTime = Date.now();
  let lastError: any;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      // Check if aborted
      if (config.signal?.aborted) {
        throw new PlayCloneError('Operation aborted', 'ABORTED', {
          ...context,
          retryable: false,
        });
      }
      
      // Check overall timeout
      const elapsed = Date.now() - startTime;
      if (config.timeout && elapsed >= config.timeout) {
        throw new TimeoutError(
          'Retry timeout exceeded',
          config.timeout,
          context
        );
      }
      
      // Calculate remaining time for this attempt
      const remainingTime = config.timeout ? config.timeout - elapsed : undefined;
      
      // Execute the function
      const result = await Promise.race([
        fn(),
        ...(remainingTime ? [
          sleep(remainingTime).then(() => {
            throw new TimeoutError(
              'Operation timeout',
              remainingTime,
              context
            );
          })
        ] : [])
      ]);
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      if (!config.isRetryable(error)) {
        throw error;
      }
      
      // Check if we have more attempts
      if (attempt >= config.maxAttempts) {
        throw createRetryableError(
          lastError?.message || 'Operation failed',
          attempt,
          config.maxAttempts,
          { ...context, cause: lastError }
        );
      }
      
      // Calculate delay for next attempt
      const delay = calculateBackoffDelay(attempt, config);
      
      // Check if delay would exceed timeout
      const elapsed = Date.now() - startTime;
      if (config.timeout && elapsed + delay >= config.timeout) {
        throw new TimeoutError(
          'Retry timeout would be exceeded',
          config.timeout,
          { ...context, attempts: attempt, maxAttempts: config.maxAttempts }
        );
      }
      
      // Notify about retry
      config.onRetry(attempt, delay, error);
      
      // Wait before next attempt
      await sleep(delay);
    }
  }
  
  // Should never reach here, but just in case
  throw createRetryableError(
    lastError?.message || 'Operation failed after all retries',
    config.maxAttempts,
    config.maxAttempts,
    { ...context, cause: lastError }
  );
}

/**
 * Retry with circuit breaker pattern
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000,
    private readonly halfOpenAttempts: number = 1
  ) {}
  
  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    retryOptions?: RetryOptions
  ): Promise<T> {
    // Check circuit state
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed < this.timeout) {
        throw new PlayCloneError(
          'Circuit breaker is open',
          'CIRCUIT_OPEN',
          {
            retryable: false,
            details: {
              failures: this.failures,
              timeRemaining: this.timeout - elapsed,
            },
            suggestion: `Circuit will reset in ${Math.ceil((this.timeout - elapsed) / 1000)}s`,
          }
        );
      }
      // Move to half-open state
      this.state = 'half-open';
    }
    
    try {
      // Execute with retry
      const result = await withRetry(fn, {
        ...retryOptions,
        maxAttempts: this.state === 'half-open' ? this.halfOpenAttempts : retryOptions?.maxAttempts,
      });
      
      // Success - reset circuit
      if (this.state === 'half-open') {
        this.reset();
      }
      
      return result;
      
    } catch (error) {
      // Record failure
      this.recordFailure();
      throw error;
    }
  }
  
  /**
   * Record a failure
   */
  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
  
  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'closed';
  }
  
  /**
   * Get circuit breaker status
   */
  getStatus(): {
    state: string;
    failures: number;
    threshold: number;
    timeRemaining?: number;
  } {
    const status: any = {
      state: this.state,
      failures: this.failures,
      threshold: this.threshold,
    };
    
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed < this.timeout) {
        status.timeRemaining = Math.ceil((this.timeout - elapsed) / 1000);
      }
    }
    
    return status;
  }
}

/**
 * Retry strategies for different scenarios
 */
export const RetryStrategies = {
  /** Fast retry for quick operations */
  fast: {
    maxAttempts: 3,
    initialDelay: 100,
    maxDelay: 1000,
    backoffFactor: 2,
    timeout: 5000,
  } as RetryOptions,
  
  /** Standard retry for most operations */
  standard: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    timeout: 30000,
  } as RetryOptions,
  
  /** Aggressive retry for critical operations */
  aggressive: {
    maxAttempts: 5,
    initialDelay: 500,
    maxDelay: 30000,
    backoffFactor: 3,
    timeout: 120000,
  } as RetryOptions,
  
  /** Patient retry for slow operations */
  patient: {
    maxAttempts: 10,
    initialDelay: 2000,
    maxDelay: 60000,
    backoffFactor: 1.5,
    timeout: 300000,
  } as RetryOptions,
  
  /** No retry - fail immediately */
  none: {
    maxAttempts: 1,
    initialDelay: 0,
    maxDelay: 0,
    backoffFactor: 1,
    timeout: 60000,
  } as RetryOptions,
};

/**
 * Create a retry wrapper for a class method
 */
export function retryable(options: RetryOptions = RetryStrategies.standard) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return withRetry(
        () => originalMethod.apply(this, args),
        options,
        { action: propertyKey }
      );
    };
    
    return descriptor;
  };
}

/**
 * Batch retry for multiple operations
 */
export async function batchRetry<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions & { 
    concurrency?: number;
    failFast?: boolean;
  } = {}
): Promise<Array<{ success: boolean; result?: T; error?: any }>> {
  const { concurrency = 5, failFast = false, ...retryOptions } = options;
  const results: Array<{ success: boolean; result?: T; error?: any }> = [];
  
  // Process in batches
  for (let i = 0; i < operations.length; i += concurrency) {
    const batch = operations.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (operation) => {
        try {
          const result = await withRetry(operation, retryOptions);
          return { success: true, result };
        } catch (error) {
          if (failFast) {
            throw error;
          }
          return { success: false, error };
        }
      })
    );
    
    results.push(...batchResults);
  }
  
  return results;
}