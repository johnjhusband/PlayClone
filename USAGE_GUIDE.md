# PlayClone Usage Guide

## Introduction

PlayClone is designed to make browser automation intuitive for AI assistants. Instead of writing code with CSS selectors and complex logic, you describe what you want to do in natural language.

## Getting Started

### Installation

```bash
npm install playclone
```

### Your First Script

```typescript
import { PlayClone } from 'playclone';

async function main() {
  // Create a browser instance
  const pc = new PlayClone({ headless: false });
  
  // Navigate to a website
  await pc.navigate('https://example.com');
  
  // Click on something
  await pc.click('more information link');
  
  // Extract some text
  const heading = await pc.getText('main heading');
  console.log('Page heading:', heading.data);
  
  // Clean up
  await pc.close();
}

main();
```

## Natural Language Commands

### How to Describe Elements

PlayClone understands elements the way humans describe them:

#### Good Descriptions ✅
- `"blue login button"`
- `"search box in header"`
- `"first item in list"`
- `"submit button at bottom"`
- `"email field"`
- `"terms and conditions checkbox"`

#### Avoid Technical Selectors ❌
- `"#submit-btn"`
- `"div.header > input"`
- `"button[type='submit']"`
- `"[data-testid='login']"`

### Element Description Patterns

PlayClone recognizes common patterns:

```typescript
// By text content
await pc.click('Sign In');
await pc.click('Contact Us');

// By appearance
await pc.click('large green button');
await pc.click('red error message');

// By position
await pc.click('first link in navigation');
await pc.click('last item in dropdown');

// By context
await pc.fill('email in registration form', 'test@example.com');
await pc.click('submit button in footer');

// By role/type
await pc.fill('search box', 'PlayClone');
await pc.check('newsletter checkbox');
await pc.select('country dropdown', 'Canada');
```

## Common Automation Scenarios

### 1. Login Flow

```typescript
async function login(pc, username, password) {
  await pc.navigate('https://app.example.com/login');
  await pc.fill('username or email', username);
  await pc.fill('password field', password);
  await pc.check('remember me');
  await pc.click('sign in button');
  
  // Wait for login to complete
  await pc.waitFor('dashboard to load');
  
  // Verify success
  const state = await pc.getState();
  if (state?.url.includes('/dashboard')) {
    console.log('Login successful!');
    return true;
  }
  return false;
}
```

### 2. Search and Navigate Results

```typescript
async function searchProduct(pc, query) {
  // Perform search
  await pc.fill('search box', query);
  await pc.press('Enter');
  
  // Wait for results
  await pc.waitFor('search results to load');
  
  // Extract results
  const results = await pc.getLinks('product');
  console.log(`Found ${results.data.length} products`);
  
  // Click first result
  if (results.data.length > 0) {
    await pc.click('first product in results');
  }
}
```

### 3. Fill Complex Form

```typescript
async function fillApplicationForm(pc, data) {
  await pc.navigate('https://example.com/apply');
  
  // Personal Information
  await pc.fill('first name', data.firstName);
  await pc.fill('last name', data.lastName);
  await pc.fill('email address', data.email);
  await pc.fill('phone number', data.phone);
  
  // Address
  await pc.fill('street address', data.address);
  await pc.fill('city', data.city);
  await pc.select('state dropdown', data.state);
  await pc.fill('zip code', data.zipCode);
  
  // Preferences
  await pc.select('preferred contact method', 'Email');
  await pc.check('agree to terms');
  
  // Submit
  await pc.click('submit application');
  
  // Handle confirmation
  await pc.waitFor('confirmation message');
  const confirmText = await pc.getText('confirmation');
  return confirmText.data;
}
```

### 4. Data Extraction

```typescript
async function scrapeProductInfo(pc, productUrl) {
  await pc.navigate(productUrl);
  
  // Extract various data points
  const title = await pc.getText('product title');
  const price = await pc.getText('price');
  const description = await pc.getText('product description');
  const specs = await pc.getTable('specifications table');
  
  // Take screenshot for reference
  const screenshot = await pc.screenshot({ fullPage: true });
  
  return {
    title: title.data,
    price: price.data,
    description: description.data,
    specifications: specs.data,
    screenshot: screenshot.data
  };
}
```

### 5. Multi-Page Workflow

