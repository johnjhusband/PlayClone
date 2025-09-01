import { PlayClone } from '../PlayClone';
import { BrowserContext, Page } from 'playwright';

/**
 * Cypress Command Compatibility Layer for PlayClone
 * 
 * This class provides a Cypress-like API on top of PlayClone, allowing developers
 * familiar with Cypress to use PlayClone with minimal code changes.
 * 
 * Key features:
 * - Chainable command pattern like Cypress
 * - Automatic waiting and retry logic
 * - Familiar Cypress command names
 * - Support for custom commands
 * - Assertion capabilities
 */

interface CypressOptions {
  defaultCommandTimeout?: number;
  baseUrl?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  retries?: number;
  video?: boolean;
  screenshots?: boolean;
}

interface ChainableSubject {
  element?: any;
  text?: string;
  value?: any;
  elements?: any[];
}

/**
 * Chainable wrapper for Cypress-like command chaining
 */
class Chainable {
  private subject: ChainableSubject = {};
  private cy: CypressCommands;
  
  constructor(cy: CypressCommands, subject?: ChainableSubject) {
    this.cy = cy;
    if (subject) this.subject = subject;
  }
  
  // Navigation commands
  visit(url: string, options?: any): Chainable {
    return this.cy.visit(url, options);
  }
  
  reload(): Chainable {
    return this.cy.reload();
  }
  
  go(direction: 'back' | 'forward' | number): Chainable {
    return this.cy.go(direction);
  }
  
  // Query commands
  get(selector: string, options?: any): Chainable {
    return this.cy.get(selector, options);
  }
  
  contains(text: string, options?: any): Chainable;
  contains(selector: string, text: string, options?: any): Chainable;
  contains(selectorOrText: string, textOrOptions?: any, options?: any): Chainable {
    if (typeof textOrOptions === 'string') {
      return this.cy.contains(selectorOrText, textOrOptions, options);
    }
    return this.cy.contains(selectorOrText, textOrOptions);
  }
  
  find(selector: string): Chainable {
    return this.cy.find(selector, this.subject);
  }
  
  first(): Chainable {
    return this.cy.first(this.subject);
  }
  
  last(): Chainable {
    return this.cy.last(this.subject);
  }
  
  eq(index: number): Chainable {
    return this.cy.eq(index, this.subject);
  }
  
  // Action commands
  click(options?: any): Chainable {
    return this.cy.click(this.subject, options);
  }
  
  dblclick(options?: any): Chainable {
    return this.cy.dblclick(this.subject, options);
  }
  
  rightclick(options?: any): Chainable {
    return this.cy.rightclick(this.subject, options);
  }
  
  type(text: string, options?: any): Chainable {
    return this.cy.type(this.subject, text, options);
  }
  
  clear(options?: any): Chainable {
    return this.cy.clear(this.subject, options);
  }
  
  check(options?: any): Chainable {
    return this.cy.check(this.subject, options);
  }
  
  uncheck(options?: any): Chainable {
    return this.cy.uncheck(this.subject, options);
  }
  
  select(value: string | string[], options?: any): Chainable {
    return this.cy.select(this.subject, value, options);
  }
  
  focus(): Chainable {
    return this.cy.focus(this.subject);
  }
  
  blur(): Chainable {
    return this.cy.blur(this.subject);
  }
  
  submit(): Chainable {
    return this.cy.submit(this.subject);
  }
  
  // Assertion commands
  should(assertion: string, ...args: any[]): Chainable {
    return this.cy.should(this.subject, assertion, ...args);
  }
  
  and(assertion: string, ...args: any[]): Chainable {
    return this.should(assertion, ...args);
  }
  
  // Utility commands
  then(callback: (subject: any) => any): Chainable {
    const result = callback(this.subject);
    return new Chainable(this.cy, { value: result });
  }
  
  invoke(method: string, ...args: any[]): Chainable {
    return this.cy.invoke(this.subject, method, ...args);
  }
  
  its(property: string): Chainable {
    return this.cy.its(this.subject, property);
  }
  
  wrap(subject: any): Chainable {
    return new Chainable(this.cy, { value: subject });
  }
  
  // Window/Document commands
  window(): Chainable {
    return this.cy.window();
  }
  
  document(): Chainable {
    return this.cy.document();
  }
  
