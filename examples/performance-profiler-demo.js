const { PerformanceProfiler, PerformanceMonitor } = require('../dist/devtools/PerformanceProfiler');
const { PlayClone } = require('../dist/index');

async function demonstratePerformanceProfiler() {
  console.log('🚀 PlayClone Performance Profiler Demo\n');
  
  // Create profiler with options
  const profiler = new PerformanceProfiler({
    captureMemory: true,
    captureCPU: true,
    captureNetwork: true,
    captureRendering: false,
    sampleInterval: 500,
    verbose: true,
    outputPath: './performance-report.json'
  });
  
  // Initialize PlayClone
  const pc = new PlayClone({ headless: true });
  
  console.log('📊 Starting Performance Profiling...\n');
  
  // Start profiling
  await profiler.startProfiling(pc);
  
  // Launch browser
  await profiler.measureAsync('browser_launch', async () => {
    await pc.launch();
    console.log('✓ Browser launched');
  });
  
  // Navigate to website
  await profiler.measureAsync('navigation_github', async () => {
    await pc.navigate('https://github.com');
    console.log('✓ Navigated to GitHub');
  });
  
  // Perform search
  await profiler.measureAsync('search_operation', async () => {
    await pc.fill('search input', 'playclone');
    await pc.press('Enter');
    await new Promise(r => setTimeout(r, 2000));
    console.log('✓ Search completed');
  });
  
  // Extract data
  await profiler.measureAsync('data_extraction', async () => {
    await pc.getText('search results');
    await pc.getLinks();
    console.log('✓ Data extracted');
  });
  
  // Simulate complex operation
  console.log('\n🔧 Running Complex Operations...\n');
  
  // Memory intensive operation
  await profiler.measureAsync('memory_intensive_operation', async () => {
    const data = [];
    for (let i = 0; i < 100000; i++) {
      data.push({ id: i, value: Math.random() });
    }
    console.log('✓ Memory intensive operation completed');
  });
  
  // CPU intensive operation
  await profiler.measureAsync('cpu_intensive_operation', async () => {
    let result = 0;
    for (let i = 0; i < 10000000; i++) {
      result += Math.sqrt(i);
    }
    console.log('✓ CPU intensive operation completed');
  });
  
  // Multiple parallel operations
  await profiler.measureAsync('parallel_operations', async () => {
    await Promise.all([
      pc.navigate('https://example.com'),
      new Promise(r => setTimeout(r, 100)),
      new Promise(r => setTimeout(r, 200)),
      new Promise(r => setTimeout(r, 300))
    ]);
    console.log('✓ Parallel operations completed');
  });
  
  // Clean up
  await profiler.measureAsync('browser_close', async () => {
    await pc.close();
    console.log('✓ Browser closed');
  });
  
  // Stop profiling and generate report
  console.log('\n📈 Generating Performance Report...\n');
  const report = await profiler.stopProfiling();
  
  // Display summary
  console.log('📊 Performance Summary:');
  console.log('━'.repeat(50));
  console.log(`  Total Duration: ${(report.summary.totalDuration / 1000).toFixed(2)}s`);
  console.log(`  Operations: ${report.summary.operationCount}`);
  console.log(`  Average Duration: ${report.summary.averageDuration.toFixed(2)}ms`);
  console.log(`  Peak Memory: ${(report.summary.peakMemory / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  Network Requests: ${report.summary.totalNetworkRequests}`);
  console.log(`  Errors: ${report.summary.errorCount}`);
  console.log();
  
  // Display bottlenecks
  if (report.bottlenecks.length > 0) {
    console.log('⚠️  Bottlenecks Detected:');
    console.log('━'.repeat(50));
    report.bottlenecks.forEach(b => {
      const icon = b.severity === 'critical' ? '🔴' :
                   b.severity === 'high' ? '🟠' :
                   b.severity === 'medium' ? '🟡' : '🟢';
      console.log(`  ${icon} [${b.severity.toUpperCase()}] ${b.description}`);
      console.log(`     Impact: ${b.impact}`);
      console.log(`     Solution: ${b.solution}`);
    });
    console.log();
  }
  
  // Display recommendations
  if (report.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    console.log('━'.repeat(50));
    report.recommendations.forEach(r => {
      console.log(`  • ${r}`);
    });
    console.log();
  }
  
  // Display operation details
  console.log('🔍 Operation Details:');
  console.log('━'.repeat(50));
  report.metrics.forEach(m => {
    const status = m.custom?.success === false ? '❌' : '✅';
    console.log(`  ${status} ${m.operation.padEnd(30)} ${m.duration.toFixed(2).padStart(8)}ms  ${(m.memory.heapUsed / 1024 / 1024).toFixed(2).padStart(8)}MB`);
  });
  console.log();
  
  // Demonstrate Performance Monitor
  console.log('🎯 Performance Monitor Demo:\n');
  
  const monitor = new PerformanceMonitor({
    captureMemory: true,
    verbose: false
  });
  
  // Set thresholds
  monitor.setThreshold('fast_operation', 100);
  monitor.setThreshold('slow_operation', 500);
  
  // Monitor operations
  await monitor.monitor('fast_operation', async () => {
    await new Promise(r => setTimeout(r, 50));
    console.log('✓ Fast operation completed');
  });
  
  await monitor.monitor('slow_operation', async () => {
    await new Promise(r => setTimeout(r, 600));
    console.log('✓ Slow operation completed (exceeded threshold!)');
  });
  
  // Check alerts
  const alerts = monitor.getAlerts();
  if (alerts.length > 0) {
    console.log('\n⚠️  Performance Alerts:');
    console.log('━'.repeat(50));
    alerts.forEach(a => {
      console.log(`  Operation '${a.operation}' exceeded threshold:`);
      console.log(`    Duration: ${a.duration.toFixed(2)}ms > ${a.threshold}ms`);
    });
  }
  
  console.log('\n✅ Performance Profiler Demo Complete!');
  console.log('\n📚 Features Demonstrated:');
  console.log('  • Real-time performance profiling');
  console.log('  • Memory and CPU tracking');
  console.log('  • Network request monitoring');
  console.log('  • Bottleneck detection');
  console.log('  • Performance recommendations');
  console.log('  • HTML report generation');
  console.log('  • Threshold monitoring');
  console.log('  • Performance alerts');
  
  console.log('\n📁 Reports saved to:');
  console.log('  • performance-report.json');
  console.log('  • performance-report.html');
  
  // Cleanup
  const fs = require('fs');
  if (fs.existsSync('./performance-report.json')) {
    fs.unlinkSync('./performance-report.json');
  }
  if (fs.existsSync('./performance-report.html')) {
    fs.unlinkSync('./performance-report.html');
  }
}

// Run the demo
demonstratePerformanceProfiler().catch(console.error);