/**
 * ElementLocator - Natural language element selection engine
 */

import { Page, Locator } from 'playwright-core';
import { ElementSelector } from '../types';
import { ElementNormalizer } from './ElementNormalizer';

export class ElementLocator {
  private readonly roleMapping: Record<string, string[]> = {
    button: ['button', 'submit', 'reset'],
    link: ['link', 'anchor', 'a'],
    textbox: ['input', 'textbox', 'field', 'text'],
    searchbox: ['search', 'searchbox', 'search field', 'search input', 'query'],
    combobox: ['combobox', 'autocomplete', 'dropdown'],
    checkbox: ['checkbox'],
    radio: ['radio'],
    listbox: ['listbox', 'select', 'dropdown'],
    image: ['img', 'image'],
    heading: ['heading', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    list: ['list', 'ul', 'ol'],
    table: ['table', 'grid'],
    form: ['form'],
    navigation: ['navigation', 'nav'],
    main: ['main'],
    article: ['article'],
    section: ['section', 'region'],
  };

  private readonly defaultWaitOptions = {
    timeout: 30000,
    state: 'visible' as const,
    strict: false,
  };

  private readonly autoWaitOptions = {
    stabilityTimeout: 500,
    animationTimeout: 200,
    pollInterval: 100,
    maxRetries: 3,
  };

  private readonly normalizer: ElementNormalizer;

  constructor() {
    this.normalizer = new ElementNormalizer();
  }

  /**
   * Locate element using natural language or structured selector
   */
  async locate(page: Page, selector: string | ElementSelector): Promise<Locator | null> {
    try {
      // If string, parse as natural language
      if (typeof selector === 'string') {
        return await this.locateByNaturalLanguage(page, selector);
      }

      // Otherwise use structured selector
      return await this.locateByStructured(page, selector);
    } catch (error) {
      console.error('Failed to locate element:', error);
      return null;
    }
  }

  /**
   * Locate element with auto-wait functionality
   * Waits for element to appear, become visible, and be stable
   */
  async locateWithWait(
    page: Page, 
    selector: string | ElementSelector,
    options?: {
      timeout?: number;
      waitForStable?: boolean;
      waitForAnimation?: boolean;
    }
  ): Promise<Locator | null> {
    const startTime = Date.now();
    const timeout = options?.timeout || this.defaultWaitOptions.timeout;
    
    let lastError: Error | null = null;
    let attempts = 0;

    while (Date.now() - startTime < timeout) {
      attempts++;
      
      try {
        // Try to locate the element
        const element = await this.locate(page, selector);
        
        if (element) {
          // Wait for element to be attached to DOM
          await element.waitFor({ 
            state: 'attached', 
            timeout: Math.max(1000, timeout - (Date.now() - startTime))
          });

          // Wait for element to be visible
          await element.waitFor({ 
            state: 'visible',
            timeout: Math.max(1000, timeout - (Date.now() - startTime))
          });

          // Wait for element to be stable (not moving/animating)
          if (options?.waitForStable !== false) {
            await this.waitForElementStability(element);
          }

          // Wait for animations to complete
          if (options?.waitForAnimation !== false) {
            await this.waitForAnimations(page);
          }

          // Verify element is still there and interactable
          if (await this.isInteractable(element)) {
            return element;
          }
        }
      } catch (error) {
        lastError = error as Error;
        // Continue retrying
      }

      // Brief pause before retry
      await page.waitForTimeout(this.autoWaitOptions.pollInterval);
    }

    console.error(`Failed to locate element after ${attempts} attempts:`, lastError);
    return null;
  }

  /**
   * Wait for element to stop moving/resizing
   */
  private async waitForElementStability(locator: Locator): Promise<void> {
    try {
      let previousBox = await locator.boundingBox();
      let stableCount = 0;
      const requiredStableChecks = 3;

      while (stableCount < requiredStableChecks) {
        await locator.page().waitForTimeout(this.autoWaitOptions.pollInterval);
        
        const currentBox = await locator.boundingBox();
        
        if (!currentBox || !previousBox) {
          break;
        }

        // Check if element position and size are stable
        const isStable = 
          Math.abs(currentBox.x - previousBox.x) < 1 &&
          Math.abs(currentBox.y - previousBox.y) < 1 &&
          Math.abs(currentBox.width - previousBox.width) < 1 &&
          Math.abs(currentBox.height - previousBox.height) < 1;

        if (isStable) {
          stableCount++;
        } else {
          stableCount = 0;
        }

        previousBox = currentBox;
      }
    } catch (error) {
      // Element might have disappeared, that's ok
    }
  }

  /**
   * Wait for animations to complete
   */
  private async waitForAnimations(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        return Promise.all(
          Array.from(document.getAnimations()).map(animation => animation.finished)
        );
      });
      
