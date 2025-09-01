import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { Logger } from '../utils/Logger';

// Redis client types (will be dynamically imported if available)
type RedisClient = any;

export interface SessionData {
  id: string;
  nodeId: string;
  contextState: {
    cookies: any[];
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    viewport?: { width: number; height: number };
    userAgent?: string;
  };
  pages: Array<{
    id: string;
    url: string;
    title: string;
    html?: string;
  }>;
  metadata: Record<string, any>;
  createdAt: Date;
  lastAccessed: Date;
  expiresAt?: Date;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix: string;
  ttl: number; // Session TTL in seconds
  enableCompression: boolean;
  enableEncryption: boolean;
  encryptionKey?: string;
  maxRetries: number;
  retryDelay: number;
}

export class RedisSessionStore extends EventEmitter {
  private client?: RedisClient;
  private pubClient?: RedisClient;
  private subClient?: RedisClient;
  private logger: Logger;
  private config: RedisConfig;
  private connected: boolean = false;
  private subscriptions: Map<string, Set<(data: any) => void>> = new Map();
  
  constructor(config: Partial<RedisConfig> = {}) {
    super();
    this.logger = new Logger('RedisSessionStore');
    
    this.config = {
      host: 'localhost',
      port: 6379,
      keyPrefix: 'playclone:session:',
      ttl: 3600, // 1 hour default
      enableCompression: true,
      enableEncryption: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
    
    if (this.config.enableEncryption && !this.config.encryptionKey) {
      this.config.encryptionKey = crypto.randomBytes(32).toString('hex');
      this.logger.warn('Generated random encryption key. Set explicit key for production.');
    }
  }
  
  public async connect(): Promise<void> {
    try {
      // Try to import redis if available
      const redis = await this.tryImportRedis();
      if (!redis) {
        this.logger.warn('Redis client not available. Using in-memory fallback.');
        this.useInMemoryFallback();
        return;
      }
      
      // Create Redis clients
      this.client = redis.createClient({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        retry_strategy: (options: any) => {
          if (options.attempt > this.config.maxRetries) {
            return new Error('Max retries reached');
          }
          return this.config.retryDelay;
        }
      });
      
      // Create pub/sub clients for real-time sync
      this.pubClient = this.client.duplicate();
      this.subClient = this.client.duplicate();
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Wait for connection
      await this.waitForConnection();
      
      this.connected = true;
      this.logger.info('Connected to Redis session store');
      this.emit('connected');
      
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      this.useInMemoryFallback();
    }
  }
  
  private async tryImportRedis(): Promise<any> {
    try {
      // Dynamic import for optional Redis support
      // @ts-ignore - Redis is an optional dependency
      const redis = await import('redis').catch(() => null);
      return redis;
    } catch {
      return null;
    }
  }
  
  private useInMemoryFallback(): void {
    // Use in-memory Map as fallback
    this.logger.info('Using in-memory session store (Redis not available)');
    const memoryStore = new Map<string, string>();
    
    // Mock Redis client interface
    this.client = {
      get: (key: string, callback: (err: any, value: string | null) => void) => {
        callback(null, memoryStore.get(key) || null);
      },
      set: (key: string, value: string, callback?: (err: any) => void) => {
        memoryStore.set(key, value);
        if (callback) callback(null);
      },
      setex: (key: string, ttl: number, value: string, callback?: (err: any) => void) => {
        memoryStore.set(key, value);
        // Simple TTL implementation
        setTimeout(() => memoryStore.delete(key), ttl * 1000);
        if (callback) callback(null);
      },
      del: (key: string, callback?: (err: any) => void) => {
        memoryStore.delete(key);
        if (callback) callback(null);
      },
      keys: (pattern: string, callback: (err: any, keys: string[]) => void) => {
        const regex = new RegExp(pattern.replace('*', '.*'));
        const keys = Array.from(memoryStore.keys()).filter(k => regex.test(k));
        callback(null, keys);
      },
      expire: (key: string, ttl: number, callback?: (err: any) => void) => {
        setTimeout(() => memoryStore.delete(key), ttl * 1000);
        if (callback) callback(null);
      },
      quit: (callback?: () => void) => {
        if (callback) callback();
      }
    };
    
    // Mock pub/sub clients
    this.pubClient = { publish: () => {} };
    this.subClient = { 
      subscribe: () => {},
      on: () => {}
    };
    
    this.connected = true;
  }
  
  private setupEventHandlers(): void {
    if (!this.client || !this.subClient) return;
    
    this.client.on('error', (error: any) => {
      this.logger.error('Redis client error:', error);
      this.emit('error', error);
    });
    
    this.client.on('ready', () => {
      this.logger.info('Redis client ready');
      this.emit('ready');
    });
    
    this.client.on('reconnecting', () => {
      this.logger.info('Reconnecting to Redis...');
      this.emit('reconnecting');
    });
    
    // Set up pub/sub message handling
    this.subClient.on('message', (channel: string, message: string) => {
      this.handlePubSubMessage(channel, message);
    });
  }
  
  private async waitForConnection(): Promise<void> {
    if (!this.client) return;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 10000);
      
      const checkConnection = () => {
        this.client.ping((err: any) => {
          if (!err) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(checkConnection, 100);
          }
        });
      };
      
