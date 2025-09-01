import { PlayClone } from '../PlayClone';
import { ElementHandle, Page } from 'playwright-core';

/**
 * WebElement compatibility wrapper for Selenium-like interface
 */
export class WebElement {
  constructor(
    private element: ElementHandle,
    private page: Page
  ) {}

  async click(): Promise<void> {
    await this.element.click();
  }

  async sendKeys(...keys: string[]): Promise<void> {
    const text = keys.join('');
    await this.element.fill(text);
  }

  async clear(): Promise<void> {
    await this.element.fill('');
  }

  async getText(): Promise<string> {
    return await this.element.textContent() || '';
  }

  async getAttribute(name: string): Promise<string | null> {
    return await this.element.getAttribute(name);
  }

  async isDisplayed(): Promise<boolean> {
    return await this.element.isVisible();
  }

  async isEnabled(): Promise<boolean> {
    return await this.element.isEnabled();
  }

  async isSelected(): Promise<boolean> {
    return await this.element.isChecked();
  }

  async getTagName(): Promise<string> {
    return await this.element.evaluate(el => (el as HTMLElement).tagName.toLowerCase());
  }

  async getCssValue(propertyName: string): Promise<string> {
    return await this.element.evaluate((el, prop) => {
      return window.getComputedStyle(el as Element).getPropertyValue(prop);
    }, propertyName);
  }

  async getLocation(): Promise<{ x: number; y: number }> {
    const box = await this.element.boundingBox();
    return box ? { x: box.x, y: box.y } : { x: 0, y: 0 };
  }

  async getSize(): Promise<{ width: number; height: number }> {
    const box = await this.element.boundingBox();
    return box ? { width: box.width, height: box.height } : { width: 0, height: 0 };
  }

  async submit(): Promise<void> {
    await this.element.evaluate(el => {
      if (el instanceof HTMLFormElement) {
        el.submit();
      } else {
        const form = (el as HTMLElement).closest('form');
        if (form) form.submit();
      }
    });
  }
}

/**
 * By locator strategies for Selenium compatibility
 */
export class By {
  constructor(
    public using: string,
    public value: string
  ) {}

  static id(id: string): By {
    return new By('id', id);
  }

  static byName(name: string): By {
    return new By('name', name);
  }

  static className(className: string): By {
    return new By('class name', className);
  }

  static css(selector: string): By {
    return new By('css selector', selector);
  }

  static xpath(xpath: string): By {
    return new By('xpath', xpath);
  }

  static tagName(tagName: string): By {
    return new By('tag name', tagName);
  }

  static linkText(linkText: string): By {
    return new By('link text', linkText);
  }

  static partialLinkText(partialLinkText: string): By {
    return new By('partial link text', partialLinkText);
  }

  toPlayCloneSelector(): string {
    switch (this.using) {
      case 'id':
        return `#${this.value}`;
      case 'name':
        return `[name="${this.value}"]`;
      case 'class name':
        return `.${this.value.replace(/\s+/g, '.')}`;
      case 'css selector':
        return this.value;
      case 'xpath':
        return `xpath=${this.value}`;
      case 'tag name':
        return this.value;
      case 'link text':
        return `text="${this.value}"`;
      case 'partial link text':
        return `text=${this.value}`;
      default:
        return this.value;
    }
  }
}

/**
 * Selenium WebDriver compatibility layer for PlayClone
 */
export class SeleniumWebDriver {
  private playClone: PlayClone;
  private currentPage: Page | null = null;

  constructor(options: any = {}) {
    this.playClone = new PlayClone({
      headless: options.headless ?? false,
      browserType: options.browserName || 'chromium',
      ...options
    });
  }

  /**
   * Navigate to a URL
   */
  async get(url: string): Promise<void> {
    const result = await this.playClone.navigate(url);
    if (!result.success) {
      throw new Error(`Navigation failed: ${result.error}`);
    }
    this.currentPage = this.playClone.page;
  }

  /**
   * Get current URL
   */
  async getCurrentUrl(): Promise<string> {
    if (!this.currentPage) {
      throw new Error('No page available. Navigate to a URL first.');
    }
    return this.currentPage.url();
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    if (!this.currentPage) {
      throw new Error('No page available. Navigate to a URL first.');
    }
    return await this.currentPage.title();
  }

  /**
   * Get page source
   */
  async getPageSource(): Promise<string> {
    if (!this.currentPage) {
      throw new Error('No page available. Navigate to a URL first.');
    }
    return await this.currentPage.content();
  }

