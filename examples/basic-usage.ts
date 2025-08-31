/**
 * Basic usage example for PlayClone
 * Demonstrates AI-native browser automation
 */

import { PlayClone } from '../src/index';

async function main() {
  // Initialize PlayClone with options
  const browser = new PlayClone({
    headless: false, // Set to true for production
    viewport: { width: 1280, height: 720 },
    browser: 'chromium',
  });

  try {
    // Initialize browser
    const initResult = await browser.init();
    console.log('Browser initialized:', initResult);

    // Get the context for AI-friendly operations
    const context = browser.getContext();
    if (!context) {
      console.error('Failed to get browser context');
      return;
    }

    // Example 1: Navigate to a website
    console.log('\n--- Example 1: Navigation ---');
    const navResult = await context.navigate('https://example.com');
    console.log('Navigation result:', navResult);

    // Example 2: Extract text content
    console.log('\n--- Example 2: Text Extraction ---');
    const textResult = await context.getText();
    console.log('Page text (truncated):', 
      textResult.success ? textResult.value?.text?.substring(0, 200) + '...' : 'Failed');

    // Example 3: Find and click using natural language
    console.log('\n--- Example 3: Natural Language Click ---');
    const clickResult = await context.click('More information');
    console.log('Click result:', clickResult);

    // Example 4: Get page metadata
    console.log('\n--- Example 4: Page Info ---');
    const pageInfo = await context.getPageInfo();
    console.log('Page info:', pageInfo);

    // Example 5: Take a screenshot
    console.log('\n--- Example 5: Screenshot ---');
    const screenshotResult = await context.screenshot({
      path: 'examples/screenshot.png',
      fullPage: true,
    });
    console.log('Screenshot result:', screenshotResult);

    // Example 6: Save checkpoint
    console.log('\n--- Example 6: State Management ---');
    const checkpointResult = await context.saveCheckpoint('example-checkpoint');
    console.log('Checkpoint saved:', checkpointResult);

    // Navigate somewhere else
    await context.navigate('https://www.google.com');
    console.log('Navigated to Google');

    // List checkpoints
    const checkpoints = await context.listCheckpoints();
    console.log('Available checkpoints:', checkpoints);

  } catch (error) {
    console.error('Error during execution:', error);
  } finally {
    // Clean up
    await browser.close();
    console.log('\nBrowser closed');
  }
}

// Run the example
main().catch(console.error);