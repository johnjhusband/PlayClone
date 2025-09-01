import * as http from 'http';
import { WebSocketServer } from 'ws';
import { PerformanceMonitor } from './PerformanceMonitor';

export interface DashboardConfig {
  port: number;
  host: string;
  updateInterval: number;
  enableWebSocket: boolean;
}

export class DashboardServer {
  private server: http.Server | null = null;
  private wsServer: WebSocketServer | null = null;
  private monitor: PerformanceMonitor;
  private config: DashboardConfig;
  private connections: Set<any> = new Set();

  constructor(monitor: PerformanceMonitor, config?: Partial<DashboardConfig>) {
    this.monitor = monitor;
    this.config = {
      port: 4000,
      host: 'localhost',
      updateInterval: 1000,
      enableWebSocket: true,
      ...config
    };
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      if (this.config.enableWebSocket) {
        this.wsServer = new WebSocketServer({ server: this.server });
        this.setupWebSocket();
      }

      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`Dashboard server running at http://${this.config.host}:${this.config.port}`);
        this.startMetricsUpdates();
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  public async stop(): Promise<void> {
    this.connections.forEach(ws => ws.close());
    this.connections.clear();

    if (this.wsServer) {
      this.wsServer.close();
    }

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '/';

    if (url === '/') {
      this.serveDashboard(res);
    } else if (url === '/metrics') {
      this.serveMetrics(res);
    } else if (url === '/history') {
      this.serveHistory(res);
    } else if (url === '/report') {
      this.serveReport(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  private serveDashboard(res: http.ServerResponse): void {
    const html = this.generateDashboardHTML();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  private serveMetrics(res: http.ServerResponse): void {
    const metrics = this.monitor.getMetrics();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics, null, 2));
  }

  private serveHistory(res: http.ServerResponse): void {
    const history: Record<string, any> = {};
    this.monitor.getAllHistory().forEach((value, key) => {
      history[key] = value;
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(history, null, 2));
  }

  private serveReport(res: http.ServerResponse): void {
    const report = this.monitor.generateReport();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(report);
  }

  private setupWebSocket(): void {
    if (!this.wsServer) return;

    this.wsServer.on('connection', (ws) => {
      this.connections.add(ws);
      
      ws.send(JSON.stringify({
        type: 'initial',
        data: this.monitor.getMetrics()
      }));

      ws.on('close', () => {
        this.connections.delete(ws);
      });
    });
  }

  private startMetricsUpdates(): void {
    this.monitor.on('metrics', (metrics) => {
      this.broadcastMetrics(metrics);
    });

    this.monitor.on('browser:launched', (data) => {
      this.broadcastEvent('browser:launched', data);
    });

    this.monitor.on('browser:closed', (data) => {
      this.broadcastEvent('browser:closed', data);
    });

    this.monitor.on('browser:crashed', (data) => {
      this.broadcastEvent('browser:crashed', data);
    });

    this.monitor.on('operation:started', (data) => {
      this.broadcastEvent('operation:started', data);
    });

    this.monitor.on('operation:ended', (data) => {
      this.broadcastEvent('operation:ended', data);
    });

    this.monitor.on('error:recorded', (data) => {
      this.broadcastEvent('error:recorded', data);
    });
  }

  private broadcastMetrics(metrics: any): void {
    const message = JSON.stringify({
      type: 'metrics',
      data: metrics
    });

    this.connections.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(message);
      }
    });
  }

  private broadcastEvent(type: string, data: any): void {
    const message = JSON.stringify({
      type: 'event',
      eventType: type,
      data
    });

    this.connections.forEach(ws => {
      if (ws.readyState === 1) {
        ws.send(message);
      }
    });
  }

