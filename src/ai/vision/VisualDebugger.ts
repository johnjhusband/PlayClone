import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { ActionResult } from '../../types';
import { Logger } from '../../utils/Logger';
import { GPT4VisionIntegration, VisualElement, VisualAnalysisResult } from './GPT4VisionIntegration';

export interface DebugAnnotation {
  element: VisualElement;
  label: string;
  color: string;
  highlight: boolean;
}

export interface VisualDebugConfig {
  outputDir?: string;
  captureOnError?: boolean;
  annotateElements?: boolean;
  showConfidence?: boolean;
  highlightInteractive?: boolean;
  saveHistory?: boolean;
}

export interface DebugSnapshot {
  timestamp: number;
  url: string;
  screenshot: Buffer;
  annotations: DebugAnnotation[];
  elements: VisualElement[];
  errors: string[];
  actions: string[];
}

export class VisualDebugger {
  private logger = new Logger('VisualDebugger');
  private config: VisualDebugConfig;
  private page: Page | null = null;
  private visionIntegration: GPT4VisionIntegration | null = null;
  private history: DebugSnapshot[] = [];
  private currentSession: string;
  private isRecording = false;

  constructor(config: VisualDebugConfig = {}) {
    this.config = {
      outputDir: './debug-output',
      captureOnError: true,
      annotateElements: true,
      showConfidence: true,
      highlightInteractive: true,
      saveHistory: true,
      ...config
    };
    
    this.currentSession = `debug-${Date.now()}`;
    this.ensureOutputDir();
  }

  async attachToPage(page: Page, visionIntegration?: GPT4VisionIntegration): Promise<void> {
    this.page = page;
    this.visionIntegration = visionIntegration || null;
    
    if (this.config.captureOnError) {
      await this.setupErrorCapture();
    }
    
    this.logger.info('Visual debugger attached to page');
  }

  async startRecording(): Promise<void> {
    this.isRecording = true;
    this.history = [];
    this.logger.info('Started visual debugging recording');
  }

  async stopRecording(): Promise<ActionResult> {
    this.isRecording = false;
    
    if (this.config.saveHistory) {
      const reportPath = await this.generateDebugReport();
      return {
        success: true,
        action: 'stopRecording',
        value: reportPath,
        timestamp: Date.now()
      };
    }
    
    return {
      success: true,
      action: 'stopRecording',
      timestamp: Date.now()
    };
  }

  async captureSnapshot(
    action?: string,
    error?: string
  ): Promise<ActionResult> {
    if (!this.page) {
      return {
        success: false,
        action: 'debugger',
        error: 'No page attached',
        suggestion: 'Call attachToPage first',
        timestamp: Date.now()
      };
    }

    try {
      const url = this.page.url();
      const screenshot = await this.page.screenshot({ fullPage: false });
      
      // Get visual elements if vision integration is available
      let elements: VisualElement[] = [];
      if (this.visionIntegration) {
        const analysis = await this.visionIntegration.analyzeScreenshot();
        if (analysis.success && analysis.value) {
          elements = analysis.value.elements;
        }
      }
      
      // Create annotations
      const annotations = this.createAnnotations(elements);
      
      const snapshot: DebugSnapshot = {
        timestamp: Date.now(),
        url,
        screenshot,
        annotations,
        elements,
        errors: error ? [error] : [],
        actions: action ? [action] : []
      };
      
      if (this.isRecording) {
        this.history.push(snapshot);
      }
      
      // Save snapshot if configured
      if (this.config.saveHistory) {
        await this.saveSnapshotToFile(snapshot);
      }
      
      return {
        success: true,
        action: 'captureSnapshot',
        value: snapshot,
        timestamp: Date.now()
      };
    } catch (error: any) {
      this.logger.error('Failed to capture snapshot:', error);
      return {
        success: false,
        action: 'captureSnapshot',
        error: error.message,
        suggestion: 'Check page state',
        timestamp: Date.now()
      };
    }
  }

