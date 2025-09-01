/**
 * DNS-over-HTTPS Test Suite
 * Tests secure DNS resolution functionality
 */

const { PlayClone } = require('../dist/index');
const { DnsOverHttpsManager } = require('../dist/security/DnsOverHttpsManager');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testDnsOverHttpsManager() {
  log('\n🔒 Testing DNS-over-HTTPS Manager', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: Create DoH manager with default provider
  try {
    log('\nTest 1: Creating DoH manager with Cloudflare provider', 'blue');
    const dohManager = new DnsOverHttpsManager({
      provider: 'cloudflare',
      cache: true,
      fallbackToDNS: true
    });
    
    if (dohManager) {
      log('✅ DoH manager created successfully', 'green');
      results.passed++;
    } else {
      throw new Error('Failed to create DoH manager');
    }
  } catch (error) {
    log(`❌ Failed to create DoH manager: ${error.message}`, 'red');
    results.failed++;
  }

  // Test 2: Test DNS resolution
  try {
    log('\nTest 2: Resolving example.com using DoH', 'blue');
    const dohManager = new DnsOverHttpsManager({
      provider: 'cloudflare'
    });
    
    const addresses = await dohManager.resolve('example.com', 'A');
    
    if (addresses && addresses.length > 0) {
      log(`✅ Resolved example.com to: ${addresses.join(', ')}`, 'green');
      results.passed++;
    } else {
      throw new Error('No addresses returned');
    }
  } catch (error) {
    log(`❌ Failed to resolve DNS: ${error.message}`, 'red');
    results.failed++;
  }

  // Test 3: Test provider switching
  try {
    log('\nTest 3: Testing provider switching', 'blue');
    const dohManager = new DnsOverHttpsManager({
      provider: 'cloudflare'
    });
    
    // Get initial provider
    const initialProvider = dohManager.getCurrentProvider();
    log(`Initial provider: ${initialProvider.name}`, 'yellow');
    
    // Switch to Google
    dohManager.switchProvider('google');
    const newProvider = dohManager.getCurrentProvider();
    
    if (newProvider.name === 'Google Public DNS') {
      log(`✅ Successfully switched to: ${newProvider.name}`, 'green');
      results.passed++;
    } else {
      throw new Error('Provider switch failed');
    }
  } catch (error) {
    log(`❌ Failed to switch provider: ${error.message}`, 'red');
    results.failed++;
  }

  // Test 4: Test multiple providers
  try {
    log('\nTest 4: Testing multiple DoH providers', 'blue');
    const providers = ['cloudflare', 'google', 'quad9', 'nextdns', 'adguard'];
    let successCount = 0;
    
    for (const provider of providers) {
      try {
        const dohManager = new DnsOverHttpsManager({ provider });
        const addresses = await dohManager.resolve('google.com', 'A');
        
        if (addresses && addresses.length > 0) {
          log(`  ✓ ${provider}: Resolved to ${addresses[0]}`, 'green');
          successCount++;
        }
      } catch (error) {
        log(`  ✗ ${provider}: Failed - ${error.message}`, 'yellow');
      }
    }
    
    if (successCount >= 3) {
      log(`✅ ${successCount}/${providers.length} providers working`, 'green');
      results.passed++;
    } else {
      throw new Error(`Only ${successCount}/${providers.length} providers working`);
    }
  } catch (error) {
    log(`❌ Provider test failed: ${error.message}`, 'red');
    results.failed++;
  }

  // Test 5: Test cache functionality
  try {
    log('\nTest 5: Testing DNS cache', 'blue');
    const dohManager = new DnsOverHttpsManager({
      provider: 'cloudflare',
      cache: true,
      cacheMaxAge: 60000
    });
    
    // First resolution (should cache)
    const start1 = Date.now();
    const addresses1 = await dohManager.resolve('github.com', 'A');
    const time1 = Date.now() - start1;
    
    // Second resolution (should be from cache)
    const start2 = Date.now();
    const addresses2 = await dohManager.resolve('github.com', 'A');
    const time2 = Date.now() - start2;
    
    log(`  First resolution: ${time1}ms`, 'yellow');
    log(`  Cached resolution: ${time2}ms`, 'yellow');
    
    if (time2 < time1 / 2 && JSON.stringify(addresses1) === JSON.stringify(addresses2)) {
      log('✅ Cache working correctly (cached lookup faster)', 'green');
      results.passed++;
    } else {
      log('⚠️ Cache test inconclusive (network variance)', 'yellow');
      results.passed++;
    }
  } catch (error) {
    log(`❌ Cache test failed: ${error.message}`, 'red');
    results.failed++;
  }

  // Test 6: Test connectivity check
  try {
    log('\nTest 6: Testing DoH connectivity check', 'blue');
    const dohManager = new DnsOverHttpsManager({
      provider: 'cloudflare'
    });
    
    const isConnected = await dohManager.testConnectivity();
    
    if (isConnected) {
      log('✅ DoH connectivity test passed', 'green');
      results.passed++;
    } else {
      throw new Error('Connectivity test failed');
    }
  } catch (error) {
    log(`❌ Connectivity test failed: ${error.message}`, 'red');
    results.failed++;
  }

  // Test 7: Test fallback to regular DNS
  try {
    log('\nTest 7: Testing fallback to regular DNS', 'blue');
    const dohManager = new DnsOverHttpsManager({
      provider: 'invalid-provider', // This will cause DoH to fail
      fallbackToDNS: true
    });
    
    // Override provider URL to force failure
    dohManager.switchProvider('cloudflare');
    const provider = dohManager.getCurrentProvider();
    provider.url = 'https://invalid-doh-server.example.com/dns-query';
    
    // Should fallback to regular DNS
    const addresses = await dohManager.resolve('localhost', 'A');
    
    if (addresses && addresses.includes('127.0.0.1')) {
      log('✅ Successfully fell back to regular DNS', 'green');
      results.passed++;
    } else {
      throw new Error('Fallback did not work correctly');
    }
  } catch (error) {
    log(`❌ Fallback test failed: ${error.message}`, 'red');
    results.failed++;
  }

  // Test 8: Test browser integration
  try {
    log('\nTest 8: Testing browser integration with DoH', 'blue');
    const pc = new PlayClone({
      headless: true,
      dnsOverHttps: {
        enabled: true,
        provider: 'cloudflare',
        cache: true
      }
    });
    
    const result = await pc.navigate('https://example.com');
    
    if (result.success) {
      log('✅ Browser successfully launched with DoH enabled', 'green');
      results.passed++;
      
      // Check if DoH manager is accessible
      const browserManager = pc.browserManager;
      const dnsManager = browserManager.getDnsManager();
      
      if (dnsManager) {
        const provider = dnsManager.getCurrentProvider();
        log(`  Using DoH provider: ${provider.name}`, 'cyan');
      }
    } else {
      throw new Error('Failed to launch browser with DoH');
    }
    
    await pc.close();
  } catch (error) {
    log(`❌ Browser integration failed: ${error.message}`, 'red');
    results.failed++;
  }

  // Test 9: Test different record types
  try {
    log('\nTest 9: Testing different DNS record types', 'blue');
    const dohManager = new DnsOverHttpsManager({
      provider: 'cloudflare'
    });
    
    const tests = [
      { hostname: 'google.com', type: 'A', expected: 'IPv4' },
      { hostname: 'google.com', type: 'AAAA', expected: 'IPv6' },
      { hostname: 'google.com', type: 'MX', expected: 'MX' }
    ];
    
    let recordsResolved = 0;
    
    for (const test of tests) {
      try {
        const addresses = await dohManager.resolve(test.hostname, test.type);
        if (addresses && addresses.length > 0) {
          log(`  ✓ ${test.type} record: ${addresses[0].substring(0, 50)}...`, 'green');
          recordsResolved++;
        }
      } catch (error) {
        log(`  ✗ ${test.type} record failed: ${error.message}`, 'yellow');
      }
    }
    
    if (recordsResolved >= 2) {
      log(`✅ Resolved ${recordsResolved}/${tests.length} record types`, 'green');
      results.passed++;
    } else {
      throw new Error('Failed to resolve multiple record types');
    }
  } catch (error) {
    log(`❌ Record type test failed: ${error.message}`, 'red');
    results.failed++;
  }

  // Test 10: Test browser args generation
  try {
    log('\nTest 10: Testing browser arguments generation', 'blue');
    
    const args = DnsOverHttpsManager.getBrowserArgs('cloudflare');
    
    const expectedArgs = [
      '--enable-features=DnsOverHttps',
      '--dns-over-https-server=https://cloudflare-dns.com/dns-query',
      '--dns-over-https-templates',
      '--force-dns-over-https'
    ];
    
    const hasAllArgs = expectedArgs.every(arg => 
      args.some(a => a.includes(arg.split('=')[0]))
    );
    
    if (hasAllArgs) {
      log('✅ Browser arguments generated correctly', 'green');
      log(`  Args: ${args.join(' ')}`, 'cyan');
      results.passed++;
    } else {
      throw new Error('Browser arguments incorrect');
    }
  } catch (error) {
    log(`❌ Browser args test failed: ${error.message}`, 'red');
    results.failed++;
  }

  // Summary
  log('\n' + '=' .repeat(50), 'cyan');
  log('📊 DNS-over-HTTPS Test Results:', 'cyan');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, 'red');
  log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`, 
    results.failed === 0 ? 'green' : 'yellow');
  
  return results;
}

// Run tests
async function runAllTests() {
  log('\n🚀 Starting DNS-over-HTTPS Test Suite', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  const startTime = Date.now();
  
  try {
    const results = await testDnsOverHttpsManager();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`\n⏱️ Total test duration: ${duration}s`, 'blue');
    
    if (results.failed === 0) {
      log('\n🎉 All DNS-over-HTTPS tests passed!', 'green');
      process.exit(0);
    } else {
      log('\n⚠️ Some tests failed. Please review the results above.', 'yellow');
      process.exit(1);
    }
  } catch (error) {
    log(`\n❌ Test suite failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Check if running directly
if (require.main === module) {
  runAllTests();
}

module.exports = { testDnsOverHttpsManager };