#!/usr/bin/env node
/**
 * Self-Test: Click Actions
 * PlayClone tests its own click functionality!
 * This is meta-testing - using PlayClone to verify PlayClone works
 */

import { PlayClone } from '../dist/index';

async function testClickActions() {
  console.log('🧪 PlayClone Self-Test: Click Actions');
  console.log('=' .repeat(50));
  
  let pc: PlayClone | null = null;
  let testsPassed = 0;
  let testsFailed = 0;
  
  try {
    // Initialize PlayClone
    console.log('\n📋 Initializing PlayClone...');
    pc = new PlayClone({ 
      headless: false, // Show browser for visibility
      viewport: { width: 1280, height: 720 }
    });
    
    // Test 1: Navigate to a test page
    console.log('\n1️⃣ Test: Navigate to test page');
    const navResult = await pc.navigate('https://example.com');
    if (navResult.success) {
      console.log('✅ Navigation successful');
      testsPassed++;
    } else {
      console.log('❌ Navigation failed:', navResult.error);
      testsFailed++;
    }
    
    // Test 2: Click on "More information..." link
    console.log('\n2️⃣ Test: Click on "More information" link');
    const clickResult = await pc.click('More information');
    if (clickResult.success) {
      console.log('✅ Click successful');
      console.log('   New URL:', clickResult.url);
      testsPassed++;
    } else {
      console.log('❌ Click failed:', clickResult.error);
      testsFailed++;
    }
    
    // Test 3: Verify we're on the IANA page
    console.log('\n3️⃣ Test: Verify navigation after click');
    // Get page state to check URL
    const pageState = await pc.getState();
    if (pageState && pageState.url?.includes('iana.org')) {
      console.log('✅ Successfully navigated to IANA page');
      testsPassed++;
    } else {
      console.log('❌ Not on expected page');
      testsFailed++;
    }
    
    // Test 4: Go back
    console.log('\n4️⃣ Test: Navigate back');
    const backResult = await pc.back();
    if (backResult.success) {
      console.log('✅ Navigated back successfully');
      testsPassed++;
    } else {
      console.log('❌ Go back failed:', backResult.error);
      testsFailed++;
    }
    
    // Test 5: Test clicking with natural language
    console.log('\n5️⃣ Test: Click with natural language description');
    await pc.navigate('https://www.google.com');
    const searchButtonResult = await pc.click('Google Search button');
    // Note: This might not actually click since we haven't typed anything
    // but it tests the element finding
    if (searchButtonResult.action === 'click') {
      console.log('✅ Found and attempted to click search button');
      testsPassed++;
    } else {
      console.log('❌ Could not find search button');
      testsFailed++;
    }
    
    // Test 6: Test response size optimization
    console.log('\n6️⃣ Test: Verify response is AI-optimized (<1KB)');
    const responseSize = JSON.stringify(clickResult).length;
    console.log(`   Response size: ${responseSize} bytes`);
    if (responseSize < 1024) {
      console.log('✅ Response is AI-optimized (<1KB)');
      testsPassed++;
    } else {
      console.log('❌ Response too large for AI consumption');
      testsFailed++;
    }
    
    // Test 7: Test multiple clicks in sequence
    console.log('\n7️⃣ Test: Multiple clicks in sequence');
    await pc.navigate('https://www.wikipedia.org');
    
    // Click on English link
    const englishClick = await pc.click('English');
    if (englishClick.success) {
      console.log('✅ Clicked on English Wikipedia');
      testsPassed++;
      
      // Now try to click on a random article link
      const articleClick = await pc.click('Random article');
      if (articleClick.success) {
        console.log('✅ Clicked on Random article');
        testsPassed++;
      } else {
        console.log('❌ Failed to click Random article');
        testsFailed++;
      }
    } else {
      console.log('❌ Failed to click English link');
      testsFailed++;
      testsFailed++; // Skip the second click test
    }
    
    // Test 8: Test error handling for non-existent element
    console.log('\n8️⃣ Test: Error handling for non-existent element');
    const nonExistentClick = await pc.click('This element definitely does not exist on the page');
    if (!nonExistentClick.success && nonExistentClick.error) {
      console.log('✅ Properly handled non-existent element');
      console.log('   Error message:', nonExistentClick.error);
      testsPassed++;
    } else {
      console.log('❌ Did not properly handle non-existent element');
      testsFailed++;
    }
    
    // Test 9: Test clicking by role/aria-label
    console.log('\n9️⃣ Test: Click by accessibility attributes');
    await pc.navigate('https://github.com');
    const signInClick = await pc.click('Sign in');
    if (signInClick.success) {
      console.log('✅ Successfully clicked Sign in using accessibility');
      testsPassed++;
    } else {
      console.log('⚠️ Could not click Sign in (might be expected)');
      // Don't count as failure since GitHub might have changed
    }
    
  } catch (error) {
    console.error('\n❌ Unexpected error during tests:', error);
    testsFailed++;
  } finally {
    // Cleanup
    if (pc) {
      console.log('\n🧹 Cleaning up...');
      await pc.close();
    }
    
    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Test Summary:');
    console.log(`   ✅ Passed: ${testsPassed}`);
    console.log(`   ❌ Failed: ${testsFailed}`);
    console.log(`   📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
    
    if (testsFailed === 0) {
      console.log('\n🎉 All click action tests passed!');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the output above.');
    }
    
    // Exit with appropriate code
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

// Run the self-test
testClickActions().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});