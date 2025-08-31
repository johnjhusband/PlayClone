/**
 * Operation Cache - Intelligent caching for repeated operations
 */

import crypto from 'crypto';
import { ActionResult } from '../types';

/**
 * Cache entry structure
 */
export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  hits: number;
  size: number;
  ttl: number;
  tags: Set<string>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  entries: number;
  hitRate: number;
  avgAccessTime: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize: number;           // Max cache size in bytes
  maxEntries: number;        // Max number of entries
  defaultTTL: number;        // Default TTL in milliseconds
  checkInterval: number;     // Cleanup interval
  enableCompression: boolean;
  algorithm: 'lru' | 'lfu' | 'fifo';
}

/**
 * Cache key generator options
 */
export interface KeyOptions {
  includeTimestamp?: boolean;
  precision?: 'exact' | 'fuzzy' | 'semantic';
  normalize?: boolean;
}

/**
 * Operation Cache class
 */
export class OperationCache {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private stats: CacheStats;
  private accessOrder: string[];
  private cleanupTimer?: NodeJS.Timeout;
  private totalSize: number;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 10000,
      defaultTTL: 60000, // 1 minute
      checkInterval: 30000, // 30 seconds
      enableCompression: true,
      algorithm: 'lru',
      ...config,
    };

    this.cache = new Map();
    this.accessOrder = [];
    this.totalSize = 0;

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      entries: 0,
      hitRate: 0,
      avgAccessTime: 0,
    };

    // Start cleanup cycle
    this.startCleanupCycle();
  }

  /**
   * Generate cache key from operation parameters
   */
  generateKey(
    operation: string,
    params: any,
    options: KeyOptions = {}
  ): string {
    const keyData: any = {
      op: operation,
      params: this.normalizeParams(params, options),
    };

    if (options.includeTimestamp) {
      // Round timestamp for fuzzy matching
      const precision = options.precision === 'fuzzy' ? 60000 : 1000;
      keyData.ts = Math.floor(Date.now() / precision) * precision;
    }

    const keyString = JSON.stringify(keyData);
    return crypto.createHash('sha256').update(keyString).digest('hex').substr(0, 16);
  }

  /**
   * Normalize parameters for key generation
   */
  private normalizeParams(params: any, options: KeyOptions): any {
    if (!options.normalize) return params;

    if (typeof params === 'string') {
      // Normalize selectors and text
      return params.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    if (typeof params === 'object' && params !== null) {
      const normalized: any = {};
      
      for (const [key, value] of Object.entries(params)) {
        // Skip volatile fields
        if (['timestamp', 'sessionId', 'random'].includes(key)) continue;
        
        normalized[key] = this.normalizeParams(value, options);
      }
      
      return normalized;
    }

    return params;
  }

  /**
   * Get value from cache
   */
  get(key: string): any | null {
    const startTime = Date.now();
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access order
    this.updateAccessOrder(key);
    entry.hits++;
    
    this.stats.hits++;
    this.updateHitRate();
    this.updateAccessTime(startTime);

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(
    key: string,
    value: any,
    ttl: number = this.config.defaultTTL,
    tags: string[] = []
  ): void {
    const size = this.calculateSize(value);

    // Check size limits
    if (size > this.config.maxSize) {
      return; // Value too large to cache
    }

    // Evict if necessary
    while (
      (this.totalSize + size > this.config.maxSize ||
       this.cache.size >= this.config.maxEntries) &&
      this.cache.size > 0
    ) {
      this.evict();
    }

    // Create entry
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      hits: 0,
      size,
      ttl,
      tags: new Set(tags),
    };

    // Update cache
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.totalSize -= oldEntry.size;
    }

    this.cache.set(key, entry);
    this.totalSize += size;
    this.stats.size = this.totalSize;
    this.stats.entries = this.cache.size;
    
    this.updateAccessOrder(key);
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) return false;

    this.cache.delete(key);
    this.totalSize -= entry.size;
    this.stats.size = this.totalSize;
    this.stats.entries = this.cache.size;

    // Remove from access order
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }

    return true;
  }

  /**
   * Clear all entries with specific tag
   */
  clearByTag(tag: string): number {
    let cleared = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.has(tag)) {
        this.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.totalSize = 0;
    this.stats.size = 0;
    this.stats.entries = 0;
  }

  /**
   * Evict entries based on algorithm
   */
  private evict(): void {
    let keyToEvict: string | undefined;

    switch (this.config.algorithm) {
      case 'lru':
        keyToEvict = this.accessOrder[0];
        break;
      
      case 'lfu':
        let minHits = Infinity;
        for (const [key, entry] of this.cache.entries()) {
          if (entry.hits < minHits) {
            minHits = entry.hits;
            keyToEvict = key;
          }
        }
        break;
      
      case 'fifo':
        let oldest = Infinity;
        for (const [key, entry] of this.cache.entries()) {
          if (entry.timestamp < oldest) {
            oldest = entry.timestamp;
            keyToEvict = key;
          }
        }
        break;
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
      this.stats.evictions++;
    }
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    
    this.accessOrder.push(key);
  }

  /**
   * Calculate size of value
   */
  private calculateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16
    }
    
    return JSON.stringify(value).length * 2;
  }

  /**
   * Update hit rate statistic
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Update average access time
   */
  private updateAccessTime(startTime: number): void {
    const accessTime = Date.now() - startTime;
    const total = this.stats.hits + this.stats.misses;
    
    this.stats.avgAccessTime = 
      (this.stats.avgAccessTime * (total - 1) + accessTime) / total;
  }

  /**
   * Start cleanup cycle
   */
  private startCleanupCycle(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.checkInterval);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Stop the cache (cleanup timers)
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  /**
   * Cache decorator for methods
   */
  static decorator(
    ttl: number = 60000,
    keyGenerator?: (args: any[]) => string
  ) {
    return function (
      _target: any,
      propertyName: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      const cache = new OperationCache({ defaultTTL: ttl });

      descriptor.value = async function (...args: any[]) {
        const key = keyGenerator 
          ? keyGenerator(args)
          : cache.generateKey(propertyName, args);

        // Check cache
        const cached = cache.get(key);
        if (cached !== null) {
          return cached;
        }

        // Execute and cache
        const result = await originalMethod.apply(this, args);
        cache.set(key, result, ttl);
        
        return result;
      };

      return descriptor;
    };
  }
}

