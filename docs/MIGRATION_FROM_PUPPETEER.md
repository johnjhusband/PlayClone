# Migration Guide: From Puppeteer to PlayClone

## Overview

This comprehensive guide helps developers migrate from Puppeteer to PlayClone. While both tools automate browsers, PlayClone is specifically designed for AI assistants with natural language support, token optimization, and simplified API.

## Quick Comparison

| Feature | Puppeteer | PlayClone |
|---------|-----------|-----------|
| **Browser Support** | Chromium only | Chromium, Firefox, WebKit |
| **API Design** | Code-centric | Natural language-centric |
| **Element Selection** | CSS/XPath selectors | Natural descriptions + CSS |
| **Response Format** | Full objects | AI-optimized JSON (<1KB) |
| **Session Management** | Manual | Built-in with persistence |
| **Error Handling** | Try-catch blocks | Automatic retry & recovery |
| **Target Audience** | Developers | AI assistants & developers |
| **MCP Support** | No | Yes, native integration |

## Installation

### Puppeteer
```bash
npm install puppeteer
# or
npm install puppeteer-core
```

### PlayClone
```bash
npm install playclone
# Browser binaries included via playwright-core
```

## Core API Migration

### 1. Browser Launch

#### Puppeteer
```javascript
const puppeteer = require('puppeteer');

const browser = await puppeteer.launch({
  headless: false,
  slowMo: 50,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: { width: 1280, height: 720 }
});
const page = await browser.newPage();
```

#### PlayClone
```javascript
const { PlayClone } = require('playclone');

const browser = new PlayClone({
  headless: false,
  slowMo: 50,
  viewport: { width: 1280, height: 720 }
});
// Page is created automatically
```

### 2. Navigation

#### Puppeteer
```javascript
await page.goto('https://example.com', {
  waitUntil: 'networkidle2',
  timeout: 30000
});

// Wait for specific element
await page.waitForSelector('.content-loaded');
```

#### PlayClone
```javascript
await browser.navigate('https://example.com');
// Auto-waits for content

// Or with explicit wait
await browser.waitFor('content loaded indicator');
```

### 3. Element Selection & Clicking

#### Puppeteer
```javascript
// CSS selector
await page.click('#login-button');

// XPath
await page.click('//button[contains(text(), "Login")]');

// With wait
await page.waitForSelector('.submit-btn', { visible: true });
await page.click('.submit-btn');
```

#### PlayClone
```javascript
// Natural language
await browser.click('login button');

// Or with context
await browser.click('blue submit button in header');

// CSS still works
await browser.click('#login-button');
```

### 4. Form Filling

#### Puppeteer
```javascript
await page.type('#username', 'john.doe');
await page.type('#password', 'secret123');
await page.select('#country', 'US');
await page.click('input[type="checkbox"]');
await page.click('button[type="submit"]');
```

#### PlayClone
```javascript
// Individual fields with natural language
await browser.fill('username field', 'john.doe');
await browser.fill('password field', 'secret123');
await browser.select('country dropdown', 'United States');
await browser.check('terms checkbox');
await browser.click('submit button');

// Or batch fill
await browser.fillForm('login form', {
  username: 'john.doe',
  password: 'secret123'
});
```

### 5. Text Extraction

#### Puppeteer
```javascript
// Single element
const text = await page.$eval('.headline', el => el.textContent);

// Multiple elements
const texts = await page.$$eval('.item', elements => 
  elements.map(el => el.textContent)
);

// Full page text
const pageText = await page.evaluate(() => document.body.innerText);
```

#### PlayClone
```javascript
// Natural language
const headline = await browser.getText('main headline');

// Multiple elements
const items = await browser.getText('all item descriptions');

// Full page
const pageText = await browser.getText();
// Returns AI-optimized response
```

### 6. Screenshots

#### Puppeteer
```javascript
await page.screenshot({ 
  path: 'screenshot.png',
  fullPage: true
});

// Element screenshot
const element = await page.$('.chart');
await element.screenshot({ path: 'chart.png' });
```

#### PlayClone
```javascript
await browser.screenshot('screenshot.png');

// With options
await browser.screenshot('full-page.png', { fullPage: true });

// Element screenshot with natural language
await browser.screenshotElement('chart section', 'chart.png');
```

### 7. Waiting Strategies

