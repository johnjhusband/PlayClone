#!/usr/bin/env node

/**
 * WASM Performance Comparison Example
 * Demonstrates the performance improvements from optimized WASM initialization
 * Compares original vs optimized WASM integration
 */

const { WasmIntegration } = require('../dist/optimization/WasmIntegration');
const { WasmIntegrationOptimized } = require('../dist/optimization/WasmIntegrationOptimized');
const { performance } = require('perf_hooks');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatTime(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatPercentage(value, baseline) {
  const improvement = ((baseline - value) / baseline) * 100;
  const sign = improvement >= 0 ? '+' : '';
  const color = improvement >= 0 ? 'green' : 'red';
  return { improvement, text: `${sign}${improvement.toFixed(1)}%`, color };
}

async function compareInitialization() {
  log('\n📊 Initialization Performance Comparison', 'bright');
  log('=' .repeat(60), 'cyan');
  
  const results = {
    original: {},
    optimized: {},
    fastStartup: {}
  };
  
  // Test original implementation
  log('\n1️⃣  Testing Original WASM Integration...', 'yellow');
  
  const original = new WasmIntegration({ enableWasm: true });
  const originalStart = performance.now();
  await original.initialize();
  results.original.initTime = performance.now() - originalStart;
  
  log(`   Initialization time: ${formatTime(results.original.initTime)}`, 'cyan');
  
  // Clean up
  await original.cleanup();
  
  // Test optimized implementation (standard mode)
  log('\n2️⃣  Testing Optimized WASM Integration (Standard)...', 'yellow');
  
  const optimized = new WasmIntegrationOptimized({ 
    enableWasm: true,
    fastStartup: false,
    lazyLoad: false
  });
  const optimizedStart = performance.now();
  await optimized.initialize();
  results.optimized.initTime = performance.now() - optimizedStart;
  
  log(`   Initialization time: ${formatTime(results.optimized.initTime)}`, 'cyan');
  
  const optimizedImprovement = formatPercentage(results.optimized.initTime, results.original.initTime);
  log(`   Improvement: ${optimizedImprovement.text}`, optimizedImprovement.color);
  
  // Clean up
  await optimized.cleanup();
  
  // Test optimized implementation (fast startup mode)
  log('\n3️⃣  Testing Optimized WASM Integration (Fast Startup)...', 'yellow');
  
  const fastStartup = new WasmIntegrationOptimized({ 
    enableWasm: true,
    fastStartup: true,
    lazyLoad: true,
    autoWarmup: false
  });
  const fastStart = performance.now();
  await fastStartup.initialize();
  results.fastStartup.initTime = performance.now() - fastStart;
  
  log(`   Initialization time: ${formatTime(results.fastStartup.initTime)}`, 'cyan');
  
  const fastImprovement = formatPercentage(results.fastStartup.initTime, results.original.initTime);
  log(`   Improvement: ${fastImprovement.text}`, fastImprovement.color);
  
  // Clean up
  await fastStartup.cleanup();
  
  return results;
}

async function compareOperationPerformance() {
  log('\n📊 Operation Performance Comparison', 'bright');
  log('=' .repeat(60), 'cyan');
  
  // Test data
  const html = `
    <html>
      <head><title>Test Page</title></head>
      <body>
        <div class="container">
          <h1 id="title">Welcome to PlayClone</h1>
          <p class="description">High-performance browser automation</p>
          <button class="btn primary">Click Me</button>
          <ul>
            <li>Feature 1</li>
            <li>Feature 2</li>
            <li>Feature 3</li>
          </ul>
        </div>
      </body>
    </html>
  `;
  
  const candidates = [
    'submit button',
    'cancel button',
    'login button',
    'signup button',
    'continue button',
    'next button',
    'previous button',
    'close button'
  ];
  
  // Initialize both implementations
  const original = new WasmIntegration({ enableWasm: true });
  const optimized = new WasmIntegrationOptimized({ 
    enableWasm: true,
    fastStartup: true,
    autoWarmup: true
  });
  
  await original.initialize();
  await optimized.initialize();
  
  const operations = [
    {
      name: 'Parse HTML',
      fn: async (impl) => await impl.parseHtml(html)
    },
    {
      name: 'Extract Text',
      fn: async (impl) => await impl.extractText(html)
    },
    {
      name: 'Fuzzy Match',
      fn: async (impl) => await impl.fuzzyMatch('button', candidates)
    }
  ];
  
  log('\nRunning performance tests (100 iterations each)...', 'yellow');
  
  const results = [];
  
  for (const op of operations) {
    log(`\n📋 ${op.name}:`, 'cyan');
    
    // Test original
    const originalTimes = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await op.fn(original);
      originalTimes.push(performance.now() - start);
    }
    const originalAvg = originalTimes.reduce((a, b) => a + b, 0) / originalTimes.length;
    
    // Test optimized
    const optimizedTimes = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await op.fn(optimized);
      optimizedTimes.push(performance.now() - start);
    }
    const optimizedAvg = optimizedTimes.reduce((a, b) => a + b, 0) / optimizedTimes.length;
    
    // Calculate statistics
    const improvement = formatPercentage(optimizedAvg, originalAvg);
    
    log(`   Original:  ${formatTime(originalAvg)} (avg)`, 'yellow');
    log(`   Optimized: ${formatTime(optimizedAvg)} (avg)`, 'green');
    log(`   Speed-up:  ${improvement.text}`, improvement.color);
    
    results.push({
      operation: op.name,
      original: originalAvg,
      optimized: optimizedAvg,
      improvement: improvement.improvement
    });
  }
  
  // Get statistics
  const originalStats = original.getStats();
  const optimizedStats = optimized.getStats();
  
  log('\n📈 Execution Statistics:', 'bright');
  log(`\nOriginal Implementation:`, 'yellow');
  log(`   WASM calls: ${originalStats.wasmCalls}`, 'cyan');
  log(`   JS calls:   ${originalStats.jsCalls}`, 'cyan');
  log(`   WASM %:     ${originalStats.wasmPercentage.toFixed(1)}%`, 'cyan');
  
  log(`\nOptimized Implementation:`, 'green');
  log(`   WASM calls:     ${optimizedStats.wasmCalls}`, 'cyan');
  log(`   JS calls:       ${optimizedStats.jsCalls}`, 'cyan');
  log(`   WASM %:         ${optimizedStats.wasmPercentage.toFixed(1)}%`, 'cyan');
  log(`   Fallback rate:  ${optimizedStats.fallbackRate.toFixed(1)}%`, 'cyan');
  log(`   Error rate:     ${optimizedStats.errorRate.toFixed(1)}%`, 'cyan');
  
  // Clean up
  await original.cleanup();
  await optimized.cleanup();
  
  return results;
}

