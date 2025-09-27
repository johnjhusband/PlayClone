/**
 * Simple test to check MCP SDK version and functionality
 */

const { Server } = require('@modelcontextprotocol/sdk');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk');

console.log('Testing MCP SDK...');

try {
  // Try to create a server instance
  const server = new Server(
    {
      name: 'test',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );
  
  console.log('Server created successfully');
  console.log('Server info:', server);
} catch (error) {
  console.error('Failed to create server:', error.message);
  console.error('Stack:', error.stack);
}