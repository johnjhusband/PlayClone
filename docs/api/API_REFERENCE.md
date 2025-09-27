# PlayClone API Reference

## Table of Contents
- [Constructor](#constructor)
- [Navigation Methods](#navigation-methods)
- [Action Methods](#action-methods)
- [Data Extraction Methods](#data-extraction-methods)
- [State Management Methods](#state-management-methods)
- [Advanced Methods](#advanced-methods)
- [Type Definitions](#type-definitions)

## Constructor

### `new PlayClone(options?)`
Creates a new PlayClone instance for browser automation.

#### Parameters
- `options` (optional): Configuration object
  - `headless?: boolean` - Run browser in headless mode (default: `true`)
  - `viewport?: { width: number, height: number }` - Browser viewport size (default: `{ width: 1280, height: 720 }`)
  - `userAgent?: string` - Custom user agent string
  - `timeout?: number` - Default timeout for operations in milliseconds (default: `30000`)
  - `browserType?: 'chromium' | 'firefox' | 'webkit'` - Browser engine to use (default: `'chromium'`)
  - `slowMo?: number` - Slow down operations by specified milliseconds
  - `devtools?: boolean` - Open browser developer tools (default: `false`)

#### Example
```typescript
const pc = new PlayClone({ 
  headless: false, 
  viewport: { width: 1920, height: 1080 } 
});
```

## Navigation Methods

### `navigate(url: string): Promise<ActionResult>`
Navigate to a specified URL.

#### Parameters
- `url: string` - The URL to navigate to

#### Returns
- `ActionResult` with navigation state and loaded elements

#### Example
```typescript
const result = await pc.navigate('https://example.com');
// { success: true, action: 'navigate', state: { url: 'https://example.com', ... } }
```

### `back(): Promise<ActionResult>`
Navigate back in browser history.

#### Example
```typescript
await pc.back();
```

### `forward(): Promise<ActionResult>`
Navigate forward in browser history.

#### Example
```typescript
await pc.forward();
```

### `reload(): Promise<ActionResult>`
Reload the current page.

#### Example
```typescript
await pc.reload();
```

## Action Methods

### `click(description: string): Promise<ActionResult>`
Click an element using natural language description.

#### Parameters
- `description: string` - Natural language description of the element to click

#### Returns
- `ActionResult` with click confirmation and new page state

#### Example
```typescript
await pc.click('blue login button');
await pc.click('Submit form');
await pc.click('navigation menu');
```

### `fill(fieldDescription: string, value: string): Promise<ActionResult>`
Fill a form field with a value.

#### Parameters
- `fieldDescription: string` - Natural language description of the field
- `value: string` - Value to enter into the field

#### Example
```typescript
await pc.fill('email field', 'user@example.com');
await pc.fill('search box', 'PlayClone documentation');
await pc.fill('password', 'secure123');
```

### `select(dropdownDescription: string, option: string): Promise<ActionResult>`
Select an option from a dropdown menu.

#### Parameters
- `dropdownDescription: string` - Description of the dropdown
- `option: string` - Option to select

#### Example
```typescript
await pc.select('country dropdown', 'United States');
await pc.select('sort by', 'Price: Low to High');
```

### `check(checkboxDescription: string): Promise<ActionResult>`
Check a checkbox.

#### Parameters
- `checkboxDescription: string` - Description of the checkbox

#### Example
```typescript
await pc.check('terms and conditions');
await pc.check('subscribe to newsletter');
```

### `uncheck(checkboxDescription: string): Promise<ActionResult>`
Uncheck a checkbox.

#### Parameters
- `checkboxDescription: string` - Description of the checkbox

#### Example
```typescript
await pc.uncheck('marketing emails');
```

### `hover(description: string): Promise<ActionResult>`
Hover over an element.

#### Parameters
- `description: string` - Description of the element to hover over

#### Example
```typescript
await pc.hover('dropdown menu');
await pc.hover('tooltip icon');
```

### `focus(description: string): Promise<ActionResult>`
Focus on an element.

#### Parameters
- `description: string` - Description of the element to focus

#### Example
```typescript
await pc.focus('search input');
```

### `type(text: string, delay?: number): Promise<ActionResult>`
Type text into the currently focused element.

#### Parameters
- `text: string` - Text to type
- `delay?: number` - Delay between keystrokes in milliseconds (default: `0`)

#### Example
```typescript
await pc.focus('comment box');
await pc.type('This is a test comment', 50);
```

### `press(key: string): Promise<ActionResult>`
Press a keyboard key.

#### Parameters
- `key: string` - Key to press (e.g., 'Enter', 'Tab', 'Escape', 'ArrowDown')

#### Example
```typescript
await pc.press('Enter');
await pc.press('Tab');
await pc.press('Control+A');
```

## Data Extraction Methods

### `getText(selector?: string): Promise<ExtractedData>`
Extract text content from the page or a specific element.

#### Parameters
- `selector?: string` - Optional element description to extract text from

#### Returns
- `ExtractedData` with extracted text content

#### Example
```typescript
const pageText = await pc.getText();
const heading = await pc.getText('main heading');
// { success: true, type: 'text', data: 'Welcome to Example' }
```

### `getTable(description: string): Promise<ExtractedData>`
Extract data from a table.

#### Parameters
- `description: string` - Description of the table

#### Returns
- `ExtractedData` with table data as structured array

#### Example
```typescript
const table = await pc.getTable('pricing table');
// { success: true, type: 'table', data: [[...], [...]] }
```

### `getLinks(filter?: string): Promise<ExtractedData>`
Extract all links from the page.

#### Parameters
- `filter?: string` - Optional filter for link text or URL

#### Returns
- `ExtractedData` with array of link objects

#### Example
```typescript
const links = await pc.getLinks();
const navLinks = await pc.getLinks('navigation');
// { success: true, type: 'links', data: [{ text: '...', url: '...' }] }
```

### `getFormData(formDescription?: string): Promise<ExtractedData>`
Extract current values from form fields.

#### Parameters
- `formDescription?: string` - Optional description of specific form

#### Returns
- `ExtractedData` with form field values

#### Example
```typescript
const formData = await pc.getFormData('registration form');
// { success: true, type: 'form', data: { email: '...', name: '...' } }
```

### `screenshot(options?): Promise<ExtractedData>`
Take a screenshot of the page.

#### Parameters
- `options?` - Screenshot options
  - `fullPage?: boolean` - Capture full page (default: `false`)
  - `path?: string` - Path to save screenshot

#### Returns
- `ExtractedData` with screenshot as base64 or confirmation

#### Example
```typescript
const screenshot = await pc.screenshot({ fullPage: true });
await pc.screenshot({ path: 'screenshot.png' });
```

## State Management Methods

### `getState(): Promise<PageState | null>`
Get the current browser state.

#### Returns
- `PageState` object with current page information

#### Example
```typescript
const state = await pc.getState();
// { url: '...', title: '...', cookies: [...], ... }
```

### `getCurrentState(): Promise<ActionResult>`
Get the current state wrapped in ActionResult format.

#### Returns
- `ActionResult` with current state data

#### Example
```typescript
const result = await pc.getCurrentState();
// { success: true, action: 'get_state', data: { ... } }
```

### `saveState(name: string): Promise<ActionResult>`
Save the current browser state as a checkpoint.

#### Parameters
- `name: string` - Name for the saved state

#### Example
```typescript
await pc.saveState('after-login');
```

### `restoreState(name: string): Promise<ActionResult>`
Restore a previously saved browser state.

#### Parameters
- `name: string` - Name of the state to restore

#### Example
```typescript
await pc.restoreState('after-login');
```

## Advanced Methods

### `execute(script: string): Promise<ActionResult>`
Execute JavaScript code in the page context.

#### Parameters
- `script: string` - JavaScript code to execute

#### Returns
- `ActionResult` with script execution result

#### Example
```typescript
const result = await pc.execute('document.title');
const scrollHeight = await pc.execute('document.body.scrollHeight');
```

### `waitFor(condition: string, timeout?: number): Promise<ActionResult>`
Wait for a specific condition to be met.

#### Parameters
- `condition: string` - Description of what to wait for
- `timeout?: number` - Maximum wait time in milliseconds (default: `30000`)

#### Example
```typescript
await pc.waitFor('loading spinner to disappear');
await pc.waitFor('success message', 5000);
```

### `search(query: string): Promise<ActionResult>`
Execute a search on the current page if it's a search engine.

#### Parameters
- `query: string` - The search query to execute

#### Returns
- `ActionResult` with search execution status

#### Features
- Automatic search engine detection (Google, DuckDuckGo, Bing)
- Human-like typing delays to bypass anti-automation
- Mouse movement simulation
- Intelligent submit strategies (Enter key, button click, or both)
- Site-specific timeout strategies

#### Example
```typescript
await pc.navigate('https://google.com');
const result = await pc.search('PlayClone browser automation');
// Automatically types in search box and submits
```

### `getSearchResults(limit?: number): Promise<ExtractedData>`
Extract search results from a search engine results page.

#### Parameters
- `limit?: number` - Maximum number of results to extract (default: 10)

#### Returns
- `ExtractedData` containing array of search results with title, URL, and snippet

#### Example
```typescript
await pc.navigate('https://google.com');
await pc.search('AI browser control');
const results = await pc.getSearchResults(5);
// Returns top 5 search results with title, URL, and description
```

### `close(): Promise<void>`
Close the browser and clean up resources.

#### Example
```typescript
await pc.close();
```

## Type Definitions

### `ActionResult`
```typescript
interface ActionResult {
  success: boolean;
  action: string;
  target?: string;
  state?: PageState;
  data?: any;
  error?: string;
  suggestions?: string[];
  timestamp: number;
}
```

### `ExtractedData`
```typescript
interface ExtractedData {
  success: boolean;
  type: 'text' | 'table' | 'links' | 'form' | 'screenshot' | 'tree';
  data: any;
  error?: string;
  metadata?: {
    elementCount?: number;
    source?: string;
    timestamp: number;
  };
}
```

### `PageState`
```typescript
interface PageState {
  url: string;
  title: string;
  cookies?: any[];
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
  viewport?: { width: number; height: number };
  timestamp: number;
}
```

## Error Handling

All methods return objects with a `success` field. When `success` is `false`, an `error` field contains the error message and optional `suggestions` for recovery.

```typescript
const result = await pc.click('non-existent button');
if (!result.success) {
  console.error('Error:', result.error);
  console.log('Suggestions:', result.suggestions);
}
```

## Best Practices

1. **Use Natural Language**: Describe elements as a human would see them
   - ✅ `"blue submit button"`
   - ✅ `"search box in header"`
   - ❌ `"#submit-btn"`
   - ❌ `"div.header > input[type='search']"`

2. **Check Success**: Always verify operations succeeded
   ```typescript
   const result = await pc.click('login');
   if (result.success) {
     // Continue with next action
   }
   ```

3. **Handle Dynamic Content**: Use waitFor when needed
   ```typescript
   await pc.click('load more');
   await pc.waitFor('new items to appear');
   ```

4. **Clean Up**: Always close the browser when done
   ```typescript
   try {
     // Your automation code
   } finally {
     await pc.close();
   }
   ```

5. **Save States**: Use checkpoints for complex flows
   ```typescript
   await pc.navigate('https://app.example.com');
   await pc.fill('username', 'test@example.com');
   await pc.fill('password', 'secure123');
   await pc.click('login');
   await pc.saveState('logged-in');
   
   // Later, quickly restore to logged-in state
   await pc.restoreState('logged-in');
   ```

## Token Optimization

PlayClone is designed for AI consumption with responses typically under 1KB:

- Responses include only essential information
- Data is structured for easy parsing
- Suggestions are concise and actionable
- Errors are descriptive but brief

## Migration from Playwright

If you're migrating from Playwright, here's a comparison:

| Playwright | PlayClone |
|------------|-----------|
| `page.goto(url)` | `pc.navigate(url)` |
| `page.click('#submit')` | `pc.click('submit button')` |
| `page.fill('#email', 'test@example.com')` | `pc.fill('email field', 'test@example.com')` |
| `page.selectOption('select#country', 'US')` | `pc.select('country dropdown', 'United States')` |
| `page.check('#terms')` | `pc.check('terms checkbox')` |
| `page.textContent('h1')` | `pc.getText('main heading')` |
| `page.screenshot()` | `pc.screenshot()` |
| `page.evaluate(() => {...})` | `pc.execute('...')` |
| `page.waitForSelector('#modal')` | `pc.waitFor('modal to appear')` |

## Support

For issues, questions, or contributions, visit: https://github.com/johnjhusband/PlayClone