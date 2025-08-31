# PlayClone API Documentation

## Table of Contents
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Classes](#core-classes)
- [Browser Operations](#browser-operations)
- [Element Selection](#element-selection)
- [Actions](#actions)
- [Data Extraction](#data-extraction)
- [State Management](#state-management)
- [Error Handling](#error-handling)
- [Configuration](#configuration)
- [TypeScript Support](#typescript-support)

## Installation

```bash
npm install playclone
```

## Quick Start

```typescript
import { PlayClone } from 'playclone';

const pc = new PlayClone({ headless: false });
await pc.navigate('https://example.com');
const text = await pc.getText('main heading');
await pc.close();
```

## Core Classes

### PlayClone

The main entry point for browser automation.

```typescript
class PlayClone {
  constructor(options?: PlayCloneOptions)
  navigate(url: string): Promise<AIResponse>
  click(selector: string): Promise<AIResponse>
  fill(selector: string, value: string): Promise<AIResponse>
  getText(selector: string): Promise<AIResponse>
  close(): Promise<void>
}
```

#### Constructor Options

```typescript
interface PlayCloneOptions {
  headless?: boolean;           // Run browser in headless mode (default: true)
  viewport?: {                  // Browser viewport size
    width: number;              // Default: 1280
    height: number;             // Default: 720
  };
  userAgent?: string;           // Custom user agent
  timeout?: number;             // Default timeout in ms (default: 30000)
  browser?: 'chromium' | 'firefox' | 'webkit';  // Browser type (default: 'chromium')
  persistSession?: boolean;     // Persist session data (default: false)
  sessionPath?: string;         // Path for session storage
}
```

## Browser Operations

### Navigation

#### navigate(url: string): Promise<AIResponse>
Navigate to a URL.

```typescript
const result = await pc.navigate('https://example.com');
// Result: { success: true, data: { title: "Example Domain", url: "https://example.com" } }
```

#### back(): Promise<AIResponse>
Navigate back in history.

```typescript
const result = await pc.back();
// Result: { success: true, data: { url: "previous-page.com" } }
```

#### forward(): Promise<AIResponse>
Navigate forward in history.

```typescript
const result = await pc.forward();
// Result: { success: true, data: { url: "next-page.com" } }
```

#### reload(): Promise<AIResponse>
Reload the current page.

```typescript
const result = await pc.reload();
// Result: { success: true, data: { reloaded: true } }
```

#### waitForNavigation(options?: WaitOptions): Promise<AIResponse>
Wait for navigation to complete.

```typescript
const result = await pc.waitForNavigation({ timeout: 5000 });
// Result: { success: true, data: { navigated: true } }
```

## Element Selection

PlayClone supports multiple element selection strategies:

### Natural Language Selectors
Use everyday language to describe elements:

```typescript
await pc.click('blue login button');
await pc.click('first search result');
await pc.click('link containing "Learn More"');
await pc.click('submit button at bottom of form');
```

### CSS Selectors
Standard CSS selectors are supported:

```typescript
await pc.click('#login-btn');
await pc.click('.primary-button');
await pc.click('button[type="submit"]');
```

### Text-Based Selection
Select elements by their text content:

```typescript
await pc.click('text=Sign In');
await pc.click('button with text "Continue"');
await pc.click('link "Privacy Policy"');
```

### Accessibility Selectors
Use ARIA labels and roles:

```typescript
await pc.click('button[aria-label="Close dialog"]');
await pc.click('navigation menu');
await pc.click('[role="button"]');
```

## Actions

### Click Actions

#### click(selector: string): Promise<AIResponse>
Click on an element.

```typescript
const result = await pc.click('login button');
// Result: { success: true, data: { clicked: true, element: "button#login" } }
```

#### doubleClick(selector: string): Promise<AIResponse>
Double-click on an element.

```typescript
const result = await pc.doubleClick('file icon');
// Result: { success: true, data: { doubleClicked: true } }
```

#### rightClick(selector: string): Promise<AIResponse>
Right-click (context menu) on an element.

```typescript
const result = await pc.rightClick('table row');
// Result: { success: true, data: { contextMenu: true } }
```

### Form Interactions

#### fill(selector: string, value: string): Promise<AIResponse>
Fill a text input or textarea.

```typescript
const result = await pc.fill('email field', 'user@example.com');
// Result: { success: true, data: { filled: true, value: "user@example.com" } }
```

#### type(text: string): Promise<AIResponse>
Type text at the current focus.

```typescript
const result = await pc.type('Hello World');
// Result: { success: true, data: { typed: "Hello World" } }
```

#### select(selector: string, value: string): Promise<AIResponse>
Select an option from a dropdown.

```typescript
const result = await pc.select('country dropdown', 'United States');
// Result: { success: true, data: { selected: "United States" } }
```

#### check(selector: string): Promise<AIResponse>
Check a checkbox or radio button.

```typescript
const result = await pc.check('terms checkbox');
// Result: { success: true, data: { checked: true } }
```

#### uncheck(selector: string): Promise<AIResponse>
Uncheck a checkbox.

```typescript
const result = await pc.uncheck('newsletter checkbox');
// Result: { success: true, data: { unchecked: true } }
```

### Keyboard Actions

#### press(key: string): Promise<AIResponse>
Press a keyboard key or combination.

```typescript
await pc.press('Enter');
await pc.press('Control+A');
await pc.press('Shift+Tab');
// Result: { success: true, data: { key: "Enter" } }
```

### Mouse Actions

#### hover(selector: string): Promise<AIResponse>
Hover over an element.

```typescript
const result = await pc.hover('dropdown menu');
// Result: { success: true, data: { hovering: true } }
```

#### focus(selector: string): Promise<AIResponse>
Focus on an element.

```typescript
const result = await pc.focus('search input');
// Result: { success: true, data: { focused: true } }
```

#### blur(): Promise<AIResponse>
Remove focus from the current element.

```typescript
const result = await pc.blur();
// Result: { success: true, data: { blurred: true } }
```

## Data Extraction

### Text Extraction

#### getText(selector: string): Promise<AIResponse>
Get text content from an element.

```typescript
const result = await pc.getText('article heading');
// Result: { success: true, data: "Breaking News: ..." }
```

#### getAllText(): Promise<AIResponse>
Get all visible text on the page.

```typescript
const result = await pc.getAllText();
// Result: { success: true, data: "Full page text content..." }
```

### Structured Data Extraction

#### extractData(options: ExtractOptions): Promise<AIResponse>
Extract structured data from the page.

```typescript
const result = await pc.extractData({
  selector: 'product card',
  fields: ['title', 'price', 'rating', 'availability']
});
// Result: { 
//   success: true, 
//   data: {
//     title: "Product Name",
//     price: "$99.99",
//     rating: "4.5",
//     availability: "In Stock"
//   }
// }
```

#### extractTable(options: TableOptions): Promise<AIResponse>
Extract data from HTML tables.

```typescript
const result = await pc.extractTable({
  selector: 'pricing table',
  columns: ['plan', 'price', 'features']
});
// Result: {
//   success: true,
//   data: [
//     { plan: "Basic", price: "$9", features: "10 GB Storage" },
//     { plan: "Pro", price: "$29", features: "100 GB Storage" }
//   ]
// }
```

#### extractLinks(): Promise<AIResponse>
Extract all links from the page.

```typescript
const result = await pc.extractLinks();
// Result: {
//   success: true,
//   data: [
//     { text: "Home", href: "/", title: "Homepage" },
//     { text: "About", href: "/about", title: "About Us" }
//   ]
// }
```

### Form Data

#### getFormData(selector?: string): Promise<AIResponse>
Get current form field values.

```typescript
const result = await pc.getFormData('registration form');
// Result: {
//   success: true,
//   data: {
//     username: "john_doe",
//     email: "john@example.com",
//     country: "USA"
//   }
// }
```

### Visual Data

#### screenshot(options?: ScreenshotOptions): Promise<AIResponse>
Take a screenshot of the page or element.

```typescript
const result = await pc.screenshot({
  selector: 'chart',
  fullPage: false
});
// Result: { success: true, data: { path: "screenshot.png", size: 45231 } }
```

## State Management

### Save and Restore State

#### saveState(name: string): Promise<AIResponse>
Save the current browser state.

```typescript
const result = await pc.saveState('shopping-cart');
// Result: { success: true, data: { saved: true, checkpoint: "shopping-cart" } }
```

#### restoreState(name: string): Promise<AIResponse>
Restore a previously saved state.

```typescript
const result = await pc.restoreState('shopping-cart');
// Result: { success: true, data: { restored: true, checkpoint: "shopping-cart" } }
```

#### listStates(): Promise<AIResponse>
List all saved states.

```typescript
const result = await pc.listStates();
// Result: {
//   success: true,
//   data: [
//     { name: "shopping-cart", created: "2024-01-01T10:00:00Z" },
//     { name: "logged-in", created: "2024-01-01T09:00:00Z" }
//   ]
// }
```

#### deleteState(name: string): Promise<AIResponse>
Delete a saved state.

```typescript
const result = await pc.deleteState('old-state');
// Result: { success: true, data: { deleted: true } }
```

## Error Handling

PlayClone provides comprehensive error handling:

### Error Types

```typescript
// Element not found
{ 
  success: false, 
  error: "Element not found: 'login button'",
  suggestions: ["Try 'sign in button'", "Check if page is loaded"]
}

// Timeout
{
  success: false,
  error: "Operation timed out after 30000ms",
  context: "Waiting for navigation"
}

// Network error
{
  success: false,
  error: "Failed to navigate: ERR_NAME_NOT_RESOLVED",
  url: "https://invalid-domain.com"
}
```

### Retry Logic

PlayClone automatically retries failed operations with exponential backoff:

```typescript
import { withRetry, RetryStrategies } from 'playclone';

// Use built-in retry strategies
const result = await withRetry(
  () => pc.click('dynamic button'),
  RetryStrategies.AGGRESSIVE
);

// Custom retry configuration
const result = await withRetry(
  () => pc.click('button'),
  {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 10000,
    factor: 2
  }
);
```

### Error Recovery

```typescript
import { withDegradation, DegradationStrategies } from 'playclone';

// Automatic fallback strategies
const result = await withDegradation(
  () => pc.click('primary button'),
  DegradationStrategies.ALTERNATIVE_SELECTORS
);
```

## Utility Functions

### Wait Operations

#### wait(ms: number): Promise<void>
Wait for a specified time.

```typescript
await pc.wait(2000); // Wait 2 seconds
```

#### waitForSelector(selector: string, options?: WaitOptions): Promise<AIResponse>
Wait for an element to appear.

```typescript
const result = await pc.waitForSelector('loading complete message', {
  timeout: 10000,
  visible: true
});
```

#### waitForContent(): Promise<AIResponse>
Wait for dynamic content to stabilize.

```typescript
const result = await pc.waitForContent();
// Waits for network idle, animations, and DOM stability
```

### Page Information

#### getUrl(): Promise<AIResponse>
Get the current page URL.

```typescript
const result = await pc.getUrl();
// Result: { success: true, data: "https://example.com/page" }
```

#### getTitle(): Promise<AIResponse>
Get the page title.

```typescript
const result = await pc.getTitle();
// Result: { success: true, data: "Page Title" }
```

#### elementExists(selector: string): Promise<AIResponse>
Check if an element exists.

```typescript
const result = await pc.elementExists('error message');
// Result: { success: true, data: { exists: false } }
```

#### isVisible(selector: string): Promise<AIResponse>
Check if an element is visible.

```typescript
const result = await pc.isVisible('modal dialog');
// Result: { success: true, data: { visible: true } }
```

## Advanced Features

### Multi-Tab Management

```typescript
// Open new tab
const tab = await pc.newTab();

// Switch between tabs
await pc.switchToTab(tab.id);

// Close tab
await pc.closeTab(tab.id);
```

### Cookie Management

```typescript
// Get cookies
const cookies = await pc.getCookies();

// Set cookie
await pc.setCookie({
  name: 'session',
  value: 'abc123',
  domain: '.example.com'
});

// Clear cookies
await pc.clearCookies();
```

### JavaScript Execution

```typescript
// Execute JavaScript
const result = await pc.evaluate(() => {
  return document.title;
});

// Inject script
await pc.addScriptTag({
  url: 'https://cdn.example.com/script.js'
});
```

## TypeScript Support

PlayClone is written in TypeScript and provides full type definitions:

```typescript
import { PlayClone, AIResponse, PlayCloneOptions } from 'playclone';

// All methods are fully typed
const pc = new PlayClone({
  headless: true,
  viewport: { width: 1920, height: 1080 }
});

// Response types
const result: AIResponse = await pc.click('button');
if (result.success) {
  console.log(result.data); // Type-safe data access
} else {
  console.error(result.error); // Type-safe error access
}
```

## Performance Considerations

### Response Optimization
- All responses are optimized to be under 1KB for AI token efficiency
- Use `verbose: false` option to minimize response size
- Batch operations when possible to reduce round trips

### Memory Management
- Automatic cleanup of browser resources
- Session persistence to avoid repeated logins
- Connection pooling for multiple operations

### Best Practices
1. Always close the browser when done
2. Use specific selectors when possible
3. Handle errors appropriately
4. Save state for complex workflows
5. Use headless mode in production

## Migration from Playwright

If you're migrating from Playwright, here's a comparison:

| Playwright | PlayClone |
|------------|-----------|
| `page.click('#btn')` | `pc.click('button with id btn')` |
| `page.fill('#email', 'test')` | `pc.fill('email field', 'test')` |
| `page.textContent('h1')` | `pc.getText('main heading')` |
| `page.goto('url')` | `pc.navigate('url')` |
| `page.waitForSelector()` | `pc.waitForSelector()` |
| Complex selectors required | Natural language supported |
| Returns raw values | Returns AI-optimized responses |
| Manual retry logic | Built-in retry with backoff |

## Support

For issues, questions, or contributions:
- GitHub: [https://github.com/playclone/playclone](https://github.com/playclone/playclone)
- Documentation: [https://playclone.dev/docs](https://playclone.dev/docs)
- Examples: See `/examples` directory in the repository