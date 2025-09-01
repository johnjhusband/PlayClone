import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PlayClone } from '../PlayClone';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import WebSocket from 'ws';

/**
 * REST API Server for PlayClone
 * 
 * Provides a RESTful API interface for browser automation,
 * allowing PlayClone to be used as a service.
 */

interface Session {
  id: string;
  playClone: PlayClone;
  createdAt: Date;
  lastUsed: Date;
  metadata?: any;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  sessionId?: string;
  timestamp: string;
}

interface ServerConfig {
  port?: number;
  host?: string;
  maxSessions?: number;
  sessionTimeout?: number; // in minutes
  apiKey?: string;
  enableWebSocket?: boolean;
  corsOrigin?: string | string[];
  rateLimit?: {
    windowMs?: number;
    maxRequests?: number;
  };
}

export class RestApiServer {
  private app: Express;
  private server: http.Server | null = null;
  private wss: WebSocket.Server | null = null;
  private sessions: Map<string, Session> = new Map();
  private config: Required<ServerConfig>;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor(config: ServerConfig = {}) {
    this.config = {
      port: config.port || 3000,
      host: config.host || 'localhost',
      maxSessions: config.maxSessions || 10,
      sessionTimeout: config.sessionTimeout || 30,
      apiKey: config.apiKey || '',
      enableWebSocket: config.enableWebSocket || false,
      corsOrigin: config.corsOrigin || '*',
      rateLimit: {
        windowMs: config.rateLimit?.windowMs || 60000,
        maxRequests: config.rateLimit?.maxRequests || 100
      }
    };
    
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.startCleanup();
  }
  
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: this.config.corsOrigin,
      credentials: true
    }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // API key authentication (if configured)
    if (this.config.apiKey) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;
        if (apiKey !== this.config.apiKey) {
          return res.status(401).json(this.createResponse(false, null, 'Invalid API key'));
        }
        next();
      });
    }
    
    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }
  
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json(this.createResponse(true, {
        status: 'healthy',
        sessions: this.sessions.size,
        maxSessions: this.config.maxSessions,
        uptime: process.uptime()
      }));
    });
    
    // Session management
    this.app.post('/sessions', async (req: Request, res: Response) => {
      try {
        if (this.sessions.size >= this.config.maxSessions) {
          return res.status(503).json(
            this.createResponse(false, null, 'Maximum sessions reached')
          );
        }
        
        const sessionId = uuidv4();
        const options = req.body.options || {};
        const playClone = new PlayClone(options);
        
        // Initialize by navigating to blank page
        await playClone.navigate('about:blank');
        
        const session: Session = {
          id: sessionId,
          playClone,
          createdAt: new Date(),
          lastUsed: new Date(),
          metadata: req.body.metadata
        };
        
        this.sessions.set(sessionId, session);
        
        res.json(this.createResponse(true, {
          sessionId,
          createdAt: session.createdAt
        }));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    this.app.get('/sessions', (req: Request, res: Response) => {
      const sessionList = Array.from(this.sessions.values()).map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        lastUsed: s.lastUsed,
        metadata: s.metadata
      }));
      
      res.json(this.createResponse(true, sessionList));
    });
    
    this.app.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        await session.playClone.close();
        this.sessions.delete(req.params.sessionId);
        res.json(this.createResponse(true, { message: 'Session closed' }));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    // Navigation
    this.app.post('/sessions/:sessionId/navigate', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const { url } = req.body;
        const result = await session.playClone.navigate(url);
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    this.app.post('/sessions/:sessionId/back', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const result = await session.playClone.back();
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    this.app.post('/sessions/:sessionId/forward', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const result = await session.playClone.forward();
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    this.app.post('/sessions/:sessionId/reload', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const result = await session.playClone.reload();
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    // Actions
    this.app.post('/sessions/:sessionId/click', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const { selector, options } = req.body;
        const result = await session.playClone.click(selector, options);
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    this.app.post('/sessions/:sessionId/type', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const { text, options } = req.body;
        const result = await session.playClone.type(text, options);
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    this.app.post('/sessions/:sessionId/fill', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const { selector, value, options } = req.body;
        const result = await session.playClone.fill(selector, value);
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    this.app.post('/sessions/:sessionId/select', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const { selector, value, options } = req.body;
        const result = await session.playClone.select(selector, value);
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    this.app.post('/sessions/:sessionId/check', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const { selector, options } = req.body;
        const result = await session.playClone.check(selector);
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    // Data extraction
    this.app.get('/sessions/:sessionId/text', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const selector = req.query.selector as string;
        const result = await session.playClone.getText(selector);
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    this.app.get('/sessions/:sessionId/links', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const result = await session.playClone.getLinks();
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    this.app.get('/sessions/:sessionId/table', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const selector = req.query.selector as string;
        const result = await session.playClone.getTable(selector);
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    this.app.get('/sessions/:sessionId/form', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const selector = req.query.selector as string;
        const result = await session.playClone.getFormData(selector);
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    // Screenshot
    this.app.get('/sessions/:sessionId/screenshot', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const options = {
          fullPage: req.query.fullPage === 'true',
          selector: req.query.selector as string
        };
        const result = await session.playClone.screenshot(options);
        session.lastUsed = new Date();
        
        if (req.query.format === 'base64') {
          res.json(this.createResponse(true, result));
        } else {
          // Return as image
          const buffer = Buffer.from(result.data, 'base64');
          res.contentType('image/png');
          res.send(buffer);
        }
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    // State management
    this.app.post('/sessions/:sessionId/state/save', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const { name } = req.body;
        const result = await session.playClone.saveState(name);
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    this.app.post('/sessions/:sessionId/state/restore', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const { name } = req.body;
        const result = await session.playClone.restoreState(name);
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    // Wait for element
    this.app.post('/sessions/:sessionId/wait', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const { selector, timeout } = req.body;
        const result = await session.playClone.waitFor(selector, timeout);
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    // Execute JavaScript
    this.app.post('/sessions/:sessionId/execute', async (req: Request, res: Response) => {
      const session = this.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json(
          this.createResponse(false, null, 'Session not found')
        );
      }
      
      try {
        const { script, args } = req.body;
        const result = await session.playClone.execute(script);
        session.lastUsed = new Date();
        res.json(this.createResponse(true, result));
      } catch (error: any) {
        res.status(500).json(this.createResponse(false, null, error.message));
      }
    });
    
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json(this.createResponse(false, null, 'Endpoint not found'));
    });
    
    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Server error:', err);
      res.status(500).json(this.createResponse(false, null, 'Internal server error'));
    });
  }
  
  private setupWebSocket(): void {
    if (!this.config.enableWebSocket || !this.server) return;
    
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('WebSocket client connected');
      
      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message);
          const { action, sessionId, params } = data;
          
          const session = this.getSession(sessionId);
          if (!session) {
            ws.send(JSON.stringify(this.createResponse(false, null, 'Session not found')));
            return;
          }
          
          // Handle WebSocket actions
          let result;
          switch (action) {
            case 'navigate':
              result = await session.playClone.navigate(params.url);
              break;
            case 'click':
              result = await session.playClone.click(params.selector);
              break;
            case 'type':
              result = await session.playClone.type(params.text);
              break;
            case 'getText':
              result = await session.playClone.getText(params.selector);
              break;
            default:
              ws.send(JSON.stringify(this.createResponse(false, null, 'Unknown action')));
              return;
          }
          
          session.lastUsed = new Date();
          ws.send(JSON.stringify(this.createResponse(true, result)));
          
        } catch (error: any) {
          ws.send(JSON.stringify(this.createResponse(false, null, error.message)));
        }
      });
      
      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
    });
  }
  
  private getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }
  
  private createResponse<T>(success: boolean, data: T | null, error?: string): ApiResponse<T> {
    return {
      success,
      data: data || undefined,
      error,
      timestamp: new Date().toISOString()
    };
  }
  
  private startCleanup(): void {
    // Clean up expired sessions every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      const now = new Date();
      const timeout = this.config.sessionTimeout * 60 * 1000;
      
      for (const [id, session] of this.sessions.entries()) {
        if (now.getTime() - session.lastUsed.getTime() > timeout) {
          try {
            await session.playClone.close();
            this.sessions.delete(id);
            console.log(`Cleaned up expired session: ${id}`);
          } catch (error) {
            console.error(`Error cleaning up session ${id}:`, error);
          }
        }
      }
    }, 5 * 60 * 1000);
  }
  
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        console.log(`🚀 PlayClone REST API Server running at http://${this.config.host}:${this.config.port}`);
        
        if (this.config.enableWebSocket) {
          this.setupWebSocket();
          console.log(`🔌 WebSocket server enabled`);
        }
        
        console.log(`📝 API Documentation: http://${this.config.host}:${this.config.port}/api-docs`);
        console.log(`🔐 API Key: ${this.config.apiKey ? 'Required' : 'Not required'}`);
        
        resolve();
      });
    });
  }
  
  public async stop(): Promise<void> {
    // Clean up all sessions
    for (const session of this.sessions.values()) {
      try {
        await session.playClone.close();
      } catch (error) {
        console.error('Error closing session:', error);
      }
    }
    this.sessions.clear();
    
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }
    
    // Close HTTP server
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('REST API Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Export a function to start the server
export function startApiServer(config?: ServerConfig): Promise<RestApiServer> {
  const server = new RestApiServer(config);
  return server.start().then(() => server);
}