#### Puppeteer
```javascript
// Wait for selector
await page.waitForSelector('.dynamic-content', {
  visible: true,
  timeout: 5000
});

// Wait for navigation
await page.waitForNavigation();

// Wait for function
await page.waitForFunction(
  'document.querySelector(".loader").style.display === "none"'
);

// Wait for timeout
await page.waitForTimeout(2000);
```

#### PlayClone
```javascript
// Natural language wait
await browser.waitFor('dynamic content to load');

// Auto-waits are built into most operations
await browser.click('button'); // Waits for element automatically

// Explicit timeout
await browser.wait(2000);
```

### 8. JavaScript Execution

#### Puppeteer
```javascript
const result = await page.evaluate(() => {
  return document.title;
});

// With arguments
const sum = await page.evaluate((a, b) => a + b, 5, 10);
```

#### PlayClone
```javascript
// Direct page access for advanced usage
const result = await browser.page.evaluate(() => {
  return document.title;
});

// Prefer high-level methods
const title = await browser.getTitle();
```

### 9. Cookie Management

#### Puppeteer
```javascript
// Get cookies
const cookies = await page.cookies();

// Set cookie
await page.setCookie({
  name: 'session',
  value: 'abc123',
  domain: 'example.com'
});

// Delete cookies
await page.deleteCookie({ name: 'session' });
```

#### PlayClone
```javascript
// Get cookies
const cookies = await browser.getCookies();

// Set cookie
await browser.setCookie({
  name: 'session',
  value: 'abc123'
});

// Clear all cookies
await browser.clearCookies();
```

### 10. Network Interception

#### Puppeteer
```javascript
// Intercept requests
await page.setRequestInterception(true);
page.on('request', request => {
  if (request.resourceType() === 'image')
    request.abort();
  else
    request.continue();
});

// Monitor responses
page.on('response', response => {
  console.log(response.url(), response.status());
});
```

#### PlayClone
```javascript
// PlayClone handles network optimization internally
// For advanced use, access page directly:
browser.page.on('response', response => {
  console.log(response.url(), response.status());
});

// Built-in wait for network idle
await browser.navigate(url, { waitUntil: 'networkidle' });
```

## Advanced Migration Topics

### Session Management

#### Puppeteer (Manual)
```javascript
const pages = {};

async function getPage(id) {
  if (!pages[id]) {
    pages[id] = await browser.newPage();
  }
  return pages[id];
}

// Manual cleanup
async function closePage(id) {
  if (pages[id]) {
    await pages[id].close();
    delete pages[id];
  }
}
```

#### PlayClone (Built-in)
```javascript
// Automatic session management
const sessionId = 'user-session-123';

await browser.navigate('https://example.com', sessionId);
await browser.click('button', sessionId);
// Session persists automatically

// Explicit cleanup when done
await browser.close(sessionId);
```

### Error Handling

#### Puppeteer
```javascript
try {
  await page.click('.button');
} catch (error) {
  if (error.message.includes('No node found')) {
    console.log('Element not found');
    // Manual retry logic
    await page.waitForTimeout(1000);
    try {
      await page.click('.button');
    } catch (retryError) {
      throw new Error('Failed after retry');
    }
  }
}
```

#### PlayClone
```javascript
// Automatic retry with exponential backoff
const result = await browser.click('button');
if (!result.success) {
  console.log(result.error);
  console.log(result.suggestion); // AI-friendly suggestions
}

// Or use explicit retry
await browser.withRetry(
  () => browser.click('dynamic button'),
  { retries: 3 }
);
```

### State Management

#### Puppeteer (Manual Implementation)
```javascript
// Save state manually
const state = {
  url: page.url(),
  cookies: await page.cookies(),
  localStorage: await page.evaluate(() => {
    return JSON.stringify(localStorage);
  })
};

// Restore state
await page.goto(state.url);
await page.setCookie(...state.cookies);
await page.evaluate(state => {
  const data = JSON.parse(state.localStorage);
  Object.keys(data).forEach(key => {
    localStorage.setItem(key, data[key]);
  });
}, state);
```

#### PlayClone (Built-in)
```javascript
// Save state
const checkpoint = await browser.saveState();

// Do operations...

// Restore state
await browser.restoreState(checkpoint);
```

### Proxy Configuration

#### Puppeteer
```javascript
const browser = await puppeteer.launch({
  args: [
    '--proxy-server=http://proxy.example.com:8080',
    '--proxy-auth=username:password'
  ]
});
```

