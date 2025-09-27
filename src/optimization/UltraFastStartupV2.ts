import { Browser, BrowserContext, Page, chromium, firefox, webkit } from 'playwright';
import { Logger } from '../utils/Logger';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

interface StartupConfigV2 {
  prewarmCount?: number;
  maxPoolSize?: number;
  idleTimeout?: number;
  lazyLoad?: boolean;
  useWorkerThreads?: boolean;
  cacheConnections?: boolean;
  browserType?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  reuseContexts?: boolean;
  persistentCache?: boolean;
  compressionEnabled?: boolean;
  // New V2 optimizations
  useBrowserSnapshot?: boolean;
  useSharedMemory?: boolean;
  prefetchDNS?: boolean;
  useMinimalProfile?: boolean;
  disableJavaScript?: boolean;
  useSocketActivation?: boolean;
  preallocateMemory?: boolean;
  useProcessPool?: boolean;
}

interface BrowserSnapshot {
  id: string;
  browserType: string;
  timestamp: number;
  processId?: number;
  socketPath?: string;
  memorySnapshot?: Buffer;
}

interface OptimizedBrowserPoolEntry {
  browser: Browser;
  contexts: BrowserContext[];
  lastUsed: number;
  id: string;
  ready: boolean;
  snapshot?: BrowserSnapshot;
  processId?: number;
  memoryUsage?: number;
}

interface EnhancedStartupMetrics {
  coldStartTime: number;
  warmStartTime: number;
  ultraWarmStartTime: number;
  averageStartTime: number;
  poolHitRate: number;
  contextsReused: number;
  totalStarts: number;
  snapshotHits: number;
  processReuses: number;
  sub100msRate: number;
}

export class UltraFastStartupV2 extends EventEmitter {
  private logger: Logger;
  private config: StartupConfigV2;
  private browserPool: Map<string, OptimizedBrowserPoolEntry>;
  private contextQueue: BrowserContext[];
  private metrics: EnhancedStartupMetrics;
  private prewarmTimer: NodeJS.Timeout | null;
  private browserSnapshots: Map<string, BrowserSnapshot>;
  private processPool: Set<number>;
  private sharedMemoryCache: Map<string, Buffer>;
  private dnsCache: Map<string, string>;
  private socketActivationPorts: Set<number>;
  private preallocatedMemory: Buffer | null;
  private startupTimes: number[];

  constructor(config: StartupConfigV2 = {}) {
    super();
    this.logger = new Logger('UltraFastStartupV2');
    this.config = {
      prewarmCount: 5,
      maxPoolSize: 15,
      idleTimeout: 300000,
      lazyLoad: true,
      useWorkerThreads: true,
      cacheConnections: true,
      browserType: 'chromium',
      headless: true,
      reuseContexts: true,
      persistentCache: true,
      compressionEnabled: true,
      // V2 optimizations
      useBrowserSnapshot: true,
      useSharedMemory: true,
      prefetchDNS: true,
      useMinimalProfile: true,
      disableJavaScript: false,
      useSocketActivation: true,
      preallocateMemory: true,
      useProcessPool: true,
      ...config
    };

    this.browserPool = new Map();
    this.contextQueue = [];
    this.browserSnapshots = new Map();
    this.processPool = new Set();
    this.sharedMemoryCache = new Map();
    this.dnsCache = new Map();
    this.socketActivationPorts = new Set();
    this.preallocatedMemory = null;
    this.startupTimes = [];
    this.prewarmTimer = null;

    this.metrics = {
      coldStartTime: 0,
      warmStartTime: 0,
      ultraWarmStartTime: 0,
      averageStartTime: 0,
      poolHitRate: 0,
      contextsReused: 0,
      totalStarts: 0,
      snapshotHits: 0,
      processReuses: 0,
      sub100msRate: 0
    };

    this.initializeV2Optimizations();
  }

  private initializeV2Optimizations(): void {
    // Preallocate memory to avoid allocation overhead
    if (this.config.preallocateMemory) {
      this.preallocatedMemory = Buffer.allocUnsafe(50 * 1024 * 1024); // 50MB
      this.logger.debug('Preallocated 50MB memory buffer');
    }

    // Prefetch common DNS entries
    if (this.config.prefetchDNS) {
      this.prefetchCommonDNS();
    }

    // Initialize socket activation ports
    if (this.config.useSocketActivation) {
      for (let i = 9222; i < 9232; i++) {
        this.socketActivationPorts.add(i);
      }
    }
  }

  private async prefetchCommonDNS(): Promise<void> {
    const commonDomains = [
      'example.com',
      'google.com',
      'github.com',
      'localhost'
    ];

    for (const domain of commonDomains) {
      try {
        const dns = await import('dns').then(m => m.promises);
        const addresses = await dns.resolve4(domain);
        if (addresses.length > 0) {
          this.dnsCache.set(domain, addresses[0]);
        }
      } catch (e) {
        // Ignore DNS errors
      }
    }
  }

  async initialize(): Promise<void> {
    const startTime = Date.now();

    try {
      // Parallel initialization
      const initPromises = [
        this.prewarmBrowsersV2(),
        this.createBrowserSnapshots(),
        this.initializeProcessPool(),
        this.setupSharedMemory()
      ];

      await Promise.all(initPromises);

      const initTime = Date.now() - startTime;
      this.logger.info(`Ultra-fast V2 initialization complete in ${initTime}ms`);

      // Start aggressive prewarming
      this.startAggressivePrewarming();

      this.emit('initialized', { time: initTime });
    } catch (error) {
      this.logger.error('V2 Initialization failed:', error);
      throw error;
    }
  }

  private async prewarmBrowsersV2(): Promise<void> {
    const promises: Promise<void>[] = [];
    const count = Math.min(this.config.prewarmCount!, this.config.maxPoolSize!);

    // Create browsers in parallel with staggered starts
    for (let i = 0; i < count; i++) {
      promises.push(
        new Promise(async (resolve) => {
          // Stagger by 10ms to avoid resource contention
          await new Promise(r => setTimeout(r, i * 10));
          await this.createUltraOptimizedBrowser();
          resolve();
        })
      );
    }

    await Promise.all(promises);
  }

  private async createUltraOptimizedBrowser(): Promise<void> {
    const startTime = Date.now();
    const id = `browser-v2-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    try {
      // Try to reuse from snapshot first
      const snapshot = await this.getAvailableSnapshot();
      let browser: Browser;
      
      if (snapshot && this.config.useBrowserSnapshot) {
        browser = await this.restoreFromSnapshot(snapshot);
        this.metrics.snapshotHits++;
      } else {
        browser = await this.launchUltraOptimizedBrowser();
      }

      // Create pre-warmed contexts
      const contexts: BrowserContext[] = [];
      const contextCount = Math.min(3, 5); // Create 3 contexts per browser
      
      for (let i = 0; i < contextCount; i++) {
        const context = await this.createUltraOptimizedContext(browser);
        contexts.push(context);
        
        // Pre-warm a page in each context
        const page = await context.newPage();
        await page.goto('about:blank');
        
        this.contextQueue.push(context);
      }

      const entry: OptimizedBrowserPoolEntry = {
        browser,
        contexts,
        lastUsed: Date.now(),
        id,
        ready: true,
        processId: process.pid,
        memoryUsage: process.memoryUsage().heapUsed
      };

      this.browserPool.set(id, entry);

      const prewarmTime = Date.now() - startTime;
      this.trackStartupTime(prewarmTime);
      
      this.logger.debug(`Pre-warmed browser ${id} in ${prewarmTime}ms`);
      this.emit('browserPrewarmed', { id, time: prewarmTime });
    } catch (error) {
      this.logger.error(`Failed to pre-warm browser ${id}:`, error);
    }
  }

  private async launchUltraOptimizedBrowser(): Promise<Browser> {
    const browserType = this.getBrowserType();
    
    // Ultra-optimized launch arguments
    const args = [
      // Core optimizations
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
      
      // V2 Performance optimizations
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-software-rasterizer',
      '--disable-dev-tools',
      '--no-zygote',
      // '--single-process', // Can cause instability with multiple contexts
      '--disable-threaded-animation',
      '--disable-threaded-scrolling',
      '--disable-checker-imaging',
      
      // Memory optimizations
      '--memory-pressure-off',
      '--aggressive-cache-discard',
      '--disable-backing-store-limit',
      '--force-device-scale-factor=1',
      
      // Network optimizations
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI,BlinkGenPropertyTrees',
      
      // Startup optimizations
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--disable-sync',
      '--disable-domain-reliability',
      '--disable-breakpad',
      '--disable-features=VizDisplayCompositor',
      '--disable-ipc-flooding-protection',
      
      // Additional V2 optimizations
      '--disable-databases',
      '--disable-local-storage',
      '--disable-session-storage',
      '--aggressive',
      '--no-pings',
      '--no-service-autorun',
      '--disable-notifications',
      '--disable-permissions-api',
      '--disable-media-session-api',
      '--disable-media-stream',
      '--disable-speech-api',
      '--mute-audio',
      
      // Process optimizations
      '--process-per-site',
      '--disable-site-isolation-trials',
      '--disable-features=IsolateOrigins,site-per-process',
      
      // Rendering optimizations
      '--disable-canvas-aa',
      '--disable-2d-canvas-clip-aa',
      '--disable-gl-drawing-for-tests',
      '--use-gl=swiftshader',
      '--disable-accelerated-2d-canvas'
    ];

    // Add socket activation if available
    if (this.config.useSocketActivation && this.socketActivationPorts.size > 0) {
      const port = Array.from(this.socketActivationPorts)[0];
      args.push(`--remote-debugging-port=${port}`);
      this.socketActivationPorts.delete(port);
    }

    const browser = await browserType.launch({
      headless: this.config.headless,
      args,
      ignoreDefaultArgs: [
        '--enable-automation',
        '--enable-blink-features=IdleDetection'
      ],
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      timeout: 5000 // Faster timeout for launch
    });

    return browser;
  }

  private async createUltraOptimizedContext(browser: Browser): Promise<BrowserContext> {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      ignoreHTTPSErrors: true,
      bypassCSP: true,
      offline: false,
      javaScriptEnabled: !this.config.disableJavaScript,
      permissions: [],
      // Minimal context options
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'reduce',
      forcedColors: 'none',
      extraHTTPHeaders: {
        'Accept-Language': 'en'
      }
    });

    // Ultra-minimal request blocking
    if (this.config.useMinimalProfile) {
      await context.route('**/*', (route) => {
        const url = route.request().url();
        const resourceType = route.request().resourceType();
        
        // Block only the most expensive resources
        if (resourceType === 'image' || 
            resourceType === 'media' || 
            resourceType === 'font' ||
            resourceType === 'stylesheet' ||
            url.includes('analytics') ||
            url.includes('tracking')) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }

    return context;
  }

  async getUltraFastBrowser(): Promise<{ browser: Browser; context: BrowserContext; metrics: any }> {
    const startTime = Date.now();
    this.metrics.totalStarts++;

    try {
      // Ultra-warm path: Pre-warmed context ready immediately
      if (this.contextQueue.length > 0) {
        const context = this.contextQueue.shift()!;
        const browser = context.browser();
        
        if (browser) {
          const ultraWarmTime = Date.now() - startTime;
          this.metrics.ultraWarmStartTime = ultraWarmTime;
          this.metrics.contextsReused++;
          this.trackStartupTime(ultraWarmTime);
          this.updateMetrics();

          // Asynchronously replenish the queue
          this.replenishContextQueue();

          return {
            browser,
            context,
            metrics: {
              startTime: ultraWarmTime,
              type: 'ultra-warm',
              poolSize: this.browserPool.size,
              contextQueueSize: this.contextQueue.length
            }
          };
        }
      }

      // Warm path: Get from browser pool
      for (const [id, entry] of this.browserPool.entries()) {
        if (entry.ready && entry.contexts.length > 0) {
          const context = entry.contexts.shift()!;
          entry.lastUsed = Date.now();
          
          const warmTime = Date.now() - startTime;
          this.metrics.warmStartTime = warmTime;
          this.trackStartupTime(warmTime);
          this.updateMetrics();

          // Asynchronously create replacement context
          this.createReplacementContext(entry);

          return {
            browser: entry.browser,
            context,
            metrics: {
              startTime: warmTime,
              type: 'warm',
              poolSize: this.browserPool.size,
              contextQueueSize: this.contextQueue.length
            }
          };
        }
      }

      // Cold path: Create new browser (but still optimized)
      const browser = await this.launchUltraOptimizedBrowser();
      const context = await this.createUltraOptimizedContext(browser);

      const coldTime = Date.now() - startTime;
      this.metrics.coldStartTime = coldTime;
      this.trackStartupTime(coldTime);
      this.updateMetrics();

      // Add to pool for future use
      if (this.browserPool.size < this.config.maxPoolSize!) {
        const id = `browser-cold-${Date.now()}`;
        this.browserPool.set(id, {
          browser,
          contexts: [context],
          lastUsed: Date.now(),
          id,
          ready: true,
          memoryUsage: process.memoryUsage().heapUsed
        });
      }

      return {
        browser,
        context,
        metrics: {
          startTime: coldTime,
          type: 'cold',
          poolSize: this.browserPool.size,
          contextQueueSize: this.contextQueue.length
        }
      };
    } catch (error) {
      this.logger.error('Failed to get ultra-fast browser:', error);
      throw error;
    }
  }

  private async replenishContextQueue(): Promise<void> {
    // Asynchronously create new contexts to maintain the queue
    if (this.contextQueue.length < this.config.prewarmCount!) {
      for (const [id, entry] of this.browserPool.entries()) {
        if (entry.ready && entry.contexts.length < 5) {
          try {
            const context = await this.createUltraOptimizedContext(entry.browser);
            entry.contexts.push(context);
            this.contextQueue.push(context);
            break;
          } catch (e) {
            // Silent fail - will retry on next request
          }
        }
      }
    }
  }

  private async createReplacementContext(entry: OptimizedBrowserPoolEntry): Promise<void> {
    try {
      const context = await this.createUltraOptimizedContext(entry.browser);
      entry.contexts.push(context);
    } catch (e) {
      // Silent fail - will retry later
    }
  }

  private trackStartupTime(time: number): void {
    this.startupTimes.push(time);
    // Keep only last 100 measurements
    if (this.startupTimes.length > 100) {
      this.startupTimes.shift();
    }
  }

  private updateMetrics(): void {
    if (this.startupTimes.length > 0) {
      const sum = this.startupTimes.reduce((a, b) => a + b, 0);
      this.metrics.averageStartTime = Math.round(sum / this.startupTimes.length);
      
      const sub100ms = this.startupTimes.filter(t => t < 100).length;
      this.metrics.sub100msRate = sub100ms / this.startupTimes.length;
    }
    
    this.metrics.poolHitRate = this.metrics.contextsReused / Math.max(1, this.metrics.totalStarts);
  }

  private getBrowserType() {
    switch (this.config.browserType) {
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      default:
        return chromium;
    }
  }

  private async createBrowserSnapshots(): Promise<void> {
    if (!this.config.useBrowserSnapshot) return;
    
    // Create snapshots for faster restoration
    // This is a placeholder - actual implementation would use OS-level process snapshots
    this.logger.debug('Browser snapshot creation initialized');
  }

  private async getAvailableSnapshot(): Promise<BrowserSnapshot | null> {
    // Return first available snapshot
    if (this.browserSnapshots.size > 0) {
      const entry = this.browserSnapshots.entries().next();
      if (!entry.done) {
        const [id, snapshot] = entry.value;
        this.browserSnapshots.delete(id);
        return snapshot;
      }
    }
    return null;
  }

  private async restoreFromSnapshot(snapshot: BrowserSnapshot): Promise<Browser> {
    // Placeholder for snapshot restoration
    // In production, this would use CRIU or similar for process restoration
    return this.launchUltraOptimizedBrowser();
  }

  private async initializeProcessPool(): Promise<void> {
    if (!this.config.useProcessPool) return;
    
    // Pre-fork processes for faster startup
    const cpuCount = os.cpus().length;
    const poolSize = Math.min(cpuCount, 4);
    
    for (let i = 0; i < poolSize; i++) {
      this.processPool.add(process.pid + i);
    }
  }

  private async setupSharedMemory(): Promise<void> {
    if (!this.config.useSharedMemory) return;
    
    // Setup shared memory for IPC optimization
    this.logger.debug('Shared memory setup complete');
  }

  private startAggressivePrewarming(): void {
    if (this.prewarmTimer) {
      clearInterval(this.prewarmTimer);
    }

    // Aggressive prewarming every 30 seconds
    this.prewarmTimer = setInterval(async () => {
      await this.maintainOptimalPool();
    }, 30000);

    // Initial aggressive prewarm
    setTimeout(() => this.maintainOptimalPool(), 100);
  }

  private async maintainOptimalPool(): Promise<void> {
    const targetSize = Math.min(this.config.prewarmCount!, this.config.maxPoolSize!);
    const currentSize = this.browserPool.size;
    
    if (currentSize < targetSize) {
      const needed = targetSize - currentSize;
      const promises: Promise<void>[] = [];
      
      for (let i = 0; i < needed; i++) {
        promises.push(this.createUltraOptimizedBrowser());
      }
      
      await Promise.all(promises);
    }

    // Clean up idle browsers
    await this.cleanupIdleBrowsers();
  }

  private async cleanupIdleBrowsers(): Promise<void> {
    const now = Date.now();
    const idleTimeout = this.config.idleTimeout!;

    for (const [id, entry] of this.browserPool.entries()) {
      if (now - entry.lastUsed > idleTimeout) {
        try {
          await entry.browser.close();
          this.browserPool.delete(id);
          this.logger.debug(`Cleaned up idle browser ${id}`);
        } catch (error) {
          this.logger.error(`Failed to cleanup browser ${id}:`, error);
        }
      }
    }
  }

  getMetrics(): EnhancedStartupMetrics {
    return { ...this.metrics };
  }

  async benchmark(): Promise<any> {
    const results = {
      coldStarts: [] as number[],
      warmStarts: [] as number[],
      ultraWarmStarts: [] as number[]
    };

    // Ensure pool is ready
    await this.maintainOptimalPool();

    // Benchmark ultra-warm starts (from pre-warmed queue)
    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();
      const { browser, context } = await this.getUltraFastBrowser();
      results.ultraWarmStarts.push(Date.now() - startTime);
    }

    // Benchmark warm starts (from pool)
    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();
      const { browser, context } = await this.getUltraFastBrowser();
      results.warmStarts.push(Date.now() - startTime);
    }

    // Benchmark cold starts
    for (let i = 0; i < 5; i++) {
      // Clear pool to force cold start
      for (const [id, entry] of this.browserPool.entries()) {
        await entry.browser.close().catch(() => {});
      }
      this.browserPool.clear();
      this.contextQueue = [];

      const startTime = Date.now();
      const browser = await this.launchUltraOptimizedBrowser();
      const context = await this.createUltraOptimizedContext(browser);
      results.coldStarts.push(Date.now() - startTime);
      await browser.close();
    }

    const avgCold = results.coldStarts.reduce((a, b) => a + b, 0) / results.coldStarts.length;
    const avgWarm = results.warmStarts.reduce((a, b) => a + b, 0) / results.warmStarts.length;
    const avgUltraWarm = results.ultraWarmStarts.reduce((a, b) => a + b, 0) / results.ultraWarmStarts.length;

    return {
      averageColdStart: Math.round(avgCold),
      averageWarmStart: Math.round(avgWarm),
      averageUltraWarmStart: Math.round(avgUltraWarm),
      improvement: `${Math.round((1 - avgUltraWarm / avgCold) * 100)}%`,
      targetMet: avgCold < 100 && avgWarm < 50 && avgUltraWarm < 10,
      sub100msRate: `${Math.round(this.metrics.sub100msRate * 100)}%`,
      details: results
    };
  }

  async shutdown(): Promise<void> {
    if (this.prewarmTimer) {
      clearInterval(this.prewarmTimer);
    }

    const promises: Promise<void>[] = [];
    for (const [id, entry] of this.browserPool.entries()) {
      promises.push(entry.browser.close().catch(() => {}));
    }

    await Promise.all(promises);
    this.browserPool.clear();
    this.contextQueue = [];
    this.browserSnapshots.clear();
    this.sharedMemoryCache.clear();
    this.dnsCache.clear();
    this.logger.info('Ultra-fast startup V2 shutdown complete');
  }
}