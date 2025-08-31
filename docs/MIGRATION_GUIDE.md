# Migration Guide: From Playwright to PlayClone

## Overview

This guide helps developers migrate from Playwright to PlayClone. While PlayClone uses Playwright's browser engines under the hood, it provides a completely different API designed for AI assistants and natural language interaction.

## Key Differences

### Philosophy

| Playwright | PlayClone |
|------------|-----------|
| Code-first automation | Natural language first |
| CSS/XPath selectors | Natural descriptions |
| Developer-oriented | AI assistant-oriented |
| Verbose responses | Token-optimized (<1KB) |
| Manual error handling | Automatic retry & recovery |

### API Style

**Playwright:**
```typescript
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com');
await page.click('#submit-button');
```

**PlayClone:**
```typescript
const browser = new PlayClone();
await browser.navigate('https://example.com');
await browser.click('submit button');
```

## Migration Reference

### Browser Initialization

#### Playwright
```typescript
import { chromium, firefox, webkit } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  slowMo: 50,
  args: ['--disable-web-security']
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  userAgent: 'My User Agent'
});
const page = await context.newPage();
```

#### PlayClone
```typescript
import { PlayClone } from 'playclone';

const browser = new PlayClone({
  headless: false,
  slowMo: 50,
  viewport: { width: 1280, height: 720 },
  userAgent: 'My User Agent',
  browserArgs: ['--disable-web-security']
});
// No need to explicitly create context or page
```

### Navigation

#### Playwright
```typescript
await page.goto('https://example.com', {
  waitUntil: 'networkidle',
  timeout: 30000
});

// Navigation events
await page.waitForNavigation();
await page.goBack();
await page.goForward();
await page.reload();
```

#### PlayClone
```typescript
await browser.navigate('https://example.com', {
  waitUntil: 'idle',
  timeout: 30000
});

// Simplified navigation
await browser.back();
await browser.forward();
await browser.reload();
```

### Element Selection

#### Playwright
```typescript
// CSS selector
await page.click('#login-button');

// XPath
await page.click('//button[text()="Login"]');

// Text selector
await page.click('text=Login');

// Complex selector
await page.click('.header >> button:has-text("Submit")');

// With options
await page.click('#button', {
  force: true,
  position: { x: 10, y: 10 },
  modifiers: ['Control']
});
```

#### PlayClone
```typescript
// Natural language
await browser.click('login button');
await browser.click('button that says Login');
await browser.click('submit button in header');

// Still supports CSS if needed
await browser.click('#login-button');

// With natural language modifiers
await browser.click('first blue button');
await browser.click('last item in list');
await browser.click('submit button at bottom of page');
```

### Form Interactions

#### Playwright
```typescript
// Text input
await page.fill('#email', 'user@example.com');
await page.type('#email', 'user@example.com', { delay: 100 });

// Checkbox
await page.check('#agree');
await page.uncheck('#subscribe');

// Radio button
await page.click('input[type="radio"][value="yes"]');

// Dropdown
await page.selectOption('#country', 'USA');
await page.selectOption('#country', { label: 'United States' });

// File upload
await page.setInputFiles('#file', '/path/to/file.pdf');

// Clear input
await page.fill('#input', '');
```

#### PlayClone
```typescript
// Natural language form filling
await browser.fill('email field', 'user@example.com');
await browser.type('email', 'user@example.com', { delay: 100 });

// Checkbox with natural language
await browser.check('agree to terms checkbox');
await browser.uncheck('newsletter subscription');

// Radio button
await browser.click('yes option');

// Dropdown with natural language
await browser.select('country dropdown', 'USA');
await browser.select('country', 'United States');

// File upload
await browser.uploadFile('file input', '/path/to/file.pdf');

// Clear with natural language
await browser.clear('email field');
```

### Waiting Strategies

#### Playwright
```typescript
// Wait for selector
await page.waitForSelector('#element', {
  state: 'visible',
  timeout: 5000
});

// Wait for function
await page.waitForFunction(() => document.readyState === 'complete');

// Wait for load state
await page.waitForLoadState('networkidle');

// Wait for navigation
await page.waitForNavigation();

// Wait for response
await page.waitForResponse(response => 
  response.url().includes('/api/data') && response.status() === 200
);

// Custom wait
await page.waitForTimeout(1000);
```

#### PlayClone
```typescript
// Automatic waiting is built-in
await browser.click('element'); // Waits automatically

// Explicit wait if needed
await browser.waitFor('element to appear');
await browser.waitUntil('page is loaded');
await browser.waitForText('Success message');

// Custom wait
await browser.wait(1000);

// PlayClone handles most waiting automatically
// with smart detection of:
// - Element visibility
// - Interactability
// - Animation completion
// - Network idle
// - DOM stability
```

