import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
import * as http from 'http';
import { Page, Browser } from 'playwright-core';

export interface LivePreviewOptions {
  port?: number;
  host?: string;
  autoOpen?: boolean;
  updateInterval?: number;
  enableHighlighting?: boolean;
  enableInspector?: boolean;
}

export interface PreviewEvent {
  type: 'navigation' | 'click' | 'input' | 'scroll' | 'screenshot' | 'element-highlight';
  timestamp: number;
  data: any;
}

export class LivePreview extends EventEmitter {
  private server: http.Server | null = null;
  private wss: WebSocket.Server | null = null;
  private clients: Set<WebSocket.WebSocket> = new Set();
  private page: Page | null = null;
  private browser: Browser | null = null; // eslint-disable-line @typescript-eslint/no-unused-vars
  private options: Required<LivePreviewOptions>;
  private updateTimer: NodeJS.Timeout | null = null;
  private eventQueue: PreviewEvent[] = [];
  private isRunning = false;
  private currentUrl = '';
  private highlightedElements: Set<string> = new Set(); // eslint-disable-line @typescript-eslint/no-unused-vars

  constructor(options: LivePreviewOptions = {}) {
    super();
    this.options = {
      port: options.port || 3456,
      host: options.host || 'localhost',
      autoOpen: options.autoOpen !== false,
      updateInterval: options.updateInterval || 100,
      enableHighlighting: options.enableHighlighting !== false,
      enableInspector: options.enableInspector !== false
    };
  }

  async start(page?: Page, _browser?: Browser): Promise<void> {
    if (this.isRunning) {
      throw new Error('Live preview is already running');
    }

    if (page) this.page = page;
    if (_browser) this.browser = _browser;

    await this.startServer();
    this.startEventCapture();
    this.isRunning = true;

    if (this.options.autoOpen) {
      await this.openPreviewWindow();
    }

    this.emit('started', { url: this.getPreviewUrl() });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.stopEventCapture();
    
    // Close all WebSocket connections
    this.clients.forEach(client => client.close());
    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    this.isRunning = false;
    this.emit('stopped');
  }

  attachToPage(page: Page): void {
    this.page = page;
    if (this.isRunning) {
      this.restartEventCapture();
    }
  }

  attachToBrowser(browser: Browser): void {
    this.browser = browser;
  }

