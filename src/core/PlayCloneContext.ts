/**
 * PlayCloneContext - AI-friendly wrapper around browser context
 */

import { Page } from 'playwright-core';
import { BrowserManager } from './BrowserManager';
import { SessionManager } from './SessionManager';
import { ElementLocator } from '../selectors/ElementLocator';
import { ActionExecutor } from '../actions/ActionExecutor';
import { DataExtractor } from '../extractors/DataExtractor';
import { StateManager } from '../state/StateManager';
import { ActionResult, ElementSelector } from '../types';
import { formatSuccess, formatError } from '../utils/responseFormatter';

export class PlayCloneContext {
  private browserManager: BrowserManager;
  private sessionManager: SessionManager;
  private elementLocator: ElementLocator;
  private actionExecutor: ActionExecutor;
  private dataExtractor: DataExtractor;
  private stateManager: StateManager;
  private currentPage: Page | null = null;

  constructor(
    browserManager: BrowserManager,
    sessionManager: SessionManager
  ) {
    this.browserManager = browserManager;
    this.sessionManager = sessionManager;
    this.elementLocator = new ElementLocator();
    this.actionExecutor = new ActionExecutor(this.elementLocator);
    this.dataExtractor = new DataExtractor();
    this.stateManager = new StateManager();
  }

  /**
   * Initialize context with browser
   */
  async initialize(): Promise<ActionResult> {
    try {
      // Launch browser if not already active
      if (!this.browserManager.isActive()) {
        await this.browserManager.launch();
      }

      this.currentPage = this.browserManager.getPage();
      
      if (!this.currentPage) {
        return formatError('Failed to get page from browser manager', 'initialize');
      }

      // Initialize session
      const context = this.browserManager.getContext();
      if (context) {
        await this.sessionManager.initialize(context, this.currentPage);
      }

      return formatSuccess('initialize', {
        ready: true,
        url: this.currentPage.url(),
      });
    } catch (error) {
      return formatError(error as Error, 'initialize');
    }
  }

  /**
   * Navigate to URL using natural language or direct URL
   */
  async navigate(target: string): Promise<ActionResult> {
    try {
      // Check if it's a URL or natural language
      const isUrl = /^https?:\/\/|^www\./i.test(target);
      
      if (isUrl) {
        // Normalize URL
        let url = target;
        if (!/^https?:\/\//i.test(url)) {
          url = 'https://' + url;
        }
        return await this.browserManager.navigate(url);
      } else {
        // Handle natural language navigation
        // For now, try to construct a search URL
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
        return await this.browserManager.navigate(searchUrl);
      }
    } catch (error) {
      return formatError(error as Error, 'navigate');
    }
  }

