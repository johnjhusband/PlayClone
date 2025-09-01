/**
 * Intelligent Wait Strategies based on page behavior patterns
 * Adapts wait times and conditions based on page characteristics
 */

import { Page } from 'playwright-core';
import { ActionResult } from '../types';
import { formatResponse, formatError } from '../utils/responseFormatter';

export interface WaitPattern {
  name: string;
  description: string;
  detector: () => Promise<boolean>;
  waitFor: () => Promise<void>;
  timeout?: number;
  priority?: number;
}

export interface PageCharacteristics {
  isSPA: boolean; // Single Page Application
  hasInfiniteScroll: boolean;
  hasLazyLoading: boolean;
  hasWebSocket: boolean;
  hasPolling: boolean;
  framework?: string; // React, Angular, Vue, etc.
  avgLoadTime?: number;
  networkActivity?: 'idle' | 'low' | 'medium' | 'high';
}

export interface WaitStrategy {
  name: string;
  condition: string;
  timeout: number;
  interval: number;
  backoff: boolean;
}

export class IntelligentWaitStrategies {
  private page: Page;
  private patterns: Map<string, WaitPattern> = new Map();
  private characteristics: PageCharacteristics | null = null;
  private performanceHistory: Map<string, number[]> = new Map();

  constructor(page: Page) {
    this.page = page;
    this.initializePatterns();
  }

