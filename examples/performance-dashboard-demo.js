const { PlayClone } = require('../dist/index');

async function runPerformanceDemo() {
  console.log('🚀 Starting PlayClone Performance Dashboard Demo');
  
  const pc = new PlayClone({ headless: false });
  
  try {
    // Start performance monitoring with dashboard
    console.log('\n📊 Starting performance monitoring...');
    const monitorResult = await pc.startMonitoring({
      dashboardPort: 4000,
      dashboardHost: 'localhost',
      updateInterval: 1000,
      enableDashboard: true
    });
    
    if (monitorResult.success) {
      console.log(`✅ Dashboard running at: ${monitorResult.dashboardUrl}`);
      console.log('🌐 Open this URL in your browser to see live metrics!');
    }
    
    // Perform various operations to generate metrics
    console.log('\n🔨 Performing browser operations...');
    
    // Navigation operations
    for (let i = 0; i < 5; i++) {
      console.log(`\n📍 Navigation ${i + 1}/5`);
      await pc.trackOperation(`nav-${i}`, 'navigation', async () => {
        await pc.navigate('https://example.com');
      });
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Search operations
    console.log('\n🔍 Testing search functionality...');
    await pc.trackOperation('search-1', 'search', async () => {
      await pc.navigate('https://www.google.com');
      await pc.fill('search box', 'PlayClone browser automation');
    });
    
    // Data extraction
    console.log('\n📝 Testing data extraction...');
    await pc.trackOperation('extract-1', 'extraction', async () => {
      await pc.navigate('https://news.ycombinator.com');
      const text = await pc.getText('body');
      const links = await pc.getLinks();
      console.log(`   Found ${links.data?.length || 0} links`);
    });
    
    // Multiple concurrent operations
    console.log('\n⚡ Testing concurrent operations...');
    const concurrentOps = [];
    for (let i = 0; i < 3; i++) {
      concurrentOps.push(
        pc.trackOperation(`concurrent-${i}`, 'concurrent', async () => {
          await pc.navigate(`https://example.com?page=${i}`);
          await pc.getText('body');
        })
      );
    }
    await Promise.all(concurrentOps);
    
    // Simulate some errors
    console.log('\n❌ Simulating errors for metrics...');
    try {
      await pc.click('non-existent-element-12345');
    } catch (error) {
      // Expected to fail
    }
    
    try {
      await pc.fill('invalid-field', 'test');
    } catch (error) {
      // Expected to fail
    }
    
    // Get performance report
    console.log('\n📈 Getting performance metrics...');
    const metrics = await pc.getPerformanceMetrics();
    if (metrics.success && metrics.data) {
      console.log('\n' + metrics.data.report);
    }
    
    // Keep dashboard running for observation
    console.log('\n✨ Dashboard is running!');
    console.log(`📊 View live metrics at: ${monitorResult.dashboardUrl}`);
    console.log('⏸️  Press Ctrl+C to stop...\n');
    
    // Keep the process alive
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

runPerformanceDemo().catch(console.error);