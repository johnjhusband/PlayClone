/**
 * PaginationHandler - Automatic pagination detection and navigation
 * Handles various pagination patterns including numbered pages, next/prev buttons,
 * load more buttons, and infinite scroll
 */

import { Page } from 'playwright';
import { ActionResult } from '../types';
import { formatResponse, formatError } from '../utils/responseFormatter';

export interface PaginationOptions {
  maxPages?: number;
  waitBetweenPages?: number;
  autoDetect?: boolean;
  customSelectors?: {
    nextButton?: string[];
    prevButton?: string[];
    pageNumbers?: string[];
    loadMore?: string[];
    currentPage?: string[];
  };
  onPageChange?: (pageNumber: number, data: any) => Promise<void>;
  extractDataOnEachPage?: boolean;
}

export interface PaginationInfo {
  type: 'numbered' | 'next-prev' | 'load-more' | 'infinite-scroll' | 'unknown';
  currentPage: number;
  totalPages?: number;
  hasNext: boolean;
  hasPrevious: boolean;
  selectors: {
    next?: string;
    previous?: string;
    pages?: string;
    loadMore?: string;
  };
}

export interface PaginationResult extends ActionResult {
  data?: {
    pagesProcessed: number;
    totalPagesFound?: number;
    paginationType: string;
    collectedData?: any[];
    stoppedReason?: 'max_pages' | 'no_more_pages' | 'error';
  };
}

export class PaginationHandler {
  private page: Page;
  private currentPageNumber: number = 1;
  private collectedData: any[] = [];
  
  // Common pagination selectors
  private readonly NEXT_SELECTORS = [
    'a:has-text("Next")',
    'button:has-text("Next")',
    '[aria-label*="Next"]',
    'a:has-text("→")',
    'button:has-text("→")',
    '.pagination-next',
    '.next-page',
    'a[rel="next"]',
    '[data-testid*="next"]',
    'a:has-text(">")',
    'button:has-text(">")',
    '.pager__item--next a',
    'li.next a',
    '.pagination__next',
    'nav [aria-label="Go to next page"]'
  ];

  private readonly PREV_SELECTORS = [
    'a:has-text("Previous")',
    'button:has-text("Previous")',
    '[aria-label*="Previous"]',
    'a:has-text("←")',
    'button:has-text("←")',
    '.pagination-prev',
    '.prev-page',
    'a[rel="prev"]',
    '[data-testid*="prev"]',
    'a:has-text("<")',
    'button:has-text("<")',
    '.pager__item--prev a',
    'li.prev a',
    '.pagination__prev',
    'nav [aria-label="Go to previous page"]'
  ];

  private readonly PAGE_NUMBER_SELECTORS = [
    '.pagination a',
    '.pagination button',
    '.page-numbers a',
    '.page-numbers button',
    '[role="navigation"] a[href*="page"]',
    '[role="navigation"] button[data-page]',
    '.pager__item a',
    'ul.pagination li a',
    'nav[aria-label*="Pagination"] a',
    '.pagination__item a'
  ];

  private readonly LOAD_MORE_SELECTORS = [
    'button:has-text("Load More")',
    'button:has-text("Show More")',
    'button:has-text("View More")',
    'a:has-text("Load More")',
    'a:has-text("Show More")',
    '[data-testid*="load-more"]',
    '.load-more-button',
    '.show-more-button',
    'button:has-text("Load more results")',
    'button:has-text("Show more results")'
  ];

