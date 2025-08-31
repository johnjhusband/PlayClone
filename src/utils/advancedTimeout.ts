/**
 * Advanced Timeout Manager for Complex Sites
 */

import { Page } from 'playwright-core';

export interface TimeoutStrategy {
  name: string;
  navigationTimeout?: number;
  actionTimeout?: number;
  waitForSelectorTimeout?: number;
  networkIdleTimeout?: number;
  domContentLoadedTimeout?: number;
  retryAttempts?: number;
  exponentialBackoff?: boolean;
}

export const TIMEOUT_STRATEGIES: Record<string, TimeoutStrategy> = {
  fast: {
    name: 'fast',
    navigationTimeout: 10000,
    actionTimeout: 5000,
    waitForSelectorTimeout: 5000,
    networkIdleTimeout: 5000,
    domContentLoadedTimeout: 5000,
    retryAttempts: 2,
    exponentialBackoff: false
  },
  standard: {
    name: 'standard',
    navigationTimeout: 30000,
    actionTimeout: 10000,
    waitForSelectorTimeout: 10000,
    networkIdleTimeout: 10000,
    domContentLoadedTimeout: 10000,
    retryAttempts: 3,
    exponentialBackoff: true
  },
  patient: {
    name: 'patient',
    navigationTimeout: 60000,
    actionTimeout: 20000,
    waitForSelectorTimeout: 20000,
    networkIdleTimeout: 15000,
    domContentLoadedTimeout: 15000,
    retryAttempts: 4,
    exponentialBackoff: true
  },
  spa: {
    name: 'spa',
    navigationTimeout: 45000,
    actionTimeout: 15000,
    waitForSelectorTimeout: 25000,
    networkIdleTimeout: 20000,
    domContentLoadedTimeout: 20000,
    retryAttempts: 5,
    exponentialBackoff: true
  },
  aggressive: {
    name: 'aggressive',
    navigationTimeout: 90000,
    actionTimeout: 30000,
    waitForSelectorTimeout: 30000,
    networkIdleTimeout: 25000,
    domContentLoadedTimeout: 25000,
    retryAttempts: 6,
    exponentialBackoff: true
  }
};

export class AdvancedTimeoutManager {
  private page: Page;
  private strategy: TimeoutStrategy;
  private siteProfiles: Map<string, TimeoutStrategy> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();
  
  constructor(page: Page, strategy: TimeoutStrategy = TIMEOUT_STRATEGIES.standard) {
    this.page = page;
    this.strategy = strategy;
    this.initializeSiteProfiles();
  }

  /**
   * Initialize known site-specific timeout profiles
   */
  private initializeSiteProfiles(): void {
    // Search engines need patient handling
    this.siteProfiles.set('google.com', TIMEOUT_STRATEGIES.patient);
    this.siteProfiles.set('duckduckgo.com', TIMEOUT_STRATEGIES.aggressive);
    this.siteProfiles.set('bing.com', TIMEOUT_STRATEGIES.patient);
    
    // Social media sites are complex SPAs
    this.siteProfiles.set('facebook.com', TIMEOUT_STRATEGIES.spa);
    this.siteProfiles.set('twitter.com', TIMEOUT_STRATEGIES.spa);
    this.siteProfiles.set('linkedin.com', TIMEOUT_STRATEGIES.spa);
    this.siteProfiles.set('instagram.com', TIMEOUT_STRATEGIES.spa);
    
    // News sites can be heavy
    this.siteProfiles.set('cnn.com', TIMEOUT_STRATEGIES.patient);
    this.siteProfiles.set('bbc.com', TIMEOUT_STRATEGIES.standard);
    this.siteProfiles.set('nytimes.com', TIMEOUT_STRATEGIES.patient);
    
    // Developer sites
    this.siteProfiles.set('github.com', TIMEOUT_STRATEGIES.spa);
    this.siteProfiles.set('stackoverflow.com', TIMEOUT_STRATEGIES.standard);
    this.siteProfiles.set('developer.mozilla.org', TIMEOUT_STRATEGIES.standard);
    
    // E-commerce
    this.siteProfiles.set('amazon.com', TIMEOUT_STRATEGIES.patient);
    this.siteProfiles.set('ebay.com', TIMEOUT_STRATEGIES.patient);
    this.siteProfiles.set('walmart.com', TIMEOUT_STRATEGIES.patient);
  }

  /**
   * Get optimal timeout strategy for current site
   */
  getStrategyForSite(): TimeoutStrategy {
    const url = this.page.url();
    const hostname = new URL(url).hostname.replace('www.', '');
    
    // Check if we have a specific profile for this site
    if (this.siteProfiles.has(hostname)) {
      return this.siteProfiles.get(hostname)!;
    }
    
    // Use adaptive strategy based on performance history
    const metrics = this.performanceMetrics.get(hostname);
    if (metrics && metrics.length > 0) {
      const avgTime = metrics.reduce((a, b) => a + b, 0) / metrics.length;
      if (avgTime > 20000) return TIMEOUT_STRATEGIES.aggressive;
      if (avgTime > 10000) return TIMEOUT_STRATEGIES.patient;
      if (avgTime > 5000) return TIMEOUT_STRATEGIES.standard;
      return TIMEOUT_STRATEGIES.fast;
    }
    
    return this.strategy;
  }