      // Additional wait for CSS transitions
      await page.waitForTimeout(this.autoWaitOptions.animationTimeout);
    } catch {
      // Animations might not be supported or finished
    }
  }

  /**
   * Check if element is interactable
   */
  private async isInteractable(locator: Locator): Promise<boolean> {
    try {
      const isVisible = await locator.isVisible();
      const isEnabled = await locator.isEnabled();
      
      // Check if element is not covered by other elements
      const box = await locator.boundingBox();
      if (!box) return false;

      const isNotCovered = await locator.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const elementAtPoint = document.elementFromPoint(centerX, centerY);
        
        return el === elementAtPoint || el.contains(elementAtPoint);
      });

      return isVisible && isEnabled && isNotCovered;
    } catch {
      return false;
    }
  }

  /**
   * Wait for dynamic content to load
   * Monitors for DOM changes and network activity
   */
  async waitForDynamicContent(
    page: Page,
    options?: {
      timeout?: number;
      waitForLoadState?: 'load' | 'domcontentloaded' | 'networkidle';
      waitForSelector?: string;
    }
  ): Promise<void> {
    const timeout = options?.timeout || this.defaultWaitOptions.timeout;
    const loadState = options?.waitForLoadState || 'domcontentloaded';

    try {
      // Wait for basic page load state
      await page.waitForLoadState(loadState, { timeout });

      // Wait for specific selector if provided
      if (options?.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { 
          timeout,
          state: 'visible' 
        });
      }

      // Wait for any pending XHR/fetch requests
      await this.waitForNetworkIdle(page, timeout);

      // Wait for DOM to stabilize
      await this.waitForDOMStability(page);
    } catch (error) {
      console.warn('Dynamic content wait timeout:', error);
    }
  }

  /**
   * Wait for network to be idle
   */
  private async waitForNetworkIdle(page: Page, timeout: number): Promise<void> {
    try {
      await page.waitForLoadState('networkidle', { timeout: Math.min(5000, timeout) });
    } catch {
      // Network might not become idle, continue anyway
    }
  }

  /**
   * Wait for DOM to stop changing
   */
  private async waitForDOMStability(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          let changes = 0;
          let timeoutId: NodeJS.Timeout;

          const observer = new MutationObserver(() => {
            changes++;
            clearTimeout(timeoutId);
            
            timeoutId = setTimeout(() => {
              if (changes === 0) {
                observer.disconnect();
                resolve();
              }
              changes = 0;
            }, 500);
          });

          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
          });

          // Maximum wait time
          setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 3000);
        });
      });
    } catch {
      // DOM observation failed, continue
    }
  }

  /**
   * Locate element using natural language description
   */
  private async locateByNaturalLanguage(page: Page, description: string): Promise<Locator | null> {
    // First, normalize the description
    const normalized = this.normalizer.normalize(description);
    const hints = this.normalizer.toSelectorHints(normalized);
    
    // Try different strategies in order
    let element: Locator | null = null;

    // Special handling for search-related terms
    if (description.toLowerCase().includes('search')) {
      // Try combobox first (Google uses this)
      element = page.getByRole('combobox');
      if (await element.count() > 0) {
        const firstCombo = element.first();
        if (await this.isVisible(firstCombo)) return firstCombo;
      }
      
      // Then try searchbox
      element = page.getByRole('searchbox');
      if (await element.count() > 0) {
        const firstSearch = element.first();
        if (await this.isVisible(firstSearch)) return firstSearch;
      }
      
      // Try textbox as fallback
      element = page.getByRole('textbox');
      if (await element.count() > 0) {
        const firstText = element.first();
        if (await this.isVisible(firstText)) return firstText;
      }
    }

    // 1. Try using normalized hints for more accurate matching
    if (hints.role && hints.text) {
      element = await this.findByRoleAndText(page, hints.role, hints.text);
      if (element && await this.isVisible(element)) return element;
    }

    // 2. Try exact text match with original and normalized
    element = await this.findByText(page, hints.text || normalized.normalized);
    if (element && await this.isVisible(element)) return element;

    // 3. Try role-based matching with normalized element type
    if (hints.role) {
      element = await this.findByRoleWithHints(page, hints);
      if (element && await this.isVisible(element)) return element;
    }

    // 4. Try aria-label with hints
    if (hints.label) {
      element = await this.findByAriaLabel(page, hints.label);
      if (element && await this.isVisible(element)) return element;
    }

    // 5. Try placeholder with hints
    if (hints.placeholder) {
      element = await this.findByPlaceholder(page, hints.placeholder);
      if (element && await this.isVisible(element)) return element;
    }

    // 6. Fall back to original strategies with the original description
    const originalNormalized = description.toLowerCase().trim();
    
    element = await this.findByRole(page, originalNormalized);
    if (element && await this.isVisible(element)) return element;

    element = await this.findByAriaLabel(page, originalNormalized);
    if (element && await this.isVisible(element)) return element;

    element = await this.findByPlaceholder(page, originalNormalized);
    if (element && await this.isVisible(element)) return element;

    // 7. Try fuzzy text matching
    element = await this.findByFuzzyText(page, originalNormalized);
    if (element && await this.isVisible(element)) return element;

    // 8. Try CSS selector if it looks like one
    if (this.looksLikeSelector(description)) {
      element = page.locator(description);
      if (await element.count() > 0) return element.first();
    }

    return null;
  }

  /**
   * Find element by role and text combined
   */
  private async findByRoleAndText(page: Page, role: string, text: string): Promise<Locator | null> {
    try {
      const locator = page.getByRole(role as any, { name: text });
      if (await locator.count() > 0) return locator.first();
    } catch {
      // Role might not be valid
    }
    return null;
  }

  /**
   * Find element by role with hints
   */
  private async findByRoleWithHints(page: Page, hints: any): Promise<Locator | null> {
    try {
      const options: any = {};
      if (hints.text) options.name = hints.text;
      
      const locator = page.getByRole(hints.role as any, options);
      if (await locator.count() > 0) {
        // Apply modifiers if any
        if (hints.modifiers && hints.modifiers.length > 0) {
          for (const modifier of hints.modifiers) {
            if (modifier === ':first') return locator.first();
            if (modifier === ':last') return locator.last();
            if (modifier.startsWith(':nth(')) {
              const index = parseInt(modifier.match(/\d+/)?.[0] || '0');
              return locator.nth(index);
            }
          }
        }
        return locator.first();
      }
    } catch {
      // Role might not be valid
    }
    return null;
  }

  /**
   * Locate element using structured selector
   */
  private async locateByStructured(page: Page, selector: ElementSelector): Promise<Locator | null> {
    // Build Playwright locator from structured selector
    let locator: Locator | null = null;

    // Try different selector properties in priority order
    if (selector.css) {
      locator = page.locator(selector.css);
    } else if (selector.xpath) {
      locator = page.locator(selector.xpath);
    } else if (selector.id) {
      locator = page.locator(`#${selector.id}`);
    } else if (selector.text) {
      locator = page.getByText(selector.text, { exact: false });
    } else if (selector.role) {
      locator = page.getByRole(selector.role as any, {
        name: selector.label,
      });
    } else if (selector.label) {
      locator = page.getByLabel(selector.label);
    } else if (selector.placeholder) {
      locator = page.getByPlaceholder(selector.placeholder);
    } else if (selector.title) {
      locator = page.getByTitle(selector.title);
    } else if (selector.alt) {
      locator = page.getByAltText(selector.alt);
    } else if (selector.name) {
      locator = page.locator(`[name="${selector.name}"]`);
    } else if (selector.class) {
      locator = page.locator(`.${selector.class}`);
    }

    // Apply index if specified
    if (locator && selector.index !== undefined) {
      locator = locator.nth(selector.index);
    }

    // Verify element exists
    if (locator && await locator.count() > 0) {
      return locator.first();
    }

    return null;
  }

  /**
   * Find element by text content
   */
  private async findByText(page: Page, text: string): Promise<Locator | null> {
    // Try exact match first
    let locator = page.getByText(text, { exact: true });
    if (await locator.count() > 0) return locator.first();

    // Try case-insensitive
    locator = page.getByText(new RegExp(text, 'i'));
    if (await locator.count() > 0) return locator.first();

    return null;
  }

  /**
   * Find element by role
   */
  private async findByRole(page: Page, description: string): Promise<Locator | null> {
    // Extract role from description
    for (const [key, aliases] of Object.entries(this.roleMapping)) {
      for (const alias of aliases) {
        if (description.includes(alias)) {
          // Extract label from description
          const labelMatch = description.match(new RegExp(`${alias}\\s+(.+)`));
          const label = labelMatch ? labelMatch[1] : undefined;
          
          // Try with label first
          if (label) {
            const locator = page.getByRole(key as any, { name: label });
            if (await locator.count() > 0) return locator.first();
          }
          
          // Try without label for single-word descriptions like "search"
          const locatorNoLabel = page.getByRole(key as any);
          if (await locatorNoLabel.count() > 0) return locatorNoLabel.first();
        }
      }
    }

    return null;
  }

  /**
   * Find element by aria-label
   */
  private async findByAriaLabel(page: Page, label: string): Promise<Locator | null> {
    const locator = page.locator(`[aria-label*="${label}" i]`);
    if (await locator.count() > 0) return locator.first();
    return null;
  }

  /**
   * Find element by placeholder
   */
  private async findByPlaceholder(page: Page, placeholder: string): Promise<Locator | null> {
    const locator = page.getByPlaceholder(new RegExp(placeholder, 'i'));
    if (await locator.count() > 0) return locator.first();
    return null;
  }

  /**
   * Find element by fuzzy text matching
   */
  private async findByFuzzyText(page: Page, text: string): Promise<Locator | null> {
    // Split text into words for partial matching
    const words = text.split(/\s+/);
    
    for (const word of words) {
      if (word.length < 3) continue; // Skip short words
      
      const locator = page.locator(`text=${word}`);
      if (await locator.count() > 0) {
        // Verify it's a meaningful element
        const tagName = await locator.first().evaluate(el => el.tagName.toLowerCase());
        if (['button', 'a', 'input', 'select', 'textarea'].includes(tagName)) {
          return locator.first();
        }
      }
    }

    return null;
  }

  /**
   * Check if string looks like a CSS/XPath selector
   */
  private looksLikeSelector(str: string): boolean {
    return /^[#.\[\/]/.test(str) || str.startsWith('//');
  }

  /**
   * Locate all matching elements on the page
   */
  async locateAll(page: Page, selector: string | ElementSelector): Promise<Locator[]> {
    const normalizedSelector = typeof selector === 'string' 
      ? this.normalizer.normalize(selector)
      : selector;

    const strategies = this.getSelectionStrategies(normalizedSelector);
    const results: Locator[] = [];

    for (const strategy of strategies) {
      try {
        const locators = await page.locator(strategy.selector).all();
        if (locators.length > 0) {
          results.push(...locators);
        }
      } catch (error) {
        // Continue with next strategy
      }
    }

    return results;
  }

  /**
   * Wait for element to appear
   */
  async waitForElement(
    page: Page,
    selector: string | ElementSelector,
    options?: { timeout?: number; state?: 'visible' | 'attached' | 'hidden' | 'detached' }
  ): Promise<Locator | null> {
    const timeout = options?.timeout || this.defaultWaitOptions.timeout;
    const state = options?.state || 'visible';

    const normalizedSelector = typeof selector === 'string'
      ? this.normalizer.normalize(selector)
      : selector;

    const strategies = this.getSelectionStrategies(normalizedSelector);

    for (const strategy of strategies) {
      try {
        await page.waitForSelector(strategy.selector, { timeout, state });
        const locator = page.locator(strategy.selector).first();
        if (await this.isVisible(locator)) {
          return locator;
        }
      } catch {
        // Try next strategy
      }
    }

    return null;
  }

  /**
   * Get element information
   */
  async getElementInfo(locator: Locator): Promise<any> {
    try {
      const box = await locator.boundingBox();
      const text = await locator.textContent();
      const tagName = await locator.evaluate(el => el.tagName.toLowerCase());
      const attributes = await locator.evaluate(el => {
        const attrs: Record<string, string> = {};
        for (const attr of el.attributes) {
          attrs[attr.name] = attr.value;
        }
        return attrs;
      });

      return {
        visible: await this.isVisible(locator),
        text,
        tagName,
        attributes,
        position: box
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if element is visible (overloaded for compatibility)
   */
  async isVisible(locatorOrPage: Locator | Page, selector?: string): Promise<boolean> {
    try {
      // If called with page and selector (for testing)
      if (selector !== undefined) {
        const page = locatorOrPage as Page;
        const element = await this.locate(page, selector);
        if (!element) return false;
        return await element.isVisible();
      }
      
      // If called with just a locator
      const locator = locatorOrPage as Locator;
      return await locator.isVisible();
    } catch {
      return false;
    }
  }

  /**
   * Get accessibility tree for element finding
   */
  async getAccessibilityTree(page: Page): Promise<any> {
    return await page.accessibility.snapshot();
  }

  /**
   * Find clickable elements on page
   */
  async findClickableElements(page: Page): Promise<Array<{ text: string; selector: string }>> {
    const elements = await page.evaluate(() => {
      const clickable: Array<{ text: string; selector: string }> = [];
      
      // Find buttons
      document.querySelectorAll('button, [role="button"]').forEach((el) => {
        const text = (el.textContent || '').trim();
        if (text) {
          clickable.push({
            text,
            selector: el.id ? `#${el.id}` : `button:has-text("${text}")`,
          });
        }
      });

      // Find links
      document.querySelectorAll('a[href]').forEach((el) => {
        const text = (el.textContent || '').trim();
        if (text) {
          clickable.push({
            text,
            selector: el.id ? `#${el.id}` : `a:has-text("${text}")`,
          });
        }
      });

      // Find inputs with type button/submit
      document.querySelectorAll('input[type="button"], input[type="submit"]').forEach((el: any) => {
        const text = el.value || el.placeholder || '';
        if (text) {
          clickable.push({
            text,
            selector: el.id ? `#${el.id}` : `input[value="${text}"]`,
          });
        }
      });

      return clickable;
    });

    return elements;
  }

  /**
   * Find form elements on page
   */
  async findFormElements(page: Page): Promise<Array<{ label: string; selector: string; type: string }>> {
    const elements = await page.evaluate(() => {
      const formElements: Array<{ label: string; selector: string; type: string }> = [];
      
      // Find all form inputs
      document.querySelectorAll('input, textarea, select').forEach((el: any) => {
        const label = el.placeholder || 
                     el.getAttribute('aria-label') || 
                     el.name || 
                     el.id || 
                     '';
        
        if (label) {
          formElements.push({
            label,
            selector: el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : '',
            type: el.tagName.toLowerCase(),
          });
        }
      });

      return formElements;
    });

    return elements;
  }
}