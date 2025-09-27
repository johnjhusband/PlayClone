/**
 * EnhancedDevToolsConsole - Advanced DevTools Console interaction with CDP
 * Handles opening DevTools, navigating to console, and extracting errors
 */

import { Page, CDPSession } from 'playwright';

export interface ConsoleLogEntry {
  level: 'verbose' | 'info' | 'warning' | 'error';
  text: string;
  timestamp: number;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  stackTrace?: string;
  args?: any[];
}

export interface DevToolsConsoleResult {
  success: boolean;
  errors: ConsoleLogEntry[];
  warnings: ConsoleLogEntry[];
  logs: ConsoleLogEntry[];
  copiedText?: string;
  errorCount: number;
  warningCount: number;
}

export class EnhancedDevToolsConsole {
  private cdpSession: CDPSession | null = null;
  private consoleEntries: ConsoleLogEntry[] = [];
  private isCapturing: boolean = false;

  /**
   * Initialize CDP session and start capturing console
   */
  async initialize(page: Page): Promise<void> {
    console.log('[EnhancedDevToolsConsole] Initializing CDP session...');

    // Create CDP session
    this.cdpSession = await page.context().newCDPSession(page);

    // Enable console and runtime domains
    await this.cdpSession.send('Console.enable');
    await this.cdpSession.send('Runtime.enable');
    await this.cdpSession.send('Log.enable');

    // Set up console message listener
    this.cdpSession.on('Console.messageAdded', (params) => {
      this.handleConsoleMessage(params);
    });

    // Set up runtime console API calls
    this.cdpSession.on('Runtime.consoleAPICalled', (params) => {
      this.handleRuntimeConsole(params);
    });

    // Set up log entries
    this.cdpSession.on('Log.entryAdded', (params) => {
      this.handleLogEntry(params);
    });

    this.isCapturing = true;
    console.log('[EnhancedDevToolsConsole] CDP session initialized and capturing');
  }

  /**
   * Handle console messages from CDP
   */
  private handleConsoleMessage(params: any): void {
    const entry: ConsoleLogEntry = {
      level: params.message.level,
      text: params.message.text,
      timestamp: params.message.timestamp || Date.now(),
      url: params.message.url,
      lineNumber: params.message.line,
      columnNumber: params.message.column,
      stackTrace: params.message.stackTrace ? this.formatStackTrace(params.message.stackTrace) : undefined
    };

    this.consoleEntries.push(entry);
    console.log(`[EnhancedDevToolsConsole] Console ${entry.level}: ${entry.text.substring(0, 100)}`);
  }

  /**
   * Handle runtime console API calls
   */
  private handleRuntimeConsole(params: any): void {
    const entry: ConsoleLogEntry = {
      level: this.mapConsoleType(params.type),
      text: params.args?.map((arg: any) => this.formatArgument(arg)).join(' ') || '',
      timestamp: params.timestamp || Date.now(),
      stackTrace: params.stackTrace ? this.formatStackTrace(params.stackTrace) : undefined,
      args: params.args
    };

    this.consoleEntries.push(entry);
  }

  /**
   * Handle log entries
   */
  private handleLogEntry(params: any): void {
    const entry: ConsoleLogEntry = {
      level: this.mapLogLevel(params.entry.level),
      text: params.entry.text || params.entry.message || '',
      timestamp: params.entry.timestamp || Date.now(),
      url: params.entry.url,
      lineNumber: params.entry.lineNumber,
      stackTrace: params.entry.stackTrace ? this.formatStackTrace(params.entry.stackTrace) : undefined
    };

    this.consoleEntries.push(entry);
  }

  /**
   * Open DevTools programmatically and navigate to Console tab
   */
  async openDevToolsConsole(page: Page): Promise<boolean> {
    console.log('[EnhancedDevToolsConsole] Opening DevTools Console...');

    try {
      // Method 1: Try using CDP to open DevTools
      if (this.cdpSession) {
        // Send command to show DevTools
        await this.cdpSession.send('Overlay.setShowViewportSizeOnResize', { show: true });

        // Enable DevTools domains
        await this.cdpSession.send('Debugger.enable');
        await this.cdpSession.send('DOM.enable');
        await this.cdpSession.send('CSS.enable');
      }

      // Method 2: Use keyboard shortcuts as fallback
      console.log('[EnhancedDevToolsConsole] Attempting to open DevTools with keyboard shortcuts...');

      // Try platform-specific shortcuts
      const isMac = process.platform === 'darwin';

      if (isMac) {
        // Mac: Cmd+Option+J for console
        await page.keyboard.press('Meta+Alt+j');
      } else {
        // Windows/Linux: Ctrl+Shift+J for console
        await page.keyboard.press('Control+Shift+j');
      }

      // Wait for DevTools to open
      await page.waitForTimeout(1500);

      // Alternative: Try F12 then switch to console
      await page.keyboard.press('F12');
      await page.waitForTimeout(1000);

      // Navigate to Console tab using keyboard
      // Press Escape to ensure console drawer is visible
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      console.log('[EnhancedDevToolsConsole] DevTools Console should be open');
      return true;

    } catch (error) {
      console.error('[EnhancedDevToolsConsole] Error opening DevTools:', error);
      return false;
    }
  }

