import * as vscode from 'vscode';
import * as path from 'path';

export class PlayCloneSession {
    private browser: any;
    private playclone: any;
    private outputChannel: vscode.OutputChannel;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('PlayClone');
    }

    async openBrowser(): Promise<void> {
        if (this.browser) {
            vscode.window.showWarningMessage('Browser is already open');
            return;
        }

        try {
            // Dynamic import to avoid module resolution issues
            const PlayCloneModule = await import('playclone');
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
        } catch (error: any) {
            this.log(`Failed to launch browser: ${error.message}`, 'error');
            vscode.window.showErrorMessage(`Failed to launch browser: ${error.message}`);
        }
    }

    async closeBrowser(): Promise<void> {
        if (!this.browser) {
            vscode.window.showWarningMessage('No browser is open');
            return;
        }

        try {
            await this.playclone.close();
            this.browser = null;
            this.playclone = null;
            this.log('Browser closed successfully');
        } catch (error: any) {
            this.log(`Failed to close browser: ${error.message}`, 'error');
        }
    }

    async runScript(code: string): Promise<void> {
        try {
            if (!this.browser) {
                await this.openBrowser();
            }

            // Create a function from the code and execute it
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const scriptFunction = new AsyncFunction('pc', code);
            
            this.log('Executing script...');
            const result = await scriptFunction(this.playclone);
            
            if (result) {
                this.log(`Script result: ${JSON.stringify(result, null, 2)}`);
            }
            
            vscode.window.showInformationMessage('Script executed successfully');
        } catch (error: any) {
            this.log(`Script execution failed: ${error.message}`, 'error');
            vscode.window.showErrorMessage(`Script execution failed: ${error.message}`);
        }
    }

    async navigate(url: string): Promise<any> {
        if (!this.browser) {
            await this.openBrowser();
        }
        
        const result = await this.playclone.navigate(url);
        this.log(`Navigated to: ${url}`);
        return result;
    }

    async click(selector: string): Promise<any> {
        if (!this.browser) {
            throw new Error('Browser not open');
        }
        
        const result = await this.playclone.click(selector);
        this.log(`Clicked: ${selector}`);
        return result;
    }

    async fill(selector: string, value: string): Promise<any> {
        if (!this.browser) {
            throw new Error('Browser not open');
        }
        
        const result = await this.playclone.fill(selector, value);
        this.log(`Filled: ${selector} with value: ${value}`);
        return result;
    }

    async getText(selector?: string): Promise<any> {
        if (!this.browser) {
            throw new Error('Browser not open');
        }
        
        const result = await this.playclone.getText(selector);
        this.log(`Got text: ${selector || 'page'}`);
        return result;
    }

    async screenshot(): Promise<string> {
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

    async getCurrentUrl(): Promise<string> {
        if (!this.browser || !this.playclone.page) {
            return '';
        }
        return this.playclone.page.url();
    }

    private log(message: string, level: 'info' | 'error' = 'info'): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        
        this.outputChannel.appendLine(logMessage);
        
        if (level === 'error') {
            console.error(logMessage);
        } else {
            console.log(logMessage);
        }
    }

    dispose(): void {
        if (this.browser) {
            this.closeBrowser();
        }
        this.outputChannel.dispose();
    }
}