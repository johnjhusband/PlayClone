/**
 * BrowserManager - Handles browser lifecycle and initialization
 */

import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright-core';
import { LaunchOptions, BrowserType, ActionResult } from '../types';
import { formatResponse } from '../utils/responseFormatter';
import { AdvancedTimeoutManager } from '../utils/advancedTimeout';
import { ExtensionManager } from './ExtensionManager';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private options: LaunchOptions;
  private browserType: BrowserType;
  private timeoutManager: AdvancedTimeoutManager | null = null;
  private extensionManager: ExtensionManager | null = null;

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
      extensions: options.extensions ?? [],
    };
    this.browserType = this.options.browser!;
    
    // Initialize extension manager if extensions are provided
    if (this.options.extensions && this.options.extensions.length > 0) {
      this.extensionManager = new ExtensionManager();
    }
  }

  /**
   * Launch browser and create initial context
   */
  async launch(): Promise<ActionResult> {
    try {
      const startTime = Date.now();
      
      // Load extensions if provided
      if (this.extensionManager && this.options.extensions) {
        for (const extensionConfig of this.options.extensions) {
          const result = await this.extensionManager.loadExtension(extensionConfig);
          if (!result.success) {
            console.warn(`Failed to load extension: ${result.error}`);
          }
        }
      }
      
      // Select browser engine
      const browserEngine = this.getBrowserEngine();
      
      // Configure proxy settings if provided
      const launchArgs = [...(this.options.args || [])];
      let proxySettings: any = {};
      
      if (this.options.proxy) {
        // For launch-level proxy (Chromium/Firefox)
        if (this.browserType !== 'webkit') {
          if (this.options.proxy.server) {
            launchArgs.push(`--proxy-server=${this.options.proxy.server}`);
          }
          if (this.options.proxy.bypass) {
            launchArgs.push(`--proxy-bypass-list=${this.options.proxy.bypass}`);
          }
        }
        
        // For context-level proxy (all browsers)
        proxySettings = {
          server: this.options.proxy.server,
          bypass: this.options.proxy.bypass,
          username: this.options.proxy.username,
          password: this.options.proxy.password,
        };
      }

      // Add extension arguments if using Chromium
      if (this.extensionManager && this.browserType === 'chromium') {
        const extensionArgs = this.extensionManager.getBrowserArgs();
        launchArgs.push(...extensionArgs);
        
        // Extensions require headed mode
        if (extensionArgs.length > 0 && this.options.headless) {
          console.warn('Extensions require headed mode. Setting headless: false');
          this.options.headless = false;
        }
      }
      
      // Prepare Firefox preferences if needed
      let firefoxPrefs = {};
      if (this.extensionManager && this.browserType === 'firefox') {
        firefoxPrefs = this.extensionManager.getFirefoxPreferences();
      }
      
      // Launch browser
      const launchOptions: any = {
        headless: this.options.headless,
        args: launchArgs,
        slowMo: this.options.slowMo,
        devtools: this.options.devtools,
        executablePath: this.options.executablePath,
        proxy: this.browserType === 'webkit' ? proxySettings : undefined, // WebKit uses launch-level proxy
      };
      
      // Add Firefox preferences if available
      if (this.browserType === 'firefox' && Object.keys(firefoxPrefs).length > 0) {
        launchOptions.firefoxUserPrefs = firefoxPrefs;
      }
      
      this.browser = await browserEngine.launch(launchOptions);

      // Create context with options
      const contextOptions: any = {
        viewport: this.options.viewport,
        userAgent: this.options.userAgent,
      };
      
      // Add proxy for non-WebKit browsers at context level
      if (this.options.proxy && this.browserType !== 'webkit') {
        contextOptions.proxy = proxySettings;
      }
      
      this.context = await this.browser.newContext(contextOptions);

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

  /**
   * Get extension manager instance
   */
  getExtensionManager(): ExtensionManager | null {
    return this.extensionManager;
  }

  /**
   * Load an extension dynamically (after browser launch)
   */
  async loadExtension(config: any): Promise<ActionResult> {
    if (!this.extensionManager) {
      this.extensionManager = new ExtensionManager();
    }

    const result = await this.extensionManager.loadExtension(config);
    
    if (result.success && this.page) {
      // Try to install in running browser if supported
      await this.extensionManager.installInBrowser(this.page, result.value.path);
    }

    return result;
  }

  /**
   * Get list of loaded extensions
   */
  getExtensions(): any[] {
    if (!this.extensionManager) {
      return [];
    }
    return this.extensionManager.getExtensions();
  }

  /**
   * Clean up resources including extensions
   */
  async cleanup(): Promise<void> {
    try {
      // Close browser
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      // Clean up extensions
      if (this.extensionManager) {
        this.extensionManager.cleanup();
        this.extensionManager = null;
      }

      this.context = null;
      this.page = null;
      this.timeoutManager = null;
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}