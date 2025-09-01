import { PlayClone } from '../index';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TestScenario {
  name: string;
  description: string;
  url: string;
  steps: TestStep[];
  assertions: TestAssertion[];
  metadata?: {
    tags?: string[];
    priority?: 'low' | 'medium' | 'high';
    browserType?: 'chromium' | 'firefox' | 'webkit';
    timeout?: number;
    retries?: number;
  };
}

export interface TestStep {
  action: 'navigate' | 'click' | 'fill' | 'select' | 'getText' | 'getLinks' | 'screenshot' | 'wait' | 'hover' | 'press' | 'check' | 'uncheck';
  target?: string;
  value?: string;
  options?: any;
  description?: string;
  waitBefore?: number;
  waitAfter?: number;
}

export interface TestAssertion {
  type: 'contains' | 'equals' | 'exists' | 'visible' | 'count' | 'url' | 'title' | 'attribute';
  target?: string;
  expected: any;
  description?: string;
}

export interface GeneratorOptions {
  outputFormat?: 'json' | 'javascript' | 'typescript' | 'python' | 'yaml';
  framework?: 'playclone' | 'playwright' | 'puppeteer' | 'selenium' | 'cypress';
  includeComments?: boolean;
  includeTryCatch?: boolean;
  includeLogging?: boolean;
  outputPath?: string;
}

export class TestScenarioGenerator {
  private scenarios: Map<string, TestScenario> = new Map();
  private templates: Map<string, TestScenario> = new Map();
  private recordedSteps: TestStep[] = [];
  private isRecording: boolean = false;
  private playclone?: PlayClone;

  constructor() {
    this.loadBuiltInTemplates();
  }

