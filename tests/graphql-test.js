#!/usr/bin/env node

/**
 * GraphQL API Server Test
 * 
 * Tests the GraphQL API functionality for PlayClone
 */

const { GraphQLApiServer } = require('../dist/server/GraphQLApiServer');
const fetch = require('node-fetch');

// Test configuration
const TEST_PORT = 4001;
const GRAPHQL_ENDPOINT = `http://localhost:${TEST_PORT}/graphql`;

// GraphQL queries for testing
const QUERIES = {
  createSession: `
    mutation CreateSession($headless: Boolean) {
      createSession(headless: $headless) {
        id
        createdAt
        isActive
      }
    }
  `,
  
  navigate: `
    mutation Navigate($sessionId: String!, $url: String!) {
      navigate(sessionId: $sessionId, url: $url) {
        success
        url
        title
        error
      }
    }
  `,
  
  getText: `
    query GetText($sessionId: String!) {
      getText(sessionId: $sessionId)
    }
  `,
  
  click: `
    mutation Click($sessionId: String!, $selector: String!) {
      click(sessionId: $sessionId, selector: $selector) {
        success
        error
      }
    }
  `,
  
  listSessions: `
    query ListSessions {
      listSessions {
        id
        isActive
        createdAt
      }
    }
  `,
  
  closeSession: `
    mutation CloseSession($sessionId: String!) {
      closeSession(sessionId: $sessionId)
    }
  `
};

// Helper function to execute GraphQL queries
async function executeQuery(query, variables = {}) {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
    }
    
    return result;
  } catch (error) {
    console.error('Query execution error:', error);
    throw error;
  }
}

// Test functions
async function testCreateSession() {
  console.log('\n📝 Testing session creation...');
  const result = await executeQuery(QUERIES.createSession, { headless: true });
  
  if (result.data?.createSession?.id) {
    console.log('✅ Session created:', result.data.createSession.id);
    return result.data.createSession.id;
  } else {
    console.error('❌ Failed to create session');
    return null;
  }
}

async function testNavigation(sessionId) {
  console.log('\n🌐 Testing navigation...');
  const result = await executeQuery(QUERIES.navigate, {
    sessionId,
    url: 'https://example.com'
  });
  
  if (result.data?.navigate?.success) {
    console.log('✅ Navigation successful:', result.data.navigate.url);
    return true;
  } else {
    console.error('❌ Navigation failed:', result.data?.navigate?.error);
    return false;
  }
}

async function testGetText(sessionId) {
  console.log('\n📖 Testing text extraction...');
  const result = await executeQuery(QUERIES.getText, { sessionId });
  
  if (result.data?.getText) {
    console.log('✅ Text extracted:', result.data.getText.substring(0, 100) + '...');
    return true;
  } else {
    console.error('❌ Failed to extract text');
    return false;
  }
}

async function testClick(sessionId) {
  console.log('\n🖱️ Testing click action...');
  const result = await executeQuery(QUERIES.click, {
    sessionId,
    selector: 'h1'
  });
  
  if (result.data?.click?.success !== false) {
    console.log('✅ Click action executed');
    return true;
  } else {
    console.error('❌ Click failed:', result.data?.click?.error);
    return false;
  }
}

async function testListSessions() {
  console.log('\n📋 Testing list sessions...');
  const result = await executeQuery(QUERIES.listSessions);
  
  if (result.data?.listSessions) {
    console.log('✅ Sessions listed:', result.data.listSessions.length, 'sessions');
    return true;
  } else {
    console.error('❌ Failed to list sessions');
    return false;
  }
}

async function testCloseSession(sessionId) {
  console.log('\n🔒 Testing session closure...');
  const result = await executeQuery(QUERIES.closeSession, { sessionId });
  
  if (result.data?.closeSession) {
    console.log('✅ Session closed successfully');
    return true;
  } else {
    console.error('❌ Failed to close session');
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting GraphQL API Server Tests\n');
  console.log('==================================');
  
  // Create server
  const server = new GraphQLApiServer({
    port: TEST_PORT,
    playground: false
  });
  
  try {
    // Start server
    console.log(`Starting GraphQL server on port ${TEST_PORT}...`);
    await server.start();
    console.log('✅ Server started successfully\n');
    
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Run tests
    let sessionId = null;
    let testsPassed = 0;
    let testsFailed = 0;
    
    // Test 1: Create session
    sessionId = await testCreateSession();
    if (sessionId) testsPassed++; else testsFailed++;
    
    if (sessionId) {
      // Test 2: Navigate
      if (await testNavigation(sessionId)) testsPassed++; else testsFailed++;
      
      // Test 3: Get text
      if (await testGetText(sessionId)) testsPassed++; else testsFailed++;
      
      // Test 4: Click
      if (await testClick(sessionId)) testsPassed++; else testsFailed++;
      
      // Test 5: List sessions
      if (await testListSessions()) testsPassed++; else testsFailed++;
      
      // Test 6: Close session
      if (await testCloseSession(sessionId)) testsPassed++; else testsFailed++;
    }
    
    // Print results
    console.log('\n==================================');
    console.log('📊 Test Results:');
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
  } finally {
    // Stop server
    console.log('\n🛑 Stopping server...');
    await server.stop();
    console.log('✅ Server stopped');
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

// Check if node-fetch is installed
try {
  require.resolve('node-fetch');
} catch (e) {
  console.log('Installing node-fetch for testing...');
  require('child_process').execSync('npm install node-fetch', { stdio: 'inherit' });
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});