/**
 * Specialized caches for different operation types
 */
export class NavigationCache extends OperationCache {
  constructor() {
    super({
      maxSize: 10 * 1024 * 1024, // 10MB
      defaultTTL: 300000, // 5 minutes
      algorithm: 'lru',
    });
  }

  cacheNavigation(url: string, result: ActionResult): void {
    const key = this.generateKey('navigate', { url }, { normalize: true });
    this.set(key, result, 300000, ['navigation']);
  }

  getCachedNavigation(url: string): ActionResult | null {
    const key = this.generateKey('navigate', { url }, { normalize: true });
    return this.get(key);
  }
}

export class ElementCache extends OperationCache {
  constructor() {
    super({
      maxSize: 5 * 1024 * 1024, // 5MB
      defaultTTL: 30000, // 30 seconds
      algorithm: 'lfu',
    });
  }

  cacheElement(selector: string, pageUrl: string, element: any): void {
    const key = this.generateKey('element', { selector, pageUrl }, { 
      normalize: true,
      precision: 'fuzzy',
    });
    this.set(key, element, 30000, ['element', pageUrl]);
  }

  getCachedElement(selector: string, pageUrl: string): any | null {
    const key = this.generateKey('element', { selector, pageUrl }, { 
      normalize: true,
      precision: 'fuzzy',
    });
    return this.get(key);
  }

  invalidatePage(pageUrl: string): void {
    this.clearByTag(pageUrl);
  }
}

export class DataCache extends OperationCache {
  constructor() {
    super({
      maxSize: 20 * 1024 * 1024, // 20MB
      defaultTTL: 120000, // 2 minutes
      algorithm: 'lru',
    });
  }

  cacheExtraction(url: string, selector: string, data: any): void {
    const key = this.generateKey('extract', { url, selector }, { 
      normalize: true,
      includeTimestamp: true,
      precision: 'fuzzy',
    });
    this.set(key, data, 120000, ['extraction', url]);
  }

  getCachedExtraction(url: string, selector: string): any | null {
    const key = this.generateKey('extract', { url, selector }, { 
      normalize: true,
      includeTimestamp: true,
      precision: 'fuzzy',
    });
    return this.get(key);
  }
}

/**
 * Global cache manager
 */
export class CacheManager {
  private navigationCache: NavigationCache;
  private elementCache: ElementCache;
  private dataCache: DataCache;

  constructor() {
    this.navigationCache = new NavigationCache();
    this.elementCache = new ElementCache();
    this.dataCache = new DataCache();
  }

  getNavigationCache(): NavigationCache {
    return this.navigationCache;
  }

  getElementCache(): ElementCache {
    return this.elementCache;
  }

  getDataCache(): DataCache {
    return this.dataCache;
  }

  clearAll(): void {
    this.navigationCache.clear();
    this.elementCache.clear();
    this.dataCache.clear();
  }

  getStats(): Record<string, CacheStats> {
    return {
      navigation: this.navigationCache.getStats(),
      element: this.elementCache.getStats(),
      data: this.dataCache.getStats(),
    };
  }

  stop(): void {
    this.navigationCache.stop();
    this.elementCache.stop();
    this.dataCache.stop();
  }
}

/**
 * Global cache manager instance
 */
export const globalCacheManager = new CacheManager();