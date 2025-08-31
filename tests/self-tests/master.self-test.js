/**
 * Master Self-Test Suite for PlayClone
 * PlayClone tests itself! This is meta-testing at its finest.
 */

const { PlayClone } = require('../../dist/index');

// Test utilities
class TestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  add(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async run() {
    console.log('🚀 PlayClone Self-Test Suite Starting...\n');
    console.log('📋 Running', this.tests.length, 'tests\n');
    
    let passed = 0;
    let failed = 0;
    
    for (const test of this.tests) {
      try {
        console.log(`Testing: ${test.name}`);
        await test.testFn();
        console.log(`  ✅ PASSED\n`);
        passed++;
        this.results.push({ name: test.name, status: 'passed' });
      } catch (error) {
        console.log(`  ❌ FAILED:`, error.message, '\n');
        failed++;
        this.results.push({ name: test.name, status: 'failed', error: error.message });
      }
    }
    
    console.log('\n📊 Results:');
    console.log(`  ✅ Passed: ${passed}/${this.tests.length} (${Math.round(passed/this.tests.length*100)}%)`);
    console.log(`  ❌ Failed: ${failed}/${this.tests.length}`);
    
    return { passed, failed, total: this.tests.length };
  }
}

// Create test runner
const runner = new TestRunner();

// Test 1: Navigation
runner.add('Navigation to example.com', async () => {
  const pc = new PlayClone({ headless: true });
  try {
    const result = await pc.navigate('https://example.com');
    if (!result.success) throw new Error('Navigation failed');
    if (!result.value.url.includes('example.com')) throw new Error('Wrong URL');
    if (!result.value.title.includes('Example')) throw new Error('Wrong title');
    
    // Verify response is AI-optimized
    const responseSize = JSON.stringify(result).length;
    if (responseSize > 1024) throw new Error(`Response too large: ${responseSize} bytes`);
  } finally {
    await pc.close();
  }
});

// Test 2: Text Extraction
runner.add('Text extraction from page', async () => {
  const pc = new PlayClone({ headless: true });
  try {
    await pc.navigate('https://example.com');
    const result = await pc.getText();
    if (!result.data) throw new Error('No data returned');
    if (!result.data.text) throw new Error('No text extracted');
    if (!result.data.text.includes('Example Domain')) throw new Error('Text not found');
  } finally {
    await pc.close();
  }
});

// Test 3: Natural Language Click
runner.add('Click using natural language', async () => {
  const pc = new PlayClone({ headless: true });
  try {
    await pc.navigate('https://example.com');
    const result = await pc.click('More information link');
    if (!result.success) throw new Error('Click failed: ' + result.error);
    
    // Wait for navigation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify we navigated
    const textResult = await pc.getText();
    if (!textResult.data.text.includes('IANA')) {
      throw new Error('Navigation after click failed');
    }
  } finally {
    await pc.close();
  }
});

// Test 4: Form Filling
runner.add('Fill form fields', async () => {
  const pc = new PlayClone({ headless: true });
  try {
    // Use local test form for reliable testing
    const path = require('path');
    const formPath = 'file://' + path.resolve(__dirname, '../test-simple-form.html');
    await pc.navigate(formPath);
    
    // Test various form operations
    const fillResult = await pc.fill('username', 'testuser');
    if (!fillResult.success) throw new Error('Fill username failed');
    
    const selectResult = await pc.select('country', 'Canada');
    if (!selectResult.success) throw new Error('Select country failed');
    
    const checkResult = await pc.check('agree');
    if (!checkResult.success) throw new Error('Check agree failed');
    
    // Verify form data
    const formData = await pc.getFormData();
    if (!formData.data.forms[0].fields.find(f => f.name === 'username' && f.value === 'testuser')) {
      throw new Error('Form data not properly filled');
    }
  } finally {
    await pc.close();
  }
});

