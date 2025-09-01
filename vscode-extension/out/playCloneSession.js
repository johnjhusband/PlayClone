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
exports.PlayCloneSession = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class PlayCloneSession {
    constructor(context) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('PlayClone');
    }
    async openBrowser() {
        if (this.browser) {
            vscode.window.showWarningMessage('Browser is already open');
            return;
        }
        try {
            // Dynamic import to avoid module resolution issues
            const PlayCloneModule = await Promise.resolve().then(() => __importStar(require('playclone')));
            const PlayClone = PlayCloneModule.PlayClone || PlayCloneModule.default;
            const config = vscode.workspace.getConfiguration('playclone');
            this.playclone = new PlayClone({
                browser: config.get('browser', 'chromium'),
                headless: config.get('headless', false),
                slowMo: config.get('slowMo', 0),
                timeout: config.get('timeout', 30000)
            });
            this.browser = await this.playclone.launch();
            this.log('Browser launched successfully');
        }
        catch (error) {
            this.log(`Failed to launch browser: ${error.message}`, 'error');
            vscode.window.showErrorMessage(`Failed to launch browser: ${error.message}`);
        }
    }
    async closeBrowser() {
        if (!this.browser) {
            vscode.window.showWarningMessage('No browser is open');
            return;
        }
        try {
            await this.playclone.close();
            this.browser = null;
            this.playclone = null;
            this.log('Browser closed successfully');
        }
        catch (error) {
            this.log(`Failed to close browser: ${error.message}`, 'error');
        }
    }
    async runScript(code) {
        try {
            if (!this.browser) {
                await this.openBrowser();
            }
            // Create a function from the code and execute it
            const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
            const scriptFunction = new AsyncFunction('pc', code);
            this.log('Executing script...');
            const result = await scriptFunction(this.playclone);
            if (result) {
                this.log(`Script result: ${JSON.stringify(result, null, 2)}`);
            }
            vscode.window.showInformationMessage('Script executed successfully');
        }
        catch (error) {
            this.log(`Script execution failed: ${error.message}`, 'error');
            vscode.window.showErrorMessage(`Script execution failed: ${error.message}`);
        }
    }
    async navigate(url) {
        if (!this.browser) {
            await this.openBrowser();
        }
        const result = await this.playclone.navigate(url);
        this.log(`Navigated to: ${url}`);
        return result;
    }
    async click(selector) {
        if (!this.browser) {
            throw new Error('Browser not open');
        }
        const result = await this.playclone.click(selector);
        this.log(`Clicked: ${selector}`);
        return result;
    }
    async fill(selector, value) {
        if (!this.browser) {
            throw new Error('Browser not open');
        }
        const result = await this.playclone.fill(selector, value);
        this.log(`Filled: ${selector} with value: ${value}`);
        return result;
    }
    async getText(selector) {
        if (!this.browser) {
            throw new Error('Browser not open');
        }
        const result = await this.playclone.getText(selector);
        this.log(`Got text: ${selector || 'page'}`);
        return result;
    }
    async screenshot() {
        if (!this.browser) {
            throw new Error('Browser not open');
        }
        const result = await this.playclone.screenshot();
        if (result.success && result.data) {
            // Save screenshot to temp file
            const screenshotPath = path.join(this.context.globalStorageUri.fsPath, 'screenshot.png');
            const fs = require('fs');
            fs.writeFileSync(screenshotPath, Buffer.from(result.data, 'base64'));
            this.log(`Screenshot saved: ${screenshotPath}`);
            return screenshotPath;
        }
        throw new Error('Failed to take screenshot');
    }
    async getCurrentUrl() {
        if (!this.browser || !this.playclone.page) {
            return '';
        }
        return this.playclone.page.url();
    }
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        this.outputChannel.appendLine(logMessage);
        if (level === 'error') {
            console.error(logMessage);
        }
        else {
            console.log(logMessage);
        }
    }
    dispose() {
        if (this.browser) {
            this.closeBrowser();
        }
        this.outputChannel.dispose();
    }
}
exports.PlayCloneSession = PlayCloneSession;
//# sourceMappingURL=playCloneSession.js.map