# Playwright Automation Guide

This comprehensive guide provides instructions for using Playwright, a modern web automation and testing framework developed by Microsoft.

## Table of Contents
1. [What is Playwright](#what-is-playwright)
2. [Installation](#installation)
3. [Project Structure](#project-structure)
4. [Configuration](#configuration)
5. [Writing Tests](#writing-tests)
6. [Locators and Selectors](#locators-and-selectors)
7. [Page Object Model](#page-object-model)
8. [Running Tests](#running-tests)
9. [Best Practices](#best-practices)
10. [Advanced Features](#advanced-features)

## What is Playwright

Playwright is an open-source framework for cross-browser automation and end-to-end web application testing. It supports:
- **Multiple Browsers**: Chromium, Firefox, and WebKit
- **Multiple Languages**: JavaScript/TypeScript, Python, C#, and Java
- **Auto-Waiting**: Automatically waits for elements to be ready
- **Mobile Testing**: Can emulate mobile devices
- **Network Interception**: Mock API calls and responses

### Key Advantages
- Communicates via WebSocket protocol for faster, more reliable testing
- Full test isolation with browser contexts
- Built-in debugging tools and test generators
- No artificial timeouts needed due to smart auto-waiting

## Installation

### Prerequisites
- Node.js (LTS version recommended)
- Verify installation: `node -v` and `npm -v`

### Quick Setup
```bash
# Initialize new Playwright project
npm init playwright@latest

# Or add to existing project
npm init playwright@latest --force
```

During setup, you'll be prompted for:
- TypeScript or JavaScript (default: TypeScript)
- Tests folder name (default: tests)
- GitHub Actions workflow (recommended)
- Browser installation (default: yes)

### Manual Installation
```bash
# Install Playwright test runner
npm i -D @playwright/test

# Install browsers
npx playwright install

# Or install specific browsers
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit
```

## Project Structure

```
project-root/
├── playwright.config.ts      # Main configuration file
├── package.json
├── tests/                    # Test files
│   └── example.spec.ts
├── tests-examples/           # Example tests
│   └── demo-todo-app.spec.ts
└── playwright-report/        # Test reports (generated)
```

## Configuration

### Basic Configuration (playwright.config.ts)
```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './tests',
  
  // Maximum time one test can run
  timeout: 30 * 1000,
  
  // Global test settings
  use: {
    // Base URL for all tests
    baseURL: 'http://localhost:3000',
    
    // Collect trace on first retry
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video recording
    video: 'retain-on-failure',
    
    // Headless mode
    headless: true,
  },
  
  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  
  // Reporter configuration
  reporter: [
    ['html'],
    ['line'],
    ['json', { outputFile: 'test-results.json' }]
  ],
});
```

## Writing Tests

### Basic Test Structure
```javascript
import { test, expect } from '@playwright/test';

test.describe('Feature: User Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should login successfully', async ({ page }) => {
    // Arrange
    await page.goto('/login');
    
    // Act
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    
    // Assert
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome');
  });
});
```

### Common Actions
```javascript
// Navigation
await page.goto('https://example.com');
await page.goBack();
await page.goForward();
await page.reload();

// Input interactions
await page.fill('#input', 'text');
await page.type('#input', 'text'); // Types character by character
await page.selectOption('select', 'option-value');
await page.check('#checkbox');
await page.uncheck('#checkbox');

// Clicks
await page.click('button');
await page.dblclick('button');
await page.click('button', { button: 'right' }); // Right click

// Keyboard
await page.keyboard.press('Enter');
await page.keyboard.type('Hello World');

// Screenshots
await page.screenshot({ path: 'screenshot.png' });
await page.screenshot({ fullPage: true });
```

## Locators and Selectors

### Best Practices for Locators
```javascript
// ✅ GOOD: User-facing locators
await page.getByRole('button', { name: 'Submit' }).click();
await page.getByLabel('Email').fill('user@example.com');
await page.getByPlaceholder('Enter password').fill('secret');
await page.getByText('Welcome back').click();
await page.getByTestId('login-button').click();

// ❌ AVOID: CSS/XPath selectors (fragile)
await page.click('#submit-btn');
await page.click('//button[@class="btn-primary"]');
```

### Locator Methods
```javascript
const locator = page.locator('button');

// Wait for element
await locator.waitFor();
await locator.waitFor({ state: 'visible' });
await locator.waitFor({ state: 'hidden' });

// Assertions
await expect(locator).toBeVisible();
await expect(locator).toBeEnabled();
await expect(locator).toHaveText('Click me');
await expect(locator).toHaveCount(3);

// Filtering
const rows = page.locator('tr');
await rows.filter({ hasText: 'Product' }).click();

// Chaining
await page
  .locator('div')
  .filter({ hasText: 'Product' })
  .locator('button')
  .click();
```

## Page Object Model

### Page Object Example
```javascript
// pages/LoginPage.js
export class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Login' });
    this.errorMessage = page.locator('.error-message');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }
}

// tests/login.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test('successful login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password123');
  
  await expect(page).toHaveURL('/dashboard');
});
```

### Component-Based Page Objects
```javascript
// components/Header.js
export class Header {
  constructor(page) {
    this.page = page;
    this.userMenu = page.locator('#user-menu');
    this.logoutButton = page.getByRole('button', { name: 'Logout' });
  }

  async logout() {
    await this.userMenu.click();
    await this.logoutButton.click();
  }
}

// pages/DashboardPage.js
import { Header } from '../components/Header';

export class DashboardPage {
  constructor(page) {
    this.page = page;
    this.header = new Header(page);
    this.welcomeMessage = page.locator('h1');
  }

  async getWelcomeText() {
    return await this.welcomeMessage.textContent();
  }
}
```

## Running Tests

### Command Line Options
```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/login.spec.ts

# Run tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests with specific number of workers
npx playwright test --workers=4

# Debug mode
npx playwright test --debug

# Generate HTML report
npx playwright show-report

# Update snapshots
npx playwright test --update-snapshots
```

### Debugging
```bash
# Open Playwright Inspector
npx playwright test --debug

# Use VS Code debugger
# Add breakpoint in code: debugger;

# Generate test code
npx playwright codegen https://example.com

# Trace viewer for failed tests
npx playwright show-trace trace.zip
```

## Best Practices

### 1. Use Proper Waiting
```javascript
// ✅ GOOD: Let Playwright handle waiting
await page.click('button'); // Auto-waits for element

// ❌ AVOID: Manual waits
await page.waitForTimeout(5000); // Bad practice
```

### 2. Test Isolation
```javascript
test.describe('User tests', () => {
  // Each test gets fresh browser context
  test('test 1', async ({ page }) => {
    // Isolated test
  });
  
  test('test 2', async ({ page }) => {
    // Another isolated test
  });
});
```

### 3. Use Fixtures for Setup
```javascript
import { test as base } from '@playwright/test';

// Extend base test with custom fixtures
export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // Setup: Login
    await page.goto('/login');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    
    // Use the fixture
    await use(page);
    
    // Teardown: Logout
    await page.click('#logout');
  },
});

test('authenticated test', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/profile');
  // Already logged in
});
```

### 4. Parallel Execution
```javascript
// playwright.config.ts
export default defineConfig({
  // Run tests in parallel
  fullyParallel: true,
  
  // Limit workers
  workers: process.env.CI ? 2 : undefined,
});
```

### 5. Error Handling
```javascript
test('handle errors gracefully', async ({ page }) => {
  try {
    await page.goto('https://example.com');
    await page.click('button');
  } catch (error) {
    // Take screenshot on error
    await page.screenshot({ path: 'error.png' });
    throw error;
  }
});
```

## Advanced Features

### Network Interception
```javascript
test('mock API response', async ({ page }) => {
  // Mock API endpoint
  await page.route('**/api/users', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ]),
    });
  });
  
  await page.goto('/users');
  await expect(page.locator('li')).toHaveCount(2);
});
```

### Browser Context with Storage
```javascript
test('reuse authentication', async ({ browser }) => {
  // Create context with saved storage
  const context = await browser.newContext({
    storageState: 'auth.json'
  });
  
  const page = await context.newPage();
  await page.goto('/dashboard');
  // Already authenticated
});
```

### Visual Testing
```javascript
test('visual regression', async ({ page }) => {
  await page.goto('/');
  
  // Compare screenshot with baseline
  await expect(page).toHaveScreenshot('homepage.png');
  
  // Element screenshot
  await expect(page.locator('header')).toHaveScreenshot('header.png');
});
```

### Mobile Emulation
```javascript
test('mobile view', async ({ browser }) => {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    locale: 'en-US',
    geolocation: { latitude: 37.7749, longitude: -122.4194 },
    permissions: ['geolocation'],
  });
  
  const page = await context.newPage();
  await page.goto('/');
});
```

### Accessibility Testing
```javascript
test('accessibility', async ({ page }) => {
  await page.goto('/');
  
  // Check for accessibility violations
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  
  expect(accessibilityScanResults.violations).toEqual([]);
});
```

## CI/CD Integration

### GitHub Actions
```yaml
name: Playwright Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
      - name: Run Playwright tests
        run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Troubleshooting

### Common Issues and Solutions

1. **Tests are flaky**
   - Use proper locators (role-based, not CSS)
   - Avoid `waitForTimeout`
   - Check for race conditions

2. **Element not found**
   - Element might be in iframe: `page.frameLocator('iframe')`
   - Element might be in shadow DOM (Playwright handles automatically)
   - Check if element is created dynamically

3. **Timeout errors**
   - Increase timeout: `test.setTimeout(60000)`
   - Check network conditions
   - Verify element selectors

4. **Browser installation issues**
   ```bash
   # Clean install
   npx playwright install --force
   
   # With system dependencies
   npx playwright install --with-deps
   ```

## Resources

- [Official Documentation](https://playwright.dev)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [GitHub Repository](https://github.com/microsoft/playwright)
- [Community Discord](https://aka.ms/playwright-discord)

## Advanced Use Cases

### Web Scraping at Scale

#### Dynamic Content Extraction
```javascript
// Handle infinite scroll
async function scrapeInfiniteScroll(page) {
  const items = [];
  let previousHeight = 0;
  
  while (true) {
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    
    // Check if new content loaded
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    if (currentHeight === previousHeight) break;
    previousHeight = currentHeight;
    
    // Extract visible items
    const newItems = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.item')).map(item => ({
        title: item.querySelector('.title')?.textContent,
        price: item.querySelector('.price')?.textContent,
      }));
    });
    items.push(...newItems);
  }
  return items;
}
```

#### Anti-Bot Evasion Techniques
```javascript
// Stealth configuration
const context = await browser.newContext({
  // Randomize viewport
  viewport: {
    width: 1920 + Math.floor(Math.random() * 100),
    height: 1080 + Math.floor(Math.random() * 100)
  },
  // Set realistic user agent
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  // Add extra HTTP headers
  extraHTTPHeaders: {
    'Accept-Language': 'en-US,en;q=0.9',
  },
  // Simulate timezone
  timezoneId: 'America/New_York',
  // Set geolocation
  geolocation: { latitude: 40.7128, longitude: -74.0060 },
  permissions: ['geolocation'],
});

// Add random delays between actions
async function humanLikeDelay() {
  await page.waitForTimeout(Math.random() * 2000 + 1000);
}

// Simulate human-like mouse movements
await page.mouse.move(100, 100);
await page.mouse.move(200, 200, { steps: 10 });
```

### Browser Fingerprinting Management

```javascript
// Override browser fingerprints
await page.addInitScript(() => {
  // Override navigator properties
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined
  });
  
  // Spoof plugins
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5]
  });
  
  // Override chrome detection
  window.chrome = {
    runtime: {}
  };
  
  // Spoof WebGL
  const getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(parameter) {
    if (parameter === 37445) {
      return 'Intel Inc.';
    }
    if (parameter === 37446) {
      return 'Intel Iris OpenGL Engine';
    }
    return getParameter.apply(this, arguments);
  };
});
```

### Cookie and Session Management

```javascript
// Save authentication state
const context = await browser.newContext();
const page = await context.newPage();

