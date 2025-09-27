import { EventEmitter } from 'events';
import { PlayClone } from '../index';
import { BrowserFarm } from './BrowserFarm';
import { Logger } from '../utils/Logger';

// WebSocket type definition for browser/node compatibility
interface WebSocketLike {
  readyState: number;
  OPEN: number;
  close(): void;
  send(data: string): void;
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
}

interface FarmNode {
  id: string;
  region: string;
  endpoint: string;
  capacity: number;
  currentLoad: number;
  latency: number;
  healthy: boolean;
  lastHealthCheck: Date;
  sessions: Map<string, string>;
  weight: number;
  failureCount: number;
  successCount: number;
  averageResponseTime: number;
}

interface DistributedSession {
  id: string;
  nodeId: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
}

interface LoadBalancingStrategy {
  name: string;
  selectNode(nodes: FarmNode[], sessionAffinity?: string): FarmNode | null;
}

interface HealthCheckResult {
  nodeId: string;
  healthy: boolean;
  latency: number;
  capacity: number;
  currentLoad: number;
  error?: string;
}

interface DistributedConfig {
  nodes: Array<{
    id: string;
    region: string;
    endpoint: string;
    capacity: number;
    weight?: number;
  }>;
  loadBalancing?: 'round-robin' | 'least-connections' | 'weighted' | 'latency-based' | 'geo-based';
  healthCheckInterval?: number;
  sessionAffinity?: boolean;
  failoverThreshold?: number;
  maxRetries?: number;
  timeout?: number;
  replicationFactor?: number;
  autoScale?: boolean;
  maxNodesPerRegion?: number;
  minNodesPerRegion?: number;
}

export class DistributedBrowserFarm extends EventEmitter {
  private nodes: Map<string, FarmNode>;
  private sessions: Map<string, DistributedSession>;
  private loadBalancer: LoadBalancingStrategy;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private config: DistributedConfig;
  private logger: Logger;
  private roundRobinIndex: number = 0;
  private sessionAffinityMap: Map<string, string>;
  private replicationNodes: Map<string, Set<string>>;
  private metricsHistory: Map<string, Array<{ timestamp: Date; metrics: any }>>;
  
  constructor(config: DistributedConfig) {
    super();
    this.config = {
      loadBalancing: 'least-connections',
      healthCheckInterval: 30000,
      sessionAffinity: true,
      failoverThreshold: 3,
      maxRetries: 3,
      timeout: 30000,
      replicationFactor: 2,
      autoScale: false,
      maxNodesPerRegion: 10,
      minNodesPerRegion: 1,
      ...config
    };
    
    this.nodes = new Map();
    this.sessions = new Map();
    this.sessionAffinityMap = new Map();
    this.replicationNodes = new Map();
    this.metricsHistory = new Map();
    this.logger = new Logger('DistributedBrowserFarm');
    
    this.loadBalancer = this.createLoadBalancer(this.config.loadBalancing || 'least-connections');
    this.initializeNodes();
  }
  
  private initializeNodes(): void {
    for (const nodeConfig of this.config.nodes) {
      const node: FarmNode = {
        id: nodeConfig.id,
        region: nodeConfig.region,
        endpoint: nodeConfig.endpoint,
        capacity: nodeConfig.capacity,
        currentLoad: 0,
        latency: 0,
        healthy: true,
        lastHealthCheck: new Date(),
        sessions: new Map(),
        weight: nodeConfig.weight || 1,
        failureCount: 0,
        successCount: 0,
        averageResponseTime: 0
      };
      
      this.nodes.set(node.id, node);
      this.metricsHistory.set(node.id, []);
    }
    
    this.setupReplication();
  }
  
