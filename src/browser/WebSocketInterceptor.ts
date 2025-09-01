/**
 * WebSocketInterceptor - Handles WebSocket message inspection and modification
 */

import { Page, CDPSession } from 'playwright';

/**
 * WebSocket frame types
 */
export enum WebSocketFrameType {
  TEXT = 'text',
  BINARY = 'binary',
  CLOSE = 'close',
  PING = 'ping',
  PONG = 'pong'
}

/**
 * WebSocket message direction
 */
export enum WebSocketDirection {
  SENT = 'sent',
  RECEIVED = 'received'
}

/**
 * WebSocket connection state
 */
export enum WebSocketState {
  CONNECTING = 'connecting',
  OPEN = 'open',
  CLOSING = 'closing',
  CLOSED = 'closed'
}

/**
 * WebSocket frame data
 */
export interface WebSocketFrame {
  id: string;
  url: string;
  timestamp: number;
  direction: WebSocketDirection;
  type: WebSocketFrameType;
  data: string | Buffer;
  opcode: number;
  mask: boolean;
  payloadLength: number;
}

/**
 * WebSocket connection info
 */
export interface WebSocketConnection {
  id: string;
  url: string;
  state: WebSocketState;
  openedAt: number;
  closedAt?: number;
  frameCount: number;
  bytesSent: number;
  bytesReceived: number;
  lastActivity: number;
  subprotocol?: string;
  extensions?: string[];
}

/**
 * WebSocket frame modifier
 */
export type FrameModifier = (frame: WebSocketFrame) => WebSocketFrame | null;

/**
 * WebSocket frame handler
 */
export type FrameHandler = (frame: WebSocketFrame, connection: WebSocketConnection) => void | Promise<void>;

/**
 * WebSocket connection handler
 */
export type ConnectionHandler = (connection: WebSocketConnection) => void | Promise<void>;

/**
 * Manages WebSocket interception and modification
 */
export class WebSocketInterceptor {
  private page: Page | null = null;
  private cdpSession: CDPSession | null = null;
  private connections: Map<string, WebSocketConnection> = new Map();
  private frames: Map<string, WebSocketFrame[]> = new Map();
  private frameHandlers: Map<string, FrameHandler> = new Map();
  private connectionHandlers: Map<string, ConnectionHandler> = new Map();
  private frameModifiers: Map<string, FrameModifier> = new Map();
  private blockedUrls: Set<string | RegExp> = new Set();
  private frameIdCounter = 0;
  private connectionIdCounter = 0;
  private isIntercepting = false;
  private recordFrames = true;

  /**
   * Attach interceptor to a page
   */
  async attach(page: Page): Promise<void> {
    this.page = page;
    
    // Create CDP session for WebSocket debugging
    this.cdpSession = await page.context().newCDPSession(page);
    
    // Enable network domain for WebSocket events
    await this.cdpSession.send('Network.enable');
    
    // Enable Runtime domain for WebSocket frame events
    await this.cdpSession.send('Runtime.enable');
    
    // Set up WebSocket event listeners
    this.setupEventListeners();
    
    this.isIntercepting = true;
  }

  /**
   * Set up CDP event listeners
   */
  private setupEventListeners(): void {
    if (!this.cdpSession) return;

    // WebSocket created
    this.cdpSession.on('Network.webSocketCreated', (params) => {
      this.handleWebSocketCreated(params);
    });

    // WebSocket closed
    this.cdpSession.on('Network.webSocketClosed', (params) => {
      this.handleWebSocketClosed(params);
    });

    // WebSocket frame sent
    this.cdpSession.on('Network.webSocketFrameSent', (params) => {
      this.handleWebSocketFrameSent(params);
    });

    // WebSocket frame received
    this.cdpSession.on('Network.webSocketFrameReceived', (params) => {
      this.handleWebSocketFrameReceived(params);
    });

    // WebSocket frame error
    this.cdpSession.on('Network.webSocketFrameError', (params) => {
      this.handleWebSocketFrameError(params);
    });

    // WebSocket handshake response received
    this.cdpSession.on('Network.webSocketHandshakeResponseReceived', (params) => {
      this.handleWebSocketHandshakeResponse(params);
    });

    // WebSocket will send handshake request
    this.cdpSession.on('Network.webSocketWillSendHandshakeRequest', (params) => {
      this.handleWebSocketWillSendHandshake(params);
    });
  }