// Login
await page.goto('https://example.com/login');
await page.fill('#email', 'user@example.com');
await page.fill('#password', 'password');
await page.click('button[type="submit"]');

// Save cookies and localStorage
await context.storageState({ path: 'auth.json' });

// Reuse in new session
const authenticatedContext = await browser.newContext({
  storageState: 'auth.json'
});

// Cookie manipulation
const cookies = await context.cookies();
await context.addCookies([{
  name: 'session',
  value: 'token123',
  domain: '.example.com',
  path: '/',
  expires: Date.now() / 1000 + 3600,
  httpOnly: true,
  secure: true,
  sameSite: 'Lax'
}]);
```

### Multi-Tab and Multi-Window Automation

```javascript
// Handle multiple tabs
test('multi-tab workflow', async ({ browser }) => {
  const context = await browser.newContext();
  
  // Open multiple pages
  const page1 = await context.newPage();
  const page2 = await context.newPage();
  const page3 = await context.newPage();
  
  // Work with pages in parallel
  await Promise.all([
    page1.goto('https://example.com/page1'),
    page2.goto('https://example.com/page2'),
    page3.goto('https://example.com/page3'),
  ]);
  
  // Handle popup windows
  const [popup] = await Promise.all([
    page1.waitForEvent('popup'),
    page1.click('a[target="_blank"]'),
  ]);
  
  await popup.waitForLoadState();
  console.log('Popup URL:', popup.url());
});

