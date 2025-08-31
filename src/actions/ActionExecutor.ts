/**
 * ActionExecutor - Executes browser actions with natural language support
 */

import { Page } from 'playwright-core';
import { ElementLocator } from '../selectors/ElementLocator';
import { ElementSelector, ActionResult } from '../types';
import { formatSuccess, formatError } from '../utils/responseFormatter';

export class ActionExecutor {
  private elementLocator: ElementLocator;
  private defaultTimeout: number = 5000;

  constructor(elementLocator: ElementLocator) {
    this.elementLocator = elementLocator;
  }

  /**
   * Format error message for consistent test expectations
   */
  private formatActionError(error: Error | string, action: string): ActionResult {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const formattedMessage = errorMessage.includes('Failed to') 
      ? errorMessage 
      : `Failed to ${action}: ${errorMessage}`;
    return formatError(formattedMessage, action);
  }

  /**
   * Click on an element
   */
  async click(page: Page, selector: string | ElementSelector): Promise<ActionResult> {
    try {
      const startTime = Date.now();
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
        waitForStable: true,
        waitForAnimation: true,
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'click');
      }

      // Scroll into view if needed
      await element.scrollIntoViewIfNeeded();
      
      // Perform click
      await element.click();

      return formatSuccess('click', {
        selector: this.selectorToString(selector),
        duration: Date.now() - startTime,
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'click');
    }
  }

  /**
   * Double click on an element
   */
  async doubleClick(page: Page, selector: string | ElementSelector): Promise<ActionResult> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
        waitForStable: true,
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'doubleClick');
      }

      await element.dblclick();

      return formatSuccess('doubleClick', {
        selector: this.selectorToString(selector),
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'doubleClick');
    }
  }

  /**
   * Right click on an element
   */
  async rightClick(page: Page, selector: string | ElementSelector): Promise<ActionResult> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
        waitForStable: true,
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'rightClick');
      }

      await element.click({ button: 'right' });

      return formatSuccess('rightClick', {
        selector: this.selectorToString(selector),
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'rightClick');
    }
  }

  /**
   * Fill a form field
   */
  async fill(page: Page, selector: string | ElementSelector, value: string): Promise<ActionResult> {
    try {
      const startTime = Date.now();
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
        waitForStable: true,
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'fill');
      }

      // Scroll into view if needed
      await element.scrollIntoViewIfNeeded();
      
      // Clear and fill
      await element.fill(value);

      return formatSuccess('fill', {
        selector: this.selectorToString(selector),
        value: value.length > 50 ? value.substring(0, 50) + '...' : value,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'fill');
    }
  }

  /**
   * Type text with realistic typing simulation
   */
  async type(page: Page, text: string, delay: number = 50): Promise<ActionResult> {
    try {
      const startTime = Date.now();
      
      // Type directly on the page (focused element)
      await page.keyboard.type(text, { delay });

      return formatSuccess('type', {
        textLength: text.length,
        delay,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'type');
    }
  }

  /**
   * Type into a specific element
   */
  async typeInto(page: Page, selector: string | ElementSelector, text: string, delay: number = 50): Promise<ActionResult> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
        waitForStable: true,
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'typeInto');
      }

      await element.focus();
      await element.type(text, { delay });

      return formatSuccess('typeInto', {
        selector: this.selectorToString(selector),
        textLength: text.length,
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'typeInto');
    }
  }

  /**
   * Press keyboard key
   */
  async press(page: Page, key: string): Promise<ActionResult> {
    try {
      await page.keyboard.press(key);
      
      return formatSuccess('press', { key });
    } catch (error) {
      return this.formatActionError(error as Error, 'press');
    }
  }

  /**
   * Press key combination
   */
  async pressKeys(page: Page, keys: string[]): Promise<ActionResult> {
    try {
      // Press modifier keys
      for (const key of keys.slice(0, -1)) {
        await page.keyboard.down(key);
      }
      
      // Press final key
      await page.keyboard.press(keys[keys.length - 1]);
      
      // Release modifier keys
      for (const key of keys.slice(0, -1).reverse()) {
        await page.keyboard.up(key);
      }

      return formatSuccess('pressKeys', { keys: keys.join('+') });
    } catch (error) {
      return this.formatActionError(error as Error, 'pressKeys');
    }
  }

  /**
   * Select option from dropdown
   */
  async select(page: Page, selector: string | ElementSelector, value: string | string[]): Promise<ActionResult> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
        waitForStable: true,
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'select');
      }
      
      // Handle select element
      const values = Array.isArray(value) ? value : [value];
      await element.selectOption(values);

      return formatSuccess('select', {
        selector: this.selectorToString(selector),
        value: values,
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'select');
    }
  }

  /**
   * Check or uncheck checkbox/radio
   */
  async check(page: Page, selector: string | ElementSelector, checked: boolean = true): Promise<ActionResult> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
        waitForStable: true,
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'check');
      }
      
      // Check current state
      const isChecked = await element.isChecked();
      
      if (isChecked !== checked) {
        if (checked) {
          await element.check();
        } else {
          await element.uncheck();
        }
      }

      return formatSuccess('check', {
        selector: this.selectorToString(selector),
        checked,
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'check');
    }
  }

  /**
   * Hover over element
   */
  async hover(page: Page, selector: string | ElementSelector): Promise<ActionResult> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
        waitForStable: true,
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'hover');
      }

      await element.hover();

      return formatSuccess('hover', {
        selector: this.selectorToString(selector),
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'hover');
    }
  }

  /**
   * Focus on element
   */
  async focus(page: Page, selector: string | ElementSelector): Promise<ActionResult> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
        waitForStable: true,
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'focus');
      }

      await element.focus();

      return formatSuccess('focus', {
        selector: this.selectorToString(selector),
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'focus');
    }
  }

  /**
   * Blur (unfocus) element
   */
  async blur(page: Page, selector: string | ElementSelector): Promise<ActionResult> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'blur');
      }

      await element.blur();

      return formatSuccess('blur', {
        selector: this.selectorToString(selector),
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'blur');
    }
  }

  /**
   * Scroll element into view
   */
  async scrollIntoView(page: Page, selector: string | ElementSelector): Promise<ActionResult> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'scrollIntoView');
      }

      await element.scrollIntoViewIfNeeded();

      return formatSuccess('scrollIntoView', {
        selector: this.selectorToString(selector),
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'scrollIntoView');
    }
  }

  /**
   * Scroll page
   */
  async scroll(page: Page, direction: 'up' | 'down' | 'left' | 'right', amount: number = 100): Promise<ActionResult> {
    try {
      const scrollAmount = {
        up: { x: 0, y: -amount },
        down: { x: 0, y: amount },
        left: { x: -amount, y: 0 },
        right: { x: amount, y: 0 },
      };

      const { x, y } = scrollAmount[direction];
      
      await page.evaluate(({ x, y }) => {
        (window as any).scrollBy(x, y);
      }, { x, y });

      return formatSuccess('scroll', { direction, amount });
    } catch (error) {
      return this.formatActionError(error as Error, 'scroll');
    }
  }

  /**
   * Drag and drop
   */
  async dragAndDrop(page: Page, sourceSelector: string | ElementSelector, targetSelector: string | ElementSelector): Promise<ActionResult> {
    try {
      const source = await this.elementLocator.locateWithWait(page, sourceSelector, {
        timeout: this.defaultTimeout,
        waitForStable: true,
      });
      const target = await this.elementLocator.locateWithWait(page, targetSelector, {
        timeout: this.defaultTimeout,
        waitForStable: true,
      });
      
      if (!source) {
        return formatError(`Source element not found: ${this.selectorToString(sourceSelector)}`, 'dragAndDrop');
      }
      
      if (!target) {
        return formatError(`Target element not found: ${this.selectorToString(targetSelector)}`, 'dragAndDrop');
      }

      await source.dragTo(target);

      return formatSuccess('dragAndDrop', {
        source: this.selectorToString(sourceSelector),
        target: this.selectorToString(targetSelector),
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'dragAndDrop');
    }
  }

  /**
   * Upload file(s)
   */
  async uploadFile(page: Page, selector: string | ElementSelector, filePaths: string | string[]): Promise<ActionResult> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'uploadFile');
      }

      const files = Array.isArray(filePaths) ? filePaths : [filePaths];
      await element.setInputFiles(files);

      return formatSuccess('uploadFile', {
        selector: this.selectorToString(selector),
        files: files.map(f => f.split('/').pop()),
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'uploadFile');
    }
  }

  /**
   * Clear input field
   */
  async clear(page: Page, selector: string | ElementSelector): Promise<ActionResult> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
        waitForStable: true,
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'clear');
      }

      await element.fill('');

      return formatSuccess('clear', {
        selector: this.selectorToString(selector),
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'clear');
    }
  }

  /**
   * Wait for element
   */
  async waitForElement(page: Page, selector: string | ElementSelector, options?: { state?: 'visible' | 'hidden' | 'attached' | 'detached'; timeout?: number }): Promise<ActionResult> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: options?.timeout || this.defaultTimeout,
        waitForStable: options?.state === 'visible',
      });
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'waitForElement');
      }

      await element.waitFor({
        state: options?.state || 'visible',
        timeout: options?.timeout || this.defaultTimeout,
      });

      return formatSuccess('waitForElement', {
        selector: this.selectorToString(selector),
        state: options?.state || 'visible',
      });
    } catch (error) {
      return this.formatActionError(error as Error, 'waitForElement');
    }
  }

  /**
   * Get value from input element
   */
  async getValue(page: Page, selector: string | ElementSelector): Promise<ActionResult> {
    try {
      const element = await this.elementLocator.locate(page, selector);
      
      if (!element) {
        return formatError(`Element not found: ${this.selectorToString(selector)}`, 'getValue');
      }

      // Get the tag name to determine how to get the value
      const tagName = await element.evaluate((el) => el.tagName.toLowerCase());
      
      let value: any;
      
      if (tagName === 'input') {
        const type = await element.getAttribute('type');
        if (type === 'checkbox' || type === 'radio') {
          value = await element.isChecked();
        } else {
          value = await element.inputValue();
        }
      } else if (tagName === 'select') {
        value = await element.evaluate((el) => (el as HTMLSelectElement).value);
      } else if (tagName === 'textarea') {
        value = await element.inputValue();
      } else {
        // For other elements, get text content
        value = await element.textContent();
      }

      return formatSuccess('getValue', value, this.selectorToString(selector));
    } catch (error) {
      return this.formatActionError(error as Error, 'getValue');
    }
  }

  /**
   * Convert selector to string for logging
   */
  private selectorToString(selector: string | ElementSelector): string {
    if (typeof selector === 'string') {
      return selector;
    }
    
    // Build descriptive string from structured selector
    const parts = [];
    if (selector.text) parts.push(`text="${selector.text}"`);
    if (selector.role) parts.push(`role="${selector.role}"`);
    if (selector.label) parts.push(`label="${selector.label}"`);
    if (selector.id) parts.push(`id="${selector.id}"`);
    if (selector.class) parts.push(`class="${selector.class}"`);
    
    return parts.join(', ') || 'unknown selector';
  }
}