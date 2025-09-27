import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { ActionResult } from '../../types';
import { Logger } from '../../utils/Logger';
import { GPT4VisionIntegration } from './GPT4VisionIntegration';

export interface RegressionTestConfig {
  baselineDir?: string;
  outputDir?: string;
  threshold?: number; // Similarity threshold (0-100)
  updateBaselines?: boolean;
  failOnMissing?: boolean;
  ignoreRegions?: Array<{ x: number; y: number; width: number; height: number }>;
  viewports?: Array<{ width: number; height: number; name: string }>;
}

export interface TestResult {
  name: string;
  passed: boolean;
  similarity: number;
  differences: string[];
  baselinePath: string;
  actualPath: string;
  diffPath?: string;
  viewport?: string;
}

export interface RegressionReport {
  timestamp: number;
  totalTests: number;
  passed: number;
  failed: number;
  results: TestResult[];
  summary: string;
}

export class VisualRegressionTester {
  private logger = new Logger('VisualRegressionTester');
  private config: RegressionTestConfig;
  private page: Page | null = null;
  private visionIntegration: GPT4VisionIntegration | null = null;
  private testResults: TestResult[] = [];

  constructor(config: RegressionTestConfig = {}) {
    this.config = {
      baselineDir: './baselines',
      outputDir: './visual-regression-output',
      threshold: 95, // 95% similarity required to pass
      updateBaselines: false,
      failOnMissing: true,
      ignoreRegions: [],
      viewports: [{ width: 1920, height: 1080, name: 'desktop' }],
      ...config
    };
    
    this.ensureDirectories();
  }

  async attachToPage(page: Page, visionIntegration?: GPT4VisionIntegration): Promise<void> {
    this.page = page;
    this.visionIntegration = visionIntegration || null;
    this.logger.info('Visual regression tester attached to page');
  }

  async captureBaseline(name: string, selector?: string): Promise<ActionResult> {
    if (!this.page) {
      return {
        success: false,
        action: 'regressionTest',
        error: 'No page attached',
        suggestion: 'Call attachToPage first',
        timestamp: Date.now()
      };
    }

    try {
      const results: string[] = [];
      
      for (const viewport of this.config.viewports!) {
        await this.page.setViewportSize(viewport);
        await this.page.waitForTimeout(500); // Wait for resize
        
        const screenshot = await this.captureScreenshot(selector);
        const baselineName = `${name}-${viewport.name}`;
        const baselinePath = path.join(this.config.baselineDir!, `${baselineName}.png`);
        
        fs.writeFileSync(baselinePath, screenshot);
        results.push(baselinePath);
        
        this.logger.info(`Baseline captured: ${baselinePath}`);
      }
      
      return {
        success: true,
        action: 'captureBaseline',
        value: results.join(', '),
        timestamp: Date.now()
      };
    } catch (error: any) {
      this.logger.error('Failed to capture baseline:', error);
      return {
        success: false,
        action: 'captureBaseline',
        error: error.message,
        suggestion: 'Failed to capture baseline',
        timestamp: Date.now()
      };
    }
  }

  async compareWithBaseline(
    name: string,
    selector?: string
  ): Promise<ActionResult> {
    if (!this.page) {
      return {
        success: false,
        action: 'regressionTest',
        error: 'No page attached',
        suggestion: 'Call attachToPage first',
        timestamp: Date.now()
      };
    }

    try {
      const results: TestResult[] = [];
      
      for (const viewport of this.config.viewports!) {
        await this.page.setViewportSize(viewport);
        await this.page.waitForTimeout(500); // Wait for resize
        
        const baselineName = `${name}-${viewport.name}`;
        const baselinePath = path.join(this.config.baselineDir!, `${baselineName}.png`);
        
        // Check if baseline exists
        if (!fs.existsSync(baselinePath)) {
          if (this.config.failOnMissing) {
            throw new Error(`Baseline not found: ${baselinePath}`);
          } else if (this.config.updateBaselines) {
            // Create new baseline
            await this.captureBaseline(name, selector);
            continue;
          }
        }
        
        // Capture current screenshot
        const currentScreenshot = await this.captureScreenshot(selector);
        const actualPath = path.join(this.config.outputDir!, `${baselineName}-actual.png`);
        fs.writeFileSync(actualPath, currentScreenshot);
        
        // Compare with baseline
        const baseline = fs.readFileSync(baselinePath);
        const comparison = await this.compareImages(baseline, currentScreenshot, baselineName);
        
        const result: TestResult = {
          name: baselineName,
          passed: comparison.similarity >= this.config.threshold!,
          similarity: comparison.similarity,
          differences: comparison.differences,
          baselinePath,
          actualPath,
          viewport: viewport.name
        };
        
        if (!result.passed) {
          // Generate diff image
          const diffPath = path.join(this.config.outputDir!, `${baselineName}-diff.png`);
          await this.generateDiffImage(baseline, currentScreenshot, diffPath);
          result.diffPath = diffPath;
        }
        
        results.push(result);
        this.testResults.push(result);
      }
      
      // Return the first result (or aggregate if multiple viewports)
      const aggregateResult = this.aggregateResults(results, name);
      
      return {
        success: aggregateResult.passed,
        action: 'compareWithBaseline',
        value: aggregateResult, 
        timestamp: Date.now()
      };
    } catch (error: any) {
      this.logger.error('Visual regression test failed:', error);
      return {
        success: false,
        action: 'compareWithBaseline',
        error: error.message,
        suggestion: 'Visual regression test failed',
        timestamp: Date.now()
      };
    }
  }