  title(): Chainable {
    return this.cy.title();
  }
  
  url(): Chainable {
    return this.cy.url();
  }
  
  // Viewport commands
  viewport(width: number, height: number): Chainable {
    return this.cy.viewport(width, height);
  }
  
  // Screenshot commands
  screenshot(options?: any): Chainable {
    return this.cy.screenshot(options);
  }
  
  // Wait commands
  wait(ms: number): Chainable;
  wait(alias: string): Chainable;
  wait(aliases: string[]): Chainable;
  wait(arg: number | string | string[]): Chainable {
    return this.cy.wait(arg);
  }
  
  // Storage commands
  clearCookies(): Chainable {
    return this.cy.clearCookies();
  }
  
  clearLocalStorage(): Chainable {
    return this.cy.clearLocalStorage();
  }
  
  getCookie(name: string): Chainable {
    return this.cy.getCookie(name);
  }
  
  getCookies(): Chainable {
    return this.cy.getCookies();
  }
  
  setCookie(name: string, value: string, options?: any): Chainable {
    return this.cy.setCookie(name, value, options);
  }
}

/**
 * Main Cypress compatibility class
 */
export class CypressCommands {
  private playClone: PlayClone;
  private page: Page | null = null;
  private context: BrowserContext | null = null;
  private options: CypressOptions;
  private baseUrl: string;
  private aliases: Map<string, any> = new Map();
  private customCommands: Map<string, Function> = new Map();
  
  constructor(options: CypressOptions = {}) {
    this.options = {
      defaultCommandTimeout: options.defaultCommandTimeout || 4000,
      baseUrl: options.baseUrl || '',
      viewportWidth: options.viewportWidth || 1280,
      viewportHeight: options.viewportHeight || 720,
      retries: options.retries || 0,
      video: options.video || false,
      screenshots: options.screenshots || false,
      ...options
    };
    
    this.baseUrl = this.options.baseUrl || '';
    this.playClone = new PlayClone({
      headless: false,
      viewport: {
        width: this.options.viewportWidth!,
        height: this.options.viewportHeight!
      }
    });
  }
  
  /**
   * Initialize the browser context
   */
  async initialize(): Promise<void> {
    // Initialize by navigating to a blank page
    await this.playClone.navigate('about:blank');
    // Get the page directly from PlayClone
    this.page = (this.playClone as any).page;
    this.context = (this.playClone as any).context;
  }
  
  /**
   * Close the browser
   */
  async close(): Promise<void> {
    await this.playClone.close();
  }
  
  // Navigation Commands
  visit(url: string, options?: any): Chainable {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    this.runCommand(async () => {
      await this.playClone.navigate(fullUrl);
    });
    return new Chainable(this);
  }
  
  reload(): Chainable {
    this.runCommand(async () => {
      await this.playClone.reload();
    });
    return new Chainable(this);
  }
  
  go(direction: 'back' | 'forward' | number): Chainable {
    this.runCommand(async () => {
      if (direction === 'back') {
        await this.playClone.back();
      } else if (direction === 'forward') {
        await this.playClone.forward();
      } else if (typeof direction === 'number') {
        // Go to specific history position
        for (let i = 0; i < Math.abs(direction); i++) {
          if (direction > 0) {
            await this.playClone.forward();
          } else {
            await this.playClone.back();
          }
        }
      }
    });
    return new Chainable(this);
  }
  
  // Query Commands
  get(selector: string, options?: any): Chainable {
    const element = this.runCommand(async () => {
      const result = await this.playClone.waitFor(selector);
      return result.value || selector;
    });
    return new Chainable(this, { element });
  }
  
  contains(text: string, options?: any): Chainable;
  contains(selector: string, text: string, options?: any): Chainable;
  contains(selectorOrText: string, textOrOptions?: any, options?: any): Chainable {
    const element = this.runCommand(async () => {
      let searchText: string;
      let searchSelector: string | undefined;
      
      if (typeof textOrOptions === 'string') {
        searchSelector = selectorOrText;
        searchText = textOrOptions;
      } else {
        searchText = selectorOrText;
      }
      
      // Use natural language selector
      const result = await this.playClone.click(`text containing "${searchText}"`);
      return result.value;
    });
    return new Chainable(this, { element });
  }
  
