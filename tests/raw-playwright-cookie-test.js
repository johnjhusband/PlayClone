/**
 * Test Playwright's cookie API directly to understand requirements
 */

const { chromium } = require('playwright-core');

async function testPlaywrightCookies() {
  console.log('Testing Playwright Cookie API directly...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to a page
    await page.goto('https://example.com');
    console.log('✅ Navigated to example.com');
    
    // Test 1: Set cookie with URL
    console.log('\nTest 1: Set cookie with URL');
    try {
      await context.addCookies([{
        name: 'test1',
        value: 'value1',
        url: 'https://example.com'
      }]);
      console.log('✅ Cookie set with URL');
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
    
    // Test 2: Set cookie with domain
    console.log('\nTest 2: Set cookie with domain');
    try {
      await context.addCookies([{
        name: 'test2',
        value: 'value2',
        domain: 'example.com',
        path: '/'
      }]);
      console.log('✅ Cookie set with domain');
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
    
    // Test 3: Set cookie with .domain
    console.log('\nTest 3: Set cookie with .domain');
    try {
      await context.addCookies([{
        name: 'test3',
        value: 'value3',
        domain: '.example.com',
        path: '/'
      }]);
      console.log('✅ Cookie set with .domain');
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
    
    // Test 4: Set cookie with only name/value
    console.log('\nTest 4: Set cookie with only name/value');
    try {
      await context.addCookies([{
        name: 'test4',
        value: 'value4'
      }]);
      console.log('✅ Cookie set with only name/value');
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
    
    // Get all cookies
    console.log('\nGetting all cookies:');
    const cookies = await context.cookies();
    console.log('Found', cookies.length, 'cookies:');
    cookies.forEach(c => {
      console.log(`  - ${c.name}: ${c.value} (domain: ${c.domain})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testPlaywrightCookies();