  private readonly CURRENT_PAGE_SELECTORS = [
    '.pagination .active',
    '.pagination .current',
    '.page-numbers .current',
    '[aria-current="page"]',
    '.pagination__item--active',
    'li.active a',
    '.pager__item.is-active',
    'nav [aria-label="Current page"]'
  ];

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Automatically detect pagination type on the current page
   */
  async detectPagination(customSelectors?: PaginationOptions['customSelectors']): Promise<PaginationInfo> {
    const info: PaginationInfo = {
      type: 'unknown',
      currentPage: this.currentPageNumber,
      hasNext: false,
      hasPrevious: false,
      selectors: {}
    };

    try {
      // Check for numbered pagination
      const pageNumbers = await this.findPaginationElements(
        customSelectors?.pageNumbers || this.PAGE_NUMBER_SELECTORS
      );
      
      if (pageNumbers.length > 0) {
        info.type = 'numbered';
        info.selectors.pages = pageNumbers[0];
        
        // Try to get total pages
        const pageTexts = await Promise.all(
          (await this.page.$$(pageNumbers[0])).map(el => el.textContent())
        );
        const numbers = pageTexts
          .map(t => parseInt(t?.trim() || ''))
          .filter(n => !isNaN(n));
        
        if (numbers.length > 0) {
          info.totalPages = Math.max(...numbers);
        }
      }

      // Check for next button
      const nextButton = await this.findPaginationElements(
        customSelectors?.nextButton || this.NEXT_SELECTORS
      );
      
      if (nextButton.length > 0) {
        info.hasNext = await this.isElementEnabled(nextButton[0]);
        info.selectors.next = nextButton[0];
        
        if (info.type === 'unknown') {
          info.type = 'next-prev';
        }
      }

      // Check for previous button
      const prevButton = await this.findPaginationElements(
        customSelectors?.prevButton || this.PREV_SELECTORS
      );
      
      if (prevButton.length > 0) {
        info.hasPrevious = await this.isElementEnabled(prevButton[0]);
        info.selectors.previous = prevButton[0];
      }

      // Check for load more button
      const loadMoreButton = await this.findPaginationElements(
        customSelectors?.loadMore || this.LOAD_MORE_SELECTORS
      );
      
      if (loadMoreButton.length > 0) {
        info.type = 'load-more';
        info.selectors.loadMore = loadMoreButton[0];
        info.hasNext = await this.isElementEnabled(loadMoreButton[0]);
      }

      // Check for infinite scroll
      const hasInfiniteScroll = await this.detectInfiniteScroll();
      if (hasInfiniteScroll && info.type === 'unknown') {
        info.type = 'infinite-scroll';
        info.hasNext = true;
      }

      // Try to detect current page number
      const currentPage = await this.getCurrentPageNumber(customSelectors?.currentPage);
      if (currentPage > 0) {
        info.currentPage = currentPage;
        this.currentPageNumber = currentPage;
      }

      return info;
    } catch (error) {
      console.error('Error detecting pagination:', error);
      return info;
    }
  }

  /**
   * Navigate through all pages automatically
   */
  async navigateAllPages(options: PaginationOptions = {}): Promise<PaginationResult> {
    const {
      maxPages = 100,
      waitBetweenPages = 2000,
      autoDetect = true,
      customSelectors,
      onPageChange,
      extractDataOnEachPage = true
    } = options;

    try {
      let pagesProcessed = 1;
      const paginationInfo = autoDetect ? 
        await this.detectPagination(customSelectors) :
        await this.detectPagination(customSelectors);

      if (paginationInfo.type === 'unknown') {
        return formatResponse({
          success: true,
          action: 'navigate_pages',
          timestamp: Date.now(),
          value: {
            pagesProcessed: 1,
            paginationType: 'none',
            stoppedReason: 'no_more_pages'
          }
        });
      }

      // Process first page
      if (extractDataOnEachPage) {
        const data = await this.extractPageData();
        this.collectedData.push(data);
      }
      
      if (onPageChange) {
        await onPageChange(pagesProcessed, this.collectedData[this.collectedData.length - 1]);
      }

      // Navigate through pages based on type
      while (pagesProcessed < maxPages) {
        const hasNext = await this.goToNextPage(paginationInfo, waitBetweenPages);
        
        if (!hasNext) {
          break;
        }

        pagesProcessed++;
        this.currentPageNumber++;

        // Extract data from new page
        if (extractDataOnEachPage) {
          const data = await this.extractPageData();
          this.collectedData.push(data);
        }

        if (onPageChange) {
          await onPageChange(pagesProcessed, this.collectedData[this.collectedData.length - 1]);
        }

        // Update pagination info for dynamic pages
        if (paginationInfo.type === 'numbered') {
          const updatedInfo = await this.detectPagination(customSelectors);
          paginationInfo.hasNext = updatedInfo.hasNext;
          paginationInfo.selectors = updatedInfo.selectors;
        }
      }

      const stoppedReason = pagesProcessed >= maxPages ? 'max_pages' : 'no_more_pages';

      return formatResponse({
        success: true,
        action: 'navigate_pages',
        timestamp: Date.now(),
        value: {
          pagesProcessed,
          totalPagesFound: paginationInfo.totalPages,
          paginationType: paginationInfo.type,
          collectedData: this.collectedData,
          stoppedReason
        }
      });

    } catch (error) {
      return formatError(error as Error, 'navigate_pages', {
        pagesProcessed: this.currentPageNumber,
        collectedData: this.collectedData
      } as any);
    }
  }

