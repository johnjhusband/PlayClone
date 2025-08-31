/**
 * Startup Optimizer - Minimize initialization time
 */

import { ConnectionPool } from './ConnectionPool';
import { CacheManager } from './OperationCache';
import { MemoryManager } from './MemoryManager';
import { PerformanceProfiler } from './PerformanceProfiler';

/**
 * Startup configuration
 */
export interface StartupConfig {
  lazyLoad: boolean;
  preloadBrowsers: boolean;
  warmupCache: boolean;
  deferNonCritical: boolean;
  parallelInit: boolean;
  minimalMode: boolean;
}

/**
 * Initialization stages
 */
export enum InitStage {
  CORE = 'core',
  BROWSER = 'browser',
  CACHE = 'cache',
  MONITORING = 'monitoring',
  OPTIONAL = 'optional',
}

/**
 * Startup metrics
 */
export interface StartupMetrics {
  totalTime: number;
  stages: Map<InitStage, number>;
  browserLaunchTime: number;
  cacheInitTime: number;
  poolInitTime: number;
  firstReadyTime: number;
}

/**
 * Lazy loader for deferred modules
 */
class LazyLoader {
  private loaders: Map<string, () => Promise<any>>;
  private loaded: Map<string, any>;

  constructor() {
    this.loaders = new Map();
    this.loaded = new Map();
  }

  register(name: string, loader: () => Promise<any>): void {
    this.loaders.set(name, loader);
  }

  async get<T>(name: string): Promise<T> {
    if (this.loaded.has(name)) {
      return this.loaded.get(name);
    }

    const loader = this.loaders.get(name);
    if (!loader) {
      throw new Error(`No loader registered for ${name}`);
    }

    const module = await loader();
    this.loaded.set(name, module);
    return module;
  }

  isLoaded(name: string): boolean {
    return this.loaded.has(name);
  }
}

/**
 * Startup Optimizer class
 */
export class StartupOptimizer {
  private config: StartupConfig;
  private lazyLoader: LazyLoader;
  private startTime: number;
  private metrics: StartupMetrics;
  private ready: boolean;
  private readyCallbacks: Array<() => void>;

  constructor(config: Partial<StartupConfig> = {}) {
    this.config = {
      lazyLoad: true,
      preloadBrowsers: false,
      warmupCache: false,
      deferNonCritical: true,
      parallelInit: true,
      minimalMode: false,
      ...config,
    };

    this.lazyLoader = new LazyLoader();
    this.startTime = Date.now();
    this.ready = false;
    this.readyCallbacks = [];

    this.metrics = {
      totalTime: 0,
      stages: new Map(),
      browserLaunchTime: 0,
      cacheInitTime: 0,
      poolInitTime: 0,
      firstReadyTime: 0,
    };
  }

  /**
   * Initialize PlayClone with optimizations
   */
  async initialize(): Promise<void> {
    this.startTime = Date.now();

    if (this.config.minimalMode) {
      await this.minimalInit();
    } else if (this.config.parallelInit) {
      await this.parallelInit();
    } else {
      await this.sequentialInit();
    }

    this.metrics.totalTime = Date.now() - this.startTime;
    this.ready = true;
    this.notifyReady();
  }

  /**
   * Minimal initialization for fastest startup
   */
  private async minimalInit(): Promise<void> {
    // Only initialize absolute essentials
    const coreStart = Date.now();
    
    // Register lazy loaders
    this.registerLazyLoaders();
    
    this.metrics.stages.set(InitStage.CORE, Date.now() - coreStart);
    this.metrics.firstReadyTime = Date.now() - this.startTime;
  }

  /**
   * Parallel initialization for faster startup
   */
  private async parallelInit(): Promise<void> {
    const stages: Array<Promise<void>> = [];

    // Core initialization (required)
    stages.push(this.initStage(InitStage.CORE, async () => {
      this.registerLazyLoaders();
    }));

    // Browser preloading (optional)
    if (this.config.preloadBrowsers) {
      stages.push(this.initStage(InitStage.BROWSER, async () => {
        await this.preloadBrowser();
      }));
    }

    // Cache warmup (optional)
    if (this.config.warmupCache) {
      stages.push(this.initStage(InitStage.CACHE, async () => {
        await this.warmupCache();
      }));
    }

    // Wait for all parallel stages
    await Promise.all(stages);
    this.metrics.firstReadyTime = Date.now() - this.startTime;

    // Defer non-critical initialization
    if (this.config.deferNonCritical) {
      setTimeout(() => {
        this.initDeferredComponents();
      }, 100);
    }
  }

  /**
   * Sequential initialization (fallback)
   */
  private async sequentialInit(): Promise<void> {
    await this.initStage(InitStage.CORE, async () => {
      this.registerLazyLoaders();
    });

    if (this.config.preloadBrowsers) {
      await this.initStage(InitStage.BROWSER, async () => {
        await this.preloadBrowser();
      });
    }

    if (this.config.warmupCache) {
      await this.initStage(InitStage.CACHE, async () => {
        await this.warmupCache();
      });
    }

    this.metrics.firstReadyTime = Date.now() - this.startTime;

    if (!this.config.deferNonCritical) {
      await this.initStage(InitStage.OPTIONAL, async () => {
        await this.initDeferredComponents();
      });
    }
  }

  /**
   * Initialize a specific stage
   */
  private async initStage(stage: InitStage, init: () => Promise<void>): Promise<void> {
    const start = Date.now();
    
    try {
      await init();
    } catch (error) {
      console.error(`Failed to initialize ${stage}:`, error);
    } finally {
      this.metrics.stages.set(stage, Date.now() - start);
    }
  }

