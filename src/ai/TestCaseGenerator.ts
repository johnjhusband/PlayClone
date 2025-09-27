import { PlayClone } from '../index';
import { UserStoryParser } from './UserStoryParser';

interface TestCase {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;
  framework: 'playclone' | 'playwright' | 'puppeteer' | 'selenium' | 'cypress';
  language: 'javascript' | 'typescript' | 'python';
  dependencies: string[];
  assertions: string[];
  dataSet?: any;
  tags: string[];
  estimatedDuration: number; // in seconds
}

interface TestSuite {
  name: string;
  description: string;
  testCases: TestCase[];
  setup: string;
  teardown: string;
  config: any;
  totalDuration: number;
}

export class TestCaseGenerator {
  private parser: UserStoryParser;
  private testIdCounter = 0;

  constructor() {
    this.parser = new UserStoryParser();
  }

  async generateFromUserStory(
    storyText: string,
    options: {
      framework?: TestCase['framework'];
      language?: TestCase['language'];
      includeNegativeTests?: boolean;
      includePerformanceTests?: boolean;
      includeAccessibilityTests?: boolean;
      dataGenerator?: 'faker' | 'static' | 'dynamic';
    } = {}
  ): Promise<TestSuite> {
    const {
      framework = 'playclone',
      language = 'javascript',
      includeNegativeTests = true,
      includePerformanceTests = false,
      includeAccessibilityTests = false,
      dataGenerator = 'static'
    } = options;

    // Parse the user story
    const story = this.parser.parseUserStory(storyText);
    
    // Generate test suite
    const suite: TestSuite = {
      name: story.title,
      description: `Test suite for: As a ${story.asA}, I want to ${story.iWant} so that ${story.soThat}`,
      testCases: [],
      setup: this.generateSetupCode(framework, language),
      teardown: this.generateTeardownCode(framework, language),
      config: this.generateConfig(framework, story),
      totalDuration: 0
    };

    // Generate test cases for each scenario
    for (const scenario of story.scenarios) {
      const testCase = this.generateTestCase(scenario, framework, language, dataGenerator);
      suite.testCases.push(testCase);
      suite.totalDuration += testCase.estimatedDuration;
    }

    // Add negative test cases if requested
    if (includeNegativeTests) {
      const negativeScenarios = this.parser.suggestAdditionalScenarios(story)
        .filter(s => s.tags.includes('negative'));
      for (const scenario of negativeScenarios) {
        const testCase = this.generateTestCase(scenario, framework, language, dataGenerator);
        suite.testCases.push(testCase);
        suite.totalDuration += testCase.estimatedDuration;
      }
    }

    // Add performance tests if requested
    if (includePerformanceTests) {
      const perfTest = this.generatePerformanceTest(story, framework, language);
      suite.testCases.push(perfTest);
      suite.totalDuration += perfTest.estimatedDuration;
    }

    // Add accessibility tests if requested
    if (includeAccessibilityTests) {
      const a11yTest = this.generateAccessibilityTest(story, framework, language);
      suite.testCases.push(a11yTest);
      suite.totalDuration += a11yTest.estimatedDuration;
    }

    return suite;
  }

  generateFromGherkin(
    gherkinText: string,
    framework: TestCase['framework'] = 'playclone',
    language: TestCase['language'] = 'javascript'
  ): TestCase {
    const scenario = this.parser.parseGherkinScenario(gherkinText);
    return this.generateTestCase(scenario, framework, language, 'static');
  }