  private loadBuiltInTemplates(): void {
    // E-commerce checkout template
    this.templates.set('ecommerce-checkout', {
      name: 'E-commerce Checkout Flow',
      description: 'Test complete checkout process on an e-commerce site',
      url: '{{baseUrl}}',
      steps: [
        { action: 'navigate', value: '{{baseUrl}}', description: 'Go to homepage' },
        { action: 'click', target: 'search button', description: 'Open search' },
        { action: 'fill', target: 'search input', value: '{{searchQuery}}', description: 'Enter search term' },
        { action: 'press', value: 'Enter', description: 'Submit search' },
        { action: 'click', target: 'first product', description: 'Click first result' },
        { action: 'click', target: 'add to cart button', description: 'Add to cart' },
        { action: 'click', target: 'cart icon', description: 'Go to cart' },
        { action: 'click', target: 'checkout button', description: 'Proceed to checkout' },
        { action: 'fill', target: 'email input', value: '{{email}}', description: 'Enter email' },
        { action: 'fill', target: 'shipping address', value: '{{address}}', description: 'Enter address' },
        { action: 'click', target: 'continue button', description: 'Continue to payment' }
      ],
      assertions: [
        { type: 'contains', target: 'cart count', expected: '1', description: 'Cart has item' },
        { type: 'visible', target: 'order summary', expected: true, description: 'Order summary visible' },
        { type: 'url', expected: '/checkout', description: 'On checkout page' }
      ],
      metadata: {
        tags: ['ecommerce', 'checkout', 'critical'],
        priority: 'high',
        timeout: 30000
      }
    });

    // Form submission template
    this.templates.set('form-submission', {
      name: 'Form Submission Test',
      description: 'Test form validation and submission',
      url: '{{formUrl}}',
      steps: [
        { action: 'navigate', value: '{{formUrl}}', description: 'Go to form page' },
        { action: 'fill', target: 'name field', value: '{{name}}', description: 'Enter name' },
        { action: 'fill', target: 'email field', value: '{{email}}', description: 'Enter email' },
        { action: 'select', target: 'country dropdown', value: '{{country}}', description: 'Select country' },
        { action: 'check', target: 'terms checkbox', description: 'Accept terms' },
        { action: 'click', target: 'submit button', description: 'Submit form' }
      ],
      assertions: [
        { type: 'contains', target: 'success message', expected: 'Thank you', description: 'Success message shown' },
        { type: 'url', expected: '/success', description: 'Redirected to success page' }
      ],
      metadata: {
        tags: ['form', 'validation'],
        priority: 'medium'
      }
    });

    // Login flow template
    this.templates.set('login-flow', {
      name: 'Login Flow Test',
      description: 'Test user authentication',
      url: '{{loginUrl}}',
      steps: [
        { action: 'navigate', value: '{{loginUrl}}', description: 'Go to login page' },
        { action: 'fill', target: 'username input', value: '{{username}}', description: 'Enter username' },
        { action: 'fill', target: 'password input', value: '{{password}}', description: 'Enter password' },
        { action: 'click', target: 'login button', description: 'Submit login' },
        { action: 'wait', value: '2000', description: 'Wait for redirect' }
      ],
      assertions: [
        { type: 'url', expected: '/dashboard', description: 'Redirected to dashboard' },
        { type: 'visible', target: 'user menu', expected: true, description: 'User menu visible' },
        { type: 'contains', target: 'welcome message', expected: '{{username}}', description: 'Username displayed' }
      ],
      metadata: {
        tags: ['auth', 'login', 'critical'],
        priority: 'high'
      }
    });

    // Search functionality template
    this.templates.set('search-test', {
      name: 'Search Functionality Test',
      description: 'Test search feature and results',
      url: '{{baseUrl}}',
      steps: [
        { action: 'navigate', value: '{{baseUrl}}', description: 'Go to homepage' },
        { action: 'fill', target: 'search box', value: '{{searchTerm}}', description: 'Enter search term' },
        { action: 'press', value: 'Enter', description: 'Submit search' },
        { action: 'wait', value: '1000', description: 'Wait for results' }
      ],
      assertions: [
        { type: 'exists', target: 'search results', expected: true, description: 'Results displayed' },
        { type: 'count', target: 'result items', expected: '>0', description: 'Has results' },
        { type: 'contains', target: 'results text', expected: '{{searchTerm}}', description: 'Term in results' }
      ],
      metadata: {
        tags: ['search', 'functionality'],
        priority: 'medium'
      }
    });

    // Navigation menu template
    this.templates.set('navigation-test', {
      name: 'Navigation Menu Test',
      description: 'Test site navigation links',
      url: '{{baseUrl}}',
      steps: [
        { action: 'navigate', value: '{{baseUrl}}', description: 'Go to homepage' },
        { action: 'click', target: 'About link', description: 'Click About' },
        { action: 'wait', value: '1000', description: 'Wait for page load' },
        { action: 'click', target: 'Services link', description: 'Click Services' },
        { action: 'wait', value: '1000', description: 'Wait for page load' },
        { action: 'click', target: 'Contact link', description: 'Click Contact' }
      ],
      assertions: [
        { type: 'url', expected: '/about', description: 'On About page' },
        { type: 'title', expected: 'About Us', description: 'About page title' },
        { type: 'visible', target: 'contact form', expected: true, description: 'Contact form visible' }
      ],
      metadata: {
        tags: ['navigation', 'ui'],
        priority: 'low'
      }
    });
  }

  public async createScenario(name: string, options?: Partial<TestScenario>): Promise<TestScenario> {
    const scenario: TestScenario = {
      name,
      description: options?.description || '',
      url: options?.url || '',
      steps: options?.steps || [],
      assertions: options?.assertions || [],
      metadata: options?.metadata
    };

    this.scenarios.set(name, scenario);
    return scenario;
  }

