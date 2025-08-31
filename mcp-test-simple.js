#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server');
const { StdioServerTransport } = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/stdio.js');

// Create server
const server = new Server(
  {
    name: 'test-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Simple tool
const tools = [
  {
    name: 'hello',
    description: 'Say hello',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    }
  }
];

// Register handlers using the correct API
server.setRequestHandler({
  method: 'tools/list',
  handler: async () => ({ tools })
});

server.setRequestHandler({
  method: 'tools/call',
  handler: async (request) => {
    const { name, arguments: args } = request.params;
    
    if (name === 'hello') {
      return {
        content: [
          {
            type: 'text',
            text: `Hello, ${args.name || 'world'}!`
          }
        ]
      };
    }
    
    throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP test server started');
}

main().catch(console.error);