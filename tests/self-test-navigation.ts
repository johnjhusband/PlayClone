/**
 * Self-Test: Navigation
 * PlayClone tests its own navigation capabilities
 */

import { PlayClone } from '../dist/index';
import assert from 'assert';

async function testNavigation() {
  console.log('🚀 PlayClone Self-Test: Navigation');
  console.log('================================');
  
  let pc: PlayClone | null = null;
  
  try {
    // Initialize PlayClone
    console.log('📦 Initializing PlayClone...');
    pc = new PlayClone({ 
      headless: true,
      browser: 'chromium' 
    });
    
    // Test 1: Basic navigation
    console.log('\n✅ Test 1: Basic Navigation');
    const navResult = await pc.navigate('https://example.com');
    assert(navResult.success, 'Navigation failed');
    assert(navResult.value || navResult.url, 'No data returned');
    
    // Verify response is AI-optimized (under 1KB)
    const responseSize = JSON.stringify(navResult).length;
    console.log(`   Response size: ${responseSize} bytes`);
    assert(responseSize < 1024, `Response not AI-optimized: ${responseSize} bytes`);
    
    // Test 2: Navigate to another page
    console.log('\n✅ Test 2: Navigate to GitHub');
    const githubResult = await pc.navigate('https://github.com');
    assert(githubResult.success, 'GitHub navigation failed');
    assert(githubResult.value?.url?.includes('github.com') || githubResult.url?.includes('github.com'), 'URL not updated');
    
    // Test 3: Back navigation
    console.log('\n✅ Test 3: Back Navigation');
    const backResult = await pc.back();
    assert(backResult.success, 'Back navigation failed');
    assert(backResult.value?.url?.includes('example.com') || backResult.url?.includes('example.com'), 'Did not go back to example.com');
    
    // Test 4: Forward navigation
    console.log('\n✅ Test 4: Forward Navigation');
    const forwardResult = await pc.forward();
    assert(forwardResult.success, 'Forward navigation failed');
    assert(forwardResult.value?.url?.includes('github.com') || forwardResult.url?.includes('github.com'), 'Did not go forward to github.com');
    
    // Test 5: Reload
    console.log('\n✅ Test 5: Page Reload');
    const reloadResult = await pc.reload();
    assert(reloadResult.success, 'Reload failed');
    assert(reloadResult.value?.url?.includes('github.com') || reloadResult.url?.includes('github.com'), 'URL changed after reload');
    
    // Test 6: Invalid URL handling
    console.log('\n✅ Test 6: Invalid URL Handling');
    const invalidResult = await pc.navigate('not-a-valid-url');
    assert(!invalidResult.success, 'Should have failed for invalid URL');
    assert(invalidResult.error, 'No error message for invalid URL');
    // Suggestion is optional
    console.log(`   Error: ${invalidResult.error}${invalidResult.suggestion ? `, Suggestion: ${invalidResult.suggestion}` : ''}`);
    
    // Test 7: Timeout handling
    console.log('\n✅ Test 7: Timeout Handling');
    const timeoutResult = await pc.navigate('https://httpstat.us/200?sleep=60000');
    assert(!timeoutResult.success || timeoutResult.url, 'Should handle timeout gracefully');
    
    // Test 8: Multiple rapid navigations
    console.log('\n✅ Test 8: Rapid Navigation');
    const urls = [
      'https://example.com',
      'https://www.google.com',
      'https://www.wikipedia.org'
    ];
    
    for (const url of urls) {
      const result = await pc.navigate(url);
      assert(result.success || result.error, `Navigation to ${url} failed without error`);
      
      // Verify response optimization
      const size = JSON.stringify(result).length;
      assert(size < 2048, `Response too large for ${url}: ${size} bytes`);
    }
    
    // Test 9: State verification
    console.log('\n✅ Test 9: State Verification');
    // Navigate to a valid page first
    await pc.navigate('https://example.com');
    const state = await pc.getState();
    assert(state, 'No state returned');
    assert(state.url, 'No URL in state');
    assert(state.title !== undefined, 'No title in state');
    
    // Test 10: Session persistence
    console.log('\n✅ Test 10: Session Persistence');
    const sessionSave = await pc.saveState('test-nav-session');
    assert(sessionSave.success, 'Failed to save session');
    
    await pc.navigate('https://example.org');
    
    const sessionRestore = await pc.restoreState('test-nav-session');
    assert(sessionRestore.success, 'Failed to restore session');
    
    console.log('\n🎉 All navigation tests passed!');
    console.log('================================');
    
    return {
      success: true,
      testsRun: 10,
      testsPassed: 10
    };
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    // Clean up
    if (pc) {
      console.log('\n🧹 Cleaning up...');
      await pc.close();
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testNavigation()
    .then(result => {
      if (result.success) {
        console.log('\n✅ PlayClone navigation self-test completed successfully!');
        process.exit(0);
      } else {
        console.error('\n❌ PlayClone navigation self-test failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ Unexpected error:', error);
      process.exit(1);
    });
}

export { testNavigation };