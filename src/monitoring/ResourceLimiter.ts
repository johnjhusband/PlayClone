import { EventEmitter } from 'events';
import * as os from 'os';
import * as process from 'process';

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxBrowsers: number;
  maxOperationsPerMinute: number;
  maxNetworkMBPerMinute: number;
  maxDiskWriteMBPerMinute: number;
}

export interface ResourceQuota {
  userId?: string;
  limits: ResourceLimits;
  usage: ResourceUsage;
  resetInterval: number; // in milliseconds
  lastReset: number;
}

export interface ResourceUsage {
  memoryMB: number;
  cpuPercent: number;
  browsers: number;
  operations: number;
  networkMB: number;
  diskWriteMB: number;
}

export class ResourceLimiter extends EventEmitter {
  private quotas: Map<string, ResourceQuota> = new Map();
  private globalLimits: ResourceLimits;
  private globalUsage: ResourceUsage;
  private monitorInterval: NodeJS.Timeout | null = null;
  private resetInterval: NodeJS.Timeout | null = null;

  constructor(globalLimits?: Partial<ResourceLimits>) {
    super();
    
    this.globalLimits = {
      maxMemoryMB: 2048,
      maxCpuPercent: 80,
      maxBrowsers: 10,
      maxOperationsPerMinute: 1000,
      maxNetworkMBPerMinute: 100,
      maxDiskWriteMBPerMinute: 50,
      ...globalLimits
    };
    
    this.globalUsage = {
      memoryMB: 0,
      cpuPercent: 0,
      browsers: 0,
      operations: 0,
      networkMB: 0,
      diskWriteMB: 0
    };
  }

  /**
   * Start monitoring resources
   */
  public startMonitoring(intervalMs: number = 5000): void {
    if (this.monitorInterval) {
      this.stopMonitoring();
    }
    
    // Monitor system resources
    this.monitorInterval = setInterval(() => {
      this.updateSystemResources();
      this.checkLimits();
    }, intervalMs);
    
    // Reset counters periodically (every minute)
    this.resetInterval = setInterval(() => {
      this.resetCounters();
    }, 60000);
    
    this.emit('monitoring:started');
  }

