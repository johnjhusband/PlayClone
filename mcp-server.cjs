#!/usr/bin/env node
/**
 * MCP (Model Context Protocol) Server for PlayClone
 * CommonJS version for compatibility
 */

const { Server } = require('@modelcontextprotocol/sdk/server');
const { StdioServerTransport } = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/stdio.js');
const { PlayClone } = require('./dist/index.js');

// Global PlayClone instance pool for concurrent operations
const browserPool = new Map();
let poolId = 0;

// Create MCP server
const server = new Server(
  {
    name: 'playclone-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Get or create browser instance
async function getBrowser(sessionId) {
  if (!sessionId) {
    sessionId = `session-${++poolId}`;
  }
  
  if (!browserPool.has(sessionId)) {
    const instance = new PlayClone({ 
      headless: true,
      timeout: 30000 
    });
    browserPool.set(sessionId, instance);
  }
  
  return { instance: browserPool.get(sessionId), sessionId };
}

// Tool definitions with improved descriptions
const tools = [
  {
    name: 'browser_navigate',
    description: 'Navigate browser to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
        sessionId: { type: 'string', description: 'Optional session ID for persistent browser' }
      },
      required: ['url']
    }
  },
  {
    name: 'browser_search',
    description: 'Search on a search engine (Google, DuckDuckGo, Bing)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        engine: { 
          type: 'string', 
          enum: ['google', 'duckduckgo', 'bing'],
          description: 'Search engine to use (default: google)' 
        },
        sessionId: { type: 'string', description: 'Optional session ID' }
      },
      required: ['query']
    }
  },
  {
    name: 'browser_click',
    description: 'Click an element using natural language description',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Natural language description of element' },
        sessionId: { type: 'string', description: 'Optional session ID' }
      },
      required: ['selector']
    }
  },
  {
    name: 'browser_fill',
    description: 'Fill a form field or search box',
    inputSchema: {
      type: 'object',
      properties: {
        field: { type: 'string', description: 'Natural language description of field' },
        value: { type: 'string', description: 'Value to fill' },
        pressEnter: { type: 'boolean', description: 'Press Enter after filling (default: false)' },
        sessionId: { type: 'string', description: 'Optional session ID' }
      },
      required: ['field', 'value']
    }
  },
  {
    name: 'browser_get_text',
    description: 'Extract text content from page or specific element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Optional element selector' },
        sessionId: { type: 'string', description: 'Optional session ID' }
      }
    }
  },
  {
    name: 'browser_get_links',
    description: 'Get all links from the page',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Optional session ID' }
      }
    }
  },
  {
    name: 'browser_extract_code',
    description: 'Extract code blocks from documentation or GitHub',
    inputSchema: {
      type: 'object',
      properties: {
        language: { type: 'string', description: 'Optional programming language filter' },
        sessionId: { type: 'string', description: 'Optional session ID' }
      }
    }
  },
  {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current page',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: { type: 'boolean', description: 'Capture full page (default: false)' },
        sessionId: { type: 'string', description: 'Optional session ID' }
      }
    }
  },
  {
    name: 'browser_wait',
    description: 'Wait for page to load or element to appear',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Optional element to wait for' },
        timeout: { type: 'number', description: 'Max wait time in ms (default: 5000)' },
        sessionId: { type: 'string', description: 'Optional session ID' }
      }
    }
  },
  {
    name: 'browser_close',
    description: 'Close a browser session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to close (or all if not specified)' }
      }
    }
  }
];

