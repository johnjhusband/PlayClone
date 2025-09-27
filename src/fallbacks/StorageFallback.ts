/**
 * StorageFallback - Provides fallback storage strategies when primary storage fails
 * 
 * Handles failures for:
 * - Redis unavailability
 * - Database connection issues
 * - File system restrictions
 * - Memory constraints
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';

interface StorageProvider {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}

class InMemoryStorage implements StorageProvider {
  private store: Map<string, { value: any; expires?: number }> = new Map();

  async get(key: string): Promise<any> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expires = ttl ? Date.now() + ttl : undefined;
    this.store.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys());
    if (!pattern) return allKeys;
    
    const regex = new RegExp(pattern.replace('*', '.*'));
    return allKeys.filter(key => regex.test(key));
  }
}

class FileStorage implements StorageProvider {
  private readonly storageDir: string;

  constructor(baseDir?: string) {
    this.storageDir = baseDir || path.join(process.cwd(), '.playclone-storage');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(this.storageDir, `${hash}.json`);
  }

  async get(key: string): Promise<any> {
    const filePath = this.getFilePath(key);
    
    try {
      if (!fs.existsSync(filePath)) return null;
      
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      if (data.expires && Date.now() > data.expires) {
        fs.unlinkSync(filePath);
        return null;
      }
      
      return data.value;
    } catch (error) {
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const filePath = this.getFilePath(key);
    const expires = ttl ? Date.now() + ttl : undefined;
    
    const data = { key, value, expires, timestamp: Date.now() };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async has(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    return fs.existsSync(filePath);
  }

  async clear(): Promise<void> {
    const files = fs.readdirSync(this.storageDir);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(this.storageDir, file));
      }
    });
  }

  async keys(pattern?: string): Promise<string[]> {
    const files = fs.readdirSync(this.storageDir);
    const keys: string[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const data = JSON.parse(
            fs.readFileSync(path.join(this.storageDir, file), 'utf-8')
          );
          if (data.key) {
            if (!pattern || new RegExp(pattern.replace('*', '.*')).test(data.key)) {
              keys.push(data.key);
            }
          }
        } catch {}
      }
    }
    
    return keys;
  }
}

class IndexedDBStorage implements StorageProvider {
  private db: any = null;
  private readonly dbName = 'playclone-storage';
  private readonly storeName = 'data';

  async initialize(): Promise<void> {
    // This would only work in browser environment
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB not available');
    }
    
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  async get(key: string): Promise<any> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.expires && Date.now() > result.expires) {
          this.delete(key);
          resolve(null);
        } else {
          resolve(result ? result.value : null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const expires = ttl ? Date.now() + ttl : undefined;
      
      const request = store.put({ key, value, expires });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async clear(): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async keys(pattern?: string): Promise<string[]> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();
      
      request.onsuccess = () => {
        let keys = request.result;
        if (pattern) {
          const regex = new RegExp(pattern.replace('*', '.*'));
          keys = keys.filter((key: string) => regex.test(key));
        }
        resolve(keys);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export class StorageFallback extends EventEmitter {
  private readonly logger = new Logger('StorageFallback');
  private providers: StorageProvider[] = [];
  private currentProvider: StorageProvider | null = null;
  private readonly maxMemoryUsage = 100 * 1024 * 1024; // 100MB

  constructor() {
    super();
    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    // Try Redis first (if available)
    try {
      const redis = await this.createRedisProvider();
      if (redis) {
        this.providers.push(redis);
        this.logger.info('Redis storage provider initialized');
      }
    } catch (error) {
      this.logger.debug('Redis not available, using fallbacks');
    }

    // Add file storage
    try {
      const fileStorage = new FileStorage();
      this.providers.push(fileStorage);
      this.logger.info('File storage provider initialized');
    } catch (error) {
      this.logger.warn('File storage initialization failed');
    }

    // Add in-memory storage (always available)
    const memoryStorage = new InMemoryStorage();
    this.providers.push(memoryStorage);
    this.logger.info('In-memory storage provider initialized');

    // Try IndexedDB if in browser
    if (typeof window !== 'undefined') {
      try {
        const indexedDB = new IndexedDBStorage();
        await indexedDB.initialize();
        this.providers.push(indexedDB);
        this.logger.info('IndexedDB storage provider initialized');
      } catch (error) {
        this.logger.debug('IndexedDB not available');
      }
    }

    // Select the first available provider
    this.currentProvider = this.providers[0];
  }

  private async createRedisProvider(): Promise<StorageProvider | null> {
    try {
      // Dynamic import to avoid hard dependency
      let redisModule: any;
      try {
        redisModule = require('redis');
      } catch {
        // Redis not installed, return null
        return null;
      }
      
      if (!redisModule) return null;

      const client = redisModule.createClient({
        socket: {
          connectTimeout: 1000,
          reconnectStrategy: false as any
        }
      });

      await client.connect();

      return {
        async get(key: string) {
          return JSON.parse(await client.get(key) || 'null');
        },
        async set(key: string, value: any, ttl?: number) {
          const serialized = JSON.stringify(value);
          if (ttl) {
            await client.setEx(key, Math.floor(ttl / 1000), serialized);
          } else {
            await client.set(key, serialized);
          }
        },
        async delete(key: string) {
          await client.del(key);
        },
        async has(key: string) {
          return (await client.exists(key)) > 0;
        },
        async clear() {
          await client.flushDb();
        },
        async keys(pattern?: string) {
          return await client.keys(pattern || '*');
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get value with automatic fallback
   */
  async get(key: string): Promise<any> {
    for (const provider of this.providers) {
      try {
        const value = await provider.get(key);
        if (value !== null) {
          // Migrate to primary provider if different
          if (provider !== this.providers[0] && this.providers[0]) {
            try {
              await this.providers[0].set(key, value);
            } catch {}
          }
          return value;
        }
      } catch (error) {
        this.logger.debug(`Provider failed for get: ${error}`);
      }
    }
    return null;
  }

  /**
   * Set value with automatic fallback
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    let success = false;
    
    for (const provider of this.providers) {
      try {
        await provider.set(key, value, ttl);
        success = true;
        // Don't break - try to set in all providers for redundancy
      } catch (error) {
        this.logger.debug(`Provider failed for set: ${error}`);
      }
    }
    
    if (!success) {
      throw new Error('All storage providers failed');
    }
  }

  /**
   * Delete value from all providers
   */
  async delete(key: string): Promise<void> {
    for (const provider of this.providers) {
      try {
        await provider.delete(key);
      } catch (error) {
        this.logger.debug(`Provider failed for delete: ${error}`);
      }
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    for (const provider of this.providers) {
      try {
        if (await provider.has(key)) {
          return true;
        }
      } catch (error) {
        this.logger.debug(`Provider failed for has: ${error}`);
      }
    }
    return false;
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    for (const provider of this.providers) {
      try {
        await provider.clear();
      } catch (error) {
        this.logger.debug(`Provider failed for clear: ${error}`);
      }
    }
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = new Set<string>();
    
    for (const provider of this.providers) {
      try {
        const keys = await provider.keys(pattern);
        keys.forEach(key => allKeys.add(key));
      } catch (error) {
        this.logger.debug(`Provider failed for keys: ${error}`);
      }
    }
    
    return Array.from(allKeys);
  }

  /**
   * Get storage statistics
   */
  getStats(): any {
    return {
      providers: this.providers.length,
      currentProvider: this.currentProvider?.constructor.name,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    await this.clear();
  }

  /**
   * Check memory pressure and switch providers if needed
   */
  private checkMemoryPressure(): void {
    const usage = process.memoryUsage();
    if (usage.heapUsed > this.maxMemoryUsage) {
      this.logger.warn('Memory pressure detected, switching to file storage');
      // Switch to file storage if available
      const fileProvider = this.providers.find(p => p instanceof FileStorage);
      if (fileProvider) {
        this.currentProvider = fileProvider;
      }
    }
  }
}