#### PlayClone
```javascript
const browser = new PlayClone({
  proxy: {
    server: 'http://proxy.example.com:8080',
    username: 'username',
    password: 'password'
  }
});
```

## Common Migration Patterns

### Pattern 1: Login Flow

#### Puppeteer
```javascript
async function login(page, username, password) {
  await page.goto('https://example.com/login');
  await page.waitForSelector('#username');
  await page.type('#username', username);
  await page.type('#password', password);
  await page.click('#login-button');
  await page.waitForNavigation();
  
  // Check if logged in
  try {
    await page.waitForSelector('.user-dashboard', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
```

#### PlayClone
```javascript
async function login(browser, username, password) {
  await browser.navigate('https://example.com/login');
  await browser.fill('username field', username);
  await browser.fill('password field', password);
  await browser.click('login button');
  
  // Auto-waits for navigation
  const success = await browser.waitFor('user dashboard', { timeout: 5000 });
  return success.success;
}
```

### Pattern 2: Web Scraping

#### Puppeteer
```javascript
async function scrapeProducts(page) {
  await page.goto('https://shop.example.com/products');
  await page.waitForSelector('.product-card');
  
  const products = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.product-card')).map(card => ({
      name: card.querySelector('.product-name')?.textContent,
      price: card.querySelector('.product-price')?.textContent,
      image: card.querySelector('img')?.src
    }));
  });
  
  return products;
}
```

#### PlayClone
```javascript
async function scrapeProducts(browser) {
  await browser.navigate('https://shop.example.com/products');
  
  // Natural language extraction
  const products = await browser.extractData('product cards', {
    name: 'product name',
    price: 'product price',
    image: 'product image url'
  });
  
  return products.data;
}
```

### Pattern 3: File Upload

#### Puppeteer
```javascript
const [fileChooser] = await Promise.all([
  page.waitForFileChooser(),
  page.click('#upload-button')
]);
await fileChooser.accept(['/path/to/file.pdf']);
```

#### PlayClone
```javascript
await browser.uploadFile('upload button', '/path/to/file.pdf');
```

### Pattern 4: Handling Popups

#### Puppeteer
```javascript
// Listen for popup
browser.on('targetcreated', async target => {
  const page = await target.page();
  if (page) {
    // Handle popup
    await page.close();
  }
});

// Or handle in main flow
const [popup] = await Promise.all([
  new Promise(resolve => browser.once('targetcreated', resolve)),
  page.click('.open-popup')
]);
```

#### PlayClone
```javascript
// Automatic popup handling
await browser.click('open popup button');
await browser.switchToPopup();
await browser.click('close button in popup');
await browser.switchToMain();
```

## Performance Comparison

### Startup Time

```javascript
// Puppeteer: ~2-3 seconds
const start = Date.now();
const browser = await puppeteer.launch();
const page = await browser.newPage();
console.log(`Startup: ${Date.now() - start}ms`);

// PlayClone: ~1-2 seconds (with pre-warming)
const start = Date.now();
const browser = new PlayClone({ prewarm: true });
console.log(`Startup: ${Date.now() - start}ms`);
```

### Memory Usage

```javascript
// Puppeteer: Manual optimization needed
const pages = [];
for (let i = 0; i < 10; i++) {
  pages.push(await browser.newPage());
}
// Memory grows linearly

// PlayClone: Automatic pooling and optimization
const pool = new PlayClone({ maxSessions: 5 });
for (let i = 0; i < 10; i++) {
  await pool.navigate(`https://example.com/page${i}`, `session-${i % 5}`);
}
// Memory capped at pool size
```

## Migration Checklist

### Before Migration
- [ ] Inventory all Puppeteer scripts
- [ ] Identify complex selectors that need natural language equivalents
- [ ] Document current error handling strategies
- [ ] List all browser launch configurations
- [ ] Note any custom page event handlers

### During Migration
- [ ] Replace `puppeteer` import with `playclone`
- [ ] Convert CSS selectors to natural language where beneficial
- [ ] Simplify error handling with PlayClone's built-in retry
- [ ] Update form filling to use PlayClone's batch methods
- [ ] Replace manual waits with PlayClone's auto-wait
- [ ] Utilize session management for multi-page flows

### After Migration
- [ ] Test all migrated scripts thoroughly
- [ ] Compare performance metrics
- [ ] Verify error handling works as expected
- [ ] Document any remaining Puppeteer-specific code
- [ ] Update CI/CD pipelines if needed

## Gradual Migration Strategy

You can run Puppeteer and PlayClone side by side:

```javascript
const puppeteer = require('puppeteer');
const { PlayClone } = require('playclone');

