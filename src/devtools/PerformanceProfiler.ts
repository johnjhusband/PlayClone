import { PlayClone } from '../index';
import * as fs from 'fs/promises';
import * as path from 'path';
import { performance, PerformanceObserver } from 'perf_hooks';

export interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu?: {
    user: number;
    system: number;
  };
  network?: {
    requestCount: number;
    totalSize: number;
    cachedSize: number;
    timing: NetworkTiming[];
  };
  rendering?: {
    fps: number;
    jank: number;
    layoutDuration: number;
    paintDuration: number;
  };
  custom?: Record<string, any>;
}

export interface NetworkTiming {
  url: string;
  method: string;
  status: number;
  duration: number;
  size: number;
  cached: boolean;
  timing: {
    dns: number;
    connect: number;
    ssl: number;
    ttfb: number;
    download: number;
  };
}

export interface ProfilerOptions {
  captureMemory?: boolean;
  captureCPU?: boolean;
  captureNetwork?: boolean;
  captureRendering?: boolean;
  captureScreenshots?: boolean;
  captureTraces?: boolean;
  sampleInterval?: number;
  outputPath?: string;
  verbose?: boolean;
}

export interface ProfileReport {
  summary: {
    totalDuration: number;
    operationCount: number;
    averageDuration: number;
    peakMemory: number;
    totalNetworkRequests: number;
    totalNetworkSize: number;
    errorCount: number;
  };
  metrics: PerformanceMetrics[];
  bottlenecks: Bottleneck[];
  recommendations: string[];
  timeline: TimelineEvent[];
  comparison?: ComparisonResult;
}

export interface Bottleneck {
  type: 'cpu' | 'memory' | 'network' | 'rendering' | 'operation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  solution: string;
  metrics: any;
}

export interface TimelineEvent {
  timestamp: number;
  type: string;
  description: string;
  duration?: number;
  metadata?: any;
}

export interface ComparisonResult {
  baseline: ProfileReport;
  current: ProfileReport;
  improvements: string[];
  regressions: string[];
  unchanged: string[];
}

export class PerformanceProfiler {
  private metrics: PerformanceMetrics[] = [];
  private timeline: TimelineEvent[] = [];
  private activeOperations: Map<string, number> = new Map();
  private playclone?: PlayClone;
  private options: ProfilerOptions;
  private observer?: PerformanceObserver;
  private networkRequests: Map<string, NetworkTiming> = new Map();
  private isProfileing: boolean = false;
  private startTime: number = 0;
  private memoryInterval?: NodeJS.Timeout;
  private cpuInterval?: NodeJS.Timeout;

  constructor(options: ProfilerOptions = {}) {
    this.options = {
      captureMemory: true,
      captureCPU: true,
      captureNetwork: true,
      captureRendering: false,
      captureScreenshots: false,
      captureTraces: false,
      sampleInterval: 1000,
      verbose: false,
      ...options
    };

    this.setupPerformanceObserver();
  }

  private setupPerformanceObserver(): void {
    if (this.options.verbose) {
      this.observer = new PerformanceObserver((items) => {
        items.getEntries().forEach((entry) => {
          console.log(`[Performance] ${entry.name}: ${entry.duration}ms`);
        });
      });
      this.observer.observe({ entryTypes: ['measure', 'mark'] });
    }
  }

  public async startProfiling(playclone?: PlayClone): Promise<void> {
    this.playclone = playclone;
    this.metrics = [];
    this.timeline = [];
    this.activeOperations.clear();
    this.networkRequests.clear();
    this.isProfileing = true;
    this.startTime = performance.now();

    this.addTimelineEvent('profiling_start', 'Performance profiling started');

    // Start memory sampling
    if (this.options.captureMemory) {
      this.startMemorySampling();
    }

    // Start CPU sampling
    if (this.options.captureCPU) {
      this.startCPUSampling();
    }

    // Setup network monitoring
    if (this.options.captureNetwork && playclone) {
      await this.setupNetworkMonitoring();
    }

    // Setup rendering metrics
    if (this.options.captureRendering && playclone) {
      await this.setupRenderingMetrics();
    }
  }

  public async stopProfiling(): Promise<ProfileReport> {
    this.isProfileing = false;
    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;

    this.addTimelineEvent('profiling_stop', 'Performance profiling stopped', totalDuration);

    // Stop sampling intervals
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = undefined;
    }

    if (this.cpuInterval) {
      clearInterval(this.cpuInterval);
      this.cpuInterval = undefined;
    }

