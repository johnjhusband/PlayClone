#!/usr/bin/env node
// Quick visual test - launches visible browser for screenshot

const { PlayClone } = require('./dist/index');

async function visualTest() {
  console.log('🚀 Launching visible browser for screenshot...\n');
  
  const browser = new PlayClone({ 
    headless: false,  // Visible browser!
    viewport: { width: 1280, height: 720 }
  });

  try {
    // Navigate to GitHub
    console.log('📍 Navigating to GitHub PlayClone repo...');
    await browser.navigate('https://github.com/johnjhusband/PlayClone');
    
    // Wait a moment for visual
    await new Promise(r => setTimeout(r, 2000));
    
    // Take screenshot
    console.log('📸 Taking screenshot...');
    const screenshot = await browser.screenshot();
    
    // Save it
    const fs = require('fs');
    const buffer = Buffer.from(screenshot.data, 'base64');
    fs.writeFileSync('playclone-github-screenshot.png', buffer);
    console.log('✅ Screenshot saved as playclone-github-screenshot.png');
    
    // Navigate to example.com
    console.log('\n📍 Navigating to example.com...');
    await browser.navigate('https://example.com');
    
    // Click using natural language
    console.log('🖱️ Clicking "More information" using natural language...');
    await browser.click('More information link');
    
    const state = await browser.getCurrentState();
    console.log('✅ Clicked! Now at:', state?.data?.url || 'navigated');
    
    // Wait for visual
    await new Promise(r => setTimeout(r, 2000));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n⏸️ Keeping browser open for 5 seconds...');
    await new Promise(r => setTimeout(r, 5000));
    await browser.close();
    console.log('👋 Browser closed!');
  }
}

visualTest().catch(console.error);