// Use Puppeteer for complex, existing flows
async function existingComplexFlow() {
  const browser = await puppeteer.launch();
  // ... existing Puppeteer code
}

// Use PlayClone for new features
async function newAIAssistantFlow() {
  const browser = new PlayClone();
  await browser.navigate('https://example.com');
  await browser.click('get started button');
  // ... new PlayClone code
}
```

## Troubleshooting Migration Issues

### Issue: Selectors Not Working

**Puppeteer selector:**
```javascript
await page.click('button.btn.btn-primary.submit-form');
```

**PlayClone solutions:**
```javascript
// Option 1: Natural language
await browser.click('primary submit button');

// Option 2: Keep CSS if specific
await browser.click('button.submit-form');

// Option 3: Use context
await browser.click('submit button in form');
```

### Issue: Different Response Format

**Puppeteer:**
```javascript
const element = await page.$('.price');
const price = await element.evaluate(el => el.textContent);
// Returns: "$19.99"
```

**PlayClone:**
```javascript
const result = await browser.getText('price');
// Returns: { success: true, data: "$19.99", elementFound: true }
const price = result.data;
```

### Issue: Missing Puppeteer Methods

For Puppeteer-specific methods not in PlayClone, access the underlying page:

```javascript
// PlayClone
const browser = new PlayClone();

// Access Playwright page for advanced usage
const page = browser.page;

// Now use Playwright methods (similar to Puppeteer)
await page.evaluate(() => {
  // Custom JavaScript
});
```

## Best Practices for Migration

1. **Start with simple scripts** - Migrate basic automation first
2. **Use natural language** - Take advantage of PlayClone's NLP features
3. **Leverage session management** - Don't recreate Puppeteer's manual session handling
4. **Embrace AI optimization** - Design for token efficiency
5. **Test incrementally** - Migrate and test one script at a time
6. **Keep fallbacks** - Maintain Puppeteer code until migration is proven

## Example: Complete Migration

### Original Puppeteer Script
```javascript
const puppeteer = require('puppeteer');

async function searchAndExtract(query) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://www.google.com');
    await page.waitForSelector('input[name="q"]');
    await page.type('input[name="q"]', query);
    await page.keyboard.press('Enter');
    
    await page.waitForNavigation();
    await page.waitForSelector('#search');
    
    const results = await page.evaluate(() => {
      const items = document.querySelectorAll('.g');
      return Array.from(items).slice(0, 5).map(item => ({
        title: item.querySelector('h3')?.textContent || '',
        link: item.querySelector('a')?.href || '',
        snippet: item.querySelector('.VwiC3b')?.textContent || ''
      }));
    });
    
    return results;
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  } finally {
    await browser.close();
  }
}

// Usage
searchAndExtract('PlayClone tutorial').then(results => {
  console.log(results);
});
```

### Migrated PlayClone Script
```javascript
const { PlayClone } = require('playclone');

async function searchAndExtract(query) {
  const browser = new PlayClone({ headless: false });
  
  try {
    await browser.navigate('https://www.google.com');
    await browser.fill('search input', query);
    await browser.press('Enter');
    
    // Auto-waits for results
    const results = await browser.extractData('search results', {
      title: 'result title',
      link: 'result link',
      snippet: 'result description'
    }, { limit: 5 });
    
    return results.data || [];
  } catch (error) {
    console.error('Search failed:', error.message);
    return [];
  } finally {
    await browser.close();
  }
}

// Usage - identical!
searchAndExtract('PlayClone tutorial').then(results => {
  console.log(results);
});
```

### Benefits After Migration
- **50% less code** - Cleaner, more maintainable
- **Natural language** - More intuitive selectors
- **Auto-retry** - Built-in resilience
- **AI-optimized** - Ready for AI assistant integration
- **Better errors** - Helpful error messages with suggestions

## Conclusion

Migrating from Puppeteer to PlayClone simplifies browser automation while adding powerful features like natural language selection and AI optimization. The migration can be done gradually, and both tools can coexist during the transition period.

For more help:
- See [API Reference](./API_REFERENCE.md)
- Check [examples directory](../examples/)
- Review [troubleshooting guide](./TROUBLESHOOTING.md)
- Join our community for support