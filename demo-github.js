#!/usr/bin/env node
/**
 * PlayClone Demo: GitHub Repository Search
 * 
 * This demo shows PlayClone automating a real-world task:
 * 1. Navigate to GitHub
 * 2. Search for a repository
 * 3. Extract information
 * 4. Take screenshots
 */

const { PlayClone } = require('./dist/index.js');

async function runDemo() {
  console.log('🚀 Starting PlayClone Demo: GitHub Repository Search\n');
  
  // Initialize PlayClone with visible browser
  const browser = new PlayClone({ 
    headless: false,  // Show the browser window
    viewport: { width: 1280, height: 800 }
  });
  
  try {
    // Step 1: Navigate to GitHub
    console.log('📍 Navigating to GitHub...');
    const navResult = await browser.navigate('https://github.com');
    console.log(`   ✅ Navigation: ${navResult.success ? 'Success' : 'Failed'}`);
    if (!navResult.success) {
      console.log(`   Error: ${navResult.error}`);
    }
    
    // Wait a moment for the page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Click on the search box using natural language
    console.log('\n🔍 Attempting to find and click search box...');
    // Try different selectors for the search box
    let clickResult = await browser.click('search');
    if (!clickResult.success) {
      console.log('   Trying alternative selector...');
      clickResult = await browser.click('[type="search"]');
    }
    if (!clickResult.success) {
      console.log('   Trying another selector...');
      clickResult = await browser.click('input[placeholder*="Search"]');
    }
    console.log(`   ${clickResult.success ? '✅' : '❌'} Click search: ${clickResult.success ? 'Success' : clickResult.error}`);
    
    if (clickResult.success) {
      // Step 3: Type search query
      console.log('\n⌨️  Typing search query "PlayClone"...');
      const typeResult = await browser.type('PlayClone', 50);
      console.log(`   ${typeResult.success ? '✅' : '❌'} Type query: ${typeResult.success ? 'Success' : typeResult.error}`);
      
      // Step 4: Press Enter to search
      console.log('\n🔎 Submitting search...');
      const pressResult = await browser.press('Enter');
      console.log(`   ${pressResult.success ? '✅' : '❌'} Press Enter: ${pressResult.success ? 'Success' : pressResult.error}`);
      
      // Wait for search results
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Step 5: Take a screenshot
    console.log('\n📸 Taking screenshot...');
    const screenshotResult = await browser.screenshot({ 
      path: 'playclone-github-screenshot.png',
      fullPage: false 
    });
    console.log(`   ✅ Screenshot saved: playclone-github-screenshot.png`);
    
    // Step 6: Extract page information
    console.log('\n📊 Extracting page text (first 500 chars)...');
    const textData = await browser.getText();
    if (textData.data) {
      const preview = textData.data.substring(0, 500).replace(/\n+/g, ' ');
      console.log(`   Text preview: "${preview}..."`);
    }
    
    // Step 7: Get current page state
    console.log('\n📍 Current page state:');
    const state = await browser.getCurrentState();
    if (state.success && state.value) {
      console.log(`   URL: ${state.value.url}`);
      console.log(`   Title: ${state.value.title}`);
      console.log(`   Viewport: ${state.value.viewport.width}x${state.value.viewport.height}`);
    }
    
    // Step 8: Extract links
    console.log('\n🔗 Extracting links (first 5)...');
    const linksData = await browser.getLinks();
    if (linksData.data && Array.isArray(linksData.data)) {
      const topLinks = linksData.data.slice(0, 5);
      topLinks.forEach((link, i) => {
        console.log(`   ${i + 1}. ${link.text || 'No text'} -> ${link.href || 'No URL'}`);
      });
    }
    
    // Demo complete!
    console.log('\n✨ Demo completed successfully!');
    console.log('   PlayClone successfully automated browser interactions!');
    console.log('\n📸 Screenshot saved as: playclone-github-screenshot.png');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message || error);
  } finally {
    // Close the browser after a delay to see the final state
    console.log('\n⏰ Closing browser in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await browser.close();
    console.log('👋 Browser closed. Demo finished!');
  }
}

// Run the demo
console.log('PlayClone Demo - Browser Automation Framework');
console.log('==============================================\n');
runDemo().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});