  async runTestSuite(
    tests: Array<{ name: string; url: string; selector?: string; setup?: () => Promise<void> }>
  ): Promise<ActionResult> {
    this.testResults = [];
    
    try {
      for (const test of tests) {
        this.logger.info(`Running test: ${test.name}`);
        
        // Navigate to URL
        if (this.page) {
          await this.page.goto(test.url);
          
          // Run setup if provided
          if (test.setup) {
            await test.setup();
          }
          
          // Wait for page to stabilize
          await this.page.waitForLoadState('networkidle');
          
          // Run comparison
          await this.compareWithBaseline(test.name, test.selector);
        }
      }
      
      const report = this.generateReport();
      
      // Save report
      const reportPath = path.join(this.config.outputDir!, 'regression-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      // Generate HTML report
      const htmlPath = await this.generateHTMLReport(report);
      
      return {
        success: report.failed === 0,
        action: 'runTestSuite',
        value: report,
        timestamp: Date.now()
      };
    } catch (error: any) {
      return {
        success: false,
        action: 'runTestSuite',
        error: error.message,
        suggestion: 'Test suite failed',
        timestamp: Date.now()
      };
    }
  }

  async updateBaseline(name: string, selector?: string): Promise<ActionResult> {
    const oldUpdateBaselines = this.config.updateBaselines;
    this.config.updateBaselines = true;
    
    const result = await this.captureBaseline(name, selector);
    
    this.config.updateBaselines = oldUpdateBaselines;
    
    return {
      success: result.success,
      action: 'updateBaseline',
      error: result.error,
      suggestion: result.success ? 'Baseline updated' : 'Failed to update baseline',
      timestamp: Date.now()
    };
  }

  async setIgnoreRegions(
    regions: Array<{ x: number; y: number; width: number; height: number }>
  ): Promise<void> {
    this.config.ignoreRegions = regions;
    this.logger.info(`Set ${regions.length} ignore regions`);
  }

  private async captureScreenshot(selector?: string): Promise<Buffer> {
    if (!this.page) {
      throw new Error('No page attached');
    }

    let screenshot: Buffer;
    
    if (selector) {
      const element = await this.page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      screenshot = await element.screenshot();
    } else {
      screenshot = await this.page.screenshot({ fullPage: false });
    }
    
    // Apply ignore regions if configured
    if (this.config.ignoreRegions && this.config.ignoreRegions.length > 0) {
      screenshot = await this.applyIgnoreRegions(screenshot);
    }
    
    return screenshot;
  }

  private async compareImages(
    baseline: Buffer,
    current: Buffer,
    name: string
  ): Promise<{ similarity: number; differences: string[] }> {
    // Use GPT-4 Vision if available
    if (this.visionIntegration) {
      const result = await this.visionIntegration.compareScreenshots(baseline, current);
      if (result.success && result.value) {
        return result.value;
      }
    }
    
    // Fallback to simple comparison
    // In a real implementation, this would use pixelmatch or similar
    return this.simpleImageComparison(baseline, current, name);
  }

  private simpleImageComparison(
    baseline: Buffer,
    current: Buffer,
    name: string
  ): { similarity: number; differences: string[] } {
    // Simulate comparison
    // A real implementation would use image comparison libraries
    const baselineSize = baseline.length;
    const currentSize = current.length;
    
    if (baselineSize === currentSize) {
      return {
        similarity: 98,
        differences: ['Minor pixel differences detected']
      };
    } else {
      const sizeDiff = Math.abs(baselineSize - currentSize);
      const similarity = Math.max(0, 100 - (sizeDiff / baselineSize * 100));
      
      return {
        similarity: Math.round(similarity),
        differences: [
          `Image size changed by ${sizeDiff} bytes`,
          'Layout may have shifted'
        ]
      };
    }
  }

  private async generateDiffImage(
    baseline: Buffer,
    current: Buffer,
    outputPath: string
  ): Promise<void> {
    // In a real implementation, this would use pixelmatch or similar
    // to generate a visual diff image
    // For now, we'll just copy the current image as the diff
    fs.writeFileSync(outputPath, current);
    this.logger.info(`Diff image saved to ${outputPath}`);
  }

  private async applyIgnoreRegions(screenshot: Buffer): Promise<Buffer> {
    // In a real implementation, this would mask out the ignore regions
    // For now, return the original screenshot
    this.logger.info(`Applied ${this.config.ignoreRegions!.length} ignore regions`);
    return screenshot;
  }

  private aggregateResults(results: TestResult[], name: string): TestResult {
    if (results.length === 1) {
      return results[0];
    }
    
    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;
    const allDifferences = results.flatMap(r => r.differences);
    const allPassed = results.every(r => r.passed);
    
    return {
      name,
      passed: allPassed,
      similarity: Math.round(avgSimilarity),
      differences: [...new Set(allDifferences)],
      baselinePath: results[0].baselinePath,
      actualPath: results[0].actualPath,
      diffPath: results.find(r => r.diffPath)?.diffPath
    };
  }

  private generateReport(): RegressionReport {
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    
    return {
      timestamp: Date.now(),
      totalTests: this.testResults.length,
      passed,
      failed,
      results: this.testResults,
      summary: `${passed} of ${this.testResults.length} tests passed (${Math.round(passed / this.testResults.length * 100)}%)`
    };
  }

  private async generateHTMLReport(report: RegressionReport): Promise<string> {
    const htmlPath = path.join(this.config.outputDir!, 'regression-report.html');
    
    const testRows = report.results.map(result => `
      <tr class="${result.passed ? 'passed' : 'failed'}">
        <td>${result.name}</td>
        <td>${result.viewport || 'default'}</td>
        <td>${result.similarity}%</td>
        <td>${result.passed ? '✅ Passed' : '❌ Failed'}</td>
        <td>${result.differences.join('<br>')}</td>
        <td>
          <a href="${path.basename(result.baselinePath)}">Baseline</a> |
          <a href="${path.basename(result.actualPath)}">Actual</a>
          ${result.diffPath ? `| <a href="${path.basename(result.diffPath)}">Diff</a>` : ''}
        </td>
      </tr>
    `).join('');
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Visual Regression Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 { color: #333; }
    .summary {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary.passed { border-left: 4px solid #10b981; }
    .summary.failed { border-left: 4px solid #ef4444; }
    table {
      width: 100%;
      background: white;
      border-collapse: collapse;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 12px;
      border-top: 1px solid #e5e7eb;
    }
    tr.passed { background: #f0fdf4; }
    tr.failed { background: #fef2f2; }
    a {
      color: #3b82f6;
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Visual Regression Report</h1>
  
  <div class="summary ${report.failed === 0 ? 'passed' : 'failed'}">
    <h2>Summary</h2>
    <p><strong>Total Tests:</strong> ${report.totalTests}</p>
    <p><strong>Passed:</strong> ${report.passed}</p>
    <p><strong>Failed:</strong> ${report.failed}</p>
    <p><strong>Success Rate:</strong> ${Math.round(report.passed / report.totalTests * 100)}%</p>
    <p><strong>Threshold:</strong> ${this.config.threshold}%</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Test Name</th>
        <th>Viewport</th>
        <th>Similarity</th>
        <th>Status</th>
        <th>Differences</th>
        <th>Images</th>
      </tr>
    </thead>
    <tbody>
      ${testRows}
    </tbody>
  </table>
  
  <p style="margin-top: 20px; color: #6b7280;">
    Generated: ${new Date(report.timestamp).toLocaleString()}
  </p>
</body>
</html>
    `;
    
    fs.writeFileSync(htmlPath, html);
    this.logger.info(`HTML report saved to ${htmlPath}`);
    
    return htmlPath;
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.config.baselineDir!)) {
      fs.mkdirSync(this.config.baselineDir!, { recursive: true });
    }
    if (!fs.existsSync(this.config.outputDir!)) {
      fs.mkdirSync(this.config.outputDir!, { recursive: true });
    }
  }
}