      checkConnection();
    });
  }
  
  public async saveSession(sessionData: SessionData): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not connected');
    }
    
    const key = this.getSessionKey(sessionData.id);
    let data = JSON.stringify(sessionData);
    
    // Compress data if enabled
    if (this.config.enableCompression) {
      data = await this.compress(data);
    }
    
    // Encrypt data if enabled
    if (this.config.enableEncryption) {
      data = this.encrypt(data);
    }
    
    // Save to Redis with TTL
    await this.setWithRetry(key, data, this.config.ttl);
    
    // Publish update event
    this.publishUpdate('session:saved', sessionData.id);
    
    this.logger.debug(`Saved session ${sessionData.id} to Redis`);
    this.emit('session:saved', sessionData.id);
  }
  
  public async getSession(sessionId: string): Promise<SessionData | null> {
    if (!this.client) {
      throw new Error('Redis client not connected');
    }
    
    const key = this.getSessionKey(sessionId);
    const data = await this.getWithRetry(key);
    
    if (!data) {
      return null;
    }
    
    let decryptedData = data;
    
    // Decrypt if needed
    if (this.config.enableEncryption) {
      decryptedData = this.decrypt(data);
    }
    
    // Decompress if needed
    if (this.config.enableCompression) {
      decryptedData = await this.decompress(decryptedData);
    }
    
    const sessionData = JSON.parse(decryptedData);
    
    // Update last accessed time and extend TTL
    sessionData.lastAccessed = new Date();
    await this.extendTTL(sessionId);
    
    this.logger.debug(`Retrieved session ${sessionId} from Redis`);
    return sessionData;
  }
  
  public async deleteSession(sessionId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not connected');
    }
    
    const key = this.getSessionKey(sessionId);
    await this.deleteWithRetry(key);
    
    // Publish delete event
    this.publishUpdate('session:deleted', sessionId);
    
    this.logger.debug(`Deleted session ${sessionId} from Redis`);
    this.emit('session:deleted', sessionId);
  }
  
  public async getAllSessions(): Promise<SessionData[]> {
    if (!this.client) {
      throw new Error('Redis client not connected');
    }
    
    return new Promise((resolve, reject) => {
      this.client.keys(`${this.config.keyPrefix}*`, async (err: any, keys: string[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const sessions: SessionData[] = [];
        for (const key of keys) {
          const sessionId = key.replace(this.config.keyPrefix, '');
          const session = await this.getSession(sessionId);
          if (session) {
            sessions.push(session);
          }
        }
        
        resolve(sessions);
      });
    });
  }
  
  public async updateSessionField(
    sessionId: string, 
    field: keyof SessionData, 
    value: any
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    (session as any)[field] = value;
    session.lastAccessed = new Date();
    
    await this.saveSession(session);
    
    // Publish field update event
    this.publishUpdate('session:field-updated', { sessionId, field, value });
  }
  
  public async extendTTL(sessionId: string): Promise<void> {
    if (!this.client) return;
    
    const key = this.getSessionKey(sessionId);
    
    return new Promise((resolve, reject) => {
      this.client.expire(key, this.config.ttl, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  private async setWithRetry(key: string, value: string, ttl: number): Promise<void> {
    let attempts = 0;
    
    while (attempts < this.config.maxRetries) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.client.setex(key, ttl, value, (err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
        return;
      } catch (error) {
        attempts++;
        if (attempts >= this.config.maxRetries) {
          throw error;
        }
        await this.delay(this.config.retryDelay * attempts);
      }
    }
  }
  
  private async getWithRetry(key: string): Promise<string | null> {
    let attempts = 0;
    
    while (attempts < this.config.maxRetries) {
      try {
        return await new Promise<string | null>((resolve, reject) => {
          this.client.get(key, (err: any, value: string | null) => {
            if (err) reject(err);
            else resolve(value);
          });
        });
      } catch (error) {
        attempts++;
        if (attempts >= this.config.maxRetries) {
          throw error;
        }
        await this.delay(this.config.retryDelay * attempts);
      }
    }
    
    return null;
  }
  
  private async deleteWithRetry(key: string): Promise<void> {
    let attempts = 0;
    
    while (attempts < this.config.maxRetries) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.client.del(key, (err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
        return;
      } catch (error) {
        attempts++;
        if (attempts >= this.config.maxRetries) {
          throw error;
        }
        await this.delay(this.config.retryDelay * attempts);
      }
    }
  }
  
  private getSessionKey(sessionId: string): string {
    return `${this.config.keyPrefix}${sessionId}`;
  }
  
  private async compress(data: string): Promise<string> {
    try {
      const zlib = await import('zlib');
      return new Promise((resolve, reject) => {
        zlib.gzip(Buffer.from(data), (err, compressed) => {
          if (err) reject(err);
          else resolve(compressed.toString('base64'));
        });
      });
    } catch {
      // Return uncompressed if zlib not available
      return data;
    }
  }
  
  private async decompress(data: string): Promise<string> {
    try {
      const zlib = await import('zlib');
      return new Promise((resolve, reject) => {
        zlib.gunzip(Buffer.from(data, 'base64'), (err, decompressed) => {
          if (err) reject(err);
          else resolve(decompressed.toString());
        });
      });
    } catch {
      // Return as-is if zlib not available
      return data;
    }
  }
  
  private encrypt(data: string): string {
    if (!this.config.encryptionKey) {
      return data;
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(this.config.encryptionKey, 'hex'),
      iv
    );
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }
  
  private decrypt(data: string): string {
    if (!this.config.encryptionKey) {
      return data;
    }
    
    const parts = data.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(this.config.encryptionKey, 'hex'),
      iv
    );
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  private publishUpdate(event: string, data: any): void {
    if (!this.pubClient) return;
    
    const channel = `${this.config.keyPrefix}updates`;
    const message = JSON.stringify({ event, data, timestamp: new Date() });
    
    this.pubClient.publish(channel, message);
  }
  
  private handlePubSubMessage(channel: string, message: string): void {
    try {
      const { event, data } = JSON.parse(message);
      
      // Notify subscribers
      const handlers = this.subscriptions.get(event);
      if (handlers) {
        handlers.forEach(handler => handler(data));
      }
      
      // Emit local event
      this.emit(`remote:${event}`, data);
    } catch (error) {
      this.logger.error('Error handling pub/sub message:', error);
    }
  }
  
  public subscribe(event: string, handler: (data: any) => void): void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
      
      // Subscribe to Redis channel if connected
      if (this.subClient) {
        const channel = `${this.config.keyPrefix}updates`;
        this.subClient.subscribe(channel);
      }
    }
    
    this.subscriptions.get(event)!.add(handler);
  }
  
  public unsubscribe(event: string, handler: (data: any) => void): void {
    const handlers = this.subscriptions.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(event);
      }
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  public async disconnect(): Promise<void> {
    if (this.client) {
      await new Promise<void>((resolve) => {
        this.client.quit(() => resolve());
      });
    }
    
    if (this.pubClient) {
      this.pubClient.quit();
    }
    
    if (this.subClient) {
      this.subClient.quit();
    }
    
    this.connected = false;
    this.logger.info('Disconnected from Redis session store');
    this.emit('disconnected');
  }
  
  public isConnected(): boolean {
    return this.connected;
  }
}