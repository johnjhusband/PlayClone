/**
 * Timeout management utilities for PlayClone
 * Provides sophisticated timeout handling and deadline management
 */

import { TimeoutError } from './errors';

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  /** Default timeout in milliseconds */
  default: number;
  
  /** Navigation timeout */
  navigation: number;
  
  /** Element wait timeout */
  element: number;
  
  /** Action timeout */
  action: number;
  
  /** Script evaluation timeout */
  script: number;
  
  /** Network idle timeout */
  networkIdle: number;
  
  /** Page load timeout */
  pageLoad: number;
}

/**
 * Default timeout configuration
 */
export const DEFAULT_TIMEOUTS: TimeoutConfig = {
  default: 30000,      // 30 seconds
  navigation: 60000,   // 60 seconds
  element: 10000,      // 10 seconds
  action: 5000,        // 5 seconds
  script: 10000,       // 10 seconds
  networkIdle: 2000,   // 2 seconds
  pageLoad: 60000,     // 60 seconds
};

/**
 * Timeout manager for coordinating timeouts across operations
 */
export class TimeoutManager {
  private config: TimeoutConfig;
  private globalDeadline?: number;
  private operationStack: Array<{
    name: string;
    deadline: number;
    started: number;
  }> = [];
  
  constructor(config: Partial<TimeoutConfig> = {}) {
    this.config = { ...DEFAULT_TIMEOUTS, ...config };
  }
  
  /**
   * Set a global deadline for all operations
   */
  setGlobalDeadline(ms: number): void {
    this.globalDeadline = Date.now() + ms;
  }
  
  /**
   * Clear global deadline
   */
  clearGlobalDeadline(): void {
    this.globalDeadline = undefined;
  }
  
  /**
   * Get remaining time until deadline
   */
  getRemainingTime(type: keyof TimeoutConfig = 'default'): number {
    const now = Date.now();
    
    // Check global deadline first
    if (this.globalDeadline) {
      const globalRemaining = this.globalDeadline - now;
      if (globalRemaining <= 0) {
        return 0;
      }
      
      // Return minimum of global deadline and configured timeout
      return Math.min(globalRemaining, this.config[type]);
    }
    
    // Check if we're within a parent operation
    if (this.operationStack.length > 0) {
      const parent = this.operationStack[this.operationStack.length - 1];
      const parentRemaining = parent.deadline - now;
      if (parentRemaining <= 0) {
        return 0;
      }
      
      // Return minimum of parent deadline and configured timeout
      return Math.min(parentRemaining, this.config[type]);
    }
    
    // Return configured timeout
    return this.config[type];
  }
  
  /**
   * Execute operation with timeout
   */
  async withTimeout<T>(
    operation: () => Promise<T>,
    options: {
      type?: keyof TimeoutConfig;
      timeout?: number;
      name?: string;
      onTimeout?: () => void;
    } = {}
  ): Promise<T> {
    const {
      type = 'default',
      timeout = this.getRemainingTime(type),
      name = 'operation',
      onTimeout,
    } = options;
    
    // Check if we already exceeded deadline
    if (timeout <= 0) {
      throw new TimeoutError(
        `Operation "${name}" started after deadline`,
        0,
        { operation: name }
      );
    }
    
    // Track operation in stack
    const operationInfo = {
      name,
      deadline: Date.now() + timeout,
      started: Date.now(),
    };
    this.operationStack.push(operationInfo);
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          onTimeout?.();
          reject(new TimeoutError(
            `Operation "${name}" timed out`,
            timeout,
            {
              operation: name,
              elapsed: Date.now() - operationInfo.started,
            }
          ));
        }, timeout);
        
        // Store timer for cleanup
        (timeoutPromise as any).timer = timer;
      });
      
      // Race operation against timeout
      const result = await Promise.race([
        operation(),
        timeoutPromise,
      ]);
      
      // Clear timeout if operation succeeded
      if ((timeoutPromise as any).timer) {
        clearTimeout((timeoutPromise as any).timer);
      }
      
      return result;
      
    } finally {
      // Remove from operation stack
      this.operationStack.pop();
    }
  }
  
  /**
   * Create a deadline context for multiple operations
   */
  async withDeadline<T>(
    deadline: number,
    operations: () => Promise<T>
  ): Promise<T> {
    const previousDeadline = this.globalDeadline;
    
    try {
      this.setGlobalDeadline(deadline);
      return await operations();
    } finally {
      if (previousDeadline) {
        this.globalDeadline = previousDeadline;
      } else {
        this.clearGlobalDeadline();
      }
    }
  }
  
  /**
   * Update timeout configuration
   */
  updateConfig(config: Partial<TimeoutConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): TimeoutConfig {
    return { ...this.config };
  }
  
  /**
   * Get operation stack info
   */
  getOperationStack(): Array<{
    name: string;
    remaining: number;
    elapsed: number;
  }> {
    const now = Date.now();
    return this.operationStack.map(op => ({
      name: op.name,
      remaining: Math.max(0, op.deadline - now),
      elapsed: now - op.started,
    }));
  }
}

/**
 * Adaptive timeout that adjusts based on historical performance
 */
export class AdaptiveTimeout {
  private history: Map<string, number[]> = new Map();
  private readonly maxHistorySize = 100;
  
  constructor(
    private baseTimeout: number = 30000,
    private readonly multiplier: number = 1.5
  ) {}
  
