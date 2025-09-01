#!/usr/bin/env node

/**
 * WebSocket Interception Test
 * Tests PlayClone's WebSocket message inspection and modification capabilities
 */

const { PlayClone } = require('../dist/index');

async function runWebSocketTest() {
  console.log('🔌 WebSocket Interception Test\n');
  console.log('=' .repeat(50));
  
  const pc = new PlayClone({ headless: false });
  const results = [];
  
  try {
    // Test 1: Navigate to WebSocket test page
    console.log('\n1️⃣ Navigating to WebSocket test page...');
    const navResult = await pc.navigate('https://websocket.org/echo.html');
    results.push({
      test: 'Navigation',
      passed: navResult.success,
      details: navResult.success ? 'Navigated to WebSocket echo test' : navResult.error
    });
    
    // Test 2: Enable WebSocket interception
    console.log('2️⃣ Enabling WebSocket interception...');
    const enableResult = await pc.enableWebSocketInterception();
    results.push({
      test: 'Enable Interception',
      passed: enableResult.success,
      details: enableResult.success ? 'WebSocket interception enabled' : enableResult.error
    });
    
    // Test 3: Add frame handler to log messages
    console.log('3️⃣ Adding WebSocket frame handler...');
    let messageCount = 0;
    pc.addWebSocketFrameHandler('logger', (frame, connection) => {
      console.log(`   📨 Frame: ${frame.direction} - ${frame.type} - ${frame.data.toString().substring(0, 50)}...`);
      messageCount++;
    });
    results.push({
      test: 'Add Frame Handler',
      passed: true,
      details: 'Frame handler added successfully'
    });
    
    // Test 4: Trigger WebSocket connection
    console.log('4️⃣ Triggering WebSocket connection...');
    await pc.page.waitForTimeout(2000); // Wait for page to load
    
    // Click connect button if it exists
    try {
      await pc.click('connect button');
      console.log('   ✅ Clicked connect button');
    } catch (e) {
      console.log('   ℹ️ No connect button found, WebSocket may auto-connect');
    }
    
    // Test 5: Send a test message
    console.log('5️⃣ Sending test message...');
    try {
      // Try to fill the message input and send
      await pc.fill('message input', 'Hello WebSocket!');
      await pc.click('send button');
      results.push({
        test: 'Send Message',
        passed: true,
        details: 'Test message sent'
      });
    } catch (e) {
      results.push({
        test: 'Send Message',
        passed: false,
        details: 'Could not send message - ' + e.message
      });
    }
    
    // Wait for WebSocket activity
    await pc.page.waitForTimeout(3000);
    
    // Test 6: Get WebSocket connections
    console.log('6️⃣ Getting WebSocket connections...');
    const connections = pc.getWebSocketConnections();
    results.push({
      test: 'Get Connections',
      passed: connections.length > 0,
      details: `Found ${connections.length} WebSocket connection(s)`
    });
    
    if (connections.length > 0) {
      console.log(`   📊 Connection details:`);
      connections.forEach(conn => {
        console.log(`      - URL: ${conn.url}`);
        console.log(`      - State: ${conn.state}`);
        console.log(`      - Frames: ${conn.frameCount}`);
        console.log(`      - Bytes sent: ${conn.bytesSent}`);
        console.log(`      - Bytes received: ${conn.bytesReceived}`);
      });
    }
    
    // Test 7: Get WebSocket frames
    console.log('7️⃣ Getting WebSocket frames...');
    const frames = pc.getWebSocketFrames();
    results.push({
      test: 'Get Frames',
      passed: frames.length > 0,
      details: `Captured ${frames.length} WebSocket frame(s)`
    });
    
    if (frames.length > 0) {
      console.log(`   📝 Recent frames:`);
      frames.slice(-5).forEach(frame => {
        const data = typeof frame.data === 'string' ? frame.data : frame.data.toString();
        console.log(`      - ${frame.direction}: ${data.substring(0, 50)}`);
      });
    }
    
    // Test 8: Get WebSocket statistics
    console.log('8️⃣ Getting WebSocket statistics...');
    const stats = pc.getWebSocketStatistics();
    results.push({
      test: 'Get Statistics',
      passed: stats !== null,
      details: stats ? `${stats.totalConnections} connections, ${stats.totalFrames} frames` : 'No statistics available'
    });
    
    if (stats) {
      console.log(`   📈 Statistics:`);
      console.log(`      - Total connections: ${stats.totalConnections}`);
      console.log(`      - Active connections: ${stats.activeConnections}`);
      console.log(`      - Total frames: ${stats.totalFrames}`);
      console.log(`      - Bytes sent: ${stats.totalBytesSent}`);
      console.log(`      - Bytes received: ${stats.totalBytesReceived}`);
    }
    
    // Test 9: Export capture
    console.log('9️⃣ Exporting WebSocket capture...');
    const capture = pc.exportWebSocketCapture();
    results.push({
      test: 'Export Capture',
      passed: capture !== null && capture.connections && capture.frames,
      details: capture ? 'Capture exported successfully' : 'Failed to export capture'
    });
    
    // Test 10: Disable interception
    console.log('🔟 Disabling WebSocket interception...');
    const disableResult = await pc.disableWebSocketInterception();
    results.push({
      test: 'Disable Interception',
      passed: disableResult.success,
      details: disableResult.success ? 'WebSocket interception disabled' : disableResult.error
    });
    
  } catch (error) {
    console.error('❌ Test error:', error);
    results.push({
      test: 'Overall',
      passed: false,
      details: error.message
    });
  } finally {
    await pc.close();
  }
  
  // Display results
  console.log('\n' + '=' .repeat(50));
  console.log('📊 TEST RESULTS\n');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);
  
  results.forEach((result, i) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} Test ${i + 1}: ${result.test}`);
    console.log(`   ${result.details}`);
  });
  
  console.log('\n' + '=' .repeat(50));
  console.log(`🎯 Overall: ${passed}/${total} tests passed (${percentage}%)`);
  
  if (percentage === 100) {
    console.log('🎉 All WebSocket tests passed!');
  } else if (percentage >= 70) {
    console.log('⚠️ Most tests passed, but some features need attention.');
  } else {
    console.log('❌ Several tests failed. WebSocket interception needs debugging.');
  }
}

// Run the test
runWebSocketTest().catch(console.error);