  private async startServer(): Promise<void> {
    // Create HTTP server
    this.server = http.createServer(async (req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.getPreviewHTML());
      } else if (req.url === '/preview.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(this.getPreviewScript());
      } else if (req.url === '/preview.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(this.getPreviewStyles());
      } else if (req.url === '/screenshot') {
        await this.handleScreenshotRequest(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    // Create WebSocket server
    this.wss = new WebSocket.Server({ server: this.server });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      
      // Send initial state
      this.sendInitialState(ws);

      ws.on('message', (message) => {
        this.handleClientMessage(ws, message.toString());
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });

    // Start listening
    await new Promise<void>((resolve) => {
      this.server!.listen(this.options.port, this.options.host, () => {
        resolve();
      });
    });
  }

  private startEventCapture(): void {
    if (!this.page) return;

    // Start update timer
    this.updateTimer = setInterval(() => {
      this.processEventQueue();
    }, this.options.updateInterval);

    // Capture navigation events
    this.page.on('framenavigated', (frame) => {
      if (frame === this.page!.mainFrame()) {
        this.currentUrl = frame.url();
        this.queueEvent({
          type: 'navigation',
          timestamp: Date.now(),
          data: { url: this.currentUrl }
        });
      }
    });

    // Capture DOM events
    this.page.on('console', (msg) => {
      if (msg.type() === 'debug' && msg.text().startsWith('PLAYCLONE:')) {
        const eventData = JSON.parse(msg.text().substring(10));
        this.queueEvent(eventData);
      }
    });

    // Inject event capturing script
    this.injectEventCapture();
  }

  private stopEventCapture(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  private restartEventCapture(): void {
    this.stopEventCapture();
    this.startEventCapture();
  }

  private async injectEventCapture(): Promise<void> {
    if (!this.page) return;

    try {
      await this.page.evaluate(() => {
        // Capture click events
        document.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          console.debug(`PLAYCLONE:${JSON.stringify({
            type: 'click',
            timestamp: Date.now(),
            data: {
              x: e.clientX,
              y: e.clientY,
              element: target.tagName,
              text: target.textContent?.substring(0, 50)
            }
          })}`);
        }, true);

        // Capture input events
        document.addEventListener('input', (e) => {
          const target = e.target as HTMLInputElement;
          console.debug(`PLAYCLONE:${JSON.stringify({
            type: 'input',
            timestamp: Date.now(),
            data: {
              element: target.tagName,
              name: target.name,
              value: target.value?.substring(0, 50)
            }
          })}`);
        }, true);

        // Capture scroll events (throttled)
        let scrollTimeout: any;
        document.addEventListener('scroll', () => {
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            console.debug(`PLAYCLONE:${JSON.stringify({
              type: 'scroll',
              timestamp: Date.now(),
              data: {
                x: window.scrollX,
                y: window.scrollY
              }
            })}`);
          }, 100);
        }, true);
      });
    } catch (error) {
      // Page might have navigated, will retry on next navigation
    }
  }

  private queueEvent(event: PreviewEvent): void {
    this.eventQueue.push(event);
    if (this.eventQueue.length > 100) {
      this.eventQueue.shift(); // Keep queue size manageable
    }
  }

  private processEventQueue(): void {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0, this.eventQueue.length);
    this.broadcast({
      type: 'events',
      events
    });
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  private async sendInitialState(ws: WebSocket.WebSocket): Promise<void> {
    if (!this.page) {
      ws.send(JSON.stringify({
        type: 'initial',
        data: { connected: false }
      }));
      return;
    }

    try {
      const screenshot = await this.page.screenshot({ 
        type: 'jpeg', 
        quality: 80,
        fullPage: false 
      });

      ws.send(JSON.stringify({
        type: 'initial',
        data: {
          connected: true,
          url: this.currentUrl || await this.page.url(),
          screenshot: screenshot.toString('base64')
        }
      }));
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'initial',
        data: { connected: false, error: error instanceof Error ? error.message : String(error) }
      }));
    }
  }

  private async handleScreenshotRequest(res: http.ServerResponse): Promise<void> {
    if (!this.page) {
      res.writeHead(404);
      res.end('No page attached');
      return;
    }

    try {
      const screenshot = await this.page.screenshot({ 
        type: 'jpeg', 
        quality: 80,
        fullPage: false 
      });
      
      res.writeHead(200, { 
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-cache'
      });
      res.end(screenshot);
    } catch (error) {
      res.writeHead(500);
      res.end('Failed to capture screenshot');
    }
  }

  private async handleClientMessage(ws: WebSocket.WebSocket, message: string): Promise<void> {
    try {
      const msg = JSON.parse(message);
      
      switch (msg.type) {
        case 'highlight':
          await this.highlightElement(msg.selector);
          break;
        case 'inspect':
          await this.inspectElement(msg.selector);
          break;
        case 'refresh-screenshot':
          await this.sendScreenshot(ws);
          break;
        case 'execute':
          await this.executeAction(msg.action, msg.params);
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        error: (error as Error).message
      }));
    }
  }

  private async highlightElement(selector: string): Promise<void> {
    if (!this.page || !this.options.enableHighlighting) return;

    try {
      await this.page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        elements.forEach((el: any) => {
          el.style.outline = '2px solid red';
          el.style.outlineOffset = '2px';
          setTimeout(() => {
            el.style.outline = '';
            el.style.outlineOffset = '';
          }, 2000);
        });
      }, selector);

      this.queueEvent({
        type: 'element-highlight',
        timestamp: Date.now(),
        data: { selector }
      });
    } catch (error) {
      // Ignore highlight errors
    }
  }

  private async inspectElement(selector: string): Promise<void> {
    if (!this.page || !this.options.enableInspector) return;

    try {
      const elementInfo = await this.page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        if (!el) return null;

        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        
        return {
          tagName: el.tagName,
          id: el.id,
          classes: Array.from(el.classList),
          text: el.textContent?.substring(0, 100),
          position: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          },
          styles: {
            display: styles.display,
            position: styles.position,
            color: styles.color,
            backgroundColor: styles.backgroundColor,
            fontSize: styles.fontSize,
            fontWeight: styles.fontWeight
          }
        };
      }, selector);

      this.broadcast({
        type: 'inspect-result',
        data: elementInfo
      });
    } catch (error) {
      // Ignore inspect errors
    }
  }

  private async sendScreenshot(ws: WebSocket.WebSocket): Promise<void> {
    if (!this.page) return;

    try {
      const screenshot = await this.page.screenshot({ 
        type: 'jpeg', 
        quality: 80,
        fullPage: false 
      });

      ws.send(JSON.stringify({
        type: 'screenshot',
        data: screenshot.toString('base64')
      }));
    } catch (error) {
      // Ignore screenshot errors
    }
  }

  private async executeAction(action: string, params: any): Promise<void> {
    if (!this.page) return;

    try {
      switch (action) {
        case 'click':
          await this.page.click(params.selector);
          break;
        case 'fill':
          await this.page.fill(params.selector, params.value);
          break;
        case 'navigate':
          await this.page.goto(params.url);
          break;
        case 'back':
          await this.page.goBack();
          break;
        case 'forward':
          await this.page.goForward();
          break;
        case 'reload':
          await this.page.reload();
          break;
      }

      // Send updated screenshot after action
      await new Promise(resolve => setTimeout(resolve, 500));
      this.broadcast({
        type: 'action-complete',
        action,
        screenshot: await this.getScreenshotBase64()
      });
    } catch (error) {
      this.broadcast({
        type: 'action-error',
        action,
        error: (error as Error).message
      });
    }
  }

  private async getScreenshotBase64(): Promise<string> {
    if (!this.page) return '';
    
    try {
      const screenshot = await this.page.screenshot({ 
        type: 'jpeg', 
        quality: 80,
        fullPage: false 
      });
      return screenshot.toString('base64');
    } catch {
      return '';
    }
  }

  private async openPreviewWindow(): Promise<void> {
    const url = this.getPreviewUrl();
    
    // Try to open in default browser
    const { exec } = require('child_process');
    const platform = process.platform;
    
    let command: string;
    if (platform === 'darwin') {
      command = `open ${url}`;
    } else if (platform === 'win32') {
      command = `start ${url}`;
    } else {
      command = `xdg-open ${url}`;
    }

    exec(command, (error: any) => {
      if (error) {
        console.log(`Open preview manually at: ${url}`);
      }
    });
  }

  getPreviewUrl(): string {
    return `http://${this.options.host}:${this.options.port}`;
  }

  private getPreviewHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PlayClone Live Preview</title>
    <link rel="stylesheet" href="/preview.css">