// Browser context isolation for parallel sessions
async function parallelSessions() {
  const contexts = await Promise.all([
    browser.newContext({ storageState: 'user1.json' }),
    browser.newContext({ storageState: 'user2.json' }),
    browser.newContext({ storageState: 'user3.json' }),
  ]);
  
  const pages = await Promise.all(
    contexts.map(ctx => ctx.newPage())
  );
  
  // Run parallel operations
  await Promise.all(
    pages.map((page, i) => 
      page.goto(`https://example.com/user${i + 1}/dashboard`)
    )
  );
}
```

### File Upload and Download Handling

```javascript
// File upload
test('file upload', async ({ page }) => {
  await page.goto('https://example.com/upload');
  
  // Single file
  await page.setInputFiles('input[type="file"]', 'path/to/file.pdf');
  
  // Multiple files
  await page.setInputFiles('input[type="file"]', [
    'file1.pdf',
    'file2.pdf',
    'file3.pdf'
  ]);
  
  // Remove files
  await page.setInputFiles('input[type="file"]', []);
  
  // Upload buffer
  await page.setInputFiles('input[type="file"]', {
    name: 'file.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('file content')
  });
});

// File download
test('file download', async ({ page }) => {
  // Wait for download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button#download')
  ]);
  
  // Save to specific path
  await download.saveAs('./downloads/' + download.suggestedFilename());
  
  // Get download stream
  const stream = await download.createReadStream();
  
  // Get download info
  console.log('Downloaded:', download.suggestedFilename());
  console.log('URL:', download.url());
});
```

### PDF Generation and Document Manipulation

```javascript
// Generate PDF (Chromium only, headless mode)
test('generate PDF', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'PDF only in Chromium');
  
  await page.goto('https://example.com/invoice');
  
  await page.pdf({
    path: 'invoice.pdf',
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px'
    },
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size: 10px;">Header</div>',
    footerTemplate: '<div style="font-size: 10px;">Page <span class="pageNumber"></span></div>',
  });
});

