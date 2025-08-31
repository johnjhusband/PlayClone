/**
 * Browser crash recovery utilities for PlayClone
 * Provides mechanisms to detect and recover from browser crashes
 */

import { BrowserCrashError, PlayCloneError } from './errors';
import { withTimeout } from './timeout';

/**
 * Browser health status
 */
export interface BrowserHealth {
  /** Is browser process alive */
  alive: boolean;
  
  /** Is browser responsive */
  responsive: boolean;
  
  /** Memory usage in MB */
  memoryUsage?: number;
  
  /** CPU usage percentage */
  cpuUsage?: number;
  
  /** Number of open pages */
  pageCount?: number;
  
  /** Last health check timestamp */
  lastCheck: number;
  
  /** Number of consecutive failures */
  failureCount: number;
}

/**
 * Recovery options
 */
export interface RecoveryOptions {
  /** Maximum recovery attempts */
  maxAttempts?: number;
  
  /** Health check interval in ms */
  healthCheckInterval?: number;
  
  /** Memory threshold in MB */
  memoryThreshold?: number;
  
  /** CPU threshold percentage */
  cpuThreshold?: number;
  
  /** Auto-restart on crash */
  autoRestart?: boolean;
  
  /** Preserve state on restart */
  preserveState?: boolean;
  
  /** Recovery timeout */
  timeout?: number;
  
  /** Callback on recovery */
  onRecover?: (attempt: number) => void;
  
  /** Callback on health check */
  onHealthCheck?: (health: BrowserHealth) => void;
}

/**
 * Browser recovery manager
 */
export class BrowserRecoveryManager {
  private health: BrowserHealth = {
    alive: false,
    responsive: false,
    lastCheck: 0,
    failureCount: 0,
  };
  
  private healthCheckTimer?: NodeJS.Timer;
  private browserInstance: any;
  private stateSnapshot: any;
  private isRecovering = false;
  
  constructor(
    private options: RecoveryOptions = {}
  ) {
    this.options = {
      maxAttempts: 3,
      healthCheckInterval: 30000, // 30 seconds
      memoryThreshold: 2048, // 2GB
      cpuThreshold: 90, // 90%
      autoRestart: true,
      preserveState: true,
      timeout: 60000, // 1 minute
      ...options,
    };
  }
  
