# PlayClone Troubleshooting Guide

## Common Issues and Solutions

### Installation Issues

#### Browser binaries not downloading

**Symptom**: Error message about missing browser executables

**Solution**:
```bash
# Manually install Playwright browsers
npx playwright install chromium

# Or install all browsers
npx playwright install
```

**Alternative**: Set environment variable to skip download
```bash
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
# Then manually specify browser path
const browser = new PlayClone({
  browserPath: '/path/to/chrome'
});
```

#### TypeScript compilation errors

**Symptom**: `Cannot find module` or type errors

**Solution**:
```bash
# Rebuild the project
npm run build

# Clear TypeScript cache
rm -rf node_modules/.cache
rm -rf dist
npm run build
```

#### Permission denied errors

**Symptom**: EACCES or permission errors on Linux/Mac

**Solution**:
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use npx instead of global install
npx playclone
```

### Runtime Issues

#### Browser won't launch

**Symptom**: Timeout or crash when creating PlayClone instance

**Causes and Solutions**:

1. **Missing system dependencies** (Linux)
```bash
# Install required dependencies
sudo apt-get update
sudo apt-get install -y \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxrandr2 libgbm1 libgtk-3-0 \
  libxss1 libasound2
```

2. **Sandbox issues** (Docker/CI)
```typescript
const browser = new PlayClone({
  browserArgs: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

3. **Display server missing** (Headless Linux)
```bash
# Install xvfb for virtual display
sudo apt-get install xvfb

# Run with virtual display
xvfb-run -a npm test
```

#### Element not found errors

**Symptom**: "Element not found" even though element is visible

**Solutions**:

1. **Wait for element to appear**
```typescript
const browser = new PlayClone({
  autoWait: true,
  waitTimeout: 30000 // Increase timeout
});
```

2. **Use more specific selectors**
```typescript
// Instead of:
await browser.click('button');

// Try:
await browser.click('submit button in login form');
await browser.click('blue button with text "Submit"');
```

3. **Check if element is in iframe**
```typescript
// Switch to iframe first
await browser.switchToFrame('iframe name');
await browser.click('button in iframe');
```

4. **Element might be covered**
```typescript
// Scroll element into view
await browser.scrollTo('target element');
await browser.click('target element');
```

#### Timeout errors

**Symptom**: Operations timing out before completion

**Solutions**:

1. **Increase global timeout**
```typescript
const browser = new PlayClone({
  timeout: 60000 // 60 seconds
});
```

2. **Set specific timeouts**
```typescript
await browser.navigate('https://slow-site.com', {
  timeout: 120000 // 2 minutes for slow sites
});
```

3. **Disable timeout for debugging**
```typescript
const browser = new PlayClone({
  timeout: 0 // No timeout
});
```

#### Memory leaks

**Symptom**: Increasing memory usage over time

**Solutions**:

1. **Properly close browsers**
```typescript
try {
  const browser = new PlayClone();
  // ... operations ...
} finally {
  await browser.close();
}
```

2. **Clear cache periodically**
```typescript
// Clear browser cache
await browser.clearCache();

// Reset context
await browser.reset();
```

3. **Use browser pooling**
```typescript
class BrowserPool {
  private pool: PlayClone[] = [];
  
  async getBrowser() {
    if (this.pool.length > 0) {
      const browser = this.pool.pop();
      await browser.reset();
      return browser;
    }
    return new PlayClone();
  }
  
  async release(browser: PlayClone) {
    if (this.pool.length < 5) {
      this.pool.push(browser);
    } else {
      await browser.close();
    }
  }
}
```

### Natural Language Issues

#### Incorrect element matching

**Symptom**: PlayClone clicks wrong element or can't find obvious elements

**Solutions**:

1. **Be more descriptive**
```typescript
// Too vague:
await browser.click('button');

// Better:
await browser.click('green checkout button');
await browser.click('button labeled "Continue"');
await browser.click('first button in header');
```

2. **Use alternative descriptions**
```typescript
// If this doesn't work:
await browser.click('submit');

// Try these:
await browser.click('button[type=submit]');
await browser.click('form submission button');
await browser.click('button to submit form');
```

3. **Provide context**
```typescript
// Specify location:
await browser.click('login button in navigation bar');
await browser.click('save button at bottom of form');
```

#### Ambiguous element descriptions

**Symptom**: "Multiple elements found" error

**Solutions**:

1. **Add position modifiers**
```typescript
await browser.click('first link');
await browser.click('last button');
await browser.click('second item in list');
```

2. **Add visual descriptions**
```typescript
await browser.click('large blue button');
await browser.click('small text link');
```

3. **Use parent context**
```typescript
await browser.click('submit button in login form');
await browser.click('close icon in modal dialog');
```

### Performance Issues

#### Slow execution

**Symptom**: Operations take longer than expected

**Solutions**:

1. **Disable unnecessary features**
```typescript
const browser = new PlayClone({
  headless: true,
  images: false,  // Don't load images
  css: false,     // Don't load CSS
  javascript: false // Disable JS if not needed
});
```

2. **Use connection pooling**
```typescript
// Reuse browser instances
const browserPool = new BrowserPool();
const browser = await browserPool.acquire();
// ... use browser ...
await browserPool.release(browser);
```

3. **Optimize selectors**
```typescript
// Use specific selectors when possible
await browser.click('#specific-id'); // Fastest
await browser.click('[data-testid="button"]'); // Fast
await browser.click('blue submit button'); // Slower but more flexible
```

#### High CPU usage

**Symptom**: CPU spikes during browser operations

**Solutions**:

1. **Limit concurrent browsers**
```typescript
const MAX_BROWSERS = 3;
const semaphore = new Semaphore(MAX_BROWSERS);

async function processBatch(urls: string[]) {
  return Promise.all(urls.map(async url => {
    await semaphore.acquire();
    try {
      const browser = new PlayClone();
      await browser.navigate(url);
      // ... process ...
      await browser.close();
    } finally {
      semaphore.release();
    }
  }));
}
```

2. **Throttle operations**
```typescript
const browser = new PlayClone({
  slowMo: 100 // Add 100ms delay between operations
});
```

### Network Issues

#### SSL/Certificate errors

**Symptom**: Navigation fails with SSL errors

**Solutions**:

1. **Ignore certificate errors (development only)**
```typescript
const browser = new PlayClone({
  ignoreHTTPSErrors: true
});
```

2. **Provide certificates**
```typescript
const browser = new PlayClone({
  clientCertificates: [{
    origin: 'https://example.com',
    cert: '/path/to/cert.pem',
    key: '/path/to/key.pem'
  }]
});
```

#### Proxy configuration

**Symptom**: Cannot access sites behind proxy

**Solution**:
```typescript
const browser = new PlayClone({
  proxy: {
    server: 'http://proxy.example.com:8080',
    username: 'user',
    password: 'pass'
  }
});
```

#### Request interception

**Symptom**: Need to modify or block requests

**Solution**:
```typescript
// Block specific resources
const browser = new PlayClone({
  blockResources: ['image', 'font', 'media']
});

// Custom request handling
browser.on('request', request => {
  if (request.url.includes('tracking')) {
    request.abort();
  } else {
    request.continue();
  }
});
```

### Debugging Techniques

#### Enable verbose logging

```typescript
const browser = new PlayClone({
  debug: true,
  logLevel: 'verbose'
});

// Or set environment variable
process.env.DEBUG = 'playclone:*';
```

#### Take screenshots on error

```typescript
try {
  await browser.click('element');
} catch (error) {
  await browser.screenshot('error-screenshot.png');
  console.log('Screenshot saved, error:', error);
  throw error;
}
```

#### Record browser session

```typescript
const browser = new PlayClone({
  recordVideo: {
    dir: './videos',
    size: { width: 1280, height: 720 }
  }
});
```

#### Use headed mode for debugging

```typescript
const browser = new PlayClone({
  headless: false,  // See what's happening
  slowMo: 500      // Slow down actions
});
```

#### Inspect element tree

```typescript
// Get accessibility tree
const tree = await browser.getAccessibilityTree();
console.log(JSON.stringify(tree, null, 2));

// Get all text content
const text = await browser.getText('*');
console.log('Page text:', text);

// Get all clickable elements
const clickable = await browser.getClickableElements();
console.log('Clickable:', clickable);
```

### Docker/Container Issues

#### Browser crashes in Docker

**Solution**: Add required arguments
```dockerfile
# Dockerfile
FROM node:20-slim

# Install browser dependencies
RUN apt-get update && apt-get install -y \
  wget gnupg ca-certificates \
  fonts-liberation libappindicator3-1 libasound2 \
  libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
  libgdk-pixbuf2.0-0 libgtk-3-0 libnspr4 libnss3 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
  xdg-utils libgbm1 libxss1

# Install Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
  && apt-get update \
  && apt-get install -y google-chrome-stable

# Use with no-sandbox in container
ENV PLAYCLONE_ARGS="--no-sandbox --disable-setuid-sandbox"
```

#### Shared memory issues

**Solution**: Increase shared memory
```bash
# Docker run
docker run --shm-size=2gb myimage

# Docker compose
services:
  app:
    shm_size: '2gb'
```

### CI/CD Issues

#### GitHub Actions failures

**Solution**: Use proper setup
```yaml
# .github/workflows/test.yml
name: Tests
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      # Install dependencies including browsers
      - run: npm ci
      - run: npx playwright install-deps
      - run: npx playwright install chromium
      
      # Run tests
      - run: npm test
        env:
          PLAYCLONE_HEADLESS: true
```

#### Jenkins pipeline issues

**Solution**: Configure Xvfb
```groovy
pipeline {
  agent any
  stages {
    stage('Test') {
      steps {
        sh 'apt-get update && apt-get install -y xvfb'
        sh 'xvfb-run -a npm test'
      }
    }
  }
}
```

### Error Message Reference

#### "Browser closed unexpectedly"
- **Cause**: Browser process crashed
- **Fix**: Check system resources, add --no-sandbox flag

#### "Execution context was destroyed"
- **Cause**: Page navigated or refreshed during operation
- **Fix**: Wait for navigation to complete, use page events

#### "Target closed"
- **Cause**: Tab or browser was closed
- **Fix**: Check for browser.close() calls, handle cleanup properly

#### "Protocol error"
- **Cause**: Communication error with browser
- **Fix**: Update PlayClone and browser versions, check for conflicts

#### "Timeout exceeded"
- **Cause**: Operation took too long
- **Fix**: Increase timeout, check network, optimize selectors

#### "Node is detached from document"
- **Cause**: Element removed from DOM
- **Fix**: Re-query element, use auto-wait feature

### Getting Help

#### Diagnostic information to collect

When reporting issues, include:

1. **System information**
```bash
# OS and version
uname -a

# Node version
node --version

# PlayClone version
npm list playclone

# Browser version
npx playwright --version
```

2. **Error reproduction**
```typescript
// Minimal code to reproduce
const browser = new PlayClone({ debug: true });
await browser.navigate('https://example.com');
// Error occurs here
await browser.click('problem element');
```

3. **Debug output**
```bash
# Run with debug enabled
DEBUG=playclone:* npm test 2>&1 | tee debug.log
```

4. **Screenshots/videos**
```typescript
// Capture state when error occurs
await browser.screenshot('error-state.png');
await browser.saveState('error-state.json');
```

#### Community resources

- **GitHub Issues**: https://github.com/playclone/playclone/issues
- **Discord**: https://discord.gg/playclone
- **Stack Overflow**: Tag with `playclone`
- **Documentation**: https://docs.playclone.dev

#### Reporting bugs

Include in bug reports:
1. PlayClone version
2. Node.js version
3. Operating system
4. Browser being automated
5. Minimal reproduction code
6. Error messages and stack traces
7. Debug logs if available

### Performance Profiling

#### Memory profiling

```typescript
// Monitor memory usage
const usage = process.memoryUsage();
console.log('Memory:', {
  rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
  heap: Math.round(usage.heapUsed / 1024 / 1024) + ' MB'
});

// Force garbage collection (requires --expose-gc flag)
if (global.gc) {
  global.gc();
}
```

#### CPU profiling

```bash
# Profile with Chrome DevTools
node --inspect npm start

# Profile with clinic.js
npm install -g clinic
clinic doctor -- node app.js
```

#### Network profiling

```typescript
// Monitor network activity
browser.on('request', req => {
  console.log('Request:', req.url, req.method);
});

browser.on('response', res => {
  console.log('Response:', res.url, res.status);
});
```

### Best Practices for Avoiding Issues

1. **Always close browsers**
```typescript
const browser = new PlayClone();
try {
  // Your automation code
} finally {
  await browser.close();
}
```

2. **Handle errors gracefully**
```typescript
async function safeBrowse(url: string) {
  const browser = new PlayClone();
  try {
    await browser.navigate(url);
    return await browser.getText('body');
  } catch (error) {
    console.error('Browse failed:', error);
    await browser.screenshot('error.png');
    return null;
  } finally {
    await browser.close();
  }
}
```

3. **Use appropriate timeouts**
```typescript
const browser = new PlayClone({
  timeout: 30000,          // Global timeout
  navigationTimeout: 60000, // Navigation specific
  actionTimeout: 10000     // Click/type timeout
});
```

4. **Monitor resource usage**
```typescript
setInterval(() => {
  const mem = process.memoryUsage();
  if (mem.heapUsed > 500 * 1024 * 1024) {
    console.warn('High memory usage:', mem);
  }
}, 60000);
```

5. **Implement retry logic**
```typescript
async function retryOperation(fn: Function, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}
```

## Frequently Asked Questions (FAQ)

### General Questions

#### Q: What browsers does PlayClone support?
**A:** PlayClone supports Chromium (default), Firefox, and WebKit browsers. Chromium has the best compatibility and is recommended for production use. Firefox support is at 90% compatibility, while WebKit requires additional system dependencies on Linux.

#### Q: Can I use PlayClone with my existing Playwright code?
**A:** Yes! PlayClone is built on top of Playwright and maintains compatibility. You can gradually migrate by using PlayClone for new features while keeping existing Playwright code. See the Migration Guide for details.

#### Q: Is PlayClone suitable for production use?
**A:** Yes, PlayClone is production-ready with 95% test coverage and extensive real-world testing. It's being used by AI assistants for automated browser tasks with high reliability.

#### Q: How does PlayClone differ from Puppeteer or Playwright?
**A:** PlayClone is specifically designed for AI assistants with:
- Natural language element selection ("click login button")
- AI-optimized responses (<1KB JSON)
- No code generation required
- Direct function calls from AI
- Built-in session management

### Installation & Setup

#### Q: Why do I get "Cannot find module" errors?
**A:** This usually means the project hasn't been built. Run:
```bash
npm run build
```
If the issue persists, try:
```bash
rm -rf node_modules dist
npm install
npm run build
```

#### Q: How do I use PlayClone with Node.js 18?
**A:** While PlayClone recommends Node.js 20+, it works with Node.js 18.19+. The MCP server v2 (`mcp-server-v2.cjs`) is specifically designed for Node.js 18 compatibility.

#### Q: Can I use PlayClone without installing browser binaries?
**A:** Yes, you can use system-installed browsers:
```javascript
const browser = new PlayClone({
  channel: 'chrome' // Uses system Chrome
});
```

### Browser Control

#### Q: Why doesn't the browser window appear when using MCP?
**A:** By default, the MCP server now runs in visible mode. If you still don't see the browser:
1. Check if `PLAYCLONE_HEADLESS` environment variable is set
2. Ensure you're using `mcp-server-v2.cjs` (not v1)
3. Verify your display server is working (for Linux servers)

#### Q: How do I run PlayClone in headless mode?
**A:** Set the headless option:
```javascript
const browser = new PlayClone({ headless: true });
```
Or with MCP:
```bash
PLAYCLONE_HEADLESS=true node mcp-server-v2.cjs
```

#### Q: Can I control browser window size and position?
**A:** Yes, use viewport and window options:
```javascript
const browser = new PlayClone({
  viewport: { width: 1920, height: 1080 },
  windowPosition: { x: 0, y: 0 }
});
```

### Natural Language Selectors

#### Q: What if my natural language selector doesn't work?
**A:** Try these approaches:
1. Be more specific: "blue submit button" instead of "button"
2. Add context: "login button in header" instead of "login"
3. Use standard UI terms: "hamburger menu", "dropdown", "modal"
4. Check if element is visible and loaded

#### Q: Can I mix CSS selectors with natural language?
**A:** Yes! PlayClone accepts both:
```javascript
await browser.click('#specific-id'); // CSS selector
await browser.click('submit button'); // Natural language
```

#### Q: How does PlayClone find elements with natural language?
**A:** PlayClone uses a multi-strategy approach:
1. Accessibility tree matching (aria-label, role)
2. Text content matching
3. Fuzzy matching with synonyms
4. Visual position hints (first, last)
5. Fallback to CSS selectors

### Performance

#### Q: Why is the first browser launch slow?
**A:** The first launch initializes the browser binary. Use pre-warming for better performance:
```javascript
const browser = new PlayClone({ prewarm: true });
```

#### Q: How can I speed up repeated operations?
**A:** Use session reuse and connection pooling:
```javascript
const sessionId = 'my-session';
await browser.navigate('https://example.com', sessionId);
// Reuse session for next operation
await browser.click('button', sessionId);
```

#### Q: What's the recommended timeout for complex sites?
**A:** Use adaptive timeouts based on site complexity:
- Simple static sites: 5-10 seconds
- Dynamic SPAs: 15-30 seconds
- Heavy applications: 30-60 seconds

### Error Handling

#### Q: Why do I get "Element not found" errors?
**A:** Common causes and solutions:
1. Element not loaded yet - add wait: `await browser.waitFor('element')`
2. Element in iframe - switch context first
3. Dynamic content - wait for network idle
4. Wrong selector - try alternative descriptions

#### Q: How do I handle intermittent failures?
**A:** Implement retry logic:
```javascript
const result = await browser.withRetry(
  () => browser.click('dynamic button'),
  { retries: 3, delay: 1000 }
);
```

#### Q: What does "Context destroyed" mean?
**A:** The browser page/tab was closed or crashed. Common causes:
- Page navigation to `about:blank`
- JavaScript `window.close()`
- Browser crash from memory issues
- Explicit close call

### MCP Integration

#### Q: How do I connect PlayClone to Claude or other AI assistants?
**A:** Add PlayClone to your MCP configuration:
```json
{
  "mcpServers": {
    "playclone": {
      "command": "node",
      "args": ["/path/to/playclone/mcp-server-v2.cjs"]
    }
  }
}
```

#### Q: Why does MCP show "Failed to reconnect"?
**A:** This is often a false alarm. The MCP tools usually still work. Try:
1. Using the tools anyway - they often work despite the message
2. Restarting the MCP server
3. Checking the server logs for actual errors

#### Q: Can I use multiple PlayClone sessions with MCP?
**A:** Yes! Each MCP tool call can specify a different sessionId:
```javascript
// Session 1 for search
await mcp.navigate('https://google.com', 'search-session');

// Session 2 for documentation
await mcp.navigate('https://docs.example.com', 'docs-session');
```

### Data Extraction

#### Q: How do I extract data from dynamic content?
**A:** Wait for content to load before extraction:
```javascript
await browser.navigate('https://spa-app.com');
await browser.waitFor('data-container');
const data = await browser.getText('data-container');
```

#### Q: Can I extract data from multiple elements?
**A:** Yes, use array selectors or get all matching elements:
```javascript
const prices = await browser.getText('all price tags');
const links = await browser.getLinks('navigation menu');
```

#### Q: How do I handle paginated data?
**A:** Use a loop with pagination detection:
```javascript
const allData = [];
do {
  const pageData = await browser.getText('content');
  allData.push(pageData);
  const hasNext = await browser.exists('next button');
  if (hasNext) await browser.click('next button');
  else break;
} while (true);
```

### Security & Privacy

#### Q: Is it safe to use PlayClone with credentials?
**A:** Yes, but follow these practices:
1. Never hardcode credentials
2. Use environment variables
3. Clear cookies/storage after sensitive operations
4. Run in incognito mode for isolation

#### Q: Does PlayClone work with sites that detect automation?
**A:** PlayClone includes stealth features:
- Randomized user agents
- Human-like delays
- Anti-bot detection bypass for common sites
- WebDriver flag removal

#### Q: Can I use proxies with PlayClone?
**A:** Yes, PlayClone supports HTTP/HTTPS/SOCKS5 proxies:
```javascript
const browser = new PlayClone({
  proxy: {
    server: 'http://proxy.example.com:8080',
    username: 'user',
    password: 'pass'
  }
});
```

### Debugging

#### Q: How do I debug why automation is failing?
**A:** Use these debugging techniques:
1. Run in visible mode: `{ headless: false }`
2. Add slow motion: `{ slowMo: 500 }`
3. Take screenshots: `await browser.screenshot('debug.png')`
4. Enable verbose logging: `{ debug: true }`
5. Use DevTools: `{ devtools: true }`

#### Q: How can I see what PlayClone is doing?
**A:** Enable visual debugging:
```javascript
const browser = new PlayClone({
  headless: false,  // See browser
  slowMo: 1000,     // Slow down actions
  devtools: true    // Open DevTools
});
```

#### Q: How do I capture network requests?
**A:** Use page event listeners:
```javascript
const page = browser.page;
page.on('request', req => console.log('Request:', req.url()));
page.on('response', res => console.log('Response:', res.status()));
```

### Advanced Usage

#### Q: Can I inject custom JavaScript?
**A:** Yes, use evaluate:
```javascript
const result = await browser.page.evaluate(() => {
  return document.title;
});
```

#### Q: How do I handle multiple tabs/windows?
**A:** Use contexts for isolation:
```javascript
const context1 = await browser.newContext();
const context2 = await browser.newContext();
// Each context is independent
```

#### Q: Can I save and restore browser state?
**A:** Yes, use checkpointing:
```javascript
const checkpoint = await browser.saveState();
// Do operations...
await browser.restoreState(checkpoint);
```

#### Q: How do I handle file uploads?
**A:** Use the file input handler:
```javascript
await browser.setInputFiles('file input', '/path/to/file.pdf');
```

#### Q: Can I intercept and modify requests?
**A:** Yes, use route handlers:
```javascript
await browser.page.route('**/*.jpg', route => {
  route.abort(); // Block images
});
```

### Troubleshooting Specific Sites

#### Q: Why doesn't Google search work?
**A:** Google has anti-automation measures. Use the SearchEngineHandler:
```javascript
await browser.searchGoogle('query');
// Or manually:
await browser.fill('textarea[name="q"]', 'search term');
await browser.press('Enter');
```

#### Q: How do I handle cookie consent popups?
**A:** Try to click accept/dismiss:
```javascript
try {
  await browser.click('accept cookies button', { timeout: 5000 });
} catch {
  // Continue if no popup
}
```

#### Q: Why do some SPAs not load properly?
**A:** Wait for network idle or specific elements:
```javascript
await browser.navigate(url, { waitUntil: 'networkidle' });
// Or
await browser.waitFor('app-loaded-indicator');
```

### Common Error Messages

#### Q: "Browser closed unexpectedly"
**A:** Usually means the browser crashed. Check:
- System memory availability
- Browser binary corruption
- Conflicting browser extensions

#### Q: "Timeout exceeded"
**A:** Operation took too long. Solutions:
- Increase timeout: `{ timeout: 60000 }`
- Check if site is actually loading
- Verify network connectivity

#### Q: "Protocol error"
**A:** Communication with browser failed. Try:
- Restart PlayClone
- Update browser binaries
- Check for zombie browser processes

#### Q: "Session not found"
**A:** The session ID doesn't exist or expired. Ensure:
- Session was created before use
- Session wasn't closed prematurely
- Using correct session ID

### Getting Help

#### Q: Where can I find more examples?
**A:** Check these resources:
- `/examples` directory in the repository
- `/tests` directory for test cases
- API documentation in `/docs/API.md`
- GitHub issues for community solutions

#### Q: How do I report a bug?
**A:** Create a GitHub issue with:
1. PlayClone version
2. Node.js version
3. Operating system
4. Minimal reproduction code
5. Error messages/screenshots

#### Q: Is there community support?
**A:** Yes! Find help at:
- GitHub Discussions
- Stack Overflow tag: `playclone`
- Discord community (coming soon)

#### Q: Can I contribute to PlayClone?
**A:** Absolutely! See CONTRIBUTING.md for guidelines. We welcome:
- Bug reports and fixes
- New features
- Documentation improvements
- Test cases
- Examples