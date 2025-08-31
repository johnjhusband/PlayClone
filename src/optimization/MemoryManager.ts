/**
 * Memory Manager - Optimize memory usage and prevent leaks
 */

import { Page, BrowserContext } from 'playwright-core';

/**
 * Memory statistics
 */
export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  pageCount: number;
  contextCount: number;
  listenerCount: number;
  timerCount: number;
}

/**
 * Memory threshold configuration
 */
export interface MemoryThresholds {
  maxHeapUsed: number;
  maxPageCount: number;
  maxContextCount: number;
  maxListenerCount: number;
  maxTimerCount: number;
  warningLevel: number;
  criticalLevel: number;
}

/**
 * Resource tracking
 */
interface TrackedResource {
  id: string;
  type: 'page' | 'context' | 'listener' | 'timer' | 'buffer';
  created: number;
  size?: number;
  reference: WeakRef<any>;
}

/**
 * Memory Manager class
 */
export class MemoryManager {
  private thresholds: MemoryThresholds;
  private resources: Map<string, TrackedResource>;
  private pages: WeakMap<Page, string>;
  private contexts: WeakMap<BrowserContext, string>;
  private timers: Set<NodeJS.Timeout>;
  private listeners: Map<any, Set<Function>>;
  private monitorInterval?: NodeJS.Timeout;
  private gcForced: number;
  private lastGC: number;

  constructor(thresholds: Partial<MemoryThresholds> = {}) {
    this.thresholds = {
      maxHeapUsed: 500 * 1024 * 1024, // 500MB
      maxPageCount: 20,
      maxContextCount: 10,
      maxListenerCount: 1000,
      maxTimerCount: 100,
      warningLevel: 0.8,
      criticalLevel: 0.95,
      ...thresholds,
    };

    this.resources = new Map();
    this.pages = new WeakMap();
    this.contexts = new WeakMap();
    this.timers = new Set();
    this.listeners = new Map();
    this.gcForced = 0;
    this.lastGC = Date.now();

    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Register a page for tracking
   */
  registerPage(page: Page): string {
    const id = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.pages.set(page, id);
    this.resources.set(id, {
      id,
      type: 'page',
      created: Date.now(),
      reference: new WeakRef(page),
    });

    // Auto-cleanup on page close
    page.once('close', () => {
      this.unregisterPage(page);
    });

    return id;
  }

  /**
   * Unregister a page
   */
  unregisterPage(page: Page): void {
    const id = this.pages.get(page);
    if (id) {
      this.resources.delete(id);
      this.pages.delete(page);
    }
  }

  /**
   * Register a context for tracking
   */
  registerContext(context: BrowserContext): string {
    const id = `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.contexts.set(context, id);
    this.resources.set(id, {
      id,
      type: 'context',
      created: Date.now(),
      reference: new WeakRef(context),
    });

    return id;
  }

  /**
   * Unregister a context
   */
  unregisterContext(context: BrowserContext): void {
    const id = this.contexts.get(context);
    if (id) {
      this.resources.delete(id);
      this.contexts.delete(context);
    }
  }

  /**
   * Register a timer
   */
  registerTimer(timer: NodeJS.Timeout): void {
    this.timers.add(timer);
  }

  /**
   * Unregister a timer
   */
  unregisterTimer(timer: NodeJS.Timeout): void {
    this.timers.delete(timer);
  }

  /**
   * Register event listeners
   */
  registerListener(target: any, listener: Function): void {
    if (!this.listeners.has(target)) {
      this.listeners.set(target, new Set());
    }
    this.listeners.get(target)!.add(listener);
  }

  /**
   * Unregister event listeners
   */
  unregisterListener(target: any, listener?: Function): void {
    if (!listener) {
      this.listeners.delete(target);
    } else {
      const listeners = this.listeners.get(target);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.listeners.delete(target);
        }
      }
    }
  }

  /**
   * Get current memory statistics
   */
  getStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    
    // Count active resources
    let pageCount = 0;
    let contextCount = 0;
    
    for (const resource of this.resources.values()) {
      if (resource.reference.deref()) {
        if (resource.type === 'page') pageCount++;
        if (resource.type === 'context') contextCount++;
      }
    }

    // Count listeners
    let listenerCount = 0;
    for (const listeners of this.listeners.values()) {
      listenerCount += listeners.size;
    }

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0,
      pageCount,
      contextCount,
      listenerCount,
      timerCount: this.timers.size,
    };
  }

  /**
   * Check memory usage against thresholds
   */
  checkMemory(): 'ok' | 'warning' | 'critical' {
    const stats = this.getStats();
    
    // Check heap usage
    const heapUsageRatio = stats.heapUsed / this.thresholds.maxHeapUsed;
    
    if (heapUsageRatio >= this.thresholds.criticalLevel) {
      return 'critical';
    }
    
    if (heapUsageRatio >= this.thresholds.warningLevel) {
      return 'warning';
    }

    // Check resource counts
    if (
      stats.pageCount > this.thresholds.maxPageCount ||
      stats.contextCount > this.thresholds.maxContextCount ||
      stats.listenerCount > this.thresholds.maxListenerCount ||
      stats.timerCount > this.thresholds.maxTimerCount
    ) {
      return 'warning';
    }

    return 'ok';
  }

  /**
   * Clean up dead references
   */
  cleanupDeadReferences(): number {
    let cleaned = 0;
    const deadIds: string[] = [];

    for (const [id, resource] of this.resources.entries()) {
      if (!resource.reference.deref()) {
        deadIds.push(id);
        cleaned++;
      }
    }

    for (const id of deadIds) {
      this.resources.delete(id);
    }

    return cleaned;
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): void {
    if (global.gc) {
      const now = Date.now();
      
      // Limit GC frequency
      if (now - this.lastGC < 5000) {
        return;
      }

      global.gc();
      this.gcForced++;
      this.lastGC = now;
    }
  }

  /**
   * Optimize memory usage
   */
  async optimize(): Promise<void> {
    // Clean up dead references
    this.cleanupDeadReferences();

    // Close old pages
    await this.closeOldPages();

    // Clear timer references
    this.clearExpiredTimers();

    // Remove orphaned listeners
    this.removeOrphanedListeners();

    // Force GC if critical
    const status = this.checkMemory();
    if (status === 'critical') {
      this.forceGC();
    }
  }

  /**
   * Close old pages
   */
  private async closeOldPages(): Promise<void> {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    const toClose: Page[] = [];

    for (const resource of this.resources.values()) {
      if (resource.type === 'page' && now - resource.created > maxAge) {
        const page = resource.reference.deref() as Page | undefined;
        if (page && !page.isClosed()) {
          toClose.push(page);
        }
      }
    }

    for (const page of toClose) {
      try {
        await page.close();
      } catch (error) {
        // Page might already be closed
      }
    }
  }

  /**
   * Clear expired timers
   */
  private clearExpiredTimers(): void {
    // Note: This is a simplified implementation
    // In practice, you'd need to track timer metadata
    const maxTimers = this.thresholds.maxTimerCount;
    
    if (this.timers.size > maxTimers) {
      const toRemove = this.timers.size - maxTimers;
      const timersArray = Array.from(this.timers);
      
      for (let i = 0; i < toRemove; i++) {
        const timer = timersArray[i];
        clearTimeout(timer);
        clearInterval(timer);
        this.timers.delete(timer);
      }
    }
  }

  /**
   * Remove orphaned listeners
   */
  private removeOrphanedListeners(): void {
    const toRemove: any[] = [];

    for (const target of this.listeners.keys()) {
      // Check if target is still valid
      if (!target || (typeof target === 'object' && !Object.keys(target).length)) {
        toRemove.push(target);
      }
    }

    for (const target of toRemove) {
      this.listeners.delete(target);
    }
  }

  /**
   * Start memory monitoring
   */
  private startMonitoring(): void {
    this.monitorInterval = setInterval(() => {
      this.monitorMemory();
    }, 10000); // Every 10 seconds
  }

  /**
   * Monitor memory usage
   */
  private async monitorMemory(): Promise<void> {
    const status = this.checkMemory();
    
    if (status === 'warning') {
      console.warn('Memory usage warning:', this.getStats());
      await this.optimize();
    } else if (status === 'critical') {
      console.error('Critical memory usage:', this.getStats());
      await this.optimize();
      
      // Emergency cleanup
      await this.emergencyCleanup();
    }
  }

  /**
   * Emergency cleanup for critical memory situations
   */
  private async emergencyCleanup(): Promise<void> {
    // Close all but the most recent pages
    const pages: Array<{ page: Page; created: number }> = [];
    
    for (const resource of this.resources.values()) {
      if (resource.type === 'page') {
        const page = resource.reference.deref() as Page | undefined;
        if (page && !page.isClosed()) {
          pages.push({ page, created: resource.created });
        }
      }
    }

    // Sort by creation time and keep only the 2 most recent
    pages.sort((a, b) => b.created - a.created);
    const toClose = pages.slice(2);

    for (const { page } of toClose) {
      try {
        await page.close();
      } catch (error) {
        // Ignore errors
      }
    }

    // Clear all caches
    this.resources.clear();
    this.listeners.clear();
    
    // Force GC
    this.forceGC();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    // Clear all timers
    for (const timer of this.timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers.clear();
  }

  /**
   * Create a memory-safe wrapper for async operations
   */
  async withMemoryLimit<T>(
    operation: () => Promise<T>,
    maxMemory: number = this.thresholds.maxHeapUsed
  ): Promise<T> {
    const startMemory = process.memoryUsage().heapUsed;
    
    // Check memory before operation
    if (startMemory > maxMemory * 0.9) {
      await this.optimize();
      this.forceGC();
    }

    try {
      return await operation();
    } finally {
      // Check memory after operation
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;
      
      if (memoryIncrease > maxMemory * 0.1) {
        console.warn(`Large memory increase detected: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        await this.optimize();
      }
    }
  }
}