### Data Extraction

#### Playwright
```typescript
// Get text
const text = await page.textContent('#element');
const innerText = await page.innerText('#element');

// Get attribute
const href = await page.getAttribute('a', 'href');

// Get multiple elements
const links = await page.$$eval('a', elements => 
  elements.map(el => el.href)
);

// Get page title
const title = await page.title();

// Get URL
const url = page.url();

// Evaluate JavaScript
const result = await page.evaluate(() => {
  return document.querySelector('#data').innerText;
});
```

#### PlayClone
```typescript
// Natural language text extraction
const text = await browser.getText('main heading');
const content = await browser.getText('article content');

// Get attribute with natural language
const link = await browser.getAttribute('download link', 'href');

// Get multiple elements
const links = await browser.getLinks('navigation menu');

// Get page info
const title = await browser.getTitle();
const url = await browser.getUrl();

// Extract structured data
const data = await browser.extractData({
  title: 'page title',
  price: 'product price',
  description: 'product description'
});
```

### Screenshots

#### Playwright
```typescript
// Full page screenshot
await page.screenshot({ 
  path: 'screenshot.png',
  fullPage: true 
});

// Element screenshot
const element = await page.$('#element');
await element.screenshot({ path: 'element.png' });

// Screenshot with options
await page.screenshot({
  path: 'screenshot.jpg',
  quality: 80,
  type: 'jpeg',
  clip: { x: 0, y: 0, width: 800, height: 600 }
});
```

#### PlayClone
```typescript
// Simple screenshot
await browser.screenshot('screenshot.png');

// Full page
await browser.screenshot('full-page.png', { fullPage: true });

// Element screenshot with natural language
await browser.screenshotElement('login form', 'form.png');

// With options
await browser.screenshot('screenshot.jpg', {
  quality: 80,
  type: 'jpeg',
  clip: { x: 0, y: 0, width: 800, height: 600 }
});
```

### Error Handling

#### Playwright
```typescript
try {
  await page.click('#button', { timeout: 5000 });
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('Element not found in time');
  } else {
    throw error;
  }
}

// Manual retry
let retries = 3;
while (retries > 0) {
  try {
    await page.click('#button');
    break;
  } catch (error) {
    retries--;
    if (retries === 0) throw error;
    await page.waitForTimeout(1000);
  }
}
```

#### PlayClone
```typescript
// Automatic retry and recovery
await browser.click('button'); // Retries automatically

// Error responses are AI-friendly
try {
  await browser.click('nonexistent button');
} catch (error) {
  console.log(error.suggestions);
  // ["Try: 'submit button'", "Try: 'continue button'"]
}

// Configure retry behavior
const browser = new PlayClone({
  retryStrategy: 'aggressive',
  maxRetries: 5
});
```

### Network Interception

#### Playwright
```typescript
// Intercept requests
await page.route('**/*.png', route => route.abort());

// Modify requests
await page.route('/api/*', route => {
  const headers = {
    ...route.request().headers(),
    'Authorization': 'Bearer token'
  };
  route.continue({ headers });
});

// Mock responses
await page.route('/api/data', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ data: 'mocked' })
  });
});
```

#### PlayClone
```typescript
// Block resources
const browser = new PlayClone({
  blockResources: ['image', 'font', 'media']
});

// Add headers
await browser.setHeaders({
  'Authorization': 'Bearer token'
});

// Mock responses
await browser.mockResponse('/api/data', {
  status: 200,
  body: { data: 'mocked' }
});
```

### Browser Context

#### Playwright
```typescript
// Create context with options
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  geolocation: { latitude: 40.7128, longitude: -74.0060 },
  permissions: ['geolocation'],
  locale: 'en-US',
  timezoneId: 'America/New_York'
});

// Storage state
await context.storageState({ path: 'state.json' });
const context2 = await browser.newContext({
  storageState: 'state.json'
});

// Cookies
await context.addCookies([{
  name: 'session',
  value: 'token123',
  domain: 'example.com',
  path: '/'
}]);
```

#### PlayClone
```typescript
// Configure on initialization
const browser = new PlayClone({
  viewport: { width: 1920, height: 1080 },
  geolocation: { latitude: 40.7128, longitude: -74.0060 },
  permissions: ['geolocation'],
  locale: 'en-US',
  timezone: 'America/New_York'
});

// State management
await browser.saveState('checkpoint1');
await browser.restoreState('checkpoint1');

// Cookies
await browser.setCookies([{
  name: 'session',
  value: 'token123',
  domain: 'example.com'
}]);
```