  /**
   * Handle WebSocket created event
   */
  private async handleWebSocketCreated(params: any): Promise<void> {
    const connectionId = `ws_${++this.connectionIdCounter}`;
    const connection: WebSocketConnection = {
      id: connectionId,
      url: params.url,
      state: WebSocketState.CONNECTING,
      openedAt: Date.now(),
      frameCount: 0,
      bytesSent: 0,
      bytesReceived: 0,
      lastActivity: Date.now()
    };

    this.connections.set(params.requestId, connection);
    this.frames.set(params.requestId, []);

    // Check if URL is blocked
    if (this.isUrlBlocked(params.url)) {
      // Close the WebSocket connection
      if (this.page) {
        await this.page.evaluate((url) => {
          const sockets = Array.from(document.querySelectorAll('*'))
            .filter(el => (el as any).__websocket?.url === url)
            .map(el => (el as any).__websocket);
          sockets.forEach(socket => socket.close());
        }, params.url);
      }
      return;
    }

    // Execute connection handlers
    for (const handler of this.connectionHandlers.values()) {
      await handler(connection);
    }
  }

  /**
   * Handle WebSocket handshake request
   */
  private async handleWebSocketWillSendHandshake(params: any): Promise<void> {
    const connection = this.connections.get(params.requestId);
    if (connection) {
      connection.state = WebSocketState.CONNECTING;
      connection.lastActivity = Date.now();
    }
  }

  /**
   * Handle WebSocket handshake response
   */
  private async handleWebSocketHandshakeResponse(params: any): Promise<void> {
    const connection = this.connections.get(params.requestId);
    if (connection && params.response) {
      connection.state = WebSocketState.OPEN;
      connection.lastActivity = Date.now();
      
      // Extract subprotocol and extensions from response headers
      const headers = params.response.headers || {};
      connection.subprotocol = headers['Sec-WebSocket-Protocol'];
      if (headers['Sec-WebSocket-Extensions']) {
        connection.extensions = headers['Sec-WebSocket-Extensions'].split(',').map((ext: string) => ext.trim());
      }
    }
  }

  /**
   * Handle WebSocket closed event
   */
  private async handleWebSocketClosed(params: any): Promise<void> {
    const connection = this.connections.get(params.requestId);
    if (connection) {
      connection.state = WebSocketState.CLOSED;
      connection.closedAt = params.timestamp * 1000;
      connection.lastActivity = Date.now();
    }
  }

  /**
   * Handle WebSocket frame sent
   */
  private async handleWebSocketFrameSent(params: any): Promise<void> {
    await this.handleFrame(params, WebSocketDirection.SENT);
  }

  /**
   * Handle WebSocket frame received
   */
  private async handleWebSocketFrameReceived(params: any): Promise<void> {
    await this.handleFrame(params, WebSocketDirection.RECEIVED);
  }

  /**
   * Handle WebSocket frame
   */
  private async handleFrame(params: any, direction: WebSocketDirection): Promise<void> {
    const connection = this.connections.get(params.requestId);
    if (!connection) return;

    const frameId = `frame_${++this.frameIdCounter}`;
    const frame: WebSocketFrame = {
      id: frameId,
      url: connection.url,
      timestamp: params.timestamp * 1000,
      direction,
      type: this.getFrameType(params.response),
      data: params.response.payloadData || '',
      opcode: params.response.opcode || 0,
      mask: params.response.mask || false,
      payloadLength: params.response.payloadData?.length || 0
    };

    // Update connection statistics
    connection.frameCount++;
    connection.lastActivity = Date.now();
    if (direction === WebSocketDirection.SENT) {
      connection.bytesSent += frame.payloadLength;
    } else {
      connection.bytesReceived += frame.payloadLength;
    }

    // Apply frame modifiers
    let modifiedFrame: WebSocketFrame | null = frame;
    for (const modifier of this.frameModifiers.values()) {
      modifiedFrame = modifier(modifiedFrame);
      if (!modifiedFrame) break; // Frame was filtered out
    }

    // If frame was not filtered out, store and handle it
    if (modifiedFrame && this.recordFrames) {
      const frames = this.frames.get(params.requestId) || [];
      frames.push(modifiedFrame);
      this.frames.set(params.requestId, frames);

      // Execute frame handlers
      for (const handler of this.frameHandlers.values()) {
        await handler(modifiedFrame, connection);
      }
    }
  }

