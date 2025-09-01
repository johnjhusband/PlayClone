#!/usr/bin/env node

/**
 * Visual Selector Builder Demo
 * 
 * This script demonstrates how to use the PlayClone Visual Selector Builder
 * to interactively create and test selectors for web automation.
 */

const { VisualSelectorBuilder } = require('../dist/devtools/VisualSelectorBuilder');

async function main() {
  console.log('🎨 Starting PlayClone Visual Selector Builder...\n');
  
  // Create builder instance
  const builder = new VisualSelectorBuilder({
    port: 8765,
    host: 'localhost',
    autoOpen: true  // Automatically open in browser
  });

  try {
    // Start the builder UI server
    await builder.start();
    
    console.log('✨ Visual Selector Builder is running!');
    console.log('');
    console.log('📋 How to use:');
    console.log('1. Enter a URL and click "Connect" to open a browser');
    console.log('2. Click "Inspect Page" to see all interactive elements');
    console.log('3. Enter selectors and test them:');
    console.log('   - Natural Language: "login button", "search box"');
    console.log('   - CSS: "#login-btn", ".search-input"');
    console.log('   - XPath: "//button[@id=\'login\']"');
    console.log('4. Click "Highlight" to visually see matched elements');
    console.log('5. Click "Generate Code" to create automation scripts');
    console.log('');
    console.log('🛑 Press Ctrl+C to stop the builder\n');
    
    // Keep the server running
    process.on('SIGINT', async () => {
      console.log('\n\n👋 Stopping Visual Selector Builder...');
      await builder.stop();
      process.exit(0);
    });
    
    // Keep process alive
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await builder.stop();
    process.exit(1);
  }
}

// Run the demo
main().catch(console.error);