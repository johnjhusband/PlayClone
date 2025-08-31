/**
 * BrowserManager - Handles browser lifecycle and initialization
 */

import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright-core';
import { LaunchOptions, BrowserType, ActionResult } from '../types';
import { formatResponse } from '../utils/responseFormatter';
import { AdvancedTimeoutManager } from '../utils/advancedTimeout';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private options: LaunchOptions;
  private browserType: BrowserType;
  private timeoutManager: AdvancedTimeoutManager | null = null;

  constructor(options: LaunchOptions = {}) {
    this.options = {
      headless: options.headless ?? true,
      viewport: options.viewport ?? { width: 1280, height: 720 },
      userAgent: options.userAgent,
      timeout: options.timeout ?? 30000,
      browser: options.browser ?? 'chromium',
      args: options.args ?? [],
      slowMo: options.slowMo ?? 0,
      devtools: options.devtools ?? false,
    };
    this.browserType = this.options.browser!;
  }

  /**
   * Launch browser and create initial context
   */
  async launch(): Promise<ActionResult> {
    try {
      const startTime = Date.now();
      
      // Select browser engine
      const browserEngine = this.getBrowserEngine();
      
      // Launch browser
      this.browser = await browserEngine.launch({
        headless: this.options.headless,
        args: this.options.args,
        slowMo: this.options.slowMo,
        devtools: this.options.devtools,
        executablePath: this.options.executablePath,
      });

      // Create context with options
      this.context = await this.browser.newContext({
        viewport: this.options.viewport,
        userAgent: this.options.userAgent,
      });

      // Set default timeout
      this.context.setDefaultTimeout(this.options.timeout!);
      this.context.setDefaultNavigationTimeout(this.options.timeout!);

      // Create initial page
      this.page = await this.context.newPage();
      
      // Initialize timeout manager with the page
      this.timeoutManager = new AdvancedTimeoutManager(this.page);

      return formatResponse({
        success: true,
        action: 'launch',
        value: {
          browser: this.browserType,
          headless: this.options.headless,
          viewport: this.options.viewport,
        },
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      });
    } catch (error) {
      return formatResponse({
        success: false,
        action: 'launch',
        error: error instanceof Error ? error.message : 'Failed to launch browser',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Close browser and cleanup resources
   */
  async close(): Promise<ActionResult> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      return formatResponse({
        success: true,
        action: 'close',
        timestamp: Date.now(),
      });
    } catch (error) {
      return formatResponse({
        success: false,
        action: 'close',
        error: error instanceof Error ? error.message : 'Failed to close browser',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get the appropriate browser engine
   */
  private getBrowserEngine() {
    switch (this.browserType) {
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      case 'chromium':
      default:
        return chromium;
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<ActionResult> {
    if (!this.page) {
      return formatResponse({
        success: false,
        action: 'navigate',
        error: 'No active page. Call launch() first.',
        timestamp: Date.now(),
      });
    }

    try {
      const startTime = Date.now();
      
      // Use advanced timeout manager for navigation
      if (this.timeoutManager) {
        await this.timeoutManager.executeWithRetry(
          async () => {
            await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
            await this.timeoutManager!.waitForPageReady();
          },
          'navigation'
        );
      } else {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      }
      
      return formatResponse({
        success: true,
        action: 'navigate',
        target: url,
        value: {
          url: this.page.url(),
          title: await this.page.title(),
        },
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      });
    } catch (error) {
      return formatResponse({
        success: false,
        action: 'navigate',
        target: url,
        error: error instanceof Error ? error.message : 'Navigation failed',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Go back in browser history
   */
  async back(): Promise<ActionResult> {
    if (!this.page) {
      return formatResponse({
        success: false,
        action: 'back',
        error: 'No active page',
        timestamp: Date.now(),
      });
    }

    try {
      await this.page.goBack();
      return formatResponse({
        success: true,
        action: 'back',
        value: {
          url: this.page.url(),
          title: await this.page.title(),
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      return formatResponse({
        success: false,
        action: 'back',
        error: error instanceof Error ? error.message : 'Failed to go back',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Go forward in browser history
   */
  async forward(): Promise<ActionResult> {
    if (!this.page) {
      return formatResponse({
        success: false,
        action: 'forward',
        error: 'No active page',
        timestamp: Date.now(),
      });
    }

    try {
      await this.page.goForward();
      return formatResponse({
        success: true,
        action: 'forward',
        value: {
          url: this.page.url(),
          title: await this.page.title(),
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      return formatResponse({
        success: false,
        action: 'forward',
        error: error instanceof Error ? error.message : 'Failed to go forward',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Reload the current page
   */
  async reload(): Promise<ActionResult> {
    if (!this.page) {
      return formatResponse({
        success: false,
        action: 'reload',
        error: 'No active page',
        timestamp: Date.now(),
      });
    }

    try {
      await this.page.reload();
      return formatResponse({
        success: true,
        action: 'reload',
        value: {
          url: this.page.url(),
          title: await this.page.title(),
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      return formatResponse({
        success: false,
        action: 'reload',
        error: error instanceof Error ? error.message : 'Failed to reload',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get current browser instance
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * Get current browser context
   */
  getContext(): BrowserContext | null {
    return this.context;
  }

  /**
   * Get current page
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Create a new page in the current context
   */
  async newPage(): Promise<Page | null> {
    if (!this.context) {
      return null;
    }
    
    try {
      const newPage = await this.context.newPage();
      return newPage;
    } catch (error) {
      console.error('Failed to create new page:', error);
      return null;
    }
  }

  /**
   * Switch to a different page
   */
  async switchToPage(page: Page): Promise<ActionResult> {
    try {
      this.page = page;
      await page.bringToFront();
      
      return formatResponse({
        success: true,
        action: 'switchPage',
        value: {
          url: page.url(),
          title: await page.title(),
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      return formatResponse({
        success: false,
        action: 'switchPage',
        error: error instanceof Error ? error.message : 'Failed to switch page',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Check if browser is active
   */
  isActive(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }
}