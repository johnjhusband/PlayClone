/**
 * Ultra-Fast Startup Example
 * Demonstrates sub-500ms browser startup with pre-warming and optimization
 */

const { PlayClone } = require('../dist/index');
const { UltraFastStartup } = require('../dist/optimization/UltraFastStartup');

async function main() {
    console.log('🚀 Ultra-Fast Startup Demo\n');
    console.log('================================\n');

    // Initialize ultra-fast startup manager
    const startupManager = new UltraFastStartup({
        prewarmCount: 3,      // Pre-warm 3 browsers
        maxPoolSize: 10,      // Maximum 10 browsers in pool
        idleTimeout: 300000,  // 5 minutes idle timeout
        lazyLoad: true,       // Enable lazy loading
        useWorkerThreads: true,
        cacheConnections: true,
        headless: true,       // Use headless for speed
        reuseContexts: true,  // Reuse browser contexts
        persistentCache: true,
        compressionEnabled: true
    });

    console.log('⏳ Initializing ultra-fast startup system...');
    const initStart = Date.now();
    await startupManager.initialize();
    console.log(`✅ Initialization complete in ${Date.now() - initStart}ms\n`);

    // Benchmark different startup scenarios
    console.log('📊 Running Startup Benchmarks\n');
    console.log('--------------------------------');
    
    // Test 1: Cold start (no pre-warming)
    console.log('\n1️⃣ Cold Start Test:');
    const coldStart = Date.now();
    const coldPC = new PlayClone({ headless: true });
    await coldPC.navigate('https://example.com');
    const coldTime = Date.now() - coldStart;
    console.log(`   ⏱️ Cold start time: ${coldTime}ms`);
    await coldPC.close();

    // Test 2: Warm start (with pre-warmed browser)
    console.log('\n2️⃣ Warm Start Test (Pre-warmed):');
    const warmStart = Date.now();
    const { browser, context } = await startupManager.getFastBrowser();
    const warmTime = Date.now() - warmStart;
    console.log(`   ⏱️ Warm start time: ${warmTime}ms`);
    console.log(`   📈 Improvement: ${Math.round((1 - warmTime/coldTime) * 100)}%`);

    // Test 3: Multiple rapid starts
    console.log('\n3️⃣ Rapid Sequential Starts:');
    const rapidTimes = [];
    for (let i = 0; i < 5; i++) {
        const start = Date.now();
        const { browser: b, context: c } = await startupManager.getFastBrowser();
        const time = Date.now() - start;
        rapidTimes.push(time);
        console.log(`   Start ${i + 1}: ${time}ms`);
    }
    const avgRapid = rapidTimes.reduce((a, b) => a + b, 0) / rapidTimes.length;
    console.log(`   📊 Average: ${Math.round(avgRapid)}ms`);

    // Test 4: Parallel starts
    console.log('\n4️⃣ Parallel Start Test:');
    const parallelStart = Date.now();
    const parallelPromises = [];
    for (let i = 0; i < 3; i++) {
        parallelPromises.push(startupManager.getFastBrowser());
    }
    await Promise.all(parallelPromises);
    const parallelTime = Date.now() - parallelStart;
    console.log(`   ⏱️ 3 parallel starts: ${parallelTime}ms`);
    console.log(`   📊 Average per browser: ${Math.round(parallelTime / 3)}ms`);

    // Get detailed metrics
    console.log('\n📈 Performance Metrics:');
    console.log('------------------------');
    const metrics = startupManager.getMetrics();
    console.log(`   Cold start time: ${metrics.coldStartTime}ms`);
    console.log(`   Warm start time: ${metrics.warmStartTime}ms`);
    console.log(`   Average start time: ${metrics.averageStartTime}ms`);
    console.log(`   Pool hit rate: ${Math.round(metrics.poolHitRate * 100)}%`);
    console.log(`   Contexts reused: ${metrics.contextsReused}`);
    console.log(`   Total starts: ${metrics.totalStarts}`);

    // Run comprehensive benchmark
    console.log('\n🏁 Running Comprehensive Benchmark...');
    const benchmarkResults = await startupManager.benchmark();
    console.log('\n📊 Benchmark Results:');
    console.log('---------------------');
    console.log(`   Average cold start: ${benchmarkResults.averageColdStart}ms`);
    console.log(`   Average warm start: ${benchmarkResults.averageWarmStart}ms`);
    console.log(`   Performance improvement: ${benchmarkResults.improvement}`);
    console.log(`   ✅ Target (<500ms) met: ${benchmarkResults.targetMet ? 'YES' : 'NO'}`);

    // Get AI optimization recommendations
    const aiOptimizations = await startupManager.optimizeForAI();
    console.log('\n🤖 AI Optimization Recommendations:');
    console.log('------------------------------------');
    aiOptimizations.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
    });
    console.log(`\n   Current optimizations enabled: ${aiOptimizations.currentOptimizations.join(', ')}`);
    console.log(`   Estimated startup time: ${aiOptimizations.estimatedStartupTime}ms`);

    // Demonstrate lazy loading
    console.log('\n⚡ Lazy Loading Demo:');
    console.log('---------------------');
    const modules = ['pdfGenerator', 'dataExtractor', 'aiIntegration'];
    for (const moduleName of modules) {
        const loadStart = Date.now();
        const module = await startupManager.loadModule(moduleName);
        if (module) {
            console.log(`   ✅ Loaded ${moduleName} in ${Date.now() - loadStart}ms`);
        }
    }

    // Test with actual PlayClone operations
    console.log('\n🌐 Real-World Test with PlayClone:');
    console.log('-----------------------------------');
    
    const testStart = Date.now();
    const { browser: testBrowser, context: testContext } = await startupManager.getFastBrowser();
    const page = await testContext.newPage();
    
    // Navigate to a website
    await page.goto('https://example.com');
    const title = await page.title();
    console.log(`   ✅ Navigated to: ${title}`);
    
    // Extract some text
    const text = await page.textContent('h1');
    console.log(`   📝 Extracted text: ${text}`);
    
    const totalTime = Date.now() - testStart;
    console.log(`   ⏱️ Total operation time: ${totalTime}ms`);
    console.log(`   🎯 Sub-500ms achieved: ${totalTime < 500 ? 'YES ✅' : 'NO ❌'}`);

    // Clean up
    console.log('\n🧹 Cleaning up...');
    await startupManager.shutdown();
    console.log('✅ Demo complete!\n');

    // Summary
    console.log('════════════════════════════════════');
    console.log('                SUMMARY               ');
    console.log('════════════════════════════════════');
    console.log(`🎯 Target: <500ms startup time`);
    console.log(`📊 Achieved: ${benchmarkResults.averageWarmStart}ms (warm start)`);
    console.log(`📈 Improvement: ${benchmarkResults.improvement} over cold start`);
    console.log(`✅ Success: ${benchmarkResults.targetMet ? 'Target Met!' : 'Further optimization needed'}`);
    console.log('════════════════════════════════════\n');
}

// Run the demo
main().catch(console.error);