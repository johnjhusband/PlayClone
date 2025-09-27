/**
 * Test the MCP server implementation
 */

const { spawn } = require('child_process');
const readline = require('readline');

// Start the MCP server
const server = spawn('node', ['mcp-server.cjs']);

// Create readline interface for stdin/stdout
const rl = readline.createInterface({
  input: server.stdout,
  output: process.stdin
});

let messageBuffer = '';

// Send a JSON-RPC request
function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params
  };
  
  const message = JSON.stringify(request);
  console.log('Sending:', message);
  server.stdin.write(message + '\n');
}

// Handle server output
server.stdout.on('data', (data) => {
  messageBuffer += data.toString();
  const lines = messageBuffer.split('\n');
  
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (line) {
      try {
        const message = JSON.parse(line);
        console.log('Received:', JSON.stringify(message, null, 2));
      } catch (e) {
        console.log('Non-JSON output:', line);
      }
    }
  }
  
  messageBuffer = lines[lines.length - 1];
});

server.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

// Test sequence
async function runTests() {
  console.log('Testing MCP Server...\n');
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 1: List tools
  console.log('\n=== Test 1: List Tools ===');
  sendRequest('tools/list');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Navigate
  console.log('\n=== Test 2: Navigate to Example.com ===');
  sendRequest('tools/call', {
    name: 'browser_navigate',
    arguments: { url: 'https://example.com' }
  });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 3: Get text
  console.log('\n=== Test 3: Get Text from Page ===');
  sendRequest('tools/call', {
    name: 'browser_get_text',
    arguments: { sessionId: 'session-1' }
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 4: Close browser
  console.log('\n=== Test 4: Close Browser ===');
  sendRequest('tools/call', {
    name: 'browser_close',
    arguments: { sessionId: 'session-1' }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Exit
  console.log('\nTests complete. Closing server...');
  server.kill();
  process.exit(0);
}

runTests().catch(console.error);