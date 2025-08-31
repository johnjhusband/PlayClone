# AI Integration Guide for PlayClone

## Overview

PlayClone is designed specifically for AI assistants to control web browsers through direct function calls. This guide covers how to integrate PlayClone into your AI assistant's capabilities.

## Quick Start for AI Assistants

```typescript
import { PlayClone } from 'playclone';

// Initialize with AI-optimized settings
const browser = new PlayClone({
  headless: true,
  responseFormat: 'minimal', // Returns <1KB responses
  autoWait: true,            // Handles dynamic content automatically
  naturalLanguage: true      // Enables natural language selectors
});

// Navigate to a website
const result = await browser.navigate('https://example.com');

// Use natural language to interact
await browser.click('the login button');
await browser.fill('email field', 'user@example.com');
await browser.fill('password', 'secretpass');
await browser.click('submit');

// Extract data
const data = await browser.getText('main content');
```

## Key Concepts for AI Usage

### 1. Natural Language Selectors

PlayClone understands natural descriptions of elements:

```typescript
// Instead of CSS selectors
await browser.click('#login-btn');

// Use natural language
await browser.click('login button');
await browser.click('the blue submit button');
await browser.click('first item in the list');
await browser.click('link that says "Learn More"');
```

### 2. AI-Optimized Responses

All responses are JSON formatted and optimized for token efficiency:

```json
{
  "success": true,
  "action": "click",
  "target": "login button",
  "timestamp": "2025-08-30T10:30:00Z",
  "data": null
}
```

### 3. Automatic Error Recovery

PlayClone handles common issues automatically:
- Waits for elements to appear
- Retries failed actions with exponential backoff
- Provides fallback strategies
- Returns actionable error messages

## Integration Patterns

### Pattern 1: Direct Function Mapping

Map AI intents directly to PlayClone functions:

```typescript
class AIBrowserController {
  private browser: PlayClone;

  async executeIntent(intent: string, params: any) {
    switch(intent) {
      case 'navigate':
        return await this.browser.navigate(params.url);
      
      case 'click':
        return await this.browser.click(params.element);
      
      case 'extract_data':
        return await this.browser.getText(params.selector);
      
      case 'fill_form':
        return await this.browser.fill(params.field, params.value);
    }
  }
}
```

### Pattern 2: Natural Language Command Processing

Process natural language commands directly:

```typescript
async function processCommand(command: string) {
  const browser = new PlayClone();
  
  // Parse natural language commands
  if (command.includes('go to') || command.includes('navigate')) {
    const url = extractUrl(command);
    return await browser.navigate(url);
  }
  
  if (command.includes('click')) {
    const element = extractElement(command);
    return await browser.click(element);
  }
  
  if (command.includes('type') || command.includes('enter')) {
    const [field, value] = extractFieldValue(command);
    return await browser.fill(field, value);
  }
}
```

### Pattern 3: Stateful Conversation Integration

Maintain browser state across conversation turns:

```typescript
class ConversationalBrowser {
  private sessions = new Map<string, PlayClone>();
  
  async handleUserMessage(userId: string, message: string) {
    // Get or create session
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, new PlayClone({
        sessionId: userId,
        persistent: true
      }));
    }
    
    const browser = this.sessions.get(userId);
    
    // Process message and execute browser actions
    const result = await this.processMessage(browser, message);
    
    // Return AI-friendly response
    return this.formatResponse(result);
  }
}
```

## Common AI Use Cases

### 1. Web Scraping and Data Extraction

```typescript
async function extractProductInfo(url: string) {
  const browser = new PlayClone();
  await browser.navigate(url);
  
  return {
    title: await browser.getText('product title'),
    price: await browser.getText('price'),
    description: await browser.getText('product description'),
    reviews: await browser.getText('review count')
  };
}
```

### 2. Form Automation

