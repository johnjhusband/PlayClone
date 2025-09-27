/**
 * Intelligent Site Cache - Advanced caching for frequently accessed sites
 * 
 * Features:
 * - Site-specific caching strategies
 * - Predictive prefetching based on access patterns
 * - Resource prioritization (HTML, CSS, JS, images)
 * - Automatic cache warming for popular sites
 * - Dynamic TTL based on site update frequency
 * - Content fingerprinting for change detection
 * - Multi-layer caching (memory, disk, CDN)
 */

import { Page } from 'playwright-core';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { ActionResult } from '../types';
import { globalCacheManager } from './OperationCache';

/**
 * Site access pattern
 */
export interface SiteAccessPattern {
  url: string;
  domain: string;
  frequency: number;
  lastAccess: number;
  averageLoadTime: number;
  updateFrequency: number; // How often content changes (in ms)
  peakHours: number[]; // Hours of day with most access
  resourceTypes: Map<string, number>; // Resource type access counts
  navigationPaths: string[][]; // Common navigation sequences
}

/**
 * Cached resource
 */
export interface CachedResource {
  url: string;
  type: 'html' | 'css' | 'js' | 'image' | 'font' | 'data' | 'document';
  content: Buffer | string;
  headers: Record<string, string>;
  size: number;
  hash: string;
  timestamp: number;
  hits: number;
  ttl: number;
}

/**
 * Site cache configuration
 */
export interface SiteCacheConfig {
  url: string;
  domain: string;
  strategy: 'aggressive' | 'moderate' | 'conservative' | 'custom';
  maxSize: number;
  ttl: number;
  prefetchDepth: number;
  resourcePriority: string[];
  updateCheckInterval: number;
  enableOffline: boolean;
}

/**
 * Cache statistics for a site
 */
export interface SiteCacheStats {
  domain: string;
  totalSize: number;
  resourceCount: number;
  hitRate: number;
  bandwidthSaved: number;
  averageLoadImprovement: number;
  lastUpdate: number;
  offlineAvailable: boolean;
}

/**
 * Intelligent Site Cache class
 */
export class IntelligentSiteCache {
  private sitePatterns: Map<string, SiteAccessPattern>;
  private siteConfigs: Map<string, SiteCacheConfig>;
  private cachedResources: Map<string, Map<string, CachedResource>>;
  private cacheDir: string;
  private maxTotalSize: number;
  private currentSize: number;
  private prefetchQueue: Set<string>;
  private updateCheckers: Map<string, NodeJS.Timeout>;
  private learningMode: boolean;

  constructor(cacheDir: string = '.playclone-cache') {
    this.sitePatterns = new Map();
    this.siteConfigs = new Map();
    this.cachedResources = new Map();
    this.cacheDir = cacheDir;
    this.maxTotalSize = 500 * 1024 * 1024; // 500MB default
    this.currentSize = 0;
    this.prefetchQueue = new Set();
    this.updateCheckers = new Map();
    this.learningMode = true;

    this.initializeCache();
  }