  private generateDashboardHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PlayClone Performance Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        h1 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .card h2 {
            font-size: 1.2em;
            margin-bottom: 15px;
            opacity: 0.9;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .metric:last-child {
            border-bottom: none;
        }
        .metric-label {
            opacity: 0.8;
        }
        .metric-value {
            font-weight: bold;
            font-size: 1.1em;
        }
        .chart-container {
            height: 200px;
            margin-top: 15px;
            position: relative;
        }
        canvas {
            width: 100% !important;
            height: 100% !important;
        }
        .status {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 5px;
        }
        .status.active { background: #4ade80; }
        .status.pending { background: #fbbf24; }
        .status.error { background: #f87171; }
        .progress-bar {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            height: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            background: linear-gradient(90deg, #4ade80, #22d3ee);
            height: 100%;
            transition: width 0.3s ease;
        }
        .error-list {
            max-height: 150px;
            overflow-y: auto;
            margin-top: 10px;
        }
        .error-item {
            background: rgba(248, 113, 113, 0.2);
            padding: 8px;
            border-radius: 5px;
            margin: 5px 0;
            font-size: 0.9em;
        }
        .footer {
            text-align: center;
            opacity: 0.7;
            margin-top: 30px;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <h1>🚀 PlayClone Performance Dashboard</h1>
        
        <div class="grid">
            <div class="card">
                <h2>🌐 Browsers</h2>
                <div class="metric">
                    <span class="metric-label"><span class="status active"></span>Active</span>
                    <span class="metric-value" id="browsers-active">0</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Launched</span>
                    <span class="metric-value" id="browsers-launched">0</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Crashed</span>
                    <span class="metric-value" id="browsers-crashed">0</span>
                </div>
            </div>

            <div class="card">
                <h2>⚡ Operations</h2>
                <div class="metric">
                    <span class="metric-label">Total</span>
                    <span class="metric-value" id="ops-total">0</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Success Rate</span>
                    <span class="metric-value" id="ops-success-rate">0%</span>
                </div>
                <div class="metric">
                    <span class="metric-label"><span class="status pending"></span>Pending</span>
                    <span class="metric-value" id="ops-pending">0</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Avg Duration</span>
                    <span class="metric-value" id="ops-avg-duration">0ms</span>
                </div>
            </div>

            <div class="card">
                <h2>💻 Resources</h2>
                <div class="metric">
                    <span class="metric-label">CPU Time</span>
                    <span class="metric-value" id="cpu-time">0s</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Memory</span>
                    <span class="metric-value" id="memory-usage">0%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" id="memory-progress" style="width: 0%"></div>
                </div>
                <div class="metric">
                    <span class="metric-label">Heap</span>
                    <span class="metric-value" id="heap-usage">0%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" id="heap-progress" style="width: 0%"></div>
                </div>
            </div>

            <div class="card">
                <h2>🌍 Network</h2>
                <div class="metric">
                    <span class="metric-label">Requests</span>
                    <span class="metric-value" id="network-requests">0</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Downloaded</span>
                    <span class="metric-value" id="network-downloaded">0 B</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Uploaded</span>
                    <span class="metric-value" id="network-uploaded">0 B</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Avg Latency</span>
                    <span class="metric-value" id="network-latency">0ms</span>
                </div>
            </div>

            <div class="card" style="grid-column: span 2;">
                <h2>📊 Performance Trends</h2>
                <div class="chart-container">
                    <canvas id="performance-chart"></canvas>
                </div>
            </div>

            <div class="card">
                <h2><span class="status error"></span>Recent Errors</h2>
                <div class="metric">
                    <span class="metric-label">Total Errors</span>
                    <span class="metric-value" id="errors-total">0</span>
                </div>
                <div class="error-list" id="error-list"></div>
            </div>
        </div>

        <div class="footer">
            <p>Last updated: <span id="last-updated">Never</span> | WebSocket: <span id="ws-status">Connecting...</span></p>
        </div>
    </div>

    <script>
        const ws = new WebSocket('ws://${this.config.host}:${this.config.port}');
        let chart = null;
        const chartData = {
            labels: [],
            datasets: [
                {
                    label: 'Active Browsers',
                    data: [],
                    borderColor: '#4ade80',
                    backgroundColor: 'rgba(74, 222, 128, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Pending Operations',
                    data: [],
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Memory %',
                    data: [],
                    borderColor: '#f87171',
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        };

        function initChart() {
            const ctx = document.getElementById('performance-chart').getContext('2d');
            chart = new Chart(ctx, {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            ticks: { color: '#fff' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            max: 100,
                            ticks: { color: '#fff' },
                            grid: { drawOnChartArea: false }
                        },
                        x: {
                            ticks: { color: '#fff' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: { color: '#fff' }
                        }
                    }
                }
            });
        }

        function formatBytes(bytes) {
            const units = ['B', 'KB', 'MB', 'GB'];
            let size = bytes;
            let unitIndex = 0;
            while (size >= 1024 && unitIndex < units.length - 1) {
                size /= 1024;
                unitIndex++;
            }
            return size.toFixed(2) + ' ' + units[unitIndex];
        }

        function updateMetrics(metrics) {
            document.getElementById('browsers-active').textContent = metrics.browsers.active;
            document.getElementById('browsers-launched').textContent = metrics.browsers.launched;
            document.getElementById('browsers-crashed').textContent = metrics.browsers.crashed;
            
            document.getElementById('ops-total').textContent = metrics.operations.total;
            const successRate = metrics.operations.total > 0 
                ? ((metrics.operations.successful / metrics.operations.total) * 100).toFixed(1)
                : 0;
            document.getElementById('ops-success-rate').textContent = successRate + '%';
            document.getElementById('ops-pending').textContent = metrics.operations.pending;
            document.getElementById('ops-avg-duration').textContent = metrics.operations.avgDuration.toFixed(2) + 'ms';
            
            document.getElementById('cpu-time').textContent = metrics.resources.cpu.toFixed(2) + 's';
            document.getElementById('memory-usage').textContent = metrics.resources.memory.percentage.toFixed(1) + '%';
            document.getElementById('memory-progress').style.width = metrics.resources.memory.percentage + '%';
            document.getElementById('heap-usage').textContent = metrics.resources.heap.percentage.toFixed(1) + '%';
            document.getElementById('heap-progress').style.width = metrics.resources.heap.percentage + '%';
            
            document.getElementById('network-requests').textContent = metrics.network.requests;
            document.getElementById('network-downloaded').textContent = formatBytes(metrics.network.bytesReceived);
            document.getElementById('network-uploaded').textContent = formatBytes(metrics.network.bytesSent);
            document.getElementById('network-latency').textContent = metrics.network.avgLatency.toFixed(2) + 'ms';
            
            document.getElementById('errors-total').textContent = metrics.errors.total;
            
            const errorList = document.getElementById('error-list');
            errorList.innerHTML = '';
            metrics.errors.recentErrors.slice(-5).reverse().forEach(error => {
                const div = document.createElement('div');
                div.className = 'error-item';
                div.textContent = error.type + ': ' + error.message;
                errorList.appendChild(div);
            });
            
            document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
            
            // Update chart
            if (chart) {
                const now = new Date().toLocaleTimeString();
                chartData.labels.push(now);
                chartData.datasets[0].data.push(metrics.browsers.active);
                chartData.datasets[1].data.push(metrics.operations.pending);
                chartData.datasets[2].data.push(metrics.resources.memory.percentage);
                
                // Keep only last 20 data points
                if (chartData.labels.length > 20) {
                    chartData.labels.shift();
                    chartData.datasets.forEach(dataset => dataset.data.shift());
                }
                
                chart.update('none');
            }
        }

        ws.onopen = () => {
            document.getElementById('ws-status').textContent = 'Connected';
            document.getElementById('ws-status').style.color = '#4ade80';
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'metrics' || message.type === 'initial') {
                updateMetrics(message.data);
            }
        };

        ws.onclose = () => {
            document.getElementById('ws-status').textContent = 'Disconnected';
            document.getElementById('ws-status').style.color = '#f87171';
        };

        ws.onerror = () => {
            document.getElementById('ws-status').textContent = 'Error';
            document.getElementById('ws-status').style.color = '#f87171';
        };

        // Initialize chart when page loads
        window.addEventListener('load', initChart);
    </script>
</body>
</html>`;
  }
}