</head>
<body>
    <div id="app">
        <header>
            <h1>🎭 PlayClone Live Preview</h1>
            <div class="status">
                <span id="connection-status" class="disconnected">Disconnected</span>
                <span id="current-url"></span>
            </div>
        </header>
        
        <div class="toolbar">
            <button id="refresh-btn">🔄 Refresh</button>
            <button id="back-btn">⬅️ Back</button>
            <button id="forward-btn">➡️ Forward</button>
            <button id="reload-btn">🔃 Reload Page</button>
            <input type="text" id="url-input" placeholder="Enter URL...">
            <button id="navigate-btn">Go</button>
        </div>

        <div class="main-content">
            <div class="preview-container">
                <div id="preview-frame">
                    <img id="screenshot" alt="Browser Preview">
                    <div id="overlay"></div>
                </div>
            </div>
            
            <div class="sidebar">
                <div class="events-panel">
                    <h3>📊 Events</h3>
                    <div id="events-list"></div>
                </div>
                
                <div class="inspector-panel">
                    <h3>🔍 Inspector</h3>
                    <div id="inspector-content">
                        <p>Click on an element to inspect</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script src="/preview.js"></script>
</body>
</html>`;
  }

  private getPreviewStyles(): string {
    return `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #1a1a1a;
    color: #e0e0e0;
    height: 100vh;
    overflow: hidden;
}

#app {
    display: flex;
    flex-direction: column;
    height: 100vh;
}

header {
    background: #2a2a2a;
    padding: 1rem;
    border-bottom: 1px solid #444;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

h1 {
    font-size: 1.5rem;
    color: #4CAF50;
}

.status {
    display: flex;
    gap: 1rem;
    align-items: center;
}

#connection-status {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 500;
}

