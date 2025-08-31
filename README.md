# PlayClone 🎭

AI-Native Browser Automation Framework - Control browsers with natural language, optimized for AI assistants.

[![npm version](https://badge.fury.io/js/playclone.svg)](https://badge.fury.io/js/playclone)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

## 🎉 Current Status: PRODUCTION READY

**PlayClone is fully functional and tested!** 
- ✅ **Self-Test Suite**: 100% passing (10/10 tests)
- ✅ **Real-World Testing**: Successfully automates GitHub, Example.com
- ✅ **AI Optimization**: Average response size 215 bytes (target <1KB ✅)
- ✅ **Natural Language**: "Click login button" actually works!

## ✨ Features

- 🗣️ **Natural Language Selectors** - Use everyday language to interact with web pages
- 🤖 **AI-Optimized Responses** - All responses under 1KB for efficient token usage
- 🔄 **Built-in Retry Logic** - Automatic retry with exponential backoff
- 📊 **Smart Data Extraction** - Extract structured data from any webpage
- 💾 **State Management** - Save and restore browser states
- 🛡️ **Comprehensive Error Handling** - Detailed error messages with recovery suggestions
- 🚀 **High Performance** - Optimized for speed and minimal resource usage
- 📝 **TypeScript First** - Full type safety and excellent IDE support
- 🔍 **Search Engine Automation** - Built-in support for Google, DuckDuckGo, Bing with anti-bot bypass
- ⏱️ **Advanced Timeout Handling** - Adaptive timeouts for complex SPAs and heavy sites
- 🦊 **Multi-Browser Support** - Works with Chromium, Firefox, and WebKit (Safari) browsers
- 🧩 **Browser Extension Support** - Load and manage browser extensions dynamically

## 🚀 Quick Start

### Installation

```bash
npm install playclone
```

### Browser Support

PlayClone supports multiple browser engines:

| Browser | Status | Installation | Notes |
|---------|--------|--------------|-------|
| **Chromium** | ✅ Fully Supported | `npx playwright install chromium` | Default browser, best compatibility |
| **Firefox** | ✅ Fully Supported | `npx playwright install firefox` | 90% test pass rate |
| **WebKit** | ⚠️ Supported* | `npx playwright install webkit` | Safari engine, requires system dependencies |

**WebKit (Safari) Requirements:**
- WebKit support is implemented but requires additional system dependencies
- On Linux: Install with `sudo npx playwright install-deps webkit`
- On macOS: Works out of the box
- Required packages: `libevent-2.1-7`, `libgstreamer-plugins-bad1.0-0`, `libflite1`, `libavif16`

### Try the Demo

```bash
# Clone the repository
git clone https://github.com/johnjhusband/PlayClone.git
cd PlayClone

# Install dependencies
npm install

# Build the project
npm run build

# Run the simple demo
node demo-simple.js

# Run the self-test suite (PlayClone tests itself!)
node tests/self-tests/master.self-test.js
```

### Basic Usage

```typescript
import { PlayClone } from 'playclone';

// Initialize PlayClone (defaults to Chromium)
const pc = new PlayClone({ headless: false });

// Or use Firefox browser
const pcFirefox = new PlayClone({ 
  browser: 'firefox', 
  headless: false 
});

// Or use WebKit (Safari engine)
const pcWebKit = new PlayClone({ 
  browser: 'webkit', 
  headless: false 
});

// Navigate to a website
await pc.navigate('https://example.com');

// Click using natural language
await pc.click('blue login button');

// Fill forms with human-like descriptions
await pc.fill('email field', 'user@example.com');
await pc.fill('password field', 'secretpass');

// Extract data
const title = await pc.getText('main heading');
console.log(title.data); // "Welcome to Example"

// Close browser
await pc.close();
```

## 🔐 Proxy Support

PlayClone supports HTTP, HTTPS, and SOCKS5 proxies with authentication:

```typescript
// Basic HTTP proxy
const pc = new PlayClone({
  proxy: {
    server: 'http://proxy.example.com:8080',
    bypass: 'localhost,127.0.0.1,*.internal.com'
  }
});

// Proxy with authentication
const pc = new PlayClone({
  proxy: {
    server: 'http://proxy.example.com:8080',
    username: 'proxyuser',
    password: 'proxypass'
  }
});

// SOCKS5 proxy
const pc = new PlayClone({
  proxy: {
    server: 'socks5://socks-proxy.example.com:1080',
    username: 'socksuser',
    password: 'sockspass'
  }
});
```

### Proxy Configuration Options

- **server**: Proxy server URL (required)
  - HTTP/HTTPS: `http://proxy:8080` or `https://proxy:8443`
  - SOCKS: `socks5://proxy:1080` or `socks4://proxy:1080`
- **bypass**: Comma-separated list of hosts to bypass proxy
  - Supports wildcards: `*.local`, `192.168.*`
- **username**: Proxy authentication username (optional)
- **password**: Proxy authentication password (optional)

## 🍪 Cookie Management

PlayClone provides comprehensive cookie management capabilities:

```typescript
// Set a cookie
await pc.setCookie({
  name: 'session_id',
  value: 'abc123',
  domain: 'example.com',
  path: '/',
  secure: true,
  httpOnly: false
});

// Get all cookies
const cookies = await pc.getCookies();
console.log(`Found ${cookies.count} cookies`);

// Get specific cookie
const sessionCookie = await pc.getCookies({ name: 'session_id' });

// Get cookie value directly
const sessionId = await pc.getCookieValue('session_id');

// Check if cookie exists
if (await pc.hasCookie('auth_token')) {
  console.log('User is authenticated');
}

// Set multiple cookies at once
await pc.setCookies([
  { name: 'theme', value: 'dark', domain: 'example.com' },
  { name: 'lang', value: 'en', domain: 'example.com' }
]);

// Delete a specific cookie
await pc.deleteCookie('session_id');

// Clear all cookies
await pc.clearCookies();

// Export cookies to JSON
const cookieJson = await pc.exportCookies();
fs.writeFileSync('cookies.json', cookieJson);

// Import cookies from JSON
const savedCookies = fs.readFileSync('cookies.json', 'utf8');
await pc.importCookies(savedCookies);
```

### Cookie API Methods

- **setCookie(cookie)**: Set a single cookie
- **setCookies(cookies[])**: Set multiple cookies
- **getCookies(options?)**: Get all or filtered cookies
- **getCookieValue(name)**: Get cookie value by name
- **hasCookie(name)**: Check if cookie exists
- **deleteCookie(name)**: Delete a specific cookie
- **clearCookies()**: Clear all cookies
- **exportCookies()**: Export cookies as JSON string
- **importCookies(json)**: Import cookies from JSON

## 🎯 Natural Language Selectors

PlayClone understands natural language descriptions of elements:

```typescript
// Instead of complex CSS selectors...
await page.click('#nav > div.container > button.btn-primary:nth-child(2)');

// Use natural language!
await pc.click('second blue button in navigation');

// More examples
await pc.click('login link in header');
await pc.fill('search box at top of page', 'AI automation');
await pc.select('country dropdown', 'United States');
await pc.check('terms and conditions checkbox');
```

## 🔍 Search Engine Automation

PlayClone includes specialized handling for search engines:

```typescript
// Navigate to search engine
await pc.navigate('https://google.com');

// Perform search with anti-bot bypass
await pc.search('PlayClone browser automation');

// Extract search results
const results = await pc.getSearchResults(5);
console.log(results.data); 
// [
//   { title: 'Result 1', url: 'https://...', snippet: '...' },
//   { title: 'Result 2', url: 'https://...', snippet: '...' },
//   ...
// ]
```

### Features:
- **Automatic Detection**: Recognizes Google, DuckDuckGo, Bing
- **Human-like Behavior**: Simulates mouse movements and typing delays
- **Smart Submit**: Uses Enter key, search button, or both based on site
- **Anti-bot Bypass**: Includes user agent spoofing and behavior randomization

## ⏱️ Advanced Timeout Handling

PlayClone automatically adapts timeouts based on site complexity:

```typescript
// Simple sites - Fast strategy (5-10s)
await pc.navigate('https://example.com');

// SPAs - Adaptive strategy (25-45s)
await pc.navigate('https://github.com');

// Heavy sites - Patient strategy (30-60s)
await pc.navigate('https://cnn.com');

// Anti-bot sites - Aggressive strategy (60-90s)
await pc.navigate('https://duckduckgo.com');
```

The framework learns from each site visit and optimizes future timeouts.

## 🧩 Browser Extensions

PlayClone supports loading browser extensions for enhanced functionality:

```javascript
// Load extensions at launch
const pc = new PlayClone({
  headless: false,  // Extensions require headed mode
  browser: 'chromium',
  extensions: [
    {
      // Load from local path
      path: './my-extension',
      permissions: ['tabs', 'storage']  // Optional: additional permissions
    },
    {
      // Load from Chrome Web Store
      id: 'fmkadmapgofadopljbjfkapdkoienihi'  // React DevTools
    },
    {
      // Load from URL
      url: 'https://example.com/extension.zip'
    }
  ]
});

// Or load extensions dynamically
const result = await pc.loadExtension({
  path: './another-extension'
});

// Manage extensions
const extensions = pc.getExtensions();  // List all extensions
pc.setExtensionEnabled(extensionId, false);  // Disable extension
pc.removeExtension(extensionId);  // Remove extension
```

### Extension Features:
- **Multiple Sources**: Local path, Chrome Web Store, or URL
- **Dynamic Loading**: Load extensions after browser launch
- **Management API**: Enable/disable/remove extensions
- **Manifest Overrides**: Modify extension permissions on the fly
- **Chromium Only**: Currently supports Chromium-based browsers

### Use Cases:
- **Ad Blockers**: Load uBlock Origin or AdBlock Plus
- **Developer Tools**: React/Vue/Angular DevTools
- **Automation Helpers**: Custom extensions for scraping
- **Privacy Tools**: VPN or privacy-focused extensions

## 🔌 Plugin System

PlayClone features a powerful plugin architecture for extending functionality:

```javascript
// Load a local plugin
await pc.loadPlugin('./plugins/analytics-plugin.js', {
  enabled: true,
  priority: 10,
  settings: { autoTrack: true }
});

// Load from npm
await pc.loadPluginFromNpm('@playclone/seo-analyzer');

// Execute plugin commands
const analytics = await pc.executePluginCommand('getAnalytics', {});
console.log(analytics.data); // { navigations: 5, clicks: 12, ... }

// List loaded plugins
const plugins = pc.getPlugins();
console.log(plugins); // [{ name: 'analytics', version: '1.0.0', enabled: true }, ...]
```

### Plugin Features:
- **Lifecycle Hooks**: onBeforeNavigate, onAfterClick, onError, etc.
- **Custom Commands**: Add new functionality via plugin commands
- **Data Extractors**: Create specialized data extraction methods
- **Persistent Storage**: Plugins have their own storage system
- **Event System**: Inter-plugin communication via events
- **Hot Reload**: Enable/disable plugins without restart

### Available Plugins:
- **Analytics Plugin**: Track automation events and performance
- **SEO Analyzer**: Analyze pages for SEO best practices
- **Screenshot Comparer**: Visual regression testing
- **Data Validator**: Validate extracted data against schemas
- **Request Interceptor**: Modify network requests/responses

See [Plugin Development Guide](docs/PLUGIN_DEVELOPMENT.md) for creating custom plugins.

## Core Components

### BrowserManager
Handles browser lifecycle, navigation, and basic operations.

### ElementLocator
Provides natural language element selection with multiple strategies:
- Text matching
- Role-based selection (button, link, input)
- Aria labels and placeholders
- Fuzzy matching
- CSS/XPath fallback

### ActionExecutor
Executes browser actions:
- Click, double-click, right-click
- Fill forms, type text
- Select dropdowns, check boxes
- Hover, focus, scroll
- Drag and drop
- File uploads

### DataExtractor
Extracts structured data:
- Page text content
- Tables as JSON
- Form data and state
- Links (internal/external)
- Images and metadata
- Accessibility tree

### StateManager
Manages browser state:
- Save/restore checkpoints
- Compare states
- Import/export sessions
- Session persistence

## API Reference

### PlayClone Class

#### Constructor Options
```typescript
interface PlayCloneOptions {
  headless?: boolean;              // Run in headless mode
  viewport?: { width: number; height: number };
  userAgent?: string;              // Custom user agent
  timeout?: number;                // Default timeout (ms)
  browser?: 'chromium' | 'firefox' | 'webkit';
  persistSession?: boolean;        // Enable session persistence
  sessionPath?: string;            // Custom session storage path
}
```

### PlayCloneContext Methods

#### Navigation
- `navigate(target: string)` - Navigate to URL or search
- `back()` - Go back in history
- `forward()` - Go forward in history  
- `reload()` - Reload the page

#### Actions
- `click(selector: string | ElementSelector)` - Click element
- `fill(selector, value: string)` - Fill input field
- `type(text: string, delay?: number)` - Type text
- `press(key: string)` - Press keyboard key
- `select(selector, value: string | string[])` - Select dropdown option
- `check(selector, checked?: boolean)` - Check/uncheck checkbox
- `hover(selector)` - Hover over element
- `focus(selector)` - Focus element

#### Data Extraction
- `getText(selector?)` - Extract text content
- `getTable(selector?)` - Extract table data
- `getFormData(selector?)` - Get form field values
- `getLinks()` - Get all page links
- `getPageInfo()` - Get page metadata
- `screenshot(options?)` - Take screenshot

#### State Management
- `saveCheckpoint(name?: string)` - Save current state
- `restoreCheckpoint(name: string)` - Restore saved state
- `listCheckpoints()` - List available checkpoints

## Connection Pool Configuration

PlayClone includes a sophisticated connection pool system with adaptive scaling and multiple configuration options:

### Configuration Methods

#### 1. Environment Variables
```bash
# Basic pool settings
export PLAYCLONE_POOL_MIN_CONNECTIONS=2
export PLAYCLONE_POOL_MAX_CONNECTIONS=10
export PLAYCLONE_POOL_MAX_IDLE_TIME=30000
export PLAYCLONE_POOL_CONNECTION_TIMEOUT=10000

# Adaptive scaling
export PLAYCLONE_POOL_ADAPTIVE_SCALING=true
export PLAYCLONE_POOL_SCALE_UP_THRESHOLD=0.8
export PLAYCLONE_POOL_SCALE_DOWN_THRESHOLD=0.2

# Advanced settings
export PLAYCLONE_POOL_PRE_WARM=true
export PLAYCLONE_POOL_PRE_WARM_COUNT=2
export PLAYCLONE_POOL_METRICS=true
```

#### 2. Configuration File
Create `playclone.config.json` in your project root:
```json
{
  "pool": {
    "minConnections": 2,
    "maxConnections": 10,
    "adaptiveScaling": true,
    "scaleUpThreshold": 0.8,
    "scaleDownThreshold": 0.2,
    "maxIdleTime": 30000,
    "warmupOnStart": true
  }
}
```

#### 3. Programmatic Configuration
```typescript
import { PoolConfigManager, getGlobalPool } from 'playclone';

// Update configuration at runtime
const configManager = PoolConfigManager.getInstance();
configManager.updateConfig({
  minConnections: 3,
  maxConnections: 15,
  adaptiveScaling: true
});

// Or configure when creating pool
const pool = getGlobalPool({
  minConnections: 1,
  maxConnections: 5,
  maxIdleTime: 15000
});
```

### Adaptive Scaling
When enabled, the pool automatically adjusts the number of connections based on usage:
- **Scale Up**: Adds connections when utilization > scaleUpThreshold
- **Scale Down**: Removes idle connections when utilization < scaleDownThreshold
- Prevents rapid scaling with cooldown periods

### Pool Statistics
Monitor pool performance with built-in metrics:
```typescript
const stats = pool.getStats();
console.log('Active connections:', stats.activeConnections);
console.log('Connection reuse rate:', stats.connectionReuse);
console.log('Average wait time:', stats.averageWaitTime);
```

## Natural Language Examples

```typescript
// Click examples
await context.click('login button');
await context.click('link with text Contact Us');
await context.click('button submit');

// Fill examples  
await context.fill('email input', 'test@example.com');
await context.fill('search box', 'AI automation');
await context.fill('password field', 'secure123');

// Navigation examples
await context.navigate('google.com');
await context.navigate('search for AI news');
```

## Response Format

All methods return `ActionResult` with consistent structure:

```typescript
interface ActionResult {
  success: boolean;    // Whether action succeeded
  action: string;      // Action type performed
  value?: any;         // Return value (if any)
  error?: string;      // Error message (if failed)
  duration?: number;   // Execution time (ms)
  timestamp: number;   // Unix timestamp
}
```

Responses are automatically compressed to stay under 1KB for optimal AI token usage.

## Examples

See the `/examples` directory for complete examples:
- `basic-usage.ts` - Basic browser automation
- `ai-assistant-example.ts` - AI assistant integration

## MCP Server Integration

PlayClone includes an MCP (Model Context Protocol) server for AI assistant integration:

```bash
# Start MCP server with visible browser (default)
node mcp-server-v2.cjs

# Start MCP server with headless browser (for servers)
PLAYCLONE_HEADLESS=true node mcp-server-v2.cjs
```

The MCP server defaults to **visible browser mode** (headless: false) so users can see automation happening in real-time. This provides better transparency and debugging capabilities. Use the `PLAYCLONE_HEADLESS=true` environment variable only when running on servers without displays.

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Watch mode
npm run build:watch

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Architecture

PlayClone uses a layered architecture:

1. **Core Layer**: Browser management and lifecycle
2. **Selection Layer**: Natural language element location
3. **Action Layer**: Browser action execution
4. **Extraction Layer**: Data extraction and formatting
5. **State Layer**: Session and checkpoint management

All layers are optimized for:
- Minimal token usage in responses
- Natural language understanding
- Error recovery and retries
- AI-friendly interfaces

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

## License

MIT License - see LICENSE file for details

## Roadmap

- [ ] Visual element detection using screenshots
- [ ] Multi-tab/window support
- [ ] Advanced form handling (captchas, multi-step)
- [ ] Network request interception
- [ ] Cookie and storage management
- [ ] Proxy support
- [ ] Performance profiling
- [ ] Cloud browser support

## Support

For issues and questions:
- GitHub Issues: https://github.com/johnjhusband/PlayClone/issues
- Documentation: See `/docs` folder

## Credits

Built with [Playwright](https://playwright.dev/) for browser automation.
Designed specifically for AI assistants and LLM integration.