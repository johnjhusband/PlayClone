/**
 * Test device emulation functionality
 */

const { PlayClone } = require('../dist/index');

async function testDeviceEmulation() {
  console.log('\n🚀 Testing Device Emulation...\n');
  
  const pc = new PlayClone({ headless: false });
  
  try {
    // Navigate to a responsive test page
    console.log('1. Navigating to responsive design test page...');
    await pc.navigate('https://www.google.com');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get available device profiles
    console.log('\n2. Available device profiles:');
    const profiles = pc.getDeviceProfiles();
    console.log(`   Total profiles: ${profiles.length}`);
    
    // Get profiles by category
    console.log('\n3. Profiles by category:');
    const mobileProfiles = pc.getDeviceProfilesByCategory('mobile');
    console.log(`   Mobile profiles: ${mobileProfiles.join(', ')}`);
    
    const tabletProfiles = pc.getDeviceProfilesByCategory('tablet');
    console.log(`   Tablet profiles: ${tabletProfiles.join(', ')}`);
    
    const desktopProfiles = pc.getDeviceProfilesByCategory('desktop');
    console.log(`   Desktop profiles: ${desktopProfiles.join(', ')}`);
    
    // Test iPhone emulation
    console.log('\n4. Testing iPhone 14 Pro emulation...');
    const iPhoneResult = await pc.emulateDevice('iPhone 14 Pro');
    console.log(`   iPhone emulation: ${iPhoneResult.success ? '✅' : '❌'}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check current profile
    const currentProfile = pc.getCurrentDeviceProfile();
    if (currentProfile) {
      console.log(`   Current device: ${currentProfile.name}`);
      console.log(`   Viewport: ${currentProfile.viewport.width}x${currentProfile.viewport.height}`);
      console.log(`   Scale factor: ${currentProfile.viewport.deviceScaleFactor}`);
      console.log(`   Mobile: ${currentProfile.viewport.isMobile}`);
      console.log(`   Touch: ${currentProfile.viewport.hasTouch}`);
    }
    
    // Take screenshot as iPhone
    console.log('\n5. Taking screenshot in iPhone mode...');
    const iPhoneScreenshot = await pc.screenshot({ fullPage: false });
    console.log(`   Screenshot captured: ${iPhoneScreenshot.success ? '✅' : '❌'}`);
    
    // Test iPad emulation
    console.log('\n6. Testing iPad Pro emulation...');
    const iPadResult = await pc.emulateDevice('iPad Pro 12.9');
    console.log(`   iPad emulation: ${iPadResult.success ? '✅' : '❌'}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test Samsung Galaxy emulation
    console.log('\n7. Testing Samsung Galaxy S23 emulation...');
    const galaxyResult = await pc.emulateDevice('Samsung Galaxy S23');
    console.log(`   Galaxy emulation: ${galaxyResult.success ? '✅' : '❌'}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test Desktop emulation
    console.log('\n8. Testing Desktop Chrome emulation...');
    const desktopResult = await pc.emulateDevice('Desktop Chrome');
    console.log(`   Desktop emulation: ${desktopResult.success ? '✅' : '❌'}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create custom profile from current page
    console.log('\n9. Creating custom profile from current page...');
    const customProfile = await pc.createDeviceProfileFromPage('Custom Test Device');
    if (customProfile) {
      console.log(`   Custom profile created: ${customProfile.name}`);
      console.log(`   Custom viewport: ${customProfile.viewport.width}x${customProfile.viewport.height}`);
      
      // Add the custom profile
      pc.addCustomDeviceProfile(customProfile);
      console.log('   Custom profile added to available profiles');
      
      // Verify it's available
      const updatedProfiles = pc.getDeviceProfiles();
      const hasCustom = updatedProfiles.includes('Custom Test Device');
      console.log(`   Custom profile available: ${hasCustom ? '✅' : '❌'}`);
    }
    
    // Clear device emulation
    console.log('\n10. Clearing device emulation...');
    pc.clearDeviceEmulation();
    const clearedProfile = pc.getCurrentDeviceProfile();
    console.log(`   Emulation cleared: ${clearedProfile === null ? '✅' : '❌'}`);
    
    // Test landscape mode
    console.log('\n11. Testing landscape orientation...');
    const landscapeProfile = {
      name: 'iPhone 14 Pro Landscape',
      viewport: {
        width: 852,
        height: 393,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        isLandscape: true
      },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    };
    pc.addCustomDeviceProfile(landscapeProfile);
    const landscapeResult = await pc.emulateDevice('iPhone 14 Pro Landscape');
    console.log(`   Landscape emulation: ${landscapeResult.success ? '✅' : '❌'}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test responsive design on different devices
    console.log('\n12. Testing responsive design across devices...');
    const testDevices = ['iPhone SE', 'iPad Mini', 'Desktop HD'];
    
    for (const device of testDevices) {
      console.log(`\n   Testing ${device}...`);
      const result = await pc.emulateDevice(device);
      if (result.success) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Get page dimensions
        const dimensions = await pc.execute(`({
          width: window.innerWidth,
          height: window.innerHeight,
          pixelRatio: window.devicePixelRatio
        })`);
        
        if (dimensions.success && dimensions.value) {
          console.log(`     Window size: ${dimensions.value.width}x${dimensions.value.height}`);
          console.log(`     Pixel ratio: ${dimensions.value.pixelRatio}`);
        }
      }
    }
    
    console.log('\n✅ Device emulation test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pc.close();
  }
}

// Run the test
testDeviceEmulation().catch(console.error);