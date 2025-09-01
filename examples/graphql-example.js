#!/usr/bin/env node

/**
 * PlayClone GraphQL API Example
 * 
 * Demonstrates how to use PlayClone through its GraphQL API
 * for browser automation tasks.
 */

const fetch = require('node-fetch');

// GraphQL endpoint (adjust if your server runs on a different port)
const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

/**
 * Execute a GraphQL query or mutation
 */
async function graphqlRequest(query, variables = {}) {
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
  
  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
  }
  
  return result.data;
}

/**
 * Example 1: Basic Browser Automation
 */
async function basicAutomationExample() {
  console.log('\n📌 Example 1: Basic Browser Automation');
  console.log('=====================================');
  
  // Create a new browser session
  const createSessionMutation = `
    mutation CreateSession($headless: Boolean) {
      createSession(headless: $headless) {
        id
        createdAt
        isActive
      }
    }
  `;
  
  const { createSession } = await graphqlRequest(createSessionMutation, {
    headless: false // Set to true for headless mode
  });
  
  const sessionId = createSession.id;
  console.log(`✅ Session created: ${sessionId}`);
  
  // Navigate to a website
  const navigateMutation = `
    mutation Navigate($sessionId: String!, $url: String!) {
      navigate(sessionId: $sessionId, url: $url) {
        success
        url
        error
      }
    }
  `;
  
  await graphqlRequest(navigateMutation, {
    sessionId,
    url: 'https://example.com'
  });
  console.log('✅ Navigated to example.com');
  
  // Extract text from the page
  const getTextQuery = `
    query GetText($sessionId: String!, $selector: String) {
      getText(sessionId: $sessionId, selector: $selector)
    }
  `;
  
  const { getText } = await graphqlRequest(getTextQuery, {
    sessionId,
    selector: 'h1'
  });
  console.log(`📝 H1 Text: ${getText}`);
  
  // Take a screenshot
  const screenshotMutation = `
    mutation TakeScreenshot($sessionId: String!, $fullPage: Boolean) {
      takeScreenshot(sessionId: $sessionId, fullPage: $fullPage) {
        data
        format
      }
    }
  `;
  
  const { takeScreenshot } = await graphqlRequest(screenshotMutation, {
    sessionId,
    fullPage: false
  });
  console.log('📸 Screenshot taken (base64 encoded)');
  
  // Close the session
  const closeSessionMutation = `
    mutation CloseSession($sessionId: String!) {
      closeSession(sessionId: $sessionId)
    }
  `;
  
  await graphqlRequest(closeSessionMutation, { sessionId });
  console.log('✅ Session closed');
}

/**
 * Example 2: Form Automation
 */
async function formAutomationExample() {
  console.log('\n📌 Example 2: Form Automation');
  console.log('============================');
  
  // Create session
  const { createSession } = await graphqlRequest(`
    mutation {
      createSession(headless: false) {
        id
      }
    }
  `);
  
  const sessionId = createSession.id;
  console.log(`✅ Session created: ${sessionId}`);
  
  // Navigate to a form page
  await graphqlRequest(`
    mutation Navigate($sessionId: String!, $url: String!) {
      navigate(sessionId: $sessionId, url: $url) {
        success
      }
    }
  `, {
    sessionId,
    url: 'https://www.google.com'
  });
  console.log('✅ Navigated to Google');
  
  // Fill the search form
  const fillMutation = `
    mutation Fill($sessionId: String!, $selector: String!, $value: String!) {
      fill(sessionId: $sessionId, selector: $selector, value: $value) {
        success
        error
      }
    }
  `;
  
  await graphqlRequest(fillMutation, {
    sessionId,
    selector: 'input[name="q"]',
    value: 'PlayClone browser automation'
  });
  console.log('✅ Filled search input');
  
  // Submit the form
  const pressMutation = `
    mutation Press($sessionId: String!, $key: String!) {
      press(sessionId: $sessionId, key: $key) {
        success
      }
    }
  `;
  
  await graphqlRequest(pressMutation, {
    sessionId,
    key: 'Enter'
  });
  console.log('✅ Submitted search');
  
  // Wait a moment for results to load
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Extract search results
  const { getLinks } = await graphqlRequest(`
    query GetLinks($sessionId: String!) {
      getLinks(sessionId: $sessionId) {
        text
        href
      }
    }
  `, { sessionId });
  
  console.log(`📊 Found ${getLinks.length} links`);
  if (getLinks.length > 0) {
    console.log('First few results:');
    getLinks.slice(0, 3).forEach(link => {
      console.log(`  - ${link.text}: ${link.href}`);
    });
  }
  
  // Close session
  await graphqlRequest(`
    mutation CloseSession($sessionId: String!) {
      closeSession(sessionId: $sessionId)
    }
  `, { sessionId });
  console.log('✅ Session closed');
}

/**
 * Example 3: State Management
 */
