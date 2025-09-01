/**
 * Step-by-Step Debugging Interface for PlayClone
 * Provides interactive debugging capabilities for browser automation scripts
 */

import { EventEmitter } from 'events';
import { Page, Browser } from 'playwright-core';
import * as readline from 'readline';
import * as WebSocket from 'ws';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { CDPClient } from './CDPClient';
import { Logger } from '../utils/Logger';

export interface DebugStep {
  id: string;
  type: 'navigation' | 'click' | 'input' | 'wait' | 'extract' | 'script' | 'screenshot' | 'custom';
  description: string;
  selector?: string;
  value?: any;
  timestamp: number;
  duration?: number;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  error?: string;
  result?: any;
  screenshot?: string;
  elementInfo?: {
    tagName: string;
    text?: string;
    attributes?: Record<string, string>;
    position?: { x: number; y: number; width: number; height: number };
  };
}

export interface Breakpoint {
  id: string;
  stepIndex?: number;
  selector?: string;
  url?: string;
  condition?: string;
  enabled: boolean;
  hitCount: number;
}

export interface DebuggerOptions {
  mode?: 'cli' | 'web' | 'api';
  port?: number;
  host?: string;
  autoScreenshot?: boolean;
  pauseOnError?: boolean;
  pauseOnStart?: boolean;
  logLevel?: 'verbose' | 'normal' | 'minimal';
  historyLimit?: number;
  enableBreakpoints?: boolean;
  enableWatch?: boolean;
  enableProfiler?: boolean;
}

export interface WatchExpression {
  id: string;
  expression: string;
  value?: any;
  error?: string;
}

export interface PerformanceProfile {
  stepId: string;
  cpu: number;
  memory: number;
  network: {
    requests: number;
    bytesReceived: number;
    bytesSent: number;
  };
}

export class StepDebugger extends EventEmitter {
  private page: Page | null = null;
  private browser: Browser | null = null;
  private cdpClient: CDPClient | null = null;
  private logger: Logger;
  private options: Required<DebuggerOptions>;
  
  // Debugging state
  private steps: DebugStep[] = [];
  private currentStepIndex = -1;
  private breakpoints: Map<string, Breakpoint> = new Map();
  private watchExpressions: Map<string, WatchExpression> = new Map();
  private isPaused = false;
  private isSteppingOver = false;
  private stepHistory: DebugStep[] = [];
  private performanceProfiles: Map<string, PerformanceProfile> = new Map();
  
  // CLI interface
  private rl: readline.Interface | null = null;
  
  // Web interface
  private server: http.Server | null = null;
  private wss: WebSocket.Server | null = null;
  private webClients: Set<WebSocket.WebSocket> = new Set();
  
  // Control flow
  private continueResolver: (() => void) | null = null;
  private stepResolver: (() => void) | null = null;

  constructor(options: DebuggerOptions = {}) {
    super();
    
    this.options = {
      mode: options.mode || 'cli',
      port: options.port || 9229,
      host: options.host || 'localhost',
      autoScreenshot: options.autoScreenshot !== false,
      pauseOnError: options.pauseOnError !== false,
      pauseOnStart: options.pauseOnStart || false,
      logLevel: options.logLevel || 'normal',
      historyLimit: options.historyLimit || 100,
      enableBreakpoints: options.enableBreakpoints !== false,
      enableWatch: options.enableWatch !== false,
      enableProfiler: options.enableProfiler !== false
    };
    
    this.logger = new Logger('StepDebugger');
  }

  /**
   * Initialize the debugger
   */
  async initialize(page: Page, browser: Browser): Promise<void> {
    this.page = page;
    this.browser = browser;
    
    // Initialize CDP client for advanced debugging
    this.cdpClient = new CDPClient();
    await this.cdpClient.connectToBrowser(browser);
    
    // Set up debugging interface based on mode
    if (this.options.mode === 'cli') {
      await this.setupCLI();
    } else if (this.options.mode === 'web') {
      await this.setupWebInterface();
    }
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Enable profiler if requested
    if (this.options.enableProfiler) {
      await this.cdpClient.Profiler.enable();
    }
    
    this.emit('initialized');
    
    if (this.options.pauseOnStart) {
      await this.pause('Debugger initialized - paused on start');
    }
  }

