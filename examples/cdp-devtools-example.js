/**
 * Chrome DevTools Protocol Integration Example
 * This example demonstrates how to use CDP with PlayClone for advanced debugging
 */

const { PlayClone } = require('../dist/index');

async function main() {
  const pc = new PlayClone({ 
    headless: false, 
    devtools: true  // Open DevTools panel
  });

  try {
    console.log('🔧 Chrome DevTools Protocol Example\n');

    // Navigate to a test page
    console.log('1. Navigating to example page...');
    await pc.navigate('https://example.com');
    
    // Enable Chrome DevTools Protocol
    console.log('2. Enabling DevTools Protocol...');
    const enableResult = await pc.enableDevTools();
    console.log('   ✅', enableResult.value);
    
    // Get performance metrics
    console.log('\n3. Getting performance metrics...');
    const metrics = await pc.getPerformanceMetrics();
    if (metrics.success && metrics.value.metrics) {
      console.log('   Performance Metrics:');
      metrics.value.metrics.forEach(metric => {
        if (['JSHeapUsedSize', 'DomContentLoaded', 'FirstMeaningfulPaint'].includes(metric.name)) {
          console.log(`   - ${metric.name}: ${metric.value}`);
        }
      });
    }
    
    // Execute raw CDP command - get browser version
    console.log('\n4. Getting browser version via CDP...');
    const versionResult = await pc.cdpSend('Browser.getVersion');
    if (versionResult.success) {
      console.log('   Browser:', versionResult.value.product);
      console.log('   User Agent:', versionResult.value.userAgent.split(' ').slice(0, 3).join(' '));
    }
    
    // Highlight an element
    console.log('\n5. Highlighting the main heading...');
    await pc.highlightElement('h1', { r: 0, g: 255, b: 0, a: 0.5 });
    console.log('   ✅ Element highlighted in green');
    
    // Wait a bit to see the highlight
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Remove highlight
    await pc.hideHighlight();
    console.log('   ✅ Highlight removed');
    
    // Start profiling
    console.log('\n6. Starting JavaScript profiling...');
    await pc.startProfiling();
    
    // Do some JavaScript work
    await pc.execute(`
      // Simulate some JavaScript work
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i);
      }
      console.log('Work completed, result:', result);
    `);
    
    // Stop profiling and get results
    console.log('7. Stopping profiling...');
    const profile = await pc.stopProfiling();
    if (profile.success && profile.value.profile) {
      console.log('   ✅ Profile captured');
      console.log('   Profile nodes:', profile.value.profile.nodes?.length || 0);
    }
    
    // Advanced CDP: Network conditions emulation
    console.log('\n8. Emulating slow network conditions...');
    const cdp = await pc.getCDPClient();
    await cdp.Network.emulateNetworkConditions({
      offline: false,
      downloadThroughput: 50 * 1024, // 50kb/s
      uploadThroughput: 20 * 1024,   // 20kb/s
      latency: 500 // 500ms latency
    });
    console.log('   ✅ Slow 3G network conditions set');
    
    // Navigate with slow network
    console.log('\n9. Testing navigation with slow network...');
    const startTime = Date.now();
    await pc.navigate('https://www.google.com');
    const loadTime = Date.now() - startTime;
    console.log(`   Page loaded in ${loadTime}ms with slow network`);
    
    // Reset network conditions
    await cdp.Network.emulateNetworkConditions({
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0
    });
    console.log('   ✅ Network conditions reset');
    
    // Console API monitoring
    console.log('\n10. Monitoring console messages...');
    cdp.on('Runtime.consoleAPICalled', (params) => {
      console.log('   Console:', params.type, '-', 
        params.args?.[0]?.value || params.args?.[0]?.description || '');
    });
    
    // Execute code that logs to console
    await pc.execute(`
      console.log('Hello from the page!');
      console.warn('This is a warning');
      console.error('This is an error');
    `);
    
    // Wait a bit for console messages
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Security certificate info
    console.log('\n11. Getting security state...');
    const securityState = await pc.cdpSend('Security.getSecurityState');
    if (securityState.success) {
      console.log('   Security State:', securityState.value.securityState);
    }
    
    // DOM manipulation via CDP
    console.log('\n12. Manipulating DOM via CDP...');
    const doc = await cdp.DOM.getDocument();
    console.log('   Document node ID:', doc.root.nodeId);
    
    // Get page cookies via CDP
    console.log('\n13. Getting cookies via CDP...');
    const cookies = await pc.cdpSend('Network.getCookies');
    console.log('   Cookies found:', cookies.value?.cookies?.length || 0);
    
    // Page lifecycle events
    console.log('\n14. Monitoring page lifecycle events...');
    cdp.on('Page.loadEventFired', () => {
      console.log('   📄 Page load event fired');
    });
    cdp.on('Page.domContentEventFired', () => {
      console.log('   📄 DOM content loaded event fired');
    });
    
    // Trigger navigation to see events
    await pc.navigate('https://github.com');
    
    console.log('\n✅ Chrome DevTools Protocol demo completed!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pc.close();
  }
}

// Run the example
main().catch(console.error);