```typescript
async function completePurchase(pc, product, paymentInfo) {
  // Search for product
  await pc.navigate('https://shop.example.com');
  await pc.fill('search', product);
  await pc.press('Enter');
  
  // Select product
  await pc.click('first product');
  await pc.click('add to cart');
  
  // Go to checkout
  await pc.click('shopping cart icon');
  await pc.click('proceed to checkout');
  
  // Fill shipping info
  await pc.fill('shipping address', paymentInfo.address);
  await pc.fill('city', paymentInfo.city);
  await pc.fill('zip', paymentInfo.zip);
  
  // Fill payment info
  await pc.fill('card number', paymentInfo.cardNumber);
  await pc.fill('expiry date', paymentInfo.expiry);
  await pc.fill('cvv', paymentInfo.cvv);
  
  // Complete purchase
  await pc.click('place order');
  await pc.waitFor('order confirmation');
  
  // Get order number
  const orderInfo = await pc.getText('order number');
  return orderInfo.data;
}
```

## State Management

### Using Checkpoints

Save and restore browser states to speed up repetitive tasks:

```typescript
async function setupTestEnvironment(pc) {
  // Do initial setup once
  await pc.navigate('https://app.example.com');
  await pc.fill('username', 'testuser');
  await pc.fill('password', 'testpass');
  await pc.click('login');
  await pc.waitFor('dashboard');
  
  // Save this state
  await pc.saveState('logged-in-state');
  
  // Now you can quickly return to this state
  await pc.navigate('https://google.com'); // Go somewhere else
  await pc.restoreState('logged-in-state'); // Back to logged-in dashboard
}
```

### Session Persistence

PlayClone can maintain sessions across multiple operations:

```typescript
const pc = new PlayClone({ headless: false });

// First operation
await pc.navigate('https://example.com');
await pc.saveState('session-1');

// ... later in your code ...

// Resume from saved session
await pc.restoreState('session-1');
// Continue where you left off
```

## Error Handling

### Graceful Failure Handling

```typescript
async function safeClick(pc, description) {
  const result = await pc.click(description);
  
  if (!result.success) {
    console.log(`Failed to click: ${result.error}`);
    
    // Try suggestions if available
    if (result.suggestions && result.suggestions.length > 0) {
      console.log('Suggestions:', result.suggestions);
      
      // Maybe try a different approach
      await pc.waitFor('page to fully load', 5000);
      return await pc.click(description); // Retry
    }
  }
  
  return result;
}
```

### Timeout Management

```typescript
async function waitForElement(pc, description, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await pc.waitFor(description, 10000);
      if (result.success) return result;
    } catch (error) {
      console.log(`Attempt ${i + 1} failed, retrying...`);
      await pc.reload(); // Try refreshing
    }
  }
  throw new Error(`Element not found after ${maxAttempts} attempts`);
}
```

## Performance Optimization

### 1. Reuse Browser Instances

```typescript
const pc = new PlayClone({ headless: true });

// Perform multiple operations with same instance
for (const url of urls) {
  await pc.navigate(url);
  // ... do work ...
}

// Close when completely done
await pc.close();
```

### 2. Use Headless Mode for Speed

```typescript
// Headless is faster for automation
const pc = new PlayClone({ 
  headless: true,  // No UI = faster
  viewport: { width: 1280, height: 720 }
});
```

### 3. Batch Operations

```typescript
async function extractMultiplePages(pc, urls) {
  const results = [];
  
  for (const url of urls) {
    await pc.navigate(url);
    
    // Extract multiple items at once
    const [title, price, description] = await Promise.all([
      pc.getText('product title'),
      pc.getText('price'),
      pc.getText('description')
    ]);
    
    results.push({ url, title, price, description });
  }
  
  return results;
}
```

## Debugging Tips

### 1. Use Visible Mode for Debugging

```typescript
// See what's happening
const pc = new PlayClone({ 
  headless: false,  // Show browser
  slowMo: 500      // Slow down actions
});
```

### 2. Take Screenshots on Failure

```typescript
async function debugAction(pc, action) {
  const result = await action();
  
  if (!result.success) {
    // Take screenshot to see what went wrong
    const screenshot = await pc.screenshot({ 
      path: `error-${Date.now()}.png` 
    });
    console.log('Screenshot saved:', screenshot);
  }
  
  return result;
}
```

### 3. Log State Changes

```typescript
async function trackStateChanges(pc) {
  const initialState = await pc.getState();
  console.log('Initial:', initialState?.url);
  
  await pc.click('some button');
  
  const newState = await pc.getState();
  console.log('After click:', newState?.url);
  console.log('Page changed:', initialState?.url !== newState?.url);
}
```

## Advanced Techniques

### Dynamic Content Handling