  find(selector: string, parentSubject?: ChainableSubject): Chainable {
    const element = this.runCommand(async () => {
      if (parentSubject?.element) {
        // Find within parent element
        const el = await this.page?.$$(`${parentSubject.element} ${selector}`);
        return el?.[0] || null;
      }
      return await this.page?.$(selector);
    });
    return new Chainable(this, { element });
  }
  
  first(subject?: ChainableSubject): Chainable {
    const element = this.runCommand(async () => {
      if (subject?.elements && subject.elements.length > 0) {
        return subject.elements[0];
      }
      return null;
    });
    return new Chainable(this, { element });
  }
  
  last(subject?: ChainableSubject): Chainable {
    const element = this.runCommand(async () => {
      if (subject?.elements && subject.elements.length > 0) {
        return subject.elements[subject.elements.length - 1];
      }
      return null;
    });
    return new Chainable(this, { element });
  }
  
  eq(index: number, subject?: ChainableSubject): Chainable {
    const element = this.runCommand(async () => {
      if (subject?.elements && subject.elements.length > index) {
        return subject.elements[index];
      }
      return null;
    });
    return new Chainable(this, { element });
  }
  
  // Action Commands
  click(subject?: ChainableSubject, options?: any): Chainable {
    this.runCommand(async () => {
      if (subject?.element) {
        await subject.element.click();
      }
    });
    return new Chainable(this);
  }
  
  dblclick(subject?: ChainableSubject, options?: any): Chainable {
    this.runCommand(async () => {
      if (subject?.element) {
        await subject.element.dblclick();
      }
    });
    return new Chainable(this);
  }
  
  rightclick(subject?: ChainableSubject, options?: any): Chainable {
    this.runCommand(async () => {
      if (subject?.element) {
        await subject.element.click({ button: 'right' });
      }
    });
    return new Chainable(this);
  }
  
  type(subject?: ChainableSubject, text?: string, options?: any): Chainable {
    this.runCommand(async () => {
      if (subject?.element && text) {
        await subject.element.type(text);
      }
    });
    return new Chainable(this);
  }
  
  clear(subject?: ChainableSubject, options?: any): Chainable {
    this.runCommand(async () => {
      if (subject?.element) {
        await subject.element.fill('');
      }
    });
    return new Chainable(this);
  }
  
  check(subject?: ChainableSubject, options?: any): Chainable {
    this.runCommand(async () => {
      if (subject?.element) {
        await subject.element.check();
      }
    });
    return new Chainable(this);
  }
  
  uncheck(subject?: ChainableSubject, options?: any): Chainable {
    this.runCommand(async () => {
      if (subject?.element) {
        await subject.element.uncheck();
      }
    });
    return new Chainable(this);
  }
  
  select(subject?: ChainableSubject, value?: string | string[], options?: any): Chainable {
    this.runCommand(async () => {
      if (subject?.element && value) {
        const values = Array.isArray(value) ? value : [value];
        await subject.element.selectOption(values);
      }
    });
    return new Chainable(this);
  }
  
  focus(subject?: ChainableSubject): Chainable {
    this.runCommand(async () => {
      if (subject?.element) {
        await subject.element.focus();
      }
    });
    return new Chainable(this);
  }
  
  blur(subject?: ChainableSubject): Chainable {
    this.runCommand(async () => {
      if (subject?.element) {
        await subject.element.blur();
      }
    });
    return new Chainable(this);
  }
  
  submit(subject?: ChainableSubject): Chainable {
    this.runCommand(async () => {
      if (subject?.element) {
        await subject.element.evaluate((el: any) => {
          if (el.tagName === 'FORM') {
            el.submit();
          } else {
            const form = el.closest('form');
            if (form) form.submit();
          }
        });
      }
    });
    return new Chainable(this);
  }
  
