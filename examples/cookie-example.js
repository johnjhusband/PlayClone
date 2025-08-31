/**
 * PlayClone Cookie Management Example
 * Demonstrates various cookie operations
 */

const { PlayClone } = require('../dist/index');
const fs = require('fs');

async function cookieManagementExample() {
  console.log('🍪 PlayClone Cookie Management Example\n');
  
  const pc = new PlayClone({ 
    headless: false, // Set to false to see the browser
    browser: 'chromium' 
  });
  
  try {
    // 1. Navigate to a website
    console.log('1. Navigating to example.com...');
    await pc.navigate('https://example.com');
    console.log('   ✅ Navigation complete\n');
    
    // 2. Set a simple cookie
    console.log('2. Setting a simple cookie...');
    await pc.setCookie({
      name: 'user_preference',
      value: 'dark_mode',
      domain: 'example.com',
      path: '/'
    });
    console.log('   ✅ Cookie set\n');
    
    // 3. Set a secure cookie with expiration
    console.log('3. Setting a secure cookie with expiration...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await pc.setCookie({
      name: 'session_token',
      value: 'xyz789secure',
      domain: 'example.com',
      path: '/',
      expires: Math.floor(tomorrow.getTime() / 1000),
      secure: true,
      httpOnly: true,
      sameSite: 'Strict'
    });
    console.log('   ✅ Secure cookie set\n');
    
    // 4. Set multiple cookies at once
    console.log('4. Setting multiple cookies at once...');
    await pc.setCookies([
      {
        name: 'language',
        value: 'en-US',
        domain: 'example.com',
        path: '/'
      },
      {
        name: 'timezone',
        value: 'UTC',
        domain: 'example.com',
        path: '/'
      },
      {
        name: 'theme',
        value: 'blue',
        domain: 'example.com',
        path: '/'
      }
    ]);
    console.log('   ✅ Multiple cookies set\n');
    
    // 5. Get all cookies
    console.log('5. Getting all cookies...');
    const allCookies = await pc.getCookies();
    console.log(`   Found ${allCookies.count} cookies:`);
    if (allCookies.cookies) {
      allCookies.cookies.forEach(cookie => {
        console.log(`   - ${cookie.name}: ${cookie.value}`);
      });
    }
    console.log();
    
    // 6. Get specific cookie by name
    console.log('6. Getting specific cookie (session_token)...');
    const sessionCookie = await pc.getCookies({ name: 'session_token' });
    if (sessionCookie.cookies && sessionCookie.cookies.length > 0) {
      const cookie = sessionCookie.cookies[0];
      console.log(`   Found: ${cookie.name} = ${cookie.value}`);
      console.log(`   Secure: ${cookie.secure}, HttpOnly: ${cookie.httpOnly}\n`);
    }
    
    // 7. Get cookie value directly
    console.log('7. Getting cookie value directly...');
    const themeValue = await pc.getCookieValue('theme');
    console.log(`   Theme cookie value: ${themeValue}\n`);
    
    // 8. Check if cookie exists
    console.log('8. Checking if cookies exist...');
    const hasSession = await pc.hasCookie('session_token');
    const hasNonExistent = await pc.hasCookie('non_existent');
    console.log(`   Has session_token: ${hasSession}`);
    console.log(`   Has non_existent: ${hasNonExistent}\n`);
    
    // 9. Export cookies to JSON
    console.log('9. Exporting cookies to JSON...');
    const exportedCookies = await pc.exportCookies();
    const cookieFile = 'exported-cookies.json';
    fs.writeFileSync(cookieFile, exportedCookies);
    console.log(`   ✅ Cookies exported to ${cookieFile}`);
    console.log(`   File size: ${exportedCookies.length} bytes\n`);
    
    // 10. Delete a specific cookie
    console.log('10. Deleting theme cookie...');
    await pc.deleteCookie('theme');
    const afterDelete = await pc.hasCookie('theme');
    console.log(`   Theme cookie exists after delete: ${afterDelete}\n`);
    
    // 11. Clear all cookies
    console.log('11. Clearing all cookies...');
    await pc.clearCookies();
    const afterClear = await pc.getCookies();
    console.log(`   Cookies remaining: ${afterClear.count}\n`);
    
    // 12. Import cookies from JSON
    console.log('12. Importing cookies from JSON...');
    const savedCookies = fs.readFileSync(cookieFile, 'utf8');
    await pc.importCookies(savedCookies);
    const afterImport = await pc.getCookies();
    console.log(`   ✅ Imported ${afterImport.count} cookies\n`);
    
    // 13. Navigate to a different domain
    console.log('13. Testing cookies with different domain...');
    await pc.navigate('https://httpbin.org/cookies');
    
    // Set a cookie for httpbin.org
    await pc.setCookie({
      name: 'test_httpbin',
      value: 'httpbin_value',
      domain: 'httpbin.org',
      path: '/'
    });
    
    // The page should show our cookie
    const pageContent = await pc.getText();
    console.log('   Page shows cookies sent by browser\n');
    
    // Clean up
    if (fs.existsSync(cookieFile)) {
      fs.unlinkSync(cookieFile);
      console.log('   Cleaned up temporary cookie file\n');
    }
    
    console.log('🎉 Cookie management example complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Wait a bit to see the results
    await new Promise(resolve => setTimeout(resolve, 2000));
    await pc.close();
  }
}

// Run the example
cookieManagementExample().catch(console.error);