// Test 5: Back/Forward Navigation
runner.add('Browser history navigation', async () => {
  const pc = new PlayClone({ headless: true });
  try {
    await pc.navigate('https://example.com');
    await pc.navigate('https://www.iana.org/domains/example');
    
    const backResult = await pc.back();
    if (!backResult.success) throw new Error('Back navigation failed');
    if (!backResult.value.url.includes('example.com')) throw new Error('Back went to wrong page');
    
    const forwardResult = await pc.forward();
    if (!forwardResult.success) throw new Error('Forward navigation failed');
    if (!forwardResult.value.url.includes('iana.org')) throw new Error('Forward went to wrong page');
  } finally {
    await pc.close();
  }
});

// Test 6: Screenshot
runner.add('Take screenshot', async () => {
  const pc = new PlayClone({ headless: true });
  try {
    await pc.navigate('https://example.com');
    const result = await pc.screenshot();
    if (!result.data) throw new Error('No screenshot data');
    
    // Response should be AI-optimized
    const responseSize = JSON.stringify(result).length;
    console.log(`    Screenshot response size: ${responseSize} bytes`);
  } finally {
    await pc.close();
  }
});

// Test 7: Links Extraction
runner.add('Extract links from page', async () => {
  const pc = new PlayClone({ headless: true });
  try {
    await pc.navigate('https://example.com');
    const result = await pc.getLinks();
    if (!result.data) throw new Error('No links data');
    
    const allLinks = [...(result.data.internal || []), ...(result.data.external || [])];
    if (allLinks.length === 0) throw new Error('No links found');
    
    const moreInfoLink = allLinks.find(l => l.text.includes('More information'));
    if (!moreInfoLink) throw new Error('Expected link not found');
  } finally {
    await pc.close();
  }
});

// Test 8: State Management
runner.add('Save and restore state', async () => {
  const pc = new PlayClone({ headless: true });
  try {
    await pc.navigate('https://example.com');
    const saveResult = await pc.saveState('test-checkpoint');
    if (!saveResult.success) throw new Error('Save state failed');
    
    await pc.navigate('https://www.iana.org');
    
    const restoreResult = await pc.restoreState('test-checkpoint');
    if (!restoreResult.success) throw new Error('Restore state failed');
    
    // Navigate to verify we're back on example.com
    const textResult = await pc.getText();
    if (!textResult.data.text.includes('Example Domain')) {
      throw new Error('State not properly restored');
    }
  } finally {
    await pc.close();
  }
});

// Test 9: Error Handling
runner.add('Handle navigation errors gracefully', async () => {
  const pc = new PlayClone({ headless: true });
  try {
    const result = await pc.navigate('https://this-domain-does-not-exist-12345.com');
    if (result.success) throw new Error('Should have failed');
    if (!result.error) throw new Error('No error message provided');
  } finally {
    await pc.close();
  }
});

// Test 10: Response Size Optimization
runner.add('Verify AI-optimized responses', async () => {
  const pc = new PlayClone({ headless: true });
  try {
    await pc.navigate('https://example.com');
    
    // Test various operations for response size
    const operations = [
      { name: 'navigate', fn: () => pc.navigate('https://example.com') },
      { name: 'getText', fn: () => pc.getText() },
      { name: 'getLinks', fn: () => pc.getLinks() },
      { name: 'click', fn: () => pc.click('non-existent') },
    ];
    
    for (const op of operations) {
      const result = await op.fn();
      const size = JSON.stringify(result).length;
      console.log(`    ${op.name} response: ${size} bytes`);
      if (size > 2048) {
        throw new Error(`${op.name} response too large: ${size} bytes`);
      }
    }
  } finally {
    await pc.close();
  }
});

// Run all tests
async function main() {
  console.log('=' .repeat(60));
  console.log('  🎯 PlayClone Self-Test Suite (Meta-Testing!)');
  console.log('  PlayClone is testing PlayClone - Inception style!');
  console.log('=' .repeat(60));
  console.log();
  
  const results = await runner.run();
  
  console.log('\n' + '=' .repeat(60));
  if (results.failed === 0) {
    console.log('  🎉 ALL TESTS PASSED! PlayClone works perfectly!');
  } else {
    console.log('  ⚠️  Some tests failed. Please review the results.');
  }
  console.log('=' .repeat(60));
  
  process.exit(results.failed === 0 ? 0 : 1);
}

main().catch(console.error);