  generatePageObjectModel(story: any): string {
    let code = '';
    
    // Extract page elements from scenarios
    const elements = new Set<string>();
    for (const scenario of story.scenarios) {
      for (const step of scenario.steps) {
        if (step.element) {
          elements.add(step.element);
        }
      }
    }

    // Generate Page Object class
    code += `class ${this.toPascalCase(story.title)}Page {\n`;
    code += `  constructor(browser) {\n`;
    code += `    this.browser = browser;\n`;
    code += `  }\n\n`;

    // Generate element getters
    for (const element of elements) {
      const methodName = this.toCamelCase(element);
      code += `  get ${methodName}() {\n`;
      code += `    return this.browser.locator('${element}');\n`;
      code += `  }\n\n`;
    }

    // Generate action methods
    code += `  async navigate() {\n`;
    code += `    await this.browser.navigate('/');\n`;
    code += `  }\n\n`;

    code += `  async login(username, password) {\n`;
    code += `    // Implement login logic\n`;
    code += `  }\n\n`;

    code += `  async submitForm(data) {\n`;
    code += `    // Implement form submission\n`;
    code += `  }\n`;

    code += `}\n\n`;
    code += `module.exports = ${this.toPascalCase(story.title)}Page;`;

    return code;
  }

  generateDataDrivenTests(
    baseTest: TestCase,
    dataSets: any[]
  ): TestCase[] {
    return dataSets.map((dataSet, index) => ({
      ...baseTest,
      id: `${baseTest.id}_data_${index + 1}`,
      name: `${baseTest.name} - Data Set ${index + 1}`,
      dataSet,
      code: this.injectTestData(baseTest.code, dataSet)
    }));
  }

  convertToFramework(
    testCase: TestCase,
    targetFramework: TestCase['framework']
  ): TestCase {
    const converters = {
      playclone: this.convertToPlayClone.bind(this),
      playwright: this.convertToPlaywright.bind(this),
      puppeteer: this.convertToPuppeteer.bind(this),
      selenium: this.convertToSelenium.bind(this),
      cypress: this.convertToCypress.bind(this)
    };

    const converter = converters[targetFramework];
    if (!converter) {
      throw new Error(`Unsupported framework: ${targetFramework}`);
    }

    return {
      ...testCase,
      framework: targetFramework,
      code: converter(testCase.code),
      dependencies: this.getFrameworkDependencies(targetFramework)
    };
  }

  optimizeTestSuite(suite: TestSuite): TestSuite {
    // Remove duplicate test cases
    const uniqueTests = new Map<string, TestCase>();
    for (const test of suite.testCases) {
      const key = `${test.name}-${test.assertions.join('-')}`;
      if (!uniqueTests.has(key)) {
        uniqueTests.set(key, test);
      }
    }

    // Reorder tests for optimal execution
    const optimizedTests = Array.from(uniqueTests.values()).sort((a, b) => {
      // Prioritize by tags
      const priorityOrder = ['critical', 'high', 'medium', 'low'];
      const aPriority = a.tags.find(t => priorityOrder.includes(t)) || 'low';
      const bPriority = b.tags.find(t => priorityOrder.includes(t)) || 'low';
      
      if (aPriority !== bPriority) {
        return priorityOrder.indexOf(aPriority) - priorityOrder.indexOf(bPriority);
      }
      
      // Then by estimated duration (shortest first)
      return a.estimatedDuration - b.estimatedDuration;
    });

    return {
      ...suite,
      testCases: optimizedTests,
      totalDuration: optimizedTests.reduce((sum, t) => sum + t.estimatedDuration, 0)
    };
  }

  generateCICDConfig(suite: TestSuite): string {
    let config = '# CI/CD Configuration for Test Suite\n\n';
    
    // GitHub Actions example
    config += `name: ${suite.name} Tests\n\n`;
    config += 'on:\n';
    config += '  push:\n';
    config += '    branches: [main, develop]\n';
    config += '  pull_request:\n';
    config += '    branches: [main]\n\n';
    
    config += 'jobs:\n';
    config += '  test:\n';
    config += '    runs-on: ubuntu-latest\n';
    config += '    steps:\n';
    config += '      - uses: actions/checkout@v2\n';
    config += '      - uses: actions/setup-node@v2\n';
    config += '        with:\n';
    config += '          node-version: "18"\n';
    config += '      - run: npm ci\n';
    config += '      - run: npx playwright install\n';
    config += '      - run: npm test\n';
    config += '      - uses: actions/upload-artifact@v2\n';
    config += '        if: failure()\n';
    config += '        with:\n';
    config += '          name: test-results\n';
    config += '          path: test-results/\n';
    
    return config;
  }