#connection-status.connected {
    background: #4CAF50;
    color: white;
}

#connection-status.disconnected {
    background: #f44336;
    color: white;
}

#current-url {
    color: #888;
    font-size: 0.875rem;
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.toolbar {
    background: #333;
    padding: 0.75rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    border-bottom: 1px solid #444;
}

.toolbar button {
    padding: 0.5rem 1rem;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background 0.2s;
}

.toolbar button:hover {
    background: #45a049;
}

.toolbar button:active {
    transform: scale(0.98);
}

#url-input {
    flex: 1;
    padding: 0.5rem;
    background: #2a2a2a;
    color: #e0e0e0;
    border: 1px solid #444;
    border-radius: 4px;
    font-size: 0.875rem;
}

.main-content {
    flex: 1;
    display: flex;
    overflow: hidden;
}

.preview-container {
    flex: 1;
    padding: 1rem;
    overflow: auto;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #222;
}

#preview-frame {
    position: relative;
    max-width: 100%;
    max-height: 100%;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    border-radius: 8px;
    overflow: hidden;
}

#screenshot {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
}

#overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
}

.sidebar {
    width: 350px;
    background: #2a2a2a;
    border-left: 1px solid #444;
    display: flex;
    flex-direction: column;
}

.events-panel, .inspector-panel {
    flex: 1;
    padding: 1rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.events-panel {
    border-bottom: 1px solid #444;
}

.events-panel h3, .inspector-panel h3 {
    margin-bottom: 1rem;
    color: #4CAF50;
}

#events-list {
    flex: 1;
    overflow-y: auto;
    font-size: 0.875rem;
}

.event-item {
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    background: #333;
    border-radius: 4px;
    border-left: 3px solid #4CAF50;
}

.event-type {
    font-weight: 600;
    color: #4CAF50;
    margin-bottom: 0.25rem;
}

.event-details {
    color: #aaa;
    font-size: 0.8rem;
}

#inspector-content {
    flex: 1;
    overflow-y: auto;
    font-size: 0.875rem;
}

.inspector-property {
    margin-bottom: 0.5rem;
}

.inspector-label {
    font-weight: 600;
    color: #4CAF50;
    margin-bottom: 0.25rem;
}

.inspector-value {
    color: #aaa;
    padding-left: 1rem;
}

.click-indicator {
    position: absolute;
    width: 20px;
    height: 20px;
    border: 2px solid #4CAF50;
    border-radius: 50%;
    pointer-events: none;
    animation: pulse 0.5s ease-out;
}

@keyframes pulse {
    0% {
        transform: scale(1);
        opacity: 1;
    }
    100% {
        transform: scale(2);
        opacity: 0;
    }
}`;
  }

  private getPreviewScript(): string {
    return `const ws = new WebSocket('ws://' + window.location.host);
const screenshot = document.getElementById('screenshot');
const overlay = document.getElementById('overlay');
const connectionStatus = document.getElementById('connection-status');
const currentUrl = document.getElementById('current-url');
const eventsList = document.getElementById('events-list');
const inspectorContent = document.getElementById('inspector-content');

// Toolbar buttons
const refreshBtn = document.getElementById('refresh-btn');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const urlInput = document.getElementById('url-input');
const navigateBtn = document.getElementById('navigate-btn');

let isConnected = false;
const maxEvents = 50;

ws.onopen = () => {
    isConnected = true;
    connectionStatus.textContent = 'Connected';
    connectionStatus.className = 'connected';
};

ws.onclose = () => {
    isConnected = false;
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.className = 'disconnected';
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
        case 'initial':
            handleInitialState(message.data);
            break;
        case 'events':
            handleEvents(message.events);
            break;
        case 'screenshot':
            updateScreenshot(message.data);
            break;
        case 'inspect-result':
            updateInspector(message.data);
            break;
        case 'action-complete':
            updateScreenshot(message.screenshot);
            addEvent({
                type: 'action',
                timestamp: Date.now(),
                data: { action: message.action }
            });
            break;
        case 'action-error':
            addEvent({
                type: 'error',
                timestamp: Date.now(),
                data: { action: message.action, error: message.error }
            });
            break;
    }
};

function handleInitialState(data) {
    if (data.connected) {
        if (data.screenshot) {
            updateScreenshot(data.screenshot);
        }
        if (data.url) {
            currentUrl.textContent = data.url;
            urlInput.value = data.url;
        }
    }
}