// Advanced screenshot options
await page.screenshot({
  path: 'screenshot.png',
  fullPage: true,
  clip: { x: 0, y: 0, width: 800, height: 600 },
  omitBackground: true,
  animations: 'disabled',
  caret: 'hide',
});
```

### Performance Monitoring and Metrics

```javascript
// Collect performance metrics
test('performance monitoring', async ({ page }) => {
  // Enable performance monitoring
  await page.coverage.startJSCoverage();
  await page.coverage.startCSSCoverage();
  
  await page.goto('https://example.com');
  
  // Get coverage reports
  const jsCoverage = await page.coverage.stopJSCoverage();
  const cssCoverage = await page.coverage.stopCSSCoverage();
  
  // Calculate usage
  let totalBytes = 0;
  let usedBytes = 0;
  
  for (const entry of jsCoverage) {
    totalBytes += entry.text.length;
    for (const range of entry.ranges) {
      usedBytes += range.end - range.start;
    }
  }
  
  console.log(`JS Coverage: ${(usedBytes / totalBytes * 100).toFixed(2)}%`);
  
  // Performance metrics
  const metrics = await page.evaluate(() => ({
    performance: JSON.stringify(performance.getEntriesByType('navigation')),
    memory: performance.memory,
    timing: performance.timing
  }));
});
```

### Database and API Integration

```javascript
// Combine UI and API testing
test('full stack testing', async ({ page, request }) => {
  // API setup
  const response = await request.post('/api/setup', {
    data: {
      testData: 'initial'
    }
  });
  
  const { id } = await response.json();
  
  // UI testing with API data
  await page.goto(`/items/${id}`);
  await expect(page.locator('h1')).toContainText('initial');
  
  // Clean up via API
  await request.delete(`/api/items/${id}`);
});