  private createLoadBalancer(strategy: string): LoadBalancingStrategy {
    switch (strategy) {
      case 'round-robin':
        return {
          name: 'round-robin',
          selectNode: (nodes: FarmNode[]) => {
            const healthyNodes = nodes.filter(n => n.healthy);
            if (healthyNodes.length === 0) return null;
            const node = healthyNodes[this.roundRobinIndex % healthyNodes.length];
            this.roundRobinIndex++;
            return node;
          }
        };
        
      case 'least-connections':
        return {
          name: 'least-connections',
          selectNode: (nodes: FarmNode[]) => {
            const healthyNodes = nodes.filter(n => n.healthy);
            if (healthyNodes.length === 0) return null;
            return healthyNodes.reduce((min, node) => 
              (node.currentLoad / node.capacity) < (min.currentLoad / min.capacity) ? node : min
            );
          }
        };
        
      case 'weighted':
        return {
          name: 'weighted',
          selectNode: (nodes: FarmNode[]) => {
            const healthyNodes = nodes.filter(n => n.healthy);
            if (healthyNodes.length === 0) return null;
            
            const totalWeight = healthyNodes.reduce((sum, n) => sum + n.weight, 0);
            let random = Math.random() * totalWeight;
            
            for (const node of healthyNodes) {
              random -= node.weight;
              if (random <= 0) return node;
            }
            
            return healthyNodes[0];
          }
        };
        
      case 'latency-based':
        return {
          name: 'latency-based',
          selectNode: (nodes: FarmNode[]) => {
            const healthyNodes = nodes.filter(n => n.healthy);
            if (healthyNodes.length === 0) return null;
            return healthyNodes.reduce((min, node) => 
              node.latency < min.latency ? node : min
            );
          }
        };
        
      case 'geo-based':
        return {
          name: 'geo-based',
          selectNode: (nodes: FarmNode[], sessionAffinity?: string) => {
            const healthyNodes = nodes.filter(n => n.healthy);
            if (healthyNodes.length === 0) return null;
            
            // Simple geo-based: prefer nodes in the same region
            if (sessionAffinity) {
              const preferredRegion = this.getPreferredRegion(sessionAffinity);
              const regionalNodes = healthyNodes.filter(n => n.region === preferredRegion);
              if (regionalNodes.length > 0) {
                return regionalNodes[0];
              }
            }
            
            return healthyNodes[0];
          }
        };
        
      default:
        return this.createLoadBalancer('least-connections');
    }
  }
  
  private setupReplication(): void {
    if (this.config.replicationFactor && this.config.replicationFactor > 1) {
      const nodeArray = Array.from(this.nodes.values());
      
      for (const node of nodeArray) {
        const replicas = new Set<string>();
        const otherNodes = nodeArray.filter(n => n.id !== node.id);
        
        for (let i = 0; i < Math.min(this.config.replicationFactor - 1, otherNodes.length); i++) {
          replicas.add(otherNodes[i].id);
        }
        
        this.replicationNodes.set(node.id, replicas);
      }
    }
  }
  
  public async start(): Promise<void> {
    this.logger.info('Starting distributed browser farm');
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    // Initialize connections to all nodes
    await this.connectToNodes();
    
    // Start auto-scaling if enabled
    if (this.config.autoScale) {
      this.startAutoScaling();
    }
    
    this.emit('started');
  }
  
  public async stop(): Promise<void> {
    this.logger.info('Stopping distributed browser farm');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Close all sessions
    for (const session of this.sessions.values()) {
      await this.closeSession(session.id);
    }
    
    this.emit('stopped');
  }
  
  private async connectToNodes(): Promise<void> {
    const connectionPromises = Array.from(this.nodes.values()).map(async (node) => {
      try {
        await this.connectToNode(node);
        this.logger.info(`Connected to node ${node.id} in ${node.region}`);
      } catch (error) {
        this.logger.error(`Failed to connect to node ${node.id}:`, error);
        node.healthy = false;
        node.failureCount++;
      }
    });
    
    await Promise.allSettled(connectionPromises);
  }
  
