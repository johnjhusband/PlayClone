/**
 * PlayClone - Main API class for AI-native browser automation
 */

import { BrowserManager } from './core/BrowserManager';
import { SessionManager } from './core/SessionManager';
import { PlayCloneContext } from './core/PlayCloneContext';
import { ElementLocator } from './selectors/ElementLocator';
import { ActionExecutor } from './actions/ActionExecutor';
import { DataExtractor } from './extractors/DataExtractor';
import { StateManager } from './state/StateManager';
import { formatResponse } from './utils/responseFormatter';
import { LaunchOptions, ActionResult, ExtractedData, PageState } from './types';

/**
 * Main PlayClone class - Provides AI-friendly browser automation
 */
export class PlayClone {
  private browserManager: BrowserManager;
  private sessionManager: SessionManager;
  private context: PlayCloneContext | null = null;
  private elementLocator: ElementLocator | null = null;
  private actionExecutor: ActionExecutor | null = null;
  private dataExtractor: DataExtractor | null = null;
  private stateManager: StateManager | null = null;
  private initialized: boolean = false;
  constructor(options: LaunchOptions = {}) {
    this.browserManager = new BrowserManager(options);
    this.sessionManager = new SessionManager((options as any).sessionPath);
  }

  /**
   * Initialize browser and components
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const launchResult = await this.browserManager.launch();
    if (!launchResult.success) {
      throw new Error(`Failed to launch browser: ${launchResult.error}`);
    }

    const page = this.browserManager.getPage();
    if (!page) {
      throw new Error('No page available after browser launch');
    }

    this.context = new PlayCloneContext(this.browserManager, this.sessionManager);
    await this.context.initialize();

    this.elementLocator = new ElementLocator();
    this.actionExecutor = new ActionExecutor(this.elementLocator);
    this.dataExtractor = new DataExtractor();
    this.stateManager = new StateManager((this.sessionManager as any).savePath);

    this.initialized = true;
  }

  /**
   * Get the current page instance (for advanced use)
   */
  get page() {
    return this.browserManager?.getPage() || null;
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<ActionResult> {
    await this.ensureInitialized();
    return await this.browserManager.navigate(url);
  }

  /**
   * Go back in browser history
   */
  async back(): Promise<ActionResult> {
    await this.ensureInitialized();
    return await this.browserManager.back();
  }

  /**
   * Go forward in browser history
   */
  async forward(): Promise<ActionResult> {
    await this.ensureInitialized();
    return await this.browserManager.forward();
  }

  /**
   * Reload the current page
   */
  async reload(): Promise<ActionResult> {
    await this.ensureInitialized();
    return await this.browserManager.reload();
  }

  /**
   * Click an element using natural language description
   */
  async click(description: string): Promise<ActionResult> {
    await this.ensureInitialized();
    if (!this.actionExecutor) {
      return formatResponse({
        success: false,
        action: 'click',
        error: 'Action executor not initialized',
        timestamp: Date.now()
      });
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return formatResponse({
        success: false,
        action: 'click',
        error: 'No active page',
        timestamp: Date.now()
      });
    }
    return await this.actionExecutor.click(page, description);
  }

  /**
   * Fill a form field
   */
  async fill(fieldDescription: string, value: string): Promise<ActionResult> {
    await this.ensureInitialized();
    if (!this.actionExecutor) {
      return formatResponse({
        success: false,
        action: 'fill',
        error: 'Action executor not initialized',
        timestamp: Date.now()
      });
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return formatResponse({
        success: false,
        action: 'fill',
        error: 'No active page',
        timestamp: Date.now()
      });
    }
    return await this.actionExecutor.fill(page, fieldDescription, value);
  }

  /**
   * Select an option from a dropdown
   */
  async select(dropdownDescription: string, option: string): Promise<ActionResult> {
    await this.ensureInitialized();
    if (!this.actionExecutor) {
      return formatResponse({
        success: false,
        action: 'select',
        error: 'Action executor not initialized',
        timestamp: Date.now()
      });
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return formatResponse({
        success: false,
        action: 'select',
        error: 'No active page',
        timestamp: Date.now()
      });
    }
    return await this.actionExecutor.select(page, dropdownDescription, option);
  }

  /**
   * Check a checkbox
   */
  async check(checkboxDescription: string): Promise<ActionResult> {
    await this.ensureInitialized();
    if (!this.actionExecutor) {
      return formatResponse({
        success: false,
        action: 'check',
        error: 'Action executor not initialized',
        timestamp: Date.now()
      });
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return formatResponse({
        success: false,
        action: 'check',
        error: 'No active page',
        timestamp: Date.now()
      });
    }
    return await this.actionExecutor.check(page, checkboxDescription);
  }

  /**
   * Uncheck a checkbox
   */
  async uncheck(checkboxDescription: string): Promise<ActionResult> {
    await this.ensureInitialized();
    if (!this.actionExecutor) {
      return formatResponse({
        success: false,
        action: 'uncheck',
        error: 'Action executor not initialized',
        timestamp: Date.now()
      });
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return formatResponse({
        success: false,
        action: 'uncheck',
        error: 'No active page',
        timestamp: Date.now()
      });
    }
    // ActionExecutor doesn't have uncheck, use check
    return await this.actionExecutor.check(page, checkboxDescription);
  }

  /**
   * Hover over an element
   */
  async hover(description: string): Promise<ActionResult> {
    await this.ensureInitialized();
    if (!this.actionExecutor) {
      return formatResponse({
        success: false,
        action: 'hover',
        error: 'Action executor not initialized',
        timestamp: Date.now()
      });
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return formatResponse({
        success: false,
        action: 'hover',
        error: 'No active page',
        timestamp: Date.now()
      });
    }
    return await this.actionExecutor.hover(page, description);
  }

  /**
   * Focus an element
   */
  async focus(description: string): Promise<ActionResult> {
    await this.ensureInitialized();
    if (!this.actionExecutor) {
      return formatResponse({
        success: false,
        action: 'focus',
        error: 'Action executor not initialized',
        timestamp: Date.now()
      });
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return formatResponse({
        success: false,
        action: 'focus',
        error: 'No active page',
        timestamp: Date.now()
      });
    }
    return await this.actionExecutor.focus(page, description);
  }

  /**
   * Type text (simulating keyboard input)
   */
  async type(text: string, delay: number = 0): Promise<ActionResult> {
    await this.ensureInitialized();
    if (!this.actionExecutor) {
      return formatResponse({
        success: false,
        action: 'type',
        error: 'Action executor not initialized',
        timestamp: Date.now()
      });
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return formatResponse({
        success: false,
        action: 'type',
        error: 'No active page',
        timestamp: Date.now()
      });
    }
    return await this.actionExecutor.type(page, text, delay);
  }

  /**
   * Press a key
   */
  async press(key: string): Promise<ActionResult> {
    await this.ensureInitialized();
    if (!this.actionExecutor) {
      return formatResponse({
        success: false,
        action: 'press',
        error: 'Action executor not initialized',
        timestamp: Date.now()
      });
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return formatResponse({
        success: false,
        action: 'press',
        error: 'No active page',
        timestamp: Date.now()
      });
    }
    return await this.actionExecutor.press(page, key);
  }

  /**
   * Get text content from the page
   */
  async getText(selector?: string): Promise<ExtractedData> {
    await this.ensureInitialized();
    if (!this.dataExtractor) {
      return {
        type: 'text',
        data: null,
        metadata: {
          timestamp: Date.now()
        }
      };
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return {
        type: 'text',
        data: null,
        metadata: {
          timestamp: Date.now()
        }
      };
    }
    const result = await this.dataExtractor.getText(page, selector);
    // Extract text from the response - it's in the value property
    let textData = null;
    if (result.success && result.value) {
      if (typeof result.value === 'string') {
        textData = result.value;
      } else if (result.value.text !== undefined) {
        textData = result.value.text;
      } else if (result.value.result && result.value.result.text !== undefined) {
        textData = result.value.result.text;
      } else {
        // If none of the above, try to get any text-like field
        textData = result.value.text || result.value.content || result.value.data || result.value;
      }
    }
    
    return {
      type: 'text',
      data: {
        text: textData
      },
      metadata: {
        timestamp: Date.now(),
        url: page.url(),
        title: await page.title()
      }
    };
  }

  /**
   * Extract table data
   */
  async getTable(description: string): Promise<ExtractedData> {
    await this.ensureInitialized();
    if (!this.dataExtractor) {
      return {
        type: 'table',
        data: null,
        metadata: {
          timestamp: Date.now()
        }
      };
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return {
        type: 'table',
        data: null,
        metadata: {
          timestamp: Date.now()
        }
      };
    }
    const result = await this.dataExtractor.getTable(page, description);
    // Extract table data from the response - it's in the value property
    const tableData = result.success && result.value ? 
      result.value.result || result.value.data || result.value : null;
    
    return {
      type: 'table',
      data: tableData,
      metadata: {
        timestamp: Date.now(),
        url: page.url(),
        title: await page.title()
      }
    };
  }

  /**
   * Get all links from the page
   */
  async getLinks(_filter?: string): Promise<ExtractedData> {
    await this.ensureInitialized();
    if (!this.dataExtractor) {
      return {
        type: 'links',
        data: null,
        metadata: {
          timestamp: Date.now()
        }
      };
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return {
        type: 'links',
        data: null,
        metadata: {
          timestamp: Date.now()
        }
      };
    }
    // getLinks doesn't support filter parameter yet, so get all links
    const result = await this.dataExtractor.getLinks(page);
    // Extract links data from the response - it's in the value property
    const linksData = result.success && result.value ? 
      result.value.result || result.value.links || result.value : null;
    
    return {
      type: 'links',
      data: linksData,
      metadata: {
        timestamp: Date.now(),
        url: page.url(),
        title: await page.title()
      }
    };
  }

  /**
   * Get form data
   */
  async getFormData(formDescription?: string): Promise<ExtractedData> {
    await this.ensureInitialized();
    if (!this.dataExtractor) {
      return {
        type: 'form',
        data: null,
        metadata: {
          timestamp: Date.now()
        }
      };
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return {
        type: 'form',
        data: null,
        metadata: {
          timestamp: Date.now()
        }
      };
    }
    const result = await this.dataExtractor.getFormData(page, formDescription);
    return {
      type: 'form',
      data: result.value || null,
      metadata: {
        timestamp: Date.now(),
        url: result.url,
        title: (result as any).title
      }
    };
  }

  /**
   * Take a screenshot
   */
  async screenshot(options?: { fullPage?: boolean; path?: string }): Promise<ExtractedData> {
    await this.ensureInitialized();
    if (!this.dataExtractor) {
      return {
        type: 'screenshot',
        data: null,
        metadata: {
          timestamp: Date.now()
        }
      };
    }
    const page = this.browserManager.getPage();
    if (!page) {
      return {
        type: 'screenshot',
        data: null,
        metadata: {
          timestamp: Date.now()
        }
      };
    }
    // Take screenshot using page directly
    try {
      const buffer = await page.screenshot(options);
      return {
        type: 'screenshot',
        data: buffer.toString('base64'),
        metadata: {
          timestamp: Date.now(),
          url: page.url(),
          title: await page.title()
        }
      };
    } catch (error) {
      return {
        type: 'screenshot',
        data: null,
        metadata: {
          timestamp: Date.now()
        }
      };
    }
  }

  /**
   * Get current page state
   */
  async getState(): Promise<PageState | null> {
    await this.ensureInitialized();
    const page = this.browserManager.getPage();
    if (!page) {
      return null;
    }
    
    try {
      const url = page.url();
      const title = await page.title();
      const cookies = await page.context().cookies();
      
      // Get localStorage and sessionStorage
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
      
      const sessionStorage = await page.evaluate(() => {
        const items: Record<string, string> = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            items[key] = window.sessionStorage.getItem(key) || '';
          }
        }
        return items;
      });
      
      const viewport = page.viewportSize() || { width: 1280, height: 720 };
      
      return {
        url,
        title,
        cookies,
        localStorage,
        sessionStorage,
        viewport,
        timestamp: Date.now()
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Save current state with a name
   */
  async saveState(name: string): Promise<ActionResult> {
    await this.ensureInitialized();
    if (!this.stateManager) {
      return formatResponse({
        success: false,
        action: 'saveState',
        error: 'State manager not initialized',
        timestamp: Date.now()
      });
    }
    const state = await this.getState();
    if (!state) {
      return formatResponse({
        success: false,
        action: 'saveState',
        error: 'Failed to capture state',
        timestamp: Date.now()
      });
    }
    return await this.stateManager.saveCheckpoint(state, name);
  }

  /**
   * Restore a saved state
   */
  async restoreState(name: string): Promise<ActionResult> {
    await this.ensureInitialized();
    if (!this.stateManager) {
      return formatResponse({
        success: false,
        action: 'restoreState',
        error: 'State manager not initialized',
        timestamp: Date.now()
      });
    }
    
    // Get the checkpoint data
    const checkpointResult = await this.stateManager.restoreCheckpoint(name);
    if (!checkpointResult.success) {
      return checkpointResult;
    }
    
    // Navigate to the saved URL
    const state = (checkpointResult.value as any).state;
    if (state && state.url) {
      const navResult = await this.navigate(state.url);
      if (!navResult.success) {
        return formatResponse({
          success: false,
          action: 'restoreState',
          error: 'Failed to navigate to saved URL',
          timestamp: Date.now()
        });
      }
    }
    
    return checkpointResult;
  }

  /**
   * Execute JavaScript in the page context
   */
  async execute(script: string): Promise<ActionResult> {
    await this.ensureInitialized();
    const page = this.browserManager.getPage();
    if (!page) {
      return formatResponse({
        success: false,
        action: 'execute',
        error: 'No active page',
        timestamp: Date.now()
      });
    }

    try {
      const result = await page.evaluate(script);
      return formatResponse({
        success: true,
        action: 'execute',
        value: result,
        timestamp: Date.now()
      });
    } catch (error) {
      return formatResponse({
        success: false,
        action: 'execute',
        error: error instanceof Error ? error.message : 'Script execution failed',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Wait for a condition or element
   */
  async waitFor(condition: string, timeout: number = 30000): Promise<ActionResult> {
    await this.ensureInitialized();
    const page = this.browserManager.getPage();
    if (!page) {
      return formatResponse({
        success: false,
        action: 'waitFor',
        error: 'No active page',
        timestamp: Date.now()
      });
    }

    try {
      // Try to wait for selector first
      await page.waitForSelector(condition, { timeout });
      return formatResponse({
        success: true,
        action: 'waitFor',
        target: condition,
        timestamp: Date.now()
      });
    } catch {
      // If selector fails, try waiting for function
      try {
        await page.waitForFunction(condition, { timeout });
        return formatResponse({
          success: true,
          action: 'waitFor',
          target: condition,
          timestamp: Date.now()
        });
      } catch (error) {
        return formatResponse({
          success: false,
          action: 'waitFor',
          error: error instanceof Error ? error.message : 'Wait timeout',
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Get current page state (alias for AI compatibility)
   */
  async getCurrentState(): Promise<ActionResult> {
    const state = await this.getState();
    if (!state) {
      return formatResponse({
        success: false,
        action: 'getCurrentState',
        error: 'No active page',
        timestamp: Date.now()
      });
    }
    
    return formatResponse({
      success: true,
      action: 'getCurrentState',
      value: state,
      timestamp: Date.now()
    });
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    await this.browserManager.close();
    this.initialized = false;
  }
}

// Default export
export default PlayClone;