  private generateTestCase(
    scenario: any,
    framework: TestCase['framework'],
    language: TestCase['language'],
    dataGenerator: string
  ): TestCase {
    const testId = `test_${++this.testIdCounter}`;
    const code = this.generateTestCode(scenario, framework, language, dataGenerator);
    
    return {
      id: testId,
      name: scenario.title,
      description: scenario.description || scenario.title,
      category: this.categorizeTest(scenario),
      code,
      framework,
      language,
      dependencies: this.getFrameworkDependencies(framework),
      assertions: this.extractAssertions(scenario),
      tags: scenario.tags,
      estimatedDuration: this.estimateTestDuration(scenario),
      dataSet: dataGenerator === 'static' ? this.generateStaticData(scenario) : undefined
    };
  }

  private generateTestCode(
    scenario: any,
    framework: string,
    language: string,
    dataGenerator: string
  ): string {
    const generators: Record<string, Function> = {
      playclone: this.generatePlayCloneTest.bind(this),
      playwright: this.generatePlaywrightTest.bind(this),
      puppeteer: this.generatePuppeteerTest.bind(this),
      selenium: this.generateSeleniumTest.bind(this),
      cypress: this.generateCypressTest.bind(this)
    };

    const generator = generators[framework];
    if (!generator) {
      throw new Error(`Unsupported framework: ${framework}`);
    }

    return generator(scenario, language, dataGenerator);
  }

  private generatePlayCloneTest(scenario: any, language: string, dataGenerator: string): string {
    let code = '';
    
    if (language === 'javascript') {
      code += `it('${scenario.title}', async () => {\n`;
      code += `  const browser = new PlayClone({ headless: true });\n\n`;
      
      for (const step of scenario.steps) {
        code += this.generatePlayCloneStep(step);
      }
      
      code += `\n  await browser.close();\n`;
      code += `});\n`;
    } else if (language === 'typescript') {
      code += `it('${scenario.title}', async (): Promise<void> => {\n`;
      code += `  const browser = new PlayClone({ headless: true });\n\n`;
      
      for (const step of scenario.steps) {
        code += this.generatePlayCloneStep(step);
      }
      
      code += `\n  await browser.close();\n`;
      code += `});\n`;
    }
    
    return code;
  }

  private generatePlayCloneStep(step: any): string {
    let code = '  ';
    
    switch (step.type) {
      case 'given':
        if (step.action.includes('navigate') || step.action.includes('page')) {
          code += `await browser.navigate('${step.data || '/'}');\n`;
        }
        break;
      
      case 'when':
        if (step.action.includes('click')) {
          code += `await browser.click('${step.element || step.action}');\n`;
        } else if (step.action.includes('enter') || step.action.includes('type')) {
          code += `await browser.fill('${step.element}', '${step.data}');\n`;
        } else if (step.action.includes('select')) {
          code += `await browser.select('${step.element}', '${step.data}');\n`;
        }
        break;
      
      case 'then':
        if (step.assertion) {
          code += `const result = await browser.getText('${step.element || 'body'}');\n`;
          code += `  expect(result.data).toContain('${step.assertion}');\n`;
        }
        break;
    }
    
    return code;
  }

  private generatePlaywrightTest(scenario: any, language: string, dataGenerator: string): string {
    let code = '';
    
    code += `test('${scenario.title}', async ({ page }) => {\n`;
    
    for (const step of scenario.steps) {
      code += this.generatePlaywrightStep(step);
    }
    
    code += `});\n`;
    
    return code;
  }

