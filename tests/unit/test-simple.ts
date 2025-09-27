#!/usr/bin/env node
/**
 * Simple test to verify PlayClone is working
 */

import { PlayClone } from './dist/index.js';

async function runTest() {
  console.log('🚀 Simple PlayClone Test\n');
  
  const browser = new PlayClone({ 
    headless: true  // Run headless for speed
  });
  
  try {
    // Just navigate to a simple page
    console.log('📍 Navigating to example.com...');
    const result = await browser.navigate('https://example.com');
    console.log(`   Result: ${result.success ? '✅ Success' : '❌ Failed'}`);
    
    if (result.success) {
      // Get page text
      console.log('\n📄 Getting page text...');
      const textData = await browser.getText();
      if (textData.data) {
        const text = typeof textData.data === 'string' ? textData.data : JSON.stringify(textData.data);
        const preview = text.substring(0, 100);
        console.log(`   Text preview: "${preview}..."`);
      }
      
      // Get current state
      console.log('\n📊 Getting current state...');
      const state = await browser.getCurrentState();
      if (state.success && state.value) {
        console.log(`   URL: ${state.value.url}`);
        console.log(`   Title: ${state.value.title}`);
      }
    }
    
    console.log('\n✨ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

runTest().catch(console.error);