  /**
   * Initialize common wait patterns
   */
  private initializePatterns(): void {
    // React application pattern
    this.patterns.set('react-render', {
      name: 'React Render Complete',
      description: 'Wait for React components to finish rendering',
      detector: async () => {
        return await this.page.evaluate(() => {
          return !!(window as any).React || !!(document.querySelector('[data-reactroot]'));
        });
      },
      waitFor: async () => {
        await this.page.evaluate(() => {
          return new Promise<void>((resolve) => {
            if ((window as any).React && (window as any).React.unstable_batchedUpdates) {
              (window as any).React.unstable_batchedUpdates(() => {
                setTimeout(resolve, 0);
              });
            } else {
              // Fallback: wait for React fiber work to complete
              requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
              });
            }
          });
        });
      },
      timeout: 5000,
      priority: 10
    });

    // Angular application pattern
    this.patterns.set('angular-stable', {
      name: 'Angular Stable',
      description: 'Wait for Angular to become stable',
      detector: async () => {
        return await this.page.evaluate(() => {
          return !!(window as any).getAllAngularTestabilities || 
                 !!(window as any).ng;
        });
      },
      waitFor: async () => {
        await this.page.evaluate(() => {
          return new Promise<void>((resolve) => {
            if ((window as any).getAllAngularTestabilities) {
              const testabilities = (window as any).getAllAngularTestabilities();
              let count = testabilities.length;
              testabilities.forEach((testability: any) => {
                testability.whenStable(() => {
                  count--;
                  if (count === 0) resolve();
                });
              });
            } else {
              resolve();
            }
          });
        });
      },
      timeout: 5000,
      priority: 10
    });

    // Vue application pattern
    this.patterns.set('vue-updated', {
      name: 'Vue Updated',
      description: 'Wait for Vue to finish updating',
      detector: async () => {
        return await this.page.evaluate(() => {
          return !!(window as any).Vue || !!(document.querySelector('[data-v-]'));
        });
      },
      waitFor: async () => {
        await this.page.evaluate(() => {
          return new Promise<void>((resolve) => {
            if ((window as any).Vue) {
              (window as any).Vue.nextTick(resolve);
            } else {
              requestAnimationFrame(() => resolve());
            }
          });
        });
      },
      timeout: 3000,
      priority: 10
    });

    // AJAX requests pattern
    this.patterns.set('ajax-complete', {
      name: 'AJAX Complete',
      description: 'Wait for all AJAX requests to complete',
      detector: async () => {
        return await this.page.evaluate(() => {
          return !!(window as any).jQuery || !!(window as any).$ || !!(window as any).fetch;
        });
      },
      waitFor: async () => {
        await this.page.evaluate(() => {
          return new Promise<void>((resolve) => {
            let pendingRequests = 0;
            
            // jQuery AJAX
            if ((window as any).jQuery) {
              pendingRequests = (window as any).jQuery.active || 0;
            }
            
            // Monitor fetch requests
            const originalFetch = window.fetch;
            let fetchCount = 0;
            
            window.fetch = function(...args) {
              fetchCount++;
              return originalFetch.apply(this, args).finally(() => {
                fetchCount--;
                if (fetchCount === 0 && pendingRequests === 0) {
                  window.fetch = originalFetch;
                  resolve();
                }
              });
            };
            
            // Check if already idle
            if (pendingRequests === 0 && fetchCount === 0) {
              window.fetch = originalFetch;
              resolve();
            }
            
            // Timeout fallback
            setTimeout(() => {
              window.fetch = originalFetch;
              resolve();
            }, 3000);
          });
        });
      },
      timeout: 10000,
      priority: 5
    });

    // Infinite scroll pattern
    this.patterns.set('infinite-scroll', {
      name: 'Infinite Scroll',
      description: 'Wait for infinite scroll content to load',
      detector: async () => {
        return await this.page.evaluate(() => {
          const scrollHeight = document.documentElement.scrollHeight;
          const clientHeight = document.documentElement.clientHeight;
          return scrollHeight > clientHeight * 2;
        });
      },
      waitFor: async () => {
        let previousHeight = 0;
        let stableCount = 0;
        
        while (stableCount < 3) {
          const currentHeight = await this.page.evaluate(() => document.documentElement.scrollHeight);
          
          if (currentHeight === previousHeight) {
            stableCount++;
          } else {
            stableCount = 0;
            previousHeight = currentHeight;
          }
          
          await this.page.waitForTimeout(500);
        }
      },
      timeout: 15000,
      priority: 3
    });

    // Lazy loading images pattern
    this.patterns.set('lazy-images', {
      name: 'Lazy Images',
      description: 'Wait for lazy-loaded images in viewport',
      detector: async () => {
        return await this.page.evaluate(() => {
          return document.querySelectorAll('img[loading="lazy"], img[data-src]').length > 0;
        });
      },
      waitFor: async () => {
        await this.page.evaluate(() => {
          return new Promise<void>((resolve) => {
            const images = document.querySelectorAll('img[loading="lazy"], img[data-src]');
            let loadedCount = 0;
            const totalImages = images.length;
            
            if (totalImages === 0) {
              resolve();
              return;
            }
            
            images.forEach((img: any) => {
              if (img.complete) {
                loadedCount++;
                if (loadedCount === totalImages) resolve();
              } else {
                img.addEventListener('load', () => {
                  loadedCount++;
                  if (loadedCount === totalImages) resolve();
                });
                img.addEventListener('error', () => {
                  loadedCount++;
                  if (loadedCount === totalImages) resolve();
                });
              }
            });
            
            // Timeout fallback
            setTimeout(resolve, 5000);
          });
        });
      },
      timeout: 10000,
      priority: 2
    });
  }

  /**
   * Analyze page characteristics
   */
  async analyzePageCharacteristics(): Promise<PageCharacteristics> {
    try {
      const characteristics = await this.page.evaluate(() => {
        const result: any = {
          isSPA: false,
          hasInfiniteScroll: false,
          hasLazyLoading: false,
          hasWebSocket: false,
          hasPolling: false,
          framework: undefined
        };

        // Detect SPA
        result.isSPA = !!(window as any).history?.pushState || 
                       !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
                       !!(window as any).angular ||
                       !!(window as any).Vue;

        // Detect framework
        if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ || (window as any).React) {
          result.framework = 'React';
        } else if ((window as any).angular || (window as any).ng) {
          result.framework = 'Angular';
        } else if ((window as any).Vue) {
          result.framework = 'Vue';
        } else if ((window as any).Ember) {
          result.framework = 'Ember';
        }

        // Detect infinite scroll
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;
        result.hasInfiniteScroll = scrollHeight > clientHeight * 3;

        // Detect lazy loading
        result.hasLazyLoading = document.querySelectorAll('[loading="lazy"], [data-src]').length > 0;

        // Detect WebSocket
        result.hasWebSocket = 'WebSocket' in window;

        // Detect polling (simplified check)
        result.hasPolling = !!(window as any).setInterval;

        return result;
      });

      // Measure average load time
      const timing = await this.page.evaluate(() => {
        const perf = window.performance.timing;
        return perf.loadEventEnd - perf.navigationStart;
      });

      characteristics.avgLoadTime = timing;

      // Analyze network activity
      characteristics.networkActivity = await this.getNetworkActivity();

      this.characteristics = characteristics;
      return characteristics;

    } catch (error) {
      console.error('Failed to analyze page characteristics:', error);
      return {
        isSPA: false,
        hasInfiniteScroll: false,
        hasLazyLoading: false,
        hasWebSocket: false,
        hasPolling: false
      };
    }
  }

  /**
   * Get optimal wait strategy for current page
   */
  async getOptimalStrategy(action: string = 'default'): Promise<WaitStrategy> {
    if (!this.characteristics) {
      await this.analyzePageCharacteristics();
    }

    const char = this.characteristics!;
    
    // Base strategy
    let strategy: WaitStrategy = {
      name: 'default',
      condition: 'networkidle',
      timeout: 5000,
      interval: 100,
      backoff: false
    };

    // Adjust for SPA
    if (char.isSPA) {
      strategy.name = 'spa-optimized';
      strategy.condition = 'domcontentloaded';
      strategy.timeout = 8000;
      strategy.backoff = true;
      
      // Framework-specific adjustments
      if (char.framework === 'React') {
        strategy.interval = 50;
      } else if (char.framework === 'Angular') {
        strategy.interval = 150;
      }
    }

    // Adjust for infinite scroll
    if (char.hasInfiniteScroll) {
      strategy.timeout = 15000;
      strategy.condition = 'custom-scroll-stable';
    }

    // Adjust for lazy loading
    if (char.hasLazyLoading) {
      strategy.timeout = Math.max(strategy.timeout, 10000);
    }

    // Adjust based on historical performance
    const history = this.performanceHistory.get(action);
    if (history && history.length > 3) {
      const avgTime = history.reduce((a, b) => a + b, 0) / history.length;
      strategy.timeout = Math.min(Math.max(avgTime * 1.5, 3000), 30000);
    }

    // Adjust based on network activity
    if (char.networkActivity === 'high') {
      strategy.timeout *= 1.5;
      strategy.interval *= 2;
    } else if (char.networkActivity === 'idle') {
      strategy.timeout *= 0.75;
    }

    return strategy;
  }

  /**
   * Smart wait with adaptive strategy
   */
  async smartWait(options: {
    action?: string;
    selector?: string;
    text?: string;
    maxTimeout?: number;
  } = {}): Promise<ActionResult> {
    const startTime = Date.now();
    
    try {
      // Get optimal strategy
      const strategy = await this.getOptimalStrategy(options.action);
      const maxTimeout = options.maxTimeout || strategy.timeout;

      // Detect applicable patterns
      const applicablePatterns: WaitPattern[] = [];
      for (const [, pattern] of this.patterns) {
        if (await pattern.detector()) {
          applicablePatterns.push(pattern);
        }
      }

      // Sort by priority
      applicablePatterns.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      // Execute wait patterns
      const waitPromises: Promise<void>[] = [];

      // Add pattern-specific waits
      for (const pattern of applicablePatterns.slice(0, 3)) {
        waitPromises.push(
          Promise.race([
            pattern.waitFor(),
            new Promise<void>((_, reject) => 
              setTimeout(() => reject(new Error(`${pattern.name} timeout`)), pattern.timeout || 5000)
            )
          ]).catch(() => {})
        );
      }

      // Add selector wait if specified
      if (options.selector) {
        waitPromises.push(
          this.page.waitForSelector(options.selector, {
            timeout: maxTimeout,
            state: 'visible'
          }).then(() => {}).catch(() => {})
        );
      }

      // Add text wait if specified
      if (options.text) {
        waitPromises.push(
          this.page.waitForFunction(
            (text) => document.body?.innerText?.includes(text),
            options.text,
            { timeout: maxTimeout }
          ).then(() => {}).catch(() => {})
        );
      }

      // Wait for network idle if appropriate
      if (strategy.condition === 'networkidle' && !this.characteristics?.isSPA) {
        waitPromises.push(
          this.page.waitForLoadState('networkidle', { timeout: maxTimeout })
            .then(() => {}).catch(() => {})
        );
      }

      // Execute all waits with race condition
      await Promise.race([
        Promise.all(waitPromises),
        new Promise((resolve) => setTimeout(resolve, maxTimeout))
      ]);

      const duration = Date.now() - startTime;

      // Record performance for learning
      if (options.action) {
        const history = this.performanceHistory.get(options.action) || [];
        history.push(duration);
        if (history.length > 10) history.shift();
        this.performanceHistory.set(options.action, history);
      }

      return formatResponse({
        success: true,
        action: 'ai_operation',
        timestamp: Date.now(),
        value: {
          waited: true,
          duration,
          strategy: strategy.name,
          patterns: applicablePatterns.map(p => p.name)
        }
      });

    } catch (error) {
      return formatError(error as Error, 'Smart wait failed');
    }
  }

  /**
   * Wait for page stability
   */
  async waitForStability(options: {
    checkInterval?: number;
    maxChecks?: number;
    stabilityThreshold?: number;
  } = {}): Promise<ActionResult> {
    const {
      checkInterval = 500,
      maxChecks = 20,
      stabilityThreshold = 3
    } = options;

    try {
      let stableCount = 0;
      let previousState = '';
      let checks = 0;

      while (stableCount < stabilityThreshold && checks < maxChecks) {
        const currentState = await this.page.evaluate(() => {
          const elements = document.querySelectorAll('*');
          const state = {
            elementCount: elements.length,
            bodyHeight: document.body?.scrollHeight || 0,
            htmlContent: document.documentElement.innerHTML.length
          };
          return JSON.stringify(state);
        });

        if (currentState === previousState) {
          stableCount++;
        } else {
          stableCount = 0;
          previousState = currentState;
        }

        checks++;
        await this.page.waitForTimeout(checkInterval);
      }

      return formatResponse({
        success: true,
        action: 'ai_operation',
        timestamp: Date.now(),
        value: {
          stable: stableCount >= stabilityThreshold,
          checks,
          duration: checks * checkInterval
        }
      });

    } catch (error) {
      return formatError(error as Error, 'Stability check failed');
    }
  }

  /**
   * Get current network activity level
   */
  private async getNetworkActivity(): Promise<'idle' | 'low' | 'medium' | 'high'> {
    try {
      const activity = await this.page.evaluate(() => {
        let activeRequests = 0;
        
        // Check jQuery active requests
        if ((window as any).jQuery) {
          activeRequests += (window as any).jQuery.active || 0;
        }
        
        // Check for pending promises (simplified)
        const hasActivity = document.readyState !== 'complete';
        
        if (activeRequests === 0 && !hasActivity) return 'idle';
        if (activeRequests < 3) return 'low';
        if (activeRequests < 10) return 'medium';
        return 'high';
      });
      
      return activity as any;
    } catch {
      return 'low';
    }
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.performanceHistory.clear();
  }
}