  private generatePlaywrightStep(step: any): string {
    let code = '  ';
    
    switch (step.type) {
      case 'given':
        if (step.action.includes('navigate') || step.action.includes('page')) {
          code += `await page.goto('${step.data || '/'}');\n`;
        }
        break;
      
      case 'when':
        if (step.action.includes('click')) {
          code += `await page.click('text=${step.element || step.action}');\n`;
        } else if (step.action.includes('enter') || step.action.includes('type')) {
          code += `await page.fill('${step.element}', '${step.data}');\n`;
        }
        break;
      
      case 'then':
        if (step.assertion) {
          code += `await expect(page.locator('body')).toContainText('${step.assertion}');\n`;
        }
        break;
    }
    
    return code;
  }

  private generatePuppeteerTest(scenario: any, language: string, dataGenerator: string): string {
    let code = '';
    
    code += `it('${scenario.title}', async () => {\n`;
    code += `  const browser = await puppeteer.launch();\n`;
    code += `  const page = await browser.newPage();\n\n`;
    
    for (const step of scenario.steps) {
      code += this.generatePuppeteerStep(step);
    }
    
    code += `\n  await browser.close();\n`;
    code += `});\n`;
    
    return code;
  }

  private generatePuppeteerStep(step: any): string {
    let code = '  ';
    
    switch (step.type) {
      case 'given':
        if (step.action.includes('navigate') || step.action.includes('page')) {
          code += `await page.goto('${step.data || '/'}');\n`;
        }
        break;
      
      case 'when':
        if (step.action.includes('click')) {
          code += `await page.click('${step.element}');\n`;
        } else if (step.action.includes('enter') || step.action.includes('type')) {
          code += `await page.type('${step.element}', '${step.data}');\n`;
        }
        break;
      
      case 'then':
        if (step.assertion) {
          code += `const text = await page.$eval('body', el => el.textContent);\n`;
          code += `  expect(text).toContain('${step.assertion}');\n`;
        }
        break;
    }
    
    return code;
  }

  private generateSeleniumTest(scenario: any, language: string, dataGenerator: string): string {
    let code = '';
    
    if (language === 'javascript') {
      code += `it('${scenario.title}', async function() {\n`;
      code += `  const driver = await new Builder().forBrowser('chrome').build();\n\n`;
      
      for (const step of scenario.steps) {
        code += this.generateSeleniumStep(step);
      }
      
      code += `\n  await driver.quit();\n`;
      code += `});\n`;
    }
    
    return code;
  }

  private generateSeleniumStep(step: any): string {
    let code = '  ';
    
    switch (step.type) {
      case 'given':
        if (step.action.includes('navigate') || step.action.includes('page')) {
          code += `await driver.get('${step.data || '/'}');\n`;
        }
        break;
      
      case 'when':
        if (step.action.includes('click')) {
          code += `await driver.findElement(By.linkText('${step.element}')).click();\n`;
        } else if (step.action.includes('enter') || step.action.includes('type')) {
          code += `await driver.findElement(By.name('${step.element}')).sendKeys('${step.data}');\n`;
        }
        break;
      
      case 'then':
        if (step.assertion) {
          code += `const text = await driver.findElement(By.tagName('body')).getText();\n`;
          code += `  assert(text.includes('${step.assertion}'));\n`;
        }
        break;
    }
    
    return code;
  }

  private generateCypressTest(scenario: any, language: string, dataGenerator: string): string {
    let code = '';
    
    code += `it('${scenario.title}', () => {\n`;
    
    for (const step of scenario.steps) {
      code += this.generateCypressStep(step);
    }
    
    code += `});\n`;
    
    return code;
  }

  private generateCypressStep(step: any): string {
    let code = '  ';
    
    switch (step.type) {
      case 'given':
        if (step.action.includes('navigate') || step.action.includes('page')) {
          code += `cy.visit('${step.data || '/'}');\n`;
        }
        break;
      
      case 'when':
        if (step.action.includes('click')) {
          code += `cy.contains('${step.element || step.action}').click();\n`;
        } else if (step.action.includes('enter') || step.action.includes('type')) {
          code += `cy.get('${step.element}').type('${step.data}');\n`;
        }
        break;
      
      case 'then':
        if (step.assertion) {
          code += `cy.contains('${step.assertion}').should('be.visible');\n`;
        }
        break;
    }
    
    return code;
  }

