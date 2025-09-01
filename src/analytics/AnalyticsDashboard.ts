import { PlayClone } from '../PlayClone';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

interface MetricData {
  timestamp: Date;
  value: number;
  metadata?: any;
}

export interface SessionMetrics {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  url: string;
  actions: ActionMetric[];
  errors: ErrorMetric[];
  performance: PerformanceMetric[];
  dataExtracted: DataMetric[];
}

export interface ActionMetric {
  type: string;
  selector?: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  error?: string;
}

export interface ErrorMetric {
  type: string;
  message: string;
  stack?: string;
  timestamp: Date;
  url: string;
  selector?: string;
}

export interface PerformanceMetric {
  metric: string;
  value: number;
  timestamp: Date;
  threshold?: number;
}

export interface DataMetric {
  type: string;
  count: number;
  size: number;
  timestamp: Date;
  url: string;
}

export interface DashboardConfig {
  port?: number;
  host?: string;
  autoOpen?: boolean;
  updateInterval?: number;
  retentionDays?: number;
  enableRealtime?: boolean;
  enableHistory?: boolean;
  metricsPath?: string;
}

export interface AggregatedMetrics {
  totalSessions: number;
  activeSessions: number;
  totalActions: number;
  successRate: number;
  avgActionDuration: number;
  errorRate: number;
  topErrors: Array<{error: string; count: number}>;
  topActions: Array<{action: string; count: number}>;
  avgPageLoadTime: number;
  totalDataExtracted: number;
  browserUsage: Record<string, number>;
  urlVisits: Array<{url: string; count: number}>;
  hourlyActivity: Array<{hour: number; count: number}>;
  performanceTrends: Record<string, number[]>;
}

export class AnalyticsDashboard extends EventEmitter {
  private config: Required<DashboardConfig>;
  private sessions: Map<string, SessionMetrics> = new Map();
  private historicalData: SessionMetrics[] = [];
  private server?: http.Server;
  private wss?: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private updateTimer?: NodeJS.Timeout;
  private metricsCollectors: Map<string, MetricsCollector> = new Map();

  constructor(config: DashboardConfig = {}) {
    super();
    this.config = {
      port: config.port || 9090,
      host: config.host || 'localhost',
      autoOpen: config.autoOpen ?? true,
      updateInterval: config.updateInterval || 5000,
      retentionDays: config.retentionDays || 30,
      enableRealtime: config.enableRealtime ?? true,
      enableHistory: config.enableHistory ?? true,
      metricsPath: config.metricsPath || './analytics-data'
    };

    if (this.config.enableHistory) {
      this.loadHistoricalData();
    }
  }

  public async start(): Promise<void> {
    // Create HTTP server for dashboard
    this.server = http.createServer((req, res) => {
      if (req.url === '/') {
        this.serveDashboard(res);
      } else if (req.url === '/api/metrics') {
        this.serveMetrics(res);
      } else if (req.url === '/api/sessions') {
        this.serveSessions(res);
      } else if (req.url === '/api/export') {
        this.serveExport(res);
      } else if (req.url?.startsWith('/static/')) {
        this.serveStatic(req, res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    // Create WebSocket server for real-time updates
    if (this.config.enableRealtime) {
      this.wss = new WebSocketServer({ server: this.server });
      this.wss.on('connection', (ws) => {
        this.clients.add(ws as WebSocket);
        this.sendInitialData(ws as WebSocket);

        ws.on('close', () => {
          this.clients.delete(ws as WebSocket);
        });

        ws.on('message', (message) => {
          this.handleWebSocketMessage(ws as WebSocket, message.toString());
        });
      });
    }

    // Start server
    await new Promise<void>((resolve) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        console.log(`Analytics Dashboard running at http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });

    // Start update timer
    if (this.config.enableRealtime) {
      this.updateTimer = setInterval(() => {
        this.broadcastMetrics();
      }, this.config.updateInterval);
    }

    // Auto-open in browser
    if (this.config.autoOpen) {
      const { exec } = require('child_process');
      const url = `http://${this.config.host}:${this.config.port}`;
      const cmd = process.platform === 'win32' ? `start ${url}` :
                  process.platform === 'darwin' ? `open ${url}` :
                  `xdg-open ${url}`;
      exec(cmd);
    }

    this.emit('started', { url: `http://${this.config.host}:${this.config.port}` });
  }

  public async stop(): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.clients.forEach(ws => ws.close());
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
    }

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
    }

    if (this.config.enableHistory) {
      this.saveHistoricalData();
    }

    this.emit('stopped');
  }

  public createCollector(sessionId: string, playclone: PlayClone): MetricsCollector {
    const collector = new MetricsCollector(sessionId, playclone, this);
    this.metricsCollectors.set(sessionId, collector);
    
    // Initialize session metrics
    this.sessions.set(sessionId, {
      sessionId,
      startTime: new Date(),
      url: '',
      actions: [],
      errors: [],
      performance: [],
      dataExtracted: []
    });

    return collector;
  }

  public recordAction(sessionId: string, action: ActionMetric): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.actions.push(action);
      this.broadcastUpdate('action', { sessionId, action });
    }
  }

