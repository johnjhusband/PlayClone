/**
 * Local Browser Farm Tester
 * 
 * This module provides local testing capabilities for the distributed browser farm,
 * allowing developers to test multi-node scenarios without actual remote servers.
 * It simulates multiple farm nodes locally with realistic network conditions.
 */

import { EventEmitter } from 'events';
import { createServer, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { PlayClone } from '../index';
import { DistributedBrowserFarm } from './DistributedBrowserFarm';
import { BrowserFarm } from './BrowserFarm';
import { Logger } from '../utils/Logger';

interface LocalNodeConfig {
  id: string;
  port: number;
  region: string;
  capacity: number;
  weight?: number;
  simulatedLatency?: number;
  simulatedFailureRate?: number;
}

interface LocalTestConfig {
  nodes: LocalNodeConfig[];
  basePort?: number;
  simulateNetworkConditions?: boolean;
  autoStart?: boolean;
  verbose?: boolean;
}

interface SimulatedNetworkConditions {
  latency: { min: number; max: number };
  packetLoss: number;
  bandwidth: number;
  jitter: number;
}

class LocalFarmNode extends EventEmitter {
  private id: string;
  private port: number;
  private region: string;
  private capacity: number;
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;
  private farm: BrowserFarm | null = null;
  private sessions: Map<string, PlayClone> = new Map();
  private logger: Logger;
  private simulatedLatency: number;
  private simulatedFailureRate: number;
  private isHealthy: boolean = true;
  private metrics: {
    requestCount: number;
    errorCount: number;
    totalLatency: number;
    startTime: Date;
  };

  constructor(config: LocalNodeConfig) {
    super();
    this.id = config.id;
    this.port = config.port;
    this.region = config.region;
    this.capacity = config.capacity;
    this.simulatedLatency = config.simulatedLatency || 0;
    this.simulatedFailureRate = config.simulatedFailureRate || 0;
    this.logger = new Logger(`LocalNode-${this.id}`);
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      totalLatency: 0,
      startTime: new Date()
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.server = createServer();
        
        // Create WebSocket server
        this.wss = new WebSocketServer({ server: this.server });
        
        // Initialize local browser farm
        this.farm = new BrowserFarm({
          port: this.port,
          maxSessionsPerWorker: this.capacity,
          sessionTimeout: 60000,
          healthCheckInterval: 5000,
          loadBalancingStrategy: 'least-connections'
        });

        // Handle WebSocket connections
        this.wss.on('connection', (ws: WebSocket) => {
          this.handleConnection(ws);
        });

        // Start HTTP server
        this.server.listen(this.port, () => {
          this.logger.info(`Local farm node ${this.id} started on port ${this.port}`);
          this.emit('started', { id: this.id, port: this.port });
          resolve();
        });

        this.server.on('error', (error) => {
          this.logger.error(`Server error: ${error.message}`);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleConnection(ws: WebSocket): void {
    this.logger.info(`New connection to node ${this.id}`);
    
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(ws, message);
      } catch (error) {
        this.logger.error(`Error handling message: ${error}`);
        ws.send(JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    });

    ws.on('close', () => {
      this.logger.info(`Connection closed to node ${this.id}`);
    });

    ws.on('error', (error) => {
      this.logger.error(`WebSocket error: ${error.message}`);
    });
  }

  private async handleMessage(ws: WebSocket, message: any): Promise<void> {
    // Simulate network latency
    if (this.simulatedLatency > 0) {
      await this.delay(this.simulatedLatency);
    }

    // Simulate random failures
    if (this.simulatedFailureRate > 0 && Math.random() < this.simulatedFailureRate) {
      this.metrics.errorCount++;
      ws.send(JSON.stringify({
        type: 'error',
        requestId: message.requestId,
        error: 'Simulated node failure'
      }));
      return;
    }

    this.metrics.requestCount++;
    const startTime = Date.now();

    switch (message.type) {
      case 'health':
        await this.handleHealthCheck(ws, message);
        break;
      case 'createSession':
        await this.handleCreateSession(ws, message);
        break;
      case 'executeAction':
        await this.handleExecuteAction(ws, message);
        break;
      case 'closeSession':
        await this.handleCloseSession(ws, message);
        break;
      case 'getMetrics':
        await this.handleGetMetrics(ws, message);
        break;
      default:
        ws.send(JSON.stringify({
          type: 'error',
          requestId: message.requestId,
          error: `Unknown message type: ${message.type}`
        }));
    }

    this.metrics.totalLatency += Date.now() - startTime;
  }

  private async handleHealthCheck(ws: WebSocket, message: any): Promise<void> {
    ws.send(JSON.stringify({
      type: 'healthResponse',
      requestId: message.requestId,
      data: {
        nodeId: this.id,
        healthy: this.isHealthy,
        capacity: this.capacity,
        currentLoad: this.sessions.size,
        latency: this.simulatedLatency,
        uptime: Date.now() - this.metrics.startTime.getTime(),
        metrics: {
          requestCount: this.metrics.requestCount,
          errorCount: this.metrics.errorCount,
          averageLatency: this.metrics.requestCount > 0 
            ? this.metrics.totalLatency / this.metrics.requestCount 
            : 0
        }
      }
    }));
  }

  private async handleCreateSession(ws: WebSocket, message: any): Promise<void> {
    try {
      if (this.sessions.size >= this.capacity) {
        throw new Error('Node at capacity');
      }

      const browser = new PlayClone({ headless: true });
      const sessionId = `${this.id}-session-${Date.now()}`;
      
      this.sessions.set(sessionId, browser);
      
      ws.send(JSON.stringify({
        type: 'sessionCreated',
        requestId: message.requestId,
        data: {
          sessionId,
          nodeId: this.id
        }
      }));

      this.emit('sessionCreated', { sessionId, nodeId: this.id });
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        requestId: message.requestId,
        error: error instanceof Error ? error.message : 'Failed to create session'
      }));
    }
  }

  private async handleExecuteAction(ws: WebSocket, message: any): Promise<void> {
    try {
      const { sessionId, action, params } = message.data;
      const browser = this.sessions.get(sessionId);
      
      if (!browser) {
        throw new Error(`Session ${sessionId} not found`);
      }

      let result: any;
      
      // Execute the action
      switch (action) {
        case 'navigate':
          result = await browser.navigate(params.url);
          break;
        case 'click':
          result = await browser.click(params.selector);
          break;
        case 'fill':
          result = await browser.fill(params.selector, params.value);
          break;
        case 'getText':
          result = await browser.getText(params.selector);
          break;
        case 'screenshot':
          result = await browser.screenshot(params.options);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      ws.send(JSON.stringify({
        type: 'actionExecuted',
        requestId: message.requestId,
        data: result
      }));

    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        requestId: message.requestId,
        error: error instanceof Error ? error.message : 'Action execution failed'
      }));
    }
  }

  private async handleCloseSession(ws: WebSocket, message: any): Promise<void> {
    try {
      const { sessionId } = message.data;
      const browser = this.sessions.get(sessionId);
      
      if (browser) {
        await browser.close();
        this.sessions.delete(sessionId);
      }

      ws.send(JSON.stringify({
        type: 'sessionClosed',
        requestId: message.requestId,
        data: { sessionId }
      }));

      this.emit('sessionClosed', { sessionId, nodeId: this.id });
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        requestId: message.requestId,
        error: error instanceof Error ? error.message : 'Failed to close session'
      }));
    }
  }

  private async handleGetMetrics(ws: WebSocket, message: any): Promise<void> {
    ws.send(JSON.stringify({
      type: 'metricsResponse',
      requestId: message.requestId,
      data: {
        nodeId: this.id,
        region: this.region,
        sessions: this.sessions.size,
        capacity: this.capacity,
        utilization: (this.sessions.size / this.capacity) * 100,
        metrics: this.metrics
      }
    }));
  }

  async stop(): Promise<void> {
    // Close all sessions
    for (const [sessionId, browser] of this.sessions) {
      await browser.close();
    }
    this.sessions.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Close HTTP server
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info(`Local farm node ${this.id} stopped`);
          this.emit('stopped', { id: this.id });
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  simulateFailure(): void {
    this.isHealthy = false;
    this.emit('failure', { id: this.id });
  }

  simulateRecovery(): void {
    this.isHealthy = true;
    this.emit('recovery', { id: this.id });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getMetrics() {
    return {
      id: this.id,
      region: this.region,
      port: this.port,
      sessions: this.sessions.size,
      capacity: this.capacity,
      healthy: this.isHealthy,
      metrics: this.metrics
    };
  }
}

export class LocalBrowserFarmTester extends EventEmitter {
  private nodes: Map<string, LocalFarmNode> = new Map();
  private config: LocalTestConfig;
  private distributedFarm: DistributedBrowserFarm | null = null;
  private logger: Logger;
  private networkSimulator: NetworkSimulator | null = null;

  constructor(config: LocalTestConfig) {
    super();
    this.config = {
      basePort: 9000,
      simulateNetworkConditions: false,
      autoStart: true,
      verbose: false,
      ...config
    };
    this.logger = new Logger('LocalFarmTester');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing local browser farm tester...');
    
    // Create local nodes
    for (const nodeConfig of this.config.nodes) {
      const node = new LocalFarmNode({
        ...nodeConfig,
        port: nodeConfig.port || this.config.basePort! + this.nodes.size
      });

      // Forward node events
      node.on('started', (data) => this.emit('nodeStarted', data));
      node.on('stopped', (data) => this.emit('nodeStopped', data));
      node.on('sessionCreated', (data) => this.emit('sessionCreated', data));
      node.on('sessionClosed', (data) => this.emit('sessionClosed', data));

      this.nodes.set(nodeConfig.id, node);
    }

    // Initialize network simulator if enabled
    if (this.config.simulateNetworkConditions) {
      this.networkSimulator = new NetworkSimulator();
    }

    if (this.config.autoStart) {
      await this.startAllNodes();
    }

    this.logger.info('Local browser farm tester initialized');
  }

  async startAllNodes(): Promise<void> {
    this.logger.info('Starting all local nodes...');
    
    const startPromises = Array.from(this.nodes.values()).map(node => node.start());
    await Promise.all(startPromises);
    
    this.logger.info(`Started ${this.nodes.size} local nodes`);
    this.emit('allNodesStarted', { count: this.nodes.size });
  }

  async stopAllNodes(): Promise<void> {
    this.logger.info('Stopping all local nodes...');
    
    const stopPromises = Array.from(this.nodes.values()).map(node => node.stop());
    await Promise.all(stopPromises);
    
    this.logger.info('All local nodes stopped');
    this.emit('allNodesStopped');
  }

  async createDistributedFarm(): Promise<DistributedBrowserFarm> {
    // Generate configuration for distributed farm
    const farmConfig = {
      nodes: Array.from(this.nodes.values()).map(node => {
        const metrics = node.getMetrics();
        return {
          id: metrics.id,
          region: metrics.region,
          endpoint: `ws://localhost:${metrics.port}`,
          capacity: metrics.capacity
        };
      }),
      loadBalancing: 'least-connections' as const,
      healthCheckInterval: 5000,
      sessionAffinity: true
    };

    this.distributedFarm = new DistributedBrowserFarm(farmConfig);
    await this.distributedFarm.start();
    
    this.logger.info('Created distributed farm with local nodes');
    return this.distributedFarm;
  }

  async simulateNodeFailure(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    node.simulateFailure();
    this.logger.info(`Simulated failure for node ${nodeId}`);
    this.emit('nodeFailureSimulated', { nodeId });
  }

  async simulateNodeRecovery(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    node.simulateRecovery();
    this.logger.info(`Simulated recovery for node ${nodeId}`);
    this.emit('nodeRecoverySimulated', { nodeId });
  }

  async simulateHighLoad(duration: number = 30000): Promise<void> {
    this.logger.info(`Simulating high load for ${duration}ms...`);
    
    const startTime = Date.now();
    const sessions: string[] = [];
    
    // Create many sessions rapidly
    while (Date.now() - startTime < duration) {
      if (this.distributedFarm) {
        try {
          const sessionId = await this.distributedFarm.createSession({
            userId: `load-test-${Date.now()}`,
            metadata: { test: true }
          });
          sessions.push(sessionId);
          
          // Execute some actions
          await this.distributedFarm.executeAction(sessionId, 'navigate', {
            url: 'https://example.com'
          });
        } catch (error) {
          this.logger.warn(`Session creation failed during load test: ${error}`);
        }
      }
      
      // Small delay between session creations
      await this.delay(100);
    }

    // Clean up sessions
    for (const sessionId of sessions) {
      if (this.distributedFarm) {
        await this.distributedFarm.closeSession(sessionId);
      }
    }

    this.logger.info(`High load simulation completed. Created ${sessions.length} sessions`);
    this.emit('highLoadCompleted', { sessionCount: sessions.length });
  }

  async runChaosTest(options: {
    duration?: number;
    failureRate?: number;
    recoveryDelay?: number;
  } = {}): Promise<any> {
    const {
      duration = 60000,
      failureRate = 0.3,
      recoveryDelay = 5000
    } = options;

    this.logger.info('Starting chaos test...');
    
    const results = {
      totalFailures: 0,
      totalRecoveries: 0,
      sessionsMigrated: 0,
      errors: 0,
      startTime: Date.now(),
      endTime: 0
    };

    const nodeIds = Array.from(this.nodes.keys());
    const chaosInterval = setInterval(async () => {
      // Randomly fail a node
      if (Math.random() < failureRate) {
        const nodeId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
        await this.simulateNodeFailure(nodeId);
        results.totalFailures++;

        // Schedule recovery
        setTimeout(async () => {
          await this.simulateNodeRecovery(nodeId);
          results.totalRecoveries++;
        }, recoveryDelay);
      }
    }, 2000);

    // Run for specified duration
    await this.delay(duration);
    clearInterval(chaosInterval);

    results.endTime = Date.now();
    
    this.logger.info('Chaos test completed', results);
    this.emit('chaosTestCompleted', results);
    
    return results;
  }

  getMetrics(): any {
    const nodeMetrics = Array.from(this.nodes.values()).map(node => node.getMetrics());
    
    const totalCapacity = nodeMetrics.reduce((sum, m) => sum + m.capacity, 0);
    const totalSessions = nodeMetrics.reduce((sum, m) => sum + m.sessions, 0);
    const healthyNodes = nodeMetrics.filter(m => m.healthy).length;

    return {
      nodes: nodeMetrics,
      summary: {
        totalNodes: this.nodes.size,
        healthyNodes,
        totalCapacity,
        totalSessions,
        utilization: totalCapacity > 0 ? (totalSessions / totalCapacity) * 100 : 0
      }
    };
  }

  async cleanup(): Promise<void> {
    if (this.distributedFarm) {
      await this.distributedFarm.stop();
    }
    await this.stopAllNodes();
    this.nodes.clear();
    this.logger.info('Cleanup completed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class NetworkSimulator {
  private conditions: Map<string, SimulatedNetworkConditions> = new Map();

  constructor() {
    // Default network conditions for different scenarios
    this.conditions.set('fast', {
      latency: { min: 10, max: 30 },
      packetLoss: 0,
      bandwidth: 100000000, // 100 Mbps
      jitter: 5
    });

    this.conditions.set('normal', {
      latency: { min: 30, max: 100 },
      packetLoss: 0.01,
      bandwidth: 10000000, // 10 Mbps
      jitter: 20
    });

    this.conditions.set('slow', {
      latency: { min: 100, max: 500 },
      packetLoss: 0.05,
      bandwidth: 1000000, // 1 Mbps
      jitter: 50
    });

    this.conditions.set('unreliable', {
      latency: { min: 200, max: 2000 },
      packetLoss: 0.15,
      bandwidth: 500000, // 500 Kbps
      jitter: 200
    });
  }

  getCondition(name: string): SimulatedNetworkConditions | undefined {
    return this.conditions.get(name);
  }

  simulateLatency(condition: SimulatedNetworkConditions): number {
    const { min, max } = condition.latency;
    const baseLatency = min + Math.random() * (max - min);
    const jitter = (Math.random() - 0.5) * 2 * condition.jitter;
    return Math.max(0, baseLatency + jitter);
  }

  shouldDropPacket(condition: SimulatedNetworkConditions): boolean {
    return Math.random() < condition.packetLoss;
  }
}

// Export for use in tests
export { LocalFarmNode, NetworkSimulator, LocalNodeConfig, LocalTestConfig };