  private generatePerformanceTest(story: any, framework: string, language: string): TestCase {
    const code = `
it('Performance test for ${story.title}', async () => {
  const browser = new PlayClone({ headless: true });
  const startTime = Date.now();
  
  // Execute main user flow
  await browser.navigate('/');
  // Add main scenario steps here
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  expect(duration).toBeLessThan(3000); // Should complete in under 3 seconds
  
  await browser.close();
});`;

    return {
      id: `perf_${++this.testIdCounter}`,
      name: `Performance: ${story.title}`,
      description: 'Performance test for main user flow',
      category: 'performance',
      code,
      framework: framework as TestCase['framework'],
      language: language as TestCase['language'],
      dependencies: this.getFrameworkDependencies(framework),
      assertions: ['Response time < 3s'],
      tags: ['performance'],
      estimatedDuration: 10
    };
  }

  private generateAccessibilityTest(story: any, framework: string, language: string): TestCase {
    const code = `
it('Accessibility test for ${story.title}', async () => {
  const browser = new PlayClone({ headless: true });
  
  await browser.navigate('/');
  
  // Check for accessibility issues
  const accessibilityReport = await browser.checkAccessibility();
  
  expect(accessibilityReport.violations).toHaveLength(0);
  
  await browser.close();
});`;

    return {
      id: `a11y_${++this.testIdCounter}`,
      name: `Accessibility: ${story.title}`,
      description: 'Accessibility compliance test',
      category: 'accessibility',
      code,
      framework: framework as TestCase['framework'],
      language: language as TestCase['language'],
      dependencies: [...this.getFrameworkDependencies(framework), 'axe-core'],
      assertions: ['No accessibility violations'],
      tags: ['accessibility', 'a11y'],
      estimatedDuration: 5
    };
  }

  private generateSetupCode(framework: string, language: string): string {
    const setup: Record<string, string> = {
      playclone: `const { PlayClone } = require('playclone');`,
      playwright: `const { test, expect } = require('@playwright/test');`,
      puppeteer: `const puppeteer = require('puppeteer');`,
      selenium: `const { Builder, By, until } = require('selenium-webdriver');`,
      cypress: `// Cypress setup in cypress.config.js`
    };
    
    return setup[framework] || '';
  }

  private generateTeardownCode(framework: string, language: string): string {
    const teardown: Record<string, string> = {
      playclone: `// PlayClone auto-closes on test completion`,
      playwright: `// Playwright auto-manages browser lifecycle`,
      puppeteer: `// Remember to close browser in each test`,
      selenium: `// Remember to quit driver in each test`,
      cypress: `// Cypress handles cleanup automatically`
    };
    
    return teardown[framework] || '';
  }

  private generateConfig(framework: string, story: any): any {
    const configs: Record<string, any> = {
      playclone: {
        headless: true,
        viewport: { width: 1280, height: 720 },
        timeout: 30000
      },
      playwright: {
        use: {
          headless: true,
          viewport: { width: 1280, height: 720 },
          actionTimeout: 30000
        }
      },
      puppeteer: {
        headless: true,
        args: ['--no-sandbox']
      },
      selenium: {
        capabilities: {
          browserName: 'chrome',
          'goog:chromeOptions': {
            args: ['--headless']
          }
        }
      },
      cypress: {
        viewportWidth: 1280,
        viewportHeight: 720,
        video: false
      }
    };
    
    return configs[framework] || {};
  }