  /**
   * Copy console errors to clipboard using CDP
   */
  async copyConsoleErrors(page: Page): Promise<string> {
    console.log('[EnhancedDevToolsConsole] Copying console errors...');

    try {
      // Get all error entries
      const errors = this.getErrors();
      const errorText = this.formatErrorsForClipboard(errors);

      // Method 1: Use CDP to set clipboard
      if (this.cdpSession) {
        await this.cdpSession.send('Runtime.evaluate', {
          expression: `navigator.clipboard.writeText(${JSON.stringify(errorText)})`,
          userGesture: true
        });
      }

      // Method 2: Use page evaluate as fallback
      await page.evaluate((text) => {
        navigator.clipboard.writeText(text);
      }, errorText);

      console.log(`[EnhancedDevToolsConsole] Copied ${errors.length} errors to clipboard`);
      return errorText;

    } catch (error) {
      console.error('[EnhancedDevToolsConsole] Error copying to clipboard:', error);

      // Return the error text even if clipboard fails
      const errors = this.getErrors();
      return this.formatErrorsForClipboard(errors);
    }
  }

  /**
   * Extract all console entries using CDP
   */
  async extractAllConsoleEntries(): Promise<ConsoleLogEntry[]> {
    if (!this.cdpSession) {
      console.warn('[EnhancedDevToolsConsole] No CDP session available');
      return this.consoleEntries;
    }

    try {
      // Get console history from CDP
      const history = await this.cdpSession.send('Runtime.evaluate', {
        expression: `
          (() => {
            const entries = [];
            // Try to access console history if available
            if (window.console && window.console._history) {
              return window.console._history;
            }
            // Fallback: get what we can from the page
            if (window.__playclone_errors) {
              return window.__playclone_errors;
            }
            return [];
          })()
        `,
        returnByValue: true
      });

      if (history.result && history.result.value) {
        // Process extracted history
        const extractedEntries = Array.isArray(history.result.value) ? history.result.value : [];
        extractedEntries.forEach((entry: any) => {
          this.consoleEntries.push({
            level: entry.type || 'info',
            text: entry.message || entry.text || '',
            timestamp: entry.timestamp || Date.now(),
            stackTrace: entry.stack
          });
        });
      }

    } catch (error) {
      console.error('[EnhancedDevToolsConsole] Error extracting console history:', error);
    }

    return this.consoleEntries;
  }

  /**
   * Select and copy errors from DevTools Console UI
   */
  async selectAndCopyFromConsoleUI(page: Page): Promise<string> {
    console.log('[EnhancedDevToolsConsole] Selecting errors from Console UI...');

    try {
      // Focus on the console panel
      await page.keyboard.press('Control+`'); // Toggle console drawer
      await page.waitForTimeout(500);

      // Try to select all console content
      // This attempts to interact with the DevTools UI itself
      await page.keyboard.press('Control+a'); // Select all in console
      await page.waitForTimeout(200);
      await page.keyboard.press('Control+c'); // Copy selection
      await page.waitForTimeout(200);

      // Try to get clipboard content
      const clipboardContent = await page.evaluate(async () => {
        try {
          return await navigator.clipboard.readText();
        } catch {
          return null;
        }
      });

      if (clipboardContent) {
        console.log('[EnhancedDevToolsConsole] Successfully copied from Console UI');
        return clipboardContent;
      }

      // Fallback: Return formatted errors from our capture
      return this.formatErrorsForClipboard(this.getErrors());

    } catch (error) {
      console.error('[EnhancedDevToolsConsole] Error selecting from Console UI:', error);
      return this.formatErrorsForClipboard(this.getErrors());
    }
  }

  /**
   * Get all captured errors
   */
  getErrors(): ConsoleLogEntry[] {
    return this.consoleEntries.filter(entry => entry.level === 'error');
  }

