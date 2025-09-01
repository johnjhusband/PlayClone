/**
 * Test network request interception and modification
 */

const { PlayClone } = require('../dist/index');

async function testNetworkInterception() {
  console.log('\n🚀 Testing Network Interception...\n');
  
  const pc = new PlayClone({ headless: false });
  
  try {
    // Start network interception
    console.log('1. Starting network interception...');
    const startResult = await pc.startNetworkInterception();
    console.log(`   Interception started: ${startResult.success ? '✅' : '❌'}`);
    
    // Navigate to a test page
    console.log('\n2. Navigating to test page...');
    await pc.navigate('https://httpbin.org/');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test blocking resources
    console.log('\n3. Testing resource blocking...');
    pc.blockNetworkUrl('.css');
    pc.blockNetworkUrl('.jpg');
    pc.blockNetworkUrl('.png');
    console.log('   Blocked: CSS, JPG, PNG files');
    
    // Navigate to a page with resources
    console.log('\n4. Loading page with blocked resources...');
    await pc.navigate('https://example.com');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get network statistics
    console.log('\n5. Network statistics:');
    const stats = pc.getNetworkStatistics();
    if (stats) {
      console.log(`   Total requests: ${stats.totalRequests}`);
      console.log(`   Total responses: ${stats.totalResponses}`);
      console.log(`   Failed requests: ${stats.failedRequests}`);
      console.log(`   Average response time: ${Math.round(stats.averageResponseTime)}ms`);
      console.log(`   Total bytes received: ${stats.totalBytesReceived}`);
    }
    
    // Test request modification
    console.log('\n6. Testing request header modification...');
    await pc.modifyRequestHeaders('httpbin.org', {
      'X-Custom-Header': 'PlayClone-Test',
      'X-Test-Version': '1.0'
    });
    console.log('   Added custom headers to httpbin.org requests');
    
    // Make a request with modified headers
    await pc.navigate('https://httpbin.org/headers');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test response mocking
    console.log('\n7. Testing response mocking...');
    pc.mockNetworkResponse('/api/test', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: 'This is a mocked response from PlayClone',
        timestamp: Date.now()
      })
    });
    console.log('   Mocked /api/test endpoint');
    
    // Test network throttling
    console.log('\n8. Testing network throttling...');
    console.log('   Applying Slow 3G throttling...');
    const throttleResult = await pc.applyNetworkThrottling('Slow 3G');
    console.log(`   Throttling applied: ${throttleResult.success ? '✅' : '❌'}`);
    
    // Navigate with throttling
    console.log('   Loading page with throttling...');
    const startTime = Date.now();
    await pc.navigate('https://www.google.com');
    const loadTime = Date.now() - startTime;
    console.log(`   Page load time with Slow 3G: ${loadTime}ms`);
    
    // Remove throttling
    console.log('\n9. Removing throttling...');
    pc.removeNetworkThrottling();
    console.log('   Throttling removed');
    
    // Load page without throttling
    console.log('   Loading page without throttling...');
    const fastStartTime = Date.now();
    await pc.navigate('https://www.google.com');
    const fastLoadTime = Date.now() - fastStartTime;
    console.log(`   Page load time without throttling: ${fastLoadTime}ms`);
    console.log(`   Speed improvement: ${Math.round((loadTime - fastLoadTime) / loadTime * 100)}%`);
    
    // Get all intercepted requests
    console.log('\n10. Intercepted requests summary:');
    const requests = pc.getNetworkRequests();
    const requestsByType = {};
    for (const req of requests) {
      requestsByType[req.resourceType] = (requestsByType[req.resourceType] || 0) + 1;
    }
    for (const [type, count] of Object.entries(requestsByType)) {
      console.log(`   ${type}: ${count}`);
    }
    
    // Get all intercepted responses
    console.log('\n11. Response status codes:');
    const responses = pc.getNetworkResponses();
    const statusCodes = {};
    for (const res of responses) {
      const statusGroup = `${Math.floor(res.status / 100)}xx`;
      statusCodes[statusGroup] = (statusCodes[statusGroup] || 0) + 1;
    }
    for (const [code, count] of Object.entries(statusCodes)) {
      console.log(`   ${code}: ${count}`);
    }
    
    // Export HAR file
    console.log('\n12. Exporting network traffic as HAR...');
    const har = pc.exportNetworkHAR();
    if (har && har.log) {
      console.log(`   HAR export successful: ${har.log.entries.length} entries`);
      console.log(`   HAR version: ${har.log.version}`);
    }
    
    // Clear network data
    console.log('\n13. Clearing network data...');
    pc.clearNetworkData();
    const clearedRequests = pc.getNetworkRequests();
    console.log(`   Network data cleared: ${clearedRequests.length === 0 ? '✅' : '❌'}`);
    
    // Stop network interception
    console.log('\n14. Stopping network interception...');
    const stopResult = await pc.stopNetworkInterception();
    console.log(`   Interception stopped: ${stopResult.success ? '✅' : '❌'}`);
    
    console.log('\n✅ Network interception test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pc.close();
  }
}

// Run the test
testNetworkInterception().catch(console.error);