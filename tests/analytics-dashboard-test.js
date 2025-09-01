const { PlayClone } = require('../dist/index');

async function testAnalyticsDashboard() {
  console.log('🧪 Testing Analytics Dashboard...\n');
  
  const pc = new PlayClone({ headless: true });
  
  try {
    // Start analytics dashboard
    console.log('📊 Starting analytics dashboard...');
    const startResult = await pc.startAnalytics({
      port: 9091,
      autoOpen: false,
      updateInterval: 2000,
      enableRealtime: true
    });
    
    if (startResult.success) {
      console.log(`✅ Dashboard started at: ${startResult.data.url}`);
      console.log(`   Session ID: ${startResult.data.sessionId}`);
    } else {
      console.log(`❌ Failed to start dashboard: ${startResult.error}`);
    }
    
    // Perform some browser actions to generate metrics
    console.log('\n🔍 Performing browser actions to generate metrics...');
    
    // Navigate to a website
    const navResult = await pc.navigate('https://example.com');
    console.log(`   Navigation: ${navResult.success ? '✅' : '❌'}`);
    
    // Extract text
    const textResult = await pc.getText('h1');
    console.log(`   Text extraction: ${textResult.success ? '✅' : '❌'}`);
    
    // Click an element (this might fail, but that's okay for testing)
    const clickResult = await pc.click('More information');
    console.log(`   Click action: ${clickResult.success ? '✅' : '❌'}`);
    
    // Extract links
    const linksResult = await pc.getLinks();
    console.log(`   Links extraction: ${linksResult.success ? '✅' : '❌'}`);
    
    // Record custom performance metrics
    console.log('\n📈 Recording custom metrics...');
    await pc.recordPerformanceMetric('customMetric', 42.5, 50);
    await pc.recordPerformanceMetric('responseTime', 125, 200);
    await pc.recordDataExtraction('links', 10, 1024);
    
    // Get aggregated metrics
    console.log('\n📊 Getting aggregated metrics...');
    const metricsResult = await pc.getAnalyticsMetrics();
    
    if (metricsResult.success) {
      const metrics = metricsResult.data;
      console.log('   Metrics Summary:');
      console.log(`   - Total Sessions: ${metrics.totalSessions}`);
      console.log(`   - Active Sessions: ${metrics.activeSessions}`);
      console.log(`   - Total Actions: ${metrics.totalActions}`);
      console.log(`   - Success Rate: ${metrics.successRate.toFixed(1)}%`);
      console.log(`   - Avg Action Duration: ${metrics.avgActionDuration.toFixed(0)}ms`);
      console.log(`   - Error Rate: ${metrics.errorRate.toFixed(1)}%`);
      console.log(`   - Total Data Extracted: ${metrics.totalDataExtracted}`);
      
      if (metrics.topActions.length > 0) {
        console.log('\n   Top Actions:');
        metrics.topActions.slice(0, 3).forEach(action => {
          console.log(`   - ${action.action}: ${action.count} times`);
        });
      }
      
      if (metrics.topErrors.length > 0) {
        console.log('\n   Top Errors:');
        metrics.topErrors.slice(0, 3).forEach(error => {
          console.log(`   - ${error.error}: ${error.count} times`);
        });
      }
    } else {
      console.log(`❌ Failed to get metrics: ${metricsResult.error}`);
    }
    
    // Wait a bit for metrics to update
    console.log('\n⏳ Waiting for real-time updates...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Stop analytics dashboard
    console.log('\n🛑 Stopping analytics dashboard...');
    const stopResult = await pc.stopAnalytics();
    
    if (stopResult.success) {
      console.log('✅ Dashboard stopped successfully');
    } else {
      console.log(`❌ Failed to stop dashboard: ${stopResult.error}`);
    }
    
    console.log('\n✅ Analytics Dashboard test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pc.close();
  }
}

// Run the test
testAnalyticsDashboard().catch(console.error);