    // Generate report
    const report = this.generateReport(totalDuration);

    // Save report if output path specified
    if (this.options.outputPath) {
      await this.saveReport(report, this.options.outputPath);
    }

    return report;
  }

  public startOperation(name: string): void {
    const startTime = performance.now();
    this.activeOperations.set(name, startTime);
    performance.mark(`${name}_start`);
    this.addTimelineEvent('operation_start', `Started: ${name}`);
  }

  public endOperation(name: string, metadata?: any): void {
    const startTime = this.activeOperations.get(name);
    if (!startTime) {
      console.warn(`Operation '${name}' was not started`);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    performance.mark(`${name}_end`);
    performance.measure(name, `${name}_start`, `${name}_end`);

    const metric: PerformanceMetrics = {
      operation: name,
      startTime,
      endTime,
      duration,
      memory: this.captureMemorySnapshot(),
      custom: metadata
    };

    if (this.options.captureCPU) {
      metric.cpu = this.captureCPUSnapshot();
    }

    this.metrics.push(metric);
    this.activeOperations.delete(name);
    this.addTimelineEvent('operation_end', `Completed: ${name}`, duration, metadata);
  }

  public async measureAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    this.startOperation(name);
    try {
      const result = await fn();
      this.endOperation(name, { success: true });
      return result;
    } catch (error) {
      this.endOperation(name, { success: false, error: (error as Error).message });
      throw error;
    }
  }

  public measure<T>(name: string, fn: () => T): T {
    this.startOperation(name);
    try {
      const result = fn();
      this.endOperation(name, { success: true });
      return result;
    } catch (error) {
      this.endOperation(name, { success: false, error: (error as Error).message });
      throw error;
    }
  }

  private captureMemorySnapshot(): PerformanceMetrics['memory'] {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss
    };
  }

  private captureCPUSnapshot(): PerformanceMetrics['cpu'] {
    const usage = process.cpuUsage();
    return {
      user: usage.user / 1000, // Convert to milliseconds
      system: usage.system / 1000
    };
  }

  private startMemorySampling(): void {
    this.memoryInterval = setInterval(() => {
      if (this.isProfileing) {
        const memory = this.captureMemorySnapshot();
        this.addTimelineEvent('memory_sample', 'Memory snapshot', 0, memory);
      }
    }, this.options.sampleInterval!);
  }

  private startCPUSampling(): void {
    let previousCPU = process.cpuUsage();
    
    this.cpuInterval = setInterval(() => {
      if (this.isProfileing) {
        const currentCPU = process.cpuUsage(previousCPU);
        previousCPU = process.cpuUsage();
        
        this.addTimelineEvent('cpu_sample', 'CPU snapshot', 0, {
          user: currentCPU.user / 1000,
          system: currentCPU.system / 1000
        });
      }
    }, this.options.sampleInterval!);
  }

  private async setupNetworkMonitoring(): Promise<void> {
    if (!this.playclone) return;

    const page = (this.playclone as any).page;
    if (!page) return;

    // Monitor network requests
    page.on('request', (request: any) => {
      const id = request.url();
      this.networkRequests.set(id, {
        url: request.url(),
        method: request.method(),
        status: 0,
        duration: 0,
        size: 0,
        cached: false,
        timing: {
          dns: 0,
          connect: 0,
          ssl: 0,
          ttfb: 0,
          download: 0
        }
      });
      this.addTimelineEvent('network_request', `Request: ${request.method()} ${request.url()}`);
    });

    page.on('response', (response: any) => {
      const id = response.url();
      const request = this.networkRequests.get(id);
      if (request) {
        request.status = response.status();
        request.cached = response.fromCache();
        this.addTimelineEvent('network_response', `Response: ${response.status()} ${response.url()}`);
      }
    });

    page.on('requestfinished', async (request: any) => {
      const id = request.url();
      const timing = request.timing();
      const networkRequest = this.networkRequests.get(id);
      
      if (networkRequest && timing) {
        networkRequest.duration = timing.responseEnd - timing.requestTime;
        networkRequest.timing = {
          dns: timing.dnsEnd - timing.dnsStart,
          connect: timing.connectEnd - timing.connectStart,
          ssl: timing.sslEnd - timing.sslStart,
          ttfb: timing.responseStart - timing.requestTime,
          download: timing.responseEnd - timing.responseStart
        };
        
        const response = request.response();
        if (response) {
          const headers = response.headers();
          networkRequest.size = parseInt(headers['content-length'] || '0');
        }
      }
    });
  }

  private async setupRenderingMetrics(): Promise<void> {
    if (!this.playclone) return;

    const page = (this.playclone as any).page;
    if (!page) return;

    // Inject performance monitoring script
    await page.evaluateOnNewDocument(() => {
      let lastFrameTime = performance.now();
      let frameCount = 0;
      let jankCount = 0;

      const measureFPS = () => {
        const currentTime = performance.now();
        const delta = currentTime - lastFrameTime;
        
        if (delta > 16.67 * 1.5) { // 1.5x frame budget = jank
          jankCount++;
        }
        
        frameCount++;
        lastFrameTime = currentTime;
        
        if (frameCount % 60 === 0) {
          console.log(`PLAYCLONE_METRICS:fps:${60000 / (currentTime - (lastFrameTime - 1000))}`);
          console.log(`PLAYCLONE_METRICS:jank:${jankCount}`);
          jankCount = 0;
        }
        
        requestAnimationFrame(measureFPS);
      };
      
      requestAnimationFrame(measureFPS);
    });

    // Listen for metrics
    page.on('console', (msg: any) => {
      const text = msg.text();
      if (text.startsWith('PLAYCLONE_METRICS:')) {
        const [_, metric, value] = text.split(':');
        this.addTimelineEvent('rendering_metric', `${metric}: ${value}`, 0, {
          metric,
          value: parseFloat(value)
        });
      }
    });
  }

  private addTimelineEvent(
    type: string,
    description: string,
    duration?: number,
    metadata?: any
  ): void {
    this.timeline.push({
      timestamp: performance.now() - this.startTime,
      type,
      description,
      duration,
      metadata
    });
  }

  private generateReport(totalDuration: number): ProfileReport {
    // Calculate summary statistics
    const summary = {
      totalDuration,
      operationCount: this.metrics.length,
      averageDuration: this.metrics.length > 0 
        ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length 
        : 0,
      peakMemory: Math.max(...this.metrics.map(m => m.memory.heapUsed)),
      totalNetworkRequests: this.networkRequests.size,
      totalNetworkSize: Array.from(this.networkRequests.values())
        .reduce((sum, r) => sum + r.size, 0),
      errorCount: this.metrics.filter(m => m.custom?.success === false).length
    };

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks();

    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, bottlenecks);

    return {
      summary,
      metrics: this.metrics,
      bottlenecks,
      recommendations,
      timeline: this.timeline
    };
  }

  private identifyBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Check for slow operations
    const slowOps = this.metrics.filter(m => m.duration > 1000);
    slowOps.forEach(op => {
      bottlenecks.push({
        type: 'operation',
        severity: op.duration > 5000 ? 'critical' : op.duration > 2000 ? 'high' : 'medium',
        description: `Slow operation: ${op.operation}`,
        impact: `Operation took ${op.duration.toFixed(2)}ms`,
        solution: 'Consider optimizing this operation or adding caching',
        metrics: { duration: op.duration, operation: op.operation }
      });
    });

    // Check for memory issues
    const memoryGrowth = this.calculateMemoryGrowth();
    if (memoryGrowth > 50 * 1024 * 1024) { // 50MB growth
      bottlenecks.push({
        type: 'memory',
        severity: memoryGrowth > 100 * 1024 * 1024 ? 'high' : 'medium',
        description: 'Significant memory growth detected',
        impact: `Memory increased by ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
        solution: 'Check for memory leaks and optimize data structures',
        metrics: { growth: memoryGrowth }
      });
    }

    // Check for network issues
    const slowRequests = Array.from(this.networkRequests.values())
      .filter(r => r.duration > 1000);
    
    if (slowRequests.length > 0) {
      bottlenecks.push({
        type: 'network',
        severity: slowRequests.some(r => r.duration > 5000) ? 'high' : 'medium',
        description: `${slowRequests.length} slow network requests`,
        impact: `Average slow request time: ${(slowRequests.reduce((sum, r) => sum + r.duration, 0) / slowRequests.length).toFixed(2)}ms`,
        solution: 'Consider caching, CDN, or optimizing server response times',
        metrics: { count: slowRequests.length, requests: slowRequests }
      });
    }

    // Check for rendering issues
    const renderingEvents = this.timeline.filter(e => e.type === 'rendering_metric');
    const jankEvents = renderingEvents.filter(e => e.metadata?.metric === 'jank' && e.metadata?.value > 5);
    
    if (jankEvents.length > 0) {
      bottlenecks.push({
        type: 'rendering',
        severity: 'medium',
        description: 'Rendering jank detected',
        impact: 'Poor user experience due to frame drops',
        solution: 'Optimize JavaScript execution and reduce layout thrashing',
        metrics: { jankCount: jankEvents.length }
      });
    }

    return bottlenecks;
  }

  private calculateMemoryGrowth(): number {
    if (this.metrics.length < 2) return 0;
    
    const firstMemory = this.metrics[0].memory.heapUsed;
    const lastMemory = this.metrics[this.metrics.length - 1].memory.heapUsed;
    
    return lastMemory - firstMemory;
  }

  private generateRecommendations(
    summary: ProfileReport['summary'],
    bottlenecks: Bottleneck[]
  ): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (summary.averageDuration > 500) {
      recommendations.push('Consider implementing caching for frequently accessed operations');
    }

    if (summary.errorCount > 0) {
      recommendations.push(`Fix ${summary.errorCount} operations that are failing`);
    }

    // Memory recommendations
    const memoryBottleneck = bottlenecks.find(b => b.type === 'memory');
    if (memoryBottleneck) {
      recommendations.push('Implement memory pooling for frequently created objects');
      recommendations.push('Use streaming for large data processing');
    }

    // Network recommendations
    if (summary.totalNetworkRequests > 50) {
      recommendations.push('Batch network requests to reduce overhead');
    }

    const networkBottleneck = bottlenecks.find(b => b.type === 'network');
    if (networkBottleneck) {
      recommendations.push('Enable HTTP/2 for multiplexing');
      recommendations.push('Implement request deduplication');
    }

    // General recommendations
    if (bottlenecks.length > 5) {
      recommendations.push('Focus on fixing critical bottlenecks first');
    }

    if (summary.totalDuration > 30000) {
      recommendations.push('Consider breaking long operations into smaller chunks');
    }

    return recommendations;
  }

  public async compareWithBaseline(
    baselinePath: string
  ): Promise<ComparisonResult> {
    const baselineContent = await fs.readFile(baselinePath, 'utf-8');
    const baseline = JSON.parse(baselineContent) as ProfileReport;
    
    const current = this.generateReport(performance.now() - this.startTime);
    
    const improvements: string[] = [];
    const regressions: string[] = [];
    const unchanged: string[] = [];

    // Compare durations
    if (current.summary.averageDuration < baseline.summary.averageDuration * 0.9) {
      improvements.push(`Average operation duration improved by ${((1 - current.summary.averageDuration / baseline.summary.averageDuration) * 100).toFixed(1)}%`);
    } else if (current.summary.averageDuration > baseline.summary.averageDuration * 1.1) {
      regressions.push(`Average operation duration regressed by ${((current.summary.averageDuration / baseline.summary.averageDuration - 1) * 100).toFixed(1)}%`);
    } else {
      unchanged.push('Average operation duration unchanged');
    }

    // Compare memory
    if (current.summary.peakMemory < baseline.summary.peakMemory * 0.9) {
      improvements.push(`Peak memory usage improved by ${((1 - current.summary.peakMemory / baseline.summary.peakMemory) * 100).toFixed(1)}%`);
    } else if (current.summary.peakMemory > baseline.summary.peakMemory * 1.1) {
      regressions.push(`Peak memory usage regressed by ${((current.summary.peakMemory / baseline.summary.peakMemory - 1) * 100).toFixed(1)}%`);
    }

    // Compare errors
    if (current.summary.errorCount < baseline.summary.errorCount) {
      improvements.push(`Error count reduced from ${baseline.summary.errorCount} to ${current.summary.errorCount}`);
    } else if (current.summary.errorCount > baseline.summary.errorCount) {
      regressions.push(`Error count increased from ${baseline.summary.errorCount} to ${current.summary.errorCount}`);
    }

    return {
      baseline,
      current,
      improvements,
      regressions,
      unchanged
    };
  }

  public async saveReport(report: ProfileReport, filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    // Save JSON report
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
    
    // Save HTML report
    const htmlPath = filePath.replace('.json', '.html');
    const htmlReport = this.generateHTMLReport(report);
    await fs.writeFile(htmlPath, htmlReport, 'utf-8');
    
    console.log(`Performance report saved to:`);
    console.log(`  JSON: ${filePath}`);
    console.log(`  HTML: ${htmlPath}`);
  }

  private generateHTMLReport(report: ProfileReport): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>PlayClone Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; margin-top: 5px; }
        .bottleneck { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .bottleneck.critical { background: #f8d7da; border-left-color: #dc3545; }
        .bottleneck.high { background: #fff3cd; border-left-color: #ff9800; }
        .recommendation { background: #d4edda; border-left: 4px solid #28a745; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .timeline { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: bold; }
        .chart { margin: 20px 0; }
        canvas { max-width: 100%; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <h1>🎯 PlayClone Performance Report</h1>
        
        <h2>📊 Summary</h2>
        <div class="summary">
            <div class="metric">
                <div class="metric-value">${(report.summary.totalDuration / 1000).toFixed(2)}s</div>
                <div class="metric-label">Total Duration</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.operationCount}</div>
                <div class="metric-label">Operations</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.averageDuration.toFixed(2)}ms</div>
                <div class="metric-label">Avg Duration</div>
            </div>
            <div class="metric">
                <div class="metric-value">${(report.summary.peakMemory / 1024 / 1024).toFixed(2)}MB</div>
                <div class="metric-label">Peak Memory</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.totalNetworkRequests}</div>
                <div class="metric-label">Network Requests</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.errorCount}</div>
                <div class="metric-label">Errors</div>
            </div>
        </div>

        <h2>⚠️ Bottlenecks</h2>
        ${report.bottlenecks.map(b => `
            <div class="bottleneck ${b.severity}">
                <strong>${b.description}</strong><br>
                Impact: ${b.impact}<br>
                Solution: ${b.solution}
            </div>
        `).join('')}

        <h2>💡 Recommendations</h2>
        ${report.recommendations.map(r => `
            <div class="recommendation">${r}</div>
        `).join('')}

        <h2>📈 Operations Timeline</h2>
        <div class="chart">
            <canvas id="timelineChart"></canvas>
        </div>

        <h2>🔍 Detailed Metrics</h2>
        <table>
            <thead>
                <tr>
                    <th>Operation</th>
                    <th>Duration (ms)</th>
                    <th>Memory (MB)</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${report.metrics.map(m => `
                    <tr>
                        <td>${m.operation}</td>
                        <td>${m.duration.toFixed(2)}</td>
                        <td>${(m.memory.heapUsed / 1024 / 1024).toFixed(2)}</td>
                        <td>${m.custom?.success === false ? '❌ Failed' : '✅ Success'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <script>
        // Create timeline chart
        const ctx = document.getElementById('timelineChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(report.metrics.map(m => m.operation))},
                datasets: [{
                    label: 'Duration (ms)',
                    data: ${JSON.stringify(report.metrics.map(m => m.duration))},
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }, {
                    label: 'Memory (MB)',
                    data: ${JSON.stringify(report.metrics.map(m => m.memory.heapUsed / 1024 / 1024))},
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                    },
                }
            }
        });
    </script>
</body>
</html>`;
  }

  public exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  public exportTimeline(): TimelineEvent[] {
    return [...this.timeline];
  }

  public reset(): void {
    this.metrics = [];
    this.timeline = [];
    this.activeOperations.clear();
    this.networkRequests.clear();
  }
}

export class PerformanceMonitor {
  private profiler: PerformanceProfiler;
  private thresholds: Map<string, number> = new Map();
  private alerts: Array<{ operation: string; duration: number; threshold: number; timestamp: number }> = [];

  constructor(options?: ProfilerOptions) {
    this.profiler = new PerformanceProfiler(options);
  }

  public setThreshold(operation: string, maxDuration: number): void {
    this.thresholds.set(operation, maxDuration);
  }

  public async monitor<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await this.profiler.measureAsync(operation, fn);
      
      const duration = performance.now() - startTime;
      const threshold = this.thresholds.get(operation);
      
      if (threshold && duration > threshold) {
        this.alerts.push({
          operation,
          duration,
          threshold,
          timestamp: Date.now()
        });
        
        console.warn(`⚠️ Performance threshold exceeded for '${operation}': ${duration.toFixed(2)}ms > ${threshold}ms`);
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  public getAlerts(): typeof this.alerts {
    return [...this.alerts];
  }

  public clearAlerts(): void {
    this.alerts = [];
  }

  public async generateReport(): Promise<ProfileReport> {
    return this.profiler.stopProfiling();
  }
}

export default PerformanceProfiler;