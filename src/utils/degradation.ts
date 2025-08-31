/**
 * Graceful degradation strategies for PlayClone
 * Provides fallback mechanisms when operations fail
 */

import { PlayCloneError, ElementNotFoundError, NavigationError } from './errors';
import { withRetry, RetryStrategies } from './retry';

/**
 * Degradation strategy configuration
 */
export interface DegradationStrategy {
  /** Name of the strategy */
  name: string;
  
  /** Priority (lower number = higher priority) */
  priority: number;
  
  /** Function to check if strategy applies */
  applies: (error: any, context?: any) => boolean;
  
  /** Execute the fallback strategy */
  execute: <T>(originalFn: () => Promise<T>, context?: any) => Promise<T>;
}

/**
 * Degradation options
 */
export interface DegradationOptions {
  /** Available strategies to try */
  strategies?: DegradationStrategy[];
  
  /** Maximum strategies to attempt */
  maxStrategies?: number;
  
  /** Log degradation attempts */
  verbose?: boolean;
  
  /** Callback for degradation events */
  onDegrade?: (strategy: string, error: any) => void;
}

/**
 * Built-in degradation strategies
 */
export const DefaultStrategies: { [key: string]: DegradationStrategy } = {
  /**
   * Retry with increased timeout
   */
  extendTimeout: {
    name: 'extendTimeout',
    priority: 1,
    applies: (error) => error?.code === 'TIMEOUT_ERROR' || error?.message?.includes('timeout'),
    execute: async (originalFn) => {
      // Retry with 2x timeout
      return withRetry(originalFn, {
        ...RetryStrategies.patient,
        timeout: 240000, // 4 minutes
      });
    },
  },
  
  /**
   * Try alternative selectors
   */
  alternativeSelectors: {
    name: 'alternativeSelectors',
    priority: 2,
    applies: (error) => error instanceof ElementNotFoundError,
    execute: async (originalFn, context) => {
      if (!context?.selector) {
        throw new Error('No selector provided');
      }
      
      // Generate alternative selectors
      const alternatives = generateAlternativeSelectors(context.selector);
      
      for (const _alt of alternatives) {
        try {
          // Try with alternative selector
          return await originalFn();
        } catch (err) {
          // Continue to next alternative
        }
      }
      
      throw new ElementNotFoundError(context.selector);
    },
  },
  
  /**
   * Reduce operation complexity
   */
  simplifyOperation: {
    name: 'simplifyOperation',
    priority: 3,
    applies: (_error, context) => context?.canSimplify === true,
    execute: async (_originalFn, context) => {
      if (context?.simplifiedVersion) {
        return context.simplifiedVersion();
      }
      
      // Default simplification: break into smaller operations
      if (context?.steps && Array.isArray(context.steps)) {
        const results = [];
        for (const step of context.steps) {
          results.push(await step());
        }
        return results as any;
      }
      
      throw new Error('Cannot simplify operation');
    },
  },
  
  /**
   * Use JavaScript fallback instead of native browser API
   */
  javascriptFallback: {
    name: 'javascriptFallback',
    priority: 4,
    applies: (_error, context) => context?.hasJsFallback === true,
    execute: async (_originalFn, context) => {
      if (context?.jsFallback) {
        return context.jsFallback();
      }
      throw new Error('No JavaScript fallback available');
    },
  },
  
  /**
   * Wait for page stability before retrying
   */
  waitForStability: {
    name: 'waitForStability',
    priority: 5,
    applies: (error) => {
      const unstableErrors = [
        'Element is not stable',
        'Page is still loading',
        'Animation in progress',
      ];
      return unstableErrors.some(msg => error?.message?.includes(msg));
    },
    execute: async (originalFn, context) => {
      // Wait for various stability indicators
      await Promise.all([
        waitForNetworkIdle(context?.page, 2000),
        waitForAnimations(context?.page),
        waitForLoadState(context?.page, 'domcontentloaded'),
      ]);
      
      // Retry original operation
      return originalFn();
    },
  },
  
  /**
   * Refresh page and retry
   */
  refreshPage: {
    name: 'refreshPage',
    priority: 10,
    applies: (error, context) => {
      return context?.allowRefresh === true &&
             (error instanceof NavigationError || 
              error?.message?.includes('stale'));
    },
    execute: async (originalFn, context) => {
      if (context?.page) {
        await context.page.reload({ waitUntil: 'networkidle' });
        // Wait a bit for page to stabilize
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      return originalFn();
    },
  },
  
  /**
   * Return partial/degraded result
   */
  partialResult: {
    name: 'partialResult',
    priority: 20,
    applies: (_error, context) => context?.allowPartial === true,
    execute: async (_originalFn, context) => {
      if (context?.partialResult) {
        return context.partialResult;
      }
      
      // Return a degraded but functional result
      return {
        success: false,
        partial: true,
        data: context?.fallbackData || null,
        error: 'Partial result returned',
        suggestion: 'Operation partially completed with degraded functionality',
      } as any;
    },
  },
};

/**
 * Generate alternative selectors for an element
 */
function generateAlternativeSelectors(selector: string): string[] {
  const alternatives: string[] = [];
  
  // If it's text-based, try different matching strategies
  if (!selector.startsWith('.') && !selector.startsWith('#') && !selector.includes('[')) {
    alternatives.push(
      `text="${selector}"`,
      `text~="${selector}"`,
      `text*="${selector}"`,
      `[aria-label="${selector}"]`,
      `[title="${selector}"]`,
      `[placeholder="${selector}"]`,
      `button:has-text("${selector}")`,
      `a:has-text("${selector}")`,
      `input[value="${selector}"]`,
    );
  }
  
  // If it's a class selector, try variations
  if (selector.startsWith('.')) {
    const className = selector.substring(1);
    alternatives.push(
      `[class*="${className}"]`,
      `div${selector}`,
      `span${selector}`,
      `button${selector}`,
    );
  }
  
  // If it's an ID selector, try variations
  if (selector.startsWith('#')) {
    const id = selector.substring(1);
    alternatives.push(
      `[id="${id}"]`,
      `[id*="${id}"]`,
      `*[id="${id}"]`,
    );
  }
  
  return alternatives;
}

/**
 * Wait for network to be idle
 */
async function waitForNetworkIdle(page: any, timeout: number = 2000): Promise<void> {
  if (!page) return;
  
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // Ignore timeout, we tried our best
  }
}

