import { WebSocket } from 'ws';
import * as http from 'http';
import * as https from 'https';
import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';

export interface FarmClientConfig {
  url: string;
  authentication?: {
    type: 'token' | 'basic' | 'none';
    secret?: string;
  };
  reconnect?: boolean;
  reconnectInterval?: number;
  timeout?: number;
}

export interface SessionOptions {
  browser?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
  locale?: string;
  timezone?: string;
  [key: string]: any;
}

/**
 * Client for connecting to a browser farm
 */
export class BrowserFarmClient extends EventEmitter {
  private config: Required<FarmClientConfig>;
  private ws?: WebSocket;
  private logger: Logger;
  private connected = false;
  private reconnectTimer?: NodeJS.Timeout;
  private requestCallbacks: Map<string, (response: any) => void> = new Map();
  private requestId = 0;

  constructor(config: FarmClientConfig) {
    super();
    
    this.config = {
      url: config.url,
      authentication: config.authentication || { type: 'none' },
      reconnect: config.reconnect !== false,
      reconnectInterval: config.reconnectInterval || 5000,
      timeout: config.timeout || 30000
    } as Required<FarmClientConfig>;
    
    this.logger = new Logger('BrowserFarmClient');
  }

  /**
   * Connect to the browser farm
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.url);
      const wsUrl = `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}${url.pathname}`;
      
      const headers: any = {};
      
      // Add authentication headers
      if (this.config.authentication.type === 'token') {
        headers['Authorization'] = `Bearer ${this.config.authentication.secret}`;
      } else if (this.config.authentication.type === 'basic') {
        const encoded = Buffer.from(this.config.authentication.secret!).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
      
      this.ws = new WebSocket(wsUrl, { headers });
      
      this.ws!.on('open', () => {
        this.connected = true;
        this.logger.info('Connected to browser farm');
        this.emit('connected');
        resolve();
      });
      
      this.ws!.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          
          if (message.requestId) {
            const callback = this.requestCallbacks.get(message.requestId);
            if (callback) {
              callback(message);
              this.requestCallbacks.delete(message.requestId);
            }
          }
          
          this.emit('message', message);
        } catch (error) {
          this.logger.error('Failed to parse message:', error);
        }
      });
      
      this.ws!.on('close', () => {
        this.connected = false;
        this.logger.info('Disconnected from browser farm');
        this.emit('disconnected');
        
        if (this.config.reconnect) {
          this.scheduleReconnect();
        }
      });
      
      this.ws!.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      });
    });
  }

  /**
   * Disconnect from the browser farm
   */
  async disconnect(): Promise<void> {
    this.config.reconnect = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    
    this.connected = false;
  }

  /**
   * Create a new browser session
   */
  async createSession(options: SessionOptions = {}): Promise<string> {
    const response = await this.sendRequest({
      action: 'createSession',
      data: options
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to create session');
    }
    
    return response.sessionId!;
  }

  /**
   * Execute an action on a session
   */
  async executeAction(sessionId: string, action: string, data: any = {}): Promise<any> {
    const response = await this.sendRequest({
      action: 'executeAction',
      sessionId,
      data: { action, ...data }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Action execution failed');
    }
    
    return response.data;
  }

  /**
   * Navigate to a URL
   */
  async navigate(sessionId: string, url: string): Promise<any> {
    return this.executeAction(sessionId, 'navigate', { url });
  }

  /**
   * Click an element
   */
  async click(sessionId: string, selector: string): Promise<any> {
    return this.executeAction(sessionId, 'click', { selector });
  }

  /**
   * Fill a form field
   */
  async fill(sessionId: string, selector: string, value: string): Promise<any> {
    return this.executeAction(sessionId, 'fill', { selector, value });
  }

  /**
   * Get page text
   */
  async getText(sessionId: string, selector?: string): Promise<string> {
    const result = await this.executeAction(sessionId, 'getText', { selector });
    return result.text;
  }

  /**
   * Take a screenshot
   */
  async screenshot(sessionId: string, options: any = {}): Promise<Buffer> {
    const result = await this.executeAction(sessionId, 'screenshot', options);
    return Buffer.from(result.data, 'base64');
  }

  /**
   * Close a session
   */
  async closeSession(sessionId: string): Promise<void> {
    const response = await this.sendRequest({
      action: 'closeSession',
      sessionId
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to close session');
    }
  }

  /**
   * Get farm status
   */
  async getStatus(): Promise<any> {
    if (this.ws && this.connected) {
      // Use WebSocket
      const response = await this.sendRequest({
        action: 'getStatus'
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get status');
      }
      
      return response.data;
    } else {
      // Use HTTP
      return this.httpRequest('GET', '/api/status');
    }
  }

  /**
   * Send request via WebSocket
   */
  private sendRequest(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('Not connected to browser farm'));
        return;
      }
      
      const requestId = (++this.requestId).toString();
      const message = { ...request, requestId };
      
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(requestId);
        reject(new Error('Request timeout'));
      }, this.config.timeout);
      
      this.requestCallbacks.set(requestId, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
      
      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * Send HTTP request
   */
  private async httpRequest(method: string, path: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.url);
      const protocol = url.protocol === 'https:' ? https : http;
      
      const options: any = {
        method,
        hostname: url.hostname,
        port: url.port,
        path,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      // Add authentication headers
      if (this.config.authentication.type === 'token') {
        options.headers['Authorization'] = `Bearer ${this.config.authentication.secret}`;
      } else if (this.config.authentication.type === 'basic') {
        const encoded = Buffer.from(this.config.authentication.secret!).toString('base64');
        options.headers['Authorization'] = `Basic ${encoded}`;
      }
      
      const req = protocol.request(options, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            
            if (res.statusCode === 200) {
              resolve(response);
            } else {
              reject(new Error(response.error || `HTTP ${res.statusCode}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', reject);
      
      if (data && method !== 'GET') {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.logger.info('Attempting to reconnect...');
      
      this.connect().catch(error => {
        this.logger.error('Reconnection failed:', error);
        this.scheduleReconnect();
      });
    }, this.config.reconnectInterval);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}