  /**
   * Register lazy loaders for deferred modules
   */
  private registerLazyLoaders(): void {
    // Connection pool
    this.lazyLoader.register('connectionPool', async () => {
      const start = Date.now();
      const pool = new ConnectionPool({
        minConnections: this.config.minimalMode ? 0 : 1,
        warmupOnStart: false,
      });
      this.metrics.poolInitTime = Date.now() - start;
      return pool;
    });

    // Cache manager
    this.lazyLoader.register('cacheManager', async () => {
      const start = Date.now();
      const cache = new CacheManager();
      this.metrics.cacheInitTime = Date.now() - start;
      return cache;
    });

    // Memory manager
    this.lazyLoader.register('memoryManager', async () => {
      return new MemoryManager();
    });

    // Performance profiler
    this.lazyLoader.register('profiler', async () => {
      return new PerformanceProfiler(false); // Start disabled
    });
  }

  /**
   * Preload browser for faster first use
   */
  private async preloadBrowser(): Promise<void> {
    const start = Date.now();
    
    try {
      const pool = await this.lazyLoader.get<ConnectionPool>('connectionPool');
      await pool.acquire().then(conn => pool.release(conn));
      this.metrics.browserLaunchTime = Date.now() - start;
    } catch (error) {
      console.warn('Browser preload failed:', error);
    }
  }

  /**
   * Warmup cache with common operations
   */
  private async warmupCache(): Promise<void> {
    const cache = await this.lazyLoader.get<CacheManager>('cacheManager');
    
    // Pre-cache common selectors
    const commonSelectors = [
      'button', 'input', 'a', 'form',
      '[type="submit"]', '[type="button"]',
      '.btn', '.button', '#submit',
    ];

    const elementCache = cache.getElementCache();
    for (const selector of commonSelectors) {
      elementCache.cacheElement(selector, 'warmup', { warmup: true });
    }
  }

  /**
   * Initialize deferred components
   */
  private async initDeferredComponents(): Promise<void> {
    await this.initStage(InitStage.OPTIONAL, async () => {
      // Initialize monitoring
      if (!this.config.minimalMode) {
        await this.lazyLoader.get('memoryManager');
        await this.lazyLoader.get('profiler');
      }
    });
  }

  /**
   * Get lazy-loaded component
   */
  async getComponent<T>(name: string): Promise<T> {
    return this.lazyLoader.get<T>(name);
  }

  /**
   * Check if component is loaded
   */
  isComponentLoaded(name: string): boolean {
    return this.lazyLoader.isLoaded(name);
  }

  /**
   * Wait for ready state
   */
  async waitForReady(): Promise<void> {
    if (this.ready) return;

    return new Promise(resolve => {
      this.readyCallbacks.push(resolve);
    });
  }

  /**
   * Notify ready callbacks
   */
  private notifyReady(): void {
    for (const callback of this.readyCallbacks) {
      callback();
    }
    this.readyCallbacks = [];
  }

  /**
   * Get startup metrics
   */
  getMetrics(): StartupMetrics {
    return { ...this.metrics };
  }

  /**
   * Create optimized PlayClone instance
   */
  static async createOptimized(config?: Partial<StartupConfig>): Promise<{
    optimizer: StartupOptimizer;
    getPool: () => Promise<ConnectionPool>;
    getCache: () => Promise<CacheManager>;
    getMemory: () => Promise<MemoryManager>;
    getProfiler: () => Promise<PerformanceProfiler>;
  }> {
    const optimizer = new StartupOptimizer(config);
    await optimizer.initialize();

    return {
      optimizer,
      getPool: () => optimizer.getComponent<ConnectionPool>('connectionPool'),
      getCache: () => optimizer.getComponent<CacheManager>('cacheManager'),
      getMemory: () => optimizer.getComponent<MemoryManager>('memoryManager'),
      getProfiler: () => optimizer.getComponent<PerformanceProfiler>('profiler'),
    };
  }
}

/**
 * Fast startup preset configurations
 */
export const StartupPresets = {
  /**
   * Fastest possible startup - minimal features
   */
  MINIMAL: {
    lazyLoad: true,
    preloadBrowsers: false,
    warmupCache: false,
    deferNonCritical: true,
    parallelInit: true,
    minimalMode: true,
  } as StartupConfig,

  /**
   * Fast startup with browser preloading
   */
  FAST: {
    lazyLoad: true,
    preloadBrowsers: true,
    warmupCache: false,
    deferNonCritical: true,
    parallelInit: true,
    minimalMode: false,
  } as StartupConfig,

  /**
   * Balanced startup - good performance and features
   */
  BALANCED: {
    lazyLoad: true,
    preloadBrowsers: true,
    warmupCache: true,
    deferNonCritical: true,
    parallelInit: true,
    minimalMode: false,
  } as StartupConfig,

  /**
   * Full features - slower startup but everything ready
   */
  FULL: {
    lazyLoad: false,
    preloadBrowsers: true,
    warmupCache: true,
    deferNonCritical: false,
    parallelInit: false,
    minimalMode: false,
  } as StartupConfig,
};

/**
 * Quick start helper
 */
export async function quickStart(
  preset: keyof typeof StartupPresets = 'FAST'
): Promise<{
  optimizer: StartupOptimizer;
  metrics: StartupMetrics;
}> {
  const config = StartupPresets[preset];
  const result = await StartupOptimizer.createOptimized(config);
  
  return {
    optimizer: result.optimizer,
    metrics: result.optimizer.getMetrics(),
  };
}