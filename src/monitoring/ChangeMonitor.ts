import { Page, ElementHandle } from 'playwright-core';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

interface MonitorTarget {
  id: string;
  url: string;
  selector?: string;
  checkInterval: number;
  lastCheck?: Date;
  lastHash?: string;
  lastContent?: string;
  metadata?: Record<string, any>;
}

interface ChangeEvent {
  targetId: string;
  url: string;
  selector?: string;
  changeType: 'content' | 'structure' | 'attribute' | 'availability';
  previousValue?: string;
  currentValue?: string;
  timestamp: Date;
  diff?: ChangeDiff;
}

interface ChangeDiff {
  added: string[];
  removed: string[];
  modified: string[];
}

interface AlertConfig {
  type: 'email' | 'webhook' | 'console' | 'file' | 'custom';
  endpoint?: string;
  credentials?: Record<string, string>;
  formatter?: (event: ChangeEvent) => string;
}

interface MonitorConfig {
  storageDir?: string;
  maxHistorySize?: number;
  enableDiff?: boolean;
  alertConfigs?: AlertConfig[];
  retryAttempts?: number;
  retryDelay?: number;
}

export class ChangeMonitor extends EventEmitter {
  private targets: Map<string, MonitorTarget> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private history: Map<string, ChangeEvent[]> = new Map();
  private config: Required<MonitorConfig>;
  private page?: Page;

