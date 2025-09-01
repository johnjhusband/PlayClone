import { EventEmitter } from 'events';

export interface QueuedRequest {
  id: string;
  type: string;
  priority: number;
  payload: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  result?: any;
  callback?: (result: any, error?: Error) => void;
}

export interface QueueConfig {
  maxConcurrent: number;
  maxQueueSize: number;
  defaultPriority: number;
  processingTimeout: number;
  retryDelay: number;
  enablePriorityQueue: boolean;
}

export class RequestQueue extends EventEmitter {
  private queue: QueuedRequest[] = [];
  private processing: Map<string, QueuedRequest> = new Map();
  private config: QueueConfig;
  private processHandler: ((request: QueuedRequest) => Promise<any>) | null = null;
  private isRunning: boolean = false;
  private processInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<QueueConfig>) {
    super();
    this.config = {
      maxConcurrent: 5,
      maxQueueSize: 1000,
      defaultPriority: 5,
      processingTimeout: 30000,
      retryDelay: 1000,
      enablePriorityQueue: true,
      ...config
    };
  }

  /**
   * Set the handler function for processing requests
   */
  public setProcessHandler(handler: (request: QueuedRequest) => Promise<any>): void {
    this.processHandler = handler;
  }

  /**
   * Add a request to the queue
   */
  public enqueue(
    id: string,
    type: string,
    payload: any,
    options?: {
      priority?: number;
      maxRetries?: number;
      callback?: (result: any, error?: Error) => void;
    }
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= this.config.maxQueueSize) {
        const error = new Error(`Queue is full (max: ${this.config.maxQueueSize})`);
        this.emit('queue:full', { id, type, error });
        reject(error);
        return;
      }

      const request: QueuedRequest = {
        id,
        type,
        priority: options?.priority || this.config.defaultPriority,
        payload,
        timestamp: Date.now(),
        retries: 0,
        maxRetries: options?.maxRetries || 3,
        status: 'pending',
        callback: (result, error) => {
          if (options?.callback) {
            options.callback(result, error);
          }
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      };

      this.queue.push(request);
      
      if (this.config.enablePriorityQueue) {
        this.queue.sort((a, b) => b.priority - a.priority);
      }

      this.emit('request:enqueued', request);
      
      if (this.isRunning) {
        this.processNext();
      }
    });
  }

  /**
   * Start processing the queue
   */
  public start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emit('queue:started');
    
    // Process queue at regular intervals
    this.processInterval = setInterval(() => {
      this.processNext();
    }, 100);
    
    // Process immediately
    this.processNext();
  }

  /**
   * Stop processing the queue
   */
  public stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    
    this.emit('queue:stopped');
  }

  /**
   * Process the next request in the queue
   */
  private async processNext(): Promise<void> {
    if (!this.isRunning || !this.processHandler) return;
    
    // Check if we can process more requests
    if (this.processing.size >= this.config.maxConcurrent) return;
    
    // Get next request from queue
    const request = this.queue.shift();
    if (!request) return;
    
    // Mark as processing
    request.status = 'processing';
    this.processing.set(request.id, request);
    this.emit('request:processing', request);
    
    // Set up timeout
    const timeout = setTimeout(() => {
      this.handleTimeout(request);
    }, this.config.processingTimeout);
    
    try {
      // Process the request
      const result = await this.processHandler(request);
      
      clearTimeout(timeout);
      
      // Mark as completed
      request.status = 'completed';
      request.result = result;
      this.processing.delete(request.id);
      
      this.emit('request:completed', request);
      
      if (request.callback) {
        request.callback(result);
      }
    } catch (error) {
      clearTimeout(timeout);
      
      // Handle error
      this.handleError(request, error as Error);
    }
    
    // Process next request
    this.processNext();
  }

  /**
   * Handle request timeout
   */
  private handleTimeout(request: QueuedRequest): void {
    request.error = 'Request timed out';
    this.handleError(request, new Error(request.error));
  }

  /**
   * Handle request error
   */
  private handleError(request: QueuedRequest, error: Error): void {
    request.retries++;
    request.error = error.message;
    
    if (request.retries < request.maxRetries) {
      // Retry the request
      request.status = 'pending';
      this.processing.delete(request.id);
      
      // Re-queue with delay
      setTimeout(() => {
        this.queue.unshift(request);
        this.emit('request:retry', request);
        this.processNext();
      }, this.config.retryDelay * request.retries);
    } else {
      // Mark as failed
      request.status = 'failed';
      this.processing.delete(request.id);
      
      this.emit('request:failed', request);
      
      if (request.callback) {
        request.callback(null, error);
      }
    }
  }

  /**
   * Get queue statistics
   */
  public getStats(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalProcessed: number;
  } {
    const pending = this.queue.filter(r => r.status === 'pending').length;
    const processing = this.processing.size;
    
    return {
      pending,
      processing,
      completed: 0, // Would need to track this separately
      failed: 0, // Would need to track this separately
      totalProcessed: 0 // Would need to track this separately
    };
  }

  /**
   * Clear the queue
   */
  public clear(): void {
    this.queue = [];
    this.emit('queue:cleared');
  }

  /**
   * Get queue size
   */
  public size(): number {
    return this.queue.length;
  }

  /**
   * Get processing count
   */
  public processingCount(): number {
    return this.processing.size;
  }

  /**
   * Remove a specific request from the queue
   */
  public remove(id: string): boolean {
    const index = this.queue.findIndex(r => r.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.emit('request:removed', { id });
      return true;
    }
    return false;
  }

  /**
   * Get request by ID
   */
  public getRequest(id: string): QueuedRequest | undefined {
    return this.queue.find(r => r.id === id) || this.processing.get(id);
  }

  /**
   * Update request priority
   */
  public updatePriority(id: string, priority: number): boolean {
    const request = this.queue.find(r => r.id === id);
    if (request) {
      request.priority = priority;
      if (this.config.enablePriorityQueue) {
        this.queue.sort((a, b) => b.priority - a.priority);
      }
      this.emit('request:priorityUpdated', { id, priority });
      return true;
    }
    return false;
  }
}