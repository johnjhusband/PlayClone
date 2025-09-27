/**
 * ConsoleErrorCapture - Captures and analyzes browser console errors and DevTools information
 */

import { Page, ConsoleMessage } from 'playwright';

export interface ConsoleError {
  type: 'error' | 'warning' | 'log' | 'info' | 'debug';
  text: string;
  timestamp: Date;
  location?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  stackTrace?: string;
  args?: any[];
}

export interface NetworkError {
  url: string;
  method: string;
  status?: number;
  errorText: string;
  timestamp: Date;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
}

export interface RuntimeError {
  message: string;
  type: string;
  timestamp: Date;
  stackTrace?: string;
}

export interface ErrorSummary {
  consoleErrors: ConsoleError[];
  networkErrors: NetworkError[];
  runtimeErrors: RuntimeError[];
  pageErrors: string[];
  statistics: {
    totalErrors: number;
    errorsByType: Record<string, number>;
    criticalErrors: ConsoleError[];
    networkFailures: number;
    mostCommonError?: string;
  };
}

export class ConsoleErrorCapture {
  private consoleErrors: ConsoleError[] = [];
  private networkErrors: NetworkError[] = [];
  private runtimeErrors: RuntimeError[] = [];
  private pageErrors: string[] = [];
  private isCapturing: boolean = false;
  private page: Page | null = null;

