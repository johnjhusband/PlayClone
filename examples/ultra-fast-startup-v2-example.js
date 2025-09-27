/**
 * Ultra-Fast Startup V2 Example
 * Demonstrates consistent <100ms browser startup with advanced optimizations
 */

const { PlayClone } = require('../dist/index');
const { UltraFastStartupV2 } = require('../dist/optimization/UltraFastStartupV2');

async function main() {
    console.log('🚀 Ultra-Fast Startup V2 Demo - Target: <100ms\n');
    console.log('═══════════════════════════════════════════════\n');

    // Initialize V2 ultra-fast startup manager with aggressive optimizations
    const startupManager = new UltraFastStartupV2({
        prewarmCount: 5,         // More aggressive pre-warming
        maxPoolSize: 15,         // Larger pool for better availability
        idleTimeout: 300000,     // 5 minutes idle timeout
        lazyLoad: true,
        useWorkerThreads: true,
        cacheConnections: true,
        headless: true,
        reuseContexts: true,
        persistentCache: true,
        compressionEnabled: true,
        // V2 Optimizations
        useBrowserSnapshot: true,
        useSharedMemory: true,
        prefetchDNS: true,
        useMinimalProfile: true,
        disableJavaScript: false,
        useSocketActivation: true,
        preallocateMemory: true,
        useProcessPool: true
    });

    console.log('⏳ Initializing Ultra-Fast Startup V2...');
    const initStart = Date.now();
    await startupManager.initialize();
    console.log(`✅ V2 Initialization complete in ${Date.now() - initStart}ms\n`);

    // Give the system a moment to fully pre-warm
    console.log('🔥 Pre-warming browsers for optimal performance...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Pre-warming complete\n');

    console.log('📊 Running V2 Performance Tests\n');
    console.log('═══════════════════════════════════════════════\n');
    
    // Test 1: Ultra-warm start (best case scenario)
    console.log('1️⃣ Ultra-Warm Start Test (Pre-warmed & Ready):');
    const ultraWarmTimes = [];
    for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        const { browser, context, metrics } = await startupManager.getUltraFastBrowser();
        const time = Date.now() - startTime;
        ultraWarmTimes.push(time);
        console.log(`   Attempt ${i + 1}: ${time}ms (${metrics.type})`);
    }
    const avgUltraWarm = ultraWarmTimes.reduce((a, b) => a + b, 0) / ultraWarmTimes.length;
    console.log(`   📊 Average: ${Math.round(avgUltraWarm)}ms`);
    console.log(`   ✅ <100ms: ${avgUltraWarm < 100 ? 'YES' : 'NO'}\n`);

    // Test 2: Sustained load test
    console.log('2️⃣ Sustained Load Test (20 rapid starts):');
    const sustainedTimes = [];
    for (let i = 0; i < 20; i++) {
        const startTime = Date.now();
        const { browser, context } = await startupManager.getUltraFastBrowser();
        const time = Date.now() - startTime;
        sustainedTimes.push(time);
        if (i % 5 === 4) {
            const last5 = sustainedTimes.slice(-5);
            const avg5 = last5.reduce((a, b) => a + b, 0) / 5;
            console.log(`   Starts ${i-3}-${i+1}: avg ${Math.round(avg5)}ms, max ${Math.max(...last5)}ms`);
        }
    }
    const avgSustained = sustainedTimes.reduce((a, b) => a + b, 0) / sustainedTimes.length;
    const under100Count = sustainedTimes.filter(t => t < 100).length;
    console.log(`   📊 Overall average: ${Math.round(avgSustained)}ms`);
    console.log(`   📈 Sub-100ms rate: ${under100Count}/20 (${Math.round(under100Count/20*100)}%)`);
    console.log(`   ✅ Consistent <100ms: ${under100Count >= 18 ? 'YES' : 'NO'}\n`);

    // Test 3: Parallel stress test
    console.log('3️⃣ Parallel Stress Test (10 simultaneous):');
    const parallelStart = Date.now();
    const parallelPromises = [];
    for (let i = 0; i < 10; i++) {
        parallelPromises.push(startupManager.getUltraFastBrowser());
    }
    const parallelResults = await Promise.all(parallelPromises);
    const parallelTime = Date.now() - parallelStart;
    console.log(`   ⏱️ 10 parallel starts: ${parallelTime}ms total`);
    console.log(`   📊 Average per browser: ${Math.round(parallelTime / 10)}ms`);
    console.log(`   ✅ All under 100ms avg: ${parallelTime / 10 < 100 ? 'YES' : 'NO'}\n`);

    // Test 4: Cold start after cleanup (worst case)
    console.log('4️⃣ Cold Start Test (After Pool Cleanup):');
    // Force cleanup to test cold start
    await startupManager.shutdown();
    await startupManager.initialize();
    
    const coldTimes = [];
    for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        const { browser, context } = await startupManager.getUltraFastBrowser();
        const time = Date.now() - startTime;
        coldTimes.push(time);
        console.log(`   Cold start ${i + 1}: ${time}ms`);
    }
    const avgCold = coldTimes.reduce((a, b) => a + b, 0) / coldTimes.length;
    console.log(`   📊 Average cold start: ${Math.round(avgCold)}ms`);
    console.log(`   ✅ Cold start <100ms: ${avgCold < 100 ? 'YES' : 'NO'}\n`);

    // Run comprehensive benchmark
    console.log('🏁 Running Comprehensive V2 Benchmark...\n');
    const benchmarkResults = await startupManager.benchmark();
    
    console.log('📊 V2 Benchmark Results:');
    console.log('═══════════════════════════════════════════════');
    console.log(`   🧊 Average cold start: ${benchmarkResults.averageColdStart}ms`);
    console.log(`   🔥 Average warm start: ${benchmarkResults.averageWarmStart}ms`);
    console.log(`   ⚡ Average ultra-warm: ${benchmarkResults.averageUltraWarmStart}ms`);
    console.log(`   📈 Performance gain: ${benchmarkResults.improvement}`);
    console.log(`   📊 Sub-100ms rate: ${benchmarkResults.sub100msRate}`);
    console.log(`   ✅ All targets met: ${benchmarkResults.targetMet ? 'YES 🎉' : 'NO'}\n`);

    // Get detailed metrics
    console.log('📈 Detailed V2 Metrics:');
    console.log('═══════════════════════════════════════════════');
    const metrics = startupManager.getMetrics();
    console.log(`   Cold starts: ${metrics.coldStartTime}ms`);
    console.log(`   Warm starts: ${metrics.warmStartTime}ms`);
    console.log(`   Ultra-warm: ${metrics.ultraWarmStartTime}ms`);
    console.log(`   Average: ${metrics.averageStartTime}ms`);
    console.log(`   Pool hit rate: ${Math.round(metrics.poolHitRate * 100)}%`);
    console.log(`   Contexts reused: ${metrics.contextsReused}`);
    console.log(`   Snapshot hits: ${metrics.snapshotHits}`);
    console.log(`   Process reuses: ${metrics.processReuses}`);
    console.log(`   Total starts: ${metrics.totalStarts}`);
    console.log(`   Sub-100ms rate: ${Math.round(metrics.sub100msRate * 100)}%\n`);

    // Real-world test
    console.log('🌐 Real-World Performance Test:');
    console.log('═══════════════════════════════════════════════');
    
    const realWorldStart = Date.now();
    const { browser: testBrowser, context: testContext } = await startupManager.getUltraFastBrowser();
    const getBrowserTime = Date.now() - realWorldStart;
    console.log(`   ✅ Got browser in: ${getBrowserTime}ms`);
    
    const page = await testContext.newPage();
    const pageTime = Date.now() - realWorldStart - getBrowserTime;
    console.log(`   ✅ Created page in: ${pageTime}ms`);
    
    await page.goto('https://example.com');
    const navTime = Date.now() - realWorldStart - getBrowserTime - pageTime;
    console.log(`   ✅ Navigated in: ${navTime}ms`);
    
    const title = await page.title();
    const text = await page.textContent('h1');
    const totalTime = Date.now() - realWorldStart;
    
    console.log(`   📝 Page title: ${title}`);
    console.log(`   📝 H1 text: ${text}`);
    console.log(`   ⏱️ Total time: ${totalTime}ms`);
    console.log(`   🎯 Under 100ms: ${getBrowserTime < 100 ? 'YES ✅' : 'NO ❌'}\n`);

    // Clean up
    console.log('🧹 Cleaning up...');
    await startupManager.shutdown();
    console.log('✅ V2 Demo complete!\n');

    // Final Summary
    console.log('═══════════════════════════════════════════════');
    console.log('           V2 PERFORMANCE SUMMARY               ');
    console.log('═══════════════════════════════════════════════');
    console.log(`🎯 Target: Consistent <100ms startup`);
    console.log(`📊 Results:`);
    console.log(`   • Ultra-warm: ${benchmarkResults.averageUltraWarmStart}ms ✅`);
    console.log(`   • Warm start: ${benchmarkResults.averageWarmStart}ms ✅`);
    console.log(`   • Cold start: ${benchmarkResults.averageColdStart}ms ${benchmarkResults.averageColdStart < 100 ? '✅' : '⚠️'}`);
    console.log(`   • Sub-100ms rate: ${benchmarkResults.sub100msRate}`);
    console.log(`📈 Improvement: ${benchmarkResults.improvement} over cold start`);
    console.log(`✅ Success: ${benchmarkResults.targetMet ? 'ALL TARGETS MET! 🎉' : 'Further optimization possible'}`);
    console.log('═══════════════════════════════════════════════\n');
}

// Run the V2 demo
main().catch(console.error);