async function compareMemoryUsage() {
  log('\n📊 Memory Usage Comparison', 'bright');
  log('=' .repeat(60), 'cyan');
  
  // Test with memory-limited optimizer
  const limitedOptimizer = new WasmIntegrationOptimized({
    enableWasm: true,
    memoryLimit: 50 * 1024 * 1024, // 50MB limit
    lazyLoad: false // Load all modules to test memory
  });
  
  await limitedOptimizer.initialize();
  
  // Get optimizer metrics
  const stats = limitedOptimizer.getStats();
  const metrics = stats.optimizerMetrics;
  
  if (metrics) {
    log('\n💾 Memory Usage:', 'yellow');
    log(`   Current:     ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`, 'cyan');
    log(`   Limit:       ${(metrics.memoryLimit / 1024 / 1024).toFixed(2)}MB`, 'cyan');
    log(`   Utilization: ${(metrics.memoryUtilization * 100).toFixed(1)}%`, 'cyan');
    
    // Show module load times
    log('\n⏱️  Module Load Times:', 'yellow');
    for (const [module, times] of Object.entries(metrics.moduleLoadTimes)) {
      if (times && times.avg) {
        log(`   ${module}: ${formatTime(times.avg)} (avg)`, 'cyan');
      }
    }
    
    // Show cache performance
    log('\n💾 Cache Performance:', 'yellow');
    log(`   Hit rate:    ${(metrics.cacheHitRate * 100).toFixed(1)}%`, 'cyan');
    log(`   Lazy loads:  ${metrics.lazyLoads}`, 'cyan');
  }
  
  await limitedOptimizer.cleanup();
}

