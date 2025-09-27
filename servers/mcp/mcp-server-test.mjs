#!/usr/bin/env node
/**
 * MCP Server Test - Minimal implementation to verify SDK
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Create server with proper initialization
const server = new Server(
  {
    name: 'playclone-test',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define a simple test tool
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'test_tool',
        description: 'Test tool to verify MCP is working',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          },
          required: ['message']
        }
      }
    ]
  };
});

// Handle tool execution
server.setRequestHandler('tools/call', async (request) => {
  return {
    content: [
      {
        type: 'text',
        text: `Test response: ${request.params.arguments?.message || 'no message'}`
      }
    ]
  };
});

// Main function
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Test MCP Server started successfully');
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Only run if executed directly
if (process.argv[1] === import.meta.url.slice(7)) {
  main();
}