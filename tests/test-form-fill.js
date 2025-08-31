/**
 * Test form filling with specific selectors
 */

const { PlayClone } = require('../dist/index');

async function testFormFill() {
  const pc = new PlayClone({ headless: false }); // Use headed mode to see what's happening
  
  try {
    console.log('Navigating to Google...');
    await pc.navigate('https://www.google.com');
    
    // Wait a bit for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try different selectors
    const selectors = [
      'search box',
      'search field',
      'search input',
      'input',
      'q', // name attribute of Google search
    ];
    
    for (const selector of selectors) {
      console.log(`\nTrying selector: "${selector}"`);
      const result = await pc.fill(selector, 'PlayClone test');
      console.log(`  Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (result.error) {
        console.log(`  Error: ${result.error.substring(0, 100)}...`);
      }
      if (result.success) {
        console.log('  ✓ Form filled successfully!');
        break;
      }
    }
    
    // Keep browser open for 3 seconds to see the result
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } finally {
    await pc.close();
  }
}

testFormFill().catch(console.error);