  constructor(config: MonitorConfig = {}) {
    super();
    this.config = {
      storageDir: config.storageDir || './.playclone-monitor',
      maxHistorySize: config.maxHistorySize || 100,
      enableDiff: config.enableDiff !== false,
      alertConfigs: config.alertConfigs || [],
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000
    };
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.config.storageDir, { recursive: true });
      await this.loadTargets();
      await this.loadHistory();
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }

  setPage(page: Page): void {
    this.page = page;
  }

  async addTarget(
    url: string,
    selector?: string,
    checkInterval: number = 60000,
    metadata?: Record<string, any>
  ): Promise<string> {
    const id = this.generateTargetId(url, selector);
    const target: MonitorTarget = {
      id,
      url,
      selector,
      checkInterval,
      metadata
    };

    this.targets.set(id, target);
    await this.saveTargets();
    this.startMonitoring(id);

    return id;
  }

  async removeTarget(targetId: string): Promise<void> {
    this.stopMonitoring(targetId);
    this.targets.delete(targetId);
    this.history.delete(targetId);
    await this.saveTargets();
    await this.saveHistory();
  }

  async updateTarget(
    targetId: string,
    updates: Partial<MonitorTarget>
  ): Promise<void> {
    const target = this.targets.get(targetId);
    if (!target) {
      throw new Error(`Target ${targetId} not found`);
    }

    const wasMonitoring = this.intervals.has(targetId);
    if (wasMonitoring) {
      this.stopMonitoring(targetId);
    }

    Object.assign(target, updates);
    await this.saveTargets();

    if (wasMonitoring) {
      this.startMonitoring(targetId);
    }
  }

  startMonitoring(targetId: string): void {
    const target = this.targets.get(targetId);
    if (!target) {
      throw new Error(`Target ${targetId} not found`);
    }

    if (this.intervals.has(targetId)) {
      return;
    }

    const interval = setInterval(async () => {
      await this.checkTarget(targetId);
    }, target.checkInterval);

    this.intervals.set(targetId, interval);
    
    // Perform immediate check
    this.checkTarget(targetId);
  }

  stopMonitoring(targetId: string): void {
    const interval = this.intervals.get(targetId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(targetId);
    }
  }

  stopAllMonitoring(): void {
    for (const targetId of this.intervals.keys()) {
      this.stopMonitoring(targetId);
    }
  }

  async checkTarget(targetId: string): Promise<void> {
    const target = this.targets.get(targetId);
    if (!target || !this.page) {
      return;
    }

    let attempts = 0;
    while (attempts < this.config.retryAttempts) {
      try {
        await this.page.goto(target.url, { waitUntil: 'networkidle' });
        
        let content: string;
        if (target.selector) {
          const element = await this.page.$(target.selector);
          if (!element) {
            content = '';
          } else {
            content = await element.evaluate(el => {
              return el.outerHTML || el.textContent || '';
            });
          }
        } else {
          content = await this.page.content();
        }

        const currentHash = this.hashContent(content);
        
        if (target.lastHash && target.lastHash !== currentHash) {
          const changeEvent = await this.detectChanges(target, content);
          await this.handleChange(changeEvent);
        }

        target.lastHash = currentHash;
        target.lastContent = content;
        target.lastCheck = new Date();
        await this.saveTargets();
        
        break;
      } catch (error) {
        attempts++;
        if (attempts >= this.config.retryAttempts) {
          this.emit('error', {
            targetId,
            error,
            message: `Failed to check target after ${attempts} attempts`
          });
        } else {
          await this.delay(this.config.retryDelay);
        }
      }
    }
  }

  private async detectChanges(
    target: MonitorTarget,
    currentContent: string
  ): Promise<ChangeEvent> {
    const changeType = this.determineChangeType(
      target.lastContent || '',
      currentContent
    );

    const event: ChangeEvent = {
      targetId: target.id,
      url: target.url,
      selector: target.selector,
      changeType,
      previousValue: target.lastContent,
      currentValue: currentContent,
      timestamp: new Date()
    };

    if (this.config.enableDiff && target.lastContent) {
      event.diff = this.calculateDiff(target.lastContent, currentContent);
    }

    return event;
  }

  private determineChangeType(
    previous: string,
    current: string
  ): ChangeEvent['changeType'] {
    if (!previous && current) return 'availability';
    if (previous && !current) return 'availability';
    
    const prevDoc = this.parseHTML(previous);
    const currDoc = this.parseHTML(current);
    
    if (prevDoc.structure !== currDoc.structure) return 'structure';
    if (prevDoc.attributes !== currDoc.attributes) return 'attribute';
    
    return 'content';
  }

  private parseHTML(html: string): {
    structure: string;
    attributes: string;
    content: string;
  } {
    const structurePattern = /<[^>]+>/g;
    const structure = (html.match(structurePattern) || []).join('');
    
    const attributePattern = /\s+[\w-]+="[^"]*"/g;
    const attributes = (html.match(attributePattern) || []).join('');
    
    const content = html.replace(structurePattern, '');
    
    return { structure, attributes, content };
  }

  private calculateDiff(previous: string, current: string): ChangeDiff {
    const prevLines = previous.split('\n');
    const currLines = current.split('\n');
    
    const added = currLines.filter(line => !prevLines.includes(line));
    const removed = prevLines.filter(line => !currLines.includes(line));
    
    const modified: string[] = [];
    const minLength = Math.min(prevLines.length, currLines.length);
    for (let i = 0; i < minLength; i++) {
      if (prevLines[i] !== currLines[i]) {
        modified.push(`Line ${i + 1}: ${currLines[i]}`);
      }
    }
    
    return { added, removed, modified };
  }

  private async handleChange(event: ChangeEvent): Promise<void> {
    // Add to history
    const targetHistory = this.history.get(event.targetId) || [];
    targetHistory.push(event);
    
    // Limit history size
    if (targetHistory.length > this.config.maxHistorySize) {
      targetHistory.shift();
    }
    
    this.history.set(event.targetId, targetHistory);
    await this.saveHistory();
    
    // Emit change event
    this.emit('change', event);
    
    // Send alerts
    for (const alertConfig of this.config.alertConfigs) {
      await this.sendAlert(alertConfig, event);
    }
  }

  private async sendAlert(config: AlertConfig, event: ChangeEvent): Promise<void> {
    try {
      const message = config.formatter
        ? config.formatter(event)
        : this.defaultFormatter(event);

      switch (config.type) {
        case 'console':
          console.log('[Change Alert]', message);
          break;
          
        case 'file':
          const logFile = path.join(
            this.config.storageDir,
            'alerts.log'
          );
          await fs.appendFile(logFile, `${new Date().toISOString()} - ${message}\n`);
          break;
          
        case 'webhook':
          if (config.endpoint) {
            await this.sendWebhook(config.endpoint, event, config.credentials);
          }
          break;
          
        case 'email':
          // Email functionality would require additional dependencies
          console.log('[Email Alert]', message);
          break;
          
        case 'custom':
          this.emit('alert', { config, event, message });
          break;
      }
    } catch (error) {
      this.emit('error', {
        type: 'alert',
        config,
        event,
        error
      });
    }
  }

  private async sendWebhook(
    endpoint: string,
    event: ChangeEvent,
    credentials?: Record<string, string>
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (credentials) {
      Object.assign(headers, credentials);
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(event)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }
  }

  private defaultFormatter(event: ChangeEvent): string {
    return `Change detected on ${event.url}${
      event.selector ? ` (${event.selector})` : ''
    }: ${event.changeType} change at ${event.timestamp.toISOString()}`;
  }

  async getHistory(targetId?: string): Promise<ChangeEvent[]> {
    if (targetId) {
      return this.history.get(targetId) || [];
    }
    
    const allHistory: ChangeEvent[] = [];
    for (const history of this.history.values()) {
      allHistory.push(...history);
    }
    
    return allHistory.sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  async clearHistory(targetId?: string): Promise<void> {
    if (targetId) {
      this.history.delete(targetId);
    } else {
      this.history.clear();
    }
    await this.saveHistory();
  }

  getTargets(): MonitorTarget[] {
    return Array.from(this.targets.values());
  }

  getTarget(targetId: string): MonitorTarget | undefined {
    return this.targets.get(targetId);
  }

  isMonitoring(targetId: string): boolean {
    return this.intervals.has(targetId);
  }

  async exportConfig(): Promise<string> {
    const config = {
      targets: Array.from(this.targets.values()),
      history: Array.from(this.history.entries()).map(([id, events]) => ({
        targetId: id,
        events
      }))
    };
    
    return JSON.stringify(config, null, 2);
  }

  async importConfig(configJson: string): Promise<void> {
    const config = JSON.parse(configJson);
    
    if (config.targets) {
      for (const target of config.targets) {
        this.targets.set(target.id, target);
      }
      await this.saveTargets();
    }
    
    if (config.history) {
      for (const { targetId, events } of config.history) {
        this.history.set(targetId, events.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp)
        })));
      }
      await this.saveHistory();
    }
  }

  private generateTargetId(url: string, selector?: string): string {
    const input = `${url}${selector || ''}`;
    return crypto.createHash('md5').update(input).digest('hex').substr(0, 8);
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async saveTargets(): Promise<void> {
    const file = path.join(this.config.storageDir, 'targets.json');
    const data = Array.from(this.targets.values());
    await fs.writeFile(file, JSON.stringify(data, null, 2));
  }

  private async loadTargets(): Promise<void> {
    try {
      const file = path.join(this.config.storageDir, 'targets.json');
      const data = await fs.readFile(file, 'utf-8');
      const targets = JSON.parse(data);
      
      for (const target of targets) {
        if (target.lastCheck) {
          target.lastCheck = new Date(target.lastCheck);
        }
        this.targets.set(target.id, target);
      }
    } catch (error) {
      // File doesn't exist yet
    }
  }

  private async saveHistory(): Promise<void> {
    const file = path.join(this.config.storageDir, 'history.json');
    const data = Array.from(this.history.entries());
    await fs.writeFile(file, JSON.stringify(data, null, 2));
  }

  private async loadHistory(): Promise<void> {
    try {
      const file = path.join(this.config.storageDir, 'history.json');
      const data = await fs.readFile(file, 'utf-8');
      const history = JSON.parse(data);
      
      for (const [targetId, events] of history) {
        this.history.set(targetId, events.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp)
        })));
      }
    } catch (error) {
      // File doesn't exist yet
    }
  }
}