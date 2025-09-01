import * as vscode from 'vscode';
import { PlayCloneSession } from './playCloneSession';

export class SelectorBuilder implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;

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
                    case 'testSelector':
                        await this.testSelector(message.selector);
                        break;
                    case 'highlightElement':
                        await this.highlightElement(message.selector);
                        break;
                    case 'copySelector':
                        await this.copySelector(message.selector);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    async show(): Promise<void> {
        if (this.view) {
            this.view.show(true);
        }
    }

    private async testSelector(selector: string): Promise<void> {
        try {
            const result = await this.session.getText(selector);
            if (result.success) {
                vscode.window.showInformationMessage(`Element found: ${result.data}`);
                this.view?.webview.postMessage({
                    command: 'selectorResult',
                    success: true,
                    data: result.data
                });
            } else {
                vscode.window.showWarningMessage('Element not found');
                this.view?.webview.postMessage({
                    command: 'selectorResult',
                    success: false,
                    error: 'Element not found'
                });
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Selector test failed: ${error.message}`);
            this.view?.webview.postMessage({
                command: 'selectorResult',
                success: false,
                error: error.message
            });
        }
    }

    private async highlightElement(selector: string): Promise<void> {
        // Would inject script to highlight element in browser
        vscode.window.showInformationMessage(`Highlighting: ${selector}`);
    }

    private async copySelector(selector: string): Promise<void> {
        await vscode.env.clipboard.writeText(selector);
        vscode.window.showInformationMessage('Selector copied to clipboard');
    }

    private getHtmlContent(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Selector Builder</title>
            <style>
                body {
                    padding: 10px;
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                input, textarea {
                    width: 100%;
                    padding: 6px;
                    margin: 4px 0;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    font-family: monospace;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 14px;
                    cursor: pointer;
                    margin: 4px;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .section {
                    margin: 15px 0;
                    padding: 10px;
                    border: 1px solid var(--vscode-panel-border);
                }
                .result {
                    margin-top: 10px;
                    padding: 8px;
                    background-color: var(--vscode-editor-lineHighlightBackground);
                    font-family: monospace;
                    font-size: 12px;
                    white-space: pre-wrap;
                }
                .success {
                    border-left: 3px solid var(--vscode-testing-iconPassed);
                }
                .error {
                    border-left: 3px solid var(--vscode-testing-iconFailed);
                }
                h4 {
                    margin-top: 0;
                }
                .selector-type {
                    display: flex;
                    gap: 10px;
                    margin: 10px 0;
                }
                label {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
            </style>
        </head>
        <body>
            <h3>Selector Builder</h3>
            
            <div class="section">
                <h4>Natural Language Selector</h4>
                <input type="text" id="nlSelector" placeholder="e.g., 'blue login button', 'search input field'">
                <button onclick="testNaturalLanguage()">Test</button>
                <button onclick="copyNaturalLanguage()">Copy</button>
            </div>

            <div class="section">
                <h4>CSS Selector</h4>
                <input type="text" id="cssSelector" placeholder="e.g., #login-btn, .submit-button">
                <button onclick="testCSS()">Test</button>
                <button onclick="copyCSS()">Copy</button>
            </div>

            <div class="section">
                <h4>XPath Selector</h4>
                <input type="text" id="xpathSelector" placeholder="e.g., //button[@id='submit']">
                <button onclick="testXPath()">Test</button>
                <button onclick="copyXPath()">Copy</button>
            </div>

            <div class="section">
                <h4>Smart Builder</h4>
                <div class="selector-type">
                    <label><input type="radio" name="type" value="button" checked> Button</label>
                    <label><input type="radio" name="type" value="input"> Input</label>
                    <label><input type="radio" name="type" value="link"> Link</label>
                    <label><input type="radio" name="type" value="text"> Text</label>
                </div>
                <input type="text" id="smartText" placeholder="Text or label to find">
                <button onclick="buildSmartSelector()">Build & Test</button>
            </div>

            <div id="result"></div>

            <script>
                const vscode = acquireVsCodeApi();

                function testNaturalLanguage() {
                    const selector = document.getElementById('nlSelector').value;
                    if (selector) {
                        vscode.postMessage({ command: 'testSelector', selector });
                    }
                }

                function copyNaturalLanguage() {
                    const selector = document.getElementById('nlSelector').value;
                    if (selector) {
                        vscode.postMessage({ command: 'copySelector', selector });
                    }
                }

                function testCSS() {
                    const selector = document.getElementById('cssSelector').value;
                    if (selector) {
                        vscode.postMessage({ command: 'testSelector', selector });
                    }
                }

                function copyCSS() {
                    const selector = document.getElementById('cssSelector').value;
                    if (selector) {
                        vscode.postMessage({ command: 'copySelector', selector });
                    }
                }

                function testXPath() {
                    const selector = document.getElementById('xpathSelector').value;
                    if (selector) {
                        vscode.postMessage({ command: 'testSelector', selector });
                    }
                }

                function copyXPath() {
                    const selector = document.getElementById('xpathSelector').value;
                    if (selector) {
                        vscode.postMessage({ command: 'copySelector', selector });
                    }
                }

                function buildSmartSelector() {
                    const type = document.querySelector('input[name="type"]:checked').value;
                    const text = document.getElementById('smartText').value;
                    
                    if (!text) return;
                    
                    let selector = '';
                    switch(type) {
                        case 'button':
                            selector = text + ' button';
                            break;
                        case 'input':
                            selector = text + ' input field';
                            break;
                        case 'link':
                            selector = text + ' link';
                            break;
                        case 'text':
                            selector = 'text containing ' + text;
                            break;
                    }
                    
                    document.getElementById('nlSelector').value = selector;
                    testNaturalLanguage();
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'selectorResult') {
                        const resultDiv = document.getElementById('result');
                        if (message.success) {
                            resultDiv.className = 'result success';
                            resultDiv.textContent = 'Found: ' + message.data;
                        } else {
                            resultDiv.className = 'result error';
                            resultDiv.textContent = 'Error: ' + message.error;
                        }
                    }
                });
            </script>
        </body>
        </html>`;
    }
}