  /**
   * Add a step to the debugging session
   */
  async addStep(step: Omit<DebugStep, 'id' | 'timestamp' | 'status'>): Promise<string> {
    const debugStep: DebugStep = {
      ...step,
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      status: 'pending'
    };
    
    this.steps.push(debugStep);
    this.emit('step-added', debugStep);
    
    return debugStep.id;
  }

  /**
   * Execute the next step
   */
  async executeStep(stepId?: string): Promise<void> {
    const step = stepId 
      ? this.steps.find(s => s.id === stepId)
      : this.steps[this.currentStepIndex + 1];
    
    if (!step) {
      throw new Error('No step to execute');
    }
    
    const stepIndex = this.steps.indexOf(step);
    this.currentStepIndex = stepIndex;
    
    // Check breakpoints
    if (await this.checkBreakpoint(step)) {
      await this.pause(`Breakpoint hit at step ${stepIndex}: ${step.description}`);
    }
    
    // Start profiling
    let profileStart: any;
    if (this.options.enableProfiler) {
      profileStart = await this.startProfiling();
    }
    
    try {
      step.status = 'running';
      this.emit('step-started', step);
      
      const startTime = Date.now();
      
      // Execute based on step type
      switch (step.type) {
        case 'navigation':
          await this.executeNavigation(step);
          break;
        case 'click':
          await this.executeClick(step);
          break;
        case 'input':
          await this.executeInput(step);
          break;
        case 'wait':
          await this.executeWait(step);
          break;
        case 'extract':
          await this.executeExtract(step);
          break;
        case 'script':
          await this.executeScript(step);
          break;
        case 'screenshot':
          await this.executeScreenshot(step);
          break;
        default:
          await this.executeCustom(step);
      }
      
      step.duration = Date.now() - startTime;
      step.status = 'success';
      
      // Take screenshot if enabled
      if (this.options.autoScreenshot && this.page) {
        step.screenshot = await this.captureScreenshot();
      }
      
      // Update watch expressions
      if (this.options.enableWatch) {
        await this.updateWatchExpressions();
      }
      
      this.emit('step-completed', step);
      
    } catch (error: any) {
      step.status = 'error';
      step.error = error.message;
      
      this.emit('step-error', step, error);
      
      if (this.options.pauseOnError) {
        await this.pause(`Error in step ${stepIndex}: ${error.message}`);
      }
      
      throw error;
      
    } finally {
      // End profiling
      if (this.options.enableProfiler && profileStart) {
        const profile = await this.endProfiling(profileStart);
        this.performanceProfiles.set(step.id, profile);
      }
      
      // Add to history
      this.addToHistory(step);
    }
  }

  /**
   * Pause execution
   */
  async pause(reason?: string): Promise<void> {
    if (this.isPaused) return;
    
    this.isPaused = true;
    this.emit('paused', reason);
    
    if (this.options.mode === 'cli') {
      console.log(`\n🔴 Paused: ${reason || 'User requested'}`);
      this.showDebugPrompt();
    } else if (this.options.mode === 'web') {
      this.broadcastToClients({
        type: 'paused',
        reason,
        currentStep: this.currentStepIndex,
        context: await this.getDebugContext()
      });
    }
    
    // Wait for continue signal
    return new Promise(resolve => {
      this.continueResolver = resolve;
    });
  }

  /**
   * Continue execution
   */
  continue(): void {
    if (!this.isPaused) return;
    
    this.isPaused = false;
    this.emit('resumed');
    
    if (this.continueResolver) {
      this.continueResolver();
      this.continueResolver = null;
    }
  }

