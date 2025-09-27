#!/usr/bin/env node

// Test script to verify MCP SDK imports
console.log('Testing MCP SDK imports...');

try {
  // Test 1: Direct file import
  const stdio = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/stdio.js');
  console.log('✅ Direct stdio import works:', Object.keys(stdio));
} catch (e) {
  console.log('❌ Direct stdio import failed:', e.message);
}

try {
  // Test 2: Server module
  const server = require('@modelcontextprotocol/sdk/server');
  console.log('✅ Server module import works:', Object.keys(server));
} catch (e) {
  console.log('❌ Server module import failed:', e.message);
}

try {
  // Test 3: Check if we can use ESM imports in Node 18+
  console.log('Node version:', process.version);
} catch (e) {
  console.log('Error:', e.message);
}