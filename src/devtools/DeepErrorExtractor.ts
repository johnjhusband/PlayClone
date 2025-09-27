/**
 * DeepErrorExtractor - Comprehensive error extraction system
 * Captures ALL errors including compilation errors, WASM errors, and DevTools-only errors
 */

import { Page, Browser, CDPSession, ConsoleMessage } from 'playwright';

export interface DeepError {
  source: 'console' | 'runtime' | 'network' | 'wasm' | 'compilation' | 'resource' | 'devtools' | 'page' | 'cdp';
  level: 'error' | 'warning' | 'critical' | 'fatal';
  message: string;
  timestamp: Date;
  details?: {
    url?: string;
    line?: number;
    column?: number;
    stack?: string;
    code?: string;
    phase?: string;
    raw?: any;
  };
}

export interface DeepErrorSummary {
  totalErrors: number;
  criticalErrors: DeepError[];
  compilationErrors: DeepError[];
  wasmErrors: DeepError[];
  networkErrors: DeepError[];
  runtimeErrors: DeepError[];
  allErrors: DeepError[];
  errorsBySource: Record<string, number>;
  godotSpecificErrors: DeepError[];
}

export class DeepErrorExtractor {
  private errors: DeepError[] = [];
  private cdpSession: CDPSession | null = null;
  private page: Page | null = null;
  private isCapturing: boolean = false;
  private preNavigationScript: string;

  constructor() {
    // Pre-navigation script to inject into every page
    this.preNavigationScript = `
      (() => {
        console.log('[DeepErrorExtractor] Injecting error capture hooks...');

        // Store original methods
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalLog = console.log;

        // Track all errors
        window.__deepErrors = [];

        // Override console.error to capture everything
        console.error = function(...args) {
          const errorInfo = {
            type: 'console.error',
            message: args.map(a => String(a)).join(' '),
            timestamp: new Date().toISOString(),
            stack: new Error().stack,
            args: args
          };
          window.__deepErrors.push(errorInfo);

          // Check for Godot/GDScript errors
          const message = errorInfo.message;
          if (message.includes('.gd:') || message.includes('GDScript') || message.includes('Parse Error')) {
            errorInfo.isGodotError = true;
            errorInfo.godotDetails = {
              file: message.match(/res:\\/\\/[^:]+\\.gd/)?.[0],
              line: message.match(/:([0-9]+):/)?.[1],
              error: message.match(/Parse Error: (.+?)(?:\\n|$)/)?.[1]
            };
          }

          originalError.apply(console, args);
        };

        // Override console.warn
        console.warn = function(...args) {
          const message = args.map(a => String(a)).join(' ');
          if (message.includes('ERROR') || message.includes('FAIL') || message.includes('Parse')) {
            window.__deepErrors.push({
              type: 'console.warn',
              message: message,
              timestamp: new Date().toISOString()
            });
          }
          originalWarn.apply(console, args);
        };

        // Monitor console.log for ERROR patterns
        console.log = function(...args) {
          const message = args.map(a => String(a)).join(' ');
          if (message.includes('ERROR') || message.includes('Parse Error') || message.includes('compilation failed')) {
            window.__deepErrors.push({
              type: 'console.log.error',
              message: message,
              timestamp: new Date().toISOString()
            });
          }
          originalLog.apply(console, args);
        };

        // Capture window errors
        window.addEventListener('error', (event) => {
          window.__deepErrors.push({
            type: 'window.error',
            message: event.message,
            filename: event.filename,
            line: event.lineno,
            column: event.colno,
            error: event.error?.toString(),
            stack: event.error?.stack,
            timestamp: new Date().toISOString()
          });
        }, true);

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
          window.__deepErrors.push({
            type: 'unhandledRejection',
            message: event.reason?.toString() || 'Unhandled promise rejection',
            reason: event.reason,
            timestamp: new Date().toISOString()
          });
        });

        // Monitor WebAssembly compilation
        if (typeof WebAssembly !== 'undefined') {
          const originalInstantiate = WebAssembly.instantiate;
          WebAssembly.instantiate = async function(...args) {
            try {
              console.log('[DeepErrorExtractor] WebAssembly.instantiate called');
              return await originalInstantiate.apply(WebAssembly, args);
            } catch (error) {
              window.__deepErrors.push({
                type: 'wasm.compilation',
                message: 'WebAssembly compilation failed: ' + error,
                error: error.toString(),
                stack: error.stack,
                timestamp: new Date().toISOString()
              });
              throw error;
            }
          };

          const originalCompile = WebAssembly.compile;
          WebAssembly.compile = async function(...args) {
            try {
              console.log('[DeepErrorExtractor] WebAssembly.compile called');
              return await originalCompile.apply(WebAssembly, args);
            } catch (error) {
              window.__deepErrors.push({
                type: 'wasm.compile',
                message: 'WebAssembly compile failed: ' + error,
                error: error.toString(),
                timestamp: new Date().toISOString()
              });
              throw error;
            }
          };
        }

        // Monitor script loading errors
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
          const element = originalCreateElement.call(document, tagName);
          if (tagName.toLowerCase() === 'script') {
            element.addEventListener('error', function() {
              window.__deepErrors.push({
                type: 'script.load.error',
                message: 'Script failed to load: ' + element.src,
                src: element.src,
                timestamp: new Date().toISOString()
              });
            });
          }
          return element;
        };

        // Monitor resource timing for failed loads
        if (window.PerformanceObserver) {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'resource' && entry.transferSize === 0 && entry.name.includes('.')) {
                window.__deepErrors.push({
                  type: 'resource.failed',
                  message: 'Resource failed to load: ' + entry.name,
                  url: entry.name,
                  timestamp: new Date().toISOString()
                });
              }
            }
          });
          observer.observe({ entryTypes: ['resource'] });
        }

        console.log('[DeepErrorExtractor] Error capture hooks installed');
      })();
    `;
  }