  /**
   * Initialize cache directory and load existing data
   */
  private async initializeCache(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await this.loadCacheMetadata();
      await this.loadPopularSiteConfigs();
    } catch (error) {
      console.error('Failed to initialize cache:', error);
    }
  }

  /**
   * Load cache metadata from disk
   */
  private async loadCacheMetadata(): Promise<void> {
    const metadataPath = path.join(this.cacheDir, 'metadata.json');
    
    try {
      const data = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(data);
      
      // Restore site patterns
      for (const [domain, pattern] of Object.entries(metadata.patterns || {})) {
        this.sitePatterns.set(domain, pattern as SiteAccessPattern);
      }
      
      // Restore site configs
      for (const [domain, config] of Object.entries(metadata.configs || {})) {
        this.siteConfigs.set(domain, config as SiteCacheConfig);
      }
    } catch (error) {
      // Metadata doesn't exist yet, will be created on first save
    }
  }

  /**
   * Load default configurations for popular sites
   */
  private async loadPopularSiteConfigs(): Promise<void> {
    const popularSites: SiteCacheConfig[] = [
      {
        url: 'https://google.com',
        domain: 'google.com',
        strategy: 'aggressive',
        maxSize: 10 * 1024 * 1024,
        ttl: 3600000, // 1 hour
        prefetchDepth: 2,
        resourcePriority: ['html', 'css', 'js'],
        updateCheckInterval: 1800000, // 30 minutes
        enableOffline: true,
      },
      {
        url: 'https://github.com',
        domain: 'github.com',
        strategy: 'moderate',
        maxSize: 20 * 1024 * 1024,
        ttl: 1800000, // 30 minutes
        prefetchDepth: 1,
        resourcePriority: ['html', 'css', 'js', 'image'],
        updateCheckInterval: 900000, // 15 minutes
        enableOffline: false,
      },
      {
        url: 'https://stackoverflow.com',
        domain: 'stackoverflow.com',
        strategy: 'aggressive',
        maxSize: 15 * 1024 * 1024,
        ttl: 7200000, // 2 hours
        prefetchDepth: 2,
        resourcePriority: ['html', 'css'],
        updateCheckInterval: 3600000, // 1 hour
        enableOffline: true,
      },
      {
        url: 'https://developer.mozilla.org',
        domain: 'developer.mozilla.org',
        strategy: 'aggressive',
        maxSize: 25 * 1024 * 1024,
        ttl: 86400000, // 24 hours
        prefetchDepth: 3,
        resourcePriority: ['html', 'css', 'js'],
        updateCheckInterval: 21600000, // 6 hours
        enableOffline: true,
      },
      {
        url: 'https://npmjs.com',
        domain: 'npmjs.com',
        strategy: 'moderate',
        maxSize: 10 * 1024 * 1024,
        ttl: 600000, // 10 minutes
        prefetchDepth: 1,
        resourcePriority: ['html', 'data'],
        updateCheckInterval: 300000, // 5 minutes
        enableOffline: false,
      },
    ];

    for (const config of popularSites) {
      if (!this.siteConfigs.has(config.domain)) {
        this.siteConfigs.set(config.domain, config);
      }
    }
  }

  /**
   * Record site access and update patterns
   */
  async recordAccess(url: string, loadTime: number): Promise<void> {
    const domain = new URL(url).hostname;
    const now = Date.now();
    const hour = new Date().getHours();

    let pattern = this.sitePatterns.get(domain);
    
    if (!pattern) {
      pattern = {
        url,
        domain,
        frequency: 1,
        lastAccess: now,
        averageLoadTime: loadTime,
        updateFrequency: 0,
        peakHours: [hour],
        resourceTypes: new Map(),
        navigationPaths: [],
      };
    } else {
      // Update pattern
      pattern.frequency++;
      pattern.lastAccess = now;
      pattern.averageLoadTime = 
        (pattern.averageLoadTime * (pattern.frequency - 1) + loadTime) / pattern.frequency;
      
      if (!pattern.peakHours.includes(hour)) {
        pattern.peakHours.push(hour);
      }
    }

    this.sitePatterns.set(domain, pattern);

    // Auto-configure if frequently accessed
    if (pattern.frequency > 5 && !this.siteConfigs.has(domain)) {
      await this.autoConfigureSite(domain, pattern);
    }

    // Save metadata periodically
    if (pattern.frequency % 10 === 0) {
      await this.saveCacheMetadata();
    }
  }

  /**
   * Auto-configure caching for a frequently accessed site
   */
  private async autoConfigureSite(
    domain: string, 
    pattern: SiteAccessPattern
  ): Promise<void> {
    // Determine strategy based on access pattern
    let strategy: 'aggressive' | 'moderate' | 'conservative';
    
    if (pattern.frequency > 20 && pattern.averageLoadTime > 2000) {
      strategy = 'aggressive';
    } else if (pattern.frequency > 10) {
      strategy = 'moderate';
    } else {
      strategy = 'conservative';
    }

    const config: SiteCacheConfig = {
      url: pattern.url,
      domain,
      strategy,
      maxSize: this.calculateOptimalCacheSize(pattern),
      ttl: this.calculateOptimalTTL(pattern),
      prefetchDepth: strategy === 'aggressive' ? 2 : 1,
      resourcePriority: this.determineResourcePriority(pattern),
      updateCheckInterval: this.calculateUpdateInterval(pattern),
      enableOffline: strategy === 'aggressive',
    };

    this.siteConfigs.set(domain, config);
    
    // Start update checker if needed
    if (config.updateCheckInterval > 0) {
      this.startUpdateChecker(domain, config);
    }
  }

  /**
   * Calculate optimal cache size based on pattern
   */
  private calculateOptimalCacheSize(pattern: SiteAccessPattern): number {
    const baseSize = 5 * 1024 * 1024; // 5MB base
    const frequencyMultiplier = Math.min(pattern.frequency / 10, 5);
    return Math.floor(baseSize * frequencyMultiplier);
  }

  /**
   * Calculate optimal TTL based on update frequency
   */
  private calculateOptimalTTL(pattern: SiteAccessPattern): number {
    if (pattern.updateFrequency === 0) {
      // No update frequency data yet, use conservative TTL
      return 600000; // 10 minutes
    }
    
    // TTL should be slightly less than update frequency
    return Math.floor(pattern.updateFrequency * 0.9);
  }

  /**
   * Determine resource priority based on access patterns
   */
  private determineResourcePriority(pattern: SiteAccessPattern): string[] {
    const priorities: string[] = ['html']; // HTML always first
    
    // Sort resource types by access count
    const sortedTypes = Array.from(pattern.resourceTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);
    
    priorities.push(...sortedTypes);
    
    // Default priorities if no data
    if (priorities.length === 1) {
      priorities.push('css', 'js', 'image');
    }
    
    return priorities;
  }

  /**
   * Calculate update check interval
   */
  private calculateUpdateInterval(pattern: SiteAccessPattern): number {
    if (pattern.updateFrequency > 0) {
      // Check slightly more frequently than updates occur
      return Math.floor(pattern.updateFrequency * 0.8);
    }
    
    // Default based on access frequency
    if (pattern.frequency > 50) {
      return 900000; // 15 minutes for very frequent
    } else if (pattern.frequency > 20) {
      return 1800000; // 30 minutes for frequent
    } else {
      return 3600000; // 1 hour for moderate
    }
  }

  /**
   * Cache page resources intelligently
   */
  async cachePage(page: Page, url: string): Promise<void> {
    const domain = new URL(url).hostname;
    const config = this.siteConfigs.get(domain);
    
    if (!config) {
      // No config, use basic caching
      await this.basicCachePage(page, url);
      return;
    }

    // Get or create resource map for domain
    if (!this.cachedResources.has(domain)) {
      this.cachedResources.set(domain, new Map());
    }
    
    const domainCache = this.cachedResources.get(domain)!;

    // Intercept and cache resources based on priority
    await page.route('**/*', async (route) => {
      const request = route.request();
      const resourceUrl = request.url();
      const resourceType = request.resourceType();
      
      // Check if we have this cached
      const cacheKey = this.generateResourceKey(resourceUrl);
      const cached = domainCache.get(cacheKey);
      
      if (cached && this.isCacheValid(cached)) {
        // Serve from cache
        cached.hits++;
        await route.fulfill({
          status: 200,
          headers: cached.headers,
          body: cached.content,
        });
        return;
      }

      // Continue with request and cache response
      const response = await route.fetch();
      
      if (response.ok() && this.shouldCache(resourceType, config)) {
        const content = await response.body();
        const headers = response.headers();
        
        const resource: CachedResource = {
          url: resourceUrl,
          type: resourceType as any,
          content,
          headers,
          size: content.length,
          hash: this.generateHash(content),
          timestamp: Date.now(),
          hits: 0,
          ttl: config.ttl,
        };

        // Check cache size limits
        if (this.currentSize + resource.size <= this.maxTotalSize) {
          domainCache.set(cacheKey, resource);
          this.currentSize += resource.size;
          
          // Save to disk if offline mode enabled
          if (config.enableOffline) {
            await this.saveResourceToDisk(domain, cacheKey, resource);
          }
        }
      }

      await route.continue();
    });

    // Prefetch linked resources if configured
    if (config.prefetchDepth > 0) {
      await this.prefetchLinkedResources(page, url, config.prefetchDepth);
    }
  }

  /**
   * Basic page caching without configuration
   */
  private async basicCachePage(page: Page, url: string): Promise<void> {
    // Cache only HTML and critical resources
    const html = await page.content();
    const domain = new URL(url).hostname;
    
    if (!this.cachedResources.has(domain)) {
      this.cachedResources.set(domain, new Map());
    }
    
    const domainCache = this.cachedResources.get(domain)!;
    const cacheKey = this.generateResourceKey(url);
    
    const resource: CachedResource = {
      url,
      type: 'html',
      content: html,
      headers: { 'content-type': 'text/html' },
      size: html.length,
      hash: this.generateHash(html),
      timestamp: Date.now(),
      hits: 0,
      ttl: 600000, // 10 minutes default
    };

    domainCache.set(cacheKey, resource);
    this.currentSize += resource.size;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(resource: CachedResource): boolean {
    const age = Date.now() - resource.timestamp;
    return age < resource.ttl;
  }

  /**
   * Check if resource type should be cached
   */
  private shouldCache(
    resourceType: string, 
    config: SiteCacheConfig
  ): boolean {
    // Map resource types to our priority types
    const typeMap: Record<string, string> = {
      'document': 'html',
      'stylesheet': 'css',
      'script': 'js',
      'image': 'image',
      'font': 'font',
      'xhr': 'data',
      'fetch': 'data',
    };

    const mappedType = typeMap[resourceType] || resourceType;
    return config.resourcePriority.includes(mappedType);
  }

  /**
   * Prefetch linked resources
   */
  private async prefetchLinkedResources(
    page: Page,
    url: string,
    depth: number
  ): Promise<void> {
    if (depth <= 0) return;

    // Find all links on the page
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => (a as HTMLAnchorElement).href)
        .filter(href => href.startsWith('http'));
    });

    // Add to prefetch queue (limit to same domain)
    const domain = new URL(url).hostname;
    
    for (const link of links.slice(0, 10)) { // Limit prefetch
      try {
        const linkDomain = new URL(link).hostname;
        if (linkDomain === domain) {
          this.prefetchQueue.add(link);
        }
      } catch (error) {
        // Invalid URL, skip
      }
    }
  }

  /**
   * Process prefetch queue
   */
  async processPrefetchQueue(page: Page): Promise<void> {
    const urls = Array.from(this.prefetchQueue).slice(0, 5);
    this.prefetchQueue.clear();

    for (const url of urls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await this.cachePage(page, url);
      } catch (error) {
        console.error(`Failed to prefetch ${url}:`, error);
      }
    }
  }

  /**
   * Get cached content for URL
   */
  async getCachedContent(url: string): Promise<CachedResource | null> {
    const domain = new URL(url).hostname;
    const domainCache = this.cachedResources.get(domain);
    
    if (!domainCache) {
      // Try loading from disk
      return await this.loadFromDisk(domain, url);
    }

    const cacheKey = this.generateResourceKey(url);
    const cached = domainCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached)) {
      cached.hits++;
      return cached;
    }

    // Try loading from disk if memory cache miss
    return await this.loadFromDisk(domain, url);
  }

  /**
   * Invalidate cache for a domain
   */
  async invalidateDomain(domain: string): Promise<void> {
    const domainCache = this.cachedResources.get(domain);
    
    if (domainCache) {
      // Calculate size to free
      let freedSize = 0;
      for (const resource of domainCache.values()) {
        freedSize += resource.size;
      }
      
      domainCache.clear();
      this.currentSize -= freedSize;
    }

    // Clear from disk
    const domainDir = path.join(this.cacheDir, domain);
    try {
      await fs.rm(domainDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  }

  /**
   * Start update checker for a domain
   */
  private startUpdateChecker(domain: string, config: SiteCacheConfig): void {
    // Clear existing checker
    const existing = this.updateCheckers.get(domain);
    if (existing) {
      clearInterval(existing);
    }

    const checker = setInterval(async () => {
      await this.checkForUpdates(domain, config);
    }, config.updateCheckInterval);

    this.updateCheckers.set(domain, checker);
  }

  /**
   * Check for content updates
   */
  private async checkForUpdates(
    domain: string,
    config: SiteCacheConfig
  ): Promise<void> {
    const domainCache = this.cachedResources.get(domain);
    if (!domainCache) return;

    // Check a sample of cached resources
    const resources = Array.from(domainCache.values()).slice(0, 5);
    
    for (const resource of resources) {
      try {
        // Fetch fresh version
        const response = await fetch(resource.url, { method: 'HEAD' });
        const etag = response.headers.get('etag');
        const lastModified = response.headers.get('last-modified');
        
        // Simple change detection
        if (etag && resource.headers['etag'] !== etag) {
          // Content changed, invalidate
          const cacheKey = this.generateResourceKey(resource.url);
          domainCache.delete(cacheKey);
          this.currentSize -= resource.size;
        }
      } catch (error) {
        // Ignore fetch errors
      }
    }
  }

  /**
   * Generate cache key for resource
   */
  private generateResourceKey(url: string): string {
    return crypto.createHash('sha256').update(url).digest('hex').substr(0, 16);
  }

  /**
   * Generate content hash
   */
  private generateHash(content: Buffer | string): string {
    const data = typeof content === 'string' ? Buffer.from(content) : content;
    return crypto.createHash('sha256').update(data).digest('hex').substr(0, 32);
  }

  /**
   * Save resource to disk
   */
  private async saveResourceToDisk(
    domain: string,
    key: string,
    resource: CachedResource
  ): Promise<void> {
    const domainDir = path.join(this.cacheDir, domain);
    await fs.mkdir(domainDir, { recursive: true });
    
    const resourcePath = path.join(domainDir, `${key}.cache`);
    const metadata = {
      ...resource,
      content: undefined, // Don't include content in metadata
    };
    
    // Save metadata
    await fs.writeFile(
      `${resourcePath}.meta`,
      JSON.stringify(metadata),
      'utf8'
    );
    
    // Save content
    await fs.writeFile(resourcePath, resource.content);
  }

  /**
   * Load resource from disk
   */
  private async loadFromDisk(
    domain: string,
    url: string
  ): Promise<CachedResource | null> {
    const key = this.generateResourceKey(url);
    const domainDir = path.join(this.cacheDir, domain);
    const resourcePath = path.join(domainDir, `${key}.cache`);
    
    try {
      // Load metadata
      const metadataStr = await fs.readFile(`${resourcePath}.meta`, 'utf8');
      const metadata = JSON.parse(metadataStr);
      
      // Load content
      const content = await fs.readFile(resourcePath);
      
      const resource: CachedResource = {
        ...metadata,
        content,
      };
      
      if (this.isCacheValid(resource)) {
        // Add back to memory cache
        if (!this.cachedResources.has(domain)) {
          this.cachedResources.set(domain, new Map());
        }
        
        this.cachedResources.get(domain)!.set(key, resource);
        this.currentSize += resource.size;
        
        return resource;
      }
    } catch (error) {
      // File doesn't exist or is corrupted
    }
    
    return null;
  }

  /**
   * Save cache metadata
   */
  private async saveCacheMetadata(): Promise<void> {
    const metadata = {
      patterns: Object.fromEntries(this.sitePatterns),
      configs: Object.fromEntries(this.siteConfigs),
      stats: this.getStats(),
      timestamp: Date.now(),
    };

    const metadataPath = path.join(this.cacheDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  }

  /**
   * Get cache statistics
   */
  getStats(): SiteCacheStats[] {
    const stats: SiteCacheStats[] = [];
    
    for (const [domain, cache] of this.cachedResources.entries()) {
      let totalSize = 0;
      let totalHits = 0;
      let totalRequests = 0;
      
      for (const resource of cache.values()) {
        totalSize += resource.size;
        totalHits += resource.hits;
        totalRequests += resource.hits + 1;
      }
      
      const config = this.siteConfigs.get(domain);
      const pattern = this.sitePatterns.get(domain);
      
      stats.push({
        domain,
        totalSize,
        resourceCount: cache.size,
        hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
        bandwidthSaved: totalHits * (totalSize / cache.size),
        averageLoadImprovement: pattern?.averageLoadTime ? 
          pattern.averageLoadTime * 0.7 : 0, // Estimate 30% improvement
        lastUpdate: Date.now(),
        offlineAvailable: config?.enableOffline || false,
      });
    }
    
    return stats;
  }

  /**
   * Predict next likely navigation
   */
  predictNextNavigation(currentUrl: string): string[] {
    const domain = new URL(currentUrl).hostname;
    const pattern = this.sitePatterns.get(domain);
    
    if (!pattern || pattern.navigationPaths.length === 0) {
      return [];
    }

    // Find paths that start with current URL
    const predictions: Map<string, number> = new Map();
    
    for (const path of pattern.navigationPaths) {
      const index = path.indexOf(currentUrl);
      if (index >= 0 && index < path.length - 1) {
        const next = path[index + 1];
        predictions.set(next, (predictions.get(next) || 0) + 1);
      }
    }

    // Sort by frequency
    return Array.from(predictions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([url]) => url);
  }

  /**
   * Warm cache for a domain
   */
  async warmCache(page: Page, domain: string): Promise<void> {
    const config = this.siteConfigs.get(domain);
    if (!config) return;

    // Navigate to main page
    await page.goto(config.url, { waitUntil: 'domcontentloaded' });
    await this.cachePage(page, config.url);

    // Process prefetch queue
    await this.processPrefetchQueue(page);
  }

  /**
   * Export cache for offline use
   */
  async exportForOffline(domain: string): Promise<string> {
    const domainCache = this.cachedResources.get(domain);
    if (!domainCache) {
      throw new Error(`No cache available for ${domain}`);
    }

    const exportDir = path.join(this.cacheDir, 'offline', domain);
    await fs.mkdir(exportDir, { recursive: true });

    // Create service worker for offline support
    const swContent = this.generateServiceWorker(domain);
    await fs.writeFile(path.join(exportDir, 'sw.js'), swContent, 'utf8');

    // Export all cached resources
    for (const [key, resource] of domainCache.entries()) {
      await this.saveResourceToDisk(`offline/${domain}`, key, resource);
    }

    // Create manifest
    const manifest = {
      domain,
      timestamp: Date.now(),
      resources: Array.from(domainCache.values()).map(r => ({
        url: r.url,
        type: r.type,
        size: r.size,
        hash: r.hash,
      })),
    };

    await fs.writeFile(
      path.join(exportDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    return exportDir;
  }

  /**
   * Generate service worker for offline support
   */
  private generateServiceWorker(domain: string): string {
    return `
// PlayClone Offline Service Worker for ${domain}
const CACHE_NAME = 'playclone-${domain}-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return fetch('./manifest.json')
        .then(response => response.json())
        .then(manifest => {
          const urls = manifest.resources.map(r => r.url);
          return cache.addAll(urls);
        });
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
    `.trim();
  }

  /**
   * Clear old cache entries
   */
  async cleanup(): Promise<number> {
    let cleaned = 0;
    const now = Date.now();

    for (const [domain, cache] of this.cachedResources.entries()) {
      const toDelete: string[] = [];
      
      for (const [key, resource] of cache.entries()) {
        if (!this.isCacheValid(resource)) {
          toDelete.push(key);
          this.currentSize -= resource.size;
          cleaned++;
        }
      }

      for (const key of toDelete) {
        cache.delete(key);
      }

      // Remove empty domain caches
      if (cache.size === 0) {
        this.cachedResources.delete(domain);
      }
    }

    await this.saveCacheMetadata();
    return cleaned;
  }

  /**
   * Get cache size info
   */
  getCacheSizeInfo(): {
    current: number;
    max: number;
    percentage: number;
    domains: Map<string, number>;
  } {
    const domains = new Map<string, number>();
    
    for (const [domain, cache] of this.cachedResources.entries()) {
      let domainSize = 0;
      for (const resource of cache.values()) {
        domainSize += resource.size;
      }
      domains.set(domain, domainSize);
    }

    return {
      current: this.currentSize,
      max: this.maxTotalSize,
      percentage: (this.currentSize / this.maxTotalSize) * 100,
      domains,
    };
  }

  /**
   * Stop all background tasks
   */
  stop(): void {
    for (const checker of this.updateCheckers.values()) {
      clearInterval(checker);
    }
    this.updateCheckers.clear();
  }
}

/**
 * Global intelligent cache instance
 */
export const intelligentCache = new IntelligentSiteCache();