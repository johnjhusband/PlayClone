/**
 * Connection Pool - Efficient browser instance management
 */

import { Browser, BrowserContext, Page } from 'playwright-core';
import { BrowserManager } from '../core/BrowserManager';
import { PlayCloneError } from '../utils/errors';
import { ConfigManager } from '../config/ConfigManager';

/**
 * Pool connection state
 */
export interface PoolConnection {
  id: string;
  browser: Browser;
  context: BrowserContext;
  pages: Map<string, Page>;
  inUse: boolean;
  lastUsed: number;
  created: number;
  requestCount: number;
  errors: number;
}

/**
 * Pool configuration
 */
export interface PoolConfig {
  minConnections: number;
  maxConnections: number;
  maxIdleTime: number;
  maxLifetime: number;
  maxRequestsPerConnection: number;
  connectionTimeout: number;
  recycleOnError: boolean;
  warmupOnStart: boolean;
}

/**
 * Pool statistics
 */
export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalRequests: number;
  totalErrors: number;
  averageWaitTime: number;
  connectionReuse: number;
}

/**
 * Connection Pool class
 */
export class ConnectionPool {
  private config: PoolConfig;
  private connections: Map<string, PoolConnection>;
  private waitQueue: Array<(conn: PoolConnection) => void>;
  private browserManager: BrowserManager;
  private stats: PoolStats;
  private recycleTimer?: NodeJS.Timeout;
  private closed: boolean;
  private configManager: ConfigManager;
  private adaptiveScalingTimer?: NodeJS.Timeout;
  private lastScaleAction: number = 0;

  constructor(config: Partial<PoolConfig> = {}) {
    // Get configuration from manager
    this.configManager = ConfigManager.getInstance();
    const poolConfig = this.configManager.get('connectionPool') || {};
    
    // Map ConfigManager settings to PoolConfig
    const defaultConfig: PoolConfig = {
      minConnections: poolConfig.minSize || 1,
      maxConnections: poolConfig.maxSize || 5,
      maxIdleTime: poolConfig.idleTimeout || 300000,
      maxLifetime: 3600000, // 1 hour default
      maxRequestsPerConnection: 1000,
      connectionTimeout: 30000,
      recycleOnError: true,
      warmupOnStart: poolConfig.preWarm || false,
    };
    
    // Merge with provided config (provided config takes precedence)
    this.config = {
      ...defaultConfig,
      ...config,
    };

    this.connections = new Map();
    this.waitQueue = [];
    this.browserManager = new BrowserManager();
    this.closed = false;

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalRequests: 0,
      totalErrors: 0,
      averageWaitTime: 0,
      connectionReuse: 0,
    };

    // Start maintenance cycle
    this.startMaintenanceCycle();

    // Start adaptive scaling if enabled (check connection pool config)
    if (poolConfig.enabled !== false) {
      this.startAdaptiveScaling();
    }

    // Warmup pool if configured
    if (this.config.warmupOnStart) {
      this.warmup();
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<PoolConnection> {
    if (this.closed) {
      throw new PlayCloneError('Connection pool is closed', 'POOL_CLOSED');
    }

    const startTime = Date.now();
    this.stats.totalRequests++;

    // Try to find an idle connection
    const idleConnection = this.findIdleConnection();
    if (idleConnection) {
      idleConnection.inUse = true;
      idleConnection.lastUsed = Date.now();
      idleConnection.requestCount++;
      this.stats.activeConnections++;
      this.stats.idleConnections--;
      this.stats.connectionReuse++;
      this.updateWaitTime(startTime);
      return idleConnection;
    }

    // Create new connection if under limit
    if (this.connections.size < this.config.maxConnections) {
      const connection = await this.createConnection();
      connection.inUse = true;
      this.stats.activeConnections++;
      this.updateWaitTime(startTime);
      return connection;
    }

    // Wait for a connection to become available
    return this.waitForConnection(startTime);
  }

  /**
   * Release a connection back to the pool
   */
  release(connection: PoolConnection): void {
    if (!connection || !this.connections.has(connection.id)) {
      return;
    }

    connection.inUse = false;
    connection.lastUsed = Date.now();
    this.stats.activeConnections--;
    this.stats.idleConnections++;

    // Check if connection needs recycling
    if (this.shouldRecycle(connection)) {
      this.recycleConnection(connection);
      return;
    }

    // Process wait queue
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift();
      if (waiter) {
        connection.inUse = true;
        connection.requestCount++;
        this.stats.activeConnections++;
        this.stats.idleConnections--;
        this.stats.waitingRequests--;
        waiter(connection);
      }
    }
  }