  /**
   * Start capturing errors from the page
   */
  async startCapture(page: Page): Promise<void> {
    console.log('[ConsoleErrorCapture] Starting capture...');
    if (this.isCapturing) {
      console.log('[ConsoleErrorCapture] Already capturing, skipping');
      return;
    }

    this.page = page;
    this.isCapturing = true;
    this.clearErrors();
    console.log('[ConsoleErrorCapture] Cleared previous errors');

    // Capture console messages
    console.log('[ConsoleErrorCapture] Setting up console listener...');
    page.on('console', (msg: ConsoleMessage) => {
      console.log(`[ConsoleErrorCapture] Console ${msg.type()}: ${msg.text().substring(0, 100)}`);
      this.handleConsoleMessage(msg);
    });

    // Capture page errors (uncaught exceptions)
    console.log('[ConsoleErrorCapture] Setting up pageerror listener...');
    page.on('pageerror', (error: Error) => {
      console.log(`[ConsoleErrorCapture] Page error: ${error.toString()}`);
      this.pageErrors.push(error.toString());
      this.runtimeErrors.push({
        message: error.message,
        type: error.name,
        timestamp: new Date(),
        stackTrace: error.stack
      });
    });

    // Capture network request failures
    console.log('[ConsoleErrorCapture] Setting up requestfailed listener...');
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      if (failure) {
        console.log(`[ConsoleErrorCapture] Request failed: ${request.url()} - ${failure.errorText}`);
        this.networkErrors.push({
          url: request.url(),
          method: request.method(),
          errorText: failure.errorText,
          timestamp: new Date(),
          requestHeaders: request.headers()
        });
      }
    });

    // Capture response errors (4xx, 5xx)
    console.log('[ConsoleErrorCapture] Setting up response listener...');
    page.on('response', (response) => {
      if (response.status() >= 400) {
        console.log(`[ConsoleErrorCapture] HTTP error: ${response.status()} ${response.url()}`);
        this.networkErrors.push({
          url: response.url(),
          method: response.request().method(),
          status: response.status(),
          errorText: `HTTP ${response.status()} ${response.statusText()}`,
          timestamp: new Date(),
          requestHeaders: response.request().headers(),
          responseHeaders: response.headers()
        });
      }
    });

    // Inject error monitoring into the page
    console.log('[ConsoleErrorCapture] Injecting error monitoring script...');
    await this.injectErrorMonitoring(page);
    console.log('[ConsoleErrorCapture] Error capture setup complete');
  }

  /**
   * Handle console messages
   */
  private async handleConsoleMessage(msg: ConsoleMessage): Promise<void> {
    const type = msg.type() as ConsoleError['type'];
    const text = msg.text();
    console.log(`[ConsoleErrorCapture] Processing ${type} message: ${text.substring(0, 200)}`);

    // Extract location information if available
    const location = msg.location();

    // Try to get argument values
    let args: any[] = [];
    try {
      args = await Promise.all(msg.args().map(arg => arg.jsonValue().catch(() => 'Unable to serialize')));
    } catch (e) {
      // Ignore serialization errors
    }

    const error: ConsoleError = {
      type,
      text,
      timestamp: new Date(),
      location: location ? {
        url: location.url,
        lineNumber: location.lineNumber,
        columnNumber: location.columnNumber
      } : undefined,
      args
    };

    // Extract stack trace from error messages
    if (text.includes('   at:') || text.includes('Error:')) {
      const stackMatch = text.match(/(?:Error:.*\n)?(?:\s+at\s+.+\n?)+/);
      if (stackMatch) {
        error.stackTrace = stackMatch[0];
      }
    }

    this.consoleErrors.push(error);
  }

  /**
   * Inject additional error monitoring into the page
   */
  private async injectErrorMonitoring(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // Store original console methods
      const originalError = console.error;
      const originalWarn = console.warn;

      // Track detailed error information
      (window as any).__playclone_errors = [];
      (window as any).__playclone_network_errors = [];

      // Override console.error to capture more details
      console.error = function(...args: any[]) {
        const errorInfo = {
          type: 'error',
          message: args.join(' '),
          timestamp: new Date().toISOString(),
          stack: new Error().stack
        };
        (window as any).__playclone_errors.push(errorInfo);
        originalError.apply(console, args);
      };

      // Override console.warn
      console.warn = function(...args: any[]) {
        const warnInfo = {
          type: 'warning',
          message: args.join(' '),
          timestamp: new Date().toISOString()
        };
        (window as any).__playclone_errors.push(warnInfo);
        originalWarn.apply(console, args);
      };

      // Monitor unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        const errorInfo = {
          type: 'unhandledRejection',
          message: event.reason?.toString() || 'Unhandled promise rejection',
          timestamp: new Date().toISOString(),
          promise: event.promise
        };
        (window as any).__playclone_errors.push(errorInfo);
      });

      // Monitor resource loading errors
      window.addEventListener('error', (event) => {
        if (event.target !== window) {
          // Resource loading error
          const target = event.target as any;
          const errorInfo = {
            type: 'resourceError',
            message: `Failed to load ${target.tagName}: ${target.src || target.href}`,
            timestamp: new Date().toISOString()
          };
          (window as any).__playclone_errors.push(errorInfo);
        }
      }, true);
    });
  }

  /**
   * Stop capturing errors
   */
  stopCapture(): void {
    this.isCapturing = false;
    if (this.page) {
      this.page.removeAllListeners('console');
      this.page.removeAllListeners('pageerror');
      this.page.removeAllListeners('requestfailed');
      this.page.removeAllListeners('response');
    }
  }

  /**
   * Get all captured errors
   */
  getErrors(): ErrorSummary {
    const criticalErrors = this.consoleErrors.filter(err =>
      err.type === 'error' && (
        err.text.includes('ERROR:') ||
        err.text.includes('SCRIPT ERROR') ||
        err.text.includes('Parse Error') ||
        err.text.includes('Failed to')
      )
    );

    // Count errors by type
    const errorsByType: Record<string, number> = {};
    this.consoleErrors.forEach(err => {
      errorsByType[err.type] = (errorsByType[err.type] || 0) + 1;
    });

    // Find most common error
    let mostCommonError: string | undefined;
    const errorCounts: Record<string, number> = {};
    this.consoleErrors.forEach(err => {
      const key = err.text.substring(0, 100);
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    const sortedErrors = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]);
    if (sortedErrors.length > 0) {
      mostCommonError = sortedErrors[0][0];
    }

    return {
      consoleErrors: this.consoleErrors,
      networkErrors: this.networkErrors,
      runtimeErrors: this.runtimeErrors,
      pageErrors: this.pageErrors,
      statistics: {
        totalErrors: this.consoleErrors.length + this.networkErrors.length + this.runtimeErrors.length,
        errorsByType,
        criticalErrors,
        networkFailures: this.networkErrors.length,
        mostCommonError
      }
    };
  }

  /**
   * Get errors filtered by type
   */
  getErrorsByType(type: ConsoleError['type']): ConsoleError[] {
    return this.consoleErrors.filter(err => err.type === type);
  }

  /**
   * Get critical errors only
   */
  getCriticalErrors(): ConsoleError[] {
    return this.consoleErrors.filter(err =>
      err.type === 'error' && (
        err.text.includes('ERROR:') ||
        err.text.includes('CRITICAL') ||
        err.text.includes('FATAL') ||
        err.text.includes('Parse Error') ||
        err.text.includes('Script Error')
      )
    );
  }

  /**
   * Get network failures
   */
  getNetworkFailures(): NetworkError[] {
    return this.networkErrors;
  }

  /**
   * Clear all captured errors
   */
  clearErrors(): void {
    this.consoleErrors = [];
    this.networkErrors = [];
    this.runtimeErrors = [];
    this.pageErrors = [];
  }

  /**
   * Get formatted error report
   */
  getErrorReport(): string {
    const summary = this.getErrors();
    let report = '=== ERROR REPORT ===\n\n';

    if (summary.statistics.totalErrors === 0) {
      return report + 'No errors captured.\n';
    }

    report += `Total Errors: ${summary.statistics.totalErrors}\n`;
    report += `Network Failures: ${summary.statistics.networkFailures}\n\n`;

    if (summary.statistics.criticalErrors.length > 0) {
      report += '=== CRITICAL ERRORS ===\n';
      summary.statistics.criticalErrors.forEach((err, i) => {
        report += `${i + 1}. [${err.timestamp.toISOString()}] ${err.text}\n`;
        if (err.location) {
          report += `   at: ${err.location.url}:${err.location.lineNumber}\n`;
        }
      });
      report += '\n';
    }

    if (summary.networkErrors.length > 0) {
      report += '=== NETWORK ERRORS ===\n';
      summary.networkErrors.forEach((err, i) => {
        report += `${i + 1}. ${err.method} ${err.url}\n`;
        report += `   Error: ${err.errorText}\n`;
      });
      report += '\n';
    }

    if (summary.runtimeErrors.length > 0) {
      report += '=== RUNTIME ERRORS ===\n';
      summary.runtimeErrors.forEach((err, i) => {
        report += `${i + 1}. ${err.type}: ${err.message}\n`;
      });
      report += '\n';
    }

    if (summary.statistics.mostCommonError) {
      report += `Most Common Error: ${summary.statistics.mostCommonError}\n`;
    }

    return report;
  }

  /**
   * Extract errors from page's DevTools
   */
  async extractFromDevTools(page: Page): Promise<any> {
    try {
      const devToolsErrors = await page.evaluate(() => {
        return {
          errors: (window as any).__playclone_errors || [],
          performance: {
            timing: performance.timing,
            memory: (performance as any).memory,
            navigation: performance.navigation
          },
          resources: performance.getEntriesByType('resource').map(r => ({
            name: (r as any).name,
            duration: r.duration,
            size: (r as any).transferSize,
            status: (r as any).responseStatus
          }))
        };
      });
      return devToolsErrors;
    } catch (e) {
      console.error('Failed to extract DevTools data:', e);
      return null;
    }
  }
}