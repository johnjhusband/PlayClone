/**
 * VisualSelectorBuilder - Interactive UI for building and testing PlayClone selectors
 */

import { Page } from 'playwright-core';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { PlayClone } from '../PlayClone';
import { ElementLocator } from '../selectors/ElementLocator';
import { formatResponse, formatSuccess, formatError } from '../utils/responseFormatter';

export interface SelectorBuilderOptions {
  port?: number;
  host?: string;
  targetUrl?: string;
  autoOpen?: boolean;
}

export interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  role?: string;
  ariaLabel?: string;
  placeholder?: string;
  name?: string;
  type?: string;
  href?: string;
  selector: string;
  naturalLanguage: string;
  xpath: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class VisualSelectorBuilder {
  private server?: http.Server;
  private playclone?: PlayClone;
  private targetPage?: Page;
  private wsConnections: Set<any> = new Set();
  private selectedElements: ElementInfo[] = [];
  private elementLocator: ElementLocator;

  constructor(private options: SelectorBuilderOptions = {}) {
    this.options.port = options.port || 8765;
    this.options.host = options.host || 'localhost';
    this.options.autoOpen = options.autoOpen ?? true;
    this.elementLocator = new ElementLocator();
  }

  /**
   * Start the visual selector builder UI server
   */
  async start(): Promise<void> {
    // Create HTTP server for UI
    this.server = http.createServer(this.handleRequest.bind(this));
    
    // Start server
    await new Promise<void>((resolve) => {
      this.server!.listen(this.options.port, this.options.host!, () => {
        console.log(`🎨 Visual Selector Builder running at http://${this.options.host}:${this.options.port}`);
        resolve();
      });
    });

    // Auto-open in browser
    if (this.options.autoOpen) {
      const { exec } = await import('child_process');
      const url = `http://${this.options.host}:${this.options.port}`;
      const start = process.platform === 'darwin' ? 'open' : 
                    process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${start} ${url}`);
    }
  }

  /**
   * Stop the visual selector builder
   */
  async stop(): Promise<void> {
    if (this.playclone) {
      await this.playclone.close();
    }
    
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
    }
  }

  /**
   * Handle HTTP requests
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    
    // Serve UI
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(this.getUIHtml());
      return;
    }

    // API endpoints
    if (url.pathname === '/api/connect' && req.method === 'POST') {
      await this.handleConnect(req, res);
      return;
    }

    if (url.pathname === '/api/inspect' && req.method === 'POST') {
      await this.handleInspect(req, res);
      return;
    }

    if (url.pathname === '/api/test-selector' && req.method === 'POST') {
      await this.handleTestSelector(req, res);
      return;
    }

    if (url.pathname === '/api/highlight' && req.method === 'POST') {
      await this.handleHighlight(req, res);
      return;
    }

    if (url.pathname === '/api/generate-code' && req.method === 'POST') {
      await this.handleGenerateCode(req, res);
      return;
    }

    // 404
    res.writeHead(404);
    res.end('Not found');
  }

  /**
   * Connect to a target URL
   */
  private async handleConnect(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const body = await this.getRequestBody(req);
      const { url } = JSON.parse(body);

      // Close existing connection
      if (this.playclone) {
        await this.playclone.close();
      }

      // Create new PlayClone instance
      this.playclone = new PlayClone({ headless: false });
      const result = await this.playclone.navigate(url);
      
      if (result.success) {
        this.targetPage = this.playclone.page || undefined;
        
        // Inject inspection script
        await this.injectInspectionScript();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, url }));
      } else {
        throw new Error(result.error || 'Navigation failed');
      }
    } catch (error: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  /**
   * Inspect elements on the page
   */
  private async handleInspect(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      if (!this.targetPage) {
        throw new Error('No page connected');
      }

      const elements = await this.targetPage.evaluate(() => {
        const allElements = document.querySelectorAll('*');
        const elementInfo: any[] = [];

        allElements.forEach((el: any) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          
          // Only include visible elements
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return;

          elementInfo.push({
            tagName: el.tagName.toLowerCase(),
            id: el.id || undefined,
            className: el.className || undefined,
            textContent: el.textContent?.trim().substring(0, 100),
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            placeholder: el.placeholder,
            name: el.name,
            type: el.type,
            href: el.href,
            position: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            }
          });
        });

        return elementInfo;
      });

      // Generate selectors for each element
      const elementsWithSelectors = elements.map(el => ({
        ...el,
        selector: this.generateCssSelector(el),
        naturalLanguage: this.generateNaturalLanguage(el),
        xpath: this.generateXPath(el)
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, elements: elementsWithSelectors }));
    } catch (error: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  /**
   * Test a selector
   */
  private async handleTestSelector(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      if (!this.targetPage || !this.playclone) {
        throw new Error('No page connected');
      }

      const body = await this.getRequestBody(req);
      const { selector, type } = JSON.parse(body);

      let elements: any[] = [];
      
      if (type === 'css') {
        const count = await this.targetPage.locator(selector).count();
        if (count > 0) {
          elements = await this.targetPage.locator(selector).evaluateAll((els) => 
            els.map(el => {
              const rect = el.getBoundingClientRect();
              return {
                tagName: el.tagName.toLowerCase(),
                text: el.textContent?.trim().substring(0, 100),
                position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
              };
            })
          );
        }
      } else if (type === 'natural') {
        // Use PlayClone's natural language selector
        const result = await this.playclone.click(selector, { dryRun: true });
        if (result.success && result.value) {
          elements = [result.value];
        }
      } else if (type === 'xpath') {
        const count = await this.targetPage.locator(`xpath=${selector}`).count();
        if (count > 0) {
          elements = await this.targetPage.locator(`xpath=${selector}`).evaluateAll((els) =>
            els.map(el => {
              const rect = el.getBoundingClientRect();
              return {
                tagName: el.tagName.toLowerCase(),
                text: el.textContent?.trim().substring(0, 100),
                position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
              };
            })
          );
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        found: elements.length,
        elements 
      }));
    } catch (error: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  /**
   * Highlight elements on the page
   */
  private async handleHighlight(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      if (!this.targetPage) {
        throw new Error('No page connected');
      }

      const body = await this.getRequestBody(req);
      const { selector, type } = JSON.parse(body);

      await this.targetPage.evaluate(({ selector, type }) => {
        // Remove existing highlights
        document.querySelectorAll('.playclone-highlight').forEach(el => el.remove());

        let elements: Element[] = [];
        
        if (type === 'css') {
          elements = Array.from(document.querySelectorAll(selector));
        } else if (type === 'xpath') {
          const result = document.evaluate(selector, document, null, 
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          for (let i = 0; i < result.snapshotLength; i++) {
            const node = result.snapshotItem(i);
            if (node && node.nodeType === Node.ELEMENT_NODE) {
              elements.push(node as Element);
            }
          }
        }

        // Add highlights
        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          const highlight = document.createElement('div');
          highlight.className = 'playclone-highlight';
          highlight.style.cssText = `
            position: fixed;
            top: ${rect.top}px;
            left: ${rect.left}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            background: rgba(255, 0, 0, 0.3);
            border: 2px solid red;
            pointer-events: none;
            z-index: 999999;
          `;
          document.body.appendChild(highlight);
        });

        // Remove after 3 seconds
        setTimeout(() => {
          document.querySelectorAll('.playclone-highlight').forEach(el => el.remove());
        }, 3000);
      }, { selector, type });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (error: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  /**
   * Generate code for selected elements
   */
  private async handleGenerateCode(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const body = await this.getRequestBody(req);
      const { selectors, language } = JSON.parse(body);

      let code = '';

      if (language === 'javascript') {
        code = this.generateJavaScriptCode(selectors);
      } else if (language === 'typescript') {
        code = this.generateTypeScriptCode(selectors);
      } else if (language === 'python') {
        code = this.generatePythonCode(selectors);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, code }));
    } catch (error: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  /**
   * Inject inspection script into the target page
   */
  private async injectInspectionScript(): Promise<void> {
    if (!this.targetPage) return;

    await this.targetPage.evaluate(() => {
      let selectedElement: Element | null = null;

      // Add hover effect
      document.addEventListener('mouseover', (e) => {
        const target = e.target as Element;
        if (target && target !== selectedElement) {
          target.classList.add('playclone-hover');
        }
      });

      document.addEventListener('mouseout', (e) => {
        const target = e.target as Element;
        if (target) {
          target.classList.remove('playclone-hover');
        }
      });

      // Add click handler
      document.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const target = e.target as Element;
        if (selectedElement) {
          selectedElement.classList.remove('playclone-selected');
        }
        
        selectedElement = target;
        target.classList.add('playclone-selected');

        // Send element info to builder
        const rect = target.getBoundingClientRect();
        (window as any).postMessage({
          type: 'element-selected',
          data: {
            tagName: target.tagName.toLowerCase(),
            id: target.id,
            className: target.className,
            textContent: target.textContent?.trim().substring(0, 100),
            position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          }
        }, '*');

        return false;
      }, true);

      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .playclone-hover {
          outline: 2px dashed blue !important;
          outline-offset: 2px !important;
        }
        .playclone-selected {
          outline: 3px solid green !important;
          outline-offset: 2px !important;
          background: rgba(0, 255, 0, 0.1) !important;
        }
      `;
      document.head.appendChild(style);
    });
  }

  /**
   * Generate CSS selector for element
   */
  private generateCssSelector(el: any): string {
    if (el.id) return `#${el.id}`;
    
    let selector = el.tagName;
    if (el.className && typeof el.className === 'string') {
      selector += `.${el.className.split(' ').join('.')}`;
    }
    
    return selector;
  }

  /**
   * Generate natural language description
   */
  private generateNaturalLanguage(el: any): string {
    const parts: string[] = [];

    // Add role or type
    if (el.role) {
      parts.push(el.role);
    } else if (el.type) {
      parts.push(el.type);
    } else {
      parts.push(el.tagName);
    }

    // Add identifying text
    if (el.ariaLabel) {
      parts.push(`"${el.ariaLabel}"`);
    } else if (el.textContent && el.textContent.length < 50) {
      parts.push(`with text "${el.textContent}"`);
    } else if (el.placeholder) {
      parts.push(`with placeholder "${el.placeholder}"`);
    }

    return parts.join(' ');
  }

  /**
   * Generate XPath for element
   */
  private generateXPath(el: any): string {
    let xpath = `//${el.tagName}`;
    
    if (el.id) {
      xpath += `[@id='${el.id}']`;
    } else if (el.className) {
      xpath += `[@class='${el.className}']`;
    } else if (el.textContent && el.textContent.length < 50) {
      xpath += `[contains(text(), '${el.textContent}')]`;
    }
    
    return xpath;
  }

  /**
   * Generate JavaScript code
   */
  private generateJavaScriptCode(selectors: any[]): string {
    const lines: string[] = [
      "const { PlayClone } = require('@playclone/browser');",
      "",
      "async function automateWebsite() {",
      "  const pc = new PlayClone({ headless: false });",
      "  ",
      "  // Navigate to the page",
      "  await pc.navigate('YOUR_URL_HERE');",
      ""
    ];

    selectors.forEach((sel, i) => {
      lines.push(`  // Element ${i + 1}: ${sel.naturalLanguage}`);
      
      if (sel.type === 'natural') {
        lines.push(`  await pc.click("${sel.selector}");`);
      } else if (sel.type === 'css') {
        lines.push(`  await pc.click({ css: "${sel.selector}" });`);
      } else if (sel.type === 'xpath') {
        lines.push(`  await pc.click({ xpath: "${sel.selector}" });`);
      }
      
      lines.push("");
    });

    lines.push("  await pc.close();");
    lines.push("}");
    lines.push("");
    lines.push("automateWebsite().catch(console.error);");

    return lines.join('\n');
  }

  /**
   * Generate TypeScript code
   */
  private generateTypeScriptCode(selectors: any[]): string {
    const lines: string[] = [
      "import { PlayClone } from '@playclone/browser';",
      "",
      "async function automateWebsite(): Promise<void> {",
      "  const pc = new PlayClone({ headless: false });",
      "  ",
      "  // Navigate to the page",
      "  await pc.navigate('YOUR_URL_HERE');",
      ""
    ];

    selectors.forEach((sel, i) => {
      lines.push(`  // Element ${i + 1}: ${sel.naturalLanguage}`);
      
      if (sel.type === 'natural') {
        lines.push(`  await pc.click("${sel.selector}");`);
      } else if (sel.type === 'css') {
        lines.push(`  await pc.click({ css: "${sel.selector}" });`);
      } else if (sel.type === 'xpath') {
        lines.push(`  await pc.click({ xpath: "${sel.selector}" });`);
      }
      
      lines.push("");
    });

    lines.push("  await pc.close();");
    lines.push("}");
    lines.push("");
    lines.push("automateWebsite().catch(console.error);");

    return lines.join('\n');
  }

  /**
   * Generate Python code
   */
  private generatePythonCode(selectors: any[]): string {
    const lines: string[] = [
      "from playclone import PlayClone",
      "",
      "async def automate_website():",
      "    pc = PlayClone(headless=False)",
      "    ",
      "    # Navigate to the page",
      "    await pc.navigate('YOUR_URL_HERE')",
      ""
    ];

    selectors.forEach((sel, i) => {
      lines.push(`    # Element ${i + 1}: ${sel.naturalLanguage}`);
      
      if (sel.type === 'natural') {
        lines.push(`    await pc.click("${sel.selector}")`);
      } else if (sel.type === 'css') {
        lines.push(`    await pc.click(css="${sel.selector}")`);
      } else if (sel.type === 'xpath') {
        lines.push(`    await pc.click(xpath="${sel.selector}")`);
      }
      
      lines.push("");
    });

    lines.push("    await pc.close()");
    lines.push("");
    lines.push("# Run the automation");
    lines.push("import asyncio");
    lines.push("asyncio.run(automate_website())");

    return lines.join('\n');
  }

  /**
   * Get request body
   */
  private async getRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => resolve(body));
    });
  }

  /**
   * Get UI HTML
   */
  private getUIHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PlayClone Visual Selector Builder</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            background: rgba(255, 255, 255, 0.95);
            padding: 1rem 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            color: #333;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .container {
            flex: 1;
            display: flex;
            gap: 1rem;
            padding: 1rem;
            max-width: 1600px;
            width: 100%;
            margin: 0 auto;
        }
        
        .panel {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 10px;
            padding: 1.5rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        
        .left-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        
        .right-panel {
            width: 400px;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        
        .connect-section {
            display: flex;
            gap: 0.5rem;
        }
        
        .connect-section input {
            flex: 1;
            padding: 0.75rem;
            border: 2px solid #e0e0e0;
            border-radius: 5px;
            font-size: 1rem;
        }
        
        .btn {
            padding: 0.75rem 1.5rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 1rem;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .btn-secondary {
            background: #6c757d;
        }
        
        .btn-success {
            background: #28a745;
        }
        
        .btn-danger {
            background: #dc3545;
        }
        
        .selector-tabs {
            display: flex;
            gap: 0.5rem;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 0.5rem;
            margin-bottom: 1rem;
        }
        
        .tab {
            padding: 0.5rem 1rem;
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 1rem;
            color: #666;
            transition: color 0.2s;
        }
        
        .tab.active {
            color: #667eea;
            border-bottom: 2px solid #667eea;
            margin-bottom: -2px;
        }
        
        .selector-input {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1rem;
        }
        
        .selector-input textarea {
            flex: 1;
            padding: 0.75rem;
            border: 2px solid #e0e0e0;
            border-radius: 5px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9rem;
            resize: vertical;
            min-height: 100px;
        }
        
        .selector-actions {
            display: flex;
            gap: 0.5rem;
        }
        
        .elements-list {
            flex: 1;
            overflow-y: auto;
            border: 2px solid #e0e0e0;
            border-radius: 5px;
            padding: 1rem;
            background: #f8f9fa;
        }
        
        .element-item {
            background: white;
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            border-radius: 5px;
            border: 1px solid #e0e0e0;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .element-item:hover {
            border-color: #667eea;
            box-shadow: 0 2px 10px rgba(102, 126, 234, 0.2);
        }
        
        .element-item.selected {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .element-tag {
            font-weight: bold;
            color: #667eea;
            margin-bottom: 0.25rem;
        }
        
        .element-item.selected .element-tag {
            color: white;
        }
        
        .element-selector {
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.8rem;
            color: #666;
            word-break: break-all;
        }
        
        .element-item.selected .element-selector {
            color: rgba(255, 255, 255, 0.9);
        }
        
        .code-output {
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 1rem;
            border-radius: 5px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9rem;
            white-space: pre;
            overflow-x: auto;
            min-height: 200px;
        }
        
        .status {
            padding: 0.5rem 1rem;
            border-radius: 5px;
            text-align: center;
            margin-bottom: 1rem;
        }
        
        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .status.info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        
        .section-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .icon {
            width: 20px;
            height: 20px;
        }
        
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-left: 0.5rem;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .help-text {
            color: #666;
            font-size: 0.9rem;
            margin-top: 0.5rem;
        }

        .language-select {
            padding: 0.5rem;
            border: 2px solid #e0e0e0;
            border-radius: 5px;
            font-size: 1rem;
            margin-bottom: 1rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>
            <span>🎨</span>
            PlayClone Visual Selector Builder
        </h1>
    </div>
    
    <div class="container">
        <div class="left-panel panel">
            <div class="connect-section">
                <input type="url" id="targetUrl" placeholder="Enter URL to inspect (e.g., https://example.com)" value="https://example.com">
                <button class="btn" id="connectBtn">Connect</button>
            </div>
            
            <div id="status" class="status info" style="display: none;"></div>
            
            <div class="selector-tabs">
                <button class="tab active" data-type="natural">Natural Language</button>
                <button class="tab" data-type="css">CSS Selector</button>
                <button class="tab" data-type="xpath">XPath</button>
            </div>
            
            <div class="selector-input">
                <textarea id="selectorInput" placeholder="Enter selector..."></textarea>
            </div>
            
            <div class="selector-actions">
                <button class="btn btn-success" id="testBtn">Test Selector</button>
                <button class="btn btn-secondary" id="highlightBtn">Highlight</button>
                <button class="btn" id="inspectBtn">Inspect Page</button>
            </div>
            
            <div class="section-title">
                <span>📋</span>
                Elements Found
            </div>
            
            <div class="elements-list" id="elementsList">
                <div class="help-text">Connect to a page and click "Inspect Page" to see elements</div>
            </div>
        </div>
        
        <div class="right-panel panel">
            <div class="section-title">
                <span>⚙️</span>
                Generated Code
            </div>
            
            <select class="language-select" id="languageSelect">
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
            </select>
            
            <button class="btn btn-success" id="generateBtn">Generate Code</button>
            
            <div class="code-output" id="codeOutput">// Generated code will appear here</div>
            
            <div class="section-title">
                <span>📝</span>
                Selected Selectors
            </div>
            
            <div id="selectedSelectors" style="max-height: 200px; overflow-y: auto;">
                <div class="help-text">Test selectors and they will appear here</div>
            </div>
        </div>
    </div>
    
    <script>
        let currentType = 'natural';
        let selectedSelectors = [];
        let connected = false;
        
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentType = tab.dataset.type;
                updatePlaceholder();
            });
        });
        
        function updatePlaceholder() {
            const input = document.getElementById('selectorInput');
            if (currentType === 'natural') {
                input.placeholder = 'e.g., "login button", "search box", "navigation menu"';
            } else if (currentType === 'css') {
                input.placeholder = 'e.g., #login-btn, .search-input, nav > ul > li';
            } else {
                input.placeholder = 'e.g., //button[@id="login"], //input[@type="search"]';
            }
        }
        
        // Connect to page
        document.getElementById('connectBtn').addEventListener('click', async () => {
            const url = document.getElementById('targetUrl').value;
            if (!url) {
                showStatus('Please enter a URL', 'error');
                return;
            }
            
            showStatus('Connecting...', 'info');
            document.getElementById('connectBtn').disabled = true;
            
            try {
                const response = await fetch('/api/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                
                const result = await response.json();
                if (result.success) {
                    connected = true;
                    showStatus('Connected successfully!', 'success');
                    document.getElementById('connectBtn').textContent = 'Reconnect';
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showStatus('Connection failed: ' + error.message, 'error');
            } finally {
                document.getElementById('connectBtn').disabled = false;
            }
        });
        
        // Test selector
        document.getElementById('testBtn').addEventListener('click', async () => {
            if (!connected) {
                showStatus('Please connect to a page first', 'error');
                return;
            }
            
            const selector = document.getElementById('selectorInput').value;
            if (!selector) {
                showStatus('Please enter a selector', 'error');
                return;
            }
            
            showStatus('Testing selector...', 'info');
            
            try {
                const response = await fetch('/api/test-selector', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ selector, type: currentType })
                });
                
                const result = await response.json();
                if (result.success) {
                    showStatus(\`Found \${result.found} element(s)\`, result.found > 0 ? 'success' : 'error');
                    
                    if (result.found > 0) {
                        // Add to selected selectors
                        selectedSelectors.push({ selector, type: currentType, elements: result.elements });
                        updateSelectedSelectors();
                        
                        // Display elements
                        displayElements(result.elements);
                    }
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showStatus('Test failed: ' + error.message, 'error');
            }
        });
        
        // Highlight elements
        document.getElementById('highlightBtn').addEventListener('click', async () => {
            if (!connected) {
                showStatus('Please connect to a page first', 'error');
                return;
            }
            
            const selector = document.getElementById('selectorInput').value;
            if (!selector) {
                showStatus('Please enter a selector', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/highlight', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ selector, type: currentType })
                });
                
                const result = await response.json();
                if (result.success) {
                    showStatus('Elements highlighted on page', 'success');
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showStatus('Highlight failed: ' + error.message, 'error');
            }
        });
        
        // Inspect page
        document.getElementById('inspectBtn').addEventListener('click', async () => {
            if (!connected) {
                showStatus('Please connect to a page first', 'error');
                return;
            }
            
            showStatus('Inspecting page...', 'info');
            
            try {
                const response = await fetch('/api/inspect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const result = await response.json();
                if (result.success) {
                    showStatus(\`Found \${result.elements.length} elements\`, 'success');
                    displayElementsList(result.elements);
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showStatus('Inspection failed: ' + error.message, 'error');
            }
        });
        
        // Generate code
        document.getElementById('generateBtn').addEventListener('click', async () => {
            if (selectedSelectors.length === 0) {
                showStatus('Please test some selectors first', 'error');
                return;
            }
            
            const language = document.getElementById('languageSelect').value;
            
            try {
                const response = await fetch('/api/generate-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ selectors: selectedSelectors, language })
                });
                
                const result = await response.json();
                if (result.success) {
                    document.getElementById('codeOutput').textContent = result.code;
                    showStatus('Code generated successfully', 'success');
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showStatus('Code generation failed: ' + error.message, 'error');
            }
        });
        
        function showStatus(message, type) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = 'status ' + type;
            status.style.display = 'block';
            
            if (type !== 'info') {
                setTimeout(() => {
                    status.style.display = 'none';
                }, 5000);
            }
        }
        
        function displayElements(elements) {
            const list = document.getElementById('elementsList');
            list.innerHTML = '';
            
            elements.forEach(el => {
                const item = document.createElement('div');
                item.className = 'element-item';
                item.innerHTML = \`
                    <div class="element-tag">&lt;\${el.tagName}&gt;</div>
                    <div class="element-selector">\${el.text || 'No text'}</div>
                \`;
                list.appendChild(item);
            });
        }
        
        function displayElementsList(elements) {
            const list = document.getElementById('elementsList');
            list.innerHTML = '';
            
            // Filter to show only interactive elements
            const interactiveElements = elements.filter(el => 
                ['button', 'a', 'input', 'select', 'textarea'].includes(el.tagName) ||
                el.role === 'button' || el.role === 'link'
            );
            
            interactiveElements.forEach(el => {
                const item = document.createElement('div');
                item.className = 'element-item';
                item.innerHTML = \`
                    <div class="element-tag">&lt;\${el.tagName}&gt;</div>
                    <div class="element-selector">\${el.naturalLanguage}</div>
                \`;
                
                item.addEventListener('click', () => {
                    document.getElementById('selectorInput').value = el.naturalLanguage;
                    currentType = 'natural';
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.querySelector('[data-type="natural"]').classList.add('active');
                });
                
                list.appendChild(item);
            });
        }
        
        function updateSelectedSelectors() {
            const container = document.getElementById('selectedSelectors');
            container.innerHTML = '';
            
            selectedSelectors.forEach((sel, i) => {
                const item = document.createElement('div');
                item.className = 'element-item';
                item.innerHTML = \`
                    <div class="element-tag">\${sel.type}: \${sel.selector}</div>
                    <div class="element-selector">Found \${sel.elements.length} element(s)</div>
                \`;
                container.appendChild(item);
            });
        }
        
        // Initialize
        updatePlaceholder();
    </script>
</body>
</html>`;
  }
}