```typescript
async function handleDynamicContent(pc) {
  await pc.navigate('https://spa-app.example.com');
  
  // Wait for SPA to load
  await pc.waitFor('main content to appear');
  
  // Trigger lazy-loaded content
  await pc.execute('window.scrollTo(0, document.body.scrollHeight)');
  await pc.waitFor('lazy loaded items');
  
  // Now extract
  const items = await pc.getLinks('product');
  return items;
}
```

### Custom JavaScript Execution

```typescript
async function customInteraction(pc) {
  // Execute custom JavaScript
  const result = await pc.execute(`
    // Get all button texts
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.map(b => b.textContent);
  `);
  
  console.log('All buttons:', result.data);
  
  // Interact with page via JS
  await pc.execute(`
    document.querySelector('.modal').style.display = 'none';
  `);
}
```

### Handling Popups and Dialogs

```typescript
async function handlePopups(pc) {
  // Navigate might trigger popup
  await pc.navigate('https://example.com');
  
  // Check for common popups
  const hasPopup = await pc.execute(`
    document.querySelector('.popup-overlay') !== null
  `);
  
  if (hasPopup.data) {
    // Close popup
    await pc.click('close button');
    // or
    await pc.press('Escape');
  }
  
  // Continue with main task
  await pc.click('main navigation');
}
```

## Best Practices

### 1. Always Clean Up

```typescript
const pc = new PlayClone();
try {
  // Your automation code
  await pc.navigate('https://example.com');
  // ...
} finally {
  await pc.close(); // Always close
}
```

### 2. Check Success Before Proceeding

```typescript
const navResult = await pc.navigate('https://example.com');
if (!navResult.success) {
  throw new Error(`Navigation failed: ${navResult.error}`);
}

const clickResult = await pc.click('important button');
if (!clickResult.success) {
  // Handle failure appropriately
  console.warn('Button not found, trying alternative...');
  await pc.click('alternative button');
}
```

### 3. Use Descriptive Names

```typescript
// Good
await pc.click('blue submit button at bottom of form');
await pc.fill('email field in newsletter signup', 'test@example.com');

// Less clear
await pc.click('button');
await pc.fill('input', 'test@example.com');
```

### 4. Handle Network Issues

```typescript
async function robustNavigate(pc, url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const result = await pc.navigate(url);
    if (result.success) return result;
    
    console.log(`Navigation attempt ${i + 1} failed, retrying...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`Failed to navigate to ${url} after ${retries} attempts`);
}
```

## Troubleshooting

### Common Issues and Solutions

#### Element Not Found
```typescript
// Problem: Element not found
const result = await pc.click('submit');

// Solution 1: Be more specific
await pc.click('green submit button');

// Solution 2: Wait for element
await pc.waitFor('submit button to appear');
await pc.click('submit button');

// Solution 3: Use different description
await pc.click('form submit button at bottom');
```

#### Timing Issues
```typescript
// Problem: Action happens too fast
await pc.click('load more');
await pc.getText('new items'); // Might fail

// Solution: Add wait
await pc.click('load more');
await pc.waitFor('new items to load');
await pc.getText('new items');
```

#### Dynamic Content
```typescript
// Problem: Content loads dynamically
await pc.navigate('https://spa-app.com');
await pc.click('menu'); // Might fail if not loaded

// Solution: Wait for app to initialize
await pc.navigate('https://spa-app.com');
await pc.waitFor('application to load');
await pc.click('menu');
```

## AI Integration Tips

When using PlayClone with AI assistants:

### 1. Keep Responses Concise
PlayClone returns AI-optimized responses under 1KB. Use this efficiently:

```typescript
const result = await pc.click('login');
// Returns only essential info:
// { success: true, action: 'click', target: 'login', timestamp: ... }
```

### 2. Chain Actions Naturally
```typescript
// AI can chain actions based on responses
const loginResult = await pc.click('login');
if (loginResult.success && loginResult.state?.url.includes('/dashboard')) {
  // Successfully logged in, continue
  await pc.click('profile settings');
}
```

### 3. Use Suggestions
```typescript
const result = await pc.click('non-existent button');
if (!result.success && result.suggestions) {
  // AI can try suggestions
  for (const suggestion of result.suggestions) {
    const retry = await pc.click(suggestion);
    if (retry.success) break;
  }
}
```

## Support and Resources

- **API Reference**: See [API_REFERENCE.md](./API_REFERENCE.md)
- **GitHub Issues**: https://github.com/johnjhusband/PlayClone/issues
- **Examples**: Check the `/examples` directory
- **Tests**: See `/tests` for more usage patterns

Remember: PlayClone is designed to make browser automation feel natural. Describe what you want to do as you would explain it to a human, and PlayClone will handle the technical details!