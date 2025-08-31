/**
 * Debug test for cookie issue
 */

const { PlayClone } = require('../dist/index');

async function debugCookieTest() {
  console.log('🍪 Cookie Debug Test');
  
  const pc = new PlayClone({ 
    headless: true,
    browser: 'chromium' 
  });
  
  try {
    // Navigate first
    console.log('\n1. Navigating to example.com...');
    const navResult = await pc.navigate('https://example.com');
    console.log('   Navigation result:', navResult);
    
    // Try to set a cookie with just domain
    console.log('\n2. Setting cookie with just domain...');
    const setCookieResult = await pc.setCookie({
      name: 'test_cookie',
      value: 'test_value_123',
      domain: 'example.com',
      path: '/'
    });
    console.log('   Set cookie result:', setCookieResult);
    
    // Try with .domain
    console.log('\n3. Setting cookie with .domain...');
    const setCookieResult2 = await pc.setCookie({
      name: 'test_cookie2',
      value: 'test_value_456',
      domain: '.example.com',
      path: '/'
    });
    console.log('   Set cookie result 2:', setCookieResult2);
    
    // Try without domain (should auto-detect)
    console.log('\n4. Setting cookie without domain (auto-detect)...');
    const setCookieResult3 = await pc.setCookie({
      name: 'test_cookie3',
      value: 'test_value_789',
      path: '/'
    });
    console.log('   Set cookie result 3:', setCookieResult3);
    
    // Get all cookies
    console.log('\n5. Getting all cookies...');
    const getCookiesResult = await pc.getCookies();
    console.log('   Cookies:', getCookiesResult);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pc.close();
  }
}

debugCookieTest();