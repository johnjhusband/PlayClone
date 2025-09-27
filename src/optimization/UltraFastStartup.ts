import { Browser, BrowserContext, Page, chromium, firefox, webkit } from 'playwright';
import { Logger } from '../utils/Logger';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as cluster from 'cluster';
import { Worker } from 'worker_threads';

interface StartupConfig {
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
}

interface BrowserPoolEntry {
  browser: Browser;
  contexts: BrowserContext[];
  lastUsed: number;
  id: string;
  ready: boolean;
}

interface StartupMetrics {
  coldStartTime: number;
  warmStartTime: number;
  averageStartTime: number;
  poolHitRate: number;
  contextsReused: number;
  totalStarts: number;
}

export class UltraFastStartup extends EventEmitter {
  private logger: Logger;
  private config: StartupConfig;
  private browserPool: Map<string, BrowserPoolEntry>;
  private contextQueue: BrowserContext[];
  private metrics: StartupMetrics;
  private prewarmTimer: NodeJS.Timeout | null;
  private connectionCache: Map<string, any>;
  private workerPool: Worker[];
  private isPrewarming: boolean;
  private startupOptimizations: Map<string, boolean>;
  private lazyModules: Map<string, () => Promise<any>>;

  constructor(config: StartupConfig = {}) {
    super();
    this.logger = new Logger('UltraFastStartup');
    this.config = {
      prewarmCount: 3,
      maxPoolSize: 10,
      idleTimeout: 300000, // 5 minutes
      lazyLoad: true,
      useWorkerThreads: true,
      cacheConnections: true,
      browserType: 'chromium',
      headless: true,
      reuseContexts: true,
      persistentCache: true,
      compressionEnabled: true,
      ...config
    };

    this.browserPool = new Map();
    this.contextQueue = [];
    this.connectionCache = new Map();
    this.workerPool = [];
    this.isPrewarming = false;
    this.startupOptimizations = new Map();
    this.lazyModules = new Map();
    this.prewarmTimer = null;

    this.metrics = {
      coldStartTime: 0,
      warmStartTime: 0,
      averageStartTime: 0,
      poolHitRate: 0,
      contextsReused: 0,
      totalStarts: 0
    };

    this.initializeOptimizations();
  }

  private initializeOptimizations(): void {
    // Register startup optimizations
    this.startupOptimizations.set('disableImages', true);
    this.startupOptimizations.set('disableFonts', false);
    this.startupOptimizations.set('disableCSS', false);
    this.startupOptimizations.set('blockAds', true);
    this.startupOptimizations.set('skipResourceLoad', true);
    this.startupOptimizations.set('useCache', true);
    this.startupOptimizations.set('compressData', true);

    // Register lazy-loadable modules
    this.lazyModules.set('pdfGenerator', async () => {
      const module = await import('../extraction/PdfGenerator');
      return module.PdfGenerator;
    });

    this.lazyModules.set('dataExtractor', async () => {
      const module = await import('../extraction/DataExtractionTemplates');
      return module.DataExtractionTemplates;
    });

    this.lazyModules.set('aiIntegration', async () => {
      // AI integration module would be loaded here
      return null;
    });
  }

  async initialize(): Promise<void> {
    const startTime = Date.now();

    try {
      // Start prewarming in parallel
      const prewarmPromise = this.prewarmBrowsers();

      // Initialize worker threads if enabled
      if (this.config.useWorkerThreads) {
        await this.initializeWorkers();
      }

      // Load essential modules only
      await this.loadEssentialModules();

      // Wait for prewarming to complete
      await prewarmPromise;

      const initTime = Date.now() - startTime;
      this.logger.info(`Ultra-fast initialization complete in ${initTime}ms`);

      // Start periodic prewarming
      this.startPeriodicPrewarming();

      this.emit('initialized', { time: initTime });
    } catch (error) {
      this.logger.error('Initialization failed:', error);
      throw error;
    }
  }

  private async prewarmBrowsers(): Promise<void> {
    if (this.isPrewarming) return;
    this.isPrewarming = true;

    const promises: Promise<void>[] = [];
    const count = Math.min(this.config.prewarmCount!, this.config.maxPoolSize!);

    for (let i = 0; i < count; i++) {
      promises.push(this.createPrewarmedBrowser());
    }

    await Promise.all(promises);
    this.isPrewarming = false;
  }

