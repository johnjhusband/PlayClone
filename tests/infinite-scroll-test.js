/**
 * Test infinite scroll detection and handling
 */

const { PlayClone } = require('../dist/index');

async function testInfiniteScroll() {
  console.log('🚀 Testing Infinite Scroll Detection and Handling\n');
  
  const pc = new PlayClone({ 
    headless: false,
    viewport: { width: 1280, height: 720 }
  });

  const tests = [
    {
      name: 'Reddit Homepage - Infinite Scroll',
      url: 'https://www.reddit.com',
      expectedType: 'infinite-scroll',
      scrollOptions: {
        maxScrolls: 5,
        waitBetweenScrolls: 2000,
        extractContent: true,
        stopOnDuplicates: true
      }
    },
    {
      name: 'Twitter/X Timeline - Virtual Scroll',
      url: 'https://twitter.com/explore',
      expectedType: 'virtual',
      scrollOptions: {
        maxScrolls: 3,
        scrollSpeed: 'slow',
        extractContent: true
      }
    },
    {
      name: 'Product Hunt - Load More Button',
      url: 'https://www.producthunt.com',
      expectedType: 'load-more',
      scrollOptions: {
        maxScrolls: 3,
        extractContent: true
      }
    },
    {
      name: 'Hacker News - Simple List (No Infinite Scroll)',
      url: 'https://news.ycombinator.com',
      expectedType: 'unknown',
      scrollOptions: {
        maxScrolls: 2
      }
    },
    {
      name: 'Instagram Web - Lazy Load Images',
      url: 'https://www.instagram.com/explore',
      expectedType: 'lazy-load',
      scrollOptions: {
        maxScrolls: 3,
        scrollSpeed: 'slow',
        detectEndOfContent: true
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`   URL: ${test.url}`);
    
    try {
      // Navigate to the page
      const navResult = await pc.navigate(test.url);
      if (!navResult.success) {
        console.log(`   ❌ Failed to navigate: ${navResult.error}`);
        failed++;
        continue;
      }

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Detect infinite scroll
      console.log('   🔍 Detecting infinite scroll...');
      const detection = await pc.detectInfiniteScroll();
      
      console.log(`   📊 Detection Results:`);
      console.log(`      - Has Infinite Scroll: ${detection.hasInfiniteScroll}`);
      console.log(`      - Scroll Type: ${detection.scrollType}`);
      console.log(`      - Trigger Mechanism: ${detection.triggerMechanism}`);
      console.log(`      - Content Pattern: ${detection.contentPattern}`);
      
      if (detection.scrollContainer) {
        console.log(`      - Scroll Container: ${detection.scrollContainer}`);
      }
      
      if (detection.currentLoadedItems) {
        console.log(`      - Current Items: ${detection.currentLoadedItems}`);
      }

      // Test scrolling if infinite scroll is detected
      if (detection.hasInfiniteScroll) {
        console.log('   📜 Testing scroll functionality...');
        
        // Use smart scroll for adaptive behavior
        const scrollResult = await pc.smartScroll(test.scrollOptions);
        
        if (scrollResult.success) {
          const { progress, performanceMetrics } = scrollResult.data;
          
          console.log(`   ✅ Scroll Results:`);
          console.log(`      - Scrolls Performed: ${progress.scrollCount}`);
          console.log(`      - Items Loaded: ${progress.itemsLoaded}`);
          console.log(`      - Unique Items: ${progress.uniqueItems}`);
          console.log(`      - Duplicates Found: ${progress.duplicatesFound}`);
          console.log(`      - Time Elapsed: ${(progress.timeElapsed / 1000).toFixed(1)}s`);
          console.log(`      - Reached End: ${progress.reachedEnd}`);
          
          if (progress.stopReason) {
            console.log(`      - Stop Reason: ${progress.stopReason}`);
          }
          
          if (performanceMetrics) {
            console.log(`   📈 Performance Metrics:`);
            console.log(`      - Avg Load Time: ${performanceMetrics.avgLoadTime}ms`);
            console.log(`      - Avg Items/Scroll: ${performanceMetrics.avgItemsPerScroll}`);
            console.log(`      - Scroll Efficiency: ${performanceMetrics.scrollEfficiency}`);
          }
          
          // Get collected content summary
          if (test.scrollOptions.extractContent) {
            const content = pc.getInfiniteScrollContent();
            console.log(`   📦 Collected ${content.length} content items`);
            
            // Show sample of first item
            if (content.length > 0 && content[0].title) {
              console.log(`      Sample: "${content[0].title?.substring(0, 50)}..."`);
            }
          }
          
          // Get statistics
          const stats = pc.getInfiniteScrollStats();
          console.log(`   📊 Final Statistics:`);
          console.log(`      - Total Scrolls: ${stats.totalScrolls}`);
          console.log(`      - Total Distance: ${stats.totalDistance}px`);
          
          passed++;
        } else {
          console.log(`   ⚠️ Scroll failed: ${scrollResult.error}`);
          failed++;
        }
      } else {
        console.log('   ℹ️ No infinite scroll detected (as expected for some sites)');
        
        // This is expected for sites without infinite scroll
        if (test.expectedType === 'unknown' || !test.expectedType) {
          passed++;
        } else {
          failed++;
        }
      }

      // Reset state for next test
      pc.resetInfiniteScroll();
      
    } catch (error) {
      console.log(`   ❌ Test failed with error: ${error.message}`);
      failed++;
    }
  }

  // Test specific scroll options
  console.log('\n\n📝 Testing Specific Scroll Options\n');
  
  try {
    console.log('Testing scroll with custom container...');
    await pc.navigate('https://www.reddit.com');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const scrollResult = await pc.scrollToEnd({
      maxScrolls: 3,
      maxDuration: 10000,
      scrollSpeed: 'fast',
      stopOnDuplicates: false,
      detectEndOfContent: false,
      onNewContent: async (content) => {
        console.log(`   → Loaded ${content.length} new items`);
      }
    });
    
    if (scrollResult.success) {
      console.log('   ✅ Custom options test passed');
      passed++;
    } else {
      console.log('   ❌ Custom options test failed');
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ Custom options test error: ${error.message}`);
    failed++;
  }

  // Clean up
  await pc.close();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));

  return passed > 0 && failed < tests.length;
}

// Run the test
testInfiniteScroll()
  .then(success => {
    console.log(success ? '\n✨ Infinite scroll test completed!' : '\n❌ Some tests failed');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Test suite crashed:', error);
    process.exit(1);
  });