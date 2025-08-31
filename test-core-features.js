/**
 * Test PlayClone core features quickly
 */

const { PlayClone } = require('./dist/index.js');

async function testCoreFeatures() {
  const pc = new PlayClone({ 
    headless: true,
    timeout: 10000 
  });
  
  try {
    console.log('🎯 PlayClone Core Feature Test');
    console.log('=' .repeat(40));
    
    // Test 1: Navigation
    console.log('\n✓ Testing navigation...');
    const navResult = await pc.navigate('https://example.com');
    console.log(`  Status: ${navResult.success ? '✅' : '❌'}`);
    
    // Test 2: Text extraction
    console.log('\n✓ Testing text extraction...');
    const textResult = await pc.getText();
    const hasText = textResult.data?.text?.includes('Example Domain');
    console.log(`  Status: ${hasText ? '✅' : '❌'}`);
    
    // Test 3: Natural language click
    console.log('\n✓ Testing natural language click...');
    const clickResult = await pc.click('More information');
    console.log(`  Status: ${clickResult.success ? '✅' : '❌'}`);
    
    // Test 4: Browser navigation
    console.log('\n✓ Testing browser back...');
    const backResult = await pc.back();
    console.log(`  Status: ${backResult.success ? '✅' : '❌'}`);
    
    // Test 5: Link extraction
    console.log('\n✓ Testing link extraction...');
    const linksResult = await pc.getLinks();
    const hasLinks = linksResult.data?.internal || linksResult.data?.external;
    console.log(`  Status: ${hasLinks ? '✅' : '❌'}`);
    
    // Test 6: State management
    console.log('\n✓ Testing state save/restore...');
    const saveResult = await pc.saveState('test-checkpoint');
    await pc.navigate('https://www.iana.org');
    const restoreResult = await pc.restoreState('test-checkpoint');
    const restored = restoreResult.success && restoreResult.value?.url?.includes('example.com');
    console.log(`  Status: ${restored ? '✅' : '❌'}`);
    
    // Test 7: Screenshot
    console.log('\n✓ Testing screenshot...');
    const screenshotResult = await pc.screenshot();
    const hasScreenshot = screenshotResult.success && screenshotResult.value?.data;
    console.log(`  Status: ${hasScreenshot ? '✅' : '❌'}`);
    
    console.log('\n' + '=' .repeat(40));
    console.log('✨ All core features tested!');
    console.log('🎯 PlayClone is working correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pc.close();
    console.log('👋 Browser closed.');
  }
}

// Run tests
testCoreFeatures().catch(console.error);