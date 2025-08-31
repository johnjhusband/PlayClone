/**
 * Performance Profiler - Monitor and optimize performance
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';

/**
 * Performance metric
 */
export interface PerformanceMetric {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, any>;
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
  count: number;
  total: number;
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  metrics: Map<string, PerformanceStats>;
  slowOperations: PerformanceMetric[];
  bottlenecks: string[];
  recommendations: string[];
  summary: {
    totalOperations: number;
    totalDuration: number;
    averageDuration: number;
    slowestOperation: string;
    fastestOperation: string;
  };
}

/**
 * Performance thresholds
 */
export interface PerformanceThresholds {
  navigation: number;
  click: number;
  fill: number;
  extract: number;
  screenshot: number;
  default: number;
}

/**
 * Performance Profiler class
 */
export class PerformanceProfiler extends EventEmitter {
  private metrics: Map<string, PerformanceMetric[]>;
  private marks: Map<string, number>;
  private thresholds: PerformanceThresholds;
  private observer?: PerformanceObserver;
  private enabled: boolean;
  private maxMetrics: number;

  constructor(enabled: boolean = true) {
    super();
    
    this.metrics = new Map();
    this.marks = new Map();
    this.enabled = enabled;
    this.maxMetrics = 10000;

    this.thresholds = {
      navigation: 3000,
      click: 500,
      fill: 300,
      extract: 1000,
      screenshot: 2000,
      default: 1000,
    };

    if (this.enabled) {
      this.setupObserver();
    }
  }

  /**
   * Start measuring an operation
   */
  startMeasure(name: string, metadata?: Record<string, any>): string {
    if (!this.enabled) return name;

    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.marks.set(id, performance.now());
    
    if (metadata) {
      this.marks.set(`${id}_metadata`, metadata as any);
    }

    return id;
  }

  /**
   * End measuring an operation
   */
  endMeasure(id: string): PerformanceMetric | null {
    if (!this.enabled) return null;

    const startTime = this.marks.get(id);
    if (!startTime) return null;

    const endTime = performance.now();
    const duration = endTime - startTime;
    const metadata = this.marks.get(`${id}_metadata`) as Record<string, any> | undefined;

    // Clean up marks
    this.marks.delete(id);
    if (metadata) {
      this.marks.delete(`${id}_metadata`);
    }

    // Extract operation name from id
    const name = id.split('_')[0];

    const metric: PerformanceMetric = {
      name,
      duration,
      startTime,
      endTime,
      metadata,
    };

    // Store metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // Limit stored metrics
    if (metrics.length > this.maxMetrics) {
      metrics.shift();
    }

    // Check threshold
    const threshold = this.thresholds[name as keyof PerformanceThresholds] || this.thresholds.default;
    if (duration > threshold) {
      this.emit('slow-operation', metric);
    }

    return metric;
  }

  /**
   * Measure an async operation
   */
  async measure<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const id = this.startMeasure(name, metadata);
    
