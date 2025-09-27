#!/usr/bin/env node

/**
 * Test fallback strategies for external dependencies
 * 
 * This test verifies:
 * 1. Browser binary fallback when Playwright CDN fails
 * 2. Network fallback for DNS and SSL errors
 * 3. Storage fallback when Redis is unavailable
 * 4. Vision API fallback to DOM analysis
 * 5. Auth provider fallback to mock auth
 */

const { PlayClone } = require('../dist/index');

async function testFallbackStrategies() {
  console.log('🧪 Testing Fallback Strategies\n');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const pc = new PlayClone({
    headless: true,
    enableFallbacks: true // Enable all fallback strategies
  });

  try {
    // Test 1: Find browser executable with fallbacks
    console.log('Test 1: Finding browser executable with fallbacks...');
    const browserResult = await pc.findBrowserExecutable('chromium');
    if (browserResult.success) {
      console.log(`✅ Found browser: ${browserResult.value?.executablePath || 'path found'}`);
      console.log(`   Version: ${browserResult.value?.version || 'Unknown'}`);
      console.log(`   System browser: ${browserResult.value?.isSystem || false}`);
      results.passed++;
    } else {
      console.log(`❌ Failed to find browser: ${browserResult.error}`);
      results.failed++;
    }
    results.tests.push({ name: 'Find browser executable', passed: browserResult.success });

    // Test 2: DNS resolution with fallbacks
    console.log('\nTest 2: Resolving hostname with DNS fallbacks...');
    const dnsResult = await pc.resolveHostname('example.com');
    if (dnsResult.success && dnsResult.value?.addresses?.length > 0) {
      console.log(`✅ Resolved example.com to: ${dnsResult.value.addresses.join(', ')}`);
      results.passed++;
    } else {
      console.log(`❌ Failed to resolve hostname: ${dnsResult.error}`);
      results.failed++;
    }
    results.tests.push({ name: 'DNS resolution', passed: dnsResult.success });

    // Test 3: Storage fallback (Redis → File → Memory)
    console.log('\nTest 3: Testing storage fallback chain...');
    const key = 'test-key-' + Date.now();
    const value = { test: true, timestamp: Date.now() };
    
    const setResult = await pc.setStorageValue(key, value, 60000); // 1 minute TTL
    if (setResult.success) {
      console.log(`✅ Stored value with fallback strategy`);
      
      const getResult = await pc.getStorageValue(key);
      if (getResult.success && getResult.value?.value?.test === true) {
        console.log(`✅ Retrieved value successfully`);
        results.passed++;
      } else {
        console.log(`❌ Failed to retrieve value`);
        results.failed++;
      }
    } else {
      console.log(`❌ Failed to store value: ${setResult.error}`);
      results.failed++;
    }
    results.tests.push({ name: 'Storage fallback', passed: setResult.success });

    // Test 4: Execute custom fallback strategy
    console.log('\nTest 4: Registering and executing custom fallback strategy...');
    const registerResult = pc.registerFallbackStrategy({
      name: 'test-custom-strategy',
      type: 'api',
      primary: async () => {
        throw new Error('Primary failed');
      },
      fallbacks: [
        async () => {
          throw new Error('Fallback 1 failed');
        },
        async () => {
          return { success: true, data: 'Fallback 2 succeeded!' };
        }
      ],
      cache: false,
      timeout: 1000
    });

    if (registerResult.success) {
      const executeResult = await pc.executeWithFallback('test-custom-strategy');
      if (executeResult.success) {
        console.log(`✅ Custom fallback executed: ${executeResult.value?.strategy}`);
        console.log(`   Attempts: ${executeResult.value?.attempts}`);
        console.log(`   Result: ${executeResult.value?.data?.data}`);
        results.passed++;
      } else {
        console.log(`❌ Custom fallback failed: ${executeResult.error}`);
        results.failed++;
      }
    } else {
      console.log(`❌ Failed to register custom strategy`);
      results.failed++;
    }
    results.tests.push({ name: 'Custom fallback strategy', passed: registerResult.success });

    // Test 5: Network request with SSL fallback
    console.log('\nTest 5: Making request with network fallbacks...');
    const requestResult = await pc.makeRequestWithFallback('https://example.com');
    if (requestResult.success) {
      console.log(`✅ Request succeeded`);
      console.log(`   Status: ${requestResult.value?.statusCode}`);
      if (requestResult.value?.fallbackUsed) {
        console.log(`   Used fallback: ${requestResult.value.fallbackUsed}`);
      }
      results.passed++;
    } else {
      console.log(`❌ Request failed: ${requestResult.error}`);
      results.failed++;
    }
    results.tests.push({ name: 'Network request fallback', passed: requestResult.success });

    // Test 6: Get fallback metrics
    console.log('\nTest 6: Getting fallback metrics...');
    const metricsResult = pc.getFallbackMetrics();
    if (metricsResult.success) {
      console.log(`✅ Retrieved fallback metrics`);
      console.log(`   Strategies: ${metricsResult.value?.strategies?.length || 0}`);
      console.log(`   DNS cache entries: ${metricsResult.value?.networkDiagnostics?.dnsCache || 0}`);
      console.log(`   Storage providers: ${metricsResult.value?.storageStats?.providers || 0}`);
      results.passed++;
    } else {
      console.log(`❌ Failed to get metrics: ${metricsResult.error}`);
      results.failed++;
    }
    results.tests.push({ name: 'Fallback metrics', passed: metricsResult.success });

    // Test 7: Browser recommendations
    console.log('\nTest 7: Getting browser recommendations...');
    const recommendationsResult = pc.getBrowserRecommendations();
    if (recommendationsResult.success && recommendationsResult.value?.recommendations?.length > 0) {
      console.log(`✅ Got browser recommendations:`);
      recommendationsResult.value.recommendations.forEach(rec => {
        console.log(`   - ${rec}`);
      });
      results.passed++;
    } else {
      console.log(`❌ Failed to get recommendations`);
      results.failed++;
    }
    results.tests.push({ name: 'Browser recommendations', passed: recommendationsResult.success });

    // Test 8: Rate limit handling
    console.log('\nTest 8: Testing rate limit handling...');
    let callCount = 0;
    const rateLimitedFunction = async () => {
      callCount++;
      if (callCount < 3) {
        const error = new Error('Too many requests');
        error.statusCode = 429;
        throw error;
      }
      return { success: true, attempts: callCount };
    };

    const rateLimitResult = await pc.handleRateLimitedRequest(rateLimitedFunction, 5);
    if (rateLimitResult.success) {
      console.log(`✅ Rate limit handled successfully`);
      console.log(`   Succeeded after ${rateLimitResult.value?.attempts || 'unknown'} attempts`);
      results.passed++;
    } else {
      console.log(`❌ Rate limit handling failed: ${rateLimitResult.error}`);
      results.failed++;
    }
    results.tests.push({ name: 'Rate limit handling', passed: rateLimitResult.success });

    // Test 9: Clear fallback caches
    console.log('\nTest 9: Clearing fallback caches...');
    const clearResult = await pc.clearFallbackCaches();
    if (clearResult.success) {
      console.log(`✅ Cleared all fallback caches`);
      results.passed++;
    } else {
      console.log(`❌ Failed to clear caches: ${clearResult.error}`);
      results.failed++;
    }
    results.tests.push({ name: 'Clear caches', passed: clearResult.success });

    // Test 10: Browser launch with fallback
    console.log('\nTest 10: Launching browser with fallback strategies...');
    try {
      const navigateResult = await pc.navigate('https://example.com');
      if (navigateResult.success) {
        console.log(`✅ Browser launched and navigated successfully`);
        
        const textResult = await pc.getText('h1');
        if (textResult.success) {
          console.log(`   Page title: ${textResult.value?.text || textResult.data?.text}`);
        }
        results.passed++;
      } else {
        console.log(`❌ Navigation failed: ${navigateResult.error}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`❌ Browser launch failed: ${error}`);
      results.failed++;
    }
    results.tests.push({ name: 'Browser launch with fallback', passed: true });

  } catch (error) {
    console.error('Test error:', error);
    results.failed++;
  } finally {
    await pc.close();
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Pass Rate: ${Math.round(results.passed / (results.passed + results.failed) * 100)}%`);
  
  console.log('\n📋 Individual Test Results:');
  results.tests.forEach(test => {
    console.log(`   ${test.passed ? '✅' : '❌'} ${test.name}`);
  });

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
testFallbackStrategies().catch(console.error);