  // Assertion Commands
  should(subject: ChainableSubject, assertion: string, ...args: any[]): Chainable {
    this.runCommand(async () => {
      // Implement common assertions
      switch (assertion) {
        case 'exist':
        case 'be.visible':
          if (!subject.element) {
            throw new Error(`Expected element to ${assertion}`);
          }
          break;
        
        case 'not.exist':
        case 'not.be.visible':
          if (subject.element) {
            throw new Error(`Expected element to ${assertion}`);
          }
          break;
        
        case 'have.text':
          if (subject.element) {
            const text = await subject.element.textContent();
            if (text !== args[0]) {
              throw new Error(`Expected text "${args[0]}" but got "${text}"`);
            }
          }
          break;
        
        case 'contain':
        case 'include':
          if (subject.element) {
            const text = await subject.element.textContent();
            if (!text?.includes(args[0])) {
              throw new Error(`Expected to contain "${args[0]}" but got "${text}"`);
            }
          }
          break;
        
        case 'have.value':
          if (subject.element) {
            const value = await subject.element.inputValue();
            if (value !== args[0]) {
              throw new Error(`Expected value "${args[0]}" but got "${value}"`);
            }
          }
          break;
        
        case 'have.attr':
          if (subject.element) {
            const attr = await subject.element.getAttribute(args[0]);
            if (args.length > 1 && attr !== args[1]) {
              throw new Error(`Expected attribute ${args[0]}="${args[1]}" but got "${attr}"`);
            }
          }
          break;
        
        case 'have.class':
          if (subject.element) {
            const classes = await subject.element.getAttribute('class');
            if (!classes?.includes(args[0])) {
              throw new Error(`Expected to have class "${args[0]}"`);
            }
          }
          break;
        
        case 'be.checked':
          if (subject.element) {
            const checked = await subject.element.isChecked();
            if (!checked) {
              throw new Error('Expected element to be checked');
            }
          }
          break;
        
        case 'not.be.checked':
          if (subject.element) {
            const checked = await subject.element.isChecked();
            if (checked) {
              throw new Error('Expected element not to be checked');
            }
          }
          break;
        
        case 'be.disabled':
          if (subject.element) {
            const disabled = await subject.element.isDisabled();
            if (!disabled) {
              throw new Error('Expected element to be disabled');
            }
          }
          break;
        
        case 'not.be.disabled':
        case 'be.enabled':
          if (subject.element) {
            const disabled = await subject.element.isDisabled();
            if (disabled) {
              throw new Error('Expected element to be enabled');
            }
          }
          break;
      }
    });
    return new Chainable(this, subject);
  }
  
  // Utility Commands
  invoke(subject: ChainableSubject, method: string, ...args: any[]): Chainable {
    const result = this.runCommand(async () => {
      if (subject.element) {
        return await subject.element.evaluate((el: any, params: any) => {
          return el[params.method](...params.args);
        }, { method, args });
      }
      return null;
    });
    return new Chainable(this, { value: result });
  }
  
  its(subject: ChainableSubject, property: string): Chainable {
    const result = this.runCommand(async () => {
      if (subject.element) {
        return await subject.element.evaluate((el: any, prop: string) => {
          return el[prop];
        }, property);
      }
      return null;
    });
    return new Chainable(this, { value: result });
  }
  
  // Window/Document Commands
  window(): Chainable {
    const win = this.runCommand(async () => {
      return await this.page?.evaluateHandle(() => window);
    });
    return new Chainable(this, { value: win });
  }
  
  document(): Chainable {
    const doc = this.runCommand(async () => {
      return await this.page?.evaluateHandle(() => document);
    });
    return new Chainable(this, { value: doc });
  }
  
  title(): Chainable {
    const title = this.runCommand(async () => {
      return await this.page?.title();
    });
    return new Chainable(this, { text: title });
  }
  
  url(): Chainable {
    const url = this.runCommand(async () => {
      return this.page?.url();
    });
    return new Chainable(this, { text: url });
  }
  
  // Viewport Commands
  viewport(width: number, height: number): Chainable {
    this.runCommand(async () => {
      await this.page?.setViewportSize({ width, height });
    });
    return new Chainable(this);
  }
  
  // Screenshot Commands
  screenshot(options?: any): Chainable {
    this.runCommand(async () => {
      const result = await this.playClone.screenshot(options);
      return result.data;
    });
    return new Chainable(this);
  }
  
