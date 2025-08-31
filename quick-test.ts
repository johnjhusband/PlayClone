#!/usr/bin/env node
/**
 * Quick test to verify PlayClone works
 */

import { PlayClone } from './dist/index.js';

async function test() {
  console.log('🚀 Quick PlayClone Test\n');
  
  const pc = new PlayClone({ headless: true });
  
  try {
    // Test 1: Navigation
    console.log('Test 1: Navigate to example.com');
    const nav = await pc.navigate('https://example.com');
    console.log(`Result: ${nav.success ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 2: Get Text
    console.log('\nTest 2: Get page text');
    const text = await pc.getText();
    console.log(`Result: ${text.data ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 3: Get State
    console.log('\nTest 3: Get current state');
    const state = await pc.getCurrentState();
    console.log(`Result: ${state.success ? '✅ PASS' : '❌ FAIL'}`);
    if (state.success && state.value) {
      console.log(`  URL: ${state.value.url}`);
      console.log(`  Title: ${state.value.title}`);
    }
    
    // Test 4: Screenshot
    console.log('\nTest 4: Take screenshot');
    const screenshot = await pc.screenshot({ path: 'test-screenshot.png' });
    console.log(`Result: ${screenshot.data ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log('\n✨ All tests completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pc.close();
  }
}

test().catch(console.error);