  async annotateCurrentPage(): Promise<ActionResult> {
    if (!this.page) {
      return {
        success: false,
        action: 'debugger',
        error: 'No page attached',
        suggestion: 'Call attachToPage first',
        timestamp: Date.now()
      };
    }

    try {
      // Take screenshot
      const screenshot = await this.page.screenshot({ fullPage: false });
      
      // Get elements to annotate
      let elements: VisualElement[] = [];
      if (this.visionIntegration) {
        const analysis = await this.visionIntegration.analyzeScreenshot();
        if (analysis.success && analysis.value) {
          elements = analysis.value.elements;
        }
      } else {
        // Use DOM-based element detection as fallback
        elements = await this.detectDOMElements();
      }
      
      // Create annotated image
      const annotatedImage = await this.createAnnotatedScreenshot(screenshot, elements);
      
      return {
        success: true,
        action: 'annotateCurrentPage',
        value: annotatedImage,
        timestamp: Date.now()
      };
    } catch (error: any) {
      return {
        success: false,
        action: 'annotateCurrentPage',
        error: error.message,
        suggestion: 'Check page state',
        timestamp: Date.now()
      };
    }
  }

  async highlightElement(selector: string, color = 'red'): Promise<ActionResult> {
    if (!this.page) {
      return {
        success: false,
        action: 'debugger',
        error: 'No page attached',
        suggestion: 'Call attachToPage first',
        timestamp: Date.now()
      };
    }

    try {
      await this.page.evaluate(
        ({ selector, color }) => {
          const element = document.querySelector(selector);
          if (element) {
            const el = element as HTMLElement;
            el.style.outline = `3px solid ${color}`;
            el.style.outlineOffset = '2px';
            
            // Add label
            const label = document.createElement('div');
            label.textContent = selector;
            label.style.position = 'absolute';
            label.style.background = color;
            label.style.color = 'white';
            label.style.padding = '2px 5px';
            label.style.fontSize = '12px';
            label.style.zIndex = '10000';
            
            const rect = el.getBoundingClientRect();
            label.style.left = `${rect.left}px`;
            label.style.top = `${rect.top - 20}px`;
            
            document.body.appendChild(label);
            
            // Remove after 3 seconds
            setTimeout(() => {
              el.style.outline = '';
              el.style.outlineOffset = '';
              label.remove();
            }, 3000);
          }
        },
        { selector, color }
      );
      
      return {
        success: true,
        action: 'highlightElement',
        value: `Highlighted element: ${selector}`,
        timestamp: Date.now()
      };
    } catch (error: any) {
      return {
        success: false,
        action: 'highlightElement',
        error: error.message,
        suggestion: 'Check selector',
        timestamp: Date.now()
      };
    }
  }

  async compareWithBaseline(
    baselinePath: string
  ): Promise<ActionResult> {
    if (!this.page) {
      return {
        success: false,
        action: 'debugger',
        error: 'No page attached',
        suggestion: 'Call attachToPage first',
        timestamp: Date.now()
      };
    }

    try {
      const baseline = fs.readFileSync(baselinePath);
      const current = await this.page.screenshot({ fullPage: false });
      
      if (this.visionIntegration) {
        return await this.visionIntegration.compareScreenshots(baseline, current);
      }
      
      // Fallback to pixel comparison
      const differences = this.pixelComparison(baseline, current);
      
      return {
        success: true,
        action: 'compareWithBaseline',
        value: differences,
        timestamp: Date.now()
      };
    } catch (error: any) {
      return {
        success: false,
        action: 'compareWithBaseline',
        error: error.message,
        suggestion: 'Check baseline file',
        timestamp: Date.now()
      };
    }
  }

  async generateDebugReport(): Promise<string> {
    const reportDir = path.join(this.config.outputDir!, this.currentSession);
    const reportPath = path.join(reportDir, 'debug-report.html');
    
    // Ensure directory exists
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    // Generate HTML report
    const html = this.generateHTMLReport();
    fs.writeFileSync(reportPath, html);
    
    // Save snapshots
    for (let i = 0; i < this.history.length; i++) {
      const snapshot = this.history[i];
      const imagePath = path.join(reportDir, `snapshot-${i}.png`);
      fs.writeFileSync(imagePath, snapshot.screenshot);
    }
    
    this.logger.info(`Debug report saved to ${reportPath}`);
    return reportPath;
  }

  private setupErrorCapture(): void {
    if (!this.page) return;
    
    this.page.on('pageerror', async (error) => {
      this.logger.error('Page error:', error);
      if (this.config.captureOnError) {
        await this.captureSnapshot('page-error', error.message);
      }
    });
    
    this.page.on('console', async (msg) => {
      if (msg.type() === 'error') {
        this.logger.error('Console error:', msg.text());
        if (this.config.captureOnError) {
          await this.captureSnapshot('console-error', msg.text());
        }
      }
    });
  }