  /**
   * Set browser instance to monitor
   */
  setBrowser(browser: any): void {
    this.browserInstance = browser;
    this.health.alive = true;
    this.health.responsive = true;
    this.health.lastCheck = Date.now();
    this.health.failureCount = 0;
    
    // Start health monitoring
    this.startHealthMonitoring();
  }
  
  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer as any);
    }
    
    this.healthCheckTimer = setInterval(
      () => this.checkHealth(),
      this.options.healthCheckInterval!
    );
    
    // Initial health check
    this.checkHealth();
  }
  
  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer as any);
      this.healthCheckTimer = undefined;
    }
  }
  
  /**
   * Check browser health
   */
  async checkHealth(): Promise<BrowserHealth> {
    if (!this.browserInstance) {
      this.health.alive = false;
      this.health.responsive = false;
      return this.health;
    }
    
    try {
      // Check if browser process is alive
      const isConnected = await this.isBrowserConnected();
      this.health.alive = isConnected;
      
      if (!isConnected) {
        this.health.responsive = false;
        this.health.failureCount++;
        
        if (this.options.autoRestart && !this.isRecovering) {
          await this.recover();
        }
        
        return this.health;
      }
      
      // Check responsiveness with a simple operation
      const responsive = await this.checkResponsiveness();
      this.health.responsive = responsive;
      
      if (!responsive) {
        this.health.failureCount++;
      } else {
        this.health.failureCount = 0;
      }
      
      // Get resource usage if possible
      const resources = await this.getResourceUsage();
      if (resources) {
        this.health.memoryUsage = resources.memory;
        this.health.cpuUsage = resources.cpu;
        this.health.pageCount = resources.pages;
        
        // Check resource thresholds
        if (resources.memory > this.options.memoryThreshold!) {
          console.warn(`High memory usage: ${resources.memory}MB`);
          // Consider graceful restart
          if (this.options.autoRestart) {
            await this.gracefulRestart();
          }
        }
        
        if (resources.cpu > this.options.cpuThreshold!) {
          console.warn(`High CPU usage: ${resources.cpu}%`);
        }
      }
      
      this.health.lastCheck = Date.now();
      
      // Notify health check callback
      this.options.onHealthCheck?.(this.health);
      
      return this.health;
      
    } catch (error) {
      this.health.alive = false;
      this.health.responsive = false;
      this.health.failureCount++;
      
      if (this.options.autoRestart && !this.isRecovering) {
        await this.recover();
      }
      
      return this.health;
    }
  }
  
  /**
   * Check if browser is connected
   */
  private async isBrowserConnected(): Promise<boolean> {
    try {
      if (!this.browserInstance) return false;
      
      // Try to get browser version (simple connectivity check)
      await withTimeout(
        this.browserInstance.version(),
        5000,
        'browser-connectivity-check'
      );
      
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Check browser responsiveness
   */
  private async checkResponsiveness(): Promise<boolean> {
    try {
      if (!this.browserInstance) return false;
      
      // Create a test page and evaluate simple script
      const page = await withTimeout(
        this.browserInstance.newPage(),
        10000,
        'responsiveness-check'
      );
      
      const result = await withTimeout(
        (page as any).evaluate(() => 1 + 1),
        5000,
        'evaluate-check'
      );
      
      await (page as any).close();
      
      return result === 2;
    } catch {
      return false;
    }
  }
  
  /**
   * Get browser resource usage
   */
  private async getResourceUsage(): Promise<{
    memory: number;
    cpu: number;
    pages: number;
  } | null> {
    try {
      if (!this.browserInstance) return null;
      
      // Get all pages
      const pages = await this.browserInstance.pages();
      
      // Try to get process metrics (if supported)
      // This is browser-specific and might not be available
      let memory = 0;
      let cpu = 0;
      
      // Estimate memory usage based on page count
      // Rough estimate: 50-100MB per page
      memory = pages.length * 75;
      
      return {
        memory,
        cpu,
        pages: pages.length,
      };
    } catch {
      return null;
    }
  }
  
  /**
   * Recover from browser crash
   */
  async recover(): Promise<void> {
    if (this.isRecovering) {
      return; // Already recovering
    }
    
    this.isRecovering = true;
    let lastError: any;
    
    try {
      for (let attempt = 1; attempt <= this.options.maxAttempts!; attempt++) {
        try {
          console.log(`Recovery attempt ${attempt}/${this.options.maxAttempts}`);
          
          // Notify recovery callback
          this.options.onRecover?.(attempt);
          
          // Save current state if needed
          if (this.options.preserveState && !this.stateSnapshot) {
            await this.saveState();
          }
          
          // Close existing browser if still connected
          await this.closeBrowser();
          
          // Wait a bit before restarting
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Restart browser
          await this.restartBrowser();
          
          // Restore state if saved
          if (this.options.preserveState && this.stateSnapshot) {
            await this.restoreState();
          }
          
          // Verify browser is working
          const health = await this.checkHealth();
          if (health.alive && health.responsive) {
            console.log('Browser recovered successfully');
            this.isRecovering = false;
            return;
          }
          
          throw new Error('Browser not responsive after restart');
          
        } catch (error) {
          lastError = error;
          console.error(`Recovery attempt ${attempt} failed:`, error);
          
          if (attempt < this.options.maxAttempts!) {
            // Wait before next attempt with exponential backoff
            const delay = Math.min(5000 * attempt, 30000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      throw new BrowserCrashError(
        'Failed to recover browser after all attempts',
        {
          attempts: this.options.maxAttempts,
          lastError,
        }
      );
      
    } finally {
      this.isRecovering = false;
    }
  }
  
  /**
   * Graceful restart with state preservation
   */
  async gracefulRestart(): Promise<void> {
    console.log('Initiating graceful browser restart...');
    
    // Save state first
    if (this.options.preserveState) {
      await this.saveState();
    }
    
    // Close browser gracefully
    await this.closeBrowser();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Restart
    await this.restartBrowser();
    
    // Restore state
    if (this.options.preserveState && this.stateSnapshot) {
      await this.restoreState();
    }
    
    console.log('Graceful restart completed');
  }
  
  /**
   * Save browser state
   */
  private async saveState(): Promise<void> {
    if (!this.browserInstance) return;
    
    try {
      const pages = await this.browserInstance.pages();
      this.stateSnapshot = {
        urls: [],
        cookies: [],
        localStorage: [],
        sessionStorage: [],
        timestamp: Date.now(),
      };
      
      for (const page of pages) {
        try {
          const url = page.url();
          if (url && url !== 'about:blank') {
            // Save page URL
            this.stateSnapshot.urls.push(url);
            
            // Save cookies
            const cookies = await page.context().cookies();
            this.stateSnapshot.cookies.push(...cookies);
            
            // Save storage (if possible)
            try {
              const localStorage = await page.evaluate(() => {
                const items: Record<string, string> = {};
                for (let i = 0; i < window.localStorage.length; i++) {
                  const key = window.localStorage.key(i);
                  if (key) {
                    items[key] = window.localStorage.getItem(key) || '';
                  }
                }
                return items;
              });
              this.stateSnapshot.localStorage.push({ url, data: localStorage });
            } catch {
              // Storage might not be accessible
            }
          }
        } catch {
          // Page might be closed or invalid
        }
      }
      
      console.log(`State saved: ${this.stateSnapshot.urls.length} pages`);
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }
  
  /**
   * Restore browser state
   */
  private async restoreState(): Promise<void> {
    if (!this.browserInstance || !this.stateSnapshot) return;
    
    try {
      console.log('Restoring browser state...');
      
      // Restore cookies
      if (this.stateSnapshot.cookies.length > 0) {
        const context = await this.browserInstance.newContext();
        await context.addCookies(this.stateSnapshot.cookies);
      }
      
      // Restore pages
      for (const url of this.stateSnapshot.urls) {
        try {
          const page = await this.browserInstance.newPage();
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          
          // Restore localStorage if available
          const storageData = this.stateSnapshot.localStorage.find(
            (item: any) => item.url === url
          );
          if (storageData) {
            await page.evaluate((data: any) => {
              Object.entries(data).forEach(([key, value]) => {
                window.localStorage.setItem(key, value as string);
              });
            }, storageData.data);
          }
        } catch {
          // Page restoration might fail
        }
      }
      
      console.log('State restored successfully');
      
      // Clear snapshot after restoration
      this.stateSnapshot = null;
    } catch (error) {
      console.error('Failed to restore state:', error);
    }
  }
  
  /**
   * Close browser safely
   */
  private async closeBrowser(): Promise<void> {
    if (!this.browserInstance) return;
    
    try {
      await withTimeout(
        this.browserInstance.close(),
        10000,
        'browser-close'
      );
    } catch {
      // Force close if graceful close fails
      try {
        if (this.browserInstance.process) {
          this.browserInstance.process().kill('SIGKILL');
        }
      } catch {
        // Process might already be dead
      }
    }
    
    this.browserInstance = null;
  }
  
  /**
   * Restart browser
   */
  private async restartBrowser(): Promise<void> {
    // This should be implemented by the BrowserManager
    // For now, throw an error to indicate manual intervention needed
    throw new PlayCloneError(
      'Browser restart requires BrowserManager intervention',
      'RESTART_REQUIRED',
      {
        suggestion: 'Use BrowserManager.launch() to create a new browser instance',
      }
    );
  }
  
  /**
   * Get current health status
   */
  getHealth(): BrowserHealth {
    return { ...this.health };
  }
  
  /**
   * Force health check
   */
  async forceHealthCheck(): Promise<BrowserHealth> {
    return this.checkHealth();
  }
}

/**
 * Crash detector that monitors for specific crash patterns
 */
export class CrashDetector {
  private patterns: Array<{
    name: string;
    pattern: RegExp | ((error: any) => boolean);
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> = [
    {
      name: 'browser_crashed',
      pattern: /browser\s+(crashed|closed|disconnected)/i,
      severity: 'critical',
    },
    {
      name: 'target_closed',
      pattern: /target\s+(closed|crashed)/i,
      severity: 'high',
    },
    {
      name: 'pipe_closed',
      pattern: /pipe\s+(closed|ended)/i,
      severity: 'critical',
    },
    {
      name: 'websocket_error',
      pattern: /websocket.*error/i,
      severity: 'high',
    },
    {
      name: 'protocol_error',
      pattern: /protocol\s+error/i,
      severity: 'medium',
    },
    {
      name: 'navigation_failed',
      pattern: /navigation\s+failed/i,
      severity: 'low',
    },
    {
      name: 'timeout',
      pattern: /timeout/i,
      severity: 'low',
    },
    {
      name: 'out_of_memory',
      pattern: /out\s+of\s+memory/i,
      severity: 'critical',
    },
  ];
  
  /**
   * Detect if error indicates a crash
   */
  detect(error: any): {
    isCrash: boolean;
    type?: string;
    severity?: string;
  } {
    const message = error?.message || error?.toString() || '';
    
    for (const { name, pattern, severity } of this.patterns) {
      let matches = false;
      
      if (pattern instanceof RegExp) {
        matches = pattern.test(message);
      } else {
        matches = pattern(error);
      }
      
      if (matches) {
        return {
          isCrash: severity === 'critical' || severity === 'high',
          type: name,
          severity,
        };
      }
    }
    
    return { isCrash: false };
  }
  
  /**
   * Add custom crash pattern
   */
  addPattern(
    name: string,
    pattern: RegExp | ((error: any) => boolean),
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    this.patterns.push({ name, pattern, severity });
  }
}

/**
 * Recovery strategies for different crash types
 */
export const RecoveryStrategies = {
  /**
   * Simple restart
   */
  restart: async (manager: BrowserRecoveryManager) => {
    await manager.gracefulRestart();
  },
  
  /**
   * Clear cache and restart
   */
  clearAndRestart: async (manager: BrowserRecoveryManager) => {
    // Clear any cached data
    await manager.gracefulRestart();
  },
  
  /**
   * Wait and retry
   */
  waitAndRetry: async (manager: BrowserRecoveryManager, delay = 5000) => {
    await new Promise(resolve => setTimeout(resolve, delay));
    await manager.forceHealthCheck();
  },
  
  /**
   * Escalate to manual intervention
   */
  escalate: async () => {
    throw new BrowserCrashError(
      'Browser crash requires manual intervention',
      {
        suggestion: 'Restart the application or check system resources',
      }
    );
  },
};