// Register tools handler
server.setRequestHandler('tools/list', async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    let result;
    
    switch (name) {
      case 'browser_navigate': {
        const { instance, sessionId } = await getBrowser(args.sessionId);
        result = await instance.navigate(args.url);
        result.sessionId = sessionId;
        break;
      }
      
      case 'browser_search': {
        const { instance, sessionId } = await getBrowser(args.sessionId);
        const engine = args.engine || 'google';
        const urls = {
          google: 'https://www.google.com',
          duckduckgo: 'https://duckduckgo.com',
          bing: 'https://www.bing.com'
        };
        
        // Navigate to search engine
        await instance.navigate(urls[engine]);
        
        // Fill search box
        const searchSelectors = {
          google: 'search box',
          duckduckgo: 'search input',
          bing: 'search box'
        };
        
        await instance.fill(searchSelectors[engine], args.query);
        
        // Press Enter to search
        await instance.page.keyboard.press('Enter');
        
        // Wait for results
        await instance.page.waitForTimeout(2000);
        
        result = {
          success: true,
          message: `Searched for "${args.query}" on ${engine}`,
          sessionId
        };
        break;
      }
      
      case 'browser_click': {
        const { instance, sessionId } = await getBrowser(args.sessionId);
        result = await instance.click(args.selector);
        result.sessionId = sessionId;
        break;
      }
      
      case 'browser_fill': {
        const { instance, sessionId } = await getBrowser(args.sessionId);
        result = await instance.fill(args.field, args.value);
        
        if (args.pressEnter && instance.page) {
          await instance.page.keyboard.press('Enter');
          result.message += ' (pressed Enter)';
        }
        
        result.sessionId = sessionId;
        break;
      }
      
      case 'browser_get_text': {
        const { instance, sessionId } = await getBrowser(args.sessionId);
        result = await instance.getText(args.selector);
        result.sessionId = sessionId;
        break;
      }
      
      case 'browser_get_links': {
        const { instance, sessionId } = await getBrowser(args.sessionId);
        result = await instance.getLinks();
        result.sessionId = sessionId;
        break;
      }
      
      case 'browser_extract_code': {
        const { instance, sessionId } = await getBrowser(args.sessionId);
        
        // Extract code blocks from the page
        const codeBlocks = await instance.page.evaluate((lang) => {
          const blocks = [];
          
          // GitHub code blocks
          document.querySelectorAll('.blob-code, pre code, .highlight').forEach(el => {
            const text = el.textContent.trim();
            if (text && (!lang || el.className.includes(lang))) {
              blocks.push({
                code: text,
                language: el.className || 'unknown'
              });
            }
          });
          
          // Documentation code blocks
          document.querySelectorAll('pre, code').forEach(el => {
            const text = el.textContent.trim();
            if (text && text.length > 20 && (!lang || el.className.includes(lang))) {
              blocks.push({
                code: text,
                language: el.className || 'unknown'
              });
            }
          });
          
          return blocks;
        }, args.language);
        
        result = {
          success: true,
          data: codeBlocks.slice(0, 5), // Limit to 5 blocks for token efficiency
          sessionId
        };
        break;
      }
      
      case 'browser_screenshot': {
        const { instance, sessionId } = await getBrowser(args.sessionId);
        result = await instance.screenshot({ fullPage: args.fullPage });
        result.sessionId = sessionId;
        break;
      }
      
      case 'browser_wait': {
        const { instance, sessionId } = await getBrowser(args.sessionId);
        const timeout = args.timeout || 5000;
        
        if (args.selector) {
          try {
            await instance.page.waitForSelector(args.selector, { timeout });
            result = { success: true, message: 'Element appeared', sessionId };
          } catch (e) {
            result = { success: false, error: 'Element did not appear', sessionId };
          }
        } else {
          await instance.page.waitForTimeout(timeout);
          result = { success: true, message: `Waited ${timeout}ms`, sessionId };
        }
        break;
      }
      
      case 'browser_close': {
        if (args.sessionId) {
          const browser = browserPool.get(args.sessionId);
          if (browser) {
            await browser.close();
            browserPool.delete(args.sessionId);
            result = { success: true, message: `Closed session ${args.sessionId}` };
          } else {
            result = { success: false, error: 'Session not found' };
          }
        } else {
          // Close all sessions
          for (const [id, browser] of browserPool) {
            await browser.close();
          }
          browserPool.clear();
          result = { success: true, message: 'All sessions closed' };
        }
        break;
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    // Ensure response is AI-optimized (< 1KB)
    const response = JSON.stringify(result);
    if (response.length > 1024 && result.data) {
      // Truncate data if too large
      if (Array.isArray(result.data)) {
        result.data = result.data.slice(0, 3);
      } else if (typeof result.data === 'string') {
        result.data = result.data.substring(0, 500) + '...';
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            suggestion: 'Try a different selector or wait for page to load'
          })
        }
      ],
      isError: true
    };
  }
});

// Clean up on exit
process.on('SIGINT', async () => {
  console.error('Shutting down MCP server...');
  for (const [id, browser] of browserPool) {
    await browser.close().catch(() => {});
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  for (const [id, browser] of browserPool) {
    await browser.close().catch(() => {});
  }
  process.exit(0);
});

// Start the server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('PlayClone MCP Server started successfully');
    console.error(`Available tools: ${tools.length}`);
    console.error('Ready for AI assistant connections via stdio');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Run the server
main();