```typescript
async function fillApplicationForm(data: ApplicationData) {
  const browser = new PlayClone();
  await browser.navigate('https://example.com/apply');
  
  // Fill form using natural language field descriptions
  await browser.fill('first name field', data.firstName);
  await browser.fill('last name field', data.lastName);
  await browser.fill('email address', data.email);
  await browser.select('country dropdown', data.country);
  await browser.check('agree to terms checkbox');
  await browser.click('submit application button');
  
  // Get confirmation
  return await browser.getText('confirmation message');
}
```

### 3. Multi-Step Workflows

```typescript
async function completeCheckout(items: CartItem[], payment: PaymentInfo) {
  const browser = new PlayClone();
  
  // Add items to cart
  for (const item of items) {
    await browser.navigate(item.url);
    await browser.select('size dropdown', item.size);
    await browser.fill('quantity', item.quantity.toString());
    await browser.click('add to cart');
  }
  
  // Proceed to checkout
  await browser.click('cart icon');
  await browser.click('checkout button');
  
  // Fill shipping info
  await browser.fill('shipping address', payment.address);
  await browser.fill('city', payment.city);
  await browser.fill('zip code', payment.zip);
  
  // Fill payment info
  await browser.fill('card number', payment.cardNumber);
  await browser.fill('expiry date', payment.expiry);
  await browser.fill('cvv', payment.cvv);
  
  // Complete order
  await browser.click('place order');
  
  // Return order confirmation
  return await browser.getText('order number');
}
```

### 4. Content Monitoring

```typescript
async function monitorPriceChanges(productUrl: string) {
  const browser = new PlayClone({ persistent: true });
  
  // Initial check
  await browser.navigate(productUrl);
  const initialPrice = await browser.getText('price');
  
  // Set up monitoring
  setInterval(async () => {
    await browser.reload();
    const currentPrice = await browser.getText('price');
    
    if (currentPrice !== initialPrice) {
      // Notify AI about price change
      notifyPriceChange(productUrl, initialPrice, currentPrice);
    }
  }, 3600000); // Check every hour
}
```

## Token Optimization Strategies

### 1. Use Minimal Response Format

```typescript
const browser = new PlayClone({
  responseFormat: 'minimal' // Returns only essential data
});

// Minimal response example:
// { "s": true, "d": "Login successful" }
```

### 2. Batch Operations

```typescript
// Instead of multiple calls
await browser.click('button1');
await browser.click('button2');
await browser.click('button3');

// Use batch operations
await browser.batchExecute([
  { action: 'click', target: 'button1' },
  { action: 'click', target: 'button2' },
  { action: 'click', target: 'button3' }
]);
```

### 3. Selective Data Extraction

```typescript
// Extract only needed fields
const data = await browser.extractData({
  title: 'h1',
  price: '.price',
  inStock: '.availability'
});
// Returns compact JSON with just these fields
```

## Error Handling for AI

PlayClone provides AI-friendly error messages with suggestions:

```typescript
try {
  await browser.click('non-existent button');
} catch (error) {
  console.log(error.aiResponse);
  // {
  //   "error": "Element not found",
  //   "element": "non-existent button",
  //   "suggestions": [
  //     "Try: 'submit button'",
  //     "Try: 'continue button'",
  //     "Wait for page to load",
  //     "Check if element exists"
  //   ],
  //   "alternatives": ["button.submit", "#submit-btn"]
  // }
}
```

## Best Practices for AI Integration

### 1. Session Management

```typescript
// Create persistent sessions for users
const browser = new PlayClone({
  sessionId: `user_${userId}`,
  persistent: true,
  maxSessionAge: 3600000 // 1 hour
});
```

### 2. State Checkpoints

```typescript
// Save state for conversation continuity
const checkpoint = await browser.saveState();

// Later, restore state
await browser.restoreState(checkpoint);
```

### 3. Graceful Degradation

```typescript
// Configure fallback strategies
const browser = new PlayClone({
  fallbackStrategies: [
    'accessibility',  // Try accessibility tree first
    'text',          // Fall back to text matching
    'visual',        // Use visual recognition
    'javascript'     // Last resort: direct JS
  ]
});
```

