#!/usr/bin/env node

/**
 * Demo: Browser Pre-warming Performance Test
 * 
 * This demo compares browser startup times with and without pre-warming
 */

const { PlayClone } = require('./dist/index');
const { BrowserPrewarmer } = require('./dist/optimization/BrowserPrewarmer');

async function testWithoutPrewarming() {
  console.log('\n🔵 Testing WITHOUT pre-warming...\n');
  
  const times = [];
  
  for (let i = 1; i <= 5; i++) {
    const startTime = Date.now();
    const pc = new PlayClone({ headless: true });
    
    // Navigate to trigger browser launch
    await pc.navigate('about:blank');
    const duration = Date.now() - startTime;
    times.push(duration);
    
    console.log(`  Test ${i}: ${duration}ms`);
    
    await pc.close();
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`\n  Average startup time: ${Math.round(avgTime)}ms`);
  
  return avgTime;
}

async function testWithPrewarming() {
  console.log('\n🟢 Testing WITH pre-warming...\n');
  
  // Start pre-warming
  const prewarmer = new BrowserPrewarmer(3);
  await prewarmer.startPrewarming({ headless: true });
  
  // Wait for pre-warming to complete
  console.log('  Pre-warming browsers...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const times = [];
  
  for (let i = 1; i <= 5; i++) {
    const startTime = Date.now();
    
    // Get pre-warmed browser
    const browserData = await prewarmer.getBrowser('chromium', { headless: true });
    
    if (browserData) {
      const duration = Date.now() - startTime;
      times.push(duration);
      console.log(`  Test ${i}: ${duration}ms (pre-warmed)`);
      
      // Release browser back to pool
      prewarmer.releaseBrowser(browserData.browser);
    }
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`\n  Average startup time: ${Math.round(avgTime)}ms`);
  
  // Get statistics
  const stats = prewarmer.getStats();
  console.log('\n📊 Pre-warmer Statistics:');
  console.log('  Pool sizes:', stats.poolSize);
  console.log('  In use:', stats.inUse);
  console.log('  Avg startup times:', stats.avgStartupTime);
  
  // Stop pre-warming
  await prewarmer.stop();
  
  return avgTime;
}

async function main() {
  console.log('=====================================');
  console.log('🚀 Browser Pre-warming Performance Test');
  console.log('=====================================');
  
  try {
    // Test without pre-warming
    const timeWithout = await testWithoutPrewarming();
    
    // Test with pre-warming
    const timeWith = await testWithPrewarming();
    
    // Calculate improvement
    const improvement = ((timeWithout - timeWith) / timeWithout) * 100;
    const speedup = timeWithout / timeWith;
    
    console.log('\n=====================================');
    console.log('📈 RESULTS');
    console.log('=====================================');
    console.log(`  Without pre-warming: ${Math.round(timeWithout)}ms`);
    console.log(`  With pre-warming: ${Math.round(timeWith)}ms`);
    console.log(`  Improvement: ${Math.round(improvement)}%`);
    console.log(`  Speed-up: ${speedup.toFixed(2)}x faster`);
    console.log('=====================================\n');
    
    if (improvement > 50) {
      console.log('✅ Excellent! Pre-warming provides significant performance gains!');
    } else if (improvement > 20) {
      console.log('✅ Good! Pre-warming provides noticeable performance improvement.');
    } else {
      console.log('ℹ️ Pre-warming provides modest performance improvement.');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

// Run the demo
main().catch(console.error);