/**
 * Global memory manager instance
 */
export const globalMemoryManager = new MemoryManager();

/**
 * Memory-efficient buffer pool
 */
export class BufferPool {
  private buffers: ArrayBuffer[];
  private maxBuffers: number;
  private bufferSize: number;

  constructor(bufferSize: number = 1024 * 1024, maxBuffers: number = 10) {
    this.buffers = [];
    this.bufferSize = bufferSize;
    this.maxBuffers = maxBuffers;
  }

  acquire(): ArrayBuffer {
    if (this.buffers.length > 0) {
      return this.buffers.pop()!;
    }
    return new ArrayBuffer(this.bufferSize);
  }

  release(buffer: ArrayBuffer): void {
    if (this.buffers.length < this.maxBuffers && buffer.byteLength === this.bufferSize) {
      // Clear the buffer
      new Uint8Array(buffer).fill(0);
      this.buffers.push(buffer);
    }
  }

  clear(): void {
    this.buffers = [];
  }
}

/**
 * Memory-efficient string builder
 */
export class StringBuilder {
  private chunks: string[];
  private length: number;

  constructor() {
    this.chunks = [];
    this.length = 0;
  }

  append(str: string): void {
    this.chunks.push(str);
    this.length += str.length;
  }

  toString(): string {
    const result = this.chunks.join('');
    this.clear();
    return result;
  }

  clear(): void {
    this.chunks = [];
    this.length = 0;
  }

  getLength(): number {
    return this.length;
  }
}