  public recordError(sessionId: string, error: ErrorMetric): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.errors.push(error);
      this.broadcastUpdate('error', { sessionId, error });
    }
  }

  public recordPerformance(sessionId: string, metric: PerformanceMetric): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.performance.push(metric);
      this.broadcastUpdate('performance', { sessionId, metric });
    }
  }

  public recordDataExtraction(sessionId: string, data: DataMetric): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.dataExtracted.push(data);
      this.broadcastUpdate('data', { sessionId, data });
    }
  }

  public endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endTime = new Date();
      this.historicalData.push(session);
      this.metricsCollectors.delete(sessionId);
      
      if (this.config.enableHistory) {
        this.saveSessionData(session);
      }

      this.broadcastUpdate('session_end', { sessionId });
    }
  }

  public getAggregatedMetrics(): AggregatedMetrics {
    const allSessions = [...this.sessions.values(), ...this.historicalData];
    const activeSessions = [...this.sessions.values()].filter(s => !s.endTime);
    
    // Calculate aggregated metrics
    const totalActions = allSessions.reduce((sum, s) => sum + s.actions.length, 0);
    const successfulActions = allSessions.reduce((sum, s) => 
      sum + s.actions.filter(a => a.success).length, 0);
    
    const errorCounts = new Map<string, number>();
    const actionCounts = new Map<string, number>();
    const urlCounts = new Map<string, number>();
    const hourlyActivity = new Array(24).fill(0);
    
    allSessions.forEach(session => {
      // Count errors
      session.errors.forEach(error => {
        const key = error.type;
        errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
      });

      // Count actions
      session.actions.forEach(action => {
        const key = action.type;
        actionCounts.set(key, (actionCounts.get(key) || 0) + 1);
        
        // Track hourly activity
        const hour = new Date(action.timestamp).getHours();
        hourlyActivity[hour]++;
      });

      // Count URLs
      if (session.url) {
        urlCounts.set(session.url, (urlCounts.get(session.url) || 0) + 1);
      }
    });

    // Calculate average action duration
    const allDurations = allSessions.flatMap(s => s.actions.map(a => a.duration));
    const avgActionDuration = allDurations.length > 0 ?
      allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length : 0;

    // Calculate average page load time
    const pageLoadTimes = allSessions.flatMap(s => 
      s.performance.filter(p => p.metric === 'pageLoad').map(p => p.value)
    );
    const avgPageLoadTime = pageLoadTimes.length > 0 ?
      pageLoadTimes.reduce((sum, t) => sum + t, 0) / pageLoadTimes.length : 0;

    // Performance trends
    const performanceTrends: Record<string, number[]> = {};
    ['cpu', 'memory', 'pageLoad', 'networkLatency'].forEach(metric => {
      performanceTrends[metric] = allSessions
        .flatMap(s => s.performance.filter(p => p.metric === metric))
        .slice(-100)
        .map(p => p.value);
    });

    return {
      totalSessions: allSessions.length,
      activeSessions: activeSessions.length,
      totalActions,
      successRate: totalActions > 0 ? (successfulActions / totalActions) * 100 : 0,
      avgActionDuration,
      errorRate: totalActions > 0 ? 
        (allSessions.reduce((sum, s) => sum + s.errors.length, 0) / totalActions) * 100 : 0,
      topErrors: Array.from(errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([error, count]) => ({ error, count })),
      topActions: Array.from(actionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([action, count]) => ({ action, count })),
      avgPageLoadTime,
      totalDataExtracted: allSessions.reduce((sum, s) => 
        sum + s.dataExtracted.reduce((ds, d) => ds + d.count, 0), 0),
      browserUsage: this.getBrowserUsage(),
      urlVisits: Array.from(urlCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([url, count]) => ({ url, count })),
      hourlyActivity: hourlyActivity.map((count, hour) => ({ hour, count })),
      performanceTrends
    };
  }

  private getBrowserUsage(): Record<string, number> {
    // This would normally track which browser engines are being used
    // For now, return sample data
    return {
      chromium: 75,
      firefox: 20,
      webkit: 5
    };
  }

  private serveDashboard(res: http.ServerResponse): void {
    const html = this.generateDashboardHTML();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  private serveMetrics(res: http.ServerResponse): void {
    const metrics = this.getAggregatedMetrics();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics));
  }

  private serveSessions(res: http.ServerResponse): void {
    const sessions = [...this.sessions.values()];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sessions));
  }

  private serveExport(res: http.ServerResponse): void {
    const data = {
      sessions: [...this.sessions.values(), ...this.historicalData],
      aggregated: this.getAggregatedMetrics(),
      exportTime: new Date().toISOString()
    };
    
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="analytics-export.json"'
    });
    res.end(JSON.stringify(data, null, 2));
  }

  private serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Serve static assets like charts library
    res.writeHead(404);
    res.end('Not Found');
  }

  private sendInitialData(ws: WebSocket): void {
    ws.send(JSON.stringify({
      type: 'initial',
      data: {
        metrics: this.getAggregatedMetrics(),
        sessions: [...this.sessions.values()]
      }
    }));
  }

  private handleWebSocketMessage(ws: WebSocket, message: string): void {
    try {
      const msg = JSON.parse(message);
      
      switch (msg.type) {
        case 'subscribe':
          // Handle subscription to specific metrics
          break;
        case 'filter':
          // Handle filtering requests
          break;
        case 'command':
          // Handle dashboard commands
          this.handleDashboardCommand(ws, msg.command, msg.data);
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  }

  private handleDashboardCommand(ws: WebSocket, command: string, data: any): void {
    switch (command) {
      case 'clearHistory':
        this.historicalData = [];
        ws.send(JSON.stringify({ type: 'command_result', success: true }));
        break;
      case 'exportSession':
        const session = this.sessions.get(data.sessionId);
        if (session) {
          ws.send(JSON.stringify({ 
            type: 'session_export', 
            data: session 
          }));
        }
        break;
    }
  }

  private broadcastMetrics(): void {
    const metrics = this.getAggregatedMetrics();
    this.broadcast({
      type: 'metrics_update',
      data: metrics
    });
  }

  private broadcastUpdate(type: string, data: any): void {
    this.broadcast({
      type: 'realtime_update',
      updateType: type,
      data
    });
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }

  private loadHistoricalData(): void {
    try {
      if (!fs.existsSync(this.config.metricsPath)) {
        fs.mkdirSync(this.config.metricsPath, { recursive: true });
        return;
      }

      const files = fs.readdirSync(this.config.metricsPath)
        .filter(f => f.endsWith('.json'))
        .sort();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      files.forEach(file => {
        try {
          const data = JSON.parse(
            fs.readFileSync(path.join(this.config.metricsPath, file), 'utf-8')
          );
          
          const sessionDate = new Date(data.startTime);
          if (sessionDate >= cutoffDate) {
            this.historicalData.push(data);
          } else {
            // Delete old data
            fs.unlinkSync(path.join(this.config.metricsPath, file));
          }
        } catch (error) {
          console.error(`Error loading metrics file ${file}:`, error);
        }
      });
    } catch (error) {
      console.error('Error loading historical data:', error);
    }
  }

  private saveHistoricalData(): void {
    try {
      if (!fs.existsSync(this.config.metricsPath)) {
        fs.mkdirSync(this.config.metricsPath, { recursive: true });
      }

      // Save current sessions
      this.sessions.forEach(session => {
        this.saveSessionData(session);
      });
    } catch (error) {
      console.error('Error saving historical data:', error);
    }
  }

  private saveSessionData(session: SessionMetrics): void {
    try {
      const filename = `session-${session.sessionId}-${Date.now()}.json`;
      const filepath = path.join(this.config.metricsPath, filename);
      fs.writeFileSync(filepath, JSON.stringify(session, null, 2));
    } catch (error) {
      console.error('Error saving session data:', error);
    }
  }

  private generateDashboardHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PlayClone Analytics Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            min-height: 100vh;
        }
        .header {
            background: white;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header h1 {
            color: #667eea;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.15);
        }
        .metric-value {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
            margin: 10px 0;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .metric-change {
            font-size: 0.9em;
            margin-top: 5px;
        }
        .metric-change.positive { color: #10b981; }
        .metric-change.negative { color: #ef4444; }
        .chart-container {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .chart-title {
            font-size: 1.2em;
            color: #333;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f0f0;
        }
        .sessions-table {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow-x: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #f0f0f0;
        }
        th {
            background: #f9fafb;
            font-weight: 600;
            color: #667eea;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 500;
        }
        .status-active { background: #10b981; color: white; }
        .status-completed { background: #6b7280; color: white; }
        .status-error { background: #ef4444; color: white; }
        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            background: #667eea;
            color: white;
            cursor: pointer;
            transition: background 0.2s;
        }
        .btn:hover { background: #5a67d8; }
        .btn-secondary {
            background: #6b7280;
        }
        .btn-secondary:hover { background: #4b5563; }
        .realtime-indicator {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 5px 10px;
            background: #10b981;
            color: white;
            border-radius: 20px;
            font-size: 0.85em;
        }
        .pulse {
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        .chart-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="container">
            <h1>
                📊 PlayClone Analytics Dashboard
                <span class="realtime-indicator">
                    <span class="pulse"></span>
                    Real-time
                </span>
            </h1>
        </div>
    </div>

    <div class="container">
        <div class="controls">
            <button class="btn" onclick="refreshData()">🔄 Refresh</button>
            <button class="btn" onclick="exportData()">📥 Export Data</button>
            <button class="btn btn-secondary" onclick="clearHistory()">🗑️ Clear History</button>
            <button class="btn btn-secondary" onclick="toggleAutoRefresh()">⏸️ Pause Updates</button>
        </div>

        <div class="metrics-grid" id="metricsGrid">
            <!-- Metrics cards will be inserted here -->
        </div>

        <div class="chart-grid">
            <div class="chart-container">
                <h3 class="chart-title">Success Rate Over Time</h3>
                <canvas id="successChart"></canvas>
            </div>
            <div class="chart-container">
                <h3 class="chart-title">Action Distribution</h3>
                <canvas id="actionChart"></canvas>
            </div>
            <div class="chart-container">
                <h3 class="chart-title">Performance Metrics</h3>
                <canvas id="performanceChart"></canvas>
            </div>
            <div class="chart-container">
                <h3 class="chart-title">Hourly Activity</h3>
                <canvas id="activityChart"></canvas>
            </div>
        </div>

        <div class="sessions-table">
            <h3 class="chart-title">Active Sessions</h3>
            <table id="sessionsTable">
                <thead>
                    <tr>
                        <th>Session ID</th>
                        <th>URL</th>
                        <th>Start Time</th>
                        <th>Duration</th>
                        <th>Actions</th>
                        <th>Errors</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody id="sessionsBody">
                    <!-- Session rows will be inserted here -->
                </tbody>
            </table>
        </div>
    </div>

    <script>
        let ws;
        let autoRefresh = true;
        let charts = {};

        // Initialize WebSocket connection
        function initWebSocket() {
            ws = new WebSocket('ws://' + window.location.host);
            
            ws.onopen = () => {
                console.log('Connected to dashboard');
            };

            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                handleMessage(message);
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            ws.onclose = () => {
                console.log('Disconnected from dashboard');
                setTimeout(initWebSocket, 5000);
            };
        }

        function handleMessage(message) {
            switch (message.type) {
                case 'initial':
                    updateDashboard(message.data.metrics);
                    updateSessions(message.data.sessions);
                    break;
                case 'metrics_update':
                    if (autoRefresh) {
                        updateDashboard(message.data);
                    }
                    break;
                case 'realtime_update':
                    if (autoRefresh) {
                        handleRealtimeUpdate(message);
                    }
                    break;
            }
        }

        function handleRealtimeUpdate(message) {
            // Handle real-time updates
            refreshData();
        }

        function updateDashboard(metrics) {
            updateMetricsCards(metrics);
            updateCharts(metrics);
        }

        function updateMetricsCards(metrics) {
            const grid = document.getElementById('metricsGrid');
            grid.innerHTML = \`
                <div class="metric-card">
                    <div class="metric-label">Total Sessions</div>
                    <div class="metric-value">\${metrics.totalSessions}</div>
                    <div class="metric-change positive">Active: \${metrics.activeSessions}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Success Rate</div>
                    <div class="metric-value">\${metrics.successRate.toFixed(1)}%</div>
                    <div class="metric-change \${metrics.successRate > 90 ? 'positive' : 'negative'}">
                        \${metrics.successRate > 90 ? '✓' : '⚠'} \${metrics.totalActions} actions
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Avg Action Duration</div>
                    <div class="metric-value">\${metrics.avgActionDuration.toFixed(0)}ms</div>
                    <div class="metric-change">Response time</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Error Rate</div>
                    <div class="metric-value">\${metrics.errorRate.toFixed(1)}%</div>
                    <div class="metric-change \${metrics.errorRate < 5 ? 'positive' : 'negative'}">
                        \${metrics.topErrors.length} unique errors
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Page Load Time</div>
                    <div class="metric-value">\${(metrics.avgPageLoadTime / 1000).toFixed(2)}s</div>
                    <div class="metric-change">Average</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Data Extracted</div>
                    <div class="metric-value">\${formatNumber(metrics.totalDataExtracted)}</div>
                    <div class="metric-change">Total items</div>
                </div>
            \`;
        }

        function updateCharts(metrics) {
            // Success Rate Chart
            if (!charts.success) {
                const ctx = document.getElementById('successChart').getContext('2d');
                charts.success = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: 'Success Rate',
                            data: [],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100
                            }
                        }
                    }
                });
            }
            
            // Update success chart data
            const now = new Date().toLocaleTimeString();
            charts.success.data.labels.push(now);
            charts.success.data.datasets[0].data.push(metrics.successRate);
            if (charts.success.data.labels.length > 20) {
                charts.success.data.labels.shift();
                charts.success.data.datasets[0].data.shift();
            }
            charts.success.update();

            // Action Distribution Chart
            if (!charts.action) {
                const ctx = document.getElementById('actionChart').getContext('2d');
                charts.action = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: metrics.topActions.map(a => a.action),
                        datasets: [{
                            data: metrics.topActions.map(a => a.count),
                            backgroundColor: [
                                '#667eea', '#764ba2', '#10b981', '#f59e0b',
                                '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
                            ]
                        }]
                    },
                    options: {
                        responsive: true
                    }
                });
            } else {
                charts.action.data.labels = metrics.topActions.map(a => a.action);
                charts.action.data.datasets[0].data = metrics.topActions.map(a => a.count);
                charts.action.update();
            }

            // Performance Chart
            if (!charts.performance) {
                const ctx = document.getElementById('performanceChart').getContext('2d');
                charts.performance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: Array.from({length: 20}, (_, i) => i),
                        datasets: [
                            {
                                label: 'CPU %',
                                data: [],
                                borderColor: '#667eea',
                                tension: 0.4
                            },
                            {
                                label: 'Memory %',
                                data: [],
                                borderColor: '#764ba2',
                                tension: 0.4
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100
                            }
                        }
                    }
                });
            }

            // Hourly Activity Chart
            if (!charts.activity) {
                const ctx = document.getElementById('activityChart').getContext('2d');
                charts.activity = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: Array.from({length: 24}, (_, i) => i + ':00'),
                        datasets: [{
                            label: 'Actions',
                            data: metrics.hourlyActivity.map(h => h.count),
                            backgroundColor: '#667eea'
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            } else {
                charts.activity.data.datasets[0].data = metrics.hourlyActivity.map(h => h.count);
                charts.activity.update();
            }
        }

        function updateSessions(sessions) {
            const tbody = document.getElementById('sessionsBody');
            tbody.innerHTML = sessions.map(session => {
                const duration = session.endTime ? 
                    new Date(session.endTime) - new Date(session.startTime) :
                    Date.now() - new Date(session.startTime);
                const status = session.endTime ? 'completed' : 'active';
                
                return \`
                    <tr>
                        <td>\${session.sessionId.substring(0, 8)}...</td>
                        <td>\${session.url || 'N/A'}</td>
                        <td>\${new Date(session.startTime).toLocaleTimeString()}</td>
                        <td>\${formatDuration(duration)}</td>
                        <td>\${session.actions.length}</td>
                        <td>\${session.errors.length}</td>
                        <td><span class="status-badge status-\${status}">\${status}</span></td>
                    </tr>
                \`;
            }).join('');
        }

        function formatNumber(num) {
            if (num > 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num > 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toString();
        }

        function formatDuration(ms) {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            
            if (hours > 0) return hours + 'h ' + (minutes % 60) + 'm';
            if (minutes > 0) return minutes + 'm ' + (seconds % 60) + 's';
            return seconds + 's';
        }

        async function refreshData() {
            const response = await fetch('/api/metrics');
            const metrics = await response.json();
            updateDashboard(metrics);
            
            const sessionsResponse = await fetch('/api/sessions');
            const sessions = await sessionsResponse.json();
            updateSessions(sessions);
        }

        async function exportData() {
            window.location.href = '/api/export';
        }

        function clearHistory() {
            if (confirm('Clear all historical data?')) {
                ws.send(JSON.stringify({
                    type: 'command',
                    command: 'clearHistory'
                }));
                refreshData();
            }
        }

        function toggleAutoRefresh() {
            autoRefresh = !autoRefresh;
            const btn = event.target;
            btn.textContent = autoRefresh ? '⏸️ Pause Updates' : '▶️ Resume Updates';
        }

        // Initialize on load
        initWebSocket();
        refreshData();
    </script>
</body>
</html>`;
  }
}

export class MetricsCollector {
  private sessionId: string;
  private playclone: PlayClone;
  private dashboard: AnalyticsDashboard;
  private startTime: Date;

  constructor(sessionId: string, playclone: PlayClone, dashboard: AnalyticsDashboard) {
    this.sessionId = sessionId;
    this.playclone = playclone;
    this.dashboard = dashboard;
    this.startTime = new Date();

    this.attachListeners();
  }

  private attachListeners(): void {
    // Hook into PlayClone events
    const originalNavigate = this.playclone.navigate.bind(this.playclone);
    this.playclone.navigate = async (url: string) => {
      const start = Date.now();
      try {
        const result = await originalNavigate(url);
        this.dashboard.recordAction(this.sessionId, {
          type: 'navigate',
          timestamp: new Date(),
          duration: Date.now() - start,
          success: result.success,
          error: result.error
        });
        
        // Update session URL
        const session = this.dashboard['sessions'].get(this.sessionId);
        if (session) {
          session.url = url;
        }
        
        return result;
      } catch (error: any) {
        this.dashboard.recordError(this.sessionId, {
          type: 'NavigationError',
          message: error.message,
          stack: error.stack,
          timestamp: new Date(),
          url
        });
        throw error;
      }
    };

    // Hook into click events
    const originalClick = this.playclone.click.bind(this.playclone);
    this.playclone.click = async (selector: string) => {
      const start = Date.now();
      try {
        const result = await originalClick(selector);
        this.dashboard.recordAction(this.sessionId, {
          type: 'click',
          selector,
          timestamp: new Date(),
          duration: Date.now() - start,
          success: result.success,
          error: result.error
        });
        return result;
      } catch (error: any) {
        this.dashboard.recordError(this.sessionId, {
          type: 'ClickError',
          message: error.message,
          stack: error.stack,
          timestamp: new Date(),
          url: '',
          selector
        });
        throw error;
      }
    };

    // Add more hooks for other actions...
  }

  public recordPerformance(metric: string, value: number, threshold?: number): void {
    this.dashboard.recordPerformance(this.sessionId, {
      metric,
      value,
      timestamp: new Date(),
      threshold
    });
  }

  public recordDataExtraction(type: string, count: number, size: number): void {
    this.dashboard.recordDataExtraction(this.sessionId, {
      type,
      count,
      size,
      timestamp: new Date(),
      url: ''
    });
  }

  public end(): void {
    this.dashboard.endSession(this.sessionId);
  }
}