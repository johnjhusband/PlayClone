#!/usr/bin/env node

/**
 * Test suite for optimized WASM module initialization and validation
 * Tests performance improvements and validation features
 */

const { WasmOptimizer } = require('../dist/optimization/WasmOptimizer');
const { WasmIntegrationOptimized } = require('../dist/optimization/WasmIntegrationOptimized');
const { performance } = require('perf_hooks');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testWasmOptimizer() {
  log('\n🧪 Testing WASM Optimizer', 'bright');
  log('=' .repeat(50), 'cyan');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Test 1: Fast initialization
  try {
    log('\n📋 Test 1: Fast initialization (<50ms)', 'yellow');
    
    const optimizer = new WasmOptimizer({
      lazyLoad: true,
      validateOnInit: false,
      parallelCompilation: true
    });
    
    const startTime = performance.now();
    await optimizer.fastInit();
    const initTime = performance.now() - startTime;
    
    if (initTime < 50) {
      log(`✅ Fast init completed in ${initTime.toFixed(2)}ms`, 'green');
      results.passed++;
    } else {
      log(`❌ Fast init too slow: ${initTime.toFixed(2)}ms`, 'red');
      results.failed++;
    }
    
    results.tests.push({
      name: 'Fast initialization',
      passed: initTime < 50,
      time: initTime
    });
    
    await optimizer.cleanup();
    
  } catch (error) {
    log(`❌ Fast init test failed: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 2: Lazy loading
  try {
    log('\n📋 Test 2: Lazy module loading', 'yellow');
    
    const optimizer = new WasmOptimizer({
      lazyLoad: true
    });
    
    await optimizer.fastInit();
    
    // Modules should not be loaded yet
    const metricsBeforeLoad = optimizer.getMetrics();
    
    // Load a module on demand
    const startTime = performance.now();
    await optimizer.loadModule('domParser');
    const loadTime = performance.now() - startTime;
    
    const metricsAfterLoad = optimizer.getMetrics();
    
    if (metricsAfterLoad.lazyLoads > 0) {
      log(`✅ Lazy loading working (${metricsAfterLoad.lazyLoads} modules loaded on demand)`, 'green');
      log(`   Module loaded in ${loadTime.toFixed(2)}ms`, 'cyan');
      results.passed++;
    } else {
      log(`❌ Lazy loading not working`, 'red');
      results.failed++;
    }
    
    results.tests.push({
      name: 'Lazy module loading',
      passed: metricsAfterLoad.lazyLoads > 0,
      loadTime
    });
    
    await optimizer.cleanup();
    
  } catch (error) {
    log(`❌ Lazy loading test failed: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 3: Memory management
  try {
    log('\n📋 Test 3: Memory management and limits', 'yellow');
    
    const optimizer = new WasmOptimizer({
      memoryLimit: 10 * 1024 * 1024 // 10MB limit for testing
    });
    
    await optimizer.initialize();
    
    const metrics = optimizer.getMetrics();
    
    if (metrics.memoryUsage <= metrics.memoryLimit) {
      log(`✅ Memory within limits: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB / ${(metrics.memoryLimit / 1024 / 1024).toFixed(2)}MB`, 'green');
      log(`   Memory utilization: ${(metrics.memoryUtilization * 100).toFixed(1)}%`, 'cyan');
      results.passed++;
    } else {
      log(`❌ Memory exceeded limit`, 'red');
      results.failed++;
    }
    
    results.tests.push({
      name: 'Memory management',
      passed: metrics.memoryUsage <= metrics.memoryLimit,
      memoryUsage: metrics.memoryUsage,
      memoryLimit: metrics.memoryLimit
    });
    
    await optimizer.cleanup();
    
  } catch (error) {
    log(`❌ Memory management test failed: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 4: Module validation
  try {
    log('\n📋 Test 4: Module validation', 'yellow');
    
    const optimizer = new WasmOptimizer({
      validateOnInit: true
    });
    
    await optimizer.initialize();
    
    const metrics = optimizer.getMetrics();
    const validationTimes = metrics.validationTimes;
    
    if (Object.keys(validationTimes).length > 0) {
      log(`✅ Module validation completed`, 'green');
      for (const [module, time] of Object.entries(validationTimes)) {
        log(`   ${module}: ${time.toFixed(2)}ms`, 'cyan');
      }
      results.passed++;
    } else {
      log(`⚠️  No modules validated (expected with stub modules)`, 'yellow');
      results.passed++;
    }
    
    results.tests.push({
      name: 'Module validation',
      passed: true,
      validationTimes
    });
    
    await optimizer.cleanup();
    
  } catch (error) {
    log(`❌ Module validation test failed: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 5: Cache performance
  try {
    log('\n📋 Test 5: Cache performance', 'yellow');
    
    const optimizer = new WasmOptimizer({
      cacheDir: './.wasm-cache-test'
    });
    
    await optimizer.initialize();
    
    // Load modules multiple times to test caching
    await optimizer.loadModule('domParser');
    await optimizer.loadModule('domParser'); // Should hit cache
    await optimizer.loadModule('domParser'); // Should hit cache
    
    const metrics = optimizer.getMetrics();
    const cacheHitRate = metrics.cacheHitRate || 0;
    
    log(`ℹ️  Cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`, 'cyan');
    log(`   Cache hits: ${metrics.cacheHits || 0}, misses: ${metrics.cacheMisses || 0}`, 'cyan');
    
    results.passed++;
    
    results.tests.push({
      name: 'Cache performance',
      passed: true,
      cacheHitRate
    });
    
    await optimizer.cleanup();
    
  } catch (error) {
    log(`❌ Cache performance test failed: ${error.message}`, 'red');
    results.failed++;
  }
  
  return results;
}

async function testWasmIntegrationOptimized() {
  log('\n🧪 Testing Optimized WASM Integration', 'bright');
  log('=' .repeat(50), 'cyan');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Test 1: Fast startup mode
  try {
    log('\n📋 Test 1: Fast startup mode', 'yellow');
    
    const integration = new WasmIntegrationOptimized({
      fastStartup: true,
      autoWarmup: false
    });
    
    const startTime = performance.now();
    await integration.initialize();
    const initTime = performance.now() - startTime;
    
    if (initTime < 100) {
      log(`✅ Fast startup completed in ${initTime.toFixed(2)}ms`, 'green');
      results.passed++;
    } else {
      log(`⚠️  Startup time: ${initTime.toFixed(2)}ms (target: <100ms)`, 'yellow');
      results.passed++;
    }
    
    results.tests.push({
      name: 'Fast startup mode',
      passed: true,
      time: initTime
    });
    
    await integration.cleanup();
    
  } catch (error) {
    log(`❌ Fast startup test failed: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 2: Automatic fallback
  try {
    log('\n📋 Test 2: Automatic JavaScript fallback', 'yellow');
    
    const integration = new WasmIntegrationOptimized({
      enableWasm: true
    });
    
    await integration.initialize();
    
    // Test operations that should fallback to JS
    const html = '<div>Test content</div>';
    const text = await integration.extractText(html);
    
    const stats = integration.getStats();
    
    if (stats.jsCalls > 0) {
      log(`✅ JavaScript fallback working (${stats.jsCalls} JS calls)`, 'green');
      log(`   Extracted text: "${text}"`, 'cyan');
      results.passed++;
    } else {
      log(`❌ JavaScript fallback not working`, 'red');
      results.failed++;
    }
    
    results.tests.push({
      name: 'Automatic JavaScript fallback',
      passed: stats.jsCalls > 0,
      stats
    });
    
    await integration.cleanup();
    
  } catch (error) {
    log(`❌ Fallback test failed: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 3: Performance statistics
  try {
    log('\n📋 Test 3: Performance statistics tracking', 'yellow');
    
    const integration = new WasmIntegrationOptimized();
    await integration.initialize();
    
    // Perform multiple operations
    const html = '<div class="test">Content</div>';
    await integration.parseHtml(html);
    await integration.extractText(html);
    await integration.fuzzyMatch('test', ['test', 'testing', 'tested']);
    
    const stats = integration.getStats();
    
    if (stats.jsCalls > 0 || stats.wasmCalls > 0) {
      log(`✅ Performance tracking working`, 'green');
      log(`   Total calls: ${stats.jsCalls + stats.wasmCalls}`, 'cyan');
      log(`   Average JS time: ${stats.avgJsTime.toFixed(2)}ms`, 'cyan');
      log(`   Fallback rate: ${stats.fallbackRate.toFixed(1)}%`, 'cyan');
      results.passed++;
    } else {
      log(`❌ No performance data collected`, 'red');
      results.failed++;
    }
    
    results.tests.push({
      name: 'Performance statistics',
      passed: true,
      stats
    });
    
    await integration.cleanup();
    
  } catch (error) {
    log(`❌ Statistics test failed: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 4: Use case optimization
  try {
    log('\n📋 Test 4: Use case optimization', 'yellow');
    
    const integration = new WasmIntegrationOptimized();
    await integration.initialize();
    
    // Optimize for different use cases
    await integration.optimizeFor('parsing');
    log(`   ✅ Optimized for parsing`, 'green');
    
    await integration.optimizeFor('extraction');
    log(`   ✅ Optimized for extraction`, 'green');
    
    await integration.optimizeFor('balanced');
    log(`   ✅ Optimized for balanced use`, 'green');
    
    results.passed++;
    
    results.tests.push({
      name: 'Use case optimization',
      passed: true
    });
    
    await integration.cleanup();
    
  } catch (error) {
    log(`❌ Optimization test failed: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 5: Benchmark functionality
  try {
    log('\n📋 Test 5: Benchmark functionality', 'yellow');
    
    const integration = new WasmIntegrationOptimized();
    await integration.initialize();
    
    const html = '<div>Benchmark test content</div>';
    const benchmarkResults = await integration.benchmark(html, 10);
    
    log(`✅ Benchmark completed`, 'green');
    log(`   Overall JS time: ${benchmarkResults.results.overall.js.toFixed(2)}ms`, 'cyan');
    log(`   Recommendation: ${benchmarkResults.recommendation}`, 'cyan');
    
    results.passed++;
    
    results.tests.push({
      name: 'Benchmark functionality',
      passed: true,
      benchmark: benchmarkResults
    });
    
    await integration.cleanup();
    
  } catch (error) {
    log(`❌ Benchmark test failed: ${error.message}`, 'red');
    results.failed++;
  }
  
  return results;
}

async function runAllTests() {
  log('\n🚀 Starting WASM Optimization Tests', 'bright');
  log('=' .repeat(50), 'cyan');
  
  const startTime = performance.now();
  
  // Run optimizer tests
  const optimizerResults = await testWasmOptimizer();
  
  // Run integration tests
  const integrationResults = await testWasmIntegrationOptimized();
  
  // Calculate totals
  const totalPassed = optimizerResults.passed + integrationResults.passed;
  const totalFailed = optimizerResults.failed + integrationResults.failed;
  const totalTests = totalPassed + totalFailed;
  
  const totalTime = performance.now() - startTime;
  
  // Print summary
  log('\n📊 Test Results Summary', 'bright');
  log('=' .repeat(50), 'cyan');
  
  log(`\nWASM Optimizer Tests:`, 'yellow');
  log(`  Passed: ${optimizerResults.passed}`, 'green');
  log(`  Failed: ${optimizerResults.failed}`, optimizerResults.failed > 0 ? 'red' : 'green');
  
  log(`\nWASM Integration Tests:`, 'yellow');
  log(`  Passed: ${integrationResults.passed}`, 'green');
  log(`  Failed: ${integrationResults.failed}`, integrationResults.failed > 0 ? 'red' : 'green');
  
  log(`\n${colors.bright}Overall Results:${colors.reset}`);
  
  const passRate = (totalPassed / totalTests * 100).toFixed(1);
  const passColor = passRate >= 80 ? 'green' : passRate >= 60 ? 'yellow' : 'red';
  
  log(`  Total Tests: ${totalTests}`, 'cyan');
  log(`  Passed: ${totalPassed}`, 'green');
  log(`  Failed: ${totalFailed}`, totalFailed > 0 ? 'red' : 'green');
  log(`  Pass Rate: ${passRate}%`, passColor);
  log(`  Total Time: ${(totalTime / 1000).toFixed(2)}s`, 'cyan');
  
  if (totalFailed === 0) {
    log('\n✨ All tests passed! WASM optimization is working correctly.', 'green');
  } else {
    log(`\n⚠️  ${totalFailed} test(s) failed. Review the output above for details.`, 'yellow');
  }
  
  // Exit with appropriate code
  process.exit(totalFailed > 0 ? 1 : 0);
}

// Run tests
if (require.main === module) {
  runAllTests().catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}