  private categorizeTest(scenario: any): string {
    const categories = ['functional', 'integration', 'e2e', 'unit', 'performance', 'security', 'accessibility'];
    
    // Check tags first
    for (const tag of scenario.tags) {
      if (categories.includes(tag)) {
        return tag;
      }
    }
    
    // Default based on scenario complexity
    if (scenario.steps.length > 5) return 'e2e';
    if (scenario.steps.length > 2) return 'integration';
    return 'functional';
  }

  private extractAssertions(scenario: any): string[] {
    const assertions: string[] = [];
    
    for (const step of scenario.steps) {
      if (step.type === 'then' && step.assertion) {
        assertions.push(step.assertion);
      }
    }
    
    if (assertions.length === 0 && scenario.expectedResults) {
      assertions.push(...scenario.expectedResults);
    }
    
    return assertions;
  }

  private estimateTestDuration(scenario: any): number {
    let duration = 2; // Base time for browser startup
    
    for (const step of scenario.steps) {
      if (step.type === 'given' && step.action.includes('navigate')) {
        duration += 2; // Page load
      } else if (step.type === 'when') {
        duration += 1; // User action
      } else if (step.type === 'then') {
        duration += 0.5; // Assertion
      }
    }
    
    return duration;
  }

  private generateStaticData(scenario: any): any {
    const data: any = {};
    
    for (const step of scenario.steps) {
      if (step.data) {
        const fieldName = step.element || 'field';
        data[fieldName] = step.data;
      }
    }
    
    return data;
  }

  private getFrameworkDependencies(framework: string): string[] {
    const deps: Record<string, string[]> = {
      playclone: ['playclone'],
      playwright: ['@playwright/test'],
      puppeteer: ['puppeteer', 'jest'],
      selenium: ['selenium-webdriver', 'mocha'],
      cypress: ['cypress']
    };
    
    return deps[framework] || [];
  }

  private convertToPlayClone(code: string): string {
    // Convert from other frameworks to PlayClone
    return code
      .replace(/page\.goto/g, 'browser.navigate')
      .replace(/page\.click/g, 'browser.click')
      .replace(/page\.fill/g, 'browser.fill')
      .replace(/page\.locator/g, 'browser.locator');
  }

  private convertToPlaywright(code: string): string {
    // Convert from PlayClone to Playwright
    return code
      .replace(/browser\.navigate/g, 'page.goto')
      .replace(/browser\.click/g, 'page.click')
      .replace(/browser\.fill/g, 'page.fill')
      .replace(/browser\.locator/g, 'page.locator');
  }

  private convertToPuppeteer(code: string): string {
    // Convert to Puppeteer format
    return code
      .replace(/browser\.navigate/g, 'page.goto')
      .replace(/browser\.click/g, 'page.click')
      .replace(/browser\.fill/g, 'page.type');
  }

  private convertToSelenium(code: string): string {
    // Convert to Selenium WebDriver format
    return code
      .replace(/browser\.navigate/g, 'driver.get')
      .replace(/browser\.click\('(.+?)'\)/g, "driver.findElement(By.css('$1')).click()")
      .replace(/browser\.fill\('(.+?)', '(.+?)'\)/g, "driver.findElement(By.css('$1')).sendKeys('$2')");
  }

  private convertToCypress(code: string): string {
    // Convert to Cypress format
    return code
      .replace(/browser\.navigate/g, 'cy.visit')
      .replace(/browser\.click\('(.+?)'\)/g, "cy.get('$1').click()")
      .replace(/browser\.fill\('(.+?)', '(.+?)'\)/g, "cy.get('$1').type('$2')");
  }

  private injectTestData(code: string, dataSet: any): string {
    let injectedCode = code;
    
    for (const [key, value] of Object.entries(dataSet)) {
      const regex = new RegExp(`'${key}'|"${key}"`, 'g');
      injectedCode = injectedCode.replace(regex, JSON.stringify(value));
    }
    
    return injectedCode;
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/\w+/g, word => word[0].toUpperCase() + word.slice(1).toLowerCase())
      .replace(/\s+/g, '');
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal[0].toLowerCase() + pascal.slice(1);
  }
}