  /**
   * Start comprehensive error capture
   */
  async startCapture(page: Page): Promise<void> {
    console.log('[DeepErrorExtractor] Starting comprehensive error capture...');
    this.page = page;
    this.isCapturing = true;
    this.errors = [];

    // Inject error capturing script before navigation
    await page.addInitScript(this.preNavigationScript);
    console.log('[DeepErrorExtractor] Injected pre-navigation error capture script');

    // Get CDP session for deep integration
    const context = page.context();
    this.cdpSession = await context.newCDPSession(page);
    console.log('[DeepErrorExtractor] CDP session established');

    // Enable all relevant CDP domains
    await this.enableCDPDomains();

    // Set up CDP event listeners
    this.setupCDPListeners();

    // Set up Playwright event listeners
    this.setupPlaywrightListeners(page);

    console.log('[DeepErrorExtractor] All error capture systems activated');
  }

  /**
   * Enable CDP domains for comprehensive error capture
   */
  private async enableCDPDomains(): Promise<void> {
    if (!this.cdpSession) return;

    console.log('[DeepErrorExtractor] Enabling CDP domains...');

    // Enable Console domain - captures console API calls
    await this.cdpSession.send('Console.enable');
    console.log('[DeepErrorExtractor] CDP Console domain enabled');

    // Enable Runtime domain - captures exceptions and execution contexts
    await this.cdpSession.send('Runtime.enable');
    console.log('[DeepErrorExtractor] CDP Runtime domain enabled');

    // Enable Log domain - captures browser log entries
    await this.cdpSession.send('Log.enable');
    console.log('[DeepErrorExtractor] CDP Log domain enabled');

    // Enable Network domain - captures network errors
    await this.cdpSession.send('Network.enable');
    console.log('[DeepErrorExtractor] CDP Network domain enabled');

    // Enable Page domain - captures page errors
    await this.cdpSession.send('Page.enable');
    console.log('[DeepErrorExtractor] CDP Page domain enabled');

    // Enable Debugger domain - captures parse errors
    try {
      await this.cdpSession.send('Debugger.enable');
      console.log('[DeepErrorExtractor] CDP Debugger domain enabled');
    } catch (e) {
      console.log('[DeepErrorExtractor] Could not enable Debugger domain (requires debugging permissions)');
    }
  }

