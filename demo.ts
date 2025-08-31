#!/usr/bin/env node
/**
 * PlayClone Quick Demo
 * Shows core functionality in a simple, clear way
 */

import { PlayClone } from './src/index';

async function main() {
  console.log('🚀 PlayClone Demo - AI-Native Browser Automation\n');
  
  // Create instance with visible browser
  const pc = new PlayClone({ 
    headless: false,  // See the browser in action!
    browser: 'chromium'
  });
  
  try {
    // 1. Navigate using simple function call
    console.log('1️⃣  Navigating to example.com...');
    const nav = await pc.navigate('https://example.com');
    console.log(`   ✅ Success: ${nav.success}`);
    console.log(`   📍 URL: ${nav.value?.url}`);
    console.log(`   📏 Response size: ${JSON.stringify(nav).length} bytes\n`);
    
    // 2. Click using natural language
    console.log('2️⃣  Clicking "More information" link...');
    const click = await pc.click('More information link');
    console.log(`   ✅ Success: ${click.success}`);
    console.log(`   🎯 Clicked: ${click.target}\n`);
    
    // Wait for navigation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. Get current state
    console.log('3️⃣  Getting current state...');
    const state = await pc.getCurrentState();
    console.log(`   📍 Current URL: ${state.value?.url}`);
    console.log(`   📄 Page title: ${state.value?.title}\n`);
    
    // 4. Go back
    console.log('4️⃣  Going back...');
    const back = await pc.back();
    console.log(`   ✅ Success: ${back.success}`);
    console.log(`   📍 Back at: ${back.value?.url}\n`);
    
    // 5. Extract text
    console.log('5️⃣  Extracting page text...');
    const text = await pc.getText();
    const textContent = typeof text.data === 'string' ? text.data : text.data?.text || '';
    console.log(`   📝 Text preview: "${textContent.substring(0, 60)}..."\n`);
    
    // 6. Take screenshot
    console.log('6️⃣  Taking screenshot...');
    const screenshot = await pc.screenshot();
    console.log(`   📸 Screenshot captured: ${screenshot.data ? 'Yes' : 'No'}`);
    console.log(`   📏 Image size: ${screenshot.data?.length || 0} bytes (base64)\n`);
    
    // 7. Save state
    console.log('7️⃣  Saving browser state...');
    const save = await pc.saveState('demo-checkpoint');
    console.log(`   💾 State saved: ${save.success}\n`);
    
    console.log('✨ Demo complete!');
    console.log('🎯 Key Features Demonstrated:');
    console.log('   • Natural language element selection');
    console.log('   • AI-optimized responses (<1KB average)');
    console.log('   • Direct function calls (no code generation)');
    console.log('   • State management and persistence');
    console.log('   • Multi-browser support\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('🧹 Closing browser...');
    await pc.close();
    console.log('👋 Goodbye!');
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main };