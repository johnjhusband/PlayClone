import { EventEmitter } from 'events';
import { Browser, Page, BrowserContext } from 'playwright-core';
import { BrowserManager } from '../core/BrowserManager';
import { Logger } from '../utils/Logger';
import { ConfigManager } from '../config/ConfigManager';
import * as crypto from 'crypto';

export interface ClusterNode {
  id: string;
  hostname: string;
  port: number;
  status: 'active' | 'inactive' | 'draining';
  sessions: Set<string>;
  capacity: number;
  load: number;
  lastHeartbeat: Date;
  metadata?: Record<string, any>;
}

export interface SessionInfo {
  id: string;
  nodeId: string;
  browser: Browser;
  context: BrowserContext;
  pages: Map<string, Page>;
  createdAt: Date;
  lastAccessed: Date;
  metadata?: Record<string, any>;
}

export interface ClusterConfig {
  nodes: ClusterNode[];
  replicationFactor: number;
  sessionTimeout: number;
  heartbeatInterval: number;
  loadBalancingStrategy: 'round-robin' | 'least-connections' | 'weighted' | 'consistent-hash';
  maxSessionsPerNode: number;
  enableAutoScaling: boolean;
  minNodes: number;
  maxNodes: number;
}

export class SessionCluster extends EventEmitter {
  private nodes: Map<string, ClusterNode> = new Map();
  private sessions: Map<string, SessionInfo> = new Map();
  private browserManager: BrowserManager;
  private logger: Logger;
  private config: ClusterConfig;
  private currentNodeIndex: number = 0;
  private heartbeatTimer?: NodeJS.Timeout;
  private sessionHashRing: Map<number, string> = new Map();
  
  constructor(config: Partial<ClusterConfig> = {}) {
    super();
    this.browserManager = new BrowserManager();
    this.logger = new Logger('SessionCluster');
    
    this.config = {
      nodes: [],
      replicationFactor: 2,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      heartbeatInterval: 5000, // 5 seconds
      loadBalancingStrategy: 'least-connections',
      maxSessionsPerNode: 50,
      enableAutoScaling: false,
      minNodes: 1,
      maxNodes: 10,
      ...config
    };
    
    this.initializeCluster();
  }
  
  private initializeCluster(): void {
    this.logger.info('Initializing browser session cluster');
    
    // Initialize nodes from config
    for (const nodeConfig of this.config.nodes) {
      this.addNode(nodeConfig);
    }
    
    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();
    
    // Initialize consistent hash ring if needed
    if (this.config.loadBalancingStrategy === 'consistent-hash') {
      this.initializeHashRing();
    }
    
    this.emit('cluster:initialized', { nodeCount: this.nodes.size });
  }
  
  private initializeHashRing(): void {
    const virtualNodesPerNode = 150; // Virtual nodes for better distribution
    
    this.nodes.forEach((node) => {
      for (let i = 0; i < virtualNodesPerNode; i++) {
        const hash = this.hashString(`${node.id}:${i}`);
        this.sessionHashRing.set(hash, node.id);
      }
    });
    
    // Sort the hash ring
    this.sessionHashRing = new Map(
      [...this.sessionHashRing.entries()].sort((a, b) => a[0] - b[0])
    );
  }
  
  private hashString(str: string): number {
    const hash = crypto.createHash('md5').update(str).digest();
    return hash.readUInt32BE(0);
  }
  
  public async addNode(nodeConfig: Partial<ClusterNode>): Promise<ClusterNode> {
    const node: ClusterNode = {
      id: nodeConfig.id || crypto.randomUUID(),
      hostname: nodeConfig.hostname || 'localhost',
      port: nodeConfig.port || 3000 + this.nodes.size,
      status: 'active',
      sessions: new Set(),
      capacity: nodeConfig.capacity || this.config.maxSessionsPerNode,
      load: 0,
      lastHeartbeat: new Date(),
      metadata: nodeConfig.metadata
    };
    
    this.nodes.set(node.id, node);
    this.logger.info(`Added node ${node.id} to cluster`, { node });
    
    // Rebalance sessions if needed
    if (this.config.enableAutoScaling) {
      await this.rebalanceSessions();
    }
    
    // Update hash ring if using consistent hashing
    if (this.config.loadBalancingStrategy === 'consistent-hash') {
      this.initializeHashRing();
    }
    
    this.emit('node:added', node);
    return node;
  }
  
