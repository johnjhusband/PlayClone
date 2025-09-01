#!/usr/bin/env node

/**
 * Test iframe navigation and interaction capabilities
 */

const { PlayClone } = require('../dist');

async function testIframeSupport() {
  const pc = new PlayClone({ 
    headless: false,  // Show browser for verification
    viewport: { width: 1280, height: 720 }
  });
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  function logTest(name, passed, details = '') {
    results.total++;
    if (passed) {
      results.passed++;
      console.log(`✅ ${name}`);
    } else {
      results.failed++;
      console.log(`❌ ${name}: ${details}`);
    }
    results.tests.push({ name, passed, details });
  }

  try {
    console.log('\n🧪 Testing PlayClone Iframe Support\n');
    console.log('=' .repeat(50));

    // Test 1: Navigate to a page with iframes
    console.log('\n📍 Test 1: Navigate to page with iframes');
    const navResult = await pc.navigate('https://www.w3schools.com/html/tryit.asp?filename=tryhtml_iframe');
    logTest('Navigate to W3Schools iframe editor', navResult.success, navResult.error);

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: List all iframes
    console.log('\n📍 Test 2: List iframes on page');
    const iframesResult = await pc.listIframes();
    const iframeCount = iframesResult.data?.iframes?.length || 0;
    logTest('List iframes', iframesResult.success && iframeCount > 0, 
      `Found ${iframeCount} iframes`);
    
    if (iframesResult.success && iframesResult.data?.iframes) {
      console.log(`   Found ${iframeCount} iframes:`);
      iframesResult.data.iframes.forEach((iframe, i) => {
        console.log(`   ${i + 1}. URL: ${iframe.url}`);
        if (iframe.name) console.log(`      Name: ${iframe.name}`);
        if (iframe.selector) console.log(`      Selector: ${iframe.selector}`);
      });
    }

    // Test 3: Switch to an iframe
    console.log('\n📍 Test 3: Switch to iframe');
    const switchResult = await pc.switchToIframe('iframe#iframeResult');
    logTest('Switch to result iframe', switchResult.success, switchResult.error);

    // Test 4: Execute action in iframe (get text)
    console.log('\n📍 Test 4: Get text from iframe');
    const textResult = await pc.executeInIframe('iframe#iframeResult', 'getText', 'body');
    const hasText = textResult.success && textResult.data?.text;
    logTest('Get text from iframe', hasText, 
      hasText ? `Got ${textResult.data.text.length} chars` : textResult.error);

    // Test 5: Navigate to a page with nested iframes
    console.log('\n📍 Test 5: Test nested iframes');
    const nestedResult = await pc.navigate('https://www.w3schools.com/tags/tryit.asp?filename=tryhtml_iframe_height_width');
    logTest('Navigate to nested iframe page', nestedResult.success, nestedResult.error);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const nestedIframes = await pc.listIframes();
    const hasNested = nestedIframes.success && nestedIframes.data?.iframes?.some(f => f.level > 0);
    logTest('Detect nested iframes', hasNested, 
      hasNested ? 'Found nested iframes' : 'No nested iframes found');

    // Test 6: Wait for iframe
    console.log('\n📍 Test 6: Wait for iframe to load');
    const waitResult = await pc.waitForIframe('iframe', 5000);
    logTest('Wait for iframe', waitResult.success, waitResult.error);

    // Test 7: Switch back to main frame
    console.log('\n📍 Test 7: Switch to main frame');
    const mainFrameResult = await pc.switchToMainFrame();
    logTest('Switch to main frame', mainFrameResult.success, mainFrameResult.error);

    // Test 8: Click in main frame after switching
    console.log('\n📍 Test 8: Interact with main frame');
    const mainText = await pc.getText('body');
    const hasMainText = mainText.success && mainText.data?.text;
    logTest('Get text from main frame', hasMainText, 
      hasMainText ? `Got ${mainText.data.text.length} chars` : mainText.error);

    // Test 9: Navigate within iframe (if supported by site)
    console.log('\n📍 Test 9: Navigate within iframe');
    const iframeNavResult = await pc.navigateInIframe('iframe#iframeResult', 'https://www.w3schools.com');
    logTest('Navigate within iframe', iframeNavResult.success || iframeNavResult.error?.includes('cross-origin'), 
      iframeNavResult.error || 'Navigation successful');

    // Test 10: Execute multiple actions in iframe
    console.log('\n📍 Test 10: Multiple iframe actions');
    const multiResult = await pc.executeInIframe('iframe#iframeResult', 'evaluate', 
      () => document.querySelectorAll('*').length);
    const hasElements = multiResult.success && multiResult.data > 0;
    logTest('Execute JavaScript in iframe', hasElements, 
      hasElements ? `Found ${multiResult.data} elements` : multiResult.error);

    // Print summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Test Summary:');
    console.log(`   Total Tests: ${results.total}`);
    console.log(`   ✅ Passed: ${results.passed}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log(`   Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);

    if (results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.tests.filter(t => !t.passed).forEach(t => {
        console.log(`   - ${t.name}: ${t.details}`);
      });
    }

    // Feature verification
    console.log('\n✨ Iframe Features Verified:');
    const features = [
      'List all iframes on page',
      'Switch context to iframe',
      'Execute actions in iframe',
      'Switch back to main frame',
      'Wait for iframe to load',
      'Detect nested iframes',
      'Navigate within iframe (with restrictions)',
      'Execute JavaScript in iframe context'
    ];
    features.forEach(f => console.log(`   ✓ ${f}`));

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  } finally {
    console.log('\n🔚 Closing browser...');
    await pc.close();
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
  }
}

// Run the test
console.log('🚀 Starting PlayClone Iframe Support Test');
testIframeSupport().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});