  /**
   * Get all captured warnings
   */
  getWarnings(): ConsoleLogEntry[] {
    return this.consoleEntries.filter(entry => entry.level === 'warning');
  }

  /**
   * Get all console entries
   */
  getAllEntries(): ConsoleLogEntry[] {
    return this.consoleEntries;
  }

  /**
   * Get summary of console state
   */
  getSummary(): DevToolsConsoleResult {
    const errors = this.getErrors();
    const warnings = this.getWarnings();
    const logs = this.consoleEntries.filter(entry =>
      entry.level !== 'error' && entry.level !== 'warning'
    );

    return {
      success: true,
      errors,
      warnings,
      logs,
      errorCount: errors.length,
      warningCount: warnings.length
    };
  }

  /**
   * Clear all captured entries
   */
  clear(): void {
    this.consoleEntries = [];
  }

  /**
   * Stop capturing and cleanup
   */
  async cleanup(): Promise<void> {
    if (this.cdpSession) {
      try {
        await this.cdpSession.send('Console.disable');
        await this.cdpSession.send('Runtime.disable');
        await this.cdpSession.send('Log.disable');
        await this.cdpSession.send('Debugger.disable');
        await this.cdpSession.send('DOM.disable');
        await this.cdpSession.send('CSS.disable');
        this.cdpSession = null;
      } catch (error) {
        console.error('[EnhancedDevToolsConsole] Error during cleanup:', error);
      }
    }
    this.isCapturing = false;
  }

  /**
   * Format errors for clipboard
   */
  private formatErrorsForClipboard(errors: ConsoleLogEntry[]): string {
    if (errors.length === 0) {
      return 'No errors found in console';
    }

    let output = '=== Console Errors ===\\n\\n';

    errors.forEach((error, index) => {
      output += `Error #${index + 1}:\\n`;
      output += `Level: ${error.level}\\n`;
      output += `Message: ${error.text}\\n`;

      if (error.url) {
        output += `URL: ${error.url}`;
        if (error.lineNumber) {
          output += `:${error.lineNumber}`;
          if (error.columnNumber) {
            output += `:${error.columnNumber}`;
          }
        }
        output += '\\n';
      }

      if (error.stackTrace) {
        output += `Stack Trace:\\n${error.stackTrace}\\n`;
      }

      output += `Timestamp: ${new Date(error.timestamp).toISOString()}\\n`;
      output += '---\\n\\n';
    });

    output += `Total Errors: ${errors.length}\\n`;

    return output;
  }

  /**
   * Format stack trace from CDP format
   */
  private formatStackTrace(stackTrace: any): string {
    if (!stackTrace || !stackTrace.callFrames) {
      return '';
    }

    return stackTrace.callFrames.map((frame: any) => {
      const functionName = frame.functionName || '<anonymous>';
      const url = frame.url || '<unknown>';
      const line = frame.lineNumber || 0;
      const column = frame.columnNumber || 0;
      return `    at ${functionName} (${url}:${line}:${column})`;
    }).join('\\n');
  }

  /**
   * Format runtime argument
   */
  private formatArgument(arg: any): string {
    if (!arg) return '';

    if (arg.type === 'string') {
      return arg.value || '';
    } else if (arg.type === 'number' || arg.type === 'boolean') {
      return String(arg.value);
    } else if (arg.type === 'undefined') {
      return 'undefined';
    } else if (arg.type === 'object' && arg.subtype === 'null') {
      return 'null';
    } else if (arg.preview) {
      return arg.preview.description || arg.className || arg.type;
    } else if (arg.description) {
      return arg.description;
    } else {
      return JSON.stringify(arg);
    }
  }

  /**
   * Map console type to log level
   */
  private mapConsoleType(type: string): ConsoleLogEntry['level'] {
    switch (type) {
      case 'error':
      case 'assert':
        return 'error';
      case 'warning':
      case 'warn':
        return 'warning';
      case 'info':
      case 'log':
        return 'info';
      case 'debug':
      case 'trace':
      case 'verbose':
      default:
        return 'verbose';
    }
  }

  /**
   * Map log level string
   */
  private mapLogLevel(level: string): ConsoleLogEntry['level'] {
    switch (level.toLowerCase()) {
      case 'error':
        return 'error';
      case 'warning':
      case 'warn':
        return 'warning';
      case 'info':
        return 'info';
      case 'verbose':
      case 'debug':
      default:
        return 'verbose';
    }
  }
}