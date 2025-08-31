/**
 * Search Engine Handler - Specialized handling for search engines to bypass anti-automation
 */

import { Page } from 'playwright-core';
import { ActionResult } from '../types';

export interface SearchEngineConfig {
  name: string;
  searchUrl: string;
  searchSelector: string;
  searchAlternatives: string[];
  submitMethod: 'enter' | 'button' | 'both';
  buttonSelector?: string;
  waitStrategy: 'network' | 'selector' | 'timeout' | 'custom';
  waitTarget?: string;
  userAgent?: string;
  extraHeaders?: Record<string, string>;
  mouseMovements?: boolean;
  typingDelay?: number;
}

const SEARCH_ENGINE_CONFIGS: Record<string, SearchEngineConfig> = {
  google: {
    name: 'Google',
    searchUrl: 'https://www.google.com',
    searchSelector: 'textarea[name="q"], input[name="q"], input[aria-label*="Search"], textarea[aria-label*="Search"]',
    searchAlternatives: ['[role="combobox"]', '.gLFyf', '#APjFqb'],
    submitMethod: 'both',
    buttonSelector: 'input[type="submit"][value*="Search"], button[aria-label*="Search"], .gNO89b',
    waitStrategy: 'network',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    mouseMovements: true,
    typingDelay: 100
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    searchUrl: 'https://duckduckgo.com',
    searchSelector: 'input[name="q"], #searchbox_input, #search_form_input, input[placeholder*="Search"]',
    searchAlternatives: ['[data-testid="searchbox-input"]', '.searchbox__input'],
    submitMethod: 'enter',
    waitStrategy: 'timeout',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    mouseMovements: true,
    typingDelay: 150
  },
  bing: {
    name: 'Bing',
    searchUrl: 'https://www.bing.com',
    searchSelector: 'input[name="q"], #sb_form_q, textarea[name="q"]',
    searchAlternatives: ['.sb_form_q', '[aria-label*="search"]'],
    submitMethod: 'both',
    buttonSelector: '#search_icon, #sb_form_go, input[type="submit"]',
    waitStrategy: 'selector',
    waitTarget: '.b_algo',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    typingDelay: 80
  }
};

export class SearchEngineHandler {
  private page: Page;
  private config: SearchEngineConfig | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Detect which search engine we're on
   */
  private async detectSearchEngine(): Promise<SearchEngineConfig | null> {
    const url = this.page.url().toLowerCase();
    
    for (const [key, config] of Object.entries(SEARCH_ENGINE_CONFIGS)) {
      if (url.includes(key) || url.includes(config.searchUrl.toLowerCase())) {
        return config;
      }
    }
    
    return null;
  }

  /**
   * Simulate human-like mouse movements
   */
  private async simulateMouseMovements(): Promise<void> {
    try {
      const viewport = this.page.viewportSize() || { width: 1280, height: 720 };
      
      // Move mouse in a natural arc pattern
      const points = [
        { x: viewport.width / 2, y: viewport.height / 2 },
        { x: viewport.width / 3, y: viewport.height / 3 },
        { x: viewport.width / 2, y: viewport.height / 2.5 }
      ];
      
      for (const point of points) {
        await this.page.mouse.move(point.x, point.y, { steps: 10 });
        await this.page.waitForTimeout(Math.random() * 100 + 50);
      }
    } catch (error) {
      // Ignore mouse movement errors
    }
  }

  /**
   * Type text with human-like delays
   */
  private async typeWithDelay(selector: string, text: string, delay: number): Promise<void> {
    await this.page.click(selector);
    
    for (const char of text) {
      await this.page.keyboard.type(char);
      await this.page.waitForTimeout(delay + Math.random() * 50);
    }
  }

