#!/usr/bin/env node
/**
 * MCP (Model Context Protocol) Server for PlayClone v2
 * Using McpServer for simpler API
 */

const { McpServer } = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js');
const { StdioServerTransport } = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/stdio.js');
const { z } = require('zod');
const { PlayClone } = require('./dist/index.js');

// Global PlayClone instance pool
const browserPool = new Map();
let poolId = 0;

// Create MCP server
const mcpServer = new McpServer({
  name: 'playclone-mcp',
  version: '1.0.0',
});

// Get or create browser instance
async function getBrowser(sessionId) {
  if (!sessionId) {
    sessionId = `session-${++poolId}`;
  }
  
  if (!browserPool.has(sessionId)) {
    const instance = new PlayClone({ 
      headless: true,
      viewport: { width: 1280, height: 720 }
    });
    browserPool.set(sessionId, instance);
  }
  
  return { 
    instance: browserPool.get(sessionId), 
    sessionId 
  };
}

// Clean up browser instance
async function closeBrowser(sessionId) {
  if (browserPool.has(sessionId)) {
    const instance = browserPool.get(sessionId);
    await instance.close();
    browserPool.delete(sessionId);
  }
}

// Register tools
mcpServer.registerTool('browser_navigate', {
  description: 'Navigate to a URL',
  inputSchema: {
    url: z.string().describe('URL to navigate to'),
    sessionId: z.string().optional().describe('Session ID for persistent browser')
  }
}, async ({ url, sessionId }) => {
  const { instance, sessionId: sid } = await getBrowser(sessionId);
  const result = await instance.navigate(url);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ ...result, sessionId: sid })
    }]
  };
});

mcpServer.registerTool('browser_click', {
  description: 'Click an element using natural language',
  inputSchema: {
    selector: z.string().describe('Natural language element description'),
    sessionId: z.string().optional().describe('Session ID')
  }
}, async ({ selector, sessionId }) => {
  const { instance, sessionId: sid } = await getBrowser(sessionId);
  const result = await instance.click(selector);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ ...result, sessionId: sid })
    }]
  };
});

mcpServer.registerTool('browser_fill', {
  description: 'Fill a form field',
  inputSchema: {
    selector: z.string().describe('Natural language field description'),
    value: z.string().describe('Value to fill'),
    sessionId: z.string().optional().describe('Session ID')
  }
}, async ({ selector, value, sessionId }) => {
  const { instance, sessionId: sid } = await getBrowser(sessionId);
  const result = await instance.fill(selector, value);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ ...result, sessionId: sid })
    }]
  };
});

mcpServer.registerTool('browser_get_text', {
  description: 'Get text content from page',
  inputSchema: {
    selector: z.string().optional().describe('Optional element selector'),
    sessionId: z.string().optional().describe('Session ID')
  }
}, async ({ selector, sessionId }) => {
  const { instance, sessionId: sid } = await getBrowser(sessionId);
  const result = await instance.getText(selector);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ ...result, sessionId: sid })
    }]
  };
});

mcpServer.registerTool('browser_get_links', {
  description: 'Get all links from page',
  inputSchema: {
    sessionId: z.string().optional().describe('Session ID')
  }
}, async ({ sessionId }) => {
  const { instance, sessionId: sid } = await getBrowser(sessionId);
  const result = await instance.getLinks();
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ ...result, sessionId: sid })
    }]
  };
});

mcpServer.registerTool('browser_screenshot', {
  description: 'Take a screenshot',
  inputSchema: {
    fullPage: z.boolean().optional().describe('Capture full page'),
    sessionId: z.string().optional().describe('Session ID')
  }
}, async ({ fullPage, sessionId }) => {
  const { instance, sessionId: sid } = await getBrowser(sessionId);
  const result = await instance.screenshot({ fullPage });
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ ...result, sessionId: sid })
    }]
  };
});

mcpServer.registerTool('browser_back', {
  description: 'Navigate back in browser history',
  inputSchema: {
    sessionId: z.string().optional().describe('Session ID')
  }
}, async ({ sessionId }) => {
  const { instance, sessionId: sid } = await getBrowser(sessionId);
  const result = await instance.back();
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ ...result, sessionId: sid })
    }]
  };
});

mcpServer.registerTool('browser_forward', {
  description: 'Navigate forward in browser history',
  inputSchema: {
    sessionId: z.string().optional().describe('Session ID')
  }
}, async ({ sessionId }) => {
  const { instance, sessionId: sid } = await getBrowser(sessionId);
  const result = await instance.forward();
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ ...result, sessionId: sid })
    }]
  };
});

mcpServer.registerTool('browser_close', {
  description: 'Close browser session',
  inputSchema: {
    sessionId: z.string().optional().describe('Session ID to close')
  }
}, async ({ sessionId }) => {
  if (!sessionId) {
    // Close all sessions
    for (const [sid, instance] of browserPool) {
      await instance.close();
    }
    browserPool.clear();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, message: 'All sessions closed' })
      }]
    };
  }
  
  await closeBrowser(sessionId);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ success: true, sessionId })
    }]
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('PlayClone MCP server v2 started');
}

// Handle cleanup
process.on('SIGINT', async () => {
  console.error('Shutting down...');
  for (const [sid, instance] of browserPool) {
    await instance.close();
  }
  process.exit(0);
});

main().catch(console.error);