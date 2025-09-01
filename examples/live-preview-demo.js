#!/usr/bin/env node

/**
 * PlayClone Live Preview Demo
 * 
 * This demo shows how to use the live browser preview feature
 * to see browser interactions in real-time through a web interface.
 */

const { PlayClone } = require('../dist/index');

async function main() {
  console.log('🎭 PlayClone Live Preview Demo\n');
  console.log('This demo will open a browser and start a live preview interface.');
  console.log('You can watch browser interactions in real-time!\n');

  const pc = new PlayClone({ 
    headless: false,  // Show the actual browser
    viewport: { width: 1280, height: 720 }
  });

  try {
    // Start the live preview
    console.log('📺 Starting live preview...');
    const previewResult = await pc.startLivePreview({
      port: 3456,
      autoOpen: true,  // Automatically open preview in browser
      enableHighlighting: true,
      enableInspector: true
    });

    if (previewResult.success) {
      console.log(`✅ Live preview started at: ${previewResult.data.url}`);
      console.log('   Open this URL in your browser to see the preview\n');
    } else {
      console.error('❌ Failed to start live preview:', previewResult.error);
      return;
    }

    // Navigate to a website
    console.log('🌐 Navigating to example.com...');
    await pc.navigate('https://example.com');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Demonstrate some interactions
    console.log('\n🤖 Performing automated interactions...\n');

    // Click on elements
    console.log('👆 Clicking on the "More information" link...');
    await pc.click('More information link');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Go back
    console.log('⬅️ Going back...');
    await pc.back();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Navigate to a form page
    console.log('🌐 Navigating to a form demo...');
    await pc.navigate('https://www.w3schools.com/html/html_forms.asp');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to interact with form fields
    console.log('📝 Filling form fields...');
    await pc.fill('input[name="fname"]', 'John');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await pc.fill('input[name="lname"]', 'Doe');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Navigate to GitHub
    console.log('🌐 Navigating to GitHub...');
    await pc.navigate('https://github.com');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Search for PlayClone
    console.log('🔍 Searching for PlayClone...');
    await pc.fill('search input', 'PlayClone browser automation');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await pc.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take a screenshot
    console.log('📸 Taking screenshot...');
    const screenshot = await pc.screenshot({ path: 'live-preview-demo.png' });
    if (screenshot.success) {
      console.log('   Screenshot saved to live-preview-demo.png');
    }

    // Get current live preview status
    const status = pc.getLivePreviewStatus();
    console.log('\n📊 Live Preview Status:');
    console.log(`   Running: ${status.data.running}`);
    console.log(`   URL: ${status.data.url}`);

    // Keep the preview running for user interaction
    console.log('\n✨ Live preview is running!');
    console.log('   You can interact with the browser through the preview interface.');
    console.log('   The preview will automatically update as you interact.\n');
    console.log('Press Ctrl+C to stop the demo and close the browser.\n');

    // Keep the script running
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Cleanup will be handled by process exit
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Stopping live preview and closing browser...');
      await pc.stopLivePreview();
      await pc.close();
      console.log('👋 Goodbye!');
      process.exit(0);
    });
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

// Run the demo
main().catch(console.error);