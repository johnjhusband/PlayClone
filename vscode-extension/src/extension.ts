import * as vscode from 'vscode';
import { BrowserRecorder } from './browserRecorder';
import { SelectorBuilder } from './selectorBuilder';
import { BrowserPreview } from './browserPreview';
import { PlayCloneSession } from './playCloneSession';
import { CodeGenerator } from './codeGenerator';

let browserRecorder: BrowserRecorder;
let selectorBuilder: SelectorBuilder;
let browserPreview: BrowserPreview;
let playCloneSession: PlayCloneSession;

export function activate(context: vscode.ExtensionContext) {
    console.log('PlayClone extension is now active!');

    // Initialize components
    playCloneSession = new PlayCloneSession(context);
    browserRecorder = new BrowserRecorder(context, playCloneSession);
    selectorBuilder = new SelectorBuilder(context, playCloneSession);
    browserPreview = new BrowserPreview(context, playCloneSession);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('playclone.startRecording', async () => {
            await browserRecorder.startRecording();
            vscode.commands.executeCommand('setContext', 'playclone.recording', true);
            vscode.window.showInformationMessage('PlayClone: Recording started');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('playclone.stopRecording', async () => {
            const code = await browserRecorder.stopRecording();
            vscode.commands.executeCommand('setContext', 'playclone.recording', false);
            
            if (code) {
                // Create new document with generated code
                const doc = await vscode.workspace.openTextDocument({
                    language: 'javascript',
                    content: code
                });
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage('PlayClone: Recording stopped and code generated');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('playclone.runScript', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            const code = editor.document.getText();
            await playCloneSession.runScript(code);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('playclone.showSelector', async () => {
            await selectorBuilder.show();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('playclone.openBrowser', async () => {
            await playCloneSession.openBrowser();
            vscode.window.showInformationMessage('PlayClone: Browser opened');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('playclone.closeBrowser', async () => {
            await playCloneSession.closeBrowser();
            vscode.window.showInformationMessage('PlayClone: Browser closed');
        })
    );

    // Register webview providers
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('playclone.recorder', browserRecorder)
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('playclone.selector', selectorBuilder)
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('playclone.browser', browserPreview)
    );

    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(browser) PlayClone';
    statusBarItem.tooltip = 'PlayClone Browser Automation';
    statusBarItem.command = 'playclone.showSelector';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

export function deactivate() {
    if (playCloneSession) {
        playCloneSession.dispose();
    }
}