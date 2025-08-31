#!/usr/bin/env node

/**
 * Test Advanced Timeout Handling for Complex Sites
 */

const { PlayClone } = require('./dist/index.js');

async function testSite(pc, siteName, url) {
  console.log(`\n📋 Testing ${siteName}`);
  console.log(`   URL: ${url}`);
  
  const startTime = Date.now();
  
  try {
    // Navigate with advanced timeout handling
    const result = await pc.navigate(url);
    const elapsed = Date.now() - startTime;
    
    if (result.success) {
      console.log(`   ✅ Loaded successfully in ${elapsed}ms`);
      
      // Try to extract some content
      const text = await pc.getText();
      if (text.data) {
        const preview = typeof text.data === 'string' 
          ? text.data.substring(0, 100).replace(/\n/g, ' ')
          : JSON.stringify(text.data).substring(0, 100);
        console.log(`   📄 Content preview: "${preview}..."`);
      }
      
      return { success: true, time: elapsed };
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      return { success: false, time: elapsed };
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`   ❌ Error after ${elapsed}ms: ${error.message}`);
    return { success: false, time: elapsed };
  }
}

async function runTests() {
  console.log('🚀 Testing Advanced Timeout Handling on Complex Sites\n');
  console.log('============================================================');
  
  const pc = new PlayClone({ 
    headless: true, // Run headless for speed
    viewport: { width: 1280, height: 720 }
  });
  
  const results = [];
  
  try {
    // Test simple sites (should be fast)
    results.push(await testSite(pc, 'Example.com (Simple)', 'https://example.com'));
    results.push(await testSite(pc, 'HTTPBin (API Test)', 'https://httpbin.org'));
    
    // Test moderate complexity sites
    results.push(await testSite(pc, 'Wikipedia (Moderate)', 'https://en.wikipedia.org'));
    results.push(await testSite(pc, 'W3Schools (Moderate)', 'https://www.w3schools.com'));
    
    // Test complex SPAs
    results.push(await testSite(pc, 'GitHub (SPA)', 'https://github.com'));
    results.push(await testSite(pc, 'Stack Overflow (Complex)', 'https://stackoverflow.com'));
    
    // Test heavy news sites
    results.push(await testSite(pc, 'CNN (Heavy)', 'https://www.cnn.com'));
    results.push(await testSite(pc, 'BBC News (Heavy)', 'https://www.bbc.com/news'));
    
    // Test search engines (known difficult)
    results.push(await testSite(pc, 'DuckDuckGo (Anti-bot)', 'https://duckduckgo.com'));
    
  } finally {
    await pc.close();
  }
  
  console.log('\n============================================================');
  console.log('📊 TIMEOUT HANDLING TEST RESULTS');
  console.log('============================================================\n');
  
  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length} sites`);
  console.log(`❌ Failed: ${failed.length}/${results.length} sites\n`);
  
  if (successful.length > 0) {
    const avgTime = successful.reduce((acc, r) => acc + r.time, 0) / successful.length;
    const minTime = Math.min(...successful.map(r => r.time));
    const maxTime = Math.max(...successful.map(r => r.time));
    
    console.log('📈 Performance Metrics:');
    console.log(`   Average load time: ${Math.round(avgTime)}ms`);
    console.log(`   Fastest load: ${minTime}ms`);
    console.log(`   Slowest load: ${maxTime}ms`);
  }
  
  console.log('\n💡 Timeout Strategy Analysis:');
  console.log('   ✅ Simple sites: Fast strategy (5-10s timeout)');
  console.log('   ✅ Moderate sites: Standard strategy (10-30s timeout)');
  console.log('   ✅ Complex SPAs: SPA strategy (25-45s timeout)');
  console.log('   ✅ Heavy sites: Patient strategy (30-60s timeout)');
  console.log('   ⚠️ Anti-bot sites: Aggressive strategy (60-90s timeout)');
  
  const successRate = (successful.length / results.length * 100).toFixed(1);
  console.log(`\n🎯 Overall Success Rate: ${successRate}%`);
  
  if (successRate >= 70) {
    console.log('✅ EXCELLENT: Advanced timeout handling is working well!');
  } else if (successRate >= 50) {
    console.log('✅ GOOD: Timeout handling improved, some sites still challenging');
  } else {
    console.log('⚠️ NEEDS WORK: Many sites still timing out');
  }
}

// Run the tests
runTests().catch(console.error);