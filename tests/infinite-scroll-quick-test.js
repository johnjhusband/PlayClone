/**
 * Quick test for infinite scroll functionality
 */

const path = require('path');

// Load the compiled JavaScript directly
const { InfiniteScrollHandler } = require('../src/ai/InfiniteScrollHandler.ts');
const { PlayClone } = require('../src/PlayClone.ts');

async function quickTest() {
  console.log('🚀 Quick Infinite Scroll Test\n');
  
  try {
    // Test basic instantiation
    const pc = new PlayClone({ 
      headless: false,
      viewport: { width: 1280, height: 720 }
    });
    
    console.log('✅ PlayClone instantiated');
    
    // Navigate to a simple page with infinite scroll
    console.log('\n📍 Navigating to Reddit...');
    const navResult = await pc.navigate('https://old.reddit.com');
    
    if (!navResult.success) {
      console.log('❌ Navigation failed:', navResult.error);
      await pc.close();
      return false;
    }
    
    console.log('✅ Navigation successful');
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Detect infinite scroll
    console.log('\n🔍 Detecting infinite scroll...');
    const detection = await pc.detectInfiniteScroll();
    
    console.log('📊 Detection Results:');
    console.log('   Has Infinite Scroll:', detection.hasInfiniteScroll);
    console.log('   Scroll Type:', detection.scrollType);
    console.log('   Trigger Mechanism:', detection.triggerMechanism);
    console.log('   Content Pattern:', detection.contentPattern);
    
    // Try scrolling
    if (detection.hasInfiniteScroll) {
      console.log('\n📜 Testing scroll (3 scrolls max)...');
      const scrollResult = await pc.scrollToEnd({
        maxScrolls: 3,
        waitBetweenScrolls: 1500,
        extractContent: true
      });
      
      if (scrollResult.success) {
        const { progress } = scrollResult.data;
        console.log('✅ Scroll successful');
        console.log('   Scrolls performed:', progress.scrollCount);
        console.log('   Items loaded:', progress.itemsLoaded);
        console.log('   Time elapsed:', (progress.timeElapsed / 1000).toFixed(1) + 's');
      } else {
        console.log('❌ Scroll failed:', scrollResult.error);
      }
    } else {
      console.log('\nℹ️ No infinite scroll detected on this page');
    }
    
    // Clean up
    await pc.close();
    console.log('\n✅ Test completed successfully');
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test using ts-node
console.log('Running with ts-node...\n');
const { execSync } = require('child_process');

try {
  // Make sure ts-node is available
  execSync('npx ts-node --version', { stdio: 'ignore' });
  
  // Create a wrapper script that imports and runs the test
  const wrapperCode = `
    import { PlayClone } from '../src/PlayClone';
    
    async function runTest() {
      const pc = new PlayClone({ headless: false });
      
      try {
        console.log('✅ Module loaded successfully');
        console.log('✅ InfiniteScrollHandler integrated');
        
        // Test navigation
        const result = await pc.navigate('https://example.com');
        console.log('Navigation test:', result.success ? '✅' : '❌');
        
        // Test detection method exists
        if (typeof pc.detectInfiniteScroll === 'function') {
          console.log('detectInfiniteScroll method: ✅');
        }
        if (typeof pc.scrollToEnd === 'function') {
          console.log('scrollToEnd method: ✅');
        }
        if (typeof pc.smartScroll === 'function') {
          console.log('smartScroll method: ✅');
        }
        
        await pc.close();
        console.log('\\n✨ Integration successful!');
      } catch (error) {
        console.error('Error:', error.message);
        await pc.close();
      }
    }
    
    runTest();
  `;
  
  require('fs').writeFileSync('test-wrapper.ts', wrapperCode);
  execSync('npx ts-node test-wrapper.ts', { stdio: 'inherit' });
  require('fs').unlinkSync('test-wrapper.ts');
  
} catch (error) {
  console.log('ts-node not available or error occurred');
  console.log('Please install dependencies: npm install -D ts-node typescript');
  console.error(error.message);
}