# PlayClone Plugin Development Guide

## Overview

PlayClone's plugin architecture allows developers to extend the framework's functionality with custom features, integrations, and enhancements. Plugins can hook into browser automation events, add new commands, implement custom selectors, and provide specialized data extraction capabilities.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Plugin Structure](#plugin-structure)
3. [Lifecycle Hooks](#lifecycle-hooks)
4. [Plugin API](#plugin-api)
5. [Creating Your First Plugin](#creating-your-first-plugin)
6. [Advanced Features](#advanced-features)
7. [Best Practices](#best-practices)
8. [Publishing Plugins](#publishing-plugins)

## Getting Started

### Installation

Plugins can be loaded from:
- Local file paths
- NPM packages
- GitHub repositories
- URL endpoints

### Basic Usage

```javascript
const { PlayClone } = require('playclone');

const pc = new PlayClone({
  pluginStorageDir: './plugin-data'
});

// Load a local plugin
await pc.loadPlugin('./plugins/my-plugin.js', {
  enabled: true,
  priority: 10,
  settings: { /* custom settings */ }
});

// Load from npm
await pc.loadPluginFromNpm('@playclone/analytics-plugin');

// Execute plugin commands
const result = await pc.executePluginCommand('myCommand', { arg: 'value' });
```

## Plugin Structure

### Basic Plugin Class

```typescript
import { BasePlugin } from 'playclone/plugins';
import { PluginMetadata, PluginContext } from 'playclone/types';

export class MyPlugin extends BasePlugin {
  metadata: PluginMetadata = {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'My awesome PlayClone plugin',
    author: 'Your Name',
    keywords: ['automation', 'custom'],
    license: 'MIT'
  };

  async onLoad(context: PluginContext): Promise<void> {
    await super.onLoad(context);
    
    // Register commands
    this.registerCommand('doSomething', this.handleCommand.bind(this));
    
    // Register hooks
    this.registerHook('custom:event', this.handleHook.bind(this));
    
    context.logger.info('Plugin loaded successfully');
  }

  private async handleCommand(args: any, context: PluginContext) {
    // Command implementation
    return { success: true, data: 'Command executed' };
  }

  private async handleHook(data: any, context: PluginContext) {
    // Hook implementation
    return { processed: true };
  }
}
```

### Plugin Metadata

```typescript
interface PluginMetadata {
  name: string;           // Unique plugin identifier
  version: string;        // Semantic version (x.y.z)
  description?: string;   // Brief description
  author?: string;        // Author name or organization
  dependencies?: Record<string, string>; // Required npm packages
  engines?: {
    playclone?: string;   // Compatible PlayClone version
    node?: string;        // Required Node.js version
  };
  keywords?: string[];    // Search keywords
  homepage?: string;      // Plugin website
  license?: string;       // License identifier
}
```

## Lifecycle Hooks

Plugins can hook into various browser automation events:

### Navigation Hooks

```typescript
async onBeforeNavigate(url: string, context: PluginContext): Promise<void> {
  // Called before navigating to a URL
  context.logger.info(`Navigating to ${url}`);
}

async onAfterNavigate(url: string, context: PluginContext): Promise<void> {
  // Called after navigation completes
  const title = await context.page?.title();
  context.logger.info(`Arrived at: ${title}`);
}
```

### Action Hooks

```typescript
async onBeforeClick(selector: string, context: PluginContext): Promise<void> {
  // Called before clicking an element
}

async onAfterClick(selector: string, context: PluginContext): Promise<void> {
  // Called after click completes
}

async onBeforeFill(selector: string, value: string, context: PluginContext): Promise<void> {
  // Called before filling a form field
}

async onAfterFill(selector: string, value: string, context: PluginContext): Promise<void> {
  // Called after fill completes
}
```

### Data Extraction Hooks

```typescript
async onBeforeExtract(type: string, context: PluginContext): Promise<void> {
  // Called before data extraction
}

async onAfterExtract(type: string, data: any, context: PluginContext): Promise<any> {
  // Called after extraction - can modify the data
  return modifiedData;
}
```

### Error Handling

```typescript
async onError(error: Error, context: PluginContext): Promise<void> {
  // Handle errors during automation
  context.logger.error('Automation error:', error);
  
  // Optional: Send to error tracking service
  await this.sendToErrorTracking(error);
}
```

## Plugin API

### Plugin Context

Every plugin method receives a context object:

```typescript
interface PluginContext {
  playclone: PlayClone;      // Main PlayClone instance
  browser?: BrowserManager;   // Browser manager
  page?: Page;                // Current page (Playwright)
  config: PluginConfig;       // Plugin configuration
  logger: PluginLogger;       // Logging interface
  storage: PluginStorage;     // Persistent storage
  api: PluginAPI;            // Plugin API for registration
}
```

### Logger

```typescript
context.logger.info('Information message');
context.logger.warn('Warning message');
context.logger.error('Error message', error);
context.logger.debug('Debug message'); // Only with DEBUG=true
```

### Storage

Plugins have access to persistent JSON storage:

```typescript
// Save data
await context.storage.set('key', { data: 'value' });

// Retrieve data
const data = await context.storage.get('key');

// Delete data
await context.storage.delete('key');

// Clear all plugin data
await context.storage.clear();
```

### Registering Components

#### Commands

```typescript
this.registerCommand('myCommand', async (args, context) => {
  // Command logic
  return { success: true, result: 'data' };
});

// Users can call: pc.executePluginCommand('myCommand', { arg: 'value' })
```

#### Custom Selectors

```typescript
this.registerSelector('by-data-test', async (selector, page) => {
  // Custom selector logic
  const element = await page.$(`[data-test="${selector}"]`);
  return element;
});

// Users can use: pc.click('by-data-test:submit-button')
```

#### Data Extractors

```typescript
this.registerExtractor('custom-data', async (page, options) => {
  // Custom extraction logic
  const data = await page.evaluate(() => {
    // Extract custom data from page
    return { /* extracted data */ };
  });
  return data;
});

// Users can call: pc.extract('custom-data', { options })
```

## Creating Your First Plugin

### Step 1: Set Up Project

```bash
mkdir my-playclone-plugin
cd my-playclone-plugin
npm init -y
npm install --save-dev typescript @types/node
```

### Step 2: Create Plugin File

```typescript
// src/index.ts
import { BasePlugin } from 'playclone/plugins';
import { PluginMetadata, PluginContext } from 'playclone/types';

export class WordCountPlugin extends BasePlugin {
  metadata: PluginMetadata = {
    name: 'word-counter',
    version: '1.0.0',
    description: 'Counts words on web pages'
  };

  private totalWords: number = 0;

  async onLoad(context: PluginContext): Promise<void> {
    await super.onLoad(context);
    
    this.registerCommand('getWordCount', this.getWordCount.bind(this));
    this.registerCommand('resetCount', this.resetCount.bind(this));
  }

  async onAfterNavigate(url: string, context: PluginContext): Promise<void> {
    if (!context.page) return;
    
    const wordCount = await context.page.evaluate(() => {
      const text = document.body?.innerText || '';
      return text.split(/\s+/).filter(w => w.length > 0).length;
    });
    
    this.totalWords += wordCount;
    context.logger.info(`Page has ${wordCount} words (Total: ${this.totalWords})`);
  }

  private async getWordCount(args: any, context: PluginContext) {
    return {
      currentPage: await this.getCurrentPageWords(context),
      total: this.totalWords
    };
  }

  private async resetCount(args: any, context: PluginContext) {
    this.totalWords = 0;
    return { success: true, message: 'Word count reset' };
  }

  private async getCurrentPageWords(context: PluginContext): Promise<number> {
    if (!context.page) return 0;
    
    return await context.page.evaluate(() => {
      const text = document.body?.innerText || '';
      return text.split(/\s+/).filter(w => w.length > 0).length;
    });
  }
}

export default WordCountPlugin;
```

### Step 3: Test Your Plugin

```javascript
const { PlayClone } = require('playclone');

const pc = new PlayClone();

// Load your plugin
await pc.loadPlugin('./path/to/word-count-plugin.js');

// Use the plugin
await pc.navigate('https://example.com');
const count = await pc.executePluginCommand('getWordCount', {});
console.log(`Words on page: ${count.data.currentPage}`);
```

## Advanced Features

### Plugin Dependencies

Specify required dependencies in metadata:

```typescript
metadata: PluginMetadata = {
  name: 'my-plugin',
  version: '1.0.0',
  dependencies: {
    'axios': '^1.0.0',
    'cheerio': '^1.0.0'
  },
  engines: {
    playclone: '>=1.0.0',
    node: '>=18.0.0'
  }
};
```

### Inter-Plugin Communication

Plugins can communicate via events:

```typescript
// In Plugin A
context.api.emit('custom:data', { value: 123 });

// In Plugin B
this.registerHook('plugin:pluginA:custom:data', async (data, context) => {
  console.log('Received data from Plugin A:', data.value);
});
```

### Middleware Pattern

Create middleware for request/response modification:

```typescript
async onBeforeNavigate(url: string, context: PluginContext): Promise<void> {
  // Modify headers
  await context.page?.setExtraHTTPHeaders({
    'X-Custom-Header': 'value'
  });
}

async onAfterExtract(type: string, data: any, context: PluginContext): Promise<any> {
  // Transform extracted data
  if (type === 'text') {
    return {
      ...data,
      wordCount: data.text?.split(/\s+/).length || 0
    };
  }
  return data;
}
```

### Background Tasks

Run periodic tasks:

```typescript
export class MonitoringPlugin extends BasePlugin {
  private interval?: NodeJS.Timeout;

  async onLoad(context: PluginContext): Promise<void> {
    await super.onLoad(context);
    
    // Start monitoring every 30 seconds
    this.interval = setInterval(() => {
      this.checkPerformance(context);
    }, 30000);
  }

  async onUnload(context: PluginContext): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
    }
    await super.onUnload(context);
  }

  private async checkPerformance(context: PluginContext) {
    if (!context.page) return;
    
    const metrics = await context.page.evaluate(() => 
      JSON.stringify(performance.getEntriesByType('navigation'))
    );
    
    await context.storage.set('performance-metrics', metrics);
  }
}
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```typescript
async myMethod(context: PluginContext): Promise<any> {
  try {
    // Your code
    return { success: true };
  } catch (error) {
    context.logger.error('Method failed:', error);
    return { success: false, error: error.message };
  }
}
```

### 2. Performance

- Avoid blocking operations in hooks
- Use Promise.all() for parallel operations
- Cache frequently accessed data
- Clean up resources in onUnload

### 3. Configuration

Make plugins configurable:

```typescript
async onLoad(context: PluginContext): Promise<void> {
  const settings = context.config.settings || {};
  
  this.enabled = settings.enabled ?? true;
  this.timeout = settings.timeout ?? 5000;
  this.retries = settings.retries ?? 3;
}
```

### 4. Documentation

Document all commands and features:

```typescript
this.registerCommand('analyze', async (args, context) => {
  /**
   * Analyzes the current page
   * @param {string} args.selector - Element to analyze
   * @param {boolean} args.detailed - Include detailed metrics
   * @returns {object} Analysis results
   */
  // Implementation
});
```

### 5. Testing

Create tests for your plugin:

```javascript
describe('MyPlugin', () => {
  let pc;
  
  beforeEach(async () => {
    pc = new PlayClone();
    await pc.loadPlugin('./my-plugin.js');
  });
  
  afterEach(async () => {
    await pc.close();
  });
  
  test('should count words correctly', async () => {
    await pc.navigate('https://example.com');
    const result = await pc.executePluginCommand('getWordCount', {});
    expect(result.data.currentPage).toBeGreaterThan(0);
  });
});
```

## Publishing Plugins

### NPM Package Structure

```
my-playclone-plugin/
├── package.json
├── README.md
├── LICENSE
├── src/
│   └── index.ts
├── dist/
│   └── index.js
└── tests/
    └── plugin.test.js
```

### Package.json

```json
{
  "name": "@yourname/playclone-plugin-example",
  "version": "1.0.0",
  "description": "Example PlayClone plugin",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["playclone", "plugin", "automation"],
  "peerDependencies": {
    "playclone": ">=1.0.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "jest"
  }
}
```

### Publishing Steps

1. Build your plugin: `npm run build`
2. Test thoroughly: `npm test`
3. Publish to npm: `npm publish`
4. Users can install: `npm install @yourname/playclone-plugin-example`

### Plugin Registry

Submit your plugin to the PlayClone plugin registry:

1. Fork the PlayClone repository
2. Add your plugin to `plugins/registry.json`
3. Submit a pull request

## Example Plugins

### Analytics Plugin
Tracks automation events, provides metrics and performance data.

### SEO Analyzer
Analyzes pages for SEO best practices and provides recommendations.

### Screenshot Comparer
Takes screenshots and compares them for visual regression testing.

### Data Validator
Validates extracted data against schemas and business rules.

### Request Interceptor
Intercepts and modifies network requests and responses.

## Support

- GitHub Issues: https://github.com/playclone/playclone/issues
- Discord: https://discord.gg/playclone
- Documentation: https://docs.playclone.ai

## License

PlayClone plugins follow the same license as the main framework (MIT) unless otherwise specified.