  /**
   * Handle WebSocket frame error
   */
  private async handleWebSocketFrameError(params: any): Promise<void> {
    console.error('WebSocket frame error:', params.errorMessage);
  }

  /**
   * Get frame type from response data
   */
  private getFrameType(response: any): WebSocketFrameType {
    const opcode = response.opcode || 0;
    switch (opcode) {
      case 1: return WebSocketFrameType.TEXT;
      case 2: return WebSocketFrameType.BINARY;
      case 8: return WebSocketFrameType.CLOSE;
      case 9: return WebSocketFrameType.PING;
      case 10: return WebSocketFrameType.PONG;
      default: return WebSocketFrameType.TEXT;
    }
  }

  /**
   * Check if a URL is blocked
   */
  private isUrlBlocked(url: string): boolean {
    for (const pattern of this.blockedUrls) {
      if (typeof pattern === 'string') {
        if (url.includes(pattern)) return true;
      } else {
        if (pattern.test(url)) return true;
      }
    }
    return false;
  }

  /**
   * Block WebSocket connections to specific URLs
   */
  blockUrl(pattern: string | RegExp): void {
    this.blockedUrls.add(pattern);
  }

  /**
   * Unblock a URL pattern
   */
  unblockUrl(pattern: string | RegExp): void {
    this.blockedUrls.delete(pattern);
  }

  /**
   * Clear all blocked URLs
   */
  clearBlockedUrls(): void {
    this.blockedUrls.clear();
  }

  /**
   * Add a frame handler
   */
  addFrameHandler(id: string, handler: FrameHandler): void {
    this.frameHandlers.set(id, handler);
  }

  /**
   * Remove a frame handler
   */
  removeFrameHandler(id: string): void {
    this.frameHandlers.delete(id);
  }

  /**
   * Add a connection handler
   */
  addConnectionHandler(id: string, handler: ConnectionHandler): void {
    this.connectionHandlers.set(id, handler);
  }

  /**
   * Remove a connection handler
   */
  removeConnectionHandler(id: string): void {
    this.connectionHandlers.delete(id);
  }

  /**
   * Add a frame modifier
   */
  addFrameModifier(id: string, modifier: FrameModifier): void {
    this.frameModifiers.set(id, modifier);
  }

  /**
   * Remove a frame modifier
   */
  removeFrameModifier(id: string): void {
    this.frameModifiers.delete(id);
  }

