#!/usr/bin/env node
/**
 * Self-Test: Form Filling
 * PlayClone tests its own form filling functionality!
 * This is meta-testing - using PlayClone to verify PlayClone works
 */

import { PlayClone } from '../dist/index';

async function testFormFilling() {
  console.log('🧪 PlayClone Self-Test: Form Filling');
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
    
    // Test 1: Navigate to a form test page
    console.log('\n1️⃣ Test: Navigate to form test page');
    // Using httpbin.org for form testing
    const navResult = await pc.navigate('https://httpbin.org/forms/post');
    if (navResult.success) {
      console.log('✅ Navigation successful');
      testsPassed++;
    } else {
      console.log('❌ Navigation failed:', navResult.error);
      testsFailed++;
    }
    
    // Test 2: Fill customer name field
    console.log('\n2️⃣ Test: Fill customer name field');
    const nameResult = await pc.fill('Customer name', 'PlayClone Test User');
    if (nameResult.success) {
      console.log('✅ Filled customer name successfully');
      testsPassed++;
    } else {
      console.log('❌ Failed to fill name:', nameResult.error);
      testsFailed++;
    }
    
    // Test 3: Fill telephone field
    console.log('\n3️⃣ Test: Fill telephone field');
    const phoneResult = await pc.fill('Telephone', '+1-555-0123');
    if (phoneResult.success) {
      console.log('✅ Filled telephone successfully');
      testsPassed++;
    } else {
      console.log('❌ Failed to fill telephone:', phoneResult.error);
      testsFailed++;
    }
    
    // Test 4: Fill email field
    console.log('\n4️⃣ Test: Fill email field');
    const emailResult = await pc.fill('E-mail address', 'test@playclone.ai');
    if (emailResult.success) {
      console.log('✅ Filled email successfully');
      testsPassed++;
    } else {
      console.log('❌ Failed to fill email:', emailResult.error);
      testsFailed++;
    }
    
    // Test 5: Select pizza size (dropdown)
    console.log('\n5️⃣ Test: Select pizza size from dropdown');
    const sizeResult = await pc.select('Pizza Size', 'Large');
    if (sizeResult.success) {
      console.log('✅ Selected pizza size successfully');
      testsPassed++;
    } else {
      console.log('❌ Failed to select size:', sizeResult.error);
      testsFailed++;
    }
    
    // Test 6: Check pizza toppings (checkboxes)
    console.log('\n6️⃣ Test: Check pizza topping checkboxes');
    const baconResult = await pc.check('Bacon');
    const cheeseResult = await pc.check('Extra Cheese');
    if (baconResult.success && cheeseResult.success) {
      console.log('✅ Checked toppings successfully');
      testsPassed++;
    } else {
      console.log('❌ Failed to check toppings');
      testsFailed++;
    }
    
    // Test 7: Fill delivery instructions (textarea)
    console.log('\n7️⃣ Test: Fill delivery instructions textarea');
    const instructionsResult = await pc.fill('Delivery instructions', 'Please ring the doorbell twice. This is a PlayClone self-test!');
    if (instructionsResult.success) {
      console.log('✅ Filled delivery instructions successfully');
      testsPassed++;
    } else {
      console.log('❌ Failed to fill instructions:', instructionsResult.error);
      testsFailed++;
    }
    
    // Test 8: Submit the form
    console.log('\n8️⃣ Test: Submit the form');
    const submitResult = await pc.click('Submit order');
    if (submitResult.success) {
      console.log('✅ Form submitted successfully');
      testsPassed++;
      
      // Wait a bit for the response page to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify we got to the results page
      const pageState = await pc.getState();
      if (pageState && pageState.url?.includes('/post')) {
        console.log('✅ Successfully navigated to results page');
        testsPassed++;
      } else {
        console.log('❌ Did not navigate to results page');
        testsFailed++;
      }
    } else {
      console.log('❌ Failed to submit form:', submitResult.error);
      testsFailed++;
      testsFailed++; // Skip the navigation check
    }
    
    // Test 9: Test Google search form (real-world test)
    console.log('\n9️⃣ Test: Google search form (real-world)');
    await pc.navigate('https://www.google.com');
    
    const searchResult = await pc.fill('Search', 'PlayClone browser automation');
    if (searchResult.success) {
      console.log('✅ Filled Google search box');
      testsPassed++;
      
      // Press Enter to search
      const pressResult = await pc.press('Enter');
      if (pressResult.success) {
        console.log('✅ Submitted search with Enter key');
        testsPassed++;
        
        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if we're on results page
        const resultsState = await pc.getState();
        if (resultsState && resultsState.url?.includes('/search')) {
          console.log('✅ Search results loaded');
          testsPassed++;
        } else {
          console.log('❌ Search results did not load');
          testsFailed++;
        }
      } else {
        console.log('❌ Failed to press Enter');
        testsFailed++;
        testsFailed++; // Skip results check
      }
    } else {
      console.log('❌ Failed to fill search box');
      testsFailed++;
      testsFailed += 2; // Skip Enter and results check
    }
    
    // Test 10: Test response size optimization
    console.log('\n🔟 Test: Verify form responses are AI-optimized');
    const responseSize = JSON.stringify(nameResult).length;
    console.log(`   Response size: ${responseSize} bytes`);
    if (responseSize < 1024) {
      console.log('✅ Response is AI-optimized (<1KB)');
      testsPassed++;
    } else {
      console.log('❌ Response too large for AI consumption');
      testsFailed++;
    }
    
    // Test 11: Error handling for non-existent form field
    console.log('\n1️⃣1️⃣ Test: Error handling for non-existent field');
    const nonExistentResult = await pc.fill('This field does not exist', 'test value');
    if (!nonExistentResult.success && nonExistentResult.error) {
      console.log('✅ Properly handled non-existent field');
      console.log('   Error:', nonExistentResult.error);
      testsPassed++;
    } else {
      console.log('❌ Did not properly handle non-existent field');
      testsFailed++;
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
      console.log('\n🎉 All form filling tests passed!');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the output above.');
    }
    
    // Exit with appropriate code
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

// Run the self-test
testFormFilling().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});