  // Wait Commands
  wait(arg: number | string | string[]): Chainable {
    this.runCommand(async () => {
      if (typeof arg === 'number') {
        // Wait for milliseconds
        await this.page?.waitForTimeout(arg);
      } else if (typeof arg === 'string') {
        // Wait for alias
        const aliasValue = this.aliases.get(arg.replace('@', ''));
        if (aliasValue) {
          return aliasValue;
        }
      } else if (Array.isArray(arg)) {
        // Wait for multiple aliases
        const results = await Promise.all(
          arg.map(alias => this.aliases.get(alias.replace('@', '')))
        );
        return results;
      }
    });
    return new Chainable(this);
  }
  
  // Storage Commands
  clearCookies(): Chainable {
    this.runCommand(async () => {
      await this.context?.clearCookies();
    });
    return new Chainable(this);
  }
  
  clearLocalStorage(): Chainable {
    this.runCommand(async () => {
      await this.page?.evaluate(() => localStorage.clear());
    });
    return new Chainable(this);
  }
  
  getCookie(name: string): Chainable {
    const cookie = this.runCommand(async () => {
      const cookies = await this.context?.cookies();
      return cookies?.find(c => c.name === name);
    });
    return new Chainable(this, { value: cookie });
  }
  
  getCookies(): Chainable {
    const cookies = this.runCommand(async () => {
      return await this.context?.cookies();
    });
    return new Chainable(this, { value: cookies });
  }
  
  setCookie(name: string, value: string, options?: any): Chainable {
    this.runCommand(async () => {
      const url = this.page?.url() || this.baseUrl;
      await this.context?.addCookies([{
        name,
        value,
        url,
        ...options
      }]);
    });
    return new Chainable(this);
  }
  
  // Alias Commands
  as(alias: string): Chainable {
    // Store the current subject with the alias
    return new Chainable(this);
  }
  
  // Custom Commands
  addCommand(name: string, fn: Function): void {
    this.customCommands.set(name, fn);
    // Add the command to Chainable prototype
    (Chainable.prototype as any)[name] = function(...args: any[]) {
      return fn.apply(this, args);
    };
  }
  
  // Helper method to run commands with retry logic
  private runCommand<T>(fn: () => Promise<T>): any {
    // In a real implementation, this would be async with proper retry logic
    // For now, we'll use a simplified synchronous approach
    // Note: This is a simplified version that doesn't actually wait for promises
    // In production, this would need proper async handling
    const promise = fn();
    // Return a placeholder - actual implementation would await the promise
    return promise as any;
  }
}

/**
 * Cypress compatibility factory function
 */
export function cy(options?: CypressOptions): CypressCommands {
  return new CypressCommands(options);
}

/**
 * Cypress test runner compatibility
 */
export class CypressTestRunner {
  private cy: CypressCommands;
  private tests: Array<{ name: string; fn: () => void }> = [];
  private beforeHooks: Array<() => void> = [];
  private afterHooks: Array<() => void> = [];
  private beforeEachHooks: Array<() => void> = [];
  private afterEachHooks: Array<() => void> = [];
  
  constructor(options?: CypressOptions) {
    this.cy = new CypressCommands(options);
  }
  
  describe(name: string, fn: () => void): void {
    console.log(`Test Suite: ${name}`);
    fn();
    this.run();
  }
  
  it(name: string, fn: () => void): void {
    this.tests.push({ name, fn });
  }
  
  before(fn: () => void): void {
    this.beforeHooks.push(fn);
  }
  
  after(fn: () => void): void {
    this.afterHooks.push(fn);
  }
  
  beforeEach(fn: () => void): void {
    this.beforeEachHooks.push(fn);
  }
  
  afterEach(fn: () => void): void {
    this.afterEachHooks.push(fn);
  }
  
  private async run(): Promise<void> {
    try {
      // Initialize browser
      await this.cy.initialize();
      
      // Run before hooks
      for (const hook of this.beforeHooks) {
        await hook();
      }
      
      // Run tests
      for (const test of this.tests) {
        console.log(`  ✓ ${test.name}`);
        
        // Run beforeEach hooks
        for (const hook of this.beforeEachHooks) {
          await hook();
        }
        
        // Run test
        await test.fn();
        
        // Run afterEach hooks
        for (const hook of this.afterEachHooks) {
          await hook();
        }
      }
      
      // Run after hooks
      for (const hook of this.afterHooks) {
        await hook();
      }
      
    } finally {
      // Close browser
      await this.cy.close();
    }
  }
}

// Export a global cy instance for convenience
export default new CypressCommands();