  /**
   * Send a WebSocket message
   */
  async sendMessage(url: string, message: string | Buffer): Promise<void> {
    if (!this.page) {
      throw new Error('No page attached');
    }

    // Find WebSocket connection by URL and send message
    await this.page.evaluate(({ targetUrl, msg }: { targetUrl: string; msg: string }) => {
      const socket = (window as any).__playclone_websockets?.find((ws: WebSocket) => ws.url === targetUrl);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(msg);
      } else {
        throw new Error(`WebSocket not found or not open: ${targetUrl}`);
      }
    }, { targetUrl: url, msg: typeof message === 'string' ? message : message.toString() });
  }

  /**
   * Close a WebSocket connection
   */
  async closeConnection(url: string, code?: number, reason?: string): Promise<void> {
    if (!this.page) {
      throw new Error('No page attached');
    }

    await this.page.evaluate(({ targetUrl, closeCode, closeReason }: { targetUrl: string; closeCode: number; closeReason: string }) => {
      const socket = (window as any).__playclone_websockets?.find((ws: WebSocket) => ws.url === targetUrl);
      if (socket) {
        socket.close(closeCode, closeReason);
      } else {
        throw new Error(`WebSocket not found: ${targetUrl}`);
      }
    }, { targetUrl: url, closeCode: code || 1000, closeReason: reason || 'Normal closure' });
  }

  /**
   * Get all connections
   */
  getConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get active connections
   */
  getActiveConnections(): WebSocketConnection[] {
    return this.getConnections().filter(conn => conn.state === WebSocketState.OPEN);
  }

  /**
   * Get connection by URL
   */
  getConnectionByUrl(url: string): WebSocketConnection | undefined {
    return this.getConnections().find(conn => conn.url === url);
  }

  /**
   * Get frames for a connection
   */
  getFrames(connectionId?: string): WebSocketFrame[] {
    if (connectionId) {
      return this.frames.get(connectionId) || [];
    }
    
    // Return all frames
    const allFrames: WebSocketFrame[] = [];
    for (const frames of this.frames.values()) {
      allFrames.push(...frames);
    }
    return allFrames.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get frames by URL pattern
   */
  getFramesByPattern(pattern: string | RegExp): WebSocketFrame[] {
    return this.getFrames().filter(frame => {
      if (typeof pattern === 'string') {
        return frame.url.includes(pattern);
      }
      return pattern.test(frame.url);
    });
  }

  /**
   * Filter frames by type
   */
  getFramesByType(type: WebSocketFrameType): WebSocketFrame[] {
    return this.getFrames().filter(frame => frame.type === type);
  }

  /**
   * Filter frames by direction
   */
  getFramesByDirection(direction: WebSocketDirection): WebSocketFrame[] {
    return this.getFrames().filter(frame => frame.direction === direction);
  }

  /**
   * Search frames by content
   */
  searchFrames(searchTerm: string, caseSensitive = false): WebSocketFrame[] {
    const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
    
    return this.getFrames().filter(frame => {
      if (frame.type !== WebSocketFrameType.TEXT) return false;
      
      const data = typeof frame.data === 'string' ? frame.data : frame.data.toString();
      const content = caseSensitive ? data : data.toLowerCase();
      
      return content.includes(term);
    });
  }

  /**
   * Get WebSocket statistics
   */
  getStatistics(): {
    totalConnections: number;
    activeConnections: number;
    totalFrames: number;
    totalBytesSent: number;
    totalBytesReceived: number;
    averageFramesPerConnection: number;
    messageTypeDistribution: Record<WebSocketFrameType, number>;
  } {
    const connections = this.getConnections();
    const activeConnections = this.getActiveConnections();
    const allFrames = this.getFrames();
    
    const totalBytesSent = connections.reduce((sum, conn) => sum + conn.bytesSent, 0);
    const totalBytesReceived = connections.reduce((sum, conn) => sum + conn.bytesReceived, 0);
    
    const messageTypeDistribution: Record<WebSocketFrameType, number> = {
      [WebSocketFrameType.TEXT]: 0,
      [WebSocketFrameType.BINARY]: 0,
      [WebSocketFrameType.CLOSE]: 0,
      [WebSocketFrameType.PING]: 0,
      [WebSocketFrameType.PONG]: 0
    };
    
    allFrames.forEach(frame => {
      messageTypeDistribution[frame.type]++;
    });
    
    return {
      totalConnections: connections.length,
      activeConnections: activeConnections.length,
      totalFrames: allFrames.length,
      totalBytesSent,
      totalBytesReceived,
      averageFramesPerConnection: connections.length > 0 ? allFrames.length / connections.length : 0,
      messageTypeDistribution
    };
  }

  /**
   * Export captured WebSocket traffic
   */
  exportCapture(): {
    connections: WebSocketConnection[];
    frames: WebSocketFrame[];
    statistics: ReturnType<WebSocketInterceptor['getStatistics']>;
    capturedAt: number;
  } {
    return {
      connections: this.getConnections(),
      frames: this.getFrames(),
      statistics: this.getStatistics(),
      capturedAt: Date.now()
    };
  }

  /**
   * Clear captured data
   */
  clear(): void {
    this.connections.clear();
    this.frames.clear();
  }

  /**
   * Set whether to record frames
   */
  setRecording(enabled: boolean): void {
    this.recordFrames = enabled;
  }

  /**
   * Check if recording is enabled
   */
  isRecording(): boolean {
    return this.recordFrames;
  }

  /**
   * Detach interceptor from the page
   */
  async detach(): Promise<void> {
    if (this.cdpSession) {
      await this.cdpSession.detach();
      this.cdpSession = null;
    }
    
    this.page = null;
    this.isIntercepting = false;
    this.clear();
  }

  /**
   * Check if interception is active
   */
  isActive(): boolean {
    return this.isIntercepting;
  }

  /**
   * Inject WebSocket tracking script
   */
  async injectTrackingScript(): Promise<void> {
    if (!this.page) return;

    await this.page.addInitScript(() => {
      // Track all WebSocket instances
      (window as any).__playclone_websockets = [];
      
      const originalWebSocket = window.WebSocket;
      window.WebSocket = new Proxy(originalWebSocket, {
        construct(target: any, args: any[]) {
          const instance = new (target as any)(args[0], args[1]);
          (window as any).__playclone_websockets.push(instance);
          
          // Store URL for reference
          (instance as any).url = args[0];
          
          return instance;
        }
      }) as any;
    });
  }
}