  /**
   * Find single element
   */
  async findElement(by: By): Promise<WebElement> {
    if (!this.currentPage) {
      throw new Error('No page available. Navigate to a URL first.');
    }

    const selector = by.toPlayCloneSelector();
    const element = await this.currentPage.$(selector);
    
    if (!element) {
      throw new Error(`No element found with selector: ${selector}`);
    }

    return new WebElement(element, this.currentPage);
  }

  /**
   * Find multiple elements
   */
  async findElements(by: By): Promise<WebElement[]> {
    if (!this.currentPage) {
      throw new Error('No page available. Navigate to a URL first.');
    }

    const selector = by.toPlayCloneSelector();
    const elements = await this.currentPage.$$(selector);
    
    return elements.map(el => new WebElement(el, this.currentPage!));
  }

  /**
   * Execute JavaScript
   */
  async executeScript(script: string, ...args: any[]): Promise<any> {
    if (!this.currentPage) {
      throw new Error('No page available. Navigate to a URL first.');
    }

    return await this.currentPage.evaluate(script, ...args);
  }

  /**
   * Execute async JavaScript
   */
  async executeAsyncScript(script: string, ...args: any[]): Promise<any> {
    if (!this.currentPage) {
      throw new Error('No page available. Navigate to a URL first.');
    }

    return await this.currentPage.evaluate(script, ...args);
  }

  /**
   * Take screenshot
   */
  async getScreenshotAsBase64(): Promise<string> {
    const result = await this.playClone.screenshot();
    if (!result || !result.data) {
      throw new Error('Failed to take screenshot');
    }
    return result.data;
  }

  /**
   * Navigate back
   */
  async back(): Promise<void> {
    await this.playClone.back();
  }

  /**
   * Navigate forward
   */
  async forward(): Promise<void> {
    await this.playClone.forward();
  }

  /**
   * Refresh page
   */
  async refresh(): Promise<void> {
    await this.playClone.reload();
  }

  /**
   * Close browser
   */
  async quit(): Promise<void> {
    await this.playClone.close();
  }

  /**
   * Close current window
   */
  async close(): Promise<void> {
    if (this.currentPage) {
      await this.currentPage.close();
      this.currentPage = null;
    }
  }

  /**
   * Switch to frame
   */
  async switchToFrame(frameElement: WebElement | number | null): Promise<void> {
    if (!this.currentPage) {
      throw new Error('No page available. Navigate to a URL first.');
    }

    if (frameElement === null) {
      // Switch to default content
      this.currentPage = this.currentPage.mainFrame().page();
    } else if (typeof frameElement === 'number') {
      // Switch by index
      const frames = this.currentPage.frames();
      if (frameElement < 0 || frameElement >= frames.length) {
        throw new Error(`Frame index ${frameElement} out of bounds`);
      }
      this.currentPage = frames[frameElement].page();
    } else {
      // Switch by element - not directly supported, would need workaround
      throw new Error('Switching to frame by element not yet implemented');
    }
  }

  /**
   * Get window handles
   */
  async getWindowHandles(): Promise<string[]> {
    if (!this.currentPage) {
      throw new Error('No page available. Navigate to a URL first.');
    }
    
    const pages = this.currentPage.context().pages();
    return pages.map((_, index) => `window-${index}`);
  }

  /**
   * Get current window handle
   */
  async getWindowHandle(): Promise<string> {
    if (!this.currentPage) {
      throw new Error('No page available. Navigate to a URL first.');
    }
    
    const pages = this.currentPage.context().pages();
    const index = pages.indexOf(this.currentPage);
    return `window-${index}`;
  }

  /**
   * Switch to window
   */
  async switchToWindow(handle: string): Promise<void> {
    if (!this.currentPage) {
      throw new Error('No page available. Navigate to a URL first.');
    }
    
    const match = handle.match(/window-(\d+)/);
    if (!match) {
      throw new Error(`Invalid window handle: ${handle}`);
    }
    
    const index = parseInt(match[1]);
    const pages = this.currentPage.context().pages();
    
    if (index < 0 || index >= pages.length) {
      throw new Error(`Window handle ${handle} not found`);
    }
    
    this.currentPage = pages[index];
  }

