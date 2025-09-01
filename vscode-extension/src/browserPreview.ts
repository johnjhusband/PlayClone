import * as vscode from 'vscode';
import { PlayCloneSession } from './playCloneSession';

export class BrowserPreview implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private updateInterval?: NodeJS.Timeout;

    constructor(
        private context: vscode.ExtensionContext,
        private session: PlayCloneSession
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlContent(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(
            async message => {
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
            },
            undefined,
            this.context.subscriptions
        );

        webviewView.onDidDispose(() => {
            this.stopAutoRefresh();
        });
    }

    private async refreshPreview(): Promise<void> {
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
        } catch (error: any) {
            console.error('Failed to refresh preview:', error);
            this.view?.webview.postMessage({
                command: 'error',
                message: error.message
            });
        }
    }

    private async navigate(url: string): Promise<void> {
        try {
            await this.session.navigate(url);
            await this.refreshPreview();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Navigation failed: ${error.message}`);
        }
    }

    private startAutoRefresh(): void {
        this.stopAutoRefresh();
        this.updateInterval = setInterval(() => {
            this.refreshPreview();
        }, 2000); // Refresh every 2 seconds
    }

    private stopAutoRefresh(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = undefined;
        }
    }

    private getHtmlContent(webview: vscode.Webview): string {
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