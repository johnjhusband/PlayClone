/**
 * InfiniteScrollHandler - Advanced infinite scroll detection and handling
 * Intelligently detects, manages, and automates infinite scrolling patterns
 */

import { Page } from 'playwright';
import { ActionResult } from '../types';
import { formatResponse, formatError } from '../utils/responseFormatter';

export interface InfiniteScrollOptions {
  maxScrolls?: number;
  maxDuration?: number;
  scrollSpeed?: 'slow' | 'normal' | 'fast';
  waitBetweenScrolls?: number;
  stopOnDuplicates?: boolean;
  extractContent?: boolean;
  customScrollTarget?: string;
  onNewContent?: (content: any) => Promise<void>;
  scrollThreshold?: number;
  detectEndOfContent?: boolean;
}

export interface ScrollDetectionResult {
  hasInfiniteScroll: boolean;
  scrollType: 'window' | 'container' | 'virtual' | 'lazy-load' | 'unknown';
  scrollContainer?: string;
  triggerMechanism: 'scroll' | 'intersection-observer' | 'mutation-observer' | 'ajax' | 'unknown';
  contentPattern: 'append' | 'replace' | 'virtual-list' | 'unknown';
  estimatedTotalItems?: number;
  currentLoadedItems?: number;
  hasReachedEnd?: boolean;
}

export interface ScrollProgress {
  scrollCount: number;
  itemsLoaded: number;
  uniqueItems: number;
  duplicatesFound: number;
  totalScrollDistance: number;
  timeElapsed: number;
  reachedEnd: boolean;
  stopReason?: 'max_scrolls' | 'max_duration' | 'end_reached' | 'no_new_content' | 'duplicates' | 'error';
}

export interface InfiniteScrollResult extends ActionResult {
  data?: {
    detection: ScrollDetectionResult;
    progress: ScrollProgress;
    collectedContent?: any[];
    performanceMetrics?: {
      avgLoadTime: number;
      avgItemsPerScroll: number;
      scrollEfficiency: number;
    };
  };
}

