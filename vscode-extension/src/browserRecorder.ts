import * as vscode from 'vscode';
import { PlayCloneSession } from './playCloneSession';
import { CodeGenerator } from './codeGenerator';

interface RecordedAction {
    type: 'navigate' | 'click' | 'fill' | 'select' | 'check' | 'hover' | 'screenshot';
    selector?: string;
    value?: string;
    url?: string;
    timestamp: number;
}

export class BrowserRecorder implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private recording: boolean = false;
    private actions: RecordedAction[] = [];
    private codeGenerator: CodeGenerator;

    constructor(
        private context: vscode.ExtensionContext,
        private session: PlayCloneSession
    ) {
        this.codeGenerator = new CodeGenerator();
    }

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
                    case 'start':
                        await this.startRecording();
                        break;
                    case 'stop':
                        await this.stopRecording();
                        break;
                    case 'clear':
                        this.clearActions();
                        break;
                    case 'generateCode':
                        this.generateCode();
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    async startRecording(): Promise<void> {
        this.recording = true;
        this.actions = [];

        // Open browser if not already open
        await this.session.openBrowser();

        // Inject recording script into the page
        await this.injectRecordingScript();

        this.updateView();
    }

    async stopRecording(): Promise<string> {
        this.recording = false;
        const code = this.codeGenerator.generate(this.actions);
        this.updateView();
        return code;
    }

    private async injectRecordingScript(): Promise<void> {
        // This would inject a script to capture user interactions
        // For now, we'll simulate with manual recording
        vscode.window.showInformationMessage('Recording mode active. Actions will be captured.');
    }

    recordAction(action: RecordedAction): void {
        if (!this.recording) return;
        
        action.timestamp = Date.now();
        this.actions.push(action);
        this.updateView();
    }

    clearActions(): void {
        this.actions = [];
        this.updateView();
    }

    generateCode(): void {
        const code = this.codeGenerator.generate(this.actions);
        
        // Open new editor with generated code
        vscode.workspace.openTextDocument({
            language: 'javascript',
            content: code
        }).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    }

    private updateView(): void {
        if (!this.view) return;

        this.view.webview.postMessage({
            command: 'update',
            recording: this.recording,
            actions: this.actions
        });
    }

    private getHtmlContent(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PlayClone Recorder</title>
            <style>
                body {
                    padding: 10px;
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
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
                .actions {
                    margin-top: 10px;
                    border: 1px solid var(--vscode-panel-border);
                    padding: 10px;
                    max-height: 300px;
                    overflow-y: auto;
                }
                .action {
                    padding: 4px;
                    margin: 2px 0;
                    background-color: var(--vscode-editor-lineHighlightBackground);
                    font-family: monospace;
                    font-size: 12px;
                }
                .status {
                    margin: 10px 0;
                    padding: 8px;
                    background-color: var(--vscode-inputValidation-infoBackground);
                    border: 1px solid var(--vscode-inputValidation-infoBorder);
                }
                .recording {
                    background-color: var(--vscode-inputValidation-warningBackground);
                    border-color: var(--vscode-inputValidation-warningBorder);
                }
            </style>
        </head>
        <body>
            <h3>Browser Recorder</h3>
            <div id="status" class="status">Ready</div>
            <div>
                <button id="startBtn" onclick="start()">Start Recording</button>
                <button id="stopBtn" onclick="stop()" disabled>Stop Recording</button>
                <button onclick="clear()">Clear</button>
                <button onclick="generateCode()">Generate Code</button>
            </div>
            <div class="actions">
                <h4>Recorded Actions:</h4>
                <div id="actionsList"></div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                let recording = false;
                let actions = [];

                function start() {
                    vscode.postMessage({ command: 'start' });
                }

                function stop() {
                    vscode.postMessage({ command: 'stop' });
                }

                function clear() {
                    vscode.postMessage({ command: 'clear' });
                }

                function generateCode() {
                    vscode.postMessage({ command: 'generateCode' });
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'update') {
                        recording = message.recording;
                        actions = message.actions;
                        updateUI();
                    }
                });

                function updateUI() {
                    const startBtn = document.getElementById('startBtn');
                    const stopBtn = document.getElementById('stopBtn');
                    const status = document.getElementById('status');
                    const actionsList = document.getElementById('actionsList');

                    startBtn.disabled = recording;
                    stopBtn.disabled = !recording;

                    if (recording) {
                        status.textContent = 'Recording...';
                        status.className = 'status recording';
                    } else {
                        status.textContent = 'Ready';
                        status.className = 'status';
                    }

                    actionsList.innerHTML = actions.map(action => {
                        let text = action.type;
                        if (action.url) text += ': ' + action.url;
                        if (action.selector) text += ' - ' + action.selector;
                        if (action.value) text += ' = "' + action.value + '"';
                        return '<div class="action">' + text + '</div>';
                    }).join('');
                }
            </script>
        </body>
        </html>`;
    }
}