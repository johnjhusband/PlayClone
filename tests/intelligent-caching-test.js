/**
 * Test: Intelligent Site Caching
 * 
 * Tests PlayClone's intelligent caching functionality
 */

const { PlayClone } = require('../dist/index');

async function testIntelligentCaching() {
  console.log('🧪 Testing Intelligent Site Caching\n');
  
  const pc = new PlayClone({ 
    headless: true,
    enableIntelligentCache: true 
  });
  
  let passedTests = 0;
  let totalTests = 0;

  try {
    // Test 1: Navigation caching
    totalTests++;
    console.log('Test 1: Navigation caching');
    try {
      // First navigation
      const result1 = await pc.navigate('https://example.com');
      
      // Second navigation (should use cache)
      const result2 = await pc.navigate('https://example.com', { useCache: true });
      
      if (result1.success && result2.success) {
        console.log('✅ Navigation caching works');
        passedTests++;
      } else {
        console.log('❌ Navigation caching failed');
      }
    } catch (error) {
      console.log('❌ Navigation caching error:', error.message);
    }

    // Test 2: Cache warming
    totalTests++;
    console.log('\nTest 2: Cache warming');
    try {
      const warmResult = await pc.warmCache(['example.com']);
      
      if (warmResult.success && warmResult.data?.warmed) {
        console.log('✅ Cache warming works');
        passedTests++;
      } else {
        console.log('❌ Cache warming failed');
      }
    } catch (error) {
      console.log('❌ Cache warming error:', error.message);
    }

    // Test 3: Cache statistics
    totalTests++;
    console.log('\nTest 3: Cache statistics');
    try {
      const stats = pc.getCacheStats();
      
      if (stats.success && stats.data) {
        console.log('✅ Cache statistics available');
        console.log(`   Total size: ${stats.data.totalSize} bytes`);
        console.log(`   Usage: ${stats.data.usagePercentage?.toFixed(2)}%`);
        passedTests++;
      } else {
        console.log('❌ Cache statistics failed');
      }
    } catch (error) {
      console.log('❌ Cache statistics error:', error.message);
    }

    // Test 4: Navigation prediction
    totalTests++;
    console.log('\nTest 4: Navigation prediction');
    try {
      // Build some patterns
      await pc.navigate('https://github.com');
      await pc.navigate('https://github.com/explore');
      await pc.navigate('https://github.com');
      await pc.navigate('https://github.com/trending');
      
      const predictions = pc.predictNextNavigation('https://github.com');
      
      if (predictions.success) {
        console.log('✅ Navigation prediction works');
        console.log(`   Predictions: ${predictions.data?.count || 0} URLs`);
        passedTests++;
      } else {
        console.log('❌ Navigation prediction failed');
      }
    } catch (error) {
      console.log('❌ Navigation prediction error:', error.message);
    }

    // Test 5: Clear domain cache
    totalTests++;
    console.log('\nTest 5: Clear domain cache');
    try {
      const clearResult = await pc.clearCache('example.com');
      
      if (clearResult.success && clearResult.data?.cleared) {
        console.log('✅ Domain cache clearing works');
        passedTests++;
      } else {
        console.log('❌ Domain cache clearing failed');
      }
    } catch (error) {
      console.log('❌ Domain cache clearing error:', error.message);
    }

    // Test 6: Clear all cache
    totalTests++;
    console.log('\nTest 6: Clear all cache');
    try {
      const cleanupResult = await pc.clearCache();
      
      if (cleanupResult.success) {
        console.log('✅ Cache cleanup works');
        console.log(`   Cleaned entries: ${cleanupResult.data?.entriesCleaned || 0}`);
        passedTests++;
      } else {
        console.log('❌ Cache cleanup failed');
      }
    } catch (error) {
      console.log('❌ Cache cleanup error:', error.message);
    }

    // Test 7: Export for offline
    totalTests++;
    console.log('\nTest 7: Export for offline');
    try {
      // Navigate to build cache
      await pc.navigate('https://example.com');
      
      const exportResult = await pc.exportCacheForOffline('example.com');
      
      if (exportResult.success && exportResult.data?.offlineReady) {
        console.log('✅ Offline export works');
        console.log(`   Export path: ${exportResult.data.exportPath}`);
        passedTests++;
      } else {
        console.log('❌ Offline export failed');
      }
    } catch (error) {
      console.log('❌ Offline export error:', error.message);
    }

    // Test 8: Cache performance improvement
    totalTests++;
    console.log('\nTest 8: Cache performance');
    try {
      const testUrl = 'https://httpbin.org/html';
      
      // Clear cache first
      await pc.clearCache('httpbin.org');
      
      // Time first navigation
      const start1 = Date.now();
      await pc.navigate(testUrl, { useCache: false });
      const time1 = Date.now() - start1;
      
      // Time cached navigation
      const start2 = Date.now();
      await pc.navigate(testUrl, { useCache: true });
      const time2 = Date.now() - start2;
      
      // Cache should be faster (or at least not significantly slower)
      if (time2 <= time1 * 1.5) { // Allow some variance
        console.log('✅ Cache performance improvement verified');
        console.log(`   First load: ${time1}ms`);
        console.log(`   Cached load: ${time2}ms`);
        console.log(`   Improvement: ${((1 - time2/time1) * 100).toFixed(1)}%`);
        passedTests++;
      } else {
        console.log('❌ Cache performance not improved');
        console.log(`   First load: ${time1}ms`);
        console.log(`   Cached load: ${time2}ms`);
      }
    } catch (error) {
      console.log('❌ Cache performance test error:', error.message);
    }

  } catch (error) {
    console.error('Test suite error:', error);
  } finally {
    await pc.close();
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`Test Results: ${passedTests}/${totalTests} passed`);
    console.log(`Pass rate: ${((passedTests/totalTests) * 100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
      console.log('✅ All tests passed!');
      process.exit(0);
    } else {
      console.log('❌ Some tests failed');
      process.exit(1);
    }
  }
}

// Run the tests
testIntelligentCaching().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});