  /**
   * Manage cookies
   */
  get manage() {
    return {
      getCookies: async () => {
        if (!this.currentPage) {
          throw new Error('No page available. Navigate to a URL first.');
        }
        return await this.currentPage.context().cookies();
      },
      
      addCookie: async (cookie: any) => {
        if (!this.currentPage) {
          throw new Error('No page available. Navigate to a URL first.');
        }
        await this.currentPage.context().addCookies([cookie]);
      },
      
      deleteAllCookies: async () => {
        if (!this.currentPage) {
          throw new Error('No page available. Navigate to a URL first.');
        }
        await this.currentPage.context().clearCookies();
      },
      
      deleteCookie: async (name: string) => {
        if (!this.currentPage) {
          throw new Error('No page available. Navigate to a URL first.');
        }
        const cookies = await this.currentPage.context().cookies();
        const filteredCookies = cookies.filter(c => c.name !== name);
        await this.currentPage.context().clearCookies();
        await this.currentPage.context().addCookies(filteredCookies);
      },
      
      window: () => ({
        setSize: async (width: number, height: number) => {
          if (!this.currentPage) {
            throw new Error('No page available. Navigate to a URL first.');
          }
          await this.currentPage.setViewportSize({ width, height });
        },
        
        getSize: async () => {
          if (!this.currentPage) {
            throw new Error('No page available. Navigate to a URL first.');
          }
          return this.currentPage.viewportSize();
        },
        
        setPosition: async (x: number, y: number) => {
          // Not directly supported in Playwright
          console.warn('Window position setting not supported in browser context');
        },
        
        maximize: async () => {
          // Set to common maximized size
          if (!this.currentPage) {
            throw new Error('No page available. Navigate to a URL first.');
          }
          await this.currentPage.setViewportSize({ width: 1920, height: 1080 });
        }
      }),
      
      timeouts: () => ({
        implicitlyWait: async (ms: number) => {
          // Set default timeout
          if (!this.currentPage) {
            throw new Error('No page available. Navigate to a URL first.');
          }
          this.currentPage.setDefaultTimeout(ms);
        },
        
        pageLoadTimeout: async (ms: number) => {
          // Set navigation timeout
          if (!this.currentPage) {
            throw new Error('No page available. Navigate to a URL first.');
          }
          this.currentPage.setDefaultNavigationTimeout(ms);
        },
        
        setScriptTimeout: async (ms: number) => {
          // Set evaluate timeout
          if (!this.currentPage) {
            throw new Error('No page available. Navigate to a URL first.');
          }
          this.currentPage.setDefaultTimeout(ms);
        }
      })
    };
  }

  /**
   * Wait utilities
   */
  get wait() {
    return {
      until: {
        elementLocated: (by: By) => {
          return async () => {
            if (!this.currentPage) return false;
            const selector = by.toPlayCloneSelector();
            const element = await this.currentPage.$(selector);
            return element !== null;
          };
        },
        
        elementIsVisible: (element: WebElement) => {
          return async () => {
            return await element.isDisplayed();
          };
        },
        
        titleIs: (title: string) => {
          return async () => {
            if (!this.currentPage) return false;
            return await this.currentPage.title() === title;
          };
        },
        
        titleContains: (title: string) => {
          return async () => {
            if (!this.currentPage) return false;
            const pageTitle = await this.currentPage.title();
            return pageTitle.includes(title);
          };
        },
        
        urlContains: (url: string) => {
          return async () => {
            if (!this.currentPage) return false;
            return this.currentPage.url().includes(url);
          };
        }
      }
    };
  }

  /**
   * Actions builder for complex interactions
   */
  actions() {
    const actionQueue: Array<() => Promise<void>> = [];
    
    const builder = {
      moveToElement: (element: WebElement) => {
        actionQueue.push(async () => {
          await element['element'].hover();
        });
        return builder;
      },
      
      click: (element?: WebElement) => {
        actionQueue.push(async () => {
          if (element) {
            await element.click();
          } else if (this.currentPage) {
            await this.currentPage.mouse.click(0, 0);
          }
        });
        return builder;
      },
      
      doubleClick: (element?: WebElement) => {
        actionQueue.push(async () => {
          if (element) {
            await element['element'].dblclick();
          } else if (this.currentPage) {
            await this.currentPage.mouse.dblclick(0, 0);
          }
        });
        return builder;
      },
      
      contextClick: (element?: WebElement) => {
        actionQueue.push(async () => {
          if (element) {
            await element['element'].click({ button: 'right' });
          } else if (this.currentPage) {
            await this.currentPage.mouse.click(0, 0, { button: 'right' });
          }
        });
        return builder;
      },
      
      sendKeys: (...keys: string[]) => {
        actionQueue.push(async () => {
          if (this.currentPage) {
            await this.currentPage.keyboard.type(keys.join(''));
          }
        });
        return builder;
      },
      
      keyDown: (key: string) => {
        actionQueue.push(async () => {
          if (this.currentPage) {
            await this.currentPage.keyboard.down(key);
          }
        });
        return builder;
      },
      
      keyUp: (key: string) => {
        actionQueue.push(async () => {
          if (this.currentPage) {
            await this.currentPage.keyboard.up(key);
          }
        });
        return builder;
      },
      
      pause: (ms: number) => {
        actionQueue.push(async () => {
          await new Promise(resolve => setTimeout(resolve, ms));
        });
        return builder;
      },
      
      perform: async () => {
        for (const action of actionQueue) {
          await action();
        }
      }
    };
    
    return builder;
  }
}