  /**
   * Stop monitoring resources
   */
  public stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
      this.resetInterval = null;
    }
    
    this.emit('monitoring:stopped');
  }

  /**
   * Update system resource usage
   */
  private updateSystemResources(): void {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    this.globalUsage.memoryMB = usedMem / (1024 * 1024);
    
    // Simple CPU calculation (would need more sophisticated approach in production)
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    this.globalUsage.cpuPercent = 100 - ~~(100 * idle / total);
  }

  /**
   * Check if an operation is allowed
   */
  public async checkOperation(
    type: string,
    userId?: string,
    resourceRequirements?: Partial<ResourceUsage>
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check global limits
    const globalCheck = this.checkGlobalLimits(resourceRequirements);
    if (!globalCheck.allowed) {
      this.emit('operation:denied', { type, userId, reason: globalCheck.reason });
      return globalCheck;
    }
    
    // Check user quota if userId provided
    if (userId) {
      const userCheck = this.checkUserQuota(userId, resourceRequirements);
      if (!userCheck.allowed) {
        this.emit('operation:denied', { type, userId, reason: userCheck.reason });
        return userCheck;
      }
    }
    
    // Update usage
    if (resourceRequirements) {
      this.updateUsage(userId, resourceRequirements);
    }
    
    this.emit('operation:allowed', { type, userId });
    return { allowed: true };
  }

  /**
   * Check global resource limits
   */
  private checkGlobalLimits(requirements?: Partial<ResourceUsage>): { allowed: boolean; reason?: string } {
    if (!requirements) return { allowed: true };
    
    if (requirements.memoryMB && 
        this.globalUsage.memoryMB + requirements.memoryMB > this.globalLimits.maxMemoryMB) {
      return { allowed: false, reason: 'Global memory limit exceeded' };
    }
    
    if (requirements.browsers && 
        this.globalUsage.browsers + requirements.browsers > this.globalLimits.maxBrowsers) {
      return { allowed: false, reason: 'Global browser limit exceeded' };
    }
    
    if (requirements.operations && 
        this.globalUsage.operations + requirements.operations > this.globalLimits.maxOperationsPerMinute) {
      return { allowed: false, reason: 'Global operations limit exceeded' };
    }
    
    if (requirements.networkMB && 
        this.globalUsage.networkMB + requirements.networkMB > this.globalLimits.maxNetworkMBPerMinute) {
      return { allowed: false, reason: 'Global network bandwidth limit exceeded' };
    }
    
    return { allowed: true };
  }

  /**
   * Check user-specific quota
   */
  private checkUserQuota(userId: string, requirements?: Partial<ResourceUsage>): { allowed: boolean; reason?: string } {
    const quota = this.quotas.get(userId);
    if (!quota || !requirements) return { allowed: true };
    
    if (requirements.memoryMB && 
        quota.usage.memoryMB + requirements.memoryMB > quota.limits.maxMemoryMB) {
      return { allowed: false, reason: 'User memory quota exceeded' };
    }
    
    if (requirements.browsers && 
        quota.usage.browsers + requirements.browsers > quota.limits.maxBrowsers) {
      return { allowed: false, reason: 'User browser quota exceeded' };
    }
    
    if (requirements.operations && 
        quota.usage.operations + requirements.operations > quota.limits.maxOperationsPerMinute) {
      return { allowed: false, reason: 'User operations quota exceeded' };
    }
    
    if (requirements.networkMB && 
        quota.usage.networkMB + requirements.networkMB > quota.limits.maxNetworkMBPerMinute) {
      return { allowed: false, reason: 'User network quota exceeded' };
    }
    
    return { allowed: true };
  }

  /**
   * Update resource usage
   */
  private updateUsage(userId: string | undefined, usage: Partial<ResourceUsage>): void {
    // Update global usage
    if (usage.memoryMB) this.globalUsage.memoryMB += usage.memoryMB;
    if (usage.browsers) this.globalUsage.browsers += usage.browsers;
    if (usage.operations) this.globalUsage.operations += usage.operations;
    if (usage.networkMB) this.globalUsage.networkMB += usage.networkMB;
    if (usage.diskWriteMB) this.globalUsage.diskWriteMB += usage.diskWriteMB;
    
    // Update user quota if applicable
    if (userId) {
      const quota = this.quotas.get(userId);
      if (quota) {
        if (usage.memoryMB) quota.usage.memoryMB += usage.memoryMB;
        if (usage.browsers) quota.usage.browsers += usage.browsers;
        if (usage.operations) quota.usage.operations += usage.operations;
        if (usage.networkMB) quota.usage.networkMB += usage.networkMB;
        if (usage.diskWriteMB) quota.usage.diskWriteMB += usage.diskWriteMB;
      }
    }
  }

  /**
   * Set user quota
   */
  public setUserQuota(userId: string, limits: Partial<ResourceLimits>, resetInterval: number = 3600000): void {
    const quota: ResourceQuota = {
      userId,
      limits: {
        ...this.globalLimits,
        ...limits
      },
      usage: {
        memoryMB: 0,
        cpuPercent: 0,
        browsers: 0,
        operations: 0,
        networkMB: 0,
        diskWriteMB: 0
      },
      resetInterval,
      lastReset: Date.now()
    };
    
    this.quotas.set(userId, quota);
    this.emit('quota:set', { userId, limits });
  }

  /**
   * Remove user quota
   */
  public removeUserQuota(userId: string): boolean {
    const removed = this.quotas.delete(userId);
    if (removed) {
      this.emit('quota:removed', { userId });
    }
    return removed;
  }

  /**
   * Get user quota
   */
  public getUserQuota(userId: string): ResourceQuota | undefined {
    return this.quotas.get(userId);
  }

  /**
   * Reset counters
   */
  private resetCounters(): void {
    // Reset rate-limited counters
    this.globalUsage.operations = 0;
    this.globalUsage.networkMB = 0;
    this.globalUsage.diskWriteMB = 0;
    
    // Reset user quotas based on their reset intervals
    const now = Date.now();
    this.quotas.forEach((quota, userId) => {
      if (now - quota.lastReset >= quota.resetInterval) {
        quota.usage.operations = 0;
        quota.usage.networkMB = 0;
        quota.usage.diskWriteMB = 0;
        quota.lastReset = now;
        this.emit('quota:reset', { userId });
      }
    });
    
    this.emit('counters:reset');
  }

  /**
   * Check resource limits
   */
  private checkLimits(): void {
    // Check global CPU limit
    if (this.globalUsage.cpuPercent > this.globalLimits.maxCpuPercent) {
      this.emit('limit:exceeded', {
        type: 'cpu',
        current: this.globalUsage.cpuPercent,
        limit: this.globalLimits.maxCpuPercent
      });
    }
    
    // Check global memory limit
    if (this.globalUsage.memoryMB > this.globalLimits.maxMemoryMB) {
      this.emit('limit:exceeded', {
        type: 'memory',
        current: this.globalUsage.memoryMB,
        limit: this.globalLimits.maxMemoryMB
      });
    }
  }

  /**
   * Get current global usage
   */
  public getGlobalUsage(): ResourceUsage {
    return { ...this.globalUsage };
  }

  /**
   * Get global limits
   */
  public getGlobalLimits(): ResourceLimits {
    return { ...this.globalLimits };
  }

  /**
   * Update global limits
   */
  public updateGlobalLimits(limits: Partial<ResourceLimits>): void {
    this.globalLimits = {
      ...this.globalLimits,
      ...limits
    };
    this.emit('limits:updated', this.globalLimits);
  }

  /**
   * Record browser launch
   */
  public recordBrowserLaunch(): void {
    this.globalUsage.browsers++;
    this.emit('browser:launched', { count: this.globalUsage.browsers });
  }

  /**
   * Record browser close
   */
  public recordBrowserClose(): void {
    this.globalUsage.browsers = Math.max(0, this.globalUsage.browsers - 1);
    this.emit('browser:closed', { count: this.globalUsage.browsers });
  }

  /**
   * Record operation
   */
  public recordOperation(count: number = 1): void {
    this.globalUsage.operations += count;
  }

  /**
   * Record network usage
   */
  public recordNetworkUsage(megabytes: number): void {
    this.globalUsage.networkMB += megabytes;
  }

  /**
   * Record disk write
   */
  public recordDiskWrite(megabytes: number): void {
    this.globalUsage.diskWriteMB += megabytes;
  }
}