  /**
   * Navigate to the next page
   */
  async nextPage(waitTime: number = 2000): Promise<ActionResult> {
    try {
      const paginationInfo = await this.detectPagination();
      
      if (!paginationInfo.hasNext) {
        return formatResponse({
          success: false,
          action: 'next_page',
          error: 'No next page available',
          timestamp: Date.now()
        });
      }

      const success = await this.goToNextPage(paginationInfo, waitTime);
      
      if (success) {
        this.currentPageNumber++;
        return formatResponse({
          success: true,
          action: 'next_page',
          timestamp: Date.now(),
          value: {
            currentPage: this.currentPageNumber,
            paginationType: paginationInfo.type
          }
        });
      }

      return formatResponse({
        success: false,
        action: 'next_page',
        error: 'Failed to navigate to next page',
        timestamp: Date.now()
      });
    } catch (error) {
      return formatError(error as Error, 'next_page');
    }
  }

  /**
   * Navigate to the previous page
   */
  async previousPage(waitTime: number = 2000): Promise<ActionResult> {
    try {
      const paginationInfo = await this.detectPagination();
      
      if (!paginationInfo.hasPrevious) {
        return formatResponse({
          success: false,
          action: 'previous_page',
          error: 'No previous page available',
          timestamp: Date.now()
        });
      }

      if (paginationInfo.selectors.previous) {
        await this.page.click(paginationInfo.selectors.previous);
        await this.page.waitForTimeout(waitTime);
        this.currentPageNumber = Math.max(1, this.currentPageNumber - 1);
        
        return formatResponse({
          success: true,
          action: 'previous_page',
          timestamp: Date.now(),
          value: {
            currentPage: this.currentPageNumber,
            paginationType: paginationInfo.type
          }
        });
      }

      return formatResponse({
        success: false,
        action: 'previous_page',
        error: 'Previous button not found',
        timestamp: Date.now()
      });
    } catch (error) {
      return formatError(error as Error, 'previous_page');
    }
  }

  /**
   * Navigate to a specific page number
   */
  async goToPage(pageNumber: number, waitTime: number = 2000): Promise<ActionResult> {
    try {
      const paginationInfo = await this.detectPagination();
      
      if (paginationInfo.type !== 'numbered') {
        return formatResponse({
          success: false,
          action: 'go_to_page',
          error: 'Page numbers not available on this pagination type',
          timestamp: Date.now()
        });
      }

      if (paginationInfo.selectors.pages) {
        // Find the specific page number link/button
        const pageElements = await this.page.$$(paginationInfo.selectors.pages);
        
        for (const element of pageElements) {
          const text = await element.textContent();
          if (text?.trim() === pageNumber.toString()) {
            await element.click();
            await this.page.waitForTimeout(waitTime);
            this.currentPageNumber = pageNumber;
            
            return formatResponse({
              success: true,
              action: 'go_to_page',
              timestamp: Date.now(),
              value: {
                currentPage: this.currentPageNumber,
                paginationType: paginationInfo.type
              }
            });
          }
        }
      }

      return formatResponse({
        success: false,
        action: 'go_to_page',
        error: `Page ${pageNumber} not found`,
        timestamp: Date.now()
      });
    } catch (error) {
      return formatError(error as Error, 'go_to_page');
    }
  }

  /**
   * Private helper methods
   */
  
  private async findPaginationElements(selectors: string[]): Promise<string[]> {
    const found: string[] = [];
    
    for (const selector of selectors) {
      try {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          found.push(selector);
        }
      } catch {
        // Ignore selector errors
      }
    }
    
