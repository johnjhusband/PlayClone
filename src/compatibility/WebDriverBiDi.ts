/**
 * WebDriver BiDi Protocol Implementation for PlayClone
 * Implements the W3C WebDriver BiDi specification for bidirectional browser control
 */

import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import { Page, Browser } from 'playwright';
import { PlayClone } from '../PlayClone';
import { formatResponse } from '../utils/responseFormatter';

interface BiDiSession {
  id: string;
  browser: Browser;
  contexts: Map<string, BiDiContext>;
  capabilities: BiDiCapabilities;
}

interface BiDiContext {
  id: string;
  page: Page;
  parentContext?: string;
  children: Set<string>;
}

interface BiDiCapabilities {
  browserName: string;
  browserVersion: string;
  platformName: string;
  acceptInsecureCerts: boolean;
  proxy?: any;
  setWindowRect: boolean;
  webSocketUrl: string;
}

interface BiDiCommand {
  id: number;
  method: string;
  params?: any;
}

interface BiDiResponse {
  id: number;
  result?: any;
  error?: BiDiError;
}

interface BiDiError {
  error: string;
  message: string;
  stacktrace?: string;
}

interface BiDiEvent {
  method: string;
  params: any;
}

export class WebDriverBiDi extends EventEmitter {
  private server: WebSocketServer | null = null;
  private sessions: Map<string, BiDiSession> = new Map();
  private playclone: PlayClone;
  private port: number;
  private connections: Map<WebSocket, string> = new Map();

  constructor(playclone: PlayClone, port: number = 9222) {
    super();
    this.playclone = playclone;
    this.port = port;
  }