export class InfiniteScrollHandler {
  private page: Page;
  private scrollCount: number = 0;
  private collectedItems: Set<string> = new Set();
  private collectedContent: any[] = [];
  private duplicateCount: number = 0;
  private startTime: number = 0;
  private totalScrollDistance: number = 0;
  private loadTimes: number[] = [];
  private itemsPerScroll: number[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Detect infinite scroll capabilities on the current page
   */
  async detectInfiniteScroll(): Promise<ScrollDetectionResult> {
    try {
      const detection = await this.page.evaluate(() => {
        const result: any = {
          hasInfiniteScroll: false,
          scrollType: 'unknown',
          triggerMechanism: 'unknown',
          contentPattern: 'unknown'
        };

        // Check for window scroll
        const windowScrollable = document.documentElement.scrollHeight > window.innerHeight;
        if (windowScrollable) {
          result.scrollType = 'window';
        }

        // Check for scrollable containers
        const scrollableElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          return (
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight
          );
        });

        if (scrollableElements.length > 0) {
          result.scrollType = 'container';
          // Get the most likely infinite scroll container
          const container = scrollableElements.find(el => 
            el.classList.toString().match(/scroll|feed|list|items|content|results/i) ||
            el.id.match(/scroll|feed|list|items|content|results/i)
          ) || scrollableElements[0];
          
          if (container) {
            result.scrollContainer = container.tagName.toLowerCase() + 
              (container.id ? `#${container.id}` : '') +
              (container.className ? `.${container.className.split(' ')[0]}` : '');
          }
        }

        // Check for virtual scrolling
        const hasVirtualScroll = !!(
          document.querySelector('[role="feed"]') ||
          document.querySelector('[data-virtual-scroll]') ||
          document.querySelector('.virtual-scroll') ||
          document.querySelector('[style*="transform: translateY"]')
        );

        if (hasVirtualScroll) {
          result.scrollType = 'virtual';
          result.contentPattern = 'virtual-list';
        }

        // Check for Intersection Observer (common for infinite scroll)
        if ('IntersectionObserver' in window) {
          // Check if there are sentinel elements
          const sentinels = document.querySelectorAll(
            '[data-infinite-scroll-sentinel], .infinite-scroll-sentinel, .load-more-trigger, [data-observe]'
          );
          
          if (sentinels.length > 0) {
            result.triggerMechanism = 'intersection-observer';
            result.hasInfiniteScroll = true;
          }
        }

        // Check for scroll event listeners
        const hasScrollListeners = () => {
          const scrollElements = [window, document, document.body, ...scrollableElements];
          for (const el of scrollElements) {
            // This is a heuristic - we can't directly access event listeners
            if (el && typeof (el as any).onscroll === 'function') {
              return true;
            }
          }
          return false;
        };

        if (hasScrollListeners()) {
          result.triggerMechanism = 'scroll';
          result.hasInfiniteScroll = true;
        }

        // Check for mutation observers (content changes)
        const hasDynamicContent = !!(
          document.querySelector('[data-page]') ||
          document.querySelector('[data-offset]') ||
          document.querySelector('.ajax-loading') ||
          document.querySelector('.spinner') ||
          document.querySelector('.loader')
        );

        if (hasDynamicContent) {
          result.triggerMechanism = result.triggerMechanism === 'unknown' ? 'ajax' : result.triggerMechanism;
          result.hasInfiniteScroll = true;
        }

        // Detect content pattern
        const feedElements = document.querySelectorAll(
          'article, .post, .item, .card, [role="article"], .feed-item, .list-item'
        );

        if (feedElements.length > 5) {
          result.contentPattern = 'append';
          result.currentLoadedItems = feedElements.length;
          result.hasInfiniteScroll = true;
        }

        // Check for common infinite scroll libraries
        const hasInfiniteScrollLib = !!(
          (window as any).InfiniteScroll ||
          (window as any).Waypoint ||
          (window as any).LazyLoad ||
          document.querySelector('[data-infinite-scroll]') ||
          document.querySelector('[data-lazy-load]')
        );

        if (hasInfiniteScrollLib) {
          result.hasInfiniteScroll = true;
          if ((window as any).LazyLoad || document.querySelector('[data-lazy-load]')) {
            result.scrollType = 'lazy-load';
          }
        }

        return result;
      });

      return detection as ScrollDetectionResult;
    } catch (error) {
      console.error('Error detecting infinite scroll:', error);
      return {
        hasInfiniteScroll: false,
        scrollType: 'unknown',
        triggerMechanism: 'unknown',
        contentPattern: 'unknown'
      };
    }
  }

  /**
   * Automatically scroll through infinite content
   */
  async scrollToEnd(options: InfiniteScrollOptions = {}): Promise<InfiniteScrollResult> {
    const {
      maxScrolls = 50,
      maxDuration = 60000,
      scrollSpeed = 'normal',
      waitBetweenScrolls = 2000,
      stopOnDuplicates = true,
      extractContent = true,
      customScrollTarget,
      onNewContent,
      scrollThreshold = 0.9,
      detectEndOfContent = true
    } = options;

    this.startTime = Date.now();
    this.scrollCount = 0;
    this.duplicateCount = 0;

    try {
      const detection = await this.detectInfiniteScroll();
      
      if (!detection.hasInfiniteScroll) {
        return formatResponse({
          success: false,
          action: 'infinite_scroll',
          error: 'No infinite scroll detected on this page',
          timestamp: Date.now(),
          value: { detection, progress: this.getProgress(false, 'end_reached') }
        });
      }

      let noNewContentCount = 0;
      const maxNoNewContent = 3;

      while (this.scrollCount < maxScrolls) {
        // Check duration limit
        if (Date.now() - this.startTime > maxDuration) {
          break;
        }

        const scrollStartTime = Date.now();
        const beforeItems = await this.countCurrentItems();
        const beforeHeight = await this.getScrollHeight(customScrollTarget);

        // Perform scroll
        const scrolled = await this.performScroll(
          detection.scrollType,
          customScrollTarget,
          scrollSpeed,
          scrollThreshold
        );

        if (!scrolled) {
          // Couldn't scroll further
          if (detectEndOfContent) {
            const endDetected = await this.detectEndOfContent();
            if (endDetected) {
              break;
            }
          }
        }

        // Wait for new content to load
        await this.page.waitForTimeout(waitBetweenScrolls);

        // Check for new content
        const afterItems = await this.countCurrentItems();
        const afterHeight = await this.getScrollHeight(customScrollTarget);
        const newItemsCount = afterItems - beforeItems;

        this.itemsPerScroll.push(newItemsCount);
        this.loadTimes.push(Date.now() - scrollStartTime);

        if (afterHeight === beforeHeight && newItemsCount === 0) {
          noNewContentCount++;
          if (noNewContentCount >= maxNoNewContent) {
            // No new content after multiple scrolls
            break;
          }
        } else {
          noNewContentCount = 0;
        }

        // Extract content if requested
        if (extractContent) {
          const newContent = await this.extractNewContent();
          const uniqueNewItems = this.filterDuplicates(newContent);
          
          if (stopOnDuplicates && uniqueNewItems.length === 0) {
            this.duplicateCount += newContent.length;
            break;
          }

          this.collectedContent.push(...uniqueNewItems);
          
          if (onNewContent && uniqueNewItems.length > 0) {
            await onNewContent(uniqueNewItems);
          }
        }

        this.scrollCount++;
        this.totalScrollDistance += afterHeight - beforeHeight;

        // Check if we've reached the end
        if (detectEndOfContent) {
          const endReached = await this.detectEndOfContent();
          if (endReached) {
            break;
          }
        }
      }

      const stopReason = this.determineStopReason(
        maxScrolls,
        maxDuration,
        noNewContentCount >= maxNoNewContent
      );

      const progress = this.getProgress(
        stopReason === 'end_reached',
        stopReason
      );

      const performanceMetrics = this.calculatePerformanceMetrics();

      return formatResponse({
        success: true,
        action: 'infinite_scroll',
        timestamp: Date.now(),
        value: {
          detection,
          progress,
          collectedContent: extractContent ? this.collectedContent : undefined,
          performanceMetrics
        }
      });

    } catch (error) {
      return formatError(error as Error, 'infinite_scroll', {
        detection: { hasInfiniteScroll: false } as ScrollDetectionResult,
        progress: this.getProgress(false, 'error')
      } as any);
    }
  }

  /**
   * Smart scroll that adapts to the page's behavior
   */
  async smartScroll(options: InfiniteScrollOptions = {}): Promise<InfiniteScrollResult> {
    try {
      // First, analyze the page's scroll behavior
      const analysis = await this.analyzeScrollBehavior();
      
      // Adapt options based on analysis
      const adaptedOptions: InfiniteScrollOptions = {
        ...options,
        scrollSpeed: analysis.recommendedSpeed,
        waitBetweenScrolls: analysis.recommendedWait,
        scrollThreshold: analysis.recommendedThreshold
      };

      // Use the adapted options for scrolling
      return await this.scrollToEnd(adaptedOptions);

    } catch (error) {
      return formatError(error as Error, 'smart_scroll');
    }
  }

  /**
   * Private helper methods
   */

  private async performScroll(
    scrollType: string,
    customTarget?: string,
    speed: string = 'normal',
    threshold: number = 0.9
  ): Promise<boolean> {
    try {
      const scrollDistance = this.getScrollDistance(speed);
      
      if (customTarget) {
        // Scroll custom container
        return await this.page.evaluate(
          ({ selector, distance, threshold }) => {
            const element = document.querySelector(selector);
            if (!element) return false;
            
            const maxScroll = element.scrollHeight - element.clientHeight;
            const targetScroll = Math.min(
              element.scrollTop + distance,
              maxScroll * threshold
            );
            
            element.scrollTo({
              top: targetScroll,
              behavior: 'smooth'
            });
            
            return element.scrollTop < maxScroll;
          },
          { selector: customTarget, distance: scrollDistance, threshold }
        );
      } else if (scrollType === 'virtual') {
        // Handle virtual scrolling
        return await this.handleVirtualScroll(scrollDistance);
      } else {
        // Default window scroll
        return await this.page.evaluate(
          ({ distance, threshold }) => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            const targetScroll = Math.min(
              window.scrollY + distance,
              maxScroll * threshold
            );
            
            window.scrollTo({
              top: targetScroll,
              behavior: 'smooth'
            });
            
            return window.scrollY < maxScroll;
          },
          { distance: scrollDistance, threshold }
        );
      }
    } catch (error) {
      console.error('Error performing scroll:', error);
      return false;
    }
  }

  private async handleVirtualScroll(distance: number): Promise<boolean> {
    try {
      // For virtual scrolling, we need to trigger the virtual scroll mechanism
      return await this.page.evaluate((scrollDistance) => {
        const virtualContainer = document.querySelector(
          '[role="feed"], [data-virtual-scroll], .virtual-scroll'
        );
        
        if (!virtualContainer) return false;
        
        // Dispatch scroll event
        virtualContainer.dispatchEvent(new WheelEvent('wheel', {
          deltaY: scrollDistance,
          bubbles: true
        }));
        
        return true;
      }, distance);
    } catch {
      return false;
    }
  }

  private getScrollDistance(speed: string): number {
    switch (speed) {
      case 'slow':
        return 300;
      case 'fast':
        return 1000;
      case 'normal':
      default:
        return 600;
    }
  }

  private async getScrollHeight(customTarget?: string): Promise<number> {
    try {
      if (customTarget) {
        return await this.page.evaluate((selector) => {
          const element = document.querySelector(selector);
          return element ? element.scrollHeight : 0;
        }, customTarget);
      } else {
        return await this.page.evaluate(() => document.documentElement.scrollHeight);
      }
    } catch {
      return 0;
    }
  }

  private async countCurrentItems(): Promise<number> {
    try {
      return await this.page.evaluate(() => {
        const selectors = [
          'article',
          '.post',
          '.item',
          '.card',
          '[role="article"]',
          '.feed-item',
          '.list-item',
          '.result',
          '.product',
          '.entry'
        ];
        
        let maxCount = 0;
        for (const selector of selectors) {
          const count = document.querySelectorAll(selector).length;
          maxCount = Math.max(maxCount, count);
        }
        
        return maxCount;
      });
    } catch {
      return 0;
    }
  }

  private async extractNewContent(): Promise<any[]> {
    try {
      const content = await this.page.evaluate(() => {
        const items: any[] = [];
        const selectors = [
          'article',
          '.post',
          '.item',
          '.card',
          '[role="article"]',
          '.feed-item',
          '.list-item'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach(el => {
              const item: any = {
                id: el.id || el.getAttribute('data-id') || '',
                text: el.textContent?.trim().substring(0, 200),
                html: el.innerHTML.substring(0, 500)
              };
              
              // Extract title
              const title = el.querySelector('h1, h2, h3, h4, .title, .heading');
              if (title) {
                item.title = title.textContent?.trim();
              }
              
              // Extract link
              const link = el.querySelector('a');
              if (link) {
                item.url = link.href;
              }
              
              // Extract image
              const img = el.querySelector('img');
              if (img) {
                item.image = img.src;
              }
              
              items.push(item);
            });
            break;
          }
        }
        
        return items;
      });
      
      return content;
    } catch (error) {
      console.error('Error extracting content:', error);
      return [];
    }
  }

  private filterDuplicates(items: any[]): any[] {
    const unique: any[] = [];
    
    for (const item of items) {
      const key = item.id || item.text || item.html;
      if (key && !this.collectedItems.has(key)) {
        this.collectedItems.add(key);
        unique.push(item);
      }
    }
    
    return unique;
  }

  private async detectEndOfContent(): Promise<boolean> {
    try {
      return await this.page.evaluate(() => {
        // Check for end-of-content indicators
        const endIndicators = [
          '.no-more-content',
          '.end-of-results',
          '.no-more-items',
          '[data-end-of-list]',
          '.pagination-end',
          'text()*=*"No more"',
          'text()*=*"End of"',
          'text()*=*"That\'s all"',
          'text()*=*"You\'ve reached the end"'
        ];
        
        for (const indicator of endIndicators) {
          if (indicator.startsWith('text()')) {
            // Text search
            const searchText = indicator.replace('text()*=*', '').replace(/"/g, '');
            const hasText = document.body.textContent?.toLowerCase().includes(searchText.toLowerCase());
            if (hasText) return true;
          } else {
            // Selector search
            const element = document.querySelector(indicator);
            if (element && (element as HTMLElement).offsetParent !== null) {
              return true;
            }
          }
        }
        
        // Check if we're at the bottom and nothing is loading
        const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 10;
        const noLoader = !document.querySelector('.loader:not(.hidden), .spinner:not(.hidden), .loading:not(.hidden)');
        
        return atBottom && noLoader;
      });
    } catch {
      return false;
    }
  }

  private async analyzeScrollBehavior(): Promise<any> {
    try {
      // Perform a test scroll to analyze behavior
      const beforeHeight = await this.getScrollHeight();
      await this.performScroll('window', undefined, 'normal', 0.5);
      await this.page.waitForTimeout(1000);
      const afterHeight = await this.getScrollHeight();
      
      // Analyze load time
      const loadTime = afterHeight > beforeHeight ? 1000 : 2000;
      
      // Determine optimal settings
      return {
        recommendedSpeed: loadTime < 1500 ? 'fast' : 'normal',
        recommendedWait: Math.max(loadTime, 1500),
        recommendedThreshold: 0.8
      };
    } catch {
      return {
        recommendedSpeed: 'normal',
        recommendedWait: 2000,
        recommendedThreshold: 0.9
      };
    }
  }

  private determineStopReason(
    maxScrolls: number,
    maxDuration: number,
    noNewContent: boolean
  ): ScrollProgress['stopReason'] {
    if (this.scrollCount >= maxScrolls) {
      return 'max_scrolls';
    }
    if (Date.now() - this.startTime > maxDuration) {
      return 'max_duration';
    }
    if (noNewContent) {
      return 'no_new_content';
    }
    if (this.duplicateCount > 10) {
      return 'duplicates';
    }
    return 'end_reached';
  }

  private getProgress(reachedEnd: boolean, stopReason?: ScrollProgress['stopReason']): ScrollProgress {
    return {
      scrollCount: this.scrollCount,
      itemsLoaded: this.collectedContent.length,
      uniqueItems: this.collectedItems.size,
      duplicatesFound: this.duplicateCount,
      totalScrollDistance: this.totalScrollDistance,
      timeElapsed: Date.now() - this.startTime,
      reachedEnd,
      stopReason
    };
  }

  private calculatePerformanceMetrics(): any {
    const avgLoadTime = this.loadTimes.length > 0
      ? this.loadTimes.reduce((a, b) => a + b, 0) / this.loadTimes.length
      : 0;
    
    const avgItemsPerScroll = this.itemsPerScroll.length > 0
      ? this.itemsPerScroll.reduce((a, b) => a + b, 0) / this.itemsPerScroll.length
      : 0;
    
    const scrollEfficiency = this.scrollCount > 0
      ? this.collectedItems.size / this.scrollCount
      : 0;
    
    return {
      avgLoadTime: Math.round(avgLoadTime),
      avgItemsPerScroll: Math.round(avgItemsPerScroll * 10) / 10,
      scrollEfficiency: Math.round(scrollEfficiency * 100) / 100
    };
  }

  /**
   * Reset the handler state
   */
  reset(): void {
    this.scrollCount = 0;
    this.collectedItems.clear();
    this.collectedContent = [];
    this.duplicateCount = 0;
    this.totalScrollDistance = 0;
    this.loadTimes = [];
    this.itemsPerScroll = [];
  }

  /**
   * Get collected content
   */
  getCollectedContent(): any[] {
    return this.collectedContent;
  }

  /**
   * Get scroll statistics
   */
  getStatistics(): any {
    return {
      totalScrolls: this.scrollCount,
      uniqueItems: this.collectedItems.size,
      totalItems: this.collectedContent.length,
      duplicates: this.duplicateCount,
      totalDistance: this.totalScrollDistance,
      performanceMetrics: this.calculatePerformanceMetrics()
    };
  }
}