  public async removeNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    
    // Mark node as draining
    node.status = 'draining';
    this.logger.info(`Draining node ${nodeId}`);
    
    // Migrate sessions to other nodes
    const sessionsToMigrate = Array.from(node.sessions);
    for (const sessionId of sessionsToMigrate) {
      await this.migrateSession(sessionId, nodeId);
    }
    
    // Remove node from cluster
    this.nodes.delete(nodeId);
    this.logger.info(`Removed node ${nodeId} from cluster`);
    
    // Update hash ring if using consistent hashing
    if (this.config.loadBalancingStrategy === 'consistent-hash') {
      this.initializeHashRing();
    }
    
    this.emit('node:removed', { nodeId });
  }
  
  public async createSession(metadata?: Record<string, any>): Promise<SessionInfo> {
    const node = this.selectNode(metadata?.sessionKey);
    if (!node) {
      throw new Error('No available nodes in cluster');
    }
    
    const sessionId = crypto.randomUUID();
    const launchResult = await this.browserManager.launch();
    
    const browser = this.browserManager.getBrowser();
    if (!launchResult.success || !browser) {
      throw new Error('Failed to launch browser');
    }
    const context = await browser.newContext({
      viewport: metadata?.viewport,
      userAgent: metadata?.userAgent
    });
    
    const session: SessionInfo = {
      id: sessionId,
      nodeId: node.id,
      browser,
      context,
      pages: new Map(),
      createdAt: new Date(),
      lastAccessed: new Date(),
      metadata
    };
    
    this.sessions.set(sessionId, session);
    node.sessions.add(sessionId);
    node.load = node.sessions.size / node.capacity;
    
    this.logger.info(`Created session ${sessionId} on node ${node.id}`);
    this.emit('session:created', { sessionId, nodeId: node.id });
    
    // Set up session timeout
    this.scheduleSessionTimeout(sessionId);
    
    // Replicate session if replication factor > 1
    if (this.config.replicationFactor > 1) {
      await this.replicateSession(session);
    }
    
    return session;
  }
  
  private selectNode(sessionKey?: string): ClusterNode | null {
    const activeNodes = Array.from(this.nodes.values()).filter(
      node => node.status === 'active' && node.sessions.size < node.capacity
    );
    
    if (activeNodes.length === 0) {
      if (this.config.enableAutoScaling) {
        this.scaleUp();
      }
      return null;
    }
    
    switch (this.config.loadBalancingStrategy) {
      case 'round-robin':
        return this.selectRoundRobin(activeNodes);
        
      case 'least-connections':
        return this.selectLeastConnections(activeNodes);
        
      case 'weighted':
        return this.selectWeighted(activeNodes);
        
      case 'consistent-hash':
        return this.selectConsistentHash(sessionKey || crypto.randomUUID());
        
      default:
        return activeNodes[0];
    }
  }
  
  private selectRoundRobin(nodes: ClusterNode[]): ClusterNode {
    const node = nodes[this.currentNodeIndex % nodes.length];
    this.currentNodeIndex++;
    return node;
  }
  
  private selectLeastConnections(nodes: ClusterNode[]): ClusterNode {
    return nodes.reduce((min, node) => 
      node.sessions.size < min.sessions.size ? node : min
    );
  }
  
  private selectWeighted(nodes: ClusterNode[]): ClusterNode {
    // Select based on capacity and current load
    const weights = nodes.map(node => ({
      node,
      weight: node.capacity * (1 - node.load)
    }));
    
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    const random = Math.random() * totalWeight;
    
    let accumulator = 0;
    for (const { node, weight } of weights) {
      accumulator += weight;
      if (random <= accumulator) {
        return node;
      }
    }
    
    return nodes[0];
  }
  
  private selectConsistentHash(key: string): ClusterNode | null {
    const hash = this.hashString(key);
    const entries = Array.from(this.sessionHashRing.entries());
    
    // Find the first node with hash >= key hash
    for (const [nodeHash, nodeId] of entries) {
      if (nodeHash >= hash) {
        const node = this.nodes.get(nodeId);
        if (node && node.status === 'active') {
          return node;
        }
      }
    }
    
    // Wrap around to the first node
    const firstNodeId = entries[0]?.[1];
    return firstNodeId ? this.nodes.get(firstNodeId) || null : null;
  }
  
  public async getSession(sessionId: string): Promise<SessionInfo | null> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessed = new Date();
      this.scheduleSessionTimeout(sessionId);
    }
    return session || null;
  }
  
  public async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    
    try {
      await session.context.close();
      await session.browser.close();
    } catch (error) {
      this.logger.error(`Error closing session ${sessionId}:`, error);
    }
    
    this.sessions.delete(sessionId);
    const node = this.nodes.get(session.nodeId);
    if (node) {
      node.sessions.delete(sessionId);
      node.load = node.sessions.size / node.capacity;
    }
    
    this.logger.info(`Closed session ${sessionId}`);
    this.emit('session:closed', { sessionId });
  }
  
  private async migrateSession(sessionId: string, fromNodeId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    
    // Select a new node for the session
    const newNode = this.selectNode();
    if (!newNode || newNode.id === fromNodeId) {
      this.logger.warn(`Cannot migrate session ${sessionId}, no suitable node found`);
      return;
    }
    
    // Update session's node assignment
    session.nodeId = newNode.id;
    
    // Update node session lists
    const oldNode = this.nodes.get(fromNodeId);
    if (oldNode) {
      oldNode.sessions.delete(sessionId);
      oldNode.load = oldNode.sessions.size / oldNode.capacity;
    }
    
    newNode.sessions.add(sessionId);
    newNode.load = newNode.sessions.size / newNode.capacity;
    
    this.logger.info(`Migrated session ${sessionId} from ${fromNodeId} to ${newNode.id}`);
    this.emit('session:migrated', { sessionId, fromNodeId, toNodeId: newNode.id });
  }
  
  private async rebalanceSessions(): Promise<void> {
    this.logger.info('Rebalancing sessions across cluster');
    
    const activeNodes = Array.from(this.nodes.values()).filter(
      node => node.status === 'active'
    );
    
    if (activeNodes.length < 2) {
      return;
    }
    
    // Calculate ideal distribution
    const totalSessions = this.sessions.size;
    const idealSessionsPerNode = Math.ceil(totalSessions / activeNodes.length);
    
    // Find overloaded and underloaded nodes
    const overloaded = activeNodes.filter(node => node.sessions.size > idealSessionsPerNode);
    const underloaded = activeNodes.filter(node => node.sessions.size < idealSessionsPerNode);
    
    // Migrate sessions from overloaded to underloaded nodes
    for (const fromNode of overloaded) {
      const sessionsToMigrate = fromNode.sessions.size - idealSessionsPerNode;
      const sessionIds = Array.from(fromNode.sessions).slice(0, sessionsToMigrate);
      
      for (const sessionId of sessionIds) {
        const toNode = underloaded.find(node => node.sessions.size < idealSessionsPerNode);
        if (toNode) {
          await this.migrateSession(sessionId, fromNode.id);
        }
      }
    }
    
    this.emit('cluster:rebalanced', { nodeCount: activeNodes.length, sessionCount: totalSessions });
  }
  
  private async replicateSession(session: SessionInfo): Promise<void> {
    // Select backup nodes for replication
    const backupNodes = this.selectBackupNodes(session.nodeId, this.config.replicationFactor - 1);
    
    for (const node of backupNodes) {
      // Store session reference on backup node
      node.sessions.add(`${session.id}:replica`);
      this.logger.debug(`Replicated session ${session.id} to node ${node.id}`);
    }
    
    this.emit('session:replicated', { 
      sessionId: session.id, 
      primaryNode: session.nodeId,
      backupNodes: backupNodes.map(n => n.id)
    });
  }
  
  private selectBackupNodes(excludeNodeId: string, count: number): ClusterNode[] {
    const availableNodes = Array.from(this.nodes.values()).filter(
      node => node.id !== excludeNodeId && node.status === 'active'
    );
    
    // Sort by load and select the least loaded nodes
    availableNodes.sort((a, b) => a.load - b.load);
    return availableNodes.slice(0, count);
  }
  
  private scheduleSessionTimeout(sessionId: string): void {
    // Clear existing timeout if any
    const existingTimeout = (this as any)[`timeout_${sessionId}`];
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set new timeout
    (this as any)[`timeout_${sessionId}`] = setTimeout(() => {
      this.closeSession(sessionId).catch(error => {
        this.logger.error(`Error closing timed out session ${sessionId}:`, error);
      });
    }, this.config.sessionTimeout);
  }
  
  private startHeartbeatMonitoring(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = new Date();
      const deadlineTime = new Date(now.getTime() - this.config.heartbeatInterval * 3);
      
      for (const [nodeId, node] of this.nodes) {
        if (node.lastHeartbeat < deadlineTime && node.status === 'active') {
          this.logger.warn(`Node ${nodeId} missed heartbeat, marking as inactive`);
          node.status = 'inactive';
          this.emit('node:inactive', { nodeId });
          
          // Trigger session migration from inactive node
          this.migrateAllSessions(nodeId);
        }
      }
    }, this.config.heartbeatInterval);
  }
  
  private async migrateAllSessions(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }
    
    const sessionIds = Array.from(node.sessions);
    for (const sessionId of sessionIds) {
      // Skip replica sessions
      if (sessionId.includes(':replica')) {
        continue;
      }
      await this.migrateSession(sessionId, nodeId);
    }
  }
  
  public updateNodeHeartbeat(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.lastHeartbeat = new Date();
      if (node.status === 'inactive') {
        node.status = 'active';
        this.logger.info(`Node ${nodeId} is active again`);
        this.emit('node:active', { nodeId });
      }
    }
  }
  
  private async scaleUp(): Promise<void> {
    if (this.nodes.size >= this.config.maxNodes) {
      this.logger.warn('Cannot scale up, maximum nodes reached');
      return;
    }
    
    const newNode = await this.addNode({
      hostname: 'auto-scaled',
      metadata: { autoScaled: true, createdAt: new Date() }
    });
    
    this.logger.info(`Auto-scaled up, added node ${newNode.id}`);
    this.emit('cluster:scaled-up', { nodeId: newNode.id });
  }
  
  private async scaleDown(): Promise<void> {
    if (this.nodes.size <= this.config.minNodes) {
      return;
    }
    
    // Find auto-scaled nodes with lowest load
    const autoScaledNodes = Array.from(this.nodes.values())
      .filter(node => node.metadata?.autoScaled)
      .sort((a, b) => a.load - b.load);
    
    if (autoScaledNodes.length > 0) {
      const nodeToRemove = autoScaledNodes[0];
      await this.removeNode(nodeToRemove.id);
      this.logger.info(`Auto-scaled down, removed node ${nodeToRemove.id}`);
      this.emit('cluster:scaled-down', { nodeId: nodeToRemove.id });
    }
  }
  
  public getClusterStatus(): {
    nodes: ClusterNode[];
    sessions: number;
    averageLoad: number;
    healthyNodes: number;
  } {
    const nodes = Array.from(this.nodes.values());
    const healthyNodes = nodes.filter(n => n.status === 'active').length;
    const averageLoad = nodes.reduce((sum, n) => sum + n.load, 0) / nodes.length || 0;
    
    return {
      nodes,
      sessions: this.sessions.size,
      averageLoad,
      healthyNodes
    };
  }
  
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down browser session cluster');
    
    // Stop heartbeat monitoring
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    // Close all sessions
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.closeSession(id)));
    
    // Clear nodes
    this.nodes.clear();
    
    this.emit('cluster:shutdown');
  }
}