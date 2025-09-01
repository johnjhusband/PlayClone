import { EventEmitter } from 'events';
import * as os from 'os';
import * as process from 'process';

export interface MetricData {
  timestamp: number;
  value: number;
  label?: string;
}

export interface PerformanceMetrics {
  browsers: {
    active: number;
    total: number;
    launched: number;
    closed: number;
    crashed: number;
  };
  operations: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    avgDuration: number;
  };
  resources: {
    cpu: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    heap: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  network: {
    requests: number;
    bytesReceived: number;
    bytesSent: number;
    avgLatency: number;
  };
  errors: {
    total: number;
    byType: Map<string, number>;
    recentErrors: Array<{
      timestamp: number;
      type: string;
      message: string;
    }>;
  };
}

export interface OperationMetric {
  id: string;
  type: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private operations: Map<string, OperationMetric>;
  private history: Map<string, MetricData[]>;
  private historySize: number;
  private updateInterval: NodeJS.Timeout | null;
  private startTime: number;

  constructor(historySize: number = 1000) {
    super();
    this.historySize = historySize;
    this.operations = new Map();
    this.history = new Map();
    this.updateInterval = null;
    this.startTime = Date.now();
    
    this.metrics = {
      browsers: {
        active: 0,
        total: 0,
        launched: 0,
        closed: 0,
        crashed: 0
      },
      operations: {
        total: 0,
        successful: 0,
        failed: 0,
        pending: 0,
        avgDuration: 0
      },
      resources: {
        cpu: 0,
        memory: {
          used: 0,
          total: 0,
          percentage: 0
        },
        heap: {
          used: 0,
          total: 0,
          percentage: 0
        }
      },
      network: {
        requests: 0,
        bytesReceived: 0,
        bytesSent: 0,
        avgLatency: 0
      },
      errors: {
        total: 0,
        byType: new Map(),
        recentErrors: []
      }
    };

    this.initializeHistory();
  }

  private initializeHistory(): void {
    const metrics = [
      'browsers.active',
      'operations.pending',
      'resources.cpu',
      'resources.memory.percentage',
      'operations.avgDuration',
      'network.avgLatency'
    ];

    metrics.forEach(metric => {
      this.history.set(metric, []);
    });
  }

  public startMonitoring(intervalMs: number = 1000): void {
    if (this.updateInterval) {
      this.stopMonitoring();
    }

    this.updateInterval = setInterval(() => {
      this.updateResourceMetrics();
      this.calculateOperationMetrics();
      this.updateHistory();
      this.emit('metrics', this.getMetrics());
    }, intervalMs);
  }

  public stopMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private updateResourceMetrics(): void {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    this.metrics.resources.memory = {
      used: usedMem,
      total: totalMem,
      percentage: (usedMem / totalMem) * 100
    };

    this.metrics.resources.heap = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };

