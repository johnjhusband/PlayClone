#!/usr/bin/env node
/**
 * MCP (Model Context Protocol) Server for PlayClone
 * Exposes PlayClone functionality via MCP for AI assistants
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PlayClone } from './dist/index.js';

// Global PlayClone instance
let playclone = null;

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

// Tool definitions
const tools = [
  {
    name: 'browser_navigate',
    description: 'Navigate browser to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' }
      },
      required: ['url']
    }
  },
  {
    name: 'browser_click',
    description: 'Click an element using natural language description',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Natural language description of element' }
      },
      required: ['selector']
    }
  },
  {
    name: 'browser_fill',
    description: 'Fill a form field',
    inputSchema: {
      type: 'object',
      properties: {
        field: { type: 'string', description: 'Natural language description of field' },
        value: { type: 'string', description: 'Value to fill' }
      },
      required: ['field', 'value']
    }
  },
  {
    name: 'browser_get_text',
    description: 'Extract text content from page',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Optional element selector' }
      }
    }
  },
  {
    name: 'browser_get_links',
    description: 'Get all links from the page',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'browser_screenshot',
    description: 'Take a screenshot',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: { type: 'boolean', description: 'Capture full page' }
      }
    }
  },
  {
    name: 'browser_back',
    description: 'Navigate back in browser history',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'browser_forward',
    description: 'Navigate forward in browser history',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'browser_reload',
    description: 'Reload the current page',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'browser_save_state',
    description: 'Save current browser state',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'State checkpoint name' }
      },
      required: ['name']
    }
  },
  {
    name: 'browser_restore_state',
    description: 'Restore saved browser state',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'State checkpoint name' }
      },
      required: ['name']
    }
  },
  {
    name: 'browser_close',
    description: 'Close the browser',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Register tools
server.setRequestHandler('tools/list', async () => {
  return {
    tools
  };
});

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    // Initialize PlayClone if needed
    if (!playclone && name !== 'browser_close') {
      playclone = new PlayClone({ 
        headless: true,
        timeout: 30000 
      });
    }
    
    let result;
    
    switch (name) {
      case 'browser_navigate':
        result = await playclone.navigate(args.url);
        break;
        
      case 'browser_click':
        result = await playclone.click(args.selector);
        break;
        
      case 'browser_fill':
        result = await playclone.fill(args.field, args.value);
        break;
        
      case 'browser_get_text':
        result = await playclone.getText(args.selector);
        break;
        
      case 'browser_get_links':
        result = await playclone.getLinks();
        break;
        
      case 'browser_screenshot':
        result = await playclone.screenshot({ fullPage: args.fullPage });
        break;
        
      case 'browser_back':
        result = await playclone.back();
        break;
        
      case 'browser_forward':
        result = await playclone.forward();
        break;
        
      case 'browser_reload':
        result = await playclone.reload();
        break;
        
      case 'browser_save_state':
        result = await playclone.saveState(args.name);
        break;
        
      case 'browser_restore_state':
        result = await playclone.restoreState(args.name);
        break;
        
      case 'browser_close':
        if (playclone) {
          result = await playclone.close();
          playclone = null;
        } else {
          result = { success: true, message: 'Browser already closed' };
        }
        break;
        
      default:
        throw new Error(`Unknown tool: ${name}`);
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
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// Clean up on exit
process.on('SIGINT', async () => {
  if (playclone) {
    await playclone.close();
  }
  process.exit(0);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PlayClone MCP Server started on stdio transport');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});