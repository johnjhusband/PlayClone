# PlayClone AI Instructions & Complete Reference

> **FOR AI ASSISTANTS**: This is the primary reference file for understanding and using PlayClone. Read this file to understand all features and capabilities.

## Quick Start

```javascript
const { PlayClone } = require('playclone');
const playclone = new PlayClone({ headless: false });

// Navigate and interact
await playclone.navigate('https://example.com');
await playclone.click('login button');  // Natural language!
await playclone.fill('username field', 'john@example.com');
```

## Core Capabilities

### 1. Natural Language Browser Control
PlayClone allows AI assistants to control browsers using natural language instead of CSS selectors:

```javascript
// Instead of: await page.click('#submit-btn')
await playclone.click('submit button');

// Instead of: await page.fill('input[name="email"]', 'test@example.com')
await playclone.fill('email field', 'test@example.com');
```

### 2. MCP Server Integration
PlayClone runs as an MCP (Model Context Protocol) server, allowing direct integration with AI assistants:

- **Server**: `mcp-server-v2.cjs`
- **Config**: `claude_mcp_config.json`
- **Usage**: AI can call PlayClone functions directly through MCP

### 3. Canvas/WebGL Support
For games and canvas-based applications (like Kinetic Uranium):

```javascript
// Click at specific coordinates for canvas elements
await playclone.clickAt(960, 500);  // x, y coordinates

// Take screenshots
const screenshot = await playclone.screenshot();
```

### 4. Deep Error Extraction
Capture all browser errors, including compilation and runtime errors:

```javascript
// Start error capture before navigation
await playclone.startDeepErrorExtraction();
await playclone.navigate('https://example.com');

// Get error summary
const errors = await playclone.getDeepErrorSummary();
```

### 5. AI Assistant Module
Enhanced AI-specific features:

```javascript
// Search on any search engine
const results = await aiAssistant.search('query', 'google');

// Fill forms intelligently
await aiAssistant.fillForm({
  name: 'John Doe',
  email: 'john@example.com',
  subscribe: true  // Handles checkboxes
});

// Summarize page content
const summary = await aiAssistant.summarizePage();
```

### 6. Plugin System
Extend PlayClone with custom plugins:

```javascript
const plugin = {
  name: 'MyPlugin',
  version: '1.0.0',
  init: async (playclone) => {
    console.log('Plugin initialized');
  },
  hooks: {
    beforeNavigate: async (url) => {
      console.log(`Navigating to ${url}`);
    }
  }
};

// Load plugin
await pluginManager.loadPlugin(plugin);
```

## Complete API Reference

### Navigation & Basic Actions
- `navigate(url)` - Go to URL
- `click(selector)` - Click element (natural language)
- `fill(selector, value)` - Fill input field
- `press(key)` - Press keyboard key
- `hover(selector)` - Hover over element
- `scrollTo(selector)` - Scroll to element
- `back()` - Go back in history
- `forward()` - Go forward in history
- `reload()` - Reload page

### Canvas/Coordinate Actions
- `clickAt(x, y)` - Click at coordinates
- `dragFromTo(x1, y1, x2, y2)` - Drag between points
- `type(text)` - Type text (no selector needed)

### Data Extraction
- `getText(selector?)` - Get text content
- `getLinks()` - Get all links on page
- `getTable(description)` - Extract table data
- `extractData(spec)` - Extract structured data
- `getCurrentState()` - Get page state
- `screenshot()` - Take screenshot

### State Management
- `saveState()` - Save checkpoint
- `restoreState(checkpointId)` - Restore checkpoint
- `clearState()` - Clear saved states

### Error Handling
- `startDeepErrorExtraction()` - Begin error capture
- `getDeepErrorSummary()` - Get error summary
- `getDeepErrorReport()` - Get detailed report

### Advanced Features
- `waitFor(selector, options)` - Wait for element
- `executeScript(script)` - Run JavaScript
- `getCookies()` - Get cookies
- `setCookie(cookie)` - Set cookie
- `deleteCookies()` - Delete cookies

## File Structure & Key Files

```
PlayClone/
├── AI_INSTRUCTIONS.md     # THIS FILE - Main AI reference
├── README.md              # General documentation
├── API_REFERENCE.md       # Detailed API docs
├── USAGE_GUIDE.md         # Usage examples
├── mcp-server-v2.cjs      # MCP server (for AI integration)
├── src/
│   ├── PlayClone.ts       # Main class
│   ├── ai/                # AI Assistant features
│   ├── plugins/           # Plugin system
│   └── optimization/      # WASM performance
└── examples/              # Example scripts
```

## Testing with Kinetic Uranium

PlayClone has been tested with Kinetic Uranium (WebGL game):

```javascript
// Navigate to game
await playclone.navigate('https://devgame.flippi.ai');

// Click on Training mode (canvas coordinates)
await playclone.clickAt(960, 500);

// Type commands
await playclone.type('status');
await playclone.press('Enter');
```

## Docker Deployment

For production deployment:

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d

# Kubernetes
kubectl apply -f kubernetes/
```

## Common AI Tasks

### 1. Web Scraping
```javascript
await playclone.navigate('https://news.site.com');
const headlines = await playclone.extractData({
  headlines: {
    selector: 'article h2',
    multiple: true,
    fields: {
      title: { selector: 'text' },
      link: { selector: 'a', attribute: 'href' }
    }
  }
});
```

### 2. Form Automation
```javascript
await playclone.navigate('https://form.site.com');
await playclone.fill('name field', 'John Doe');
await playclone.fill('email input', 'john@example.com');
await playclone.click('agree to terms checkbox');
await playclone.click('submit button');
```

### 3. Testing SPAs
```javascript
await playclone.navigate('https://spa.site.com');
await playclone.waitFor('main content');
await playclone.click('menu button');
await playclone.waitFor('menu panel');
await playclone.click('settings link');
```

### 4. Game Automation
```javascript
await playclone.navigate('https://game.site.com');
await playclone.clickAt(500, 300);  // Click play button
await playclone.type('player1');     // Enter name
await playclone.press('Enter');      // Start game
```

## Troubleshooting

### Canvas/WebGL Games
- Natural language selectors don't work on canvas
- Use `clickAt(x, y)` with coordinates instead

### Error Capture
- Start `startDeepErrorExtraction()` BEFORE navigation
- Check console errors with `getDeepErrorSummary()`

### MCP Server Issues
- Ensure `mcp-server-v2.cjs` is running
- Check `claude_mcp_config.json` for configuration

## VSCode Extension

PlayClone includes a VSCode extension for interactive development:
- Location: `vscode-extension/`
- Features: Record/playback, selector builder, debugging

## Important Notes for AI

1. **Always use natural language** for selectors when possible
2. **For canvas/games**, use coordinate-based clicks
3. **Start error capture** before navigating for debugging
4. **Save checkpoints** for complex multi-step operations
5. **Use the AI Assistant module** for enhanced capabilities
6. **Check examples folder** for real-world usage patterns

## Getting Help

- **Main Docs**: README.md, API_REFERENCE.md, USAGE_GUIDE.md
- **Examples**: `examples/` folder
- **Tests**: `test-ku-comprehensive.js` for feature testing
- **MCP Config**: `claude_mcp_config.json` for AI integration

---

**This file is the primary reference for AI assistants using PlayClone. It contains all essential information needed to understand and use PlayClone's features effectively.**