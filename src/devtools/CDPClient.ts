/**
 * Chrome DevTools Protocol Client
 * Provides direct access to CDP for advanced browser control and debugging
 */

import { Browser, Page, BrowserContext } from 'playwright-core';
import { EventEmitter } from 'events';

export interface CDPSession {
  send(method: string, params?: any): Promise<any>;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  detach(): Promise<void>;
}

export interface CDPDomain {
  enable(): Promise<void>;
  disable(): Promise<void>;
}

export interface CDPNetwork extends CDPDomain {
  setUserAgent(params: { userAgent: string }): Promise<void>;
  setCacheDisabled(params: { cacheDisabled: boolean }): Promise<void>;
  setBypassServiceWorker(params: { bypass: boolean }): Promise<void>;
  emulateNetworkConditions(params: NetworkConditions): Promise<void>;
  setRequestInterception(params: { patterns: RequestPattern[] }): Promise<void>;
  getResponseBody(params: { requestId: string }): Promise<{ body: string; base64Encoded: boolean }>;
}

export interface CDPRuntime extends CDPDomain {
  evaluate(params: { expression: string; returnByValue?: boolean }): Promise<any>;
  callFunctionOn(params: { functionDeclaration: string; objectId?: string; arguments?: any[] }): Promise<any>;
  getProperties(params: { objectId: string }): Promise<any>;
  releaseObject(params: { objectId: string }): Promise<void>;
}

export interface CDPDebugger extends CDPDomain {
  pause(): Promise<void>;
  resume(): Promise<void>;
  stepOver(): Promise<void>;
  stepInto(): Promise<void>;
  stepOut(): Promise<void>;
  setBreakpoint(params: { lineNumber: number; url?: string }): Promise<{ breakpointId: string }>;
  removeBreakpoint(params: { breakpointId: string }): Promise<void>;
  setBreakpointsActive(params: { active: boolean }): Promise<void>;
  getPossibleBreakpoints(params: { start: Location; end?: Location }): Promise<any>;
}

export interface CDPProfiler extends CDPDomain {
  start(): Promise<void>;
  stop(): Promise<{ profile: any }>;
  startPreciseCoverage(params?: { callCount?: boolean; detailed?: boolean }): Promise<void>;
  stopPreciseCoverage(): Promise<void>;
  takePreciseCoverage(): Promise<{ result: any[] }>;
}

export interface CDPDOM extends CDPDomain {
  getDocument(): Promise<{ root: any }>;
  querySelector(params: { nodeId: number; selector: string }): Promise<{ nodeId: number }>;
  querySelectorAll(params: { nodeId: number; selector: string }): Promise<{ nodeIds: number[] }>;
  setAttributeValue(params: { nodeId: number; name: string; value: string }): Promise<void>;
  removeAttribute(params: { nodeId: number; name: string }): Promise<void>;
  getOuterHTML(params: { nodeId: number }): Promise<{ outerHTML: string }>;
  setOuterHTML(params: { nodeId: number; outerHTML: string }): Promise<void>;
  focus(params: { nodeId: number }): Promise<void>;
  highlightNode(params: HighlightConfig): Promise<void>;
  hideHighlight(): Promise<void>;
  requestNode(params: { objectId: string }): Promise<{ nodeId: number }>;
}

export interface CDPPage extends CDPDomain {
  reload(params?: { ignoreCache?: boolean }): Promise<void>;
  navigate(params: { url: string }): Promise<{ frameId: string }>;
  stopLoading(): Promise<void>;
  captureScreenshot(params?: ScreenshotParams): Promise<{ data: string }>;
  printToPDF(params?: PDFParams): Promise<{ data: string }>;
  setDownloadBehavior(params: { behavior: 'allow' | 'deny'; downloadPath?: string }): Promise<void>;
  handleJavaScriptDialog(params: { accept: boolean; promptText?: string }): Promise<void>;
}