async function stateManagementExample() {
  console.log('\n📌 Example 3: State Management');
  console.log('==============================');
  
  // Create session
  const { createSession } = await graphqlRequest(`
    mutation {
      createSession(headless: false) {
        id
      }
    }
  `);
  
  const sessionId = createSession.id;
  console.log(`✅ Session created: ${sessionId}`);
  
  // Navigate to first page
  await graphqlRequest(`
    mutation Navigate($sessionId: String!, $url: String!) {
      navigate(sessionId: $sessionId, url: $url) {
        success
      }
    }
  `, {
    sessionId,
    url: 'https://example.com'
  });
  console.log('✅ Navigated to example.com');
  
  // Create a checkpoint
  const { createCheckpoint } = await graphqlRequest(`
    mutation CreateCheckpoint($sessionId: String!, $name: String!) {
      createCheckpoint(sessionId: $sessionId, name: $name) {
        id
        name
        url
      }
    }
  `, {
    sessionId,
    name: 'example-page'
  });
  console.log(`💾 Checkpoint created: ${createCheckpoint.name}`);
  
  // Navigate to another page
  await graphqlRequest(`
    mutation Navigate($sessionId: String!, $url: String!) {
      navigate(sessionId: $sessionId, url: $url) {
        success
      }
    }
  `, {
    sessionId,
    url: 'https://github.com'
  });
  console.log('✅ Navigated to github.com');
  
  // Restore the checkpoint
  await graphqlRequest(`
    mutation RestoreCheckpoint($sessionId: String!, $checkpointId: String!) {
      restoreCheckpoint(sessionId: $sessionId, checkpointId: $checkpointId) {
        success
      }
    }
  `, {
    sessionId,
    checkpointId: createCheckpoint.id
  });
  console.log('↩️ Restored checkpoint - back to example.com');
  
  // Verify we're back at the original page
  const { getCurrentUrl } = await graphqlRequest(`
    query GetCurrentUrl($sessionId: String!) {
      getCurrentUrl(sessionId: $sessionId)
    }
  `, { sessionId });
  console.log(`📍 Current URL: ${getCurrentUrl}`);
  
  // Clean up
  await graphqlRequest(`
    mutation CloseSession($sessionId: String!) {
      closeSession(sessionId: $sessionId)
    }
  `, { sessionId });
  console.log('✅ Session closed');
}

/**
 * Example 4: Parallel Sessions
 */
async function parallelSessionsExample() {
  console.log('\n📌 Example 4: Parallel Sessions');
  console.log('================================');
  
  // Create multiple sessions
  const sessions = await Promise.all([
    graphqlRequest(`mutation { createSession(headless: true) { id } }`),
    graphqlRequest(`mutation { createSession(headless: true) { id } }`),
    graphqlRequest(`mutation { createSession(headless: true) { id } }`)
  ]);
  
  const sessionIds = sessions.map(s => s.createSession.id);
  console.log(`✅ Created ${sessionIds.length} parallel sessions`);
  
  // Navigate all sessions to different pages
  const urls = [
    'https://example.com',
    'https://github.com',
    'https://www.wikipedia.org'
  ];
  
  await Promise.all(sessionIds.map((sessionId, index) =>
    graphqlRequest(`
      mutation Navigate($sessionId: String!, $url: String!) {
        navigate(sessionId: $sessionId, url: $url) {
          success
        }
      }
    `, {
      sessionId,
      url: urls[index]
    })
  ));
  console.log('✅ All sessions navigated to different pages');
  
  // Extract text from all sessions
  const texts = await Promise.all(sessionIds.map(sessionId =>
    graphqlRequest(`
      query GetText($sessionId: String!) {
        getText(sessionId: $sessionId, selector: "h1")
      }
    `, { sessionId })
  ));
  
  texts.forEach((result, index) => {
    console.log(`📝 Session ${index + 1} H1: ${result.getText}`);
  });
  
  // List all active sessions
  const { listSessions } = await graphqlRequest(`
    query {
      listSessions {
        id
        isActive
      }
    }
  `);
  console.log(`📊 Total active sessions: ${listSessions.length}`);
  
  // Close all sessions
  await graphqlRequest(`
    mutation {
      closeAllSessions
    }
  `);
  console.log('✅ All sessions closed');
}

/**
 * Main function to run examples
 */
async function main() {
  console.log('🚀 PlayClone GraphQL API Examples');
  console.log('==================================');
  console.log('Make sure the GraphQL server is running:');
  console.log('  node graphql-server.js');
  console.log('');
  
  try {
    // Check if server is running
    await fetch(GRAPHQL_ENDPOINT);
  } catch (error) {
    console.error('❌ GraphQL server is not running!');
    console.error('Please start it with: node graphql-server.js');
    process.exit(1);
  }
  
  // Run examples
  try {
    await basicAutomationExample();
    await formAutomationExample();
    await stateManagementExample();
    await parallelSessionsExample();
    
    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Example failed:', error.message);
    process.exit(1);
  }
}

// Check if node-fetch is installed
try {
  require.resolve('node-fetch');
} catch (e) {
  console.log('Installing node-fetch...');
  require('child_process').execSync('npm install node-fetch', { stdio: 'inherit' });
}

// Run the examples
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});