/**
 * Keys constants for Selenium compatibility
 */
export const Keys = {
  NULL: '\uE000',
  CANCEL: '\uE001',
  HELP: '\uE002',
  BACKSPACE: 'Backspace',
  TAB: 'Tab',
  CLEAR: '\uE005',
  RETURN: 'Enter',
  ENTER: 'Enter',
  SHIFT: 'Shift',
  CONTROL: 'Control',
  ALT: 'Alt',
  PAUSE: 'Pause',
  ESCAPE: 'Escape',
  SPACE: 'Space',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
  END: 'End',
  HOME: 'Home',
  LEFT: 'ArrowLeft',
  UP: 'ArrowUp',
  RIGHT: 'ArrowRight',
  DOWN: 'ArrowDown',
  INSERT: 'Insert',
  DELETE: 'Delete',
  SEMICOLON: ';',
  EQUALS: '=',
  NUMPAD0: 'Numpad0',
  NUMPAD1: 'Numpad1',
  NUMPAD2: 'Numpad2',
  NUMPAD3: 'Numpad3',
  NUMPAD4: 'Numpad4',
  NUMPAD5: 'Numpad5',
  NUMPAD6: 'Numpad6',
  NUMPAD7: 'Numpad7',
  NUMPAD8: 'Numpad8',
  NUMPAD9: 'Numpad9',
  MULTIPLY: 'NumpadMultiply',
  ADD: 'NumpadAdd',
  SEPARATOR: 'NumpadDecimal',
  SUBTRACT: 'NumpadSubtract',
  DECIMAL: 'NumpadDecimal',
  DIVIDE: 'NumpadDivide',
  F1: 'F1',
  F2: 'F2',
  F3: 'F3',
  F4: 'F4',
  F5: 'F5',
  F6: 'F6',
  F7: 'F7',
  F8: 'F8',
  F9: 'F9',
  F10: 'F10',
  F11: 'F11',
  F12: 'F12',
  META: 'Meta',
  COMMAND: 'Meta'
};

/**
 * Expected conditions for wait operations
 */
export class ExpectedConditions {
  static presenceOfElementLocated(by: By) {
    return async (driver: SeleniumWebDriver) => {
      try {
        return await driver.findElement(by);
      } catch {
        return null;
      }
    };
  }

  static visibilityOfElementLocated(by: By) {
    return async (driver: SeleniumWebDriver) => {
      try {
        const element = await driver.findElement(by);
        const isVisible = await element.isDisplayed();
        return isVisible ? element : null;
      } catch {
        return null;
      }
    };
  }

  static elementToBeClickable(by: By) {
    return async (driver: SeleniumWebDriver) => {
      try {
        const element = await driver.findElement(by);
        const isEnabled = await element.isEnabled();
        const isDisplayed = await element.isDisplayed();
        return isEnabled && isDisplayed ? element : null;
      } catch {
        return null;
      }
    };
  }

  static titleIs(title: string) {
    return async (driver: SeleniumWebDriver) => {
      const currentTitle = await driver.getTitle();
      return currentTitle === title;
    };
  }

  static titleContains(title: string) {
    return async (driver: SeleniumWebDriver) => {
      const currentTitle = await driver.getTitle();
      return currentTitle.includes(title);
    };
  }

  static urlContains(url: string) {
    return async (driver: SeleniumWebDriver) => {
      const currentUrl = await driver.getCurrentUrl();
      return currentUrl.includes(url);
    };
  }

  static alertIsPresent() {
    return async (driver: SeleniumWebDriver) => {
      try {
        // Check for alert using Playwright API
        const page = driver['currentPage'];
        if (!page) return false;
        
        return new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(false), 100);
          page.once('dialog', () => {
            clearTimeout(timeout);
            resolve(true);
          });
        });
      } catch {
        return false;
      }
    };
  }
}

/**
 * WebDriverWait for explicit waits
 */
export class WebDriverWait {
  constructor(
    private driver: SeleniumWebDriver,
    private timeout: number = 10000
  ) {}

  async until(condition: (driver: SeleniumWebDriver) => Promise<any>, message?: string): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.timeout) {
      try {
        const result = await condition(this.driver);
        if (result) {
          return result;
        }
      } catch (error) {
        // Continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(message || `Wait timed out after ${this.timeout}ms`);
  }
}

/**
 * Create a new WebDriver instance
 */
export function createWebDriver(options?: any): SeleniumWebDriver {
  return new SeleniumWebDriver(options);
}

// Default export for compatibility
export default SeleniumWebDriver;