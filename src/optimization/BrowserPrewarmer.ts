/**
 * BrowserPrewarmer - Reduces browser startup time through pre-warming and pooling
 */

import { chromium, firefox, webkit, Browser, BrowserContext } from 'playwright-core';
import { LaunchOptions, BrowserType } from '../types';

interface PrewarmedBrowser {
  browser: Browser;
  context: BrowserContext;
  createdAt: number;
  inUse: boolean;
  browserType: BrowserType;
}

export class BrowserPrewarmer {
  private pool: Map<string, PrewarmedBrowser[]> = new Map();
  private maxPoolSize: number;
  private prewarmInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxIdleTime: number = 5 * 60 * 1000; // 5 minutes
  private startupMetrics: Map<BrowserType, number[]> = new Map();
  
  constructor(maxPoolSize: number = 3) {
    this.maxPoolSize = maxPoolSize;
    this.initializeMetrics();
  }

  /**
   * Initialize startup metrics tracking
   */
  private initializeMetrics(): void {
    this.startupMetrics.set('chromium', []);
    this.startupMetrics.set('firefox', []);
    this.startupMetrics.set('webkit', []);
  }

  /**
   * Start pre-warming browsers
   */
  async startPrewarming(options: LaunchOptions = {}): Promise<void> {
    // Pre-warm initial browsers
    await this.prewarmBrowser('chromium', options);
    
    // Set up periodic pre-warming
    this.prewarmInterval = setInterval(async () => {
      await this.maintainPool(options);
    }, 30000); // Check every 30 seconds

    // Set up cleanup for idle browsers
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleBrowsers();
    }, 60000); // Cleanup every minute
  }

  /**
   * Pre-warm a single browser instance
   */
  private async prewarmBrowser(
    browserType: BrowserType, 
    options: LaunchOptions
  ): Promise<PrewarmedBrowser | null> {
    try {
      const startTime = Date.now();
      const browserEngine = this.getBrowserEngine(browserType);
      
      // Launch with optimized settings for faster startup
      const browser = await browserEngine.launch({
        headless: options.headless ?? true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // Faster for single-page usage
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          ...(options.args || [])
        ],
        executablePath: options.executablePath,
      });

      // Create context with minimal options
      const context = await browser.newContext({
        viewport: options.viewport ?? { width: 1280, height: 720 },
        userAgent: options.userAgent,
      });

      // Pre-create a page to warm up the context
      const page = await context.newPage();
      await page.close(); // Close the pre-warm page

      const duration = Date.now() - startTime;
      this.recordStartupMetric(browserType, duration);

      const prewarnedBrowser: PrewarmedBrowser = {
        browser,
        context,
        createdAt: Date.now(),
        inUse: false,
        browserType,
      };

      // Add to pool
      if (!this.pool.has(browserType)) {
        this.pool.set(browserType, []);
      }
      this.pool.get(browserType)!.push(prewarnedBrowser);

      console.log(`Pre-warmed ${browserType} browser in ${duration}ms`);
      return prewarnedBrowser;
    } catch (error) {
      console.error(`Failed to pre-warm ${browserType}:`, error);
      return null;
    }
  }

  /**
   * Get a pre-warmed browser or create a new one
   */
  async getBrowser(
    browserType: BrowserType = 'chromium',
    options: LaunchOptions = {}
  ): Promise<{ browser: Browser; context: BrowserContext } | null> {
    const poolKey = browserType;
    const pool = this.pool.get(poolKey) || [];
    
    // Find an available pre-warmed browser
    const available = pool.find(b => !b.inUse && b.browser.isConnected());
    
    if (available) {
      available.inUse = true;
      console.log(`Using pre-warmed ${browserType} browser (instant startup)`);
      return {
        browser: available.browser,
        context: available.context,
      };
    }

    // No pre-warmed browser available, create new one
    console.log(`No pre-warmed ${browserType} available, creating new...`);
    const newBrowser = await this.prewarmBrowser(browserType, options);
    
    if (newBrowser) {
      newBrowser.inUse = true;
      return {
        browser: newBrowser.browser,
        context: newBrowser.context,
      };
    }

    return null;
  }

  /**
   * Release a browser back to the pool
   */
  releaseBrowser(browser: Browser): void {
    for (const [_, pool] of this.pool) {
      const instance = pool.find(b => b.browser === browser);
      if (instance) {
        instance.inUse = false;
        console.log(`Released ${instance.browserType} browser back to pool`);
        return;
      }
    }
  }

  /**
   * Maintain pool size
   */
  private async maintainPool(options: LaunchOptions): Promise<void> {
    for (const [browserType, pool] of this.pool) {
      const activeCount = pool.filter(b => !b.inUse && b.browser.isConnected()).length;
      const totalCount = pool.length;
      
      // Maintain minimum pool size
      if (activeCount < 1 && totalCount < this.maxPoolSize) {
        console.log(`Pool low for ${browserType}, pre-warming...`);
        await this.prewarmBrowser(browserType as BrowserType, options);
      }
      
      // Don't exceed max pool size
      while (pool.length > this.maxPoolSize) {
        const toRemove = pool.find(b => !b.inUse);
        if (toRemove) {
          await this.closeBrowser(toRemove);
          pool.splice(pool.indexOf(toRemove), 1);
        } else {
          break;
        }
      }
    }
  }

  /**
   * Cleanup idle browsers
   */
  private cleanupIdleBrowsers(): void {
    const now = Date.now();
    
    for (const [browserType, pool] of this.pool) {
      const toRemove: PrewarmedBrowser[] = [];
      
      for (const browser of pool) {
        if (!browser.inUse && (now - browser.createdAt) > this.maxIdleTime) {
          toRemove.push(browser);
        }
      }

      for (const browser of toRemove) {
        this.closeBrowser(browser);
        const index = pool.indexOf(browser);
        if (index > -1) {
          pool.splice(index, 1);
        }
        console.log(`Cleaned up idle ${browserType} browser`);
      }
    }
  }

  /**
   * Close a browser instance
   */
  private async closeBrowser(instance: PrewarmedBrowser): Promise<void> {
    try {
      if (instance.context) {
        await instance.context.close();
      }
      if (instance.browser && instance.browser.isConnected()) {
        await instance.browser.close();
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }

  /**
   * Get browser engine
   */
  private getBrowserEngine(browserType: BrowserType) {
    switch (browserType) {
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      case 'chromium':
      default:
        return chromium;
    }
  }

  /**
   * Record startup metric
   */
  private recordStartupMetric(browserType: BrowserType, duration: number): void {
    const metrics = this.startupMetrics.get(browserType) || [];
    metrics.push(duration);
    
    // Keep only last 10 metrics
    if (metrics.length > 10) {
      metrics.shift();
    }
    
    this.startupMetrics.set(browserType, metrics);
  }

  /**
   * Get average startup time
   */
  getAverageStartupTime(browserType: BrowserType): number {
    const metrics = this.startupMetrics.get(browserType) || [];
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((a, b) => a + b, 0);
    return Math.round(sum / metrics.length);
  }

  /**
   * Stop pre-warming and cleanup
   */
  async stop(): Promise<void> {
    if (this.prewarmInterval) {
      clearInterval(this.prewarmInterval);
      this.prewarmInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all browsers
    for (const [_, pool] of this.pool) {
      for (const browser of pool) {
        await this.closeBrowser(browser);
      }
    }

    this.pool.clear();
    console.log('Browser pre-warmer stopped');
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    poolSize: { [key: string]: number };
    inUse: { [key: string]: number };
    avgStartupTime: { [key: string]: number };
  } {
    const stats = {
      poolSize: {} as { [key: string]: number },
      inUse: {} as { [key: string]: number },
      avgStartupTime: {} as { [key: string]: number },
    };

    for (const [browserType, pool] of this.pool) {
      stats.poolSize[browserType] = pool.length;
      stats.inUse[browserType] = pool.filter(b => b.inUse).length;
      stats.avgStartupTime[browserType] = this.getAverageStartupTime(browserType as BrowserType);
    }

    return stats;
  }
}

// Singleton instance for global pre-warming
let globalPrewarmer: BrowserPrewarmer | null = null;

export function getGlobalPrewarmer(): BrowserPrewarmer {
  if (!globalPrewarmer) {
    globalPrewarmer = new BrowserPrewarmer();
  }
  return globalPrewarmer;
}

export async function startGlobalPrewarming(options?: LaunchOptions): Promise<void> {
  const prewarmer = getGlobalPrewarmer();
  await prewarmer.startPrewarming(options);
}

export async function stopGlobalPrewarming(): Promise<void> {
  if (globalPrewarmer) {
    await globalPrewarmer.stop();
    globalPrewarmer = null;
  }
}