  /**
   * Click on element using natural language selector
   */
  async click(selector: string | ElementSelector): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'click');
    }

    try {
      return await this.actionExecutor.click(this.currentPage, selector);
    } catch (error) {
      return formatError(error as Error, 'click');
    }
  }

  /**
   * Fill form field using natural language
   */
  async fill(selector: string | ElementSelector, value: string): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'fill');
    }

    try {
      return await this.actionExecutor.fill(this.currentPage, selector, value);
    } catch (error) {
      return formatError(error as Error, 'fill');
    }
  }

  /**
   * Type text with keyboard simulation
   */
  async type(text: string, delay?: number): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'type');
    }

    try {
      return await this.actionExecutor.type(this.currentPage, text, delay);
    } catch (error) {
      return formatError(error as Error, 'type');
    }
  }

  /**
   * Press keyboard key
   */
  async press(key: string): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'press');
    }

    try {
      return await this.actionExecutor.press(this.currentPage, key);
    } catch (error) {
      return formatError(error as Error, 'press');
    }
  }

  /**
   * Select option from dropdown
   */
  async select(selector: string | ElementSelector, value: string): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'select');
    }

    try {
      return await this.actionExecutor.select(this.currentPage, selector, value);
    } catch (error) {
      return formatError(error as Error, 'select');
    }
  }

  /**
   * Check or uncheck checkbox
   */
  async check(selector: string | ElementSelector, checked: boolean = true): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'check');
    }

    try {
      return await this.actionExecutor.check(this.currentPage, selector, checked);
    } catch (error) {
      return formatError(error as Error, 'check');
    }
  }

  /**
   * Hover over element
   */
  async hover(selector: string | ElementSelector): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'hover');
    }

    try {
      return await this.actionExecutor.hover(this.currentPage, selector);
    } catch (error) {
      return formatError(error as Error, 'hover');
    }
  }

  /**
   * Focus on element
   */
  async focus(selector: string | ElementSelector): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'focus');
    }

    try {
      return await this.actionExecutor.focus(this.currentPage, selector);
    } catch (error) {
      return formatError(error as Error, 'focus');
    }
  }

  /**
   * Wait for element or condition
   */
  async waitFor(condition: string | ElementSelector | number): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'waitFor');
    }

    try {
      // If number, wait for milliseconds
      if (typeof condition === 'number') {
        await this.currentPage.waitForTimeout(condition);
        return formatSuccess('waitFor', { duration: condition });
      }

      // Otherwise, wait for element
      const element = await this.elementLocator.locate(this.currentPage, condition);
      if (element) {
        await element.waitFor({ state: 'visible' });
        return formatSuccess('waitFor', { found: true });
      }

      return formatError('Element not found', 'waitFor');
    } catch (error) {
      return formatError(error as Error, 'waitFor');
    }
  }

  /**
   * Extract text content from page
   */
  async getText(selector?: string | ElementSelector): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'getText');
    }

    try {
      return await this.dataExtractor.getText(this.currentPage, selector);
    } catch (error) {
      return formatError(error as Error, 'getText');
    }
  }

  /**
   * Extract table data
   */
  async getTable(selector?: string | ElementSelector): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'getTable');
    }

    try {
      return await this.dataExtractor.getTable(this.currentPage, selector);
    } catch (error) {
      return formatError(error as Error, 'getTable');
    }
  }

  /**
   * Extract form data
   */
  async getFormData(selector?: string | ElementSelector): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'getFormData');
    }

    try {
      return await this.dataExtractor.getFormData(this.currentPage, selector);
    } catch (error) {
      return formatError(error as Error, 'getFormData');
    }
  }

  /**
   * Extract all links
   */
  async getLinks(): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'getLinks');
    }

    try {
      return await this.dataExtractor.getLinks(this.currentPage);
    } catch (error) {
      return formatError(error as Error, 'getLinks');
    }
  }

  /**
   * Take screenshot
   */
  async screenshot(options?: { fullPage?: boolean; path?: string }): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'screenshot');
    }

    try {
      const buffer = await this.currentPage.screenshot({
        fullPage: options?.fullPage ?? false,
        path: options?.path,
      });

      return formatSuccess('screenshot', {
        size: buffer.length,
        path: options?.path,
      });
    } catch (error) {
      return formatError(error as Error, 'screenshot');
    }
  }

  /**
   * Save current state checkpoint
   */
  async saveCheckpoint(name?: string): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'saveCheckpoint');
    }

    try {
      const context = this.browserManager.getContext();
      if (!context) {
        return formatError('No browser context', 'saveCheckpoint');
      }

      const state = await this.sessionManager.captureState(context, this.currentPage);
      return await this.stateManager.saveCheckpoint(state, name);
    } catch (error) {
      return formatError(error as Error, 'saveCheckpoint');
    }
  }

  /**
   * Restore state checkpoint
   */
  async restoreCheckpoint(name: string): Promise<ActionResult> {
    try {
      return await this.stateManager.restoreCheckpoint(name);
    } catch (error) {
      return formatError(error as Error, 'restoreCheckpoint');
    }
  }

  /**
   * List available checkpoints
   */
  async listCheckpoints(): Promise<ActionResult> {
    try {
      return await this.stateManager.listCheckpoints();
    } catch (error) {
      return formatError(error as Error, 'listCheckpoints');
    }
  }

  /**
   * Wait for dynamic content to load
   * Automatically waits for network idle, DOM stability, and specific elements
   */
  async waitForDynamicContent(options?: {
    timeout?: number;
    waitForLoadState?: 'load' | 'domcontentloaded' | 'networkidle';
    waitForSelector?: string;
  }): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'waitForDynamicContent');
    }

    try {
      await this.elementLocator.waitForDynamicContent(this.currentPage, options);
      return formatSuccess('waitForDynamicContent', {
        url: this.currentPage.url(),
        loadState: options?.waitForLoadState || 'domcontentloaded',
      });
    } catch (error) {
      return formatError(error as Error, 'waitForDynamicContent');
    }
  }

  /**
   * Wait for element to appear with auto-wait functionality
   */
  async waitForElement(selector: string | ElementSelector, options?: {
    timeout?: number;
    state?: 'visible' | 'hidden' | 'attached' | 'detached';
  }): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'waitForElement');
    }

    try {
      return await this.actionExecutor.waitForElement(this.currentPage, selector, options);
    } catch (error) {
      return formatError(error as Error, 'waitForElement');
    }
  }

  /**
   * Execute custom JavaScript in page context
   */
  async evaluate(script: string | Function, ...args: any[]): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'evaluate');
    }

    try {
      const result = await this.currentPage.evaluate(script as any, ...args);
      return formatSuccess('evaluate', result);
    } catch (error) {
      return formatError(error as Error, 'evaluate');
    }
  }

  /**
   * Get page info
   */
  async getPageInfo(): Promise<ActionResult> {
    if (!this.currentPage) {
      return formatError('No active page', 'getPageInfo');
    }

    try {
      const info = {
        url: this.currentPage.url(),
        title: await this.currentPage.title(),
        viewport: this.currentPage.viewportSize(),
        cookies: await this.browserManager.getContext()?.cookies(),
      };

      return formatSuccess('getPageInfo', info);
    } catch (error) {
      return formatError(error as Error, 'getPageInfo');
    }
  }

  /**
   * Close context and cleanup
   */
  async close(): Promise<ActionResult> {
    try {
      // Save session before closing
      await this.sessionManager.save();
      
      // Cleanup managers
      this.sessionManager.cleanup();
      
      // Close browser
      await this.browserManager.close();

      return formatSuccess('close');
    } catch (error) {
      return formatError(error as Error, 'close');
    }
  }
}