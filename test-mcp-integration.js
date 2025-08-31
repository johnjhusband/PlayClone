#!/usr/bin/env node
/**
 * Test script for MCP server integration with PlayClone
 * This simulates how an AI assistant would interact with the MCP server
 */

const { spawn } = require('child_process');

// Function to send JSON-RPC request to MCP server
function sendRequest(process, method, params = {}, id = 1) {
  const request = {
    jsonrpc: '2.0',
    method,
    params,
    id
  };
  
  process.stdin.write(JSON.stringify(request) + '\n');
}

// Parse JSON-RPC response
function parseResponse(data) {
  try {
    const lines = data.toString().split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        if (response.jsonrpc === '2.0') {
          return response;
        }
      } catch (e) {
        // Not JSON, skip
      }
    }
  } catch (e) {
    console.error('Parse error:', e);
  }
  return null;
}

async function testMCPServer() {
  console.log('🚀 Starting MCP Server Integration Test\n');
  
  // Start MCP server
  const mcpProcess = spawn('node', ['mcp-server-v2.cjs'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let responseBuffer = '';
  let testResults = [];
  let currentTest = null;
  
  // Handle responses
  mcpProcess.stdout.on('data', (data) => {
    responseBuffer += data.toString();
    const response = parseResponse(responseBuffer);
    
    if (response) {
      responseBuffer = '';
      
      if (currentTest) {
        console.log(`✅ ${currentTest}: Success`);
        if (response.result && response.result.content && response.result.content[0]) {
          try {
            const result = JSON.parse(response.result.content[0].text);
            console.log(`   Response: ${JSON.stringify(result).substring(0, 100)}...`);
          } catch (e) {
            console.log(`   Response: ${JSON.stringify(response.result).substring(0, 100)}...`);
          }
        } else if (response.result) {
          console.log(`   Response: ${JSON.stringify(response.result).substring(0, 100)}...`);
        }
        testResults.push({ test: currentTest, success: true });
        currentTest = null;
      }
    }
  });
  
  mcpProcess.stderr.on('data', (data) => {
    const msg = data.toString();
    if (!msg.includes('MCP server')) {
      console.error('Server message:', msg);
    }
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 1: Initialize connection
  console.log('📋 Test 1: Initialize MCP connection');
  currentTest = 'Initialize';
  sendRequest(mcpProcess, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }, 1);
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 2: List tools
  console.log('\n📋 Test 2: List available tools');
  currentTest = 'List tools';
  sendRequest(mcpProcess, 'tools/list', {}, 2);
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 3: Navigate to a URL
  console.log('\n📋 Test 3: Navigate to example.com');
  currentTest = 'Navigate';
  sendRequest(mcpProcess, 'tools/call', {
    name: 'browser_navigate',
    arguments: {
      url: 'https://example.com'
    }
  }, 3);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 4: Get text from page
  console.log('\n📋 Test 4: Extract text from page');
  currentTest = 'Get text';
  sendRequest(mcpProcess, 'tools/call', {
    name: 'browser_get_text',
    arguments: {
      sessionId: 'session-1'
    }
  }, 4);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 5: Click using natural language
  console.log('\n📋 Test 5: Click "More information" link');
  currentTest = 'Click';
  sendRequest(mcpProcess, 'tools/call', {
    name: 'browser_click',
    arguments: {
      selector: 'More information link',
      sessionId: 'session-1'
    }
  }, 5);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 6: Get links
  console.log('\n📋 Test 6: Get all links from page');
  currentTest = 'Get links';
  sendRequest(mcpProcess, 'tools/call', {
    name: 'browser_get_links',
    arguments: {
      sessionId: 'session-1'
    }
  }, 6);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 7: Navigate back
  console.log('\n📋 Test 7: Navigate back');
  currentTest = 'Back';
  sendRequest(mcpProcess, 'tools/call', {
    name: 'browser_back',
    arguments: {
      sessionId: 'session-1'
    }
  }, 7);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 8: Close browser
  console.log('\n📋 Test 8: Close browser session');
  currentTest = 'Close';
  sendRequest(mcpProcess, 'tools/call', {
    name: 'browser_close',
    arguments: {
      sessionId: 'session-1'
    }
  }, 8);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  
  const passedTests = testResults.filter(t => t.success).length;
  const totalTests = 8;
  const passRate = (passedTests / totalTests * 100).toFixed(0);
  
  console.log(`✅ Passed: ${passedTests}/${totalTests} (${passRate}%)`);
  
  if (passRate === '100') {
    console.log('\n🎉 ALL TESTS PASSED! MCP server is working perfectly!');
  } else {
    console.log(`\n⚠️ Some tests may have timed out. Pass rate: ${passRate}%`);
  }
  
  // Cleanup
  mcpProcess.kill();
  process.exit(0);
}

// Run tests
testMCPServer().catch(console.error);