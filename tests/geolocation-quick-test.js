/**
 * Quick test for geolocation spoofing
 */

const { PlayClone } = require('../dist/index');

async function quickGeoTest() {
  console.log('🧪 Quick Geolocation Test...\n');
  
  const pc = new PlayClone({ 
    headless: true,  // Use headless for faster testing
    viewport: { width: 1280, height: 720 } 
  });
  
  try {
    // Navigate to a simple page
    console.log('📍 Navigating to test page...');
    await pc.navigate('https://example.com');
    
    // Test 1: Set location to New York
    console.log('\n✅ Test 1: Set location to New York');
    const nyResult = await pc.setGeolocation('new-york');
    console.log('Result:', nyResult.success ? 'SUCCESS' : 'FAILED');
    if (nyResult.data) {
      console.log('Location:', nyResult.data);
    }
    
    // Test 2: Get current location
    console.log('\n✅ Test 2: Get current location');
    const currentLoc = pc.getCurrentGeolocation();
    console.log('Current location:', currentLoc || 'None');
    
    // Test 3: Clear location
    console.log('\n✅ Test 3: Clear geolocation');
    const clearResult = await pc.clearGeolocation();
    console.log('Clear result:', clearResult.success ? 'SUCCESS' : 'FAILED');
    
    // Test 4: Get presets
    console.log('\n✅ Test 4: Get location presets');
    const presets = pc.getLocationPresets();
    console.log('Available presets:', presets.length);
    console.log('Sample presets:', presets.slice(0, 3).map(p => p.name));
    
    console.log('\n✨ Quick test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc.close();
  }
}

// Run the test
quickGeoTest().catch(console.error);