# AI Assistant Best Practices Guide for PlayClone

## Overview

This guide provides comprehensive best practices for AI assistants using PlayClone for browser automation. Following these practices will ensure efficient, reliable, and token-optimized automation workflows.

## Table of Contents

1. [Session Management](#session-management)
2. [Natural Language Selectors](#natural-language-selectors)
3. [Token Optimization](#token-optimization)
4. [Error Handling](#error-handling)
5. [Performance Optimization](#performance-optimization)
6. [Common Patterns](#common-patterns)
7. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
8. [Real-World Examples](#real-world-examples)

## Session Management

### Best Practice: Reuse Browser Sessions

Always reuse existing browser sessions instead of creating new ones for each operation:

```javascript
// ✅ GOOD: Reuse session
const sessionId = 'assistant-session-1';
await playclone.navigate('https://example.com', sessionId);
await playclone.click('login button', sessionId);
await playclone.fill('username field', 'user@example.com', sessionId);

// ❌ BAD: Creating new sessions repeatedly
await playclone.navigate('https://example.com'); // Creates new session
await playclone.click('login button'); // Creates another new session
```

### Best Practice: Use Meaningful Session IDs

Create descriptive session IDs that indicate the task or context:

```javascript
// ✅ GOOD: Descriptive session IDs
const sessionId = 'github-repo-analysis-2025-01-02';
const sessionId = 'user-shopping-cart-workflow';
const sessionId = 'documentation-extraction-mdn';

// ❌ BAD: Generic or random IDs
const sessionId = 'session1';
const sessionId = '12345';
```

### Best Practice: Close Sessions When Complete

Always close browser sessions after completing workflows to free resources:

```javascript
// ✅ GOOD: Proper cleanup
try {
  const sessionId = 'data-extraction-task';
  await playclone.navigate('https://example.com', sessionId);
  const data = await playclone.getText('main content', sessionId);
  // Process data...
} finally {
  await playclone.close(sessionId);
}
```

## Natural Language Selectors

### Best Practice: Be Specific but Flexible

Use descriptive selectors that are specific enough to identify elements but flexible enough to handle variations:

```javascript
// ✅ GOOD: Specific but flexible
await playclone.click('blue login button');
await playclone.click('submit button in contact form');
await playclone.fill('email input field', 'user@example.com');
await playclone.click('first search result link');

// ❌ BAD: Too vague or too specific
await playclone.click('button'); // Too vague
await playclone.click('Button#login-btn-primary-blue-large'); // Too specific
```

### Best Practice: Use Context Clues

Include contextual information to help identify elements:

```javascript
// ✅ GOOD: Context-aware selectors
await playclone.click('add to cart button for iPhone 15');
await playclone.fill('search box in header', 'typescript tutorial');
await playclone.click('next button in pagination');

// ❌ BAD: No context
await playclone.click('add button');
await playclone.fill('input', 'typescript');
```

### Best Practice: Leverage Common UI Patterns

Use standard UI terminology that PlayClone understands:

```javascript
// ✅ GOOD: Standard UI terms
await playclone.click('hamburger menu');
await playclone.click('dropdown arrow');
await playclone.fill('search bar', 'query');
await playclone.click('close modal button');
await playclone.select('country dropdown', 'United States');
```

## Token Optimization

### Best Practice: Request Only What You Need

Be selective about data extraction to minimize token usage:

```javascript
// ✅ GOOD: Targeted extraction
const price = await playclone.getText('product price');
const title = await playclone.getText('article heading');

// ❌ BAD: Extracting everything
const allText = await playclone.getText(); // Gets entire page
```

### Best Practice: Use Structured Data Methods

Use specialized methods for structured data instead of raw text:

```javascript
// ✅ GOOD: Structured extraction
const links = await playclone.getLinks('navigation menu');
const tableData = await playclone.getTable('pricing table');
const formData = await playclone.getFormData('signup form');

// ❌ BAD: Parsing text manually
const text = await playclone.getText();
// Then parsing links/tables from text...
```

### Best Practice: Batch Operations

Combine multiple operations when possible:

```javascript
// ✅ GOOD: Batched form filling
const formData = {
  username: 'john_doe',
  email: 'john@example.com',
  password: 'secure123'
};
await playclone.fillForm('registration form', formData);

// ❌ BAD: Individual field operations
await playclone.fill('username field', 'john_doe');
await playclone.fill('email field', 'john@example.com');
await playclone.fill('password field', 'secure123');
```

## Error Handling

### Best Practice: Implement Graceful Fallbacks

Always have fallback strategies for element selection:

```javascript
// ✅ GOOD: Multiple attempts with fallbacks
try {
  await playclone.click('sign in button');
} catch (error) {
  // Try alternative selector
  try {
    await playclone.click('login link in header');
  } catch (fallbackError) {
    // Last resort
    await playclone.navigate('/login');
  }
}
```

### Best Practice: Use Appropriate Timeouts

Adjust timeouts based on expected page complexity:

```javascript
// ✅ GOOD: Context-appropriate timeouts
// Fast for simple sites
await playclone.navigate('https://example.com', sessionId, { timeout: 5000 });

// Longer for complex SPAs
await playclone.navigate('https://app.complex.com', sessionId, { timeout: 30000 });

// Patient for slow-loading content
await playclone.waitFor('dashboard data', sessionId, { timeout: 60000 });
```

### Best Practice: Handle Dynamic Content

Account for dynamically loaded content:

```javascript
// ✅ GOOD: Wait for dynamic content
await playclone.navigate('https://spa-app.com');
await playclone.waitFor('main content loaded');
const data = await playclone.getText('dynamic content area');

// ❌ BAD: Immediate extraction
await playclone.navigate('https://spa-app.com');
const data = await playclone.getText('content'); // May fail if not loaded
```

## Performance Optimization

### Best Practice: Use Browser Pre-warming

For repeated tasks, use pre-warmed browser instances:

```javascript
// ✅ GOOD: Pre-warm for multiple searches
const sessionId = 'search-session';
await playclone.prewarm(sessionId); // Pre-warm browser

// Now searches are faster
for (const query of queries) {
  await playclone.navigate('https://google.com', sessionId);
  await playclone.fill('search input', query, sessionId);
  await playclone.press('Enter', sessionId);
  // Extract results...
}
```

### Best Practice: Enable Response Caching

Cache frequently accessed data:

```javascript
// ✅ GOOD: Cache static content
const config = { cacheResponses: true, cacheDuration: 3600000 }; // 1 hour
const sessionId = 'docs-reader';

// First access caches the response
const intro = await playclone.getText('introduction', sessionId, config);

// Subsequent accesses use cache
const intro2 = await playclone.getText('introduction', sessionId, config); // From cache
```

### Best Practice: Use Headless Mode for Production

Run in headless mode for better performance in production:

```javascript
// ✅ GOOD: Production configuration
const productionConfig = {
  headless: true,
  viewport: { width: 1280, height: 720 },
  userAgent: 'PlayClone/1.0 (AI Assistant)'
};

// Development/debugging configuration
const debugConfig = {
  headless: false, // See what's happening
  slowMo: 500 // Slow down for debugging
};
```

## Common Patterns

### Pattern: Login Flow

```javascript
async function loginToService(url, username, password, sessionId) {
  // Navigate to login page
  await playclone.navigate(url, sessionId);
  
  // Check if already logged in
  try {
    await playclone.waitFor('dashboard', sessionId, { timeout: 3000 });
    return { success: true, message: 'Already logged in' };
  } catch {
    // Not logged in, proceed with login
  }
  
  // Fill login form
  await playclone.fill('username or email field', username, sessionId);
  await playclone.fill('password field', password, sessionId);
  
  // Submit
  await playclone.click('login or sign in button', sessionId);
  
  // Wait for redirect
  await playclone.waitFor('dashboard or home page', sessionId);
  
  return { success: true, message: 'Login successful' };
}
```

### Pattern: Search and Extract

```javascript
async function searchAndExtract(searchEngine, query, sessionId) {
  // Navigate to search engine
  const searchUrls = {
    google: 'https://google.com',
    duckduckgo: 'https://duckduckgo.com',
    bing: 'https://bing.com'
  };
  
  await playclone.navigate(searchUrls[searchEngine], sessionId);
  
  // Perform search
  await playclone.fill('search input or search box', query, sessionId);
  await playclone.press('Enter', sessionId);
  
  // Wait for results
  await playclone.waitFor('search results', sessionId);
  
  // Extract top results
  const results = await playclone.getLinks('search result links', sessionId);
  
  return results.slice(0, 10); // Top 10 results
}
```

### Pattern: Form Submission with Validation

```javascript
async function submitFormWithValidation(formData, sessionId) {
  // Fill form fields
  for (const [field, value] of Object.entries(formData)) {
    await playclone.fill(`${field} input field`, value, sessionId);
  }
  
  // Check for validation errors before submit
  const errors = await playclone.getText('error messages', sessionId);
  if (errors.data && errors.data.length > 0) {
    return { success: false, errors: errors.data };
  }
  
  // Submit form
  await playclone.click('submit button', sessionId);
  
  // Wait for response
  try {
    await playclone.waitFor('success message or confirmation', sessionId);
    return { success: true };
  } catch {
    const errorMsg = await playclone.getText('error message', sessionId);
    return { success: false, error: errorMsg.data };
  }
}
```

### Pattern: Pagination Handling

```javascript
async function extractAllPages(url, sessionId) {
  const allData = [];
  await playclone.navigate(url, sessionId);
  
  while (true) {
    // Extract current page data
    const pageData = await playclone.getText('main content', sessionId);
    allData.push(pageData.data);
    
    // Check for next page
    try {
      await playclone.click('next page button or next link', sessionId);
      await playclone.waitFor('content loaded', sessionId);
    } catch {
      // No more pages
      break;
    }
  }
  
  return allData;
}
```

## Anti-Patterns to Avoid

### Anti-Pattern: Creating Sessions in Loops

```javascript
// ❌ BAD: Creates many browser instances
for (const url of urls) {
  const data = await playclone.navigate(url); // New session each time
  // Process data...
}

// ✅ GOOD: Reuse single session
const sessionId = 'batch-processing';
for (const url of urls) {
  await playclone.navigate(url, sessionId);
  // Process data...
}
await playclone.close(sessionId);
```

### Anti-Pattern: Ignoring Async Nature

```javascript
// ❌ BAD: Not waiting for operations
playclone.navigate('https://example.com');
playclone.click('button'); // May fail - page not loaded

// ✅ GOOD: Proper async handling
await playclone.navigate('https://example.com');
await playclone.click('button');
```

### Anti-Pattern: Over-Specific Selectors

```javascript
// ❌ BAD: Brittle selectors
await playclone.click('div.container > div.row:nth-child(3) > button.btn-primary');

// ✅ GOOD: Semantic selectors
await playclone.click('submit button in contact form');
```

### Anti-Pattern: No Error Boundaries

```javascript
// ❌ BAD: No error handling
const data = await playclone.getText('content');
processData(data); // Crashes if extraction failed

// ✅ GOOD: Defensive programming
try {
  const data = await playclone.getText('content');
  if (data.success && data.data) {
    processData(data.data);
  } else {
    handleMissingData();
  }
} catch (error) {
  logError(error);
  return fallbackResponse();
}
```

## Real-World Examples

### Example: GitHub Repository Analysis

```javascript
async function analyzeGitHubRepo(repoUrl, sessionId = 'github-analysis') {
  try {
    // Navigate to repository
    await playclone.navigate(repoUrl, sessionId);
    
    // Extract repository metadata
    const stats = {
      name: await playclone.getText('repository name', sessionId),
      description: await playclone.getText('repository description', sessionId),
      stars: await playclone.getText('star count', sessionId),
      forks: await playclone.getText('fork count', sessionId),
      language: await playclone.getText('primary language', sessionId)
    };
    
    // Get recent commits
    await playclone.click('commits link', sessionId);
    await playclone.waitFor('commit list', sessionId);
    const commits = await playclone.getText('recent commit messages', sessionId);
    
    // Get README content
    await playclone.click('code tab', sessionId);
    const readme = await playclone.getText('readme content', sessionId);
    
    return {
      success: true,
      repository: stats,
      recentCommits: commits.data,
      readme: readme.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  } finally {
    await playclone.close(sessionId);
  }
}
```

### Example: E-commerce Price Monitoring

```javascript
async function monitorProductPrice(productUrl, targetPrice, sessionId = 'price-monitor') {
  try {
    await playclone.navigate(productUrl, sessionId);
    
    // Wait for price to load (dynamic content)
    await playclone.waitFor('product price', sessionId);
    
    // Extract price
    const priceText = await playclone.getText('product price', sessionId);
    const price = parseFloat(priceText.data.replace(/[^0-9.]/g, ''));
    
    // Check availability
    const availability = await playclone.getText('availability status', sessionId);
    const inStock = !availability.data.toLowerCase().includes('out of stock');
    
    // Check if we should notify
    const shouldNotify = inStock && price <= targetPrice;
    
    return {
      success: true,
      currentPrice: price,
      targetPrice: targetPrice,
      inStock: inStock,
      shouldNotify: shouldNotify,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

### Example: Documentation Extraction

```javascript
async function extractAPIDocs(docsUrl, apiName, sessionId = 'docs-extraction') {
  try {
    await playclone.navigate(docsUrl, sessionId);
    
    // Search for API
    await playclone.fill('search documentation input', apiName, sessionId);
    await playclone.press('Enter', sessionId);
    
    // Click first result
    await playclone.waitFor('search results', sessionId);
    await playclone.click('first search result link', sessionId);
    
    // Extract API documentation
    const apiDocs = {
      title: await playclone.getText('api title or heading', sessionId),
      description: await playclone.getText('api description', sessionId),
      parameters: await playclone.getTable('parameters table', sessionId),
      examples: await playclone.getText('code examples', sessionId),
      returnValue: await playclone.getText('return value section', sessionId)
    };
    
    return {
      success: true,
      api: apiName,
      documentation: apiDocs
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      suggestion: 'Try browsing documentation manually or check API name'
    };
  } finally {
    await playclone.close(sessionId);
  }
}
```

### Example: Multi-Step Workflow with State Management

```javascript
async function complexCheckoutFlow(items, paymentInfo, sessionId = 'checkout-flow') {
  const checkpoints = [];
  
  try {
    // Step 1: Add items to cart
    await playclone.navigate('https://shop.example.com', sessionId);
    for (const item of items) {
      await playclone.navigate(item.url, sessionId);
      await playclone.select('quantity dropdown', item.quantity, sessionId);
      await playclone.click('add to cart button', sessionId);
    }
    checkpoints.push(await playclone.saveState(sessionId));
    
    // Step 2: Go to checkout
    await playclone.click('cart icon', sessionId);
    await playclone.click('proceed to checkout button', sessionId);
    checkpoints.push(await playclone.saveState(sessionId));
    
    // Step 3: Fill shipping information
    await playclone.fill('shipping address', paymentInfo.address, sessionId);
    await playclone.fill('city', paymentInfo.city, sessionId);
    await playclone.select('state dropdown', paymentInfo.state, sessionId);
    await playclone.fill('zip code', paymentInfo.zip, sessionId);
    checkpoints.push(await playclone.saveState(sessionId));
    
    // Step 4: Payment information
    await playclone.fill('card number', paymentInfo.cardNumber, sessionId);
    await playclone.fill('expiry date', paymentInfo.expiry, sessionId);
    await playclone.fill('cvv', paymentInfo.cvv, sessionId);
    
    // Step 5: Review and confirm
    const orderSummary = await playclone.getText('order summary', sessionId);
    
    return {
      success: true,
      orderSummary: orderSummary.data,
      checkpoints: checkpoints // Can restore to any step if needed
    };
    
  } catch (error) {
    // Restore to last successful checkpoint
    if (checkpoints.length > 0) {
      await playclone.restoreState(checkpoints[checkpoints.length - 1], sessionId);
    }
    
    return {
      success: false,
      error: error.message,
      lastSuccessfulStep: checkpoints.length
    };
  }
}
```

## Tips for AI Assistant Developers

### 1. Session Management Strategy

For AI assistants handling multiple user requests:

```javascript
class BrowserSessionManager {
  constructor(maxSessions = 5) {
    this.sessions = new Map();
    this.maxSessions = maxSessions;
  }
  
  async getSession(userId, taskType) {
    const sessionId = `${userId}-${taskType}`;
    
    if (!this.sessions.has(sessionId)) {
      if (this.sessions.size >= this.maxSessions) {
        // Close oldest session
        const oldest = this.sessions.keys().next().value;
        await playclone.close(oldest);
        this.sessions.delete(oldest);
      }
      
      this.sessions.set(sessionId, {
        created: Date.now(),
        lastUsed: Date.now()
      });
    }
    
    this.sessions.get(sessionId).lastUsed = Date.now();
    return sessionId;
  }
  
  async cleanup() {
    const timeout = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();
    
    for (const [sessionId, info] of this.sessions) {
      if (now - info.lastUsed > timeout) {
        await playclone.close(sessionId);
        this.sessions.delete(sessionId);
      }
    }
  }
}
```

### 2. Response Formatting for Users

Format PlayClone responses for human readability:

```javascript
function formatResponseForUser(response) {
  if (!response.success) {
    return `❌ Operation failed: ${response.error}\n💡 Suggestion: ${response.suggestion || 'Try again or use a different approach'}`;
  }
  
  if (response.data) {
    if (typeof response.data === 'string') {
      // Truncate long text for readability
      return response.data.length > 500 
        ? `${response.data.substring(0, 500)}...\n\n[Truncated - ${response.data.length} total characters]`
        : response.data;
    } else if (Array.isArray(response.data)) {
      // Format arrays nicely
      return response.data.map((item, i) => `${i + 1}. ${item}`).join('\n');
    } else if (typeof response.data === 'object') {
      // Format objects as key-value pairs
      return Object.entries(response.data)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
    }
  }
  
  return '✅ Operation completed successfully';
}
```

### 3. Intelligent Retry Logic

Implement smart retries for transient failures:

```javascript
async function withRetry(operation, maxRetries = 3) {
  const delays = [1000, 3000, 7000]; // Exponential backoff
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      if (result.success) return result;
      
      // Don't retry certain errors
      if (result.error?.includes('Invalid URL') || 
          result.error?.includes('Permission denied')) {
        return result;
      }
      
      // Retry for transient errors
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        continue;
      }
      
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          success: false,
          error: error.message,
          attempts: attempt + 1
        };
      }
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }
}

// Usage
const result = await withRetry(async () => 
  await playclone.click('dynamic button', sessionId)
);
```

## Conclusion

By following these best practices, AI assistants can leverage PlayClone effectively for reliable, efficient browser automation. Remember to:

1. **Optimize for tokens** - Keep responses small and request only necessary data
2. **Handle errors gracefully** - Always have fallback strategies
3. **Reuse sessions** - Don't create unnecessary browser instances
4. **Use semantic selectors** - Leverage natural language for maintainability
5. **Test thoroughly** - Verify your automation workflows work across different scenarios

For more examples and updates, refer to the [PlayClone GitHub repository](https://github.com/example/playclone) and the comprehensive test suite in the `/tests` directory.