    try {
      const result = await operation();
      return result;
    } finally {
      this.endMeasure(id);
    }
  }

  /**
   * Measure a sync operation
   */
  measureSync<T>(
    name: string,
    operation: () => T,
    metadata?: Record<string, any>
  ): T {
    const id = this.startMeasure(name, metadata);
    
    try {
      const result = operation();
      return result;
    } finally {
      this.endMeasure(id);
    }
  }

  /**
   * Get statistics for an operation
   */
  getStats(name: string): PerformanceStats | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return null;

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const total = durations.reduce((sum, d) => sum + d, 0);

    return {
      count: durations.length,
      total,
      min: durations[0],
      max: durations[durations.length - 1],
      avg: total / durations.length,
      median: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    const report: PerformanceReport = {
      metrics: new Map(),
      slowOperations: [],
      bottlenecks: [],
      recommendations: [],
      summary: {
        totalOperations: 0,
        totalDuration: 0,
        averageDuration: 0,
        slowestOperation: '',
        fastestOperation: '',
      },
    };

    let slowestDuration = 0;
    let fastestDuration = Infinity;

    // Collect stats for each operation
    for (const [name] of this.metrics.entries()) {
      const stats = this.getStats(name);
      if (stats) {
        report.metrics.set(name, stats);
        report.summary.totalOperations += stats.count;
        report.summary.totalDuration += stats.total;

        if (stats.max > slowestDuration) {
          slowestDuration = stats.max;
          report.summary.slowestOperation = name;
        }

        if (stats.min < fastestDuration) {
          fastestDuration = stats.min;
          report.summary.fastestOperation = name;
        }

        // Identify bottlenecks
        const threshold = this.thresholds[name as keyof PerformanceThresholds] || this.thresholds.default;
        if (stats.avg > threshold) {
          report.bottlenecks.push(`${name} (avg: ${Math.round(stats.avg)}ms)`);
        }
      }
    }

    // Calculate average
    if (report.summary.totalOperations > 0) {
      report.summary.averageDuration = 
        report.summary.totalDuration / report.summary.totalOperations;
    }

    // Find slow operations
    for (const metrics of this.metrics.values()) {
      for (const metric of metrics) {
        const threshold = this.thresholds[metric.name as keyof PerformanceThresholds] || this.thresholds.default;
        if (metric.duration > threshold * 2) {
          report.slowOperations.push(metric);
        }
      }
    }

    // Sort slow operations by duration
    report.slowOperations.sort((a, b) => b.duration - a.duration);
    report.slowOperations = report.slowOperations.slice(0, 10);

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(report: PerformanceReport): string[] {
    const recommendations: string[] = [];

    // Check for slow navigation
    const navStats = report.metrics.get('navigation');
    if (navStats && navStats.avg > 3000) {
      recommendations.push('Consider implementing page preloading or caching for faster navigation');
    }

    // Check for slow clicks
    const clickStats = report.metrics.get('click');
    if (clickStats && clickStats.avg > 500) {
      recommendations.push('Optimize element selection strategy to reduce click latency');
    }

    // Check for slow data extraction
    const extractStats = report.metrics.get('extract');
    if (extractStats && extractStats.avg > 1000) {
      recommendations.push('Use more specific selectors or implement result caching for data extraction');
    }

    // Check for high variance
    for (const [name, stats] of report.metrics.entries()) {
      const variance = stats.max / stats.min;
      if (variance > 10 && stats.count > 10) {
        recommendations.push(`High variance detected in ${name} operations - investigate inconsistent performance`);
      }
    }

    // Check for memory-related slowdowns
    if (report.summary.totalOperations > 100) {
      const laterOps = Array.from(this.metrics.values())
        .flat()
        .slice(-50);
      const earlierOps = Array.from(this.metrics.values())
        .flat()
        .slice(0, 50);
      
      const laterAvg = laterOps.reduce((sum, m) => sum + m.duration, 0) / laterOps.length;
      const earlierAvg = earlierOps.reduce((sum, m) => sum + m.duration, 0) / earlierOps.length;
      
      if (laterAvg > earlierAvg * 1.5) {
        recommendations.push('Performance degradation detected over time - consider implementing memory cleanup');
      }
    }

    return recommendations;
  }

  /**
   * Setup performance observer
   */
  private setupObserver(): void {
    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure' && entry.name.startsWith('playclone_')) {
          this.emit('measure', {
            name: entry.name.replace('playclone_', ''),
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      }
    });

    this.observer.observe({ entryTypes: ['measure'] });
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.marks.clear();
  }

  /**
   * Enable/disable profiling
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    
    if (enabled && !this.observer) {
      this.setupObserver();
    } else if (!enabled && this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): Record<string, PerformanceMetric[]> {
    const exported: Record<string, PerformanceMetric[]> = {};
    
    for (const [name, metrics] of this.metrics.entries()) {
      exported[name] = [...metrics];
    }
    
    return exported;
  }

  /**
   * Import metrics for analysis
   */
  importMetrics(data: Record<string, PerformanceMetric[]>): void {
    this.clear();
    
    for (const [name, metrics] of Object.entries(data)) {
      this.metrics.set(name, metrics);
    }
  }

  /**
   * Decorator for automatic performance measurement
   */
  static measure(name?: string) {
    return function (
      _target: any,
      propertyName: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      const methodName = name || propertyName;

      descriptor.value = async function (...args: any[]) {
        const profiler = (this as any).profiler || globalProfiler;
        
        if (!profiler || !profiler.enabled) {
          return originalMethod.apply(this, args);
        }

        return profiler.measure(
          methodName,
          () => originalMethod.apply(this, args),
          { args: args.length }
        );
      };

      return descriptor;
    };
  }
}

/**
 * Global profiler instance
 */
export const globalProfiler = new PerformanceProfiler();

/**
 * Performance optimizer suggestions
 */
export class PerformanceOptimizer {
  private profiler: PerformanceProfiler;

  constructor(profiler: PerformanceProfiler = globalProfiler) {
    this.profiler = profiler;
  }

  /**
   * Analyze and optimize based on profiling data
   */
  analyze(): {
    optimizations: string[];
    config: Record<string, any>;
  } {
    const report = this.profiler.generateReport();
    const optimizations: string[] = [];
    const config: Record<string, any> = {};

    // Analyze navigation performance
    const navStats = report.metrics.get('navigation');
    if (navStats) {
      if (navStats.avg > 5000) {
        optimizations.push('Enable aggressive caching');
        config.cacheNavigation = true;
        config.navigationTimeout = Math.min(navStats.p95 * 1.2, 30000);
      }
    }

    // Analyze element selection
    const clickStats = report.metrics.get('click');
    if (clickStats && clickStats.avg > 1000) {
      optimizations.push('Use ID or data-testid selectors when possible');
      config.preferTestIds = true;
      config.elementTimeout = Math.min(clickStats.p95 * 1.2, 10000);
    }

    // Analyze extraction performance
    const extractStats = report.metrics.get('extract');
    if (extractStats && extractStats.avg > 2000) {
      optimizations.push('Implement extraction result caching');
      config.cacheExtractions = true;
      config.extractionBatchSize = 10;
    }

    // Check for memory issues
    if (report.summary.totalOperations > 1000) {
      const memoryGrowth = this.detectMemoryGrowth();
      if (memoryGrowth > 0.2) {
        optimizations.push('Enable automatic memory cleanup');
        config.autoCleanup = true;
        config.cleanupInterval = 60000;
      }
    }

    return { optimizations, config };
  }

  /**
   * Detect memory growth trend
   */
  private detectMemoryGrowth(): number {
    const metrics = this.profiler.exportMetrics();
    const allMetrics = Object.values(metrics).flat();
    
    if (allMetrics.length < 100) return 0;

    // Sort by time
    allMetrics.sort((a, b) => a.startTime - b.startTime);

    // Compare first and last quartiles
    const quarter = Math.floor(allMetrics.length / 4);
    const firstQuartile = allMetrics.slice(0, quarter);
    const lastQuartile = allMetrics.slice(-quarter);

    const firstAvg = firstQuartile.reduce((sum, m) => sum + m.duration, 0) / firstQuartile.length;
    const lastAvg = lastQuartile.reduce((sum, m) => sum + m.duration, 0) / lastQuartile.length;

    return (lastAvg - firstAvg) / firstAvg;
  }
}