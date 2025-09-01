"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserPreview = void 0;
const vscode = __importStar(require("vscode"));
class BrowserPreview {
    constructor(context, session) {
        this.context = context;
        this.session = session;
    }
    resolveWebviewView(webviewView, context, token) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };
        webviewView.webview.html = this.getHtmlContent(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'refresh':
                    await this.refreshPreview();
                    break;
                case 'navigate':
                    await this.navigate(message.url);
                    break;
                case 'startAutoRefresh':
                    this.startAutoRefresh();
                    break;
                case 'stopAutoRefresh':
                    this.stopAutoRefresh();
                    break;
            }
        }, undefined, this.context.subscriptions);
        webviewView.onDidDispose(() => {
            this.stopAutoRefresh();
        });
    }
    async refreshPreview() {
        try {
            const screenshotPath = await this.session.screenshot();
            const currentUrl = await this.session.getCurrentUrl();
            // Convert screenshot to base64 for webview
            const fs = require('fs');
            const imageData = fs.readFileSync(screenshotPath);
            const base64Image = imageData.toString('base64');
            this.view?.webview.postMessage({
                command: 'updatePreview',
                screenshot: `data:image/png;base64,${base64Image}`,
                url: currentUrl
            });
        }
        catch (error) {
            console.error('Failed to refresh preview:', error);
            this.view?.webview.postMessage({
                command: 'error',
                message: error.message
            });
        }
    }
    async navigate(url) {
        try {
            await this.session.navigate(url);
            await this.refreshPreview();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Navigation failed: ${error.message}`);
        }
    }
    startAutoRefresh() {
        this.stopAutoRefresh();
        this.updateInterval = setInterval(() => {
            this.refreshPreview();
        }, 2000); // Refresh every 2 seconds
    }
    stopAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = undefined;
        }
    }
    getHtmlContent(webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Browser Preview</title>
            <style>
                body {
                    margin: 0;
                    padding: 10px;
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                .controls {
                    display: flex;
                    gap: 5px;
                    margin-bottom: 10px;
                    align-items: center;
                }
                input {
                    flex: 1;
                    padding: 6px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 10px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .preview-container {
                    border: 1px solid var(--vscode-panel-border);
                    overflow: auto;
                    position: relative;
                    background: white;
                    min-height: 400px;
                }
                #preview {
                    width: 100%;
                    display: block;
                }
                .error {
                    padding: 20px;
                    text-align: center;
                    color: var(--vscode-errorForeground);
                }
                .placeholder {
                    padding: 40px;
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                }
                .auto-refresh {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .status {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-left: 10px;
                }
            </style>
        </head>
        <body>
            <div class="controls">
                <input type="url" id="urlInput" placeholder="https://example.com">
                <button onclick="navigate()">Go</button>
                <button onclick="refresh()">Refresh</button>
                <div class="auto-refresh">
                    <input type="checkbox" id="autoRefresh" onchange="toggleAutoRefresh()">
                    <label for="autoRefresh">Auto</label>
                </div>
                <span id="status" class="status"></span>
            </div>
            <div class="preview-container">
                <img id="preview" style="display:none;">
                <div id="placeholder" class="placeholder">
                    Open a browser to see preview
                </div>
                <div id="error" class="error" style="display:none;"></div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                let autoRefreshing = false;

                function refresh() {
                    vscode.postMessage({ command: 'refresh' });
                    updateStatus('Refreshing...');
                }

                function navigate() {
                    const url = document.getElementById('urlInput').value;
                    if (url) {
                        vscode.postMessage({ command: 'navigate', url });
                        updateStatus('Navigating...');
                    }
                }

                function toggleAutoRefresh() {
                    const checkbox = document.getElementById('autoRefresh');
                    autoRefreshing = checkbox.checked;
                    
                    if (autoRefreshing) {
                        vscode.postMessage({ command: 'startAutoRefresh' });
                        updateStatus('Auto-refresh enabled');
                    } else {
                        vscode.postMessage({ command: 'stopAutoRefresh' });
                        updateStatus('Auto-refresh disabled');
                    }
                }

                function updateStatus(text) {
                    const status = document.getElementById('status');
                    status.textContent = text;
                    setTimeout(() => {
                        if (!autoRefreshing) {
                            status.textContent = '';
                        }
                    }, 2000);
                }

                document.getElementById('urlInput').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        navigate();
                    }
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    if (message.command === 'updatePreview') {
                        document.getElementById('preview').src = message.screenshot;
                        document.getElementById('preview').style.display = 'block';
                        document.getElementById('placeholder').style.display = 'none';
                        document.getElementById('error').style.display = 'none';
                        
                        if (message.url) {
                            document.getElementById('urlInput').value = message.url;
                        }
                        
                        updateStatus('Updated');
                    } else if (message.command === 'error') {
                        document.getElementById('error').textContent = message.message;
                        document.getElementById('error').style.display = 'block';
                        document.getElementById('preview').style.display = 'none';
                        document.getElementById('placeholder').style.display = 'none';
                        updateStatus('Error');
                    }
                });

                // Initial refresh
                setTimeout(() => refresh(), 1000);
            </script>
        </body>
        </html>`;
    }
}
exports.BrowserPreview = BrowserPreview;
//# sourceMappingURL=browserPreview.js.map