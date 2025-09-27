/**
 * FallbackStrategyManager - Manages fallback strategies for external dependencies
 * 
 * This module provides resilience when external services are unavailable:
 * - CDN failures (browser binaries, assets)
 * - API service failures (Vision APIs, Auth providers)
 * - Network service failures (DNS, proxy)
 * - Database failures (Redis, storage)
 * - External tool failures (GraphQL, WebSocket servers)
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '../utils/Logger';

interface FallbackStrategy {
  name: string;
  type: 'cdn' | 'api' | 'network' | 'database' | 'tool';
  primary: () => Promise<any>;
  fallbacks: Array<() => Promise<any>>;
  validate?: (result: any) => boolean;
  cache?: boolean;
  timeout?: number;
  retryCount?: number;
}

interface FallbackResult {
  success: boolean;
  data?: any;
  strategy: string;
  attempts: number;
  duration: number;
  error?: Error;
}

export class FallbackStrategyManager extends EventEmitter {
  private strategies: Map<string, FallbackStrategy> = new Map();
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private metrics: Map<string, { success: number; failures: number; fallbackUsage: number }> = new Map();
  private readonly logger = new Logger('FallbackStrategyManager');
  private readonly cacheDir: string;
  private readonly maxCacheAge = 3600000; // 1 hour

  constructor() {
    super();
    this.cacheDir = path.join(process.cwd(), '.playclone-cache');
    this.ensureCacheDirectory();
    this.registerDefaultStrategies();
  }

  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Register default fallback strategies for common external dependencies
   */
  private registerDefaultStrategies(): void {
    // Browser binary CDN fallback
    this.registerStrategy({
      name: 'browser-binaries',
      type: 'cdn',
      primary: async () => {
        // Primary: Official Playwright CDN
        return await this.downloadFromCDN('https://playwright.azureedge.net');
      },
      fallbacks: [
        async () => {
          // Fallback 1: GitHub releases
          return await this.downloadFromCDN('https://github.com/microsoft/playwright/releases');
        },
        async () => {
          // Fallback 2: Local cache
          return await this.loadFromLocalCache('browser-binaries');
        },
        async () => {
          // Fallback 3: System-installed browsers
          return await this.useSystemBrowsers();
        }
      ],
      cache: true,
      timeout: 30000
    });

    // Vision API fallback
    this.registerStrategy({
      name: 'vision-api',
      type: 'api',
      primary: async () => {
        // Primary: GPT-4 Vision or Claude Vision
        return await this.callVisionAPI();
      },
      fallbacks: [
        async () => {
          // Fallback 1: DOM-based analysis
          return await this.domBasedVisionAnalysis();
        },
        async () => {
          // Fallback 2: Accessibility tree analysis
          return await this.accessibilityTreeAnalysis();
        },
        async () => {
          // Fallback 3: Basic screenshot with OCR simulation
          return await this.simulatedOCR();
        }
      ],
      cache: false,
      timeout: 10000
    });

    // Redis/Database fallback
    this.registerStrategy({
      name: 'session-store',
      type: 'database',
      primary: async () => {
        // Primary: Redis
        return await this.connectToRedis();
      },
      fallbacks: [
        async () => {
          // Fallback 1: In-memory store
          return await this.useInMemoryStore();
        },
        async () => {
          // Fallback 2: File-based store
          return await this.useFileStore();
        },
        async () => {
          // Fallback 3: SQLite
          return await this.useSQLiteStore();
        }
      ],
      cache: false,
      timeout: 5000
    });

    // DNS fallback
    this.registerStrategy({
      name: 'dns-resolution',
      type: 'network',
      primary: async () => {
        // Primary: System DNS
        return await this.systemDNS();
      },
      fallbacks: [
        async () => {
          // Fallback 1: DNS over HTTPS (Cloudflare)
          return await this.dnsOverHTTPS('1.1.1.1');
        },
        async () => {
          // Fallback 2: DNS over HTTPS (Google)
          return await this.dnsOverHTTPS('8.8.8.8');
        },
        async () => {
          // Fallback 3: Cached DNS entries
          return await this.cachedDNS();
        }
      ],
      cache: true,
      timeout: 3000
    });

    // Authentication provider fallback
    this.registerStrategy({
      name: 'auth-provider',
      type: 'api',
      primary: async () => {
        // Primary: SAML/OAuth provider
        return await this.externalAuthProvider();
      },
      fallbacks: [
        async () => {
          // Fallback 1: Mock auth for testing
          return await this.mockAuthProvider();
        },
        async () => {
          // Fallback 2: Basic auth
          return await this.basicAuthProvider();
        },
        async () => {
          // Fallback 3: Local user store
          return await this.localUserStore();
        }
      ],
      cache: false,
      timeout: 10000
    });

    // WebSocket server fallback
    this.registerStrategy({
      name: 'websocket-server',
      type: 'tool',
      primary: async () => {
        // Primary: WebSocket connection
        return await this.connectWebSocket();
      },
      fallbacks: [
        async () => {
          // Fallback 1: Long polling
          return await this.useLongPolling();
        },
        async () => {
          // Fallback 2: Server-sent events
          return await this.useServerSentEvents();
        },
        async () => {
          // Fallback 3: Periodic polling
          return await this.usePolling();
        }
      ],
      cache: false,
      timeout: 5000
    });

    // Package registry fallback
    this.registerStrategy({
      name: 'package-registry',
      type: 'cdn',
      primary: async () => {
        // Primary: NPM registry
        return await this.fetchFromNPM();
      },
      fallbacks: [
        async () => {
          // Fallback 1: Yarn registry
          return await this.fetchFromYarn();
        },
        async () => {
          // Fallback 2: GitHub packages
          return await this.fetchFromGitHub();
        },
        async () => {
          // Fallback 3: Local cache
          return await this.loadFromLocalCache('packages');
        }
      ],
      cache: true,
      timeout: 15000
    });
  }

  /**
   * Register a custom fallback strategy
   */
  registerStrategy(strategy: FallbackStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.metrics.set(strategy.name, { success: 0, failures: 0, fallbackUsage: 0 });
    this.logger.info(`Registered fallback strategy: ${strategy.name}`);
  }

  /**
   * Execute a strategy with automatic fallback
   */
  async execute(strategyName: string, context?: any): Promise<FallbackResult> {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Unknown fallback strategy: ${strategyName}`);
    }

    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | undefined;

    // Check cache first if enabled
    if (strategy.cache) {
      const cached = this.getCached(strategyName);
      if (cached) {
        this.logger.debug(`Using cached result for ${strategyName}`);
        return {
          success: true,
          data: cached,
          strategy: 'cache',
          attempts: 0,
          duration: Date.now() - startTime
        };
      }
    }

    // Try primary strategy
    try {
      attempts++;
      const result = await this.executeWithTimeout(strategy.primary, strategy.timeout || 10000);
      if (!strategy.validate || strategy.validate(result)) {
        this.updateMetrics(strategyName, true, false);
        if (strategy.cache) {
          this.setCached(strategyName, result);
        }
        return {
          success: true,
          data: result,
          strategy: 'primary',
          attempts,
          duration: Date.now() - startTime
        };
      }
    } catch (error) {
      lastError = error as Error;
      this.logger.warn(`Primary strategy failed for ${strategyName}: ${lastError.message}`);
    }

    // Try fallbacks in order
    for (let i = 0; i < strategy.fallbacks.length; i++) {
      try {
        attempts++;
        const result = await this.executeWithTimeout(
          strategy.fallbacks[i], 
          strategy.timeout || 10000
        );
        if (!strategy.validate || strategy.validate(result)) {
          this.updateMetrics(strategyName, true, true);
          if (strategy.cache) {
            this.setCached(strategyName, result);
          }
          this.emit('fallback-used', { strategy: strategyName, fallbackIndex: i });
          return {
            success: true,
            data: result,
            strategy: `fallback-${i + 1}`,
            attempts,
            duration: Date.now() - startTime
          };
        }
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Fallback ${i + 1} failed for ${strategyName}: ${lastError.message}`);
      }
    }

    // All strategies failed
    this.updateMetrics(strategyName, false, false);
    this.emit('all-strategies-failed', { strategy: strategyName, error: lastError });
    return {
      success: false,
      strategy: 'none',
      attempts,
      duration: Date.now() - startTime,
      error: lastError
    };
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout(fn: () => Promise<any>, timeout: number): Promise<any> {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      )
    ]);
  }

  /**
   * Update metrics for strategy usage
   */
  private updateMetrics(strategyName: string, success: boolean, usedFallback: boolean): void {
    const metrics = this.metrics.get(strategyName);
    if (metrics) {
      if (success) {
        metrics.success++;
      } else {
        metrics.failures++;
      }
      if (usedFallback) {
        metrics.fallbackUsage++;
      }
      this.metrics.set(strategyName, metrics);
    }
  }

  /**
   * Get cached result
   */
  private getCached(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.maxCacheAge) {
      return cached.data;
    }
    
    // Try file cache
    const filePath = path.join(this.cacheDir, `${crypto.createHash('md5').update(key).digest('hex')}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Date.now() - fileData.timestamp < this.maxCacheAge) {
          this.cache.set(key, fileData); // Update memory cache
          return fileData.data;
        }
      } catch (error) {
        this.logger.warn(`Failed to read cache file: ${error}`);
      }
    }
    
    return null;
  }

  /**
   * Set cached result
   */
  private setCached(key: string, data: any): void {
    const cacheData = { data, timestamp: Date.now() };
    this.cache.set(key, cacheData);
    
    // Also save to file
    const filePath = path.join(this.cacheDir, `${crypto.createHash('md5').update(key).digest('hex')}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(cacheData));
    } catch (error) {
      this.logger.warn(`Failed to write cache file: ${error}`);
    }
  }

  // Implementation stubs for various fallback methods
  private async downloadFromCDN(url: string): Promise<any> {
    // Implementation would download from CDN
    return { source: 'cdn', url };
  }

  private async loadFromLocalCache(type: string): Promise<any> {
    // Implementation would load from local cache
    return { source: 'local-cache', type };
  }

  private async useSystemBrowsers(): Promise<any> {
    // Implementation would detect system browsers
    return { source: 'system', browsers: ['chrome', 'firefox'] };
  }

  private async callVisionAPI(): Promise<any> {
    // Implementation would call vision API
    throw new Error('Vision API not available');
  }

  private async domBasedVisionAnalysis(): Promise<any> {
    // Implementation would analyze DOM
    return { source: 'dom-analysis', elements: [] };
  }

  private async accessibilityTreeAnalysis(): Promise<any> {
    // Implementation would analyze accessibility tree
    return { source: 'accessibility-tree', nodes: [] };
  }

  private async simulatedOCR(): Promise<any> {
    // Implementation would simulate OCR
    return { source: 'simulated-ocr', text: '' };
  }

  private async connectToRedis(): Promise<any> {
    // Implementation would connect to Redis
    throw new Error('Redis not available');
  }

  private async useInMemoryStore(): Promise<any> {
    // Implementation would use in-memory store
    return { source: 'memory', store: new Map() };
  }

  private async useFileStore(): Promise<any> {
    // Implementation would use file store
    return { source: 'file', path: this.cacheDir };
  }

  private async useSQLiteStore(): Promise<any> {
    // Implementation would use SQLite
    return { source: 'sqlite', db: ':memory:' };
  }

  private async systemDNS(): Promise<any> {
    // Implementation would use system DNS
    return { source: 'system-dns' };
  }

  private async dnsOverHTTPS(server: string): Promise<any> {
    // Implementation would use DNS over HTTPS
    return { source: 'doh', server };
  }

  private async cachedDNS(): Promise<any> {
    // Implementation would use cached DNS
    return { source: 'cached-dns', entries: [] };
  }

  private async externalAuthProvider(): Promise<any> {
    // Implementation would use external auth
    throw new Error('Auth provider not available');
  }

  private async mockAuthProvider(): Promise<any> {
    // Implementation would use mock auth
    return { source: 'mock-auth', authenticated: true };
  }

  private async basicAuthProvider(): Promise<any> {
    // Implementation would use basic auth
    return { source: 'basic-auth', method: 'username/password' };
  }

  private async localUserStore(): Promise<any> {
    // Implementation would use local users
    return { source: 'local-users', users: [] };
  }

  private async connectWebSocket(): Promise<any> {
    // Implementation would connect WebSocket
    throw new Error('WebSocket not available');
  }

  private async useLongPolling(): Promise<any> {
    // Implementation would use long polling
    return { source: 'long-polling', interval: 5000 };
  }

  private async useServerSentEvents(): Promise<any> {
    // Implementation would use SSE
    return { source: 'sse', stream: null };
  }

  private async usePolling(): Promise<any> {
    // Implementation would use polling
    return { source: 'polling', interval: 10000 };
  }

  private async fetchFromNPM(): Promise<any> {
    // Implementation would fetch from NPM
    return { source: 'npm', registry: 'https://registry.npmjs.org' };
  }

  private async fetchFromYarn(): Promise<any> {
    // Implementation would fetch from Yarn
    return { source: 'yarn', registry: 'https://registry.yarnpkg.com' };
  }

  private async fetchFromGitHub(): Promise<any> {
    // Implementation would fetch from GitHub
    return { source: 'github', registry: 'https://npm.pkg.github.com' };
  }

  /**
   * Get metrics for all strategies
   */
  getMetrics(): Map<string, any> {
    return new Map(this.metrics);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    // Clear file cache
    const files = fs.readdirSync(this.cacheDir);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(this.cacheDir, file));
      }
    });
  }

  /**
   * Get strategy info
   */
  getStrategy(name: string): FallbackStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * List all registered strategies
   */
  listStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}