  public async generateFromTemplate(
    templateName: string,
    variables: Record<string, string>
  ): Promise<TestScenario> {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    // Deep clone template
    const scenario = JSON.parse(JSON.stringify(template));

    // Replace variables in all string fields
    const replaceVariables = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] || match);
      }
      if (Array.isArray(obj)) {
        return obj.map(replaceVariables);
      }
      if (typeof obj === 'object' && obj !== null) {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = replaceVariables(value);
        }
        return result;
      }
      return obj;
    };

    return replaceVariables(scenario);
  }

  public async startRecording(playclone: PlayClone): Promise<void> {
    this.playclone = playclone;
    this.recordedSteps = [];
    this.isRecording = true;
    
    // Inject recording script into page
    const page = (playclone as any).page;
    if (page) {
      await page.evaluateOnNewDocument(() => {
        // Track user interactions
        window.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          console.log('PLAYCLONE_RECORD:click', {
            selector: target.tagName.toLowerCase(),
            text: target.textContent?.trim(),
            id: target.id,
            className: target.className
          });
        });

        window.addEventListener('input', (e) => {
          const target = e.target as HTMLInputElement;
          console.log('PLAYCLONE_RECORD:input', {
            selector: target.tagName.toLowerCase(),
            value: target.value,
            name: target.name,
            id: target.id
          });
        });
      });

      // Listen for console messages
      page.on('console', (msg: any) => {
        const text = msg.text();
        if (text.startsWith('PLAYCLONE_RECORD:')) {
          const [_, action, data] = text.split('PLAYCLONE_RECORD:')[1].split(' ');
          this.recordedSteps.push({
            action: action as any,
            target: data
          });
        }
      });
    }
  }

  public async stopRecording(): Promise<TestScenario> {
    this.isRecording = false;
    
    const scenario: TestScenario = {
      name: `Recorded Scenario ${Date.now()}`,
      description: 'Automatically recorded test scenario',
      url: this.recordedSteps[0]?.value || '',
      steps: this.recordedSteps,
      assertions: []
    };

    this.scenarios.set(scenario.name, scenario);
    return scenario;
  }

  public async generateCode(
    scenario: TestScenario,
    options: GeneratorOptions = {}
  ): Promise<string> {
    const {
      outputFormat = 'javascript',
      framework = 'playclone',
      includeComments = true,
      includeTryCatch = true,
      includeLogging = false
    } = options;

    let code = '';

    switch (outputFormat) {
      case 'javascript':
        code = this.generateJavaScript(scenario, framework, includeComments, includeTryCatch, includeLogging);
        break;
      case 'typescript':
        code = this.generateTypeScript(scenario, framework, includeComments, includeTryCatch, includeLogging);
        break;
      case 'python':
        code = this.generatePython(scenario, framework, includeComments, includeTryCatch, includeLogging);
        break;
      case 'yaml':
        code = this.generateYAML(scenario);
        break;
      case 'json':
        code = JSON.stringify(scenario, null, 2);
        break;
      default:
        throw new Error(`Unsupported output format: ${outputFormat}`);
    }

    if (options.outputPath) {
      await fs.writeFile(options.outputPath, code, 'utf-8');
    }

    return code;
  }

  private generateJavaScript(
    scenario: TestScenario,
    framework: string,
    includeComments: boolean,
    includeTryCatch: boolean,
    includeLogging: boolean
  ): string {
    const lines: string[] = [];

    // Add imports
    if (framework === 'playclone') {
      lines.push("const { PlayClone } = require('playclone');");
    } else if (framework === 'playwright') {
      lines.push("const { chromium } = require('playwright');");
    } else if (framework === 'puppeteer') {
      lines.push("const puppeteer = require('puppeteer');");
    }
    lines.push('');

    // Add test function
    if (includeComments) {
      lines.push(`// Test: ${scenario.name}`);
      lines.push(`// ${scenario.description}`);
    }
    
    lines.push(`async function test${scenario.name.replace(/\s+/g, '')}() {`);
    
    if (includeTryCatch) {
      lines.push('  try {');
    }

    // Initialize browser
    const indent = includeTryCatch ? '    ' : '  ';
    
    if (framework === 'playclone') {
      lines.push(`${indent}const pc = new PlayClone({ headless: false });`);
      lines.push(`${indent}await pc.launch();`);
    } else if (framework === 'playwright') {
      lines.push(`${indent}const browser = await chromium.launch({ headless: false });`);
      lines.push(`${indent}const page = await browser.newPage();`);
    } else if (framework === 'puppeteer') {
      lines.push(`${indent}const browser = await puppeteer.launch({ headless: false });`);
      lines.push(`${indent}const page = await browser.newPage();`);
    }
    lines.push('');

    // Add steps
    for (const step of scenario.steps) {
      if (includeComments && step.description) {
        lines.push(`${indent}// ${step.description}`);
      }

      if (step.waitBefore) {
        lines.push(`${indent}await new Promise(r => setTimeout(r, ${step.waitBefore}));`);
      }

      if (includeLogging) {
        lines.push(`${indent}console.log('Executing: ${step.action}${step.target ? ` on ${step.target}` : ''}}');`);
      }

      // Generate step code based on framework
      const stepCode = this.generateStepCode(step, framework, indent);
      lines.push(stepCode);

      if (step.waitAfter) {
        lines.push(`${indent}await new Promise(r => setTimeout(r, ${step.waitAfter}));`);
      }
    }
    lines.push('');

    // Add assertions
    if (scenario.assertions.length > 0) {
      if (includeComments) {
        lines.push(`${indent}// Assertions`);
      }
      
      for (const assertion of scenario.assertions) {
        if (includeComments && assertion.description) {
          lines.push(`${indent}// ${assertion.description}`);
        }
        
        const assertCode = this.generateAssertionCode(assertion, framework, indent);
        lines.push(assertCode);
      }
      lines.push('');
    }

    // Cleanup
    if (framework === 'playclone') {
      lines.push(`${indent}await pc.close();`);
    } else {
      lines.push(`${indent}await browser.close();`);
    }

    if (includeLogging) {
      lines.push(`${indent}console.log('Test completed successfully');`);
    }

    if (includeTryCatch) {
      lines.push('  } catch (error) {');
      lines.push('    console.error(\'Test failed:\', error);');
      lines.push('    throw error;');
      lines.push('  }');
    }

    lines.push('}');
    lines.push('');
    lines.push(`// Run the test`);
    lines.push(`test${scenario.name.replace(/\s+/g, '')}();`);

    return lines.join('\n');
  }

  private generateTypeScript(
    scenario: TestScenario,
    framework: string,
    includeComments: boolean,
    includeTryCatch: boolean,
    includeLogging: boolean
  ): string {
    const js = this.generateJavaScript(scenario, framework, includeComments, includeTryCatch, includeLogging);
    
    // Convert to TypeScript
    let ts = js.replace(/^const /gm, 'import ');
    ts = ts.replace(/ = require\(/g, ' from ');
    ts = ts.replace(/\);$/gm, ';');
    ts = ts.replace(/async function /g, 'async function ');
    
    // Add type annotations
    if (framework === 'playclone') {
      ts = 'import { PlayClone } from \'playclone\';\n' + ts.substring(ts.indexOf('\n') + 1);
    }
    
    return ts;
  }

  private generatePython(
    scenario: TestScenario,
    framework: string,
    includeComments: boolean,
    includeTryCatch: boolean,
    includeLogging: boolean
  ): string {
    const lines: string[] = [];

    // Add imports
    if (framework === 'playclone') {
      lines.push('from playclone import PlayClone');
    } else if (framework === 'playwright') {
      lines.push('from playwright.async_api import async_playwright');
    } else if (framework === 'selenium') {
      lines.push('from selenium import webdriver');
      lines.push('from selenium.webdriver.common.by import By');
    }
    lines.push('import asyncio');
    lines.push('');

    // Add test function
    if (includeComments) {
      lines.push(`# Test: ${scenario.name}`);
      lines.push(`# ${scenario.description}`);
    }
    
    lines.push(`async def test_${scenario.name.toLowerCase().replace(/\s+/g, '_')}():`);
    
    const indent = '    ';
    
    if (includeTryCatch) {
      lines.push(`${indent}try:`);
    }

    // Python implementation details would go here
    lines.push(`${indent}${indent}# Test implementation`);
    lines.push(`${indent}${indent}pass`);

    if (includeTryCatch) {
      lines.push(`${indent}except Exception as e:`);
      lines.push(`${indent}${indent}print(f"Test failed: {e}")`);
      lines.push(`${indent}${indent}raise`);
    }

    lines.push('');
    lines.push('# Run the test');
    lines.push(`asyncio.run(test_${scenario.name.toLowerCase().replace(/\s+/g, '_')}())`);

    return lines.join('\n');
  }

  private generateYAML(scenario: TestScenario): string {
    const lines: string[] = [];
    
    lines.push(`name: ${scenario.name}`);
    lines.push(`description: ${scenario.description}`);
    lines.push(`url: ${scenario.url}`);
    lines.push('');
    
    if (scenario.metadata) {
      lines.push('metadata:');
      for (const [key, value] of Object.entries(scenario.metadata)) {
        if (Array.isArray(value)) {
          lines.push(`  ${key}:`);
          value.forEach(v => lines.push(`    - ${v}`));
        } else {
          lines.push(`  ${key}: ${value}`);
        }
      }
      lines.push('');
    }
    
    lines.push('steps:');
    for (const step of scenario.steps) {
      lines.push(`  - action: ${step.action}`);
      if (step.target) lines.push(`    target: ${step.target}`);
      if (step.value) lines.push(`    value: ${step.value}`);
      if (step.description) lines.push(`    description: ${step.description}`);
    }
    lines.push('');
    
    if (scenario.assertions.length > 0) {
      lines.push('assertions:');
      for (const assertion of scenario.assertions) {
        lines.push(`  - type: ${assertion.type}`);
        if (assertion.target) lines.push(`    target: ${assertion.target}`);
        lines.push(`    expected: ${assertion.expected}`);
        if (assertion.description) lines.push(`    description: ${assertion.description}`);
      }
    }
    
    return lines.join('\n');
  }

  private generateStepCode(step: TestStep, framework: string, indent: string): string {
    if (framework === 'playclone') {
      switch (step.action) {
        case 'navigate':
          return `${indent}await pc.navigate('${step.value}');`;
        case 'click':
          return `${indent}await pc.click('${step.target}');`;
        case 'fill':
          return `${indent}await pc.fill('${step.target}', '${step.value}');`;
        case 'select':
          return `${indent}await pc.select('${step.target}', '${step.value}');`;
        case 'getText':
          return `${indent}const text = await pc.getText('${step.target}');`;
        case 'getLinks':
          return `${indent}const links = await pc.getLinks();`;
        case 'screenshot':
          return `${indent}await pc.screenshot(${step.options ? JSON.stringify(step.options) : ''});`;
        case 'wait':
          return `${indent}await new Promise(r => setTimeout(r, ${step.value}));`;
        case 'hover':
          return `${indent}await pc.hover('${step.target}');`;
        case 'press':
          return `${indent}await pc.press('${step.value}');`;
        case 'check':
          return `${indent}await pc.check('${step.target}');`;
        case 'uncheck':
          return `${indent}await pc.uncheck('${step.target}');`;
        default:
          return `${indent}// TODO: ${step.action}`;
      }
    } else if (framework === 'playwright' || framework === 'puppeteer') {
      switch (step.action) {
        case 'navigate':
          return `${indent}await page.goto('${step.value}');`;
        case 'click':
          return `${indent}await page.click('${step.target}');`;
        case 'fill':
          return `${indent}await page.fill('${step.target}', '${step.value}');`;
        case 'select':
          return `${indent}await page.selectOption('${step.target}', '${step.value}');`;
        case 'getText':
          return `${indent}const text = await page.textContent('${step.target}');`;
        case 'screenshot':
          return `${indent}await page.screenshot(${step.options ? JSON.stringify(step.options) : ''});`;
        case 'wait':
          return `${indent}await page.waitForTimeout(${step.value});`;
        case 'hover':
          return `${indent}await page.hover('${step.target}');`;
        case 'press':
          return `${indent}await page.keyboard.press('${step.value}');`;
        default:
          return `${indent}// TODO: ${step.action}`;
      }
    }
    
    return `${indent}// ${step.action} not implemented for ${framework}`;
  }

  private generateAssertionCode(assertion: TestAssertion, framework: string, indent: string): string {
    switch (assertion.type) {
      case 'contains':
        return `${indent}console.assert(text.includes('${assertion.expected}'), '${assertion.description || 'Text contains expected value'}');`;
      case 'equals':
        return `${indent}console.assert(value === '${assertion.expected}', '${assertion.description || 'Value equals expected'}');`;
      case 'exists':
        return `${indent}console.assert(element !== null, '${assertion.description || 'Element exists'}');`;
      case 'visible':
        return `${indent}console.assert(isVisible === ${assertion.expected}, '${assertion.description || 'Element visibility'}');`;
      case 'count':
        return `${indent}console.assert(count ${assertion.expected}, '${assertion.description || 'Element count'}');`;
      case 'url':
        return `${indent}console.assert(url.includes('${assertion.expected}'), '${assertion.description || 'URL contains expected path'}');`;
      case 'title':
        return `${indent}console.assert(title === '${assertion.expected}', '${assertion.description || 'Page title matches'}');`;
      case 'attribute':
        return `${indent}console.assert(attr === '${assertion.expected}', '${assertion.description || 'Attribute value matches'}');`;
      default:
        return `${indent}// Assertion: ${assertion.type}`;
    }
  }

  public listTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  public getTemplate(name: string): TestScenario | undefined {
    return this.templates.get(name);
  }

  public listScenarios(): string[] {
    return Array.from(this.scenarios.keys());
  }

  public getScenario(name: string): TestScenario | undefined {
    return this.scenarios.get(name);
  }

  public async saveScenario(name: string, filePath: string): Promise<void> {
    const scenario = this.scenarios.get(name);
    if (!scenario) {
      throw new Error(`Scenario '${name}' not found`);
    }
    
    await fs.writeFile(filePath, JSON.stringify(scenario, null, 2), 'utf-8');
  }

  public async loadScenario(filePath: string): Promise<TestScenario> {
    const content = await fs.readFile(filePath, 'utf-8');
    const scenario = JSON.parse(content) as TestScenario;
    this.scenarios.set(scenario.name, scenario);
    return scenario;
  }

  public async batchGenerate(
    scenarios: string[],
    options: GeneratorOptions
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    for (const name of scenarios) {
      const scenario = this.scenarios.get(name) || this.templates.get(name);
      if (scenario) {
        const code = await this.generateCode(scenario, options);
        results.set(name, code);
      }
    }
    
    return results;
  }

  public analyzeScenario(scenario: TestScenario): {
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedDuration: number;
    coverage: string[];
    risks: string[];
    suggestions: string[];
  } {
    const stepCount = scenario.steps.length;
    const assertionCount = scenario.assertions.length;
    const hasWaits = scenario.steps.some(s => s.action === 'wait');
    const hasLoops = false; // Would need more complex analysis
    
    // Determine complexity
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (stepCount > 20 || assertionCount > 10) {
      complexity = 'complex';
    } else if (stepCount > 10 || assertionCount > 5) {
      complexity = 'moderate';
    }
    
    // Estimate duration (rough estimate)
    let estimatedDuration = 0;
    for (const step of scenario.steps) {
      switch (step.action) {
        case 'navigate':
          estimatedDuration += 3000;
          break;
        case 'wait':
          estimatedDuration += parseInt(step.value || '1000');
          break;
        default:
          estimatedDuration += 500;
      }
    }
    
    // Determine coverage
    const coverage: string[] = [];
    const actions = new Set(scenario.steps.map(s => s.action));
    if (actions.has('navigate')) coverage.push('navigation');
    if (actions.has('click')) coverage.push('interaction');
    if (actions.has('fill') || actions.has('select')) coverage.push('forms');
    if (actions.has('getText') || actions.has('getLinks')) coverage.push('data extraction');
    
    // Identify risks
    const risks: string[] = [];
    if (!hasWaits && stepCount > 5) {
      risks.push('No explicit waits - may have timing issues');
    }
    if (scenario.assertions.length === 0) {
      risks.push('No assertions - test may pass without validation');
    }
    if (estimatedDuration > 30000) {
      risks.push('Long execution time - consider breaking into smaller tests');
    }
    
    // Generate suggestions
    const suggestions: string[] = [];
    if (!scenario.metadata?.retries) {
      suggestions.push('Add retry configuration for flaky tests');
    }
    if (!scenario.metadata?.timeout) {
      suggestions.push('Set explicit timeout for long-running tests');
    }
    if (scenario.assertions.length < scenario.steps.length / 3) {
      suggestions.push('Add more assertions to validate behavior');
    }
    
    return {
      complexity,
      estimatedDuration,
      coverage,
      risks,
      suggestions
    };
  }
}

export default TestScenarioGenerator;