export interface CDPPerformance extends CDPDomain {
  getMetrics(): Promise<{ metrics: Metric[] }>;
  setTimeDomain(params: { timeDomain: 'timeTicks' | 'threadTicks' }): Promise<void>;
}

export interface CDPSecurity extends CDPDomain {
  setIgnoreCertificateErrors(params: { ignore: boolean }): Promise<void>;
  handleCertificateError(params: { eventId: number; action: 'continue' | 'cancel' }): Promise<void>;
  setOverrideCertificateErrors(params: { override: boolean }): Promise<void>;
}

interface NetworkConditions {
  offline: boolean;
  downloadThroughput: number;
  uploadThroughput: number;
  latency: number;
}

interface RequestPattern {
  urlPattern?: string;
  resourceType?: string;
  interceptionStage?: 'Request' | 'HeadersReceived';
}

interface Location {
  scriptId: string;
  lineNumber: number;
  columnNumber?: number;
}

interface HighlightConfig {
  nodeId?: number;
  contentColor?: { r: number; g: number; b: number; a?: number };
  paddingColor?: { r: number; g: number; b: number; a?: number };
  borderColor?: { r: number; g: number; b: number; a?: number };
  marginColor?: { r: number; g: number; b: number; a?: number };
  showInfo?: boolean;
}

interface ScreenshotParams {
  format?: 'jpeg' | 'png';
  quality?: number;
  clip?: { x: number; y: number; width: number; height: number; scale?: number };
  fromSurface?: boolean;
}

interface PDFParams {
  landscape?: boolean;
  displayHeaderFooter?: boolean;
  printBackground?: boolean;
  scale?: number;
  paperWidth?: number;
  paperHeight?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  pageRanges?: string;
  format?: string;
  headerTemplate?: string;
  footerTemplate?: string;
  preferCSSPageSize?: boolean;
}

interface Metric {
  name: string;
  value: number;
}

export class CDPClient extends EventEmitter {
  private session: CDPSession | null = null;
  private page: Page | null = null;
  private browser: Browser | null = null;
  private domains: Map<string, CDPDomain> = new Map();

  constructor() {
    super();
  }

  /**
   * Connect to a browser instance
   */
  async connectToBrowser(browser: Browser): Promise<void> {
    if (!browser) {
      throw new Error('Browser instance is required');
    }
    
    this.browser = browser;
    
    // Get default context
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      throw new Error('No browser contexts available');
    }
    
    // Get first page or create one
    const pages = contexts[0].pages();
    this.page = pages.length > 0 ? pages[0] : await contexts[0].newPage();
    