    return found;
  }

  private async isElementEnabled(selector: string): Promise<boolean> {
    try {
      const element = await this.page.$(selector);
      if (!element) return false;
      
      const isDisabled = await element.evaluate(el => {
        return el.hasAttribute('disabled') || 
               el.getAttribute('aria-disabled') === 'true' ||
               el.classList.contains('disabled') ||
               el.classList.contains('inactive');
      });
      
      return !isDisabled;
    } catch {
      return false;
    }
  }

  private async detectInfiniteScroll(): Promise<boolean> {
    try {
      // Check for common infinite scroll indicators
      const hasInfiniteScroll = await this.page.evaluate(() => {
        // Check for Intersection Observer usage (common for infinite scroll)
        const observers = (window as any).__observers || [];
        if (observers.length > 0) return true;
        
        // Check for scroll event listeners on window or document
        const scrollListeners = (window as any).__scrollListeners || 0;
        if (scrollListeners > 0) return true;
        
        // Check for common infinite scroll libraries
        const hasInfiniteScrollLib = 
          !!(window as any).InfiniteScroll ||
          !!(window as any).Waypoint ||
          document.querySelector('[data-infinite-scroll]') !== null;
        
        return hasInfiniteScrollLib;
      });
      
      return hasInfiniteScroll;
    } catch {
      return false;
    }
  }

  private async getCurrentPageNumber(customSelectors?: string[]): Promise<number> {
    try {
      const selectors = customSelectors || this.CURRENT_PAGE_SELECTORS;
      
      for (const selector of selectors) {
        const element = await this.page.$(selector);
        if (element) {
          const text = await element.textContent();
          const pageNum = parseInt(text?.trim() || '');
          if (!isNaN(pageNum)) {
            return pageNum;
          }
        }
      }
      
      // Try to get from URL
      const url = this.page.url();
      const pageMatch = url.match(/[?&]page=(\d+)/);
      if (pageMatch) {
        return parseInt(pageMatch[1]);
      }
      
      return 1;
    } catch {
      return 1;
    }
  }

  private async goToNextPage(paginationInfo: PaginationInfo, waitTime: number): Promise<boolean> {
    try {
      switch (paginationInfo.type) {
        case 'numbered':
        case 'next-prev':
          if (paginationInfo.selectors.next) {
            await this.page.click(paginationInfo.selectors.next);
            await this.page.waitForTimeout(waitTime);
            return true;
          }
          break;
          
        case 'load-more':
          if (paginationInfo.selectors.loadMore) {
            const beforeHeight = await this.page.evaluate(() => document.body.scrollHeight);
            await this.page.click(paginationInfo.selectors.loadMore);
            await this.page.waitForTimeout(waitTime);
            
            // Wait for new content to load
            await this.page.waitForFunction(
              (oldHeight) => document.body.scrollHeight > oldHeight,
              beforeHeight,
              { timeout: 10000 }
            ).catch(() => {});
            
            return true;
          }
          break;
          
        case 'infinite-scroll':
          const beforeHeight = await this.page.evaluate(() => document.body.scrollHeight);
          
          // Scroll to bottom
          await this.page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          
          // Wait for new content
          await this.page.waitForTimeout(waitTime);
          
          const afterHeight = await this.page.evaluate(() => document.body.scrollHeight);
          return afterHeight > beforeHeight;
      }
      
      return false;
    } catch (error) {
      console.error('Error navigating to next page:', error);
      return false;
    }
  }

  private async extractPageData(): Promise<any> {
    try {
      // Extract basic page data - this can be customized based on needs
      const data = await this.page.evaluate(() => {
        const extractedData: any = {
          url: window.location.href,
          title: document.title,
          timestamp: new Date().toISOString()
        };
        
        // Extract main content
        const mainContent = document.querySelector('main, article, .content, #content');
        if (mainContent) {
          extractedData.mainText = mainContent.textContent?.trim().substring(0, 1000);
        }
        
        // Extract structured data if available
        const jsonLd = document.querySelector('script[type="application/ld+json"]');
        if (jsonLd) {
          try {
            extractedData.structuredData = JSON.parse(jsonLd.textContent || '{}');
          } catch {}
        }
        
        // Extract meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          extractedData.description = metaDesc.getAttribute('content');
        }
        
        return extractedData;
      });
      
      return data;
    } catch (error) {
      console.error('Error extracting page data:', error);
      return { error: 'Failed to extract page data' };
    }
  }

  /**
   * Reset pagination state
   */
  reset(): void {
    this.currentPageNumber = 1;
    this.collectedData = [];
  }

  /**
   * Get collected data from all pages
   */
  getCollectedData(): any[] {
    return this.collectedData;
  }

  /**
   * Get current page number
   */
  getCurrentPage(): number {
    return this.currentPageNumber;
  }
}