    const cpuUsage = process.cpuUsage();
    const totalCpu = cpuUsage.user + cpuUsage.system;
    this.metrics.resources.cpu = totalCpu / 1000000; // Convert to seconds
  }

  private calculateOperationMetrics(): void {
    let totalDuration = 0;
    let completedCount = 0;
    let pendingCount = 0;

    this.operations.forEach(op => {
      if (op.endTime) {
        totalDuration += op.duration || 0;
        completedCount++;
      } else {
        pendingCount++;
      }
    });

    this.metrics.operations.pending = pendingCount;
    this.metrics.operations.avgDuration = 
      completedCount > 0 ? totalDuration / completedCount : 0;
  }

  private updateHistory(): void {
    const timestamp = Date.now();

    this.addToHistory('browsers.active', this.metrics.browsers.active, timestamp);
    this.addToHistory('operations.pending', this.metrics.operations.pending, timestamp);
    this.addToHistory('resources.cpu', this.metrics.resources.cpu, timestamp);
    this.addToHistory('resources.memory.percentage', this.metrics.resources.memory.percentage, timestamp);
    this.addToHistory('operations.avgDuration', this.metrics.operations.avgDuration, timestamp);
    this.addToHistory('network.avgLatency', this.metrics.network.avgLatency, timestamp);
  }

  private addToHistory(metric: string, value: number, timestamp: number): void {
    const history = this.history.get(metric) || [];
    history.push({ timestamp, value });

    if (history.length > this.historySize) {
      history.shift();
    }

    this.history.set(metric, history);
  }

  public recordBrowserLaunch(): void {
    this.metrics.browsers.launched++;
    this.metrics.browsers.total++;
    this.metrics.browsers.active++;
    this.emit('browser:launched', { count: this.metrics.browsers.active });
  }

  public recordBrowserClose(): void {
    this.metrics.browsers.closed++;
    this.metrics.browsers.active = Math.max(0, this.metrics.browsers.active - 1);
    this.emit('browser:closed', { count: this.metrics.browsers.active });
  }

  public recordBrowserCrash(): void {
    this.metrics.browsers.crashed++;
    this.metrics.browsers.active = Math.max(0, this.metrics.browsers.active - 1);
    this.emit('browser:crashed', { count: this.metrics.browsers.crashed });
  }

  public startOperation(id: string, type: string, metadata?: Record<string, any>): void {
    const operation: OperationMetric = {
      id,
      type,
      startTime: Date.now(),
      metadata
    };

    this.operations.set(id, operation);
    this.metrics.operations.total++;
    this.emit('operation:started', operation);
  }

  public endOperation(id: string, success: boolean, error?: string): void {
    const operation = this.operations.get(id);
    if (!operation) return;

    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.success = success;
    operation.error = error;

    if (success) {
      this.metrics.operations.successful++;
    } else {
      this.metrics.operations.failed++;
      if (error) {
        this.recordError('operation', error);
      }
    }

    this.emit('operation:ended', operation);
  }

  public recordNetworkRequest(bytesReceived: number, bytesSent: number, latency: number): void {
    this.metrics.network.requests++;
    this.metrics.network.bytesReceived += bytesReceived;
    this.metrics.network.bytesSent += bytesSent;

    const totalLatency = this.metrics.network.avgLatency * (this.metrics.network.requests - 1) + latency;
    this.metrics.network.avgLatency = totalLatency / this.metrics.network.requests;
  }

  public recordError(type: string, message: string): void {
    this.metrics.errors.total++;
    
    const errorCount = this.metrics.errors.byType.get(type) || 0;
    this.metrics.errors.byType.set(type, errorCount + 1);

    this.metrics.errors.recentErrors.push({
      timestamp: Date.now(),
      type,
      message
    });

    if (this.metrics.errors.recentErrors.length > 100) {
      this.metrics.errors.recentErrors.shift();
    }

    this.emit('error:recorded', { type, message });
  }

  public getMetrics(): PerformanceMetrics {
    return JSON.parse(JSON.stringify(this.metrics));
  }

  public getHistory(metric: string): MetricData[] {
    return this.history.get(metric) || [];
  }

  public getAllHistory(): Map<string, MetricData[]> {
    return new Map(this.history);
  }

  public getUptime(): number {
    return Date.now() - this.startTime;
  }

  public reset(): void {
    this.operations.clear();
    this.history.clear();
    this.initializeHistory();
    
    Object.keys(this.metrics.browsers).forEach(key => {
      (this.metrics.browsers as any)[key] = 0;
    });
    
    Object.keys(this.metrics.operations).forEach(key => {
      (this.metrics.operations as any)[key] = 0;
    });
    
    this.metrics.errors.total = 0;
    this.metrics.errors.byType.clear();
    this.metrics.errors.recentErrors = [];
    
    this.startTime = Date.now();
  }

  public generateReport(): string {
    const uptime = this.getUptime();
    const metrics = this.getMetrics();
    
    return `
Performance Report
==================
Uptime: ${this.formatDuration(uptime)}

Browsers:
  Active: ${metrics.browsers.active}
  Total Launched: ${metrics.browsers.launched}
  Closed: ${metrics.browsers.closed}
  Crashed: ${metrics.browsers.crashed}

Operations:
  Total: ${metrics.operations.total}
  Successful: ${metrics.operations.successful} (${this.getPercentage(metrics.operations.successful, metrics.operations.total)}%)
  Failed: ${metrics.operations.failed} (${this.getPercentage(metrics.operations.failed, metrics.operations.total)}%)
  Pending: ${metrics.operations.pending}
  Avg Duration: ${metrics.operations.avgDuration.toFixed(2)}ms

Resources:
  CPU Time: ${metrics.resources.cpu.toFixed(2)}s
  Memory: ${this.formatBytes(metrics.resources.memory.used)} / ${this.formatBytes(metrics.resources.memory.total)} (${metrics.resources.memory.percentage.toFixed(2)}%)
  Heap: ${this.formatBytes(metrics.resources.heap.used)} / ${this.formatBytes(metrics.resources.heap.total)} (${metrics.resources.heap.percentage.toFixed(2)}%)

Network:
  Requests: ${metrics.network.requests}
  Downloaded: ${this.formatBytes(metrics.network.bytesReceived)}
  Uploaded: ${this.formatBytes(metrics.network.bytesSent)}
  Avg Latency: ${metrics.network.avgLatency.toFixed(2)}ms

Errors:
  Total: ${metrics.errors.total}
  By Type: ${Array.from(metrics.errors.byType.entries()).map(([type, count]) => `${type}: ${count}`).join(', ')}
    `.trim();
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  private getPercentage(value: number, total: number): string {
    if (total === 0) return '0.00';
    return ((value / total) * 100).toFixed(2);
  }
}