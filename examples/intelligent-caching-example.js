/**
 * Example: Intelligent Site Caching
 * 
 * Demonstrates PlayClone's intelligent caching capabilities:
 * - Automatic caching of frequently accessed sites
 * - Predictive prefetching based on navigation patterns
 * - Cache warming for popular sites
 * - Offline mode support
 * - Performance improvements through caching
 */

const { PlayClone } = require('../dist/index');

async function demonstrateIntelligentCaching() {
  console.log('🚀 PlayClone Intelligent Caching Demo\n');
  
  const pc = new PlayClone({ 
    headless: false,
    enableIntelligentCache: true 
  });

  try {
    // Test 1: First navigation (no cache)
    console.log('📊 Test 1: Initial Navigation (No Cache)');
    console.time('First navigation');
    const result1 = await pc.navigate('https://example.com');
    console.timeEnd('First navigation');
    console.log('Cached:', result1.data?.fromCache || false);
    console.log('');

    // Test 2: Second navigation to same URL (should be faster with cache)
    console.log('📊 Test 2: Cached Navigation');
    console.time('Cached navigation');
    const result2 = await pc.navigate('https://example.com', { useCache: true });
    console.timeEnd('Cached navigation');
    console.log('Cached:', result2.data?.fromCache || false);
    if (result2.data?.cacheAge) {
      console.log('Cache age:', result2.data.cacheAge + 'ms');
    }
    console.log('');

    // Test 3: Warm cache for popular sites
    console.log('📊 Test 3: Cache Warming for Popular Sites');
    const popularSites = [
      'google.com',
      'github.com',
      'stackoverflow.com',
      'developer.mozilla.org'
    ];
    
    const warmResult = await pc.warmCache(popularSites);
    console.log('Sites warmed:', warmResult.data?.domains);
    console.log('');

    // Test 4: Navigate to multiple pages and build patterns
    console.log('📊 Test 4: Building Navigation Patterns');
    const testUrls = [
      'https://github.com',
      'https://github.com/explore',
      'https://github.com/trending',
      'https://stackoverflow.com',
      'https://stackoverflow.com/questions',
      'https://stackoverflow.com/tags'
    ];

    for (const url of testUrls) {
      console.log(`Navigating to: ${url}`);
      await pc.navigate(url);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
    }
    console.log('');

    // Test 5: Predict next navigation
    console.log('📊 Test 5: Navigation Prediction');
    const currentUrl = 'https://github.com';
    await pc.navigate(currentUrl);
    
    const predictions = pc.predictNextNavigation(currentUrl);
    console.log('Current URL:', currentUrl);
    console.log('Predicted next navigations:', predictions.data?.predictions);
    console.log('');

    // Test 6: Get cache statistics
    console.log('📊 Test 6: Cache Statistics');
    const stats = pc.getCacheStats();
    console.log('Cache stats:');
    console.log('- Total size:', formatBytes(stats.data?.totalSize || 0));
    console.log('- Max size:', formatBytes(stats.data?.maxSize || 0));
    console.log('- Usage:', (stats.data?.usagePercentage || 0).toFixed(2) + '%');
    
    if (stats.data?.sites) {
      console.log('\nPer-site statistics:');
      for (const site of stats.data.sites) {
        console.log(`\n  ${site.domain}:`);
        console.log(`    - Resources: ${site.resourceCount}`);
        console.log(`    - Size: ${formatBytes(site.totalSize)}`);
        console.log(`    - Hit rate: ${(site.hitRate * 100).toFixed(1)}%`);
        console.log(`    - Bandwidth saved: ${formatBytes(site.bandwidthSaved)}`);
        console.log(`    - Offline available: ${site.offlineAvailable}`);
      }
    }
    console.log('');

    // Test 7: Export cache for offline use
    console.log('📊 Test 7: Export for Offline Use');
    try {
      const exportResult = await pc.exportCacheForOffline('example.com');
      console.log('Exported cache for offline use:');
      console.log('- Domain:', exportResult.data?.domain);
      console.log('- Export path:', exportResult.data?.exportPath);
      console.log('- Offline ready:', exportResult.data?.offlineReady);
    } catch (error) {
      console.log('Export skipped (domain may not have enough cached data)');
    }
    console.log('');

    // Test 8: Performance comparison
    console.log('📊 Test 8: Performance Comparison');
    const testUrl = 'https://www.w3.org/';
    
    // Clear cache for fair comparison
    await pc.clearCache('www.w3.org');
    
    // Without cache
    console.time('Without cache');
    await pc.navigate(testUrl, { useCache: false });
    console.timeEnd('Without cache');
    
    // With cache (second load)
    console.time('With cache');
    await pc.navigate(testUrl, { useCache: true });
    console.timeEnd('With cache');
    console.log('');

    // Test 9: Clear specific domain cache
    console.log('📊 Test 9: Clear Domain Cache');
    const clearResult = await pc.clearCache('example.com');
    console.log('Cache cleared for example.com:', clearResult.data?.cleared);
    console.log('');

    // Test 10: Clear all expired entries
    console.log('📊 Test 10: Cleanup Expired Cache');
    const cleanupResult = await pc.clearCache();
    console.log('Expired entries cleaned:', cleanupResult.data?.entriesCleaned);
    
    // Final stats
    console.log('\n📊 Final Cache Statistics');
    const finalStats = pc.getCacheStats();
    console.log('Final cache size:', formatBytes(finalStats.data?.totalSize || 0));
    console.log('Sites in cache:', finalStats.data?.sites?.length || 0);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pc.close();
    console.log('\n✅ Intelligent caching demo complete!');
  }
}

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the demo
demonstrateIntelligentCaching().catch(console.error);