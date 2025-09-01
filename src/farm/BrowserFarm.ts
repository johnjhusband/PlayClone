import { EventEmitter } from 'events';
import { BrowserManager } from '../core/BrowserManager';
import { Logger } from '../utils/Logger';
import * as WebSocket from 'ws';
import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';

export interface BrowserWorker {
  id: string;
  host: string;
  port: number;
  capacity: number;
  available: number;
  lastHealthCheck: Date;
  status: 'online' | 'offline' | 'unhealthy';
  sessions: Map<string, WorkerSession>;
  metrics: WorkerMetrics;
}

export interface WorkerSession {
  sessionId: string;
  workerId: string;
  browserId: string;
  startTime: Date;
  lastActivity: Date;
  metadata?: any;
}

export interface WorkerMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeSessions: number;
  totalRequests: number;
  errorRate: number;
  avgResponseTime: number;
}

export interface FarmConfig {
  port?: number;
  workers?: WorkerConfig[];
  maxSessionsPerWorker?: number;
  healthCheckInterval?: number;
  sessionTimeout?: number;
  loadBalancingStrategy?: 'round-robin' | 'least-connections' | 'random' | 'weighted';
  ssl?: {
    key: string;
    cert: string;
  };
  authentication?: {
    type: 'token' | 'basic' | 'none';
    secret?: string;
  };
}

export interface WorkerConfig {
  id?: string;
  host: string;
  port: number;
  capacity?: number;
  weight?: number;
}

interface FarmRequest {
  action: string;
  sessionId?: string;
  data?: any;
}

interface FarmResponse {
  success: boolean;
  sessionId?: string;
  workerId?: string;
  data?: any;
  error?: string;
}

/**
 * Distributed browser farm for scaling automation across multiple machines
 */
export class BrowserFarm extends EventEmitter {
  private workers: Map<string, BrowserWorker> = new Map();
  private sessions: Map<string, WorkerSession> = new Map();
  private config: Required<FarmConfig>;
  private server?: http.Server | https.Server;
  private wss?: WebSocket.Server;
  private logger: Logger;
  private healthCheckTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private roundRobinIndex = 0;
  private localBrowserManager?: BrowserManager;

  constructor(config: FarmConfig = {}) {
    super();
    
    this.config = {
      port: config.port || 8080,
      workers: config.workers || [],
      maxSessionsPerWorker: config.maxSessionsPerWorker || 10,
      healthCheckInterval: config.healthCheckInterval || 30000,
      sessionTimeout: config.sessionTimeout || 300000, // 5 minutes
      loadBalancingStrategy: config.loadBalancingStrategy || 'least-connections',
      ssl: config.ssl,
      authentication: config.authentication || { type: 'none' }
    } as Required<FarmConfig>;
    
    this.logger = new Logger('BrowserFarm');
  }

