#!/usr/bin/env node

// Test LivePreview functionality
const { PlayClone } = require('./dist/index');

async function test() {
  console.log('Testing LivePreview feature...\n');
  
  const pc = new PlayClone({ headless: false });
  
  try {
    // Start live preview
    console.log('Starting live preview...');
    const result = await pc.startLivePreview({
      port: 3456,
      autoOpen: false
    });
    
    if (result.success) {
      const data = result.value;
      console.log(`✓ Live preview started at: ${data.url}`);
    } else {
      console.log(`✗ Failed to start: ${result.error}`);
      return;
    }
    
    // Navigate to a page
    console.log('\nNavigating to example.com...');
    await pc.navigate('https://example.com');
    
    // Check status
    const status = pc.getLivePreviewStatus();
    const statusData = status.value;
    console.log(`\nStatus: Running=${statusData.running}, URL=${statusData.url}`);
    
    // Keep running for 10 seconds
    console.log('\nLive preview running for 10 seconds...');
    console.log('Open http://localhost:3456 in your browser to see the preview');
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Stop preview
    console.log('\nStopping live preview...');
    await pc.stopLivePreview();
    console.log('✓ Live preview stopped');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pc.close();
  }
}

test().catch(console.error);