// Database seeding
import { Client } from 'pg';

test.beforeEach(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  await client.query('INSERT INTO users (name) VALUES ($1)', ['Test User']);
  await client.end();
});
```

### Distributed and Parallel Execution

```javascript
// playwright.config.ts for distributed testing
export default defineConfig({
  // Shard tests across multiple machines
  shard: {
    total: parseInt(process.env.SHARD_TOTAL) || 1,
    current: parseInt(process.env.SHARD_INDEX) || 1,
  },
  
  // Configure for CI parallelization
  workers: process.env.CI ? 4 : undefined,
  
  // Retry failed tests
  retries: process.env.CI ? 2 : 0,
  
  // Test timeout
  timeout: 30000,
  
  // Global setup/teardown
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
});

// Run on multiple machines
// Machine 1: SHARD_INDEX=1 SHARD_TOTAL=3 npx playwright test
// Machine 2: SHARD_INDEX=2 SHARD_TOTAL=3 npx playwright test
// Machine 3: SHARD_INDEX=3 SHARD_TOTAL=3 npx playwright test
```

### Real-time Monitoring and Reporting

```javascript
// Custom reporter for real-time monitoring
class RealTimeReporter {
  onTestBegin(test) {
    console.log(`Starting: ${test.title}`);
    // Send to monitoring service
    fetch('https://monitoring.example.com/test-start', {
      method: 'POST',
      body: JSON.stringify({
        test: test.title,
        timestamp: Date.now()
      })
    });
  }
  
  onTestEnd(test, result) {
    console.log(`Finished: ${test.title} - ${result.status}`);
    // Send results to dashboard
    fetch('https://monitoring.example.com/test-end', {
      method: 'POST',
      body: JSON.stringify({
        test: test.title,
        status: result.status,
        duration: result.duration,
        error: result.error?.message
      })
    });
  }
}

// Use in config
export default defineConfig({
  reporter: [
    ['./real-time-reporter.js'],
    ['html'],
    ['json', { outputFile: 'results.json' }]
  ]
});
```

## Playwright MCP (Model Context Protocol) Integration

**Note**: This section covers MCP integration, a feature developed after late 2024 that enables AI assistants to control browsers directly.

### What is Playwright MCP?

The Model Context Protocol (MCP) server acts as a bridge between Large Language Models (LLMs) and Playwright-managed browsers, enabling AI-powered browser automation through structured commands rather than code writing.

### Two Main Implementations

#### 1. Microsoft's Official Playwright MCP (`@playwright/mcp`)
- **Lightweight**: Uses accessibility tree instead of screenshots
- **Fast**: No visual model processing required
- **Structured**: Works with semantic DOM data
- **Resource-efficient**: Lower memory and CPU usage

#### 2. ExecuteAutomation's MCP Server (`@executeautomation/playwright-mcp-server`)
- **Feature-rich**: Includes API testing capabilities
- **IDE-optimized**: Better resource management for Cursor/Cline
- **Browser cleanup**: Releases resources when done

### Installation and Configuration

#### For Claude Code/Claude Desktop
Add to your configuration file:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

#### For Cursor IDE
```bash
# Via command line
code --add-mcp '{"name":"playwright","command":"npx","args":["@playwright/mcp@latest"]}'