### Keyboard and Mouse

#### Playwright
```typescript
// Keyboard
await page.keyboard.press('Enter');
await page.keyboard.type('Hello World');
await page.keyboard.down('Shift');
await page.keyboard.up('Shift');

// Mouse
await page.mouse.move(100, 200);
await page.mouse.click(100, 200);
await page.mouse.down();
await page.mouse.up();
await page.mouse.wheel(0, 100);

// Drag and drop
await page.dragAndDrop('#source', '#target');
```

#### PlayClone
```typescript
// Keyboard with natural language
await browser.press('Enter');
await browser.type('Hello World');
await browser.keyDown('Shift');
await browser.keyUp('Shift');

// Mouse actions
await browser.moveMouse(100, 200);
await browser.clickAt(100, 200);
await browser.mouseDown();
await browser.mouseUp();
await browser.scroll(100);

// Drag and drop with natural language
await browser.dragDrop('draggable item', 'drop zone');
```

### Frames and Windows

#### Playwright
```typescript
// Frames
const frame = page.frame({ name: 'frameName' });
await frame.click('#button');

// New windows/tabs
const [newPage] = await Promise.all([
  context.waitForEvent('page'),
  page.click('a[target="_blank"]')
]);
await newPage.waitForLoadState();

// Switch between pages
const pages = context.pages();
await pages[1].bringToFront();
```

#### PlayClone
```typescript
// Frames with natural language
await browser.switchToFrame('payment frame');
await browser.click('submit button in frame');

// New windows/tabs
const newTab = await browser.openNewTab();
await newTab.navigate('https://example.com');

// Switch tabs
await browser.switchToTab('tab with title "Example"');
await browser.switchToTab(0); // By index
```

### Advanced Features

#### Playwright
```typescript
// Video recording
const context = await browser.newContext({
  recordVideo: {
    dir: './videos',
    size: { width: 1280, height: 720 }
  }
});

// Tracing
await context.tracing.start({ screenshots: true, snapshots: true });
await context.tracing.stop({ path: 'trace.zip' });

// Coverage
await page.coverage.startJSCoverage();
const coverage = await page.coverage.stopJSCoverage();

// Accessibility
const snapshot = await page.accessibility.snapshot();
```

#### PlayClone
```typescript
// Video recording
const browser = new PlayClone({
  recordVideo: {
    dir: './videos',
    size: { width: 1280, height: 720 }
  }
});

// Debugging
const browser = new PlayClone({
  debug: true,
  trace: true
});

// Accessibility with natural language
const tree = await browser.getAccessibilityTree();
const landmark = await browser.findByRole('main content');
```

## Migration Patterns

### Pattern 1: Gradual Migration

Keep both libraries during transition:

```typescript
// hybrid-automation.ts
import { chromium } from 'playwright';
import { PlayClone } from 'playclone';

class HybridAutomation {
  private playwright: any;
  private playclone: PlayClone;
  
  async initialize() {
    // Use Playwright for complex selectors
    this.playwright = await chromium.launch();
    
    // Use PlayClone for natural language
    this.playclone = new PlayClone();
  }
  
  async automateWithBest(task: string) {
    if (task.includes('natural language')) {
      return await this.playclone.execute(task);
    } else {
      return await this.playwrightExecute(task);
    }
  }
}
```

### Pattern 2: Wrapper Approach

Create a compatibility wrapper:

```typescript
// playwright-compat.ts
import { PlayClone } from 'playclone';

export class PlaywrightCompat {
  private pc: PlayClone;
  
  constructor() {
    this.pc = new PlayClone();
  }
  
  // Playwright-like API
  async goto(url: string) {
    return await this.pc.navigate(url);
  }
  
  async click(selector: string) {
    // Try CSS selector first, fall back to natural language
    try {
      return await this.pc.click(selector);
    } catch {
      // Convert CSS to natural language
      const element = this.selectorToNaturalLanguage(selector);
      return await this.pc.click(element);
    }
  }
  
  private selectorToNaturalLanguage(selector: string): string {
    // Convert common patterns
    if (selector.startsWith('#')) {
      return `element with id ${selector.slice(1)}`;
    }
    if (selector.startsWith('.')) {
      return `element with class ${selector.slice(1)}`;
    }
    return selector;
  }
}
```

### Pattern 3: Test Migration

Migrate test suites incrementally:

```typescript
// Old Playwright test
test('login flow', async ({ page }) => {
  await page.goto('https://example.com');
  await page.click('#login-btn');
  await page.fill('#email', 'user@example.com');
  await page.fill('#password', 'password');
  await page.click('#submit');
  await expect(page).toHaveURL('/dashboard');
});

// New PlayClone test
test('login flow', async () => {
  const browser = new PlayClone();
  await browser.navigate('https://example.com');
  await browser.click('login button');
  await browser.fill('email field', 'user@example.com');
  await browser.fill('password field', 'password');
  await browser.click('submit button');
  const url = await browser.getUrl();
  expect(url).toContain('/dashboard');
});
```

## Common Migration Issues

### Issue 1: Complex Selectors

**Playwright:**
```typescript
await page.click('.container > div:nth-child(2) button.primary');
```

**PlayClone Solution:**
```typescript
// Use natural language
await browser.click('second primary button in container');

// Or provide more context
await browser.click('primary button in the second section');
```

### Issue 2: Custom Wait Conditions

**Playwright:**
```typescript
await page.waitForFunction(
  () => document.querySelectorAll('.item').length > 5
);
```

**PlayClone Solution:**
```typescript
// PlayClone handles most waits automatically
// For custom conditions, use:
await browser.waitUntil('more than 5 items appear');

// Or check periodically
await browser.waitFor(() => 
  browser.count('items') > 5
);
```

### Issue 3: JavaScript Evaluation

**Playwright:**
```typescript
const result = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.price'))
    .map(el => parseFloat(el.textContent.replace('$', '')));
});
```

**PlayClone Solution:**
```typescript
// Use data extraction
const prices = await browser.extractData({
  prices: { selector: 'all price elements', transform: 'number' }
});

// Or get text and process
const priceTexts = await browser.getAllText('price elements');
const prices = priceTexts.map(p => parseFloat(p.replace('$', '')));
```

### Issue 4: Multi-Page Coordination

**Playwright:**
```typescript
const context = await browser.newContext();
const page1 = await context.newPage();
const page2 = await context.newPage();

await page1.goto('https://site1.com');
await page2.goto('https://site2.com');
```

**PlayClone Solution:**
```typescript
// Use tabs
const browser = new PlayClone();
await browser.navigate('https://site1.com');

const tab2 = await browser.newTab();
await tab2.navigate('https://site2.com');

// Switch between tabs
await browser.switchToTab(0);
```

## Performance Comparison

| Operation | Playwright | PlayClone |
|-----------|------------|-----------|
| Startup time | ~2s | ~1.5s (optimized) |
| Element selection | 10-50ms (CSS) | 50-200ms (NLP) |
| Memory usage | ~150MB/page | ~120MB/page |
| Response size | Full objects | <1KB JSON |
| Error recovery | Manual | Automatic |
| Token usage (AI) | High | Optimized |

## Best Practices for Migration

1. **Start with new features**: Implement new features in PlayClone while maintaining existing Playwright code

2. **Migrate simple tests first**: Begin with straightforward test cases before complex scenarios

3. **Use both during transition**: Run both frameworks in parallel to ensure coverage

4. **Leverage natural language**: Take advantage of PlayClone's NLP capabilities instead of complex selectors

5. **Simplify error handling**: Remove manual retry logic and let PlayClone handle it

6. **Optimize for AI**: If using with AI assistants, prioritize natural language over CSS selectors

## Tools and Utilities

### Selector Converter

```typescript
// selector-converter.ts
export function convertSelector(playwrightSelector: string): string {
  const conversions = {
    'text=': 'text that says ',
    '>>': ' within ',
    ':has-text': ' containing text ',
    ':visible': ' that is visible',
    ':nth-child': ' number ',
  };
  
  let result = playwrightSelector;
  for (const [from, to] of Object.entries(conversions)) {
    result = result.replace(from, to);
  }
  
  return result;
}
```

### Migration Script

```bash
#!/bin/bash
# migrate-to-playclone.sh

# Install PlayClone
npm install playclone

# Update imports
find . -name "*.ts" -exec sed -i 's/from "playwright"/from "playclone"/g' {} \;

# Run migration assistant
npx playclone-migrate analyze ./tests
npx playclone-migrate convert ./tests --output ./tests-new
```

## Conclusion

While Playwright and PlayClone serve similar purposes, they have different philosophies:

- **Playwright**: Powerful, flexible, developer-focused
- **PlayClone**: Natural language, AI-optimized, automatic

Choose PlayClone when:
- Working with AI assistants
- Preferring natural language over CSS selectors
- Wanting automatic error recovery
- Needing token-optimized responses
- Building conversational automation

Stay with Playwright when:
- Needing fine-grained control
- Working with complex selectors
- Requiring specific browser features
- Building traditional test suites
- Needing maximum performance

Both can coexist in the same project, allowing gradual migration and using each tool's strengths where appropriate.