### 4. Resource Management

```typescript
// Clean up resources properly
try {
  const browser = new PlayClone();
  // ... perform operations ...
} finally {
  await browser.close();
}
```

## Advanced AI Features

### 1. Context-Aware Actions

```typescript
// PlayClone maintains context across actions
await browser.navigate('https://shop.example.com');
await browser.click('login');  // Knows we're on shop.example.com
await browser.fill('username', 'user@example.com'); // Knows we're in login flow
```

### 2. Intelligent Waiting

```typescript
// Automatically waits for the right conditions
await browser.click('load more'); // Waits for button to be clickable
// Automatically waits for new content to load
const newItems = await browser.getText('newly loaded items');
```

### 3. Multi-Tab Management

```typescript
// Handle multiple tabs for complex workflows
const tab1 = await browser.newTab();
await tab1.navigate('https://site1.com');

const tab2 = await browser.newTab();
await tab2.navigate('https://site2.com');

// Compare data across tabs
const price1 = await tab1.getText('price');
const price2 = await tab2.getText('price');
```

## Troubleshooting Common AI Integration Issues

### Issue: Token Limit Exceeded

**Solution**: Use minimal response format and data filtering
```typescript
const browser = new PlayClone({
  responseFormat: 'minimal',
  maxResponseSize: 512 // Limit response to 512 bytes
});
```

### Issue: Element Not Found

**Solution**: Use more descriptive natural language
```typescript
// Instead of:
await browser.click('button');

// Use:
await browser.click('blue submit button at bottom of form');
```

### Issue: Dynamic Content Not Loading

**Solution**: Enable aggressive waiting
```typescript
const browser = new PlayClone({
  autoWait: true,
  waitStrategy: 'aggressive',
  maxWaitTime: 30000
});
```

### Issue: Session Timeout

**Solution**: Implement session keep-alive
```typescript
// Keep session alive with periodic actions
setInterval(async () => {
  await browser.evaluate('1+1'); // Lightweight keep-alive
}, 300000); // Every 5 minutes
```

## Performance Optimization

### 1. Connection Pooling

```typescript
// Reuse browser instances across requests
class BrowserPool {
  private pool: PlayClone[] = [];
  
  async getBrowser(): Promise<PlayClone> {
    return this.pool.pop() || new PlayClone();
  }
  
  async releaseBrowser(browser: PlayClone) {
    await browser.reset(); // Clear state
    this.pool.push(browser);
  }
}
```

### 2. Caching Strategies

```typescript
// Cache frequently accessed data
const cache = new Map();

async function getCachedData(url: string) {
  if (cache.has(url)) {
    return cache.get(url);
  }
  
  const browser = new PlayClone();
  await browser.navigate(url);
  const data = await browser.getText('main content');
  cache.set(url, data);
  
  return data;
}
```

### 3. Parallel Execution

```typescript
// Execute multiple operations in parallel
async function gatherData(urls: string[]) {
  const browsers = urls.map(() => new PlayClone());
  
  const results = await Promise.all(
    urls.map((url, i) => 
      browsers[i].navigate(url)
        .then(() => browsers[i].getText('content'))
    )
  );
  
  // Clean up
  await Promise.all(browsers.map(b => b.close()));
  
  return results;
}
```

## Security Considerations

### 1. Input Validation

```typescript
// Always validate user input before browser actions
function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
```

### 2. Sandbox Execution

```typescript
// Run in isolated context
const browser = new PlayClone({
  sandbox: true,
  permissions: ['navigate', 'click', 'read'], // No write/execute
  blockedDomains: ['internal.company.com']
});
```

### 3. Rate Limiting