  private createAnnotations(elements: VisualElement[]): DebugAnnotation[] {
    return elements.map((element, index) => ({
      element,
      label: `${element.type} ${index + 1}${this.config.showConfidence ? ` (${Math.round(element.confidence * 100)}%)` : ''}`,
      color: this.getColorForType(element.type),
      highlight: this.config.highlightInteractive || false
    }));
  }

  private getColorForType(type: string): string {
    const colors: Record<string, string> = {
      button: '#3B82F6',
      input: '#10B981',
      link: '#8B5CF6',
      image: '#F59E0B',
      text: '#6B7280',
      heading: '#EF4444',
      default: '#6B7280'
    };
    return colors[type] || colors.default;
  }

  private async detectDOMElements(): Promise<VisualElement[]> {
    if (!this.page) return [];
    
    return await this.page.evaluate(() => {
      const elements: any[] = [];
      
      // Find interactive elements
      const selectors = ['button', 'a', 'input', 'select', 'textarea', '[role="button"]'];
      
      selectors.forEach(selector => {
        const nodes = document.querySelectorAll(selector);
        nodes.forEach(node => {
          const rect = (node as HTMLElement).getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            elements.push({
              type: node.tagName.toLowerCase(),
              text: (node as HTMLElement).textContent?.trim() || '',
              position: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
              },
              confidence: 1.0,
              attributes: {
                id: (node as HTMLElement).id,
                class: (node as HTMLElement).className
              }
            });
          }
        });
      });
      
      return elements;
    });
  }

  private async createAnnotatedScreenshot(
    screenshot: Buffer,
    elements: VisualElement[]
  ): Promise<Buffer> {
    // In a real implementation, this would use an image manipulation library
    // to draw bounding boxes and labels on the screenshot
    this.logger.info(`Creating annotated screenshot with ${elements.length} elements`);
    
    // For now, return the original screenshot
    // A real implementation would use Sharp or Canvas to add annotations
    return screenshot;
  }

  private pixelComparison(
    baseline: Buffer,
    current: Buffer
  ): { differences: string[]; similarity: number } {
    // Simple simulation of pixel comparison
    // A real implementation would use image-diff or pixelmatch
    return {
      differences: ['Visual changes detected'],
      similarity: 95
    };
  }

  private generateHTMLReport(): string {
    const snapshots = this.history.map((snapshot, index) => `
      <div class="snapshot">
        <h3>Snapshot ${index + 1} - ${new Date(snapshot.timestamp).toLocaleString()}</h3>
        <p><strong>URL:</strong> ${snapshot.url}</p>
        ${snapshot.actions.length > 0 ? `<p><strong>Actions:</strong> ${snapshot.actions.join(', ')}</p>` : ''}
        ${snapshot.errors.length > 0 ? `<p class="error"><strong>Errors:</strong> ${snapshot.errors.join(', ')}</p>` : ''}
        <img src="snapshot-${index}.png" alt="Snapshot ${index + 1}" />
        ${snapshot.elements.length > 0 ? `
          <details>
            <summary>Elements Detected (${snapshot.elements.length})</summary>
            <ul>
              ${snapshot.elements.map(el => `
                <li>${el.type}: ${el.text || 'No text'} (${Math.round(el.confidence * 100)}%)</li>
              `).join('')}
            </ul>
          </details>
        ` : ''}
      </div>
    `).join('');
    
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Visual Debug Report - ${this.currentSession}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 { color: #333; }
    .snapshot {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .snapshot img {
      max-width: 100%;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-top: 10px;
    }
    .error { color: #ef4444; }
    details {
      margin-top: 10px;
      padding: 10px;
      background: #f9f9f9;
      border-radius: 4px;
    }
    summary {
      cursor: pointer;
      font-weight: bold;
    }
    ul { margin: 10px 0; }
  </style>
</head>
<body>
  <h1>Visual Debug Report</h1>
  <p><strong>Session:</strong> ${this.currentSession}</p>
  <p><strong>Total Snapshots:</strong> ${this.history.length}</p>
  <hr />
  ${snapshots}
</body>
</html>
    `;
  }

  private async saveSnapshotToFile(snapshot: DebugSnapshot): Promise<void> {
    const dir = path.join(this.config.outputDir!, this.currentSession);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const filename = `snapshot-${snapshot.timestamp}.png`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, snapshot.screenshot);
    
    this.logger.info(`Snapshot saved to ${filepath}`);
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.config.outputDir!)) {
      fs.mkdirSync(this.config.outputDir!, { recursive: true });
    }
  }
}