async function demonstrateUseCaseOptimization() {
  log('\n📊 Use Case Optimization Demonstration', 'bright');
  log('=' .repeat(60), 'cyan');
  
  const integration = new WasmIntegrationOptimized({
    enableWasm: true,
    fastStartup: true
  });
  
  await integration.initialize();
  
  const html = '<div>Test content for optimization</div>';
  
  log('\nTesting different optimization modes...', 'yellow');
  
  // Test parsing optimization
  log('\n1️⃣  Optimizing for parsing...', 'cyan');
  await integration.optimizeFor('parsing');
  
  const parseStart = performance.now();
  for (let i = 0; i < 50; i++) {
    await integration.parseHtml(html);
  }
  const parseTime = performance.now() - parseStart;
  log(`   50 parse operations: ${formatTime(parseTime)}`, 'green');
  
  // Test extraction optimization
  log('\n2️⃣  Optimizing for extraction...', 'cyan');
  await integration.optimizeFor('extraction');
  
  const extractStart = performance.now();
  for (let i = 0; i < 50; i++) {
    await integration.extractText(html);
  }
  const extractTime = performance.now() - extractStart;
  log(`   50 extract operations: ${formatTime(extractTime)}`, 'green');
  
  // Test balanced optimization
  log('\n3️⃣  Optimizing for balanced use...', 'cyan');
  await integration.optimizeFor('balanced');
  
  const balancedStart = performance.now();
  for (let i = 0; i < 25; i++) {
    await integration.parseHtml(html);
    await integration.extractText(html);
  }
  const balancedTime = performance.now() - balancedStart;
  log(`   25 mixed operations: ${formatTime(balancedTime)}`, 'green');
  
  await integration.cleanup();
}

async function runComparison() {
  log('\n🚀 WASM Performance Optimization Comparison', 'bright');
  log('=' .repeat(60), 'magenta');
  log('Comparing original vs optimized WASM implementation', 'cyan');
  
  try {
    // Run comparisons
    const initResults = await compareInitialization();
    const opResults = await compareOperationPerformance();
    await compareMemoryUsage();
    await demonstrateUseCaseOptimization();
    
    // Summary
    log('\n📊 Performance Summary', 'bright');
    log('=' .repeat(60), 'cyan');
    
    log('\n🚀 Initialization Improvements:', 'yellow');
    
    const standardImprovement = ((initResults.original.initTime - initResults.optimized.initTime) / initResults.original.initTime) * 100;
    const fastImprovement = ((initResults.original.initTime - initResults.fastStartup.initTime) / initResults.original.initTime) * 100;
    
    log(`   Standard mode:    ${standardImprovement.toFixed(1)}% faster`, standardImprovement > 0 ? 'green' : 'red');
    log(`   Fast startup:     ${fastImprovement.toFixed(1)}% faster`, fastImprovement > 0 ? 'green' : 'red');
    
    log('\n⚡ Operation Speed-ups:', 'yellow');
    for (const result of opResults) {
      const color = result.improvement > 0 ? 'green' : result.improvement < 0 ? 'red' : 'yellow';
      log(`   ${result.operation}: ${result.improvement > 0 ? '+' : ''}${result.improvement.toFixed(1)}%`, color);
    }
    
    log('\n✨ Key Benefits of Optimized WASM:', 'bright');
    log('   ✅ Faster initialization (especially with fast startup mode)', 'green');
    log('   ✅ Lazy loading reduces initial memory footprint', 'green');
    log('   ✅ Parallel compilation for multi-core systems', 'green');
    log('   ✅ Module caching for improved performance', 'green');
    log('   ✅ Memory management with automatic eviction', 'green');
    log('   ✅ Use case optimization for specific workloads', 'green');
    log('   ✅ Comprehensive performance metrics', 'green');
    
    log('\n🎯 Recommendations:', 'bright');
    log('   • Use fast startup mode for CLI tools and scripts', 'cyan');
    log('   • Enable auto-warmup for long-running services', 'cyan');
    log('   • Configure memory limits based on available resources', 'cyan');
    log('   • Use optimizeFor() to tune for specific workloads', 'cyan');
    log('   • Monitor metrics to identify optimization opportunities', 'cyan');
    
  } catch (error) {
    log(`\n❌ Error during comparison: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the comparison
if (require.main === module) {
  runComparison().then(() => {
    log('\n✅ Performance comparison complete!', 'green');
    process.exit(0);
  }).catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}