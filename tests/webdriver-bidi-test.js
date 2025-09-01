/**
 * WebDriver BiDi Protocol Test Suite
 * Tests the WebDriver BiDi implementation for PlayClone
 */

const WebSocket = require('ws');
const { PlayClone } = require('../dist/index');
const { WebDriverBiDi } = require('../dist/compatibility/WebDriverBiDi');

// Test configuration
const BIDI_PORT = 9223; // Use different port to avoid conflicts
const WS_URL = `ws://localhost:${BIDI_PORT}`;

// Helper to send command and get response
async function sendCommand(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Date.now();
    
    const listener = (data) => {
      const response = JSON.parse(data);
      if (response.id === id) {
        ws.removeListener('message', listener);
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      }
    };
    
    ws.on('message', listener);
    ws.send(JSON.stringify({ id, method, params }));
    
    // Timeout after 5 seconds
    setTimeout(() => {
      ws.removeListener('message', listener);
      reject(new Error('Command timeout'));
    }, 5000);
  });
}

async function runTests() {
  console.log('🚀 Starting WebDriver BiDi Protocol Tests\n');
  
  let playclone;
  let bidiServer;
  let ws;
  let sessionId;
  let contextId;
  let passed = 0;
  let failed = 0;

  try {
    // Start BiDi server
    console.log('Starting BiDi server...');
    playclone = new PlayClone({ headless: true });
    bidiServer = new WebDriverBiDi(playclone, BIDI_PORT);
    await bidiServer.start();
    console.log(`✅ BiDi server started on port ${BIDI_PORT}\n`);

    // Connect WebSocket client
    console.log('Connecting WebSocket client...');
    ws = new WebSocket(WS_URL);
    
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
    console.log('✅ WebSocket connected\n');

    // Test 1: Get server status
    console.log('Test 1: Get server status');
    try {
      const status = await sendCommand(ws, 'session.status');
      console.assert(status.ready === true, 'Server should be ready');
      console.assert(status.message, 'Status should have message');
      console.log('✅ Server status retrieved');
      passed++;
    } catch (error) {
      console.error('❌ Failed to get server status:', error.message);
      failed++;
    }

    // Test 2: Create new session
    console.log('\nTest 2: Create new session');
    try {
      const session = await sendCommand(ws, 'session.new', {
        capabilities: {
          browserName: 'chromium',
          acceptInsecureCerts: true
        }
      });
      sessionId = session.sessionId;
      contextId = session.contexts[0];
      console.assert(sessionId, 'Should have session ID');
      console.assert(session.capabilities, 'Should have capabilities');
      console.assert(session.contexts.length > 0, 'Should have at least one context');
      console.log(`✅ Session created: ${sessionId}`);
      passed++;
    } catch (error) {
      console.error('❌ Failed to create session:', error.message);
      failed++;
    }

    // Test 3: Navigate to URL
    console.log('\nTest 3: Navigate to URL');
    try {
      const nav = await sendCommand(ws, 'browsingContext.navigate', {
        context: contextId,
        url: 'https://example.com',
        wait: 'complete'
      });
      console.assert(nav.navigation, 'Should have navigation ID');
      console.assert(nav.url, 'Should have URL');
      console.log(`✅ Navigated to: ${nav.url}`);
      passed++;
    } catch (error) {
      console.error('❌ Failed to navigate:', error.message);
      failed++;
    }

    // Test 4: Get context tree
    console.log('\nTest 4: Get context tree');
    try {
      const tree = await sendCommand(ws, 'browsingContext.getTree');
      console.assert(tree.contexts, 'Should have contexts');
      console.assert(tree.contexts.length > 0, 'Should have at least one context');
      console.log(`✅ Context tree retrieved: ${tree.contexts.length} contexts`);
      passed++;
    } catch (error) {
      console.error('❌ Failed to get context tree:', error.message);
      failed++;
    }

    // Test 5: Evaluate script
    console.log('\nTest 5: Evaluate script');
    try {
      const result = await sendCommand(ws, 'script.evaluate', {
        context: contextId,
        expression: 'document.title'
      });
      console.assert(result.result, 'Should have result');
      console.log(`✅ Script evaluated, title: ${result.result.value || result.result}`);
      passed++;
    } catch (error) {
      console.error('❌ Failed to evaluate script:', error.message);
      failed++;
    }

    // Test 6: Call function
    console.log('\nTest 6: Call function');
    try {
      const result = await sendCommand(ws, 'script.callFunction', {
        context: contextId,
        functionDeclaration: 'return window.location.href',
        arguments: []
      });
      console.assert(result.result, 'Should have result');
      console.log(`✅ Function called, URL: ${result.result.value || result.result}`);
      passed++;
    } catch (error) {
      console.error('❌ Failed to call function:', error.message);
      failed++;
    }

    // Test 7: Capture screenshot
    console.log('\nTest 7: Capture screenshot');
    try {
      const screenshot = await sendCommand(ws, 'browsingContext.captureScreenshot', {
        context: contextId,
        options: { format: 'png' }
      });
      console.assert(screenshot.data, 'Should have screenshot data');
      console.log(`✅ Screenshot captured: ${screenshot.data.length} bytes (base64)`);
      passed++;
    } catch (error) {
      console.error('❌ Failed to capture screenshot:', error.message);
      failed++;
    }

    // Test 8: Get cookies
    console.log('\nTest 8: Get cookies');
    try {
      const cookies = await sendCommand(ws, 'storage.getCookies', {
        context: contextId
      });
      console.assert(cookies.cookies !== undefined, 'Should have cookies array');
      console.log(`✅ Cookies retrieved: ${cookies.cookies.length} cookies`);
      passed++;
    } catch (error) {
      console.error('❌ Failed to get cookies:', error.message);
      failed++;
    }

    // Test 9: Set viewport
    console.log('\nTest 9: Set viewport');
    try {
      const result = await sendCommand(ws, 'browsingContext.setViewport', {
        context: contextId,
        viewport: { width: 1280, height: 720 }
      });
      console.assert(result.success === true, 'Should succeed');
      console.log('✅ Viewport set to 1280x720');
      passed++;
    } catch (error) {
      console.error('❌ Failed to set viewport:', error.message);
      failed++;
    }

    // Test 10: Perform input actions
    console.log('\nTest 10: Perform input actions');
    try {
      const result = await sendCommand(ws, 'input.performActions', {
        context: contextId,
        actions: [{
          type: 'pointer',
          id: 'mouse1',
          actions: [
            { type: 'pointerMove', x: 100, y: 100 },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerUp', button: 0 }
          ]
        }]
      });
      console.assert(result.success === true, 'Should succeed');
      console.log('✅ Input actions performed (click at 100,100)');
      passed++;
    } catch (error) {
      console.error('❌ Failed to perform input actions:', error.message);
      failed++;
    }

    // Test 11: Reload page
    console.log('\nTest 11: Reload page');
    try {
      const nav = await sendCommand(ws, 'browsingContext.reload', {
        context: contextId,
        ignoreCache: false,
        wait: 'complete'
      });
      console.assert(nav.navigation, 'Should have navigation ID');
      console.log(`✅ Page reloaded: ${nav.url}`);
      passed++;
    } catch (error) {
      console.error('❌ Failed to reload page:', error.message);
      failed++;
    }

    // Test 12: Create new context
    console.log('\nTest 12: Create new context');
    try {
      const newContext = await sendCommand(ws, 'browsingContext.create', {
        type: 'tab'
      });
      console.assert(newContext.context, 'Should have context ID');
      console.log(`✅ New context created: ${newContext.context}`);
      
      // Close the new context
      await sendCommand(ws, 'browsingContext.close', {
        context: newContext.context
      });
      console.log('✅ New context closed');
      passed++;
    } catch (error) {
      console.error('❌ Failed to create/close context:', error.message);
      failed++;
    }

    // Test 13: Subscribe to events
    console.log('\nTest 13: Subscribe to events');
    try {
      const result = await sendCommand(ws, 'session.subscribe', {
        events: ['browsingContext.load', 'network.responseCompleted']
      });
      console.assert(result.success === true, 'Should succeed');
      console.log('✅ Subscribed to events');
      passed++;
    } catch (error) {
      console.error('❌ Failed to subscribe to events:', error.message);
      failed++;
    }

    // Test 14: Get realms
    console.log('\nTest 14: Get script realms');
    try {
      const realms = await sendCommand(ws, 'script.getRealms', {
        context: contextId
      });
      console.assert(realms.realms, 'Should have realms');
      console.assert(realms.realms.length > 0, 'Should have at least one realm');
      console.log(`✅ Realms retrieved: ${realms.realms.length} realms`);
      passed++;
    } catch (error) {
      console.error('❌ Failed to get realms:', error.message);
      failed++;
    }

    // Test 15: End session
    console.log('\nTest 15: End session');
    try {
      const result = await sendCommand(ws, 'session.end', {
        sessionId: sessionId
      });
      console.assert(result.success === true, 'Should succeed');
      console.log('✅ Session ended');
      passed++;
    } catch (error) {
      console.error('❌ Failed to end session:', error.message);
      failed++;
    }

  } catch (error) {
    console.error('\n❌ Test suite error:', error);
    failed++;
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    
    if (ws) {
      ws.close();
      console.log('✅ WebSocket closed');
    }
    
    if (bidiServer) {
      await bidiServer.stop();
      console.log('✅ BiDi server stopped');
    }
    
    if (playclone) {
      await playclone.close();
      console.log('✅ PlayClone closed');
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 WebDriver BiDi Test Results:');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n🎉 All WebDriver BiDi tests passed!');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the output above.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(console.error);