# Or add in Cursor Settings > MCP > Add new MCP Server
```

#### For VS Code
```bash
# Install via VS Code CLI
code --add-mcp '{"name":"playwright","command":"npx","args":["@executeautomation/playwright-mcp-server"]}'
```

### Configuration Options

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--browser", "chrome",        // chrome, firefox, webkit, msedge
        "--device", "iPhone 15",      // Device emulation
        "--caps", "vision,pdf",       // Additional capabilities
        "--blocked-origins", "ads.com;tracking.com"  // Block domains
      ]
    }
  }
}
```

### Available MCP Tools/Commands

#### Core Browser Operations
- **Navigation**: Navigate to URLs, go back/forward, reload
- **Interaction**: Click elements, fill forms, type text
- **Content**: Get page text, HTML, take screenshots
- **Scripts**: Execute JavaScript in page context
- **Monitoring**: Watch console logs, track HTTP responses

#### Operating Modes

**1. Snapshot Mode (Default)**
- Uses accessibility tree
- Faster and more reliable
- No screenshot processing
- Structured data extraction

**2. Vision Mode**
- Screenshot-based interaction
- Coordinate-based clicking
- Visual element detection
- Useful for complex UIs

#### Code Generation Tools
```javascript
// Start recording session
{
  "tool": "code_generation_start",
  "parameters": {
    "outputPath": "./tests",
    "testNamePrefix": "test_",
    "includeComments": true
  }
}

// Stop and generate test
{
  "tool": "code_generation_end"
}
```

### MCP Usage Examples

#### Natural Language Testing
```text
User: "Go to example.com, click the login button, enter 'testuser' as username and 'password123' as password, then click submit"

// MCP translates this to browser actions automatically
```

#### Web Scraping with AI
```text
User: "Extract all product names and prices from this e-commerce page"

// MCP navigates, identifies elements, and extracts structured data
```

#### Form Automation
```text
User: "Fill out the contact form with test data and submit it"

// MCP identifies form fields, generates appropriate test data, and submits
```

### Architecture Benefits

#### Why MCP Over Traditional Automation?

1. **No Code Writing**: Natural language commands instead of scripts
2. **Adaptive**: Automatically adjusts to UI changes
3. **Shared Resources**: Multiple clients use one browser instance
4. **Semantic Understanding**: Works with accessibility tree, not pixels
5. **Built-in Intelligence**: AI interprets intent and handles edge cases

#### Integration with AI Workflows

```javascript
// Traditional Playwright
await page.goto('https://example.com');
await page.click('#login');
await page.fill('#username', 'user');
await page.fill('#password', 'pass');
await page.click('#submit');

// With MCP + AI
"Login to example.com with username 'user'"
// AI handles element detection, error recovery, and validation
```

### Best Practices for MCP

1. **Use Snapshot Mode** for structured data extraction
2. **Enable Vision Mode** only when visual verification is needed
3. **Configure blocked origins** to improve performance
4. **Set appropriate browser** based on testing requirements
5. **Clean up resources** after automation sessions

### Limitations and Considerations

- **Newer Technology**: MCP is evolving rapidly (2024-2025)
- **IDE Support**: Not all IDEs fully support MCP yet
- **Learning Curve**: Different paradigm from traditional automation
- **Debugging**: Less direct control than code-based automation

### Checking MCP Availability

In Claude Code or supported IDEs:
```bash
# View all available MCP tools
/mcp

# Then navigate to playwright section to see commands
```

### Why This Information Wasn't in the Original Guide

The Model Context Protocol (MCP) is a recent development that emerged after late 2024, representing a paradigm shift in how AI assistants interact with external tools. Traditional Playwright documentation focuses on code-based automation, while MCP enables natural language control of browsers through AI intermediaries. This integration is still evolving and wasn't part of the established Playwright ecosystem when most documentation was written.

## Summary

Playwright provides a robust, modern approach to web automation with excellent cross-browser support, built-in waiting mechanisms, and powerful debugging tools. The addition of MCP integration opens new possibilities for AI-driven automation, allowing natural language control of browsers without writing code. The advanced use cases demonstrate its versatility beyond simple testing - from web scraping at scale to complex multi-tab workflows, performance monitoring, and distributed execution. Follow the best practices outlined in this guide to create maintainable, reliable automated tests and automation scripts.