  /**
   * Record performance metric for adaptive learning
   */
  recordMetric(duration: number): void {
    const url = this.page.url();
    const hostname = new URL(url).hostname.replace('www.', '');
    
    if (!this.performanceMetrics.has(hostname)) {
      this.performanceMetrics.set(hostname, []);
    }
    
    const metrics = this.performanceMetrics.get(hostname)!;
    metrics.push(duration);
    
    // Keep only last 10 metrics
    if (metrics.length > 10) {
      metrics.shift();
    }
  }

  /**
   * Wait for page to be ready with intelligent strategies
   */
  async waitForPageReady(options?: { 
    waitFor?: 'load' | 'domcontentloaded' | 'networkidle' | 'custom';
    customCheck?: () => Promise<boolean>;
  }): Promise<void> {
    const strategy = this.getStrategyForSite();
    const startTime = Date.now();
    
    try {
      const waitFor = options?.waitFor || 'networkidle';
      
      switch (waitFor) {
        case 'load':
          await this.page.waitForLoadState('load', { 
            timeout: strategy.navigationTimeout 
          });
          break;
          
        case 'domcontentloaded':
          await this.page.waitForLoadState('domcontentloaded', { 
            timeout: strategy.domContentLoadedTimeout 
          });
          break;
          
        case 'networkidle':
          await Promise.race([
            this.page.waitForLoadState('networkidle', { 
              timeout: strategy.networkIdleTimeout 
            }),
            this.page.waitForTimeout(strategy.networkIdleTimeout!)
          ]);
          break;
          
        case 'custom':
          if (options?.customCheck) {
            const timeout = strategy.navigationTimeout || 30000;
            const interval = 500;
            const maxAttempts = timeout / interval;
            
            for (let i = 0; i < maxAttempts; i++) {
              if (await options.customCheck()) {
                break;
              }
              await this.page.waitForTimeout(interval);
            }
          }
          break;
      }
      
      // Record successful timing
      this.recordMetric(Date.now() - startTime);
      
    } catch (error) {
      // Try fallback strategies
      await this.fallbackWaitStrategies(strategy);
    }
  }

  /**
   * Fallback wait strategies for when primary fails
   */
  private async fallbackWaitStrategies(_strategy: TimeoutStrategy): Promise<void> {
    try {
      // Strategy 1: Wait for any activity
      await Promise.race([
        this.page.waitForTimeout(3000),
        this.page.waitForLoadState('domcontentloaded', { timeout: 5000 })
      ]);
      
      // Strategy 2: Check for common indicators
      const indicators = [
        'body',
        '#app',
        '#root',
        '.main',
        '[data-reactroot]',
        '[ng-app]'
      ];
      
      for (const indicator of indicators) {
        try {
          await this.page.waitForSelector(indicator, { 
            timeout: 2000, 
            state: 'visible' 
          });
          break;
        } catch {
          continue;
        }
      }
      
      // Strategy 3: Wait for JavaScript frameworks
      await this.page.evaluate(() => {
        return new Promise((resolve) => {
          // Check for common framework ready states
          const win = window as any;
          if (typeof win.jQuery !== 'undefined') {
            win.jQuery(() => resolve(true));
          } else if (typeof win.angular !== 'undefined') {
            win.angular.element(document).ready(() => resolve(true));
          } else if (document.readyState === 'complete') {
            resolve(true);
          } else {
            window.addEventListener('load', () => resolve(true));
          }
          
          // Timeout after 3 seconds anyway
          setTimeout(() => resolve(true), 3000);
        });
      });
      
    } catch {
      // Final fallback: just wait a bit
      await this.page.waitForTimeout(2000);
    }
  }

  /**
   * Execute action with retry and timeout management
   */
  async executeWithRetry<T>(
    action: () => Promise<T>,
    actionName: string = 'action'
  ): Promise<T> {
    const strategy = this.getStrategyForSite();
    const maxAttempts = strategy.retryAttempts || 3;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Set timeout for this attempt
        const timeout = strategy.exponentialBackoff 
          ? strategy.actionTimeout! * Math.pow(1.5, attempt - 1)
          : strategy.actionTimeout!;
        
        const result = await Promise.race([
          action(),
          new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`${actionName} timeout after ${timeout}ms`)), timeout)
          )
        ]);
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        if (attempt < maxAttempts) {
          // Wait before retry with exponential backoff
          const delay = strategy.exponentialBackoff 
            ? 1000 * Math.pow(2, attempt - 1)
            : 1000;
          
          await this.page.waitForTimeout(delay);
        }
      }
    }
    
    throw lastError || new Error(`${actionName} failed after ${maxAttempts} attempts`);
  }

  /**
   * Set custom timeout strategy
   */
  setStrategy(strategy: TimeoutStrategy | string): void {
    if (typeof strategy === 'string') {
      this.strategy = TIMEOUT_STRATEGIES[strategy] || TIMEOUT_STRATEGIES.standard;
    } else {
      this.strategy = strategy;
    }
  }

  /**
   * Get current timeout values
   */
  getCurrentTimeouts(): TimeoutStrategy {
    return this.getStrategyForSite();
  }
}