    await this.connectToPage(this.page);
  }

  /**
   * Connect to a specific page
   */
  async connectToPage(page: Page): Promise<void> {
    if (!page) {
      throw new Error('Page instance is required');
    }
    
    this.page = page;
    
    // Create CDP session for the page
    const client = await (page.context() as any).newCDPSession(page);
    this.session = client;
    
    // Set up event forwarding
    this.setupEventForwarding();
    
    // Initialize domains
    this.initializeDomains();
  }

  /**
   * Connect to a browser context
   */
  async connectToContext(context: BrowserContext): Promise<void> {
    const pages = context.pages();
    if (pages.length === 0) {
      throw new Error('No pages in context');
    }
    
    await this.connectToPage(pages[0]);
  }

  /**
   * Get direct access to CDP session
   */
  getSession(): CDPSession | null {
    return this.session;
  }

  /**
   * Send raw CDP command
   */
  async send(method: string, params?: any): Promise<any> {
    if (!this.session) {
      throw new Error('CDP session not initialized');
    }
    
    return await this.session.send(method, params);
  }

  /**
   * Set up event forwarding from CDP to EventEmitter
   */
  private setupEventForwarding(): void {
    if (!this.session) return;
    
    // Common CDP events to forward
    const events = [
      'Network.requestWillBeSent',
      'Network.responseReceived',
      'Network.loadingFinished',
      'Network.loadingFailed',
      'Page.frameNavigated',
      'Page.loadEventFired',
      'Page.domContentEventFired',
      'Runtime.consoleAPICalled',
      'Runtime.exceptionThrown',
      'Debugger.paused',
      'Debugger.resumed',
      'Performance.metrics',
      'Security.certificateError',
      'DOM.documentUpdated',
    ];
    
    events.forEach(event => {
      this.session!.on(event, (params: any) => {
        this.emit(event, params);
      });
    });
  }

  /**
   * Initialize CDP domains
   */
  private initializeDomains(): void {
    // Network domain
    this.domains.set('Network', this.createNetworkDomain());
    
    // Runtime domain
    this.domains.set('Runtime', this.createRuntimeDomain());
    
    // Debugger domain
    this.domains.set('Debugger', this.createDebuggerDomain());
    
    // Profiler domain
    this.domains.set('Profiler', this.createProfilerDomain());
    
    // DOM domain
    this.domains.set('DOM', this.createDOMDomain());
    
    // Page domain
    this.domains.set('Page', this.createPageDomain());
    
    // Performance domain
    this.domains.set('Performance', this.createPerformanceDomain());
    
    // Security domain
    this.domains.set('Security', this.createSecurityDomain());
  }

  /**
   * Get Network domain
   */
  get Network(): CDPNetwork {
    return this.domains.get('Network') as CDPNetwork;
  }

  /**
   * Get Runtime domain
   */
  get Runtime(): CDPRuntime {
    return this.domains.get('Runtime') as CDPRuntime;
  }

  /**
   * Get Debugger domain
   */
  get Debugger(): CDPDebugger {
    return this.domains.get('Debugger') as CDPDebugger;
  }

  /**
   * Get Profiler domain
   */
  get Profiler(): CDPProfiler {
    return this.domains.get('Profiler') as CDPProfiler;
  }

  /**
   * Get DOM domain
   */
  get DOM(): CDPDOM {
    return this.domains.get('DOM') as CDPDOM;
  }

  /**
   * Get Page domain
   */
  get Page(): CDPPage {
    return this.domains.get('Page') as CDPPage;
  }

  /**
   * Get Performance domain
   */
  get Performance(): CDPPerformance {
    return this.domains.get('Performance') as CDPPerformance;
  }

  /**
   * Get Security domain
   */
  get Security(): CDPSecurity {
    return this.domains.get('Security') as CDPSecurity;
  }

  /**
   * Create Network domain implementation
   */
  private createNetworkDomain(): CDPNetwork {
    return {
      enable: () => this.send('Network.enable'),
      disable: () => this.send('Network.disable'),
      setUserAgent: (params) => this.send('Network.setUserAgent', params),
      setCacheDisabled: (params) => this.send('Network.setCacheDisabled', params),
      setBypassServiceWorker: (params) => this.send('Network.setBypassServiceWorker', params),
      emulateNetworkConditions: (params) => this.send('Network.emulateNetworkConditions', params),
      setRequestInterception: (params) => this.send('Network.setRequestInterception', params),
      getResponseBody: (params) => this.send('Network.getResponseBody', params),
    };
  }

  /**
   * Create Runtime domain implementation
   */
  private createRuntimeDomain(): CDPRuntime {
    return {
      enable: () => this.send('Runtime.enable'),
      disable: () => this.send('Runtime.disable'),
      evaluate: (params) => this.send('Runtime.evaluate', params),
      callFunctionOn: (params) => this.send('Runtime.callFunctionOn', params),
      getProperties: (params) => this.send('Runtime.getProperties', params),
      releaseObject: (params) => this.send('Runtime.releaseObject', params),
    };
  }

  /**
   * Create Debugger domain implementation
   */
  private createDebuggerDomain(): CDPDebugger {
    return {
      enable: () => this.send('Debugger.enable'),
      disable: () => this.send('Debugger.disable'),
      pause: () => this.send('Debugger.pause'),
      resume: () => this.send('Debugger.resume'),
      stepOver: () => this.send('Debugger.stepOver'),
      stepInto: () => this.send('Debugger.stepInto'),
      stepOut: () => this.send('Debugger.stepOut'),
      setBreakpoint: (params) => this.send('Debugger.setBreakpoint', params),
      removeBreakpoint: (params) => this.send('Debugger.removeBreakpoint', params),
      setBreakpointsActive: (params) => this.send('Debugger.setBreakpointsActive', params),
      getPossibleBreakpoints: (params) => this.send('Debugger.getPossibleBreakpoints', params),
    };
  }

  /**
   * Create Profiler domain implementation
   */
  private createProfilerDomain(): CDPProfiler {
    return {
      enable: () => this.send('Profiler.enable'),
      disable: () => this.send('Profiler.disable'),
      start: () => this.send('Profiler.start'),
      stop: () => this.send('Profiler.stop'),
      startPreciseCoverage: (params) => this.send('Profiler.startPreciseCoverage', params),
      stopPreciseCoverage: () => this.send('Profiler.stopPreciseCoverage'),
      takePreciseCoverage: () => this.send('Profiler.takePreciseCoverage'),
    };
  }

  /**
   * Create DOM domain implementation
   */
  private createDOMDomain(): CDPDOM {
    return {
      enable: () => this.send('DOM.enable'),
      disable: () => this.send('DOM.disable'),
      getDocument: () => this.send('DOM.getDocument'),
      querySelector: (params) => this.send('DOM.querySelector', params),
      querySelectorAll: (params) => this.send('DOM.querySelectorAll', params),
      setAttributeValue: (params) => this.send('DOM.setAttributeValue', params),
      removeAttribute: (params) => this.send('DOM.removeAttribute', params),
      getOuterHTML: (params) => this.send('DOM.getOuterHTML', params),
      setOuterHTML: (params) => this.send('DOM.setOuterHTML', params),
      focus: (params) => this.send('DOM.focus', params),
      highlightNode: (params) => this.send('DOM.highlightNode', params),
      hideHighlight: () => this.send('DOM.hideHighlight'),
      requestNode: (params) => this.send('DOM.requestNode', params),
    };
  }

  /**
   * Create Page domain implementation
   */
  private createPageDomain(): CDPPage {
    return {
      enable: () => this.send('Page.enable'),
      disable: () => this.send('Page.disable'),
      reload: (params) => this.send('Page.reload', params),
      navigate: (params) => this.send('Page.navigate', params),
      stopLoading: () => this.send('Page.stopLoading'),
      captureScreenshot: (params) => this.send('Page.captureScreenshot', params),
      printToPDF: (params) => this.send('Page.printToPDF', params),
      setDownloadBehavior: (params) => this.send('Page.setDownloadBehavior', params),
      handleJavaScriptDialog: (params) => this.send('Page.handleJavaScriptDialog', params),
    };
  }

  /**
   * Create Performance domain implementation
   */
  private createPerformanceDomain(): CDPPerformance {
    return {
      enable: () => this.send('Performance.enable'),
      disable: () => this.send('Performance.disable'),
      getMetrics: () => this.send('Performance.getMetrics'),
      setTimeDomain: (params) => this.send('Performance.setTimeDomain', params),
    };
  }

  /**
   * Create Security domain implementation
   */
  private createSecurityDomain(): CDPSecurity {
    return {
      enable: () => this.send('Security.enable'),
      disable: () => this.send('Security.disable'),
      setIgnoreCertificateErrors: (params) => this.send('Security.setIgnoreCertificateErrors', params),
      handleCertificateError: (params) => this.send('Security.handleCertificateError', params),
      setOverrideCertificateErrors: (params) => this.send('Security.setOverrideCertificateErrors', params),
    };
  }

  /**
   * Disconnect from CDP
   */
  async disconnect(): Promise<void> {
    if (this.session) {
      await this.session.detach();
      this.session = null;
    }
    
    this.page = null;
    this.browser = null;
    this.domains.clear();
    this.removeAllListeners();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.session !== null;
  }
}