  /**
   * Perform a search on a search engine
   */
  async search(query: string): Promise<ActionResult> {
    try {
      // Detect search engine
      this.config = await this.detectSearchEngine();
      if (!this.config) {
        return {
          success: false,
          action: 'search',
          error: 'Not on a recognized search engine',
          timestamp: Date.now()
        };
      }

      // Set user agent if specified
      if (this.config.userAgent) {
        await this.page.setExtraHTTPHeaders({
          'User-Agent': this.config.userAgent,
          ...this.config.extraHeaders
        });
      }

      // Simulate mouse movements if needed
      if (this.config.mouseMovements) {
        await this.simulateMouseMovements();
      }

      // Find search input
      let searchInput = null;
      const selectors = [this.config.searchSelector, ...this.config.searchAlternatives];
      
      for (const selector of selectors) {
        try {
          searchInput = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (searchInput) break;
        } catch {
          continue;
        }
      }

      if (!searchInput) {
        return {
          success: false,
          action: 'search',
          error: 'Could not find search input',
          timestamp: Date.now()
        };
      }

      // Clear existing text
      await searchInput.click({ clickCount: 3 });
      await this.page.keyboard.press('Backspace');

      // Type search query
      if (this.config.typingDelay) {
        await this.typeWithDelay(
          selectors.find(s => this.page.locator(s)) || this.config.searchSelector,
          query,
          this.config.typingDelay
        );
      } else {
        await searchInput.fill(query);
      }

      // Small delay before submit
      await this.page.waitForTimeout(500);

      // Submit search
      if (this.config.submitMethod === 'enter' || this.config.submitMethod === 'both') {
        await this.page.keyboard.press('Enter');
      }
      
      if (this.config.submitMethod === 'button' || this.config.submitMethod === 'both') {
        if (this.config.buttonSelector) {
          try {
            const button = await this.page.waitForSelector(this.config.buttonSelector, { timeout: 2000 });
            if (button) {
              await button.click();
            }
          } catch {
            // Button click failed, but Enter may have worked
          }
        }
      }

      // Wait for results
      switch (this.config.waitStrategy) {
        case 'network':
          await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          break;
        case 'selector':
          if (this.config.waitTarget) {
            await this.page.waitForSelector(this.config.waitTarget, { timeout: 10000 }).catch(() => {});
          }
          break;
        case 'timeout':
          await this.page.waitForTimeout(3000);
          break;
        case 'custom':
          // Custom wait logic can be added here
          await this.page.waitForTimeout(2000);
          break;
      }

      // Verify we got results
      const newUrl = this.page.url();
      const hasResults = newUrl.includes(encodeURIComponent(query)) || 
                        newUrl.includes('search') || 
                        newUrl.includes('?q=');

      return {
        success: hasResults,
        action: 'search',
        target: this.config.name,
        value: {
          query,
          url: newUrl,
          title: await this.page.title()
        },
        timestamp: Date.now()
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'search',
        error: error.message || 'Search failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Extract search results
   */
  async extractResults(limit: number = 10): Promise<any[]> {
    const results: any[] = [];
    
    try {
      // Google results
      if (this.page.url().includes('google')) {
        const googleResults = await this.page.$$eval('.g', (elements, max) => {
          return elements.slice(0, max).map(el => {
            const titleEl = el.querySelector('h3');
            const linkEl = el.querySelector('a');
            const snippetEl = el.querySelector('.VwiC3b, .st, .aCOpRe');
            
            return {
              title: titleEl?.textContent || '',
              url: linkEl?.href || '',
              snippet: snippetEl?.textContent || ''
            };
          });
        }, limit);
        results.push(...googleResults);
      }
      
      // DuckDuckGo results
      else if (this.page.url().includes('duckduckgo')) {
        const ddgResults = await this.page.$$eval('[data-testid="result"]', (elements, max) => {
          return elements.slice(0, max).map(el => {
            const titleEl = el.querySelector('h2');
            const linkEl = el.querySelector('a');
            const snippetEl = el.querySelector('[data-result="snippet"]');
            
            return {
              title: titleEl?.textContent || '',
              url: linkEl?.href || '',
              snippet: snippetEl?.textContent || ''
            };
          });
        }, limit);
        results.push(...ddgResults);
      }
      
      // Bing results
      else if (this.page.url().includes('bing')) {
        const bingResults = await this.page.$$eval('.b_algo', (elements, max) => {
          return elements.slice(0, max).map(el => {
            const titleEl = el.querySelector('h2');
            const linkEl = el.querySelector('a');
            const snippetEl = el.querySelector('.b_caption p');
            
            return {
              title: titleEl?.textContent || '',
              url: linkEl?.href || '',
              snippet: snippetEl?.textContent || ''
            };
          });
        }, limit);
        results.push(...bingResults);
      }
    } catch (error) {
      // Return whatever results we got
    }
    
    return results.filter(r => r.title && r.url);
  }
}