  /**
   * Record operation duration
   */
  record(operation: string, duration: number): void {
    if (!this.history.has(operation)) {
      this.history.set(operation, []);
    }
    
    const hist = this.history.get(operation)!;
    hist.push(duration);
    
    // Keep history size limited
    if (hist.length > this.maxHistorySize) {
      hist.shift();
    }
  }
  
  /**
   * Calculate timeout for operation
   */
  calculate(operation: string): number {
    const hist = this.history.get(operation);
    
    if (!hist || hist.length === 0) {
      return this.baseTimeout;
    }
    
    // Calculate 95th percentile
    const sorted = [...hist].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index];
    
    // Apply multiplier for safety margin
    return Math.min(
      Math.ceil(p95 * this.multiplier),
      this.baseTimeout * 3 // Cap at 3x base timeout
    );
  }
  
  /**
   * Execute with adaptive timeout
   */
  async execute<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const timeout = this.calculate(operation);
    const started = Date.now();
    
    try {
      const result = await withTimeout(fn(), timeout, operation);
      
      // Record successful duration
      this.record(operation, Date.now() - started);
      
      return result;
    } catch (error) {
      // If it was a timeout, record the timeout duration
      if (error instanceof TimeoutError) {
        this.record(operation, timeout);
      }
      throw error;
    }
  }
  
  /**
   * Get statistics for an operation
   */
  getStats(operation: string): {
    count: number;
    average: number;
    median: number;
    p95: number;
    recommended: number;
  } | null {
    const hist = this.history.get(operation);
    
    if (!hist || hist.length === 0) {
      return null;
    }
    
    const sorted = [...hist].sort((a, b) => a - b);
    const sum = hist.reduce((a, b) => a + b, 0);
    
    return {
      count: hist.length,
      average: sum / hist.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      recommended: this.calculate(operation),
    };
  }
  
  /**
   * Clear history for an operation
   */
  clearHistory(operation?: string): void {
    if (operation) {
      this.history.delete(operation);
    } else {
      this.history.clear();
    }
  }
}

/**
 * Execute function with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeout: number,
  operation: string = 'operation'
): Promise<T> {
  if (timeout <= 0) {
    throw new TimeoutError(
      `Invalid timeout: ${timeout}ms`,
      timeout,
      { operation }
    );
  }
  
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(
        `${operation} timed out`,
        timeout,
        { operation }
      ));
    }, timeout);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Create a timeout wrapper with warning
 */
export function withTimeoutWarning<T>(
  promise: Promise<T>,
  timeout: number,
  warningThreshold: number = 0.8,
  onWarning?: (remaining: number) => void
): Promise<T> {
  const warningTime = timeout * warningThreshold;
  let warningTimer: NodeJS.Timeout;
  let timeoutTimer: NodeJS.Timeout;
  
  return new Promise<T>((resolve, reject) => {
    // Set warning timer
    warningTimer = setTimeout(() => {
      const remaining = timeout - warningTime;
      onWarning?.(remaining);
    }, warningTime);
    
    // Set timeout timer
    timeoutTimer = setTimeout(() => {
      reject(new TimeoutError(
        'Operation timed out after warning',
        timeout
      ));
    }, timeout);
    
    // Execute promise
    promise
      .then(result => {
        clearTimeout(warningTimer);
        clearTimeout(timeoutTimer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(warningTimer);
        clearTimeout(timeoutTimer);
        reject(error);
      });
  });
}

/**
 * Deadline tracker for complex operations
 */
export class DeadlineTracker {
  private deadlines: Map<string, number> = new Map();
  
  /**
   * Set a deadline
   */
  set(key: string, ms: number): void {
    this.deadlines.set(key, Date.now() + ms);
  }
  
  /**
   * Check if deadline is exceeded
   */
  isExceeded(key: string): boolean {
    const deadline = this.deadlines.get(key);
    return deadline ? Date.now() > deadline : false;
  }
  
  /**
   * Get remaining time
   */
  getRemaining(key: string): number {
    const deadline = this.deadlines.get(key);
    return deadline ? Math.max(0, deadline - Date.now()) : 0;
  }
  
  /**
   * Remove deadline
   */
  remove(key: string): void {
    this.deadlines.delete(key);
  }
  
  /**
   * Clear all deadlines
   */
  clear(): void {
    this.deadlines.clear();
  }
  
  /**
   * Check multiple deadlines and throw if any exceeded
   */
  checkAll(): void {
    for (const [key, deadline] of this.deadlines) {
      if (Date.now() > deadline) {
        throw new TimeoutError(
          `Deadline exceeded: ${key}`,
          0,
          { deadline: key }
        );
      }
    }
  }
}

/**
 * Progressive timeout - increases timeout on each retry
 */
export class ProgressiveTimeout {
  private attempt = 0;
  
  constructor(
    private base: number = 5000,
    private increment: number = 5000,
    private max: number = 60000
  ) {}
  
  /**
   * Get next timeout value
   */
  next(): number {
    const timeout = Math.min(
      this.base + (this.attempt * this.increment),
      this.max
    );
    this.attempt++;
    return timeout;
  }
  
  /**
   * Reset to initial state
   */
  reset(): void {
    this.attempt = 0;
  }
  
  /**
   * Get current attempt number
   */
  getAttempt(): number {
    return this.attempt;
  }
}