  /**
   * Set up CDP event listeners
   */
  private setupCDPListeners(): void {
    if (!this.cdpSession) return;

    // Console API messages
    this.cdpSession.on('Console.messageAdded', (params) => {
      const { level, text, source, url, line, column } = params.message;
      console.log(`[DeepErrorExtractor] CDP Console.${level}: ${text.substring(0, 100)}`);

      if (level === 'error' || text.includes('ERROR') || text.includes('Parse Error')) {
        this.addError({
          source: 'cdp',
          level: level === 'error' ? 'error' : 'warning',
          message: text,
          timestamp: new Date(),
          details: {
            url,
            line,
            column,
            stack: (params.message as any).stackTrace ? JSON.stringify((params.message as any).stackTrace) : undefined,
            phase: source
          }
        });

        // Check for Godot-specific errors
        if (text.includes('.gd:') || text.includes('GDScript') || text.includes('res://')) {
          console.log('[DeepErrorExtractor] 🔴 GODOT ERROR DETECTED:', text);
          this.addError({
            source: 'compilation',
            level: 'critical',
            message: text,
            timestamp: new Date(),
            details: {
              url: url || 'godot-script',
              line,
              column,
              phase: 'gdscript-compilation'
            }
          });
        }
      }
    });

    // Runtime exceptions
    this.cdpSession.on('Runtime.exceptionThrown', (params) => {
      const { exceptionDetails } = params;
      const { text, exception, stackTrace, lineNumber, columnNumber, url } = exceptionDetails;

      console.log(`[DeepErrorExtractor] CDP Runtime Exception: ${text || exception?.description || 'Unknown'}`);

      this.addError({
        source: 'runtime',
        level: 'error',
        message: text || exception?.description || 'Runtime exception',
        timestamp: new Date(),
        details: {
          url,
          line: lineNumber,
          column: columnNumber,
          stack: stackTrace ? JSON.stringify(stackTrace) : undefined,
          raw: exception
        }
      });
    });

    // Runtime console API calls
    this.cdpSession.on('Runtime.consoleAPICalled', (params) => {
      const { type, args, stackTrace } = params;
      if (type === 'error') {
        const message = args.map((arg: any) => arg.value || arg.description || '').join(' ');
        console.log(`[DeepErrorExtractor] CDP Runtime Console Error: ${message.substring(0, 100)}`);

        if (message.includes('.gd') || message.includes('Parse Error')) {
          this.addError({
            source: 'compilation',
            level: 'critical',
            message: message,
            timestamp: new Date(),
            details: {
              phase: 'runtime-console',
              stack: stackTrace ? JSON.stringify(stackTrace) : undefined
            }
          });
        }
      }
    });

    // Browser log entries
    this.cdpSession.on('Log.entryAdded', (params) => {
      const { level, text, source, url, lineNumber } = params.entry;

      if (level === 'error' || text.includes('ERROR')) {
        console.log(`[DeepErrorExtractor] CDP Log.${level}: ${text.substring(0, 100)}`);

        this.addError({
          source: 'devtools',
          level: level === 'error' ? 'error' : 'warning',
          message: text,
          timestamp: new Date(),
          details: {
            url,
            line: lineNumber,
            phase: source
          }
        });
      }
    });

    // Network failures
    this.cdpSession.on('Network.loadingFailed', (params) => {
      const { errorText, type, requestId } = params;
      console.log(`[DeepErrorExtractor] CDP Network Loading Failed: ${errorText}`);

      this.addError({
        source: 'network',
        level: 'error',
        message: `Network loading failed: ${errorText}`,
        timestamp: new Date(),
        details: {
          phase: type,
          code: requestId
        }
      });
    });

    // Page JavaScript dialog (alerts, confirms, prompts)
    this.cdpSession.on('Page.javascriptDialogOpening', (params) => {
      const { message, type } = params;
      if (message.includes('ERROR') || message.includes('Error')) {
        console.log(`[DeepErrorExtractor] CDP Page Dialog: ${message}`);
        this.addError({
          source: 'page',
          level: 'warning',
          message: `JavaScript dialog: ${message}`,
          timestamp: new Date(),
          details: {
            phase: type
          }
        });
      }
    });
  }

