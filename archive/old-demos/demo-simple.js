#!/usr/bin/env node
/**
 * PlayClone Simple Demo
 * Quick demonstration of core PlayClone features
 */

const { PlayClone } = require('./dist/index.js');

async function runDemo() {
  console.log('🚀 PlayClone Simple Demo\n');
  
  // Initialize PlayClone
  const browser = new PlayClone({ 
    headless: true,  // Run in headless mode for speed
    viewport: { width: 1280, height: 800 }
  });
  
  try {
    // Navigate to example.com
    console.log('1️⃣  Navigating to example.com...');
    const navResult = await browser.navigate('https://example.com');
    console.log(`   Result: ${navResult.success ? '✅ Success' : '❌ Failed'}`);
    
    // Get page text
    console.log('\n2️⃣  Extracting page text...');
    const textData = await browser.getText();
    if (textData.data && typeof textData.data === 'string') {
      const preview = textData.data.substring(0, 200);
      console.log(`   Text: "${preview}..."`);
    } else if (textData.data && textData.data.text) {
      const preview = textData.data.text.substring(0, 200);
      console.log(`   Text: "${preview}..."`);
    }
    
    // Get page links
    console.log('\n3️⃣  Extracting links...');
    const linksData = await browser.getLinks();
    if (linksData.data && Array.isArray(linksData.data)) {
      console.log(`   Found ${linksData.data.length} link(s)`);
      linksData.data.forEach(link => {
        console.log(`   - ${link.text}: ${link.href}`);
      });
    }
    
    // Take screenshot
    console.log('\n4️⃣  Taking screenshot...');
    const screenshotResult = await browser.screenshot({ 
      path: 'example-screenshot.png'
    });
    console.log(`   Screenshot saved: example-screenshot.png`);
    
    // Get current state
    console.log('\n5️⃣  Getting page state...');
    const state = await browser.getCurrentState();
    if (state.success && state.value) {
      console.log(`   URL: ${state.value.url}`);
      console.log(`   Title: ${state.value.title}`);
    }
    
    // Try clicking using natural language
    console.log('\n6️⃣  Clicking "More information" link...');
    const clickResult = await browser.click('More information');
    console.log(`   Click result: ${clickResult.success ? '✅ Success' : '❌ ' + clickResult.error}`);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check new URL after click
    const newState = await browser.getCurrentState();
    if (newState.success && newState.value) {
      console.log(`   New URL: ${newState.value.url}`);
    }
    
    console.log('\n✨ Demo completed successfully!');
    console.log('PlayClone demonstrated:');
    console.log('  ✓ Navigation');
    console.log('  ✓ Text extraction');
    console.log('  ✓ Link extraction');
    console.log('  ✓ Screenshots');
    console.log('  ✓ State management');
    console.log('  ✓ Natural language clicks');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n👋 Browser closed.');
  }
}

// Run the demo
runDemo().catch(console.error);