  /**
   * Step over to next step
   */
  async stepOver(): Promise<void> {
    this.isSteppingOver = true;
    this.continue();
    
    if (this.currentStepIndex < this.steps.length - 1) {
      await this.executeStep();
      await this.pause('Step over completed');
    }
    
    this.isSteppingOver = false;
  }

  /**
   * Step into (for nested operations)
   */
  async stepInto(): Promise<void> {
    // Implementation depends on specific automation framework
    // This would typically drill into sub-operations
    this.emit('step-into', this.steps[this.currentStepIndex]);
  }

  /**
   * Step out (from nested operations)
   */
  async stepOut(): Promise<void> {
    // Implementation depends on specific automation framework
    this.emit('step-out', this.steps[this.currentStepIndex]);
  }

  /**
   * Set a breakpoint
   */
  setBreakpoint(breakpoint: Omit<Breakpoint, 'id' | 'hitCount'>): string {
    const bp: Breakpoint = {
      ...breakpoint,
      id: `bp-${Date.now()}`,
      hitCount: 0
    };
    
    this.breakpoints.set(bp.id, bp);
    this.emit('breakpoint-set', bp);
    
    return bp.id;
  }

  /**
   * Remove a breakpoint
   */
  removeBreakpoint(breakpointId: string): void {
    if (this.breakpoints.delete(breakpointId)) {
      this.emit('breakpoint-removed', breakpointId);
    }
  }

  /**
   * Add a watch expression
   */
  addWatch(expression: string): string {
    const watch: WatchExpression = {
      id: `watch-${Date.now()}`,
      expression
    };
    
    this.watchExpressions.set(watch.id, watch);
    this.emit('watch-added', watch);
    
    return watch.id;
  }

  /**
   * Remove a watch expression
   */
  removeWatch(watchId: string): void {
    if (this.watchExpressions.delete(watchId)) {
      this.emit('watch-removed', watchId);
    }
  }

  /**
   * Get current debugging context
   */
  async getDebugContext(): Promise<any> {
    const context: any = {
      currentStep: this.currentStepIndex,
      totalSteps: this.steps.length,
      isPaused: this.isPaused,
      steps: this.steps,
      breakpoints: Array.from(this.breakpoints.values()),
      watches: Array.from(this.watchExpressions.values()),
      history: this.stepHistory.slice(-10),
      performance: Array.from(this.performanceProfiles.entries()).slice(-10)
    };
    
    if (this.page) {
      context.pageInfo = {
        url: this.page.url(),
        title: await this.page.title()
      };
    }
    
    return context;
  }

  /**
   * Execute navigation step
   */
  private async executeNavigation(step: DebugStep): Promise<void> {
    if (!this.page) throw new Error('No page available');
    
    await this.page.goto(step.value, { waitUntil: 'networkidle' });
    step.result = { url: this.page.url() };
  }

  /**
   * Execute click step
   */
  private async executeClick(step: DebugStep): Promise<void> {
    if (!this.page || !step.selector) throw new Error('Invalid click step');
    
    const element = await this.page.$(step.selector);
    if (!element) throw new Error(`Element not found: ${step.selector}`);
    
    // Capture element info before click
    step.elementInfo = await this.getElementInfo(element);
    
    await element.click();
    step.result = { clicked: true };
  }

  /**
   * Execute input step
   */
  private async executeInput(step: DebugStep): Promise<void> {
    if (!this.page || !step.selector) throw new Error('Invalid input step');
    
    await this.page.fill(step.selector, step.value);
    step.result = { filled: true, value: step.value };
  }

  /**
   * Execute wait step
   */
  private async executeWait(step: DebugStep): Promise<void> {
    if (typeof step.value === 'number') {
      await new Promise(resolve => setTimeout(resolve, step.value));
    } else if (typeof step.value === 'string' && this.page) {
      await this.page.waitForSelector(step.value);
    }
    step.result = { waited: true };
  }