  /**
   * Start the browser farm server
   */
  async start(): Promise<void> {
    this.logger.info('Starting browser farm...');
    
    // Initialize local browser manager if this node also runs browsers
    if (!this.config.workers || this.config.workers.length === 0) {
      this.localBrowserManager = new BrowserManager();
      await this.addLocalWorker();
    }
    
    // Add configured workers
    for (const workerConfig of this.config.workers) {
      await this.addWorker(workerConfig);
    }
    
    // Create HTTP/HTTPS server
    if (this.config.ssl) {
      this.server = https.createServer({
        key: this.config.ssl.key,
        cert: this.config.ssl.cert
      });
    } else {
      this.server = http.createServer();
    }
    
    // Create WebSocket server for real-time communication
    this.wss = new WebSocket.Server({ server: this.server });
    
    // Handle WebSocket connections
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleWebSocketConnection(ws);
    });
    
    // Handle HTTP requests
    this.server.on('request', (req, res) => {
      this.handleHttpRequest(req, res);
    });
    
    // Start server
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.config.port, () => {
        this.logger.info(`Browser farm listening on port ${this.config.port}`);
        resolve();
      });
      this.server!.on('error', reject);
    });
    
    // Start health checks
    this.startHealthChecks();
    
    // Start session cleanup
    this.startSessionCleanup();
    
    this.emit('started', { port: this.config.port, workers: this.workers.size });
  }

  /**
   * Stop the browser farm
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping browser farm...');
    
    // Stop timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // Close all sessions
    for (const session of this.sessions.values()) {
      await this.closeSession(session.sessionId);
    }
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }
    
    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
    }
    
    // Stop local browser manager
    if (this.localBrowserManager) {
      // Local cleanup
    }
    
    this.emit('stopped');
  }

  /**
   * Add a worker to the farm
   */
  async addWorker(config: WorkerConfig): Promise<void> {
    const workerId = config.id || crypto.randomBytes(16).toString('hex');
    
    const worker: BrowserWorker = {
      id: workerId,
      host: config.host,
      port: config.port,
      capacity: config.capacity || this.config.maxSessionsPerWorker,
      available: config.capacity || this.config.maxSessionsPerWorker,
      lastHealthCheck: new Date(),
      status: 'offline',
      sessions: new Map(),
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        activeSessions: 0,
        totalRequests: 0,
        errorRate: 0,
        avgResponseTime: 0
      }
    };
    
    this.workers.set(workerId, worker);
    
    // Check worker health
    await this.checkWorkerHealth(worker);
    
    this.logger.info(`Added worker ${workerId} at ${worker.host}:${worker.port}`);
    this.emit('workerAdded', worker);
  }

  /**
   * Add local worker (this node)
   */
  private async addLocalWorker(): Promise<void> {
    const workerId = 'local-' + crypto.randomBytes(8).toString('hex');
    
    const worker: BrowserWorker = {
      id: workerId,
      host: 'localhost',
      port: 0, // Local worker doesn't use network
      capacity: this.config.maxSessionsPerWorker,
      available: this.config.maxSessionsPerWorker,
      lastHealthCheck: new Date(),
      status: 'online',
      sessions: new Map(),
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        activeSessions: 0,
        totalRequests: 0,
        errorRate: 0,
        avgResponseTime: 0
      }
    };
    
    this.workers.set(workerId, worker);
    this.logger.info(`Added local worker ${workerId}`);
  }

  /**
   * Remove a worker from the farm
   */
  async removeWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }
    
    // Close all sessions on this worker
    for (const session of worker.sessions.values()) {
      await this.closeSession(session.sessionId);
    }
    
    this.workers.delete(workerId);
    this.logger.info(`Removed worker ${workerId}`);
    this.emit('workerRemoved', worker);
  }

  /**
   * Create a new browser session
   */
  async createSession(options: any = {}): Promise<FarmResponse> {
    const worker = this.selectWorker();
    
    if (!worker) {
      return {
        success: false,
        error: 'No available workers'
      };
    }
    
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    try {
      // Create session on worker
      let browserId: string;
      
      if (worker.id.startsWith('local-')) {
        // Local worker - use local browser manager
        const context = await this.localBrowserManager!.launch();
        browserId = sessionId; // Use session ID as browser ID for local
      } else {
        // Remote worker - send request
        const response = await this.sendWorkerRequest(worker, {
          action: 'createSession',
          data: options
        });
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to create session');
        }
        
        browserId = response.data.browserId;
      }
      
      // Create session record
      const session: WorkerSession = {
        sessionId,
        workerId: worker.id,
        browserId,
        startTime: new Date(),
        lastActivity: new Date(),
        metadata: options
      };
      
      this.sessions.set(sessionId, session);
      worker.sessions.set(sessionId, session);
      worker.available--;
      worker.metrics.activeSessions++;
      worker.metrics.totalRequests++;
      
      this.logger.info(`Created session ${sessionId} on worker ${worker.id}`);
      this.emit('sessionCreated', session);
      
      return {
        success: true,
        sessionId,
        workerId: worker.id,
        data: { browserId }
      };
    } catch (error: any) {
      this.logger.error(`Failed to create session on worker ${worker.id}:`, error);
      worker.metrics.errorRate++;
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute action on a session
   */
  async executeAction(sessionId: string, action: string, data: any): Promise<FarmResponse> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return {
        success: false,
        error: `Session ${sessionId} not found`
      };
    }
    
    const worker = this.workers.get(session.workerId);
    
    if (!worker || worker.status !== 'online') {
      return {
        success: false,
        error: `Worker ${session.workerId} not available`
      };
    }
    
    session.lastActivity = new Date();
    
    try {
      let result: any;
      
      if (worker.id.startsWith('local-')) {
        // Local execution
        result = await this.executeLocalAction(session.browserId, action, data);
      } else {
        // Remote execution
        const response = await this.sendWorkerRequest(worker, {
          action: 'executeAction',
          sessionId,
          data: { action, ...data }
        });
        
        if (!response.success) {
          throw new Error(response.error || 'Action execution failed');
        }
        
        result = response.data;
      }
      
      worker.metrics.totalRequests++;
      
      return {
        success: true,
        sessionId,
        workerId: worker.id,
        data: result
      };
    } catch (error: any) {
      this.logger.error(`Failed to execute action on session ${sessionId}:`, error);
      worker.metrics.errorRate++;
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Close a browser session
   */
  async closeSession(sessionId: string): Promise<FarmResponse> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return {
        success: false,
        error: `Session ${sessionId} not found`
      };
    }
    
    const worker = this.workers.get(session.workerId);
    
    if (worker) {
      try {
        if (worker.id.startsWith('local-')) {
          // Close local browser
          // await this.localBrowserManager!.close(session.browserId);
        } else {
          // Close remote browser
          await this.sendWorkerRequest(worker, {
            action: 'closeSession',
            sessionId
          });
        }
        
        worker.sessions.delete(sessionId);
        worker.available++;
        worker.metrics.activeSessions--;
      } catch (error: any) {
        this.logger.error(`Failed to close session ${sessionId}:`, error);
      }
    }
    
    this.sessions.delete(sessionId);
    this.logger.info(`Closed session ${sessionId}`);
    this.emit('sessionClosed', session);
    
    return { success: true };
  }

  /**
   * Select a worker based on load balancing strategy
   */
  private selectWorker(): BrowserWorker | null {
    const availableWorkers = Array.from(this.workers.values())
      .filter(w => w.status === 'online' && w.available > 0);
    
    if (availableWorkers.length === 0) {
      return null;
    }
    
    switch (this.config.loadBalancingStrategy) {
      case 'round-robin':
        const worker = availableWorkers[this.roundRobinIndex % availableWorkers.length];
        this.roundRobinIndex++;
        return worker;
      
      case 'least-connections':
        return availableWorkers.reduce((min, w) => 
          w.metrics.activeSessions < min.metrics.activeSessions ? w : min
        );
      
      case 'random':
        return availableWorkers[Math.floor(Math.random() * availableWorkers.length)];
      
      case 'weighted':
        // Implement weighted selection based on capacity
        const totalCapacity = availableWorkers.reduce((sum, w) => sum + w.capacity, 0);
        let random = Math.random() * totalCapacity;
        
        for (const worker of availableWorkers) {
          random -= worker.capacity;
          if (random <= 0) {
            return worker;
          }
        }
        return availableWorkers[0];
      
      default:
        return availableWorkers[0];
    }
  }

  /**
   * Send request to worker
   */
  private async sendWorkerRequest(worker: BrowserWorker, request: FarmRequest): Promise<FarmResponse> {
    return new Promise((resolve, reject) => {
      const protocol = this.config.ssl ? 'https' : 'http';
      const url = `${protocol}://${worker.host}:${worker.port}/api/farm`;
      
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        }
      };
      
      const client = protocol === 'https' ? https : http;
      
      const req = client.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data) as FarmResponse;
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid response from worker'));
          }
        });
      });
      
      req.on('error', reject);
      req.write(JSON.stringify(request));
      req.end();
    });
  }

  /**
   * Execute action locally
   */
  private async executeLocalAction(_browserId: string, action: string, data: any): Promise<any> {
    // This would integrate with the local BrowserManager
    // For now, return mock success
    return { success: true, action, data };
  }

  /**
   * Handle WebSocket connection
   */
  private handleWebSocketConnection(ws: WebSocket): void {
    this.logger.info('New WebSocket connection');
    
    ws.on('message', async (message: string) => {
      try {
        const request = JSON.parse(message) as FarmRequest;
        let response: FarmResponse;
        
        switch (request.action) {
          case 'createSession':
            response = await this.createSession(request.data);
            break;
          
          case 'executeAction':
            response = await this.executeAction(
              request.sessionId!,
              request.data.action,
              request.data
            );
            break;
          
          case 'closeSession':
            response = await this.closeSession(request.sessionId!);
            break;
          
          case 'getStatus':
            response = {
              success: true,
              data: this.getStatus()
            };
            break;
          
          default:
            response = {
              success: false,
              error: `Unknown action: ${request.action}`
            };
        }
        
        ws.send(JSON.stringify(response));
      } catch (error: any) {
        ws.send(JSON.stringify({
          success: false,
          error: error.message
        }));
      }
    });
    
    ws.on('close', () => {
      this.logger.info('WebSocket connection closed');
    });
  }

  /**
   * Handle HTTP request
   */
  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // Check authentication
    if (!this.authenticateRequest(req)) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    
    const url = new URL(req.url!, `http://${req.headers.host}`);
    
    if (url.pathname === '/api/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.getStatus()));
    } else if (url.pathname === '/api/farm' && req.method === 'POST') {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk;
      });
      
      req.on('end', async () => {
        try {
          const request = JSON.parse(body) as FarmRequest;
          let response: FarmResponse;
          
          switch (request.action) {
            case 'createSession':
              response = await this.createSession(request.data);
              break;
            
            case 'executeAction':
              response = await this.executeAction(
                request.sessionId!,
                request.data.action,
                request.data
              );
              break;
            
            case 'closeSession':
              response = await this.closeSession(request.sessionId!);
              break;
            
            default:
              response = {
                success: false,
                error: `Unknown action: ${request.action}`
              };
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (error: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  /**
   * Authenticate request
   */
  private authenticateRequest(req: http.IncomingMessage): boolean {
    if (this.config.authentication.type === 'none') {
      return true;
    }
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return false;
    }
    
    if (this.config.authentication.type === 'token') {
      return authHeader === `Bearer ${this.config.authentication.secret}`;
    }
    
    if (this.config.authentication.type === 'basic') {
      const [type, credentials] = authHeader.split(' ');
      if (type !== 'Basic') {
        return false;
      }
      
      const decoded = Buffer.from(credentials, 'base64').toString();
      return decoded === this.config.authentication.secret;
    }
    
    return false;
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    if (this.config.authentication.type === 'none') {
      return {};
    }
    
    if (this.config.authentication.type === 'token') {
      return {
        'Authorization': `Bearer ${this.config.authentication.secret}`
      };
    }
    
    if (this.config.authentication.type === 'basic') {
      const encoded = Buffer.from(this.config.authentication.secret!).toString('base64');
      return {
        'Authorization': `Basic ${encoded}`
      };
    }
    
    return {};
  }

  /**
   * Check worker health
   */
  private async checkWorkerHealth(worker: BrowserWorker): Promise<void> {
    try {
      const response = await this.sendWorkerRequest(worker, {
        action: 'health'
      });
      
      if (response.success) {
        worker.status = 'online';
        worker.lastHealthCheck = new Date();
        
        if (response.data) {
          worker.metrics = { ...worker.metrics, ...response.data.metrics };
        }
      } else {
        worker.status = 'unhealthy';
      }
    } catch (error) {
      worker.status = 'offline';
      this.logger.warn(`Worker ${worker.id} health check failed`);
    }
  }

  /**
   * Start health check timer
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      for (const worker of this.workers.values()) {
        if (!worker.id.startsWith('local-')) {
          await this.checkWorkerHealth(worker);
        }
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Start session cleanup timer
   */
  private startSessionCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.config.sessionTimeout;
      
      for (const session of this.sessions.values()) {
        if (now - session.lastActivity.getTime() > timeout) {
          this.logger.info(`Cleaning up idle session ${session.sessionId}`);
          this.closeSession(session.sessionId).catch(error => {
            this.logger.error('Failed to cleanup session:', error);
          });
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Get farm status
   */
  getStatus(): any {
    const workers = Array.from(this.workers.values()).map(w => ({
      id: w.id,
      host: w.host,
      port: w.port,
      status: w.status,
      capacity: w.capacity,
      available: w.available,
      sessions: w.sessions.size,
      metrics: w.metrics
    }));
    
    return {
      workers,
      totalWorkers: this.workers.size,
      onlineWorkers: workers.filter(w => w.status === 'online').length,
      totalSessions: this.sessions.size,
      activeSessions: this.sessions.size,
      loadBalancing: this.config.loadBalancingStrategy
    };
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId: string): BrowserWorker | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Get all workers
   */
  getWorkers(): BrowserWorker[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): WorkerSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getSessions(): WorkerSession[] {
    return Array.from(this.sessions.values());
  }
}