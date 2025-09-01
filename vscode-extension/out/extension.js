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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const browserRecorder_1 = require("./browserRecorder");
const selectorBuilder_1 = require("./selectorBuilder");
const browserPreview_1 = require("./browserPreview");
const playCloneSession_1 = require("./playCloneSession");
let browserRecorder;
let selectorBuilder;
let browserPreview;
let playCloneSession;
function activate(context) {
    console.log('PlayClone extension is now active!');
    // Initialize components
    playCloneSession = new playCloneSession_1.PlayCloneSession(context);
    browserRecorder = new browserRecorder_1.BrowserRecorder(context, playCloneSession);
    selectorBuilder = new selectorBuilder_1.SelectorBuilder(context, playCloneSession);
    browserPreview = new browserPreview_1.BrowserPreview(context, playCloneSession);
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('playclone.startRecording', async () => {
        await browserRecorder.startRecording();
        vscode.commands.executeCommand('setContext', 'playclone.recording', true);
        vscode.window.showInformationMessage('PlayClone: Recording started');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('playclone.stopRecording', async () => {
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
    }));
    context.subscriptions.push(vscode.commands.registerCommand('playclone.runScript', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }
        const code = editor.document.getText();
        await playCloneSession.runScript(code);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('playclone.showSelector', async () => {
        await selectorBuilder.show();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('playclone.openBrowser', async () => {
        await playCloneSession.openBrowser();
        vscode.window.showInformationMessage('PlayClone: Browser opened');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('playclone.closeBrowser', async () => {
        await playCloneSession.closeBrowser();
        vscode.window.showInformationMessage('PlayClone: Browser closed');
    }));
    // Register webview providers
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('playclone.recorder', browserRecorder));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('playclone.selector', selectorBuilder));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('playclone.browser', browserPreview));
    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(browser) PlayClone';
    statusBarItem.tooltip = 'PlayClone Browser Automation';
    statusBarItem.command = 'playclone.showSelector';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}
function deactivate() {
    if (playCloneSession) {
        playCloneSession.dispose();
    }
}
//# sourceMappingURL=extension.js.map