  /**
   * Execute extract step
   */
  private async executeExtract(step: DebugStep): Promise<void> {
    if (!this.page || !step.selector) throw new Error('Invalid extract step');
    
    const element = await this.page.$(step.selector);
    if (!element) throw new Error(`Element not found: ${step.selector}`);
    
    const text = await element.textContent();
    step.result = { extracted: text };
  }

  /**
   * Execute script step
   */
  private async executeScript(step: DebugStep): Promise<void> {
    if (!this.page) throw new Error('No page available');
    
    const result = await this.page.evaluate(step.value);
    step.result = { scriptResult: result };
  }

  /**
   * Execute screenshot step
   */
  private async executeScreenshot(step: DebugStep): Promise<void> {
    if (!this.page) throw new Error('No page available');
    
    const screenshot = await this.captureScreenshot();
    step.result = { screenshot };
    step.screenshot = screenshot;
  }

  /**
   * Execute custom step
   */
  private async executeCustom(step: DebugStep): Promise<void> {
    // Emit event for custom step handling
    this.emit('custom-step', step);
    
    // Wait for external handler to process
    await new Promise(resolve => {
      this.once('custom-step-complete', resolve);
      setTimeout(resolve, 5000); // Timeout after 5 seconds
    });
  }

  /**
   * Check if breakpoint should trigger
   */
  private async checkBreakpoint(step: DebugStep): Promise<boolean> {
    if (!this.options.enableBreakpoints) return false;
    
    for (const bp of this.breakpoints.values()) {
      if (!bp.enabled) continue;
      
      // Check step index breakpoint
      if (bp.stepIndex !== undefined && bp.stepIndex === this.currentStepIndex) {
        bp.hitCount++;
        return true;
      }
      
      // Check selector breakpoint
      if (bp.selector && step.selector === bp.selector) {
        bp.hitCount++;
        return true;
      }
      
      // Check URL breakpoint
      if (bp.url && this.page && this.page.url().includes(bp.url)) {
        bp.hitCount++;
        return true;
      }
      
      // Check condition breakpoint
      if (bp.condition) {
        try {
          const result = await this.page?.evaluate(bp.condition);
          if (result) {
            bp.hitCount++;
            return true;
          }
        } catch {
          // Ignore evaluation errors
        }
      }
    }
    
    return false;
  }

  /**
   * Update watch expressions
   */
  private async updateWatchExpressions(): Promise<void> {
    if (!this.page) return;
    
    for (const watch of this.watchExpressions.values()) {
      try {
        watch.value = await this.page.evaluate(watch.expression);
        watch.error = undefined;
      } catch (error: any) {
        watch.error = error.message;
        watch.value = undefined;
      }
    }
    
    this.emit('watches-updated', Array.from(this.watchExpressions.values()));
  }

  /**
   * Get element info
   */
  private async getElementInfo(element: any): Promise<any> {
    const box = await element.boundingBox();
    const tagName = await element.evaluate((el: Element) => el.tagName);
    const text = await element.textContent();
    const attributes = await element.evaluate((el: Element) => {
      const attrs: Record<string, string> = {};
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        attrs[attr.name] = attr.value;
      }
      return attrs;
    });
    