function handleEvents(events) {
    events.forEach(event => {
        addEvent(event);
        
        if (event.type === 'click') {
            showClickIndicator(event.data.x, event.data.y);
        } else if (event.type === 'navigation') {
            currentUrl.textContent = event.data.url;
            urlInput.value = event.data.url;
            requestScreenshot();
        }
    });
}

function addEvent(event) {
    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    
    const eventType = document.createElement('div');
    eventType.className = 'event-type';
    eventType.textContent = event.type.toUpperCase();
    
    const eventDetails = document.createElement('div');
    eventDetails.className = 'event-details';
    eventDetails.textContent = JSON.stringify(event.data, null, 2);
    
    eventItem.appendChild(eventType);
    eventItem.appendChild(eventDetails);
    
    eventsList.insertBefore(eventItem, eventsList.firstChild);
    
    // Keep only maxEvents
    while (eventsList.children.length > maxEvents) {
        eventsList.removeChild(eventsList.lastChild);
    }
}

function updateScreenshot(base64Data) {
    screenshot.src = 'data:image/jpeg;base64,' + base64Data;
}

function updateInspector(data) {
    if (!data) {
        inspectorContent.innerHTML = '<p>Element not found</p>';
        return;
    }
    
    inspectorContent.innerHTML = \`
        <div class="inspector-property">
            <div class="inspector-label">Tag:</div>
            <div class="inspector-value">\${data.tagName}</div>
        </div>
        <div class="inspector-property">
            <div class="inspector-label">ID:</div>
            <div class="inspector-value">\${data.id || 'none'}</div>
        </div>
        <div class="inspector-property">
            <div class="inspector-label">Classes:</div>
            <div class="inspector-value">\${data.classes.join(', ') || 'none'}</div>
        </div>
        <div class="inspector-property">
            <div class="inspector-label">Text:</div>
            <div class="inspector-value">\${data.text || 'none'}</div>
        </div>
        <div class="inspector-property">
            <div class="inspector-label">Position:</div>
            <div class="inspector-value">
                Top: \${data.position.top}px<br>
                Left: \${data.position.left}px<br>
                Width: \${data.position.width}px<br>
                Height: \${data.position.height}px
            </div>
        </div>
        <div class="inspector-property">
            <div class="inspector-label">Styles:</div>
            <div class="inspector-value">
                Display: \${data.styles.display}<br>
                Position: \${data.styles.position}<br>
                Color: \${data.styles.color}<br>
                Background: \${data.styles.backgroundColor}<br>
                Font Size: \${data.styles.fontSize}
            </div>
        </div>
    \`;
}

function showClickIndicator(x, y) {
    const indicator = document.createElement('div');
    indicator.className = 'click-indicator';
    
    // Calculate position relative to screenshot
    const rect = screenshot.getBoundingClientRect();
    const scaleX = screenshot.naturalWidth / rect.width;
    const scaleY = screenshot.naturalHeight / rect.height;
    
    indicator.style.left = (x / scaleX) + 'px';
    indicator.style.top = (y / scaleY) + 'px';
    
    overlay.appendChild(indicator);
    
    setTimeout(() => {
        overlay.removeChild(indicator);
    }, 500);
}

function requestScreenshot() {
    if (isConnected) {
        ws.send(JSON.stringify({ type: 'refresh-screenshot' }));
    }
}

function sendAction(action, params = {}) {
    if (isConnected) {
        ws.send(JSON.stringify({ type: 'execute', action, params }));
    }
}

// Toolbar event handlers
refreshBtn.addEventListener('click', () => {
    requestScreenshot();
});

backBtn.addEventListener('click', () => {
    sendAction('back');
});

forwardBtn.addEventListener('click', () => {
    sendAction('forward');
});

reloadBtn.addEventListener('click', () => {
    sendAction('reload');
});

navigateBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url) {
        sendAction('navigate', { url });
    }
});

urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const url = urlInput.value.trim();
        if (url) {
            sendAction('navigate', { url });
        }
    }
});

// Auto-refresh screenshot every 2 seconds
setInterval(() => {
    if (isConnected) {
        requestScreenshot();
    }
}, 2000);`;
  }
}