  /**
   * Find an idle connection
   */
  private findIdleConnection(): PoolConnection | null {
    for (const connection of this.connections.values()) {
      if (!connection.inUse && !this.shouldRecycle(connection)) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<PoolConnection> {
    const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const launchResult = await this.browserManager.launch();
      
      if (!launchResult.success) {
        throw new Error(`Failed to launch browser: ${launchResult.error}`);
      }

      const browser = await this.browserManager.getBrowser();
      if (!browser) {
        throw new Error('Browser not available after launch');
      }

      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });

      const connection: PoolConnection = {
        id,
        browser,
        context,
        pages: new Map(),
        inUse: false,
        lastUsed: Date.now(),
        created: Date.now(),
        requestCount: 0,
        errors: 0,
      };

      this.connections.set(id, connection);
      this.stats.totalConnections++;
      this.stats.idleConnections++;

      return connection;
    } catch (error) {
      this.stats.totalErrors++;
      throw new PlayCloneError(
        `Failed to create connection: ${error}`,
        'POOL_CONNECTION_ERROR'
      );
    }
  }

  /**
   * Wait for a connection to become available
   */
  private waitForConnection(startTime: number): Promise<PoolConnection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.indexOf(resolve as any);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
          this.stats.waitingRequests--;
        }
        reject(new PlayCloneError(
          'Connection acquisition timeout',
          'POOL_TIMEOUT'
        ));
      }, this.config.connectionTimeout);

      this.stats.waitingRequests++;
      
      this.waitQueue.push((connection) => {
        clearTimeout(timeout);
        this.updateWaitTime(startTime);
        resolve(connection);
      });
    });
  }

  /**
   * Check if connection needs recycling
   */
  private shouldRecycle(connection: PoolConnection): boolean {
    const now = Date.now();
    
    // Recycle on error threshold
    if (this.config.recycleOnError && connection.errors > 3) {
      return true;
    }

    // Recycle on max lifetime
    if (now - connection.created > this.config.maxLifetime) {
      return true;
    }

    // Recycle on max requests
    if (connection.requestCount >= this.config.maxRequestsPerConnection) {
      return true;
    }

    return false;
  }

  /**
   * Recycle a connection
   */
  private async recycleConnection(connection: PoolConnection): Promise<void> {
    try {
      // Close all pages
      for (const page of connection.pages.values()) {
        await page.close().catch(() => {});
      }
      
      // Close context
      await connection.context.close().catch(() => {});
      
      // Close browser
      await connection.browser.close().catch(() => {});
    } catch (error) {
      console.error(`Error recycling connection ${connection.id}:`, error);
    } finally {
      this.connections.delete(connection.id);
      this.stats.totalConnections--;
      
      // Create replacement if below minimum
      if (this.connections.size < this.config.minConnections && !this.closed) {
        this.createConnection().catch(() => {});
      }
    }
  }

  /**
   * Start maintenance cycle
   */
  private startMaintenanceCycle(): void {
    this.recycleTimer = setInterval(() => {
      this.performMaintenance();
    }, 10000); // Every 10 seconds
  }

  /**
   * Perform maintenance tasks
   */
  private async performMaintenance(): Promise<void> {
    if (this.closed) return;

    const now = Date.now();
    const connectionsToRecycle: PoolConnection[] = [];

    // Check idle connections
    for (const connection of this.connections.values()) {
      if (!connection.inUse) {
        // Remove idle connections over limit
        if (this.connections.size > this.config.minConnections &&
            now - connection.lastUsed > this.config.maxIdleTime) {
          connectionsToRecycle.push(connection);
        }
        // Recycle old connections
        else if (this.shouldRecycle(connection)) {
          connectionsToRecycle.push(connection);
        }
      }
    }

    // Recycle connections
    for (const connection of connectionsToRecycle) {
      await this.recycleConnection(connection);
    }

    // Ensure minimum connections
    while (this.connections.size < this.config.minConnections && !this.closed) {
      await this.createConnection().catch(() => {});
    }
  }

  /**
   * Warmup the pool
   */
  private async warmup(): Promise<void> {
    const promises: Promise<PoolConnection>[] = [];
    
    for (let i = 0; i < this.config.minConnections; i++) {
      promises.push(this.createConnection());
    }

    await Promise.allSettled(promises);
  }

  /**
   * Update average wait time
   */
  private updateWaitTime(startTime: number): void {
    const waitTime = Date.now() - startTime;
    this.stats.averageWaitTime = 
      (this.stats.averageWaitTime * (this.stats.totalRequests - 1) + waitTime) / 
      this.stats.totalRequests;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return { ...this.stats };
  }

  /**
   * Get or create a page for a connection
   */
  async getPage(connection: PoolConnection, pageId: string = 'default'): Promise<Page> {
    if (!connection.pages.has(pageId)) {
      const page = await connection.context.newPage();
      connection.pages.set(pageId, page);
    }
    return connection.pages.get(pageId)!;
  }

  /**
   * Report an error for a connection
   */
  reportError(connection: PoolConnection): void {
    connection.errors++;
    this.stats.totalErrors++;
    
    if (this.config.recycleOnError && connection.errors > 3) {
      this.release(connection);
    }
  }

  /**
   * Start adaptive scaling
   */
  private startAdaptiveScaling(): void {
    // Check scaling every 5 seconds
    this.adaptiveScalingTimer = setInterval(() => {
      this.performAdaptiveScaling();
    }, 5000);
  }

  /**
   * Perform adaptive scaling based on pool utilization
   */
  private async performAdaptiveScaling(): Promise<void> {
    if (this.closed) return;

    // Use default scaling settings for now
    const scalingSettings = {
      enabled: true,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.2
    };
    if (!scalingSettings.enabled) return;

    // Calculate utilization
    const utilization = this.stats.activeConnections / Math.max(this.connections.size, 1);
    const now = Date.now();
    
    // Prevent rapid scaling actions (minimum 10 seconds between scales)
    if (now - this.lastScaleAction < 10000) return;

    // Scale up if utilization is high and we haven't reached max
    if (utilization > scalingSettings.scaleUpThreshold && 
        this.connections.size < this.config.maxConnections) {
      const connectionsToAdd = Math.min(
        2, // Add up to 2 connections at a time
        this.config.maxConnections - this.connections.size
      );
      
      console.log(`Scaling up: Adding ${connectionsToAdd} connections (utilization: ${(utilization * 100).toFixed(1)}%)`);
      
      for (let i = 0; i < connectionsToAdd; i++) {
        await this.createConnection().catch(() => {});
      }
      
      this.lastScaleAction = now;
    }
    
    // Scale down if utilization is low and we're above minimum
    else if (utilization < scalingSettings.scaleDownThreshold && 
             this.connections.size > this.config.minConnections) {
      const idleConnections = Array.from(this.connections.values())
        .filter(conn => !conn.inUse)
        .sort((a, b) => a.lastUsed - b.lastUsed);
      
      const connectionsToRemove = Math.min(
        1, // Remove 1 connection at a time
        this.connections.size - this.config.minConnections,
        idleConnections.length
      );
      
      if (connectionsToRemove > 0) {
        console.log(`Scaling down: Removing ${connectionsToRemove} connections (utilization: ${(utilization * 100).toFixed(1)}%)`);
        
        for (let i = 0; i < connectionsToRemove; i++) {
          await this.recycleConnection(idleConnections[i]);
        }
        
        this.lastScaleAction = now;
      }
    }
  }

  /**
   * Update pool configuration dynamically
   */
  updateConfig(newConfig: Partial<PoolConfig>): void {
    // Update configuration manager with mapped config
    this.configManager.updateSection('connectionPool', {
      minSize: newConfig.minConnections,
      maxSize: newConfig.maxConnections,
      idleTimeout: newConfig.maxIdleTime,
      preWarm: newConfig.warmupOnStart
    });
    
    // Update local config
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    // Validate against current state
    this.validatePoolSize();
  }

  /**
   * Validate and adjust pool size based on new configuration
   */
  private async validatePoolSize(): Promise<void> {
    // Ensure we have minimum connections
    while (this.connections.size < this.config.minConnections && !this.closed) {
      await this.createConnection().catch(() => {});
    }
    
    // Remove excess connections if above maximum
    if (this.connections.size > this.config.maxConnections) {
      const idleConnections = Array.from(this.connections.values())
        .filter(conn => !conn.inUse)
        .sort((a, b) => a.lastUsed - b.lastUsed);
      
      const toRemove = this.connections.size - this.config.maxConnections;
      for (let i = 0; i < Math.min(toRemove, idleConnections.length); i++) {
        await this.recycleConnection(idleConnections[i]);
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PoolConfig {
    return { ...this.config };
  }

  /**
   * Close the pool
   */
  async close(): Promise<void> {
    this.closed = true;

    // Clear timers
    if (this.recycleTimer) {
      clearInterval(this.recycleTimer);
    }
    if (this.adaptiveScalingTimer) {
      clearInterval(this.adaptiveScalingTimer);
    }

    // Reject waiting requests
    for (const waiter of this.waitQueue) {
      waiter(null as any);
    }
    this.waitQueue = [];

    // Close all connections
    const closePromises: Promise<void>[] = [];
    for (const connection of this.connections.values()) {
      closePromises.push(this.recycleConnection(connection));
    }

    await Promise.allSettled(closePromises);
    this.connections.clear();
  }

  /**
   * Execute a function with a pooled connection
   */
  async withConnection<T>(
    fn: (connection: PoolConnection) => Promise<T>
  ): Promise<T> {
    const connection = await this.acquire();
    
    try {
      return await fn(connection);
    } catch (error) {
      this.reportError(connection);
      throw error;
    } finally {
      this.release(connection);
    }
  }
}

/**
 * Global connection pool instance
 */
let globalPool: ConnectionPool | null = null;

/**
 * Get or create global connection pool
 */
export function getGlobalPool(config?: Partial<PoolConfig>): ConnectionPool {
  if (!globalPool) {
    // Use provided config or empty config for defaults
    globalPool = new ConnectionPool(config || {});
  } else if (config) {
    // Update existing pool configuration
    globalPool.updateConfig(config);
  }
  return globalPool;
}

/**
 * Close global connection pool
 */
export async function closeGlobalPool(): Promise<void> {
  if (globalPool) {
    await globalPool.close();
    globalPool = null;
  }
}