  private async connectToNode(node: FarmNode): Promise<void> {
    return new Promise((resolve, reject) => {
      // Simulated WebSocket connection for demo
      // In real implementation, would use actual WebSocket library
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout for node ${node.id}`));
      }, this.config.timeout || 30000);
      
      // Simulate connection success
      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, Math.random() * 100 + 50);
    });
  }
  
  private startHealthMonitoring(): void {
    const interval = this.config.healthCheckInterval || 30000;
    
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, interval);
    
    // Perform initial health check
    this.performHealthChecks();
  }
  
  private async performHealthChecks(): Promise<void> {
    const checks = Array.from(this.nodes.values()).map(async (node) => {
      const result = await this.checkNodeHealth(node);
      this.processHealthCheckResult(node, result);
      return result;
    });
    
    const results = await Promise.allSettled(checks);
    
    // Check for failed nodes and trigger failover if needed
    const failedNodes = Array.from(this.nodes.values()).filter(n => !n.healthy);
    if (failedNodes.length > 0) {
      await this.handleFailedNodes(failedNodes);
    }
    
    this.emit('healthCheck', results);
  }
  
  private async checkNodeHealth(node: FarmNode): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simulate health check (in real implementation, would ping the actual endpoint)
      const response = await this.pingNode(node);
      
      const latency = Date.now() - startTime;
      
      return {
        nodeId: node.id,
        healthy: true,
        latency,
        capacity: node.capacity,
        currentLoad: node.currentLoad
      };
    } catch (error) {
      return {
        nodeId: node.id,
        healthy: false,
        latency: -1,
        capacity: node.capacity,
        currentLoad: node.currentLoad,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private async pingNode(node: FarmNode): Promise<any> {
    // Simulate ping (in real implementation, would send actual health check request)
    return new Promise((resolve, reject) => {
      const timeout = Math.random() * 100 + 50; // 50-150ms simulated latency
      
      setTimeout(() => {
        if (Math.random() > 0.95) { // 5% failure rate for simulation
          reject(new Error('Node unreachable'));
        } else {
          resolve({ status: 'healthy', load: node.currentLoad });
        }
      }, timeout);
    });
  }
  
  private processHealthCheckResult(node: FarmNode, result: HealthCheckResult): void {
    node.lastHealthCheck = new Date();
    
    if (result.healthy) {
      node.healthy = true;
      node.latency = result.latency;
      node.failureCount = 0;
      node.successCount++;
      
      // Update average response time
      const history = this.metricsHistory.get(node.id) || [];
      history.push({
        timestamp: new Date(),
        metrics: { latency: result.latency, load: result.currentLoad }
      });
      
      // Keep only last 100 metrics
      if (history.length > 100) {
        history.shift();
      }
      
      const avgLatency = history.reduce((sum, h) => sum + h.metrics.latency, 0) / history.length;
      node.averageResponseTime = avgLatency;
      
    } else {
      node.failureCount++;
      
      if (node.failureCount >= (this.config.failoverThreshold || 3)) {
        node.healthy = false;
        this.logger.warn(`Node ${node.id} marked as unhealthy after ${node.failureCount} failures`);
      }
    }
  }
  
  private async handleFailedNodes(failedNodes: FarmNode[]): Promise<void> {
    for (const node of failedNodes) {
      this.logger.warn(`Handling failed node ${node.id}`);
      
      // Migrate sessions from failed node
      const sessions = Array.from(node.sessions.values());
      for (const sessionId of sessions) {
        await this.migrateSession(sessionId, node.id);
      }
      
      // Try to recover the node
      setTimeout(() => {
        this.attemptNodeRecovery(node);
      }, 60000); // Try recovery after 1 minute
    }
  }
  
  private async attemptNodeRecovery(node: FarmNode): Promise<void> {
    try {
      await this.connectToNode(node);
      node.healthy = true;
      node.failureCount = 0;
      this.logger.info(`Node ${node.id} recovered successfully`);
    } catch (error) {
      this.logger.error(`Failed to recover node ${node.id}:`, error);
    }
  }
  
  private async migrateSession(sessionId: string, fromNodeId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Find a healthy node to migrate to
    const targetNode = this.selectNode(session.userId);
    if (!targetNode) {
      this.logger.error(`No healthy nodes available for session migration`);
      return;
    }
    
    this.logger.info(`Migrating session ${sessionId} from ${fromNodeId} to ${targetNode.id}`);
    
    // Update session mapping
    session.nodeId = targetNode.id;
    
    // Update node session tracking
    const fromNode = this.nodes.get(fromNodeId);
    if (fromNode) {
      fromNode.sessions.delete(sessionId);
      fromNode.currentLoad--;
    }
    
    targetNode.sessions.set(sessionId, sessionId);
    targetNode.currentLoad++;
    
    this.emit('sessionMigrated', { sessionId, fromNodeId, toNodeId: targetNode.id });
  }
  
  private selectNode(userId?: string): FarmNode | null {
    const nodeArray = Array.from(this.nodes.values());
    
    // Check session affinity
    if (this.config.sessionAffinity && userId) {
      const affinityNodeId = this.sessionAffinityMap.get(userId);
      if (affinityNodeId) {
        const affinityNode = this.nodes.get(affinityNodeId);
        if (affinityNode && affinityNode.healthy && affinityNode.currentLoad < affinityNode.capacity) {
          return affinityNode;
        }
      }
    }
    
    // Use load balancing strategy
    const selectedNode = this.loadBalancer.selectNode(nodeArray, userId);
    
    // Update session affinity
    if (selectedNode && userId && this.config.sessionAffinity) {
      this.sessionAffinityMap.set(userId, selectedNode.id);
    }
    
    return selectedNode;
  }
  
  public async createSession(options?: any): Promise<string> {
    const node = this.selectNode(options?.userId);
    
    if (!node) {
      throw new Error('No healthy nodes available');
    }
    
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: DistributedSession = {
      id: sessionId,
      nodeId: node.id,
      userId: options?.userId,
      startTime: new Date(),
      lastActivity: new Date(),
      metadata: options?.metadata || {}
    };
    
    this.sessions.set(sessionId, session);
    node.sessions.set(sessionId, sessionId);
    node.currentLoad++;
    
    // Replicate session to backup nodes
    if (this.config.replicationFactor && this.config.replicationFactor > 1) {
      await this.replicateSession(session);
    }
    
    this.logger.info(`Created session ${sessionId} on node ${node.id}`);
    this.emit('sessionCreated', { sessionId, nodeId: node.id });
    
    return sessionId;
  }
  
  private async replicateSession(session: DistributedSession): Promise<void> {
    const replicas = this.replicationNodes.get(session.nodeId);
    if (!replicas) return;
    
    for (const replicaNodeId of replicas) {
      const replicaNode = this.nodes.get(replicaNodeId);
      if (replicaNode && replicaNode.healthy) {
        // In real implementation, would send session data to replica
        this.logger.debug(`Replicated session ${session.id} to node ${replicaNodeId}`);
      }
    }
  }
  
  public async executeAction(sessionId: string, action: string, params?: any): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const node = this.nodes.get(session.nodeId);
    if (!node || !node.healthy) {
      // Try to migrate session to healthy node
      await this.migrateSession(sessionId, session.nodeId);
      const newSession = this.sessions.get(sessionId);
      if (!newSession) {
        throw new Error('Failed to migrate session');
      }
      session.nodeId = newSession.nodeId;
    }
    
    session.lastActivity = new Date();
    
    // In real implementation, would forward request to the appropriate node
    this.logger.debug(`Executing action ${action} on session ${sessionId} (node ${session.nodeId})`);
    
    return {
      success: true,
      nodeId: session.nodeId,
      action,
      params
    };
  }
  
  public async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const node = this.nodes.get(session.nodeId);
    if (node) {
      node.sessions.delete(sessionId);
      node.currentLoad--;
    }
    
    this.sessions.delete(sessionId);
    
    // Clean up session affinity
    if (session.userId) {
      this.sessionAffinityMap.delete(session.userId);
    }
    
    this.logger.info(`Closed session ${sessionId}`);
    this.emit('sessionClosed', { sessionId, nodeId: session.nodeId });
  }
  
  private startAutoScaling(): void {
    setInterval(() => {
      this.evaluateAutoScaling();
    }, 60000); // Check every minute
  }
  
  private async evaluateAutoScaling(): Promise<void> {
    const regionLoads = new Map<string, { total: number; capacity: number; nodes: number }>();
    
    // Calculate load per region
    for (const node of this.nodes.values()) {
      const current = regionLoads.get(node.region) || { total: 0, capacity: 0, nodes: 0 };
      current.total += node.currentLoad;
      current.capacity += node.capacity;
      current.nodes++;
      regionLoads.set(node.region, current);
    }
    
    // Check if scaling is needed
    for (const [region, load] of regionLoads.entries()) {
      const utilizationRate = load.total / load.capacity;
      
      if (utilizationRate > 0.8 && load.nodes < (this.config.maxNodesPerRegion || 10)) {
        // Scale up
        await this.scaleUp(region);
      } else if (utilizationRate < 0.2 && load.nodes > (this.config.minNodesPerRegion || 1)) {
        // Scale down
        await this.scaleDown(region);
      }
    }
  }
  
  private async scaleUp(region: string): Promise<void> {
    this.logger.info(`Scaling up in region ${region}`);
    
    // In real implementation, would provision new node
    const newNode: FarmNode = {
      id: `node-${region}-${Date.now()}`,
      region,
      endpoint: `ws://farm-${region}.example.com`,
      capacity: 10,
      currentLoad: 0,
      latency: 0,
      healthy: true,
      lastHealthCheck: new Date(),
      sessions: new Map(),
      weight: 1,
      failureCount: 0,
      successCount: 0,
      averageResponseTime: 0
    };
    
    this.nodes.set(newNode.id, newNode);
    await this.connectToNode(newNode);
    
    this.emit('nodeAdded', { nodeId: newNode.id, region });
  }
  
  private async scaleDown(region: string): Promise<void> {
    this.logger.info(`Scaling down in region ${region}`);
    
    // Find least loaded node in region
    const regionalNodes = Array.from(this.nodes.values())
      .filter(n => n.region === region)
      .sort((a, b) => a.currentLoad - b.currentLoad);
    
    if (regionalNodes.length <= (this.config.minNodesPerRegion || 1)) {
      return; // Don't scale below minimum
    }
    
    const nodeToRemove = regionalNodes[0];
    
    // Migrate sessions from node
    const sessions = Array.from(nodeToRemove.sessions.values());
    for (const sessionId of sessions) {
      await this.migrateSession(sessionId, nodeToRemove.id);
    }
    
    // Remove node
    this.nodes.delete(nodeToRemove.id);
    
    this.emit('nodeRemoved', { nodeId: nodeToRemove.id, region });
  }
  
  private getPreferredRegion(identifier: string): string {
    // Simple hash-based region selection
    const regions = Array.from(new Set(Array.from(this.nodes.values()).map(n => n.region)));
    const hash = identifier.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return regions[hash % regions.length];
  }
  
  public getMetrics(): any {
    const metrics = {
      totalNodes: this.nodes.size,
      healthyNodes: Array.from(this.nodes.values()).filter(n => n.healthy).length,
      totalSessions: this.sessions.size,
      nodeMetrics: Array.from(this.nodes.values()).map(node => ({
        id: node.id,
        region: node.region,
        healthy: node.healthy,
        utilization: node.capacity > 0 ? (node.currentLoad / node.capacity) * 100 : 0,
        currentLoad: node.currentLoad,
        capacity: node.capacity,
        latency: node.latency,
        averageResponseTime: node.averageResponseTime,
        successRate: node.successCount > 0 ? 
          (node.successCount / (node.successCount + node.failureCount)) * 100 : 0
      })),
      regionMetrics: this.getRegionMetrics(),
      loadBalancingStrategy: this.loadBalancer.name
    };
    
    return metrics;
  }
  
  private getRegionMetrics(): any[] {
    const regionMap = new Map<string, any>();
    
    for (const node of this.nodes.values()) {
      const current = regionMap.get(node.region) || {
        region: node.region,
        nodes: 0,
        healthyNodes: 0,
        totalCapacity: 0,
        totalLoad: 0,
        averageLatency: 0
      };
      
      current.nodes++;
      if (node.healthy) current.healthyNodes++;
      current.totalCapacity += node.capacity;
      current.totalLoad += node.currentLoad;
      current.averageLatency = (current.averageLatency * (current.nodes - 1) + node.latency) / current.nodes;
      
      regionMap.set(node.region, current);
    }
    
    return Array.from(regionMap.values()).map(region => ({
      ...region,
      utilization: region.totalCapacity > 0 ? (region.totalLoad / region.totalCapacity) * 100 : 0
    }));
  }
  
  public async performChaosTest(): Promise<any> {
    this.logger.warn('Starting chaos test - randomly failing nodes');
    
    const results = {
      nodesFailedBefore: 0,
      sessionsMigratedBefore: 0,
      nodesFailedDuring: 0,
      sessionsMigratedDuring: 0,
      recoveryTime: 0,
      successfulRecoveries: 0
    };
    
    const startTime = Date.now();
    
    // Randomly fail 30% of nodes
    const nodesToFail = Array.from(this.nodes.values())
      .filter(n => n.healthy)
      .slice(0, Math.ceil(this.nodes.size * 0.3));
    
    results.nodesFailedBefore = nodesToFail.length;
    results.sessionsMigratedBefore = nodesToFail.reduce((sum, n) => sum + n.sessions.size, 0);
    
    for (const node of nodesToFail) {
      node.healthy = false;
      node.failureCount = this.config.failoverThreshold || 3;
      await this.handleFailedNodes([node]);
    }
    
    // Wait for recovery attempts
    await new Promise(resolve => setTimeout(resolve, 65000));
    
    results.recoveryTime = Date.now() - startTime;
    results.successfulRecoveries = nodesToFail.filter(n => n.healthy).length;
    
    this.logger.warn('Chaos test completed', results);
    return results;
  }
}

export class DistributedBrowserFarmClient {
  private farmEndpoint: string;
  private sessionId: string | null = null;
  private connected: boolean = false;
  
  constructor(farmEndpoint: string) {
    this.farmEndpoint = farmEndpoint;
  }
  
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Simulated connection for demo
      // In real implementation, would use actual WebSocket
      setTimeout(() => {
        this.connected = true;
        resolve();
      }, 100);
    });
  }
  
  public async createSession(options?: any): Promise<string> {
    const response = await this.sendRequest('createSession', options);
    this.sessionId = response.sessionId;
    return this.sessionId as string;
  }
  
  public async executeAction(action: string, params?: any): Promise<any> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }
    
    return this.sendRequest('executeAction', {
      sessionId: this.sessionId,
      action,
      params
    });
  }
  
  private sendRequest(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to farm'));
        return;
      }
      
      // Simulated request/response for demo
      setTimeout(() => {
        if (method === 'createSession') {
          resolve({
            sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          });
        } else {
          resolve({
            success: true,
            result: params
          });
        }
      }, 50);
    });
  }
  
  public async disconnect(): Promise<void> {
    if (this.sessionId) {
      await this.sendRequest('closeSession', { sessionId: this.sessionId });
    }
    
    this.connected = false;
  }
}