    return {
      tagName,
      text,
      attributes,
      position: box
    };
  }

  /**
   * Capture screenshot
   */
  private async captureScreenshot(): Promise<string> {
    if (!this.page) return '';
    
    const screenshot = await this.page.screenshot();
    return `data:image/png;base64,${screenshot.toString('base64')}`;
  }

  /**
   * Start profiling
   */
  private async startProfiling(): Promise<any> {
    if (!this.cdpClient) return null;
    
    const startTime = Date.now();
    const startMetrics = await this.cdpClient.Performance.getMetrics();
    
    return { startTime, startMetrics };
  }

  /**
   * End profiling
   */
  private async endProfiling(profileStart: any): Promise<PerformanceProfile> {
    if (!this.cdpClient || !profileStart) {
      return {
        stepId: '',
        cpu: 0,
        memory: 0,
        network: { requests: 0, bytesReceived: 0, bytesSent: 0 }
      };
    }
    
    const endMetricsResult = await this.cdpClient.Performance.getMetrics();
    const duration = Date.now() - profileStart.startTime;
    
    // Extract metrics from the metrics array
    const getMetricValue = (metrics: any, name: string): number => {
      const metric = metrics.metrics?.find((m: any) => m.name === name);
      return metric?.value || 0;
    };
    
    const startMetrics = profileStart.startMetrics;
    const endMetrics = endMetricsResult;
    
    return {
      stepId: this.steps[this.currentStepIndex]?.id || '',
      cpu: duration,
      memory: getMetricValue(endMetrics, 'JSHeapUsedSize') - getMetricValue(startMetrics, 'JSHeapUsedSize'),
      network: {
        requests: getMetricValue(endMetrics, 'RequestCount') - getMetricValue(startMetrics, 'RequestCount'),
        bytesReceived: getMetricValue(endMetrics, 'BytesReceived') - getMetricValue(startMetrics, 'BytesReceived'),
        bytesSent: getMetricValue(endMetrics, 'BytesSent') - getMetricValue(startMetrics, 'BytesSent')
      }
    };
  }

  /**
   * Add step to history
   */
  private addToHistory(step: DebugStep): void {
    this.stepHistory.push(step);
    
    if (this.stepHistory.length > this.options.historyLimit) {
      this.stepHistory.shift();
    }
  }

  /**
   * Set up CLI interface
   */
  private async setupCLI(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'debug> '
    });
    
    this.rl.on('line', async (line) => {
      await this.handleCLICommand(line.trim());
      if (this.isPaused) {
        this.showDebugPrompt();
      }
    });
  }

  /**
   * Handle CLI command
   */
  private async handleCLICommand(command: string): Promise<void> {
    const [cmd, ...args] = command.split(' ');
    
    try {
      switch (cmd) {
        case 'c':
        case 'continue':
          this.continue();
          break;
          
        case 'n':
        case 'next':
        case 'stepover':
          await this.stepOver();
          break;
          
        case 'si':
        case 'stepin':
          await this.stepInto();
          break;
          
        case 'so':
        case 'stepout':
          await this.stepOut();
          break;
          
        case 'b':
        case 'break':
          this.handleBreakpointCommand(args);
          break;
          
        case 'w':
        case 'watch':
          this.handleWatchCommand(args);
          break;
          
        case 'l':
        case 'list':
          this.listSteps();
          break;
          
        case 'p':
        case 'print':
          await this.printExpression(args.join(' '));
          break;
          
        case 'i':
        case 'info':
          await this.showInfo(args[0]);
          break;
          
        case 'h':
        case 'help':
          this.showHelp();
          break;
          
        case 'q':
        case 'quit':
          await this.cleanup();
          process.exit(0);
          break;
          
        default:
          console.log(`Unknown command: ${cmd}. Type 'help' for available commands.`);
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
    }
  }

  /**
   * Show debug prompt
   */
  private showDebugPrompt(): void {
    const step = this.steps[this.currentStepIndex];
    console.log(`\nCurrent step [${this.currentStepIndex + 1}/${this.steps.length}]: ${step?.description || 'None'}`);
    this.rl?.prompt();
  }

  /**
   * Handle breakpoint command
   */
  private handleBreakpointCommand(args: string[]): void {
    if (args.length === 0) {
      // List breakpoints
      console.log('Breakpoints:');
      for (const bp of this.breakpoints.values()) {
        console.log(`  ${bp.id}: ${bp.enabled ? '●' : '○'} ${JSON.stringify(bp)}`);
      }
    } else if (args[0] === 'add') {
      // Add breakpoint
      const stepIndex = parseInt(args[1]);
      const id = this.setBreakpoint({ stepIndex, enabled: true });
      console.log(`Breakpoint ${id} set at step ${stepIndex}`);
    } else if (args[0] === 'remove') {
      // Remove breakpoint
      this.removeBreakpoint(args[1]);
      console.log(`Breakpoint ${args[1]} removed`);
    }
  }

  /**
   * Handle watch command
   */
  private handleWatchCommand(args: string[]): void {
    if (args.length === 0) {
      // List watches
      console.log('Watch expressions:');
      for (const watch of this.watchExpressions.values()) {
        console.log(`  ${watch.id}: ${watch.expression} = ${watch.value || watch.error}`);
      }
    } else if (args[0] === 'add') {
      // Add watch
      const expression = args.slice(1).join(' ');
      const id = this.addWatch(expression);
      console.log(`Watch ${id} added: ${expression}`);
    } else if (args[0] === 'remove') {
      // Remove watch
      this.removeWatch(args[1]);
      console.log(`Watch ${args[1]} removed`);
    }
  }

  /**
   * List steps
   */
  private listSteps(): void {
    console.log('Steps:');
    this.steps.forEach((step, index) => {
      const marker = index === this.currentStepIndex ? '→' : ' ';
      const status = step.status === 'success' ? '✓' : step.status === 'error' ? '✗' : '○';
      console.log(`${marker} ${status} [${index}] ${step.description}`);
    });
  }

  /**
   * Print expression
   */
  private async printExpression(expression: string): Promise<void> {
    if (!this.page) {
      console.log('No page available');
      return;
    }
    
    try {
      const result = await this.page.evaluate(expression);
      console.log(result);
    } catch (error: any) {
      console.error(`Error evaluating expression: ${error.message}`);
    }
  }

  /**
   * Show info
   */
  private async showInfo(topic?: string): Promise<void> {
    const context = await this.getDebugContext();
    
    if (!topic || topic === 'all') {
      console.log('Debug Context:', JSON.stringify(context, null, 2));
    } else if (context[topic]) {
      console.log(`${topic}:`, JSON.stringify(context[topic], null, 2));
    } else {
      console.log(`Unknown info topic: ${topic}`);
    }
  }

  /**
   * Show help
   */
  private showHelp(): void {
    console.log(`
Debug Commands:
  c, continue     - Continue execution
  n, next         - Step over to next step
  si, stepin      - Step into operation
  so, stepout     - Step out of operation
  b, break        - Manage breakpoints
  w, watch        - Manage watch expressions
  l, list         - List all steps
  p, print <expr> - Evaluate and print expression
  i, info [topic] - Show debug information
  h, help         - Show this help
  q, quit         - Exit debugger
    `);
  }

  /**
   * Set up web interface
   */
  private async setupWebInterface(): Promise<void> {
    // Create HTTP server
    this.server = http.createServer((req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.getWebInterfaceHTML());
      } else if (req.url === '/api/context') {
        this.getDebugContext().then(context => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(context));
        });
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    
    // Create WebSocket server
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.wss.on('connection', (ws) => {
      this.webClients.add(ws);
      
      // Send initial context
      this.getDebugContext().then(context => {
        ws.send(JSON.stringify({
          type: 'context',
          data: context
        }));
      });
      
      ws.on('message', async (message) => {
        try {
          const msg = JSON.parse(message.toString());
          await this.handleWebCommand(msg, ws);
        } catch (error: any) {
          ws.send(JSON.stringify({
            type: 'error',
            error: error.message
          }));
        }
      });
      
      ws.on('close', () => {
        this.webClients.delete(ws);
      });
    });
    
    // Start server
    this.server.listen(this.options.port, this.options.host, () => {
      this.logger.info(`Debug web interface running at http://${this.options.host}:${this.options.port}`);
    });
  }

  /**
   * Handle web command
   */
  private async handleWebCommand(msg: any, ws: WebSocket.WebSocket): Promise<void> {
    switch (msg.command) {
      case 'continue':
        this.continue();
        break;
      case 'stepOver':
        await this.stepOver();
        break;
      case 'stepInto':
        await this.stepInto();
        break;
      case 'stepOut':
        await this.stepOut();
        break;
      case 'setBreakpoint':
        const bpId = this.setBreakpoint(msg.breakpoint);
        ws.send(JSON.stringify({ type: 'breakpoint-set', id: bpId }));
        break;
      case 'removeBreakpoint':
        this.removeBreakpoint(msg.id);
        break;
      case 'addWatch':
        const watchId = this.addWatch(msg.expression);
        ws.send(JSON.stringify({ type: 'watch-added', id: watchId }));
        break;
      case 'removeWatch':
        this.removeWatch(msg.id);
        break;
      case 'evaluate':
        const result = await this.page?.evaluate(msg.expression);
        ws.send(JSON.stringify({ type: 'eval-result', result }));
        break;
      case 'getContext':
        const context = await this.getDebugContext();
        ws.send(JSON.stringify({ type: 'context', data: context }));
        break;
    }
  }

  /**
   * Broadcast to all web clients
   */
  private broadcastToClients(data: any): void {
    const message = JSON.stringify(data);
    for (const client of this.webClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  /**
   * Get web interface HTML
   */
  private getWebInterfaceHTML(): string {
    return fs.readFileSync(
      path.join(__dirname, '../../assets/debug-interface.html'),
      'utf-8'
    );
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Page events
    if (this.page) {
      this.page.on('console', msg => {
        this.emit('console', msg);
        if (this.options.logLevel === 'verbose') {
          console.log(`[Console] ${msg.type()}: ${msg.text()}`);
        }
      });
      
      this.page.on('pageerror', error => {
        this.emit('page-error', error);
        if (this.options.logLevel !== 'minimal') {
          console.error('[Page Error]', error);
        }
      });
      
      this.page.on('request', request => {
        this.emit('request', request);
        if (this.options.logLevel === 'verbose') {
          console.log(`[Request] ${request.method()} ${request.url()}`);
        }
      });
      
      this.page.on('response', response => {
        this.emit('response', response);
        if (this.options.logLevel === 'verbose') {
          console.log(`[Response] ${response.status()} ${response.url()}`);
        }
      });
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Close CLI interface
    this.rl?.close();
    
    // Close web interface
    this.wss?.close();
    this.server?.close();
    
    // Disconnect CDP
    await this.cdpClient?.disconnect();
    
    // Clear state
    this.steps = [];
    this.breakpoints.clear();
    this.watchExpressions.clear();
    this.stepHistory = [];
    this.performanceProfiles.clear();
    
    this.emit('cleanup');
  }

  /**
   * Export debug session
   */
  exportSession(): any {
    return {
      steps: this.steps,
      breakpoints: Array.from(this.breakpoints.values()),
      watches: Array.from(this.watchExpressions.values()),
      history: this.stepHistory,
      performance: Array.from(this.performanceProfiles.entries())
    };
  }

  /**
   * Import debug session
   */
  importSession(session: any): void {
    this.steps = session.steps || [];
    
    this.breakpoints.clear();
    (session.breakpoints || []).forEach((bp: Breakpoint) => {
      this.breakpoints.set(bp.id, bp);
    });
    
    this.watchExpressions.clear();
    (session.watches || []).forEach((watch: WatchExpression) => {
      this.watchExpressions.set(watch.id, watch);
    });
    
    this.stepHistory = session.history || [];
    
    this.performanceProfiles.clear();
    (session.performance || []).forEach(([id, profile]: [string, PerformanceProfile]) => {
      this.performanceProfiles.set(id, profile);
    });
    
    this.emit('session-imported', session);
  }
}

export default StepDebugger;