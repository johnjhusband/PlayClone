/**
 * Test state management functionality
 */

const { PlayClone } = require('../dist/index');

async function testState() {
  const pc = new PlayClone({ headless: true });
  
  try {
    console.log('Testing state management...\n');
    
    // Navigate to example.com
    await pc.navigate('https://example.com');
    console.log('Navigated to example.com');
    
    // Save state
    const saveResult = await pc.saveState('test-checkpoint');
    console.log('Save state result:', saveResult.success ? '✓' : '✗');
    if (!saveResult.success) {
      console.log('Error:', saveResult.error);
    }
    
    // Navigate away
    await pc.navigate('https://www.iana.org');
    console.log('Navigated to iana.org');
    
    // Get current state before restore
    const beforeRestore = await pc.getCurrentState();
    console.log('URL before restore:', beforeRestore.value?.url);
    
    // Restore state
    const restoreResult = await pc.restoreState('test-checkpoint');
    console.log('Restore state result:', restoreResult.success ? '✓' : '✗');
    if (!restoreResult.success) {
      console.log('Error:', restoreResult.error);
    }
    
    // Wait a bit for navigation to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get current state after restore
    const afterRestore = await pc.getCurrentState();
    console.log('URL after restore:', afterRestore.value?.url);
    
    // Verify we're back on example.com
    const textResult = await pc.getText();
    console.log('Page contains "Example Domain":', 
                textResult.data.text.includes('Example Domain') ? '✓' : '✗');
    
  } finally {
    await pc.close();
  }
}

testState().catch(console.error);