```typescript
// Implement rate limiting for AI requests
class RateLimitedBrowser {
  private lastRequest = 0;
  private minInterval = 1000; // 1 second between requests
  
  async execute(action: string, ...args: any[]) {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    
    if (elapsed < this.minInterval) {
      await sleep(this.minInterval - elapsed);
    }
    
    this.lastRequest = Date.now();
    return await this.browser[action](...args);
  }
}
```

## Example: Complete AI Assistant Integration

```typescript
import { PlayClone } from 'playclone';

class WebAutomationAssistant {
  private browser: PlayClone;
  
  constructor() {
    this.browser = new PlayClone({
      headless: true,
      responseFormat: 'minimal',
      autoWait: true,
      naturalLanguage: true,
      persistent: true,
      sessionId: 'ai-assistant'
    });
  }
  
  async processUserRequest(request: string): Promise<string> {
    try {
      // Parse intent from natural language
      const intent = this.parseIntent(request);
      
      // Execute appropriate action
      switch (intent.action) {
        case 'navigate':
          const navResult = await this.browser.navigate(intent.url);
          return `Navigated to ${intent.url}`;
          
        case 'search':
          await this.browser.fill('search box', intent.query);
          await this.browser.click('search button');
          const results = await this.browser.getText('search results');
          return `Found: ${results}`;
          
        case 'extract':
          const data = await this.browser.extractData(intent.fields);
          return JSON.stringify(data, null, 2);
          
        case 'fill_form':
          for (const [field, value] of Object.entries(intent.data)) {
            await this.browser.fill(field, value);
          }
          await this.browser.click('submit');
          return 'Form submitted successfully';
          
        default:
          return 'I don\'t understand that request';
      }
    } catch (error) {
      // Return AI-friendly error message
      return `Error: ${error.message}. Suggestions: ${error.suggestions?.join(', ')}`;
    }
  }
  
  private parseIntent(request: string): any {
    // Natural language processing logic here
    // This is a simplified example
    if (request.includes('go to') || request.includes('open')) {
      const url = request.match(/https?:\/\/[^\s]+/)?.[0];
      return { action: 'navigate', url };
    }
    
    if (request.includes('search for')) {
      const query = request.replace(/.*search for/, '').trim();
      return { action: 'search', query };
    }
    
    if (request.includes('extract') || request.includes('get')) {
      return { action: 'extract', fields: ['title', 'content', 'links'] };
    }
    
    if (request.includes('fill') || request.includes('submit')) {
      // Parse form data from request
      return { action: 'fill_form', data: {} };
    }
    
    return { action: 'unknown' };
  }
  
  async cleanup() {
    await this.browser.close();
  }
}

// Usage
const assistant = new WebAutomationAssistant();
const response = await assistant.processUserRequest('Go to https://example.com and search for AI tools');
console.log(response);
```

## Migration from Other Tools

### From Playwright

```typescript
// Playwright style
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com');
await page.click('#button');

// PlayClone style (AI-optimized)
const browser = new PlayClone();
await browser.navigate('https://example.com');
await browser.click('button');
```

### From Puppeteer

```typescript
// Puppeteer style
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://example.com');
await page.type('#input', 'text');

// PlayClone style
const browser = new PlayClone();
await browser.navigate('https://example.com');
await browser.fill('input field', 'text');
```

### From Selenium

```typescript
// Selenium style
const driver = await new Builder().forBrowser('chrome').build();
await driver.get('https://example.com');
await driver.findElement(By.id('button')).click();

// PlayClone style
const browser = new PlayClone();
await browser.navigate('https://example.com');
await browser.click('button');
```

## Support and Resources

- **Documentation**: https://github.com/playclone/docs
- **Examples**: See `/examples` directory
- **API Reference**: See `API_REFERENCE.md`
- **Issues**: https://github.com/playclone/issues

## Conclusion

PlayClone is designed from the ground up for AI integration, providing:
- Natural language element selection
- Token-optimized responses
- Automatic error recovery
- Stateful session management
- AI-friendly error messages

By following the patterns and best practices in this guide, you can build powerful AI assistants that interact with the web naturally and efficiently.