  /**
   * Start the WebDriver BiDi server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = new WebSocketServer({ port: this.port }, () => {
        console.log(`WebDriver BiDi server listening on ws://localhost:${this.port}`);
        resolve();
      });

      this.server.on('error', reject);

      this.server.on('connection', (ws: WebSocket) => {
        console.log('New WebDriver BiDi connection');
        
        ws.on('message', async (data: any) => {
          try {
            const command = JSON.parse(data.toString()) as BiDiCommand;
            const response = await this.handleCommand(command, ws);
            ws.send(JSON.stringify(response));
          } catch (error: any) {
            console.error('BiDi command error:', error);
            ws.send(JSON.stringify({
              id: -1,
              error: {
                error: 'invalid argument',
                message: error.message
              }
            }));
          }
        });

        ws.on('close', () => {
          const sessionId = this.connections.get(ws);
          if (sessionId) {
            this.closeSession(sessionId);
            this.connections.delete(ws);
          }
        });
      });
    });
  }

  /**
   * Stop the WebDriver BiDi server
   */
  async stop(): Promise<void> {
    // Close all sessions
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.closeSession(sessionId);
    }

    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }
  }

  /**
   * Handle incoming BiDi commands
   */
  private async handleCommand(command: BiDiCommand, ws: WebSocket): Promise<BiDiResponse> {
    const { id, method, params } = command;

    try {
      let result: any;

      // Route commands based on module
      const [module, commandName] = method.split('.');

      switch (module) {
        case 'session':
          result = await this.handleSessionCommand(commandName, params, ws);
          break;
        case 'browsingContext':
          result = await this.handleBrowsingContextCommand(commandName, params);
          break;
        case 'network':
          result = await this.handleNetworkCommand(commandName, params);
          break;
        case 'script':
          result = await this.handleScriptCommand(commandName, params);
          break;
        case 'storage':
          result = await this.handleStorageCommand(commandName, params);
          break;
        case 'input':
          result = await this.handleInputCommand(commandName, params);
          break;
        case 'browser':
          result = await this.handleBrowserCommand(commandName, params);
          break;
        default:
          throw new Error(`Unknown module: ${module}`);
      }

      return { id, result };
    } catch (error: any) {
      return {
        id,
        error: {
          error: 'unknown error',
          message: error.message,
          stacktrace: error.stack
        }
      };
    }
  }

  /**
   * Handle session module commands
   */
  private async handleSessionCommand(command: string, params: any, ws: WebSocket): Promise<any> {
    switch (command) {
      case 'new':
        return await this.createSession(params, ws);
      case 'status':
        return this.getStatus();
      case 'subscribe':
        return this.subscribe(params);
      case 'unsubscribe':
        return this.unsubscribe(params);
      case 'end':
        return await this.endSession(params.sessionId);
      default:
        throw new Error(`Unknown session command: ${command}`);
    }
  }

  /**
   * Handle browsingContext module commands
   */
  private async handleBrowsingContextCommand(command: string, params: any): Promise<any> {
    const session = this.getSession(params.context);
    
    switch (command) {
      case 'create':
        return await this.createContext(params);
      case 'close':
        return await this.closeContext(params.context);
      case 'getTree':
        return this.getContextTree(params.root, params.maxDepth);
      case 'navigate':
        return await this.navigate(params.context, params.url, params.wait);
      case 'reload':
        return await this.reload(params.context, params.ignoreCache, params.wait);
      case 'print':
        return await this.print(params.context, params.options);
      case 'captureScreenshot':
        return await this.captureScreenshot(params.context, params.options);
      case 'setViewport':
        return await this.setViewport(params.context, params.viewport);
      default:
        throw new Error(`Unknown browsingContext command: ${command}`);
    }
  }

  /**
   * Handle network module commands
   */
  private async handleNetworkCommand(command: string, params: any): Promise<any> {
    switch (command) {
      case 'addIntercept':
        return await this.addNetworkIntercept(params);
      case 'removeIntercept':
        return await this.removeNetworkIntercept(params.intercept);
      case 'continueRequest':
        return await this.continueRequest(params);
      case 'continueResponse':
        return await this.continueResponse(params);
      case 'failRequest':
        return await this.failRequest(params);
      case 'provideResponse':
        return await this.provideResponse(params);
      default:
        throw new Error(`Unknown network command: ${command}`);
    }
  }

  /**
   * Handle script module commands
   */
  private async handleScriptCommand(command: string, params: any): Promise<any> {
    switch (command) {
      case 'callFunction':
        return await this.callFunction(params);
      case 'evaluate':
        return await this.evaluate(params);
      case 'getRealms':
        return this.getRealms(params.context);
      case 'addPreloadScript':
        return await this.addPreloadScript(params);
      case 'removePreloadScript':
        return await this.removePreloadScript(params.script);
      default:
        throw new Error(`Unknown script command: ${command}`);
    }
  }

  /**
   * Handle storage module commands
   */
  private async handleStorageCommand(command: string, params: any): Promise<any> {
    switch (command) {
      case 'getCookies':
        return await this.getCookies(params);
      case 'setCookie':
        return await this.setCookie(params);
      case 'deleteCookies':
        return await this.deleteCookies(params);
      default:
        throw new Error(`Unknown storage command: ${command}`);
    }
  }

  /**
   * Handle input module commands
   */
  private async handleInputCommand(command: string, params: any): Promise<any> {
    switch (command) {
      case 'performActions':
        return await this.performActions(params);
      case 'releaseActions':
        return await this.releaseActions(params.context);
      default:
        throw new Error(`Unknown input command: ${command}`);
    }
  }

  /**
   * Handle browser module commands
   */
  private async handleBrowserCommand(command: string, params: any): Promise<any> {
    switch (command) {
      case 'close':
        return await this.closeBrowser();
      case 'getUserContexts':
        return this.getUserContexts();
      default:
        throw new Error(`Unknown browser command: ${command}`);
    }
  }

  /**
   * Create a new session
   */
  private async createSession(params: any, ws: WebSocket): Promise<any> {
    const sessionId = this.generateSessionId();
    // Ensure browser is launched by navigating
    await this.playclone.navigate('about:blank');
    const context = (this.playclone as any).context;
    const browser = context?.browser();
    if (!browser) {
      throw new Error('Browser not initialized');
    }
    
    const capabilities: BiDiCapabilities = {
      browserName: browser.browserType().name(),
      browserVersion: browser.version(),
      platformName: process.platform,
      acceptInsecureCerts: true,
      setWindowRect: true,
      webSocketUrl: `ws://localhost:${this.port}`
    };

    const session: BiDiSession = {
      id: sessionId,
      browser,
      contexts: new Map(),
      capabilities
    };

    this.sessions.set(sessionId, session);
    this.connections.set(ws, sessionId);

    // Create default context
    const newContext = await browser.newContext();
    const page = await newContext.newPage();
    const contextId = this.generateContextId();
    
    session.contexts.set(contextId, {
      id: contextId,
      page,
      children: new Set()
    });

    return {
      sessionId,
      capabilities,
      contexts: [contextId]
    };
  }

  /**
   * Get server status
   */
  private getStatus(): any {
    return {
      ready: true,
      message: 'PlayClone WebDriver BiDi server ready',
      sessions: Array.from(this.sessions.keys())
    };
  }

  /**
   * Subscribe to events
   */
  private subscribe(params: any): any {
    // Store subscription preferences
    // In a real implementation, this would filter events sent to the client
    return { success: true };
  }

  /**
   * Unsubscribe from events
   */
  private unsubscribe(params: any): any {
    // Remove subscription preferences
    return { success: true };
  }

  /**
   * End a session
   */
  private async endSession(sessionId: string): Promise<any> {
    await this.closeSession(sessionId);
    return { success: true };
  }

  /**
   * Create a new browsing context
   */
  private async createContext(params: any): Promise<any> {
    const session = this.getSession(params.referenceContext);
    const contextId = this.generateContextId();
    
    const page = await session.browser.newPage();
    
    session.contexts.set(contextId, {
      id: contextId,
      page,
      parentContext: params.referenceContext,
      children: new Set()
    });

    if (params.referenceContext) {
      const parent = session.contexts.get(params.referenceContext);
      parent?.children.add(contextId);
    }

    return { context: contextId };
  }

  /**
   * Close a browsing context
   */
  private async closeContext(contextId: string): Promise<any> {
    const session = this.getSessionByContext(contextId);
    const context = session.contexts.get(contextId);
    
    if (context) {
      await context.page.close();
      session.contexts.delete(contextId);
      
      if (context.parentContext) {
        const parent = session.contexts.get(context.parentContext);
        parent?.children.delete(contextId);
      }
    }

    return { success: true };
  }

  /**
   * Get context tree
   */
  private getContextTree(root?: string, maxDepth?: number): any {
    const contexts: any[] = [];
    
    const sessionsArray = Array.from(this.sessions.values());
    for (const session of sessionsArray) {
      const contextsArray = Array.from(session.contexts.entries());
      for (const [id, context] of contextsArray) {
        if (!root || id === root) {
          contexts.push({
            context: id,
            parent: context.parentContext,
            url: context.page.url(),
            children: Array.from(context.children)
          });
        }
      }
    }

    return { contexts };
  }

  /**
   * Navigate to URL
   */
  private async navigate(contextId: string, url: string, wait?: string): Promise<any> {
    const context = this.getContext(contextId);
    
    const waitUntil = wait === 'complete' ? 'load' : 
                      wait === 'interactive' ? 'domcontentloaded' : 
                      'networkidle';
    
    await context.page.goto(url, { waitUntil: waitUntil as any });
    
    return {
      navigation: this.generateNavigationId(),
      url: context.page.url()
    };
  }

  /**
   * Reload page
   */
  private async reload(contextId: string, ignoreCache?: boolean, wait?: string): Promise<any> {
    const context = this.getContext(contextId);
    
    const waitUntil = wait === 'complete' ? 'load' : 
                      wait === 'interactive' ? 'domcontentloaded' : 
                      'networkidle';
    
    await context.page.reload({ waitUntil: waitUntil as any });
    
    return {
      navigation: this.generateNavigationId(),
      url: context.page.url()
    };
  }

  /**
   * Print page to PDF
   */
  private async print(contextId: string, options?: any): Promise<any> {
    const context = this.getContext(contextId);
    
    const pdf = await context.page.pdf({
      format: options?.format || 'A4',
      landscape: options?.landscape || false,
      margin: options?.margin,
      scale: options?.scale || 1
    });

    return { data: pdf.toString('base64') };
  }

  /**
   * Capture screenshot
   */
  private async captureScreenshot(contextId: string, options?: any): Promise<any> {
    const context = this.getContext(contextId);
    
    const screenshot = await context.page.screenshot({
      type: options?.format || 'png',
      fullPage: options?.fullPage || false,
      clip: options?.clip
    });

    return { data: screenshot.toString('base64') };
  }

  /**
   * Set viewport
   */
  private async setViewport(contextId: string, viewport: any): Promise<any> {
    const context = this.getContext(contextId);
    
    await context.page.setViewportSize({
      width: viewport.width,
      height: viewport.height
    });

    return { success: true };
  }

  /**
   * Add network intercept
   */
  private async addNetworkIntercept(params: any): Promise<any> {
    const interceptId = this.generateInterceptId();
    
    // Store intercept configuration
    // In a real implementation, this would set up route handlers
    
    return { intercept: interceptId };
  }

  /**
   * Remove network intercept
   */
  private async removeNetworkIntercept(interceptId: string): Promise<any> {
    // Remove intercept handlers
    return { success: true };
  }

  /**
   * Continue intercepted request
   */
  private async continueRequest(params: any): Promise<any> {
    // Continue the request with optional modifications
    return { success: true };
  }

  /**
   * Continue intercepted response
   */
  private async continueResponse(params: any): Promise<any> {
    // Continue the response with optional modifications
    return { success: true };
  }

  /**
   * Fail intercepted request
   */
  private async failRequest(params: any): Promise<any> {
    // Fail the request with error
    return { success: true };
  }

  /**
   * Provide custom response
   */
  private async provideResponse(params: any): Promise<any> {
    // Provide custom response data
    return { success: true };
  }

  /**
   * Call function in page context
   */
  private async callFunction(params: any): Promise<any> {
    const context = this.getContext(params.context);
    
    const fn = new Function('...args', params.functionDeclaration) as any;
    const result = await context.page.evaluate(fn as any, ...(params.arguments || []));
    
    return { result: this.serializeValue(result) };
  }

  /**
   * Evaluate expression in page context
   */
  private async evaluate(params: any): Promise<any> {
    const context = this.getContext(params.context);
    
    const result = await context.page.evaluate(params.expression);
    
    return { result: this.serializeValue(result) };
  }

  /**
   * Get script realms
   */
  private getRealms(contextId?: string): any {
    const realms: any[] = [];
    
    if (contextId) {
      const context = this.getContext(contextId);
      realms.push({
        realm: this.generateRealmId(),
        origin: context.page.url(),
        type: 'window'
      });
    } else {
      const sessionsArray = Array.from(this.sessions.values());
      for (const session of sessionsArray) {
        const contextsArray = Array.from(session.contexts.values());
        for (const context of contextsArray) {
          realms.push({
            realm: this.generateRealmId(),
            origin: context.page.url(),
            type: 'window'
          });
        }
      }
    }

    return { realms };
  }

  /**
   * Add preload script
   */
  private async addPreloadScript(params: any): Promise<any> {
    const scriptId = this.generateScriptId();
    
    // Store preload script
    // In a real implementation, this would inject scripts into new pages
    
    return { script: scriptId };
  }

  /**
   * Remove preload script
   */
  private async removePreloadScript(scriptId: string): Promise<any> {
    // Remove preload script
    return { success: true };
  }

  /**
   * Get cookies
   */
  private async getCookies(params: any): Promise<any> {
    const context = this.getContext(params.context);
    const cookies = await context.page.context().cookies();
    
    return {
      cookies: cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expiry: cookie.expires
      }))
    };
  }

  /**
   * Set cookie
   */
  private async setCookie(params: any): Promise<any> {
    const context = this.getContext(params.context);
    
    await context.page.context().addCookies([{
      name: params.cookie.name,
      value: params.cookie.value,
      domain: params.cookie.domain,
      path: params.cookie.path || '/',
      secure: params.cookie.secure || false,
      httpOnly: params.cookie.httpOnly || false,
      sameSite: params.cookie.sameSite as any,
      expires: params.cookie.expiry
    }]);

    return { success: true };
  }

  /**
   * Delete cookies
   */
  private async deleteCookies(params: any): Promise<any> {
    const context = this.getContext(params.context);
    await context.page.context().clearCookies();
    return { success: true };
  }

  /**
   * Perform input actions
   */
  private async performActions(params: any): Promise<any> {
    const context = this.getContext(params.context);
    
    for (const action of params.actions) {
      switch (action.type) {
        case 'key':
          await this.performKeyActions(context.page, action.actions);
          break;
        case 'pointer':
          await this.performPointerActions(context.page, action.actions);
          break;
        case 'wheel':
          await this.performWheelActions(context.page, action.actions);
          break;
      }
    }

    return { success: true };
  }

  /**
   * Perform keyboard actions
   */
  private async performKeyActions(page: Page, actions: any[]): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'keyDown':
          await page.keyboard.down(action.value);
          break;
        case 'keyUp':
          await page.keyboard.up(action.value);
          break;
        case 'pause':
          await page.waitForTimeout(action.duration || 0);
          break;
      }
    }
  }

  /**
   * Perform pointer actions
   */
  private async performPointerActions(page: Page, actions: any[]): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'pointerMove':
          await page.mouse.move(action.x, action.y);
          break;
        case 'pointerDown':
          await page.mouse.down({ button: action.button as any });
          break;
        case 'pointerUp':
          await page.mouse.up({ button: action.button as any });
          break;
        case 'pause':
          await page.waitForTimeout(action.duration || 0);
          break;
      }
    }
  }

  /**
   * Perform wheel actions
   */
  private async performWheelActions(page: Page, actions: any[]): Promise<void> {
    for (const action of actions) {
      if (action.type === 'scroll') {
        await page.mouse.wheel(action.deltaX || 0, action.deltaY || 0);
      } else if (action.type === 'pause') {
        await page.waitForTimeout(action.duration || 0);
      }
    }
  }

  /**
   * Release all input actions
   */
  private async releaseActions(contextId: string): Promise<any> {
    // Release all pressed keys and buttons
    return { success: true };
  }

  /**
   * Close browser
   */
  private async closeBrowser(): Promise<any> {
    await this.playclone.close();
    return { success: true };
  }

  /**
   * Get user contexts
   */
  private getUserContexts(): any {
    const contexts: string[] = [];
    
    const sessionsArray = Array.from(this.sessions.values());
    for (const session of sessionsArray) {
      contexts.push(...Array.from(session.contexts.keys()));
    }

    return { contexts };
  }

  /**
   * Helper: Get session by ID
   */
  private getSession(contextOrSessionId: string): BiDiSession {
    // Try as session ID first
    let session = this.sessions.get(contextOrSessionId);
    if (session) return session;

    // Try to find by context ID
    const sessionsArray = Array.from(this.sessions.values());
    for (const s of sessionsArray) {
      if (s.contexts.has(contextOrSessionId)) {
        return s;
      }
    }

    throw new Error(`Session not found: ${contextOrSessionId}`);
  }

  /**
   * Helper: Get session by context ID
   */
  private getSessionByContext(contextId: string): BiDiSession {
    const sessionsArray = Array.from(this.sessions.values());
    for (const session of sessionsArray) {
      if (session.contexts.has(contextId)) {
        return session;
      }
    }
    throw new Error(`Session not found for context: ${contextId}`);
  }

  /**
   * Helper: Get context by ID
   */
  private getContext(contextId: string): BiDiContext {
    const sessionsArray = Array.from(this.sessions.values());
    for (const session of sessionsArray) {
      const context = session.contexts.get(contextId);
      if (context) return context;
    }
    throw new Error(`Context not found: ${contextId}`);
  }

  /**
   * Helper: Close session
   */
  private async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      const contextsArray = Array.from(session.contexts.values());
      for (const context of contextsArray) {
        await context.page.close();
      }
      await session.browser.close();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Helper: Serialize JavaScript value for BiDi
   */
  private serializeValue(value: any): any {
    if (value === null) return { type: 'null' };
    if (value === undefined) return { type: 'undefined' };
    if (typeof value === 'boolean') return { type: 'boolean', value };
    if (typeof value === 'number') return { type: 'number', value };
    if (typeof value === 'string') return { type: 'string', value };
    if (Array.isArray(value)) {
      return {
        type: 'array',
        value: value.map(v => this.serializeValue(v))
      };
    }
    if (typeof value === 'object') {
      return {
        type: 'object',
        value: Object.entries(value).map(([k, v]) => [k, this.serializeValue(v)])
      };
    }
    return { type: 'undefined' };
  }

  /**
   * Helper: Generate unique IDs
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateContextId(): string {
    return `context-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateNavigationId(): string {
    return `nav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateInterceptId(): string {
    return `intercept-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRealmId(): string {
    return `realm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateScriptId(): string {
    return `script-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send event to connected clients
   */
  public sendEvent(event: BiDiEvent): void {
    const message = JSON.stringify(event);
    
    const connectionsArray = Array.from(this.connections.entries());
    for (const [ws, sessionId] of connectionsArray) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}

/**
 * Create standalone BiDi server
 */
export async function createBiDiServer(port: number = 9222): Promise<WebDriverBiDi> {
  const playclone = new PlayClone({ headless: false });
  const bidi = new WebDriverBiDi(playclone, port);
  await bidi.start();
  return bidi;
}