  /**
   * Set up Playwright event listeners
   */
  private setupPlaywrightListeners(page: Page): void {
    // Console messages
    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type();
      const text = msg.text();

      if (type === 'error' || text.includes('ERROR') || text.includes('Parse Error')) {
        console.log(`[DeepErrorExtractor] Playwright Console.${type}: ${text.substring(0, 100)}`);

        const location = msg.location();
        this.addError({
          source: 'console',
          level: type === 'error' ? 'error' : 'warning',
          message: text,
          timestamp: new Date(),
          details: location ? {
            url: location.url,
            line: location.lineNumber,
            column: location.columnNumber
          } : undefined
        });
      }
    });

    // Page errors
    page.on('pageerror', (error: Error) => {
      console.log(`[DeepErrorExtractor] Playwright Page Error: ${error.message}`);

      this.addError({
        source: 'page',
        level: 'error',
        message: error.message,
        timestamp: new Date(),
        details: {
          stack: error.stack
        }
      });
    });

    // Request failures
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      if (failure) {
        console.log(`[DeepErrorExtractor] Playwright Request Failed: ${failure.errorText}`);

        this.addError({
          source: 'network',
          level: 'error',
          message: `Request failed: ${request.url()}`,
          timestamp: new Date(),
          details: {
            url: request.url(),
            code: failure.errorText
          }
        });
      }
    });

    // Response errors
    page.on('response', (response) => {
      if (response.status() >= 400) {
        const url = response.url();

        // Check for specific file types that might contain errors
        if (url.endsWith('.pck') || url.endsWith('.wasm') || url.endsWith('.js')) {
          console.log(`[DeepErrorExtractor] HTTP ${response.status()} for critical resource: ${url}`);

          this.addError({
            source: 'network',
            level: response.status() >= 500 ? 'critical' : 'error',
            message: `HTTP ${response.status()} loading ${url}`,
            timestamp: new Date(),
            details: {
              url: url,
              code: response.status().toString()
            }
          });
        }
      }
    });
  }

  /**
   * Add an error to the collection
   */
  private addError(error: DeepError): void {
    this.errors.push(error);

    // Log critical errors immediately
    if (error.level === 'critical' || error.source === 'compilation') {
      console.log(`\n🔴🔴🔴 CRITICAL ERROR CAPTURED 🔴🔴🔴`);
      console.log(`Source: ${error.source}`);
      console.log(`Message: ${error.message}`);
      if (error.details) {
        console.log(`Details:`, error.details);
      }
      console.log(`🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴\n`);
    }
  }

  /**
   * Extract errors from page context
   */
  async extractFromPageContext(): Promise<any> {
    if (!this.page) return null;

    try {
      const pageErrors = await this.page.evaluate(() => {
        return {
          deepErrors: (window as any).__deepErrors || [],
          performanceEntries: performance.getEntriesByType('resource')
            .filter((e: any) => e.transferSize === 0 || e.responseStatus >= 400)
            .map((e: any) => ({
              name: e.name,
              transferSize: e.transferSize,
              status: e.responseStatus,
              duration: e.duration
            })),
          documentReadyState: document.readyState,
          bodyContent: document.body ? document.body.innerText.substring(0, 1000) : null
        };
      });

      console.log('[DeepErrorExtractor] Extracted from page context:', {
        deepErrorCount: pageErrors.deepErrors.length,
        failedResourceCount: pageErrors.performanceEntries.length
      });

      // Process page context errors
      if (pageErrors.deepErrors.length > 0) {
        for (const err of pageErrors.deepErrors) {
          this.addError({
            source: 'page',
            level: err.type?.includes('error') ? 'error' : 'warning',
            message: err.message || err.toString(),
            timestamp: new Date(err.timestamp || Date.now()),
            details: {
              raw: err
            }
          });
        }
      }

      // Process failed resources
      for (const resource of pageErrors.performanceEntries) {
        this.addError({
          source: 'resource',
          level: 'error',
          message: `Resource failed: ${resource.name}`,
          timestamp: new Date(),
          details: {
            url: resource.name,
            code: resource.status?.toString()
          }
        });
      }

      return pageErrors;
    } catch (e) {
      console.log('[DeepErrorExtractor] Failed to extract from page context:', e);
      return null;
    }
  }

  /**
   * Stop error capture
   */
  async stopCapture(): Promise<void> {
    console.log('[DeepErrorExtractor] Stopping error capture...');
    this.isCapturing = false;

    if (this.cdpSession) {
      try {
        await this.cdpSession.detach();
      } catch (e) {
        // Ignore detach errors
      }
      this.cdpSession = null;
    }

    if (this.page) {
      this.page.removeAllListeners();
    }
  }

  /**
   * Get comprehensive error summary
   */
  getErrorSummary(): DeepErrorSummary {
    const criticalErrors = this.errors.filter(e => e.level === 'critical' || e.level === 'fatal');
    const compilationErrors = this.errors.filter(e =>
      e.source === 'compilation' ||
      e.message.includes('Parse Error') ||
      e.message.includes('.gd:') ||
      e.message.includes('GDScript')
    );
    const wasmErrors = this.errors.filter(e =>
      e.source === 'wasm' ||
      e.message.includes('WebAssembly') ||
      e.message.includes('wasm')
    );
    const networkErrors = this.errors.filter(e => e.source === 'network');
    const runtimeErrors = this.errors.filter(e => e.source === 'runtime');
    const godotSpecificErrors = this.errors.filter(e =>
      e.message.includes('.gd') ||
      e.message.includes('Godot') ||
      e.message.includes('GDScript') ||
      e.message.includes('res://') ||
      e.message.includes('Parse Error')
    );

    // Count errors by source
    const errorsBySource: Record<string, number> = {};
    for (const error of this.errors) {
      errorsBySource[error.source] = (errorsBySource[error.source] || 0) + 1;
    }

    return {
      totalErrors: this.errors.length,
      criticalErrors,
      compilationErrors,
      wasmErrors,
      networkErrors,
      runtimeErrors,
      allErrors: this.errors,
      errorsBySource,
      godotSpecificErrors
    };
  }

  /**
   * Get formatted report
   */
  getFormattedReport(): string {
    const summary = this.getErrorSummary();
    let report = '═══════════════════════════════════════════════\n';
    report += '     DEEP ERROR EXTRACTION REPORT\n';
    report += '═══════════════════════════════════════════════\n\n';

    report += `Total Errors Captured: ${summary.totalErrors}\n`;
    report += `Critical Errors: ${summary.criticalErrors.length}\n`;
    report += `Compilation Errors: ${summary.compilationErrors.length}\n`;
    report += `WebAssembly Errors: ${summary.wasmErrors.length}\n`;
    report += `Network Errors: ${summary.networkErrors.length}\n`;
    report += `Godot-Specific Errors: ${summary.godotSpecificErrors.length}\n\n`;

    if (summary.compilationErrors.length > 0) {
      report += '🔴 COMPILATION ERRORS (Including GDScript):\n';
      report += '───────────────────────────────────────────────\n';
      summary.compilationErrors.forEach((err, i) => {
        report += `${i + 1}. ${err.message}\n`;
        if (err.details?.url) report += `   File: ${err.details.url}\n`;
        if (err.details?.line) report += `   Line: ${err.details.line}\n`;
        report += '\n';
      });
    }

    if (summary.criticalErrors.length > 0) {
      report += '⚠️  CRITICAL ERRORS:\n';
      report += '───────────────────────────────────────────────\n';
      summary.criticalErrors.forEach((err, i) => {
        report += `${i + 1}. [${err.source}] ${err.message}\n`;
      });
      report += '\n';
    }

    if (summary.wasmErrors.length > 0) {
      report += '🔧 WEBASSEMBLY ERRORS:\n';
      report += '───────────────────────────────────────────────\n';
      summary.wasmErrors.forEach((err, i) => {
        report += `${i + 1}. ${err.message}\n`;
      });
      report += '\n';
    }

    report += '📊 ERRORS BY SOURCE:\n';
    report += '───────────────────────────────────────────────\n';
    for (const [source, count] of Object.entries(summary.errorsBySource)) {
      report += `  ${source}: ${count}\n`;
    }

    return report;
  }
}