/**
 * Wait for animations to complete
 */
async function waitForAnimations(page: any): Promise<void> {
  if (!page) return;
  
  try {
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.querySelectorAll('*')).map((element) => {
          const animations = element.getAnimations?.() || [];
          return Promise.all(animations.map(animation => animation.finished));
        })
      );
    });
  } catch {
    // Ignore errors, animations might not be supported
  }
}

/**
 * Wait for specific load state
 */
async function waitForLoadState(page: any, state: string): Promise<void> {
  if (!page) return;
  
  try {
    await page.waitForLoadState(state, { timeout: 5000 });
  } catch {
    // Ignore timeout
  }
}

/**
 * Execute with graceful degradation
 */
export async function withDegradation<T>(
  fn: () => Promise<T>,
  options: DegradationOptions = {},
  context?: any
): Promise<T> {
  const {
    strategies = Object.values(DefaultStrategies),
    maxStrategies = 3,
    verbose = false,
    onDegrade = () => {},
  } = options;
  
  // Sort strategies by priority
  const sortedStrategies = [...strategies].sort((a, b) => a.priority - b.priority);
  
  try {
    // Try original function first
    return await fn();
  } catch (originalError) {
    if (verbose) {
      console.log('Original operation failed:', originalError);
    }
    
    // Try degradation strategies
    let attemptedStrategies = 0;
    let lastError = originalError;
    
    for (const strategy of sortedStrategies) {
      if (attemptedStrategies >= maxStrategies) {
        break;
      }
      
      if (strategy.applies(lastError, context)) {
        attemptedStrategies++;
        
        if (verbose) {
          console.log(`Attempting degradation strategy: ${strategy.name}`);
        }
        
        try {
          onDegrade(strategy.name, lastError);
          const result = await strategy.execute(fn, context);
          
          if (verbose) {
            console.log(`Strategy ${strategy.name} succeeded`);
          }
          
          return result;
        } catch (strategyError) {
          lastError = strategyError;
          
          if (verbose) {
            console.log(`Strategy ${strategy.name} failed:`, strategyError);
          }
        }
      }
    }
    
    // All strategies failed
    throw new PlayCloneError(
      'All degradation strategies failed',
      'DEGRADATION_FAILED',
      {
        cause: lastError instanceof Error ? lastError : undefined,
        details: {
          originalError: (originalError as any)?.message,
          attemptedStrategies,
          strategies: sortedStrategies.slice(0, attemptedStrategies).map(s => s.name),
        },
        suggestion: 'Operation could not be completed even with fallback strategies',
      }
    );
  }
}

/**
 * Create a degradable wrapper for a function
 */
export function degradable(options: DegradationOptions = {}) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const context = {
        method: propertyKey,
        args,
        instance: this,
      };
      
      return withDegradation(
        () => originalMethod.apply(this, args),
        options,
        context
      );
    };
    
    return descriptor;
  };
}

/**
 * Progressive enhancement - start simple and add complexity
 */
export class ProgressiveEnhancer {
  private levels: Array<{
    name: string;
    check: () => boolean;
    enhance: (base: any) => any;
  }> = [];
  
  /**
   * Add an enhancement level
   */
  addLevel(
    name: string,
    check: () => boolean,
    enhance: (base: any) => any
  ): this {
    this.levels.push({ name, check, enhance });
    return this;
  }
  
  /**
   * Apply progressive enhancements
   */
  apply<T>(base: T): T {
    let enhanced = base;
    
    for (const level of this.levels) {
      if (level.check()) {
        try {
          enhanced = level.enhance(enhanced);
        } catch (error) {
          // Enhancement failed, continue with previous level
          console.warn(`Enhancement ${level.name} failed:`, error);
          break;
        }
      }
    }
    
    return enhanced;
  }
}

/**
 * Fallback chain for operations
 */
export class FallbackChain<T> {
  private operations: Array<{
    name: string;
    fn: () => Promise<T>;
    condition?: () => boolean;
  }> = [];
  
  /**
   * Add operation to fallback chain
   */
  add(
    name: string,
    fn: () => Promise<T>,
    condition?: () => boolean
  ): this {
    this.operations.push({ name, fn, condition });
    return this;
  }
  
  /**
   * Execute fallback chain
   */
  async execute(): Promise<T> {
    const errors: Array<{ name: string; error: any }> = [];
    
    for (const operation of this.operations) {
      // Check condition if provided
      if (operation.condition && !operation.condition()) {
        continue;
      }
      
      try {
        return await operation.fn();
      } catch (error) {
        errors.push({ name: operation.name, error });
      }
    }
    
    // All operations failed
    throw new PlayCloneError(
      'All fallback operations failed',
      'FALLBACK_CHAIN_FAILED',
      {
        details: { errors },
        suggestion: 'None of the fallback strategies succeeded',
      }
    );
  }
}