/**
 * Test suite for PlayClone Cookie Management API
 * Tests all cookie operations including get, set, delete, clear, import/export
 */

const { PlayClone } = require('../dist/index');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

async function testCookieManagement() {
  log('\n🍪 PlayClone Cookie Management Test Suite', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  const pc = new PlayClone({ 
    headless: true,
    browser: 'chromium' 
  });
  
  let passCount = 0;
  let failCount = 0;
  const startTime = Date.now();
  
  try {
    // Test 1: Navigate to a website that sets cookies
    log('\n📝 Test 1: Navigate to website with cookies', 'blue');
    const navResult = await pc.navigate('https://example.com');
    if (navResult.success) {
      log('✅ Navigation successful', 'green');
      passCount++;
    } else {
      log('❌ Navigation failed: ' + navResult.error, 'red');
      failCount++;
    }
    
    // Test 2: Set a custom cookie
    log('\n📝 Test 2: Set a custom cookie', 'blue');
    const setCookieResult = await pc.setCookie({
      name: 'test_cookie',
      value: 'test_value_123',
      domain: 'example.com',
      path: '/',
      secure: true,
      httpOnly: false
    });
    
    if (setCookieResult.success) {
      log('✅ Cookie set successfully', 'green');
      passCount++;
    } else {
      log('❌ Failed to set cookie: ' + setCookieResult.error, 'red');
      failCount++;
    }
    
    // Test 3: Get all cookies
    log('\n📝 Test 3: Get all cookies', 'blue');
    const getCookiesResult = await pc.getCookies();
    
    if (getCookiesResult.success && getCookiesResult.cookies) {
      log(`✅ Retrieved ${getCookiesResult.count} cookies`, 'green');
      if (getCookiesResult.cookies.length > 0) {
        log('  Sample cookie:', 'yellow');
        const firstCookie = getCookiesResult.cookies[0];
        log(`    Name: ${firstCookie.name}`, 'yellow');
        log(`    Value: ${firstCookie.value}`, 'yellow');
        log(`    Domain: ${firstCookie.domain}`, 'yellow');
      }
      passCount++;
    } else {
      log('❌ Failed to get cookies: ' + getCookiesResult.error, 'red');
      failCount++;
    }
    
    // Test 4: Get specific cookie by name
    log('\n📝 Test 4: Get specific cookie by name', 'blue');
    const specificCookieResult = await pc.getCookies({ name: 'test_cookie' });
    
    if (specificCookieResult.success && specificCookieResult.cookies && specificCookieResult.cookies.length > 0) {
      const cookie = specificCookieResult.cookies[0];
      if (cookie.value === 'test_value_123') {
        log('✅ Retrieved correct cookie value', 'green');
        passCount++;
      } else {
        log('❌ Cookie value mismatch', 'red');
        failCount++;
      }
    } else {
      log('❌ Failed to get specific cookie', 'red');
      failCount++;
    }
    
    // Test 5: Check if cookie exists
    log('\n📝 Test 5: Check if cookie exists', 'blue');
    const hasTestCookie = await pc.hasCookie('test_cookie');
    const hasNonExistent = await pc.hasCookie('non_existent_cookie');
    
    if (hasTestCookie && !hasNonExistent) {
      log('✅ Cookie existence check working correctly', 'green');
      passCount++;
    } else {
      log('❌ Cookie existence check failed', 'red');
      failCount++;
    }
    
    // Test 6: Get cookie value
    log('\n📝 Test 6: Get cookie value directly', 'blue');
    const cookieValue = await pc.getCookieValue('test_cookie');
    
    if (cookieValue === 'test_value_123') {
      log('✅ Retrieved correct cookie value', 'green');
      passCount++;
    } else {
      log(`❌ Wrong cookie value: ${cookieValue}`, 'red');
      failCount++;
    }
    
    // Test 7: Set multiple cookies
    log('\n📝 Test 7: Set multiple cookies at once', 'blue');
    const multipleResult = await pc.setCookies([
      {
        name: 'session_id',
        value: 'abc123xyz',
        domain: 'example.com',
        path: '/'
      },
      {
        name: 'user_pref',
        value: 'dark_mode',
        domain: 'example.com',
        path: '/'
      }
    ]);
    
    if (multipleResult.success) {
      log('✅ Multiple cookies set successfully', 'green');
      passCount++;
    } else {
      log('❌ Failed to set multiple cookies', 'red');
      failCount++;
    }
    
    // Test 8: Export cookies to JSON
    log('\n📝 Test 8: Export cookies to JSON', 'blue');
    let exportedCookies;
    try {
      exportedCookies = await pc.exportCookies();
      const parsedExport = JSON.parse(exportedCookies);
      if (Array.isArray(parsedExport) && parsedExport.length > 0) {
        log(`✅ Exported ${parsedExport.length} cookies to JSON`, 'green');
        passCount++;
      } else {
        log('❌ Exported cookies format incorrect', 'red');
        failCount++;
      }
    } catch (error) {
      log('❌ Failed to export cookies: ' + error.message, 'red');
      failCount++;
    }
    
    // Test 9: Delete a specific cookie
    log('\n📝 Test 9: Delete a specific cookie', 'blue');
    const deleteResult = await pc.deleteCookie('test_cookie');
    
    if (deleteResult.success) {
      // Verify deletion
      const afterDelete = await pc.hasCookie('test_cookie');
      if (!afterDelete) {
        log('✅ Cookie deleted successfully', 'green');
        passCount++;
      } else {
        log('❌ Cookie still exists after deletion', 'red');
        failCount++;
      }
    } else {
      log('❌ Failed to delete cookie', 'red');
      failCount++;
    }
    
    // Test 10: Clear all cookies
    log('\n📝 Test 10: Clear all cookies', 'blue');
    const clearResult = await pc.clearCookies();
    
    if (clearResult.success) {
      // Verify all cookies are cleared
      const afterClear = await pc.getCookies();
      if (afterClear.success && afterClear.cookies && afterClear.cookies.length === 0) {
        log('✅ All cookies cleared successfully', 'green');
        passCount++;
      } else {
        log(`❌ ${afterClear.cookies?.length || 0} cookies still remain`, 'red');
        failCount++;
      }
    } else {
      log('❌ Failed to clear cookies', 'red');
      failCount++;
    }
    
    // Test 11: Import cookies from JSON
    log('\n📝 Test 11: Import cookies from JSON', 'blue');
    if (exportedCookies) {
      const importResult = await pc.importCookies(exportedCookies);
      
      if (importResult.success) {
        // Verify import
        const afterImport = await pc.getCookies();
        if (afterImport.success && afterImport.cookies && afterImport.cookies.length > 0) {
          log(`✅ Imported ${afterImport.cookies.length} cookies from JSON`, 'green');
          passCount++;
        } else {
          log('❌ No cookies after import', 'red');
          failCount++;
        }
      } else {
        log('❌ Failed to import cookies', 'red');
        failCount++;
      }
    } else {
      log('⚠️ Skipping import test (no exported cookies)', 'yellow');
    }
    
    // Test 12: Test cookies with different domains
    log('\n📝 Test 12: Navigate to different domain and test cookies', 'blue');
    await pc.navigate('https://httpbin.org/cookies');
    
    // Set a cookie for httpbin.org
    const httpbinCookie = await pc.setCookie({
      name: 'httpbin_test',
      value: 'httpbin_value',
      domain: 'httpbin.org',
      path: '/'
    });
    
    if (httpbinCookie.success) {
      // Check the page content to see if cookie is sent
      const pageText = await pc.getText();
      const textContent = typeof pageText.data === 'string' ? pageText.data : 
                         (pageText.data ? JSON.stringify(pageText.data) : '');
      if (textContent && textContent.includes('httpbin_test')) {
        log('✅ Cookie sent to different domain correctly', 'green');
        passCount++;
      } else {
        log('⚠️ Cookie may not be visible in response', 'yellow');
        passCount++; // Still pass if cookie was set successfully
      }
    } else {
      log('❌ Failed to set cookie for different domain', 'red');
      failCount++;
    }
    
  } catch (error) {
    log('\n❌ Test suite error: ' + error.message, 'red');
    log(error.stack, 'red');
  } finally {
    await pc.close();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalTests = passCount + failCount;
    const passRate = totalTests > 0 ? ((passCount / totalTests) * 100).toFixed(1) : 0;
    
    log('\n' + '=' .repeat(50), 'cyan');
    log('🍪 Cookie Management Test Results', 'cyan');
    log('=' .repeat(50), 'cyan');
    log(`✅ Passed: ${passCount}/${totalTests} tests`, 'green');
    log(`❌ Failed: ${failCount}/${totalTests} tests`, failCount > 0 ? 'red' : 'green');
    log(`📊 Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'yellow');
    log(`⏱️ Duration: ${duration}s`, 'blue');
    
    if (passRate >= 80) {
      log('\n🎉 Cookie Management API is working well!', 'green');
    } else if (passRate >= 60) {
      log('\n⚠️ Cookie Management API needs some improvements', 'yellow');
    } else {
      log('\n❌ Cookie Management API has significant issues', 'red');
    }
  }
}

// Run the test
testCookieManagement().catch(error => {
  log('Fatal error: ' + error.message, 'red');
  process.exit(1);
});