  private async createPrewarmedBrowser(): Promise<void> {
    const startTime = Date.now();
    const id = `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Launch browser with optimizations
      const browser = await this.launchOptimizedBrowser();

      // Create initial contexts
      const contexts: BrowserContext[] = [];
      if (this.config.reuseContexts) {
        for (let i = 0; i < 2; i++) {
          const context = await this.createOptimizedContext(browser);
          contexts.push(context);
          this.contextQueue.push(context);
        }
      }

      const entry: BrowserPoolEntry = {
        browser,
        contexts,
        lastUsed: Date.now(),
        id,
        ready: true
      };

      this.browserPool.set(id, entry);

      const prewarmTime = Date.now() - startTime;
      this.logger.debug(`Prewarmed browser ${id} in ${prewarmTime}ms`);
      this.emit('browserPrewarmed', { id, time: prewarmTime });
    } catch (error) {
      this.logger.error(`Failed to prewarm browser ${id}:`, error);
    }
  }

  private async launchOptimizedBrowser(): Promise<Browser> {
    const browserType = this.getBrowserType();
    
    const args = [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-features=TranslateUI',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--no-default-browser-check',
      '--password-store=basic',
      '--use-mock-keychain',
      '--disable-features=PasswordLeakDetection'
    ];

    if (this.startupOptimizations.get('disableImages')) {
      args.push('--disable-images');
    }

    const browser = await browserType.launch({
      headless: this.config.headless,
      args,
      ignoreDefaultArgs: ['--enable-automation'],
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false
    });

    return browser;
  }

  private async createOptimizedContext(browser: Browser): Promise<BrowserContext> {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ignoreHTTPSErrors: true,
      bypassCSP: true,
      offline: false,
      javaScriptEnabled: true,
      permissions: [],
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    // Apply optimizations
    if (this.startupOptimizations.get('blockAds')) {
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (this.shouldBlockRequest(url)) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }

    return context;
  }

  private shouldBlockRequest(url: string): boolean {
    const blockPatterns = [
      /doubleclick\.net/,
      /googletagmanager\.com/,
      /google-analytics\.com/,
      /facebook\.com\/tr/,
      /amazon-adsystem\.com/,
      /googlesyndication\.com/,
      /adnxs\.com/,
      /adsystem\.com/,
      /advertising\.com/,
      /ads\./,
      /\.ads\./
    ];

    return blockPatterns.some(pattern => pattern.test(url));
  }

  async getFastBrowser(): Promise<{ browser: Browser; context: BrowserContext; metrics: any }> {
    const startTime = Date.now();
    this.metrics.totalStarts++;

    try {
      // Try to get from pool first
      if (this.contextQueue.length > 0) {
        const context = this.contextQueue.shift()!;
        const browser = context.browser();
        
        if (!browser) {
          // Context's browser was closed, remove it and try again
          return this.getFastBrowser();
        }
        
        const warmStartTime = Date.now() - startTime;
        this.metrics.warmStartTime = warmStartTime;
        this.metrics.contextsReused++;
        this.updateMetrics();

        this.logger.debug(`Warm start in ${warmStartTime}ms`);
        return {
          browser,
          context,
          metrics: {
            startTime: warmStartTime,
            type: 'warm',
            poolSize: this.browserPool.size,
            contextQueueSize: this.contextQueue.length
          }
        };
      }

      // Check browser pool
      for (const [id, entry] of this.browserPool.entries()) {
        if (entry.ready && entry.contexts.length < 5) {
          const context = await this.createOptimizedContext(entry.browser);
          entry.contexts.push(context);
          entry.lastUsed = Date.now();

          const poolStartTime = Date.now() - startTime;
          this.metrics.warmStartTime = poolStartTime;
          this.updateMetrics();

          return {
            browser: entry.browser,
            context,
            metrics: {
              startTime: poolStartTime,
              type: 'pool',
              poolSize: this.browserPool.size,
              contextQueueSize: this.contextQueue.length
            }
          };
        }
      }

      // Cold start - create new browser
      const browser = await this.launchOptimizedBrowser();
      const context = await this.createOptimizedContext(browser);

      const coldStartTime = Date.now() - startTime;
      this.metrics.coldStartTime = coldStartTime;
      this.updateMetrics();

      // Add to pool if space available
      if (this.browserPool.size < this.config.maxPoolSize!) {
        const id = `browser-${Date.now()}`;
        this.browserPool.set(id, {
          browser,
          contexts: [context],
          lastUsed: Date.now(),
          id,
          ready: true
        });
      }

      this.logger.info(`Cold start in ${coldStartTime}ms`);
      return {
        browser,
        context,
        metrics: {
          startTime: coldStartTime,
          type: 'cold',
          poolSize: this.browserPool.size,
          contextQueueSize: this.contextQueue.length
        }
      };
    } catch (error) {
      this.logger.error('Failed to get fast browser:', error);
      throw error;
    }
  }

  private updateMetrics(): void {
    const totalTime = this.metrics.coldStartTime * 0.3 + this.metrics.warmStartTime * 0.7;
    this.metrics.averageStartTime = Math.round(totalTime);
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

  private async initializeWorkers(): Promise<void> {
    if (!this.config.useWorkerThreads) return;

    const workerCount = Math.min(4, os.cpus().length);
    for (let i = 0; i < workerCount; i++) {
      // Workers would be created here if needed
      // For now, we'll use the main thread
    }
  }

  private async loadEssentialModules(): Promise<void> {
    // Load only the most essential modules at startup
    // Other modules are lazy-loaded when needed
  }

  async loadModule(name: string): Promise<any> {
    if (!this.config.lazyLoad) {
      return null;
    }

    const loader = this.lazyModules.get(name);
    if (loader) {
      const startTime = Date.now();
      const module = await loader();
      const loadTime = Date.now() - startTime;
      this.logger.debug(`Lazy loaded ${name} in ${loadTime}ms`);
      return module;
    }

    return null;
  }

  private startPeriodicPrewarming(): void {
    if (this.prewarmTimer) {
      clearInterval(this.prewarmTimer);
    }

    this.prewarmTimer = setInterval(async () => {
      await this.cleanupIdleBrowsers();
      await this.prewarmBrowsers();
    }, 60000); // Every minute
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

  async optimizeForAI(): Promise<any> {
    return {
      recommendations: [
        'Use headless mode for faster startup',
        'Enable context reuse for warm starts',
        'Prewarm browsers during idle time',
        'Use worker threads for parallel operations',
        'Cache connections for repeated sites',
        'Disable unnecessary features (images, fonts)',
        'Use compression for data transfer'
      ],
      currentOptimizations: Array.from(this.startupOptimizations.entries())
        .filter(([_, enabled]) => enabled)
        .map(([name]) => name),
      metrics: this.getMetrics(),
      estimatedStartupTime: this.metrics.averageStartTime || 500
    };
  }

  getMetrics(): StartupMetrics {
    return { ...this.metrics };
  }

  async benchmark(): Promise<any> {
    const results = {
      coldStarts: [] as number[],
      warmStarts: [] as number[],
      poolHits: [] as number[]
    };

    // Benchmark cold starts
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      const browser = await this.launchOptimizedBrowser();
      const context = await this.createOptimizedContext(browser);
      results.coldStarts.push(Date.now() - startTime);
      await browser.close();
    }

    // Benchmark warm starts
    await this.prewarmBrowsers();
    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();
      const { browser, context } = await this.getFastBrowser();
      results.warmStarts.push(Date.now() - startTime);
    }

    const avgCold = results.coldStarts.reduce((a, b) => a + b, 0) / results.coldStarts.length;
    const avgWarm = results.warmStarts.reduce((a, b) => a + b, 0) / results.warmStarts.length;

    return {
      averageColdStart: Math.round(avgCold),
      averageWarmStart: Math.round(avgWarm),
      improvement: `${Math.round((1 - avgWarm / avgCold) * 100)}%`,
      targetMet: avgWarm < 500,
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
    this.connectionCache.clear();
    this.logger.info('Ultra-fast startup shutdown complete');
  }
}