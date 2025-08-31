#!/usr/bin/env node

/**
 * Memory Profiler for PlayClone
 * Tests memory usage under heavy load with concurrent operations
 */

const { PlayClone } = require('../../dist/index');
const v8 = require('v8');
const process = require('process');

// Memory tracking utilities
class MemoryProfiler {
    constructor() {
        this.measurements = [];
        this.startTime = Date.now();
        this.peakMemory = 0;
    }

    measure(label) {
        if (global.gc) {
            global.gc(); // Force garbage collection if available
        }
        
        const heapStats = v8.getHeapStatistics();
        const memUsage = process.memoryUsage();
        
        const measurement = {
            label,
            timestamp: Date.now() - this.startTime,
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
            external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100, // MB
            rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100, // MB
            heapLimit: Math.round(heapStats.heap_size_limit / 1024 / 1024 * 100) / 100, // MB
            totalAvailable: Math.round(heapStats.total_available_size / 1024 / 1024 * 100) / 100 // MB
        };
        
        this.measurements.push(measurement);
        this.peakMemory = Math.max(this.peakMemory, memUsage.heapUsed);
        
        return measurement;
    }
    
    report() {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('                    MEMORY PROFILING REPORT');
        console.log('═══════════════════════════════════════════════════════════════\n');
        
        // Summary statistics
        const heapUsedValues = this.measurements.map(m => m.heapUsed);
        const avgHeapUsed = heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length;
        const minHeapUsed = Math.min(...heapUsedValues);
        const maxHeapUsed = Math.max(...heapUsedValues);
        
        console.log('📊 SUMMARY STATISTICS');
        console.log('─────────────────────────────────────────────────────────────');
        console.log(`  Peak Memory:     ${(this.peakMemory / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Average Heap:    ${avgHeapUsed.toFixed(2)} MB`);
        console.log(`  Min Heap:        ${minHeapUsed.toFixed(2)} MB`);
        console.log(`  Max Heap:        ${maxHeapUsed.toFixed(2)} MB`);
        console.log(`  Memory Growth:   ${(maxHeapUsed - minHeapUsed).toFixed(2)} MB`);
        console.log(`  Total Duration:  ${((Date.now() - this.startTime) / 1000).toFixed(2)} seconds`);
        
        // Detailed measurements
        console.log('\n📈 DETAILED MEASUREMENTS');
        console.log('─────────────────────────────────────────────────────────────');
        console.log('Time(s) | Heap Used | Heap Total | External | RSS     | Label');
        console.log('--------|-----------|------------|----------|---------|------------------');
        
        this.measurements.forEach(m => {
            const time = (m.timestamp / 1000).toFixed(1).padStart(7);
            const heapUsed = `${m.heapUsed.toFixed(1)} MB`.padStart(10);
            const heapTotal = `${m.heapTotal.toFixed(1)} MB`.padStart(11);
            const external = `${m.external.toFixed(1)} MB`.padStart(9);
            const rss = `${m.rss.toFixed(1)} MB`.padStart(8);
            console.log(`${time} | ${heapUsed} | ${heapTotal} | ${external} | ${rss} | ${m.label}`);
        });
        
        // Memory leak detection
        console.log('\n🔍 MEMORY LEAK ANALYSIS');
        console.log('─────────────────────────────────────────────────────────────');
        const firstQuarter = heapUsedValues.slice(0, Math.floor(heapUsedValues.length / 4));
        const lastQuarter = heapUsedValues.slice(-Math.floor(heapUsedValues.length / 4));
        const firstAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
        const lastAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;
        const growthRate = ((lastAvg - firstAvg) / firstAvg * 100).toFixed(2);
        
        if (growthRate > 50) {
            console.log(`  ⚠️  WARNING: Significant memory growth detected (${growthRate}%)`);
            console.log('      Possible memory leak!');
        } else if (growthRate > 20) {
            console.log(`  ⚠️  CAUTION: Moderate memory growth detected (${growthRate}%)`);
            console.log('      Monitor for potential issues');
        } else {
            console.log(`  ✅  Memory usage stable (${growthRate}% growth)`);
            console.log('      No memory leaks detected');
        }
        
        console.log('\n═══════════════════════════════════════════════════════════════\n');
    }
}

// Test scenarios
async function runHeavyLoadTest() {
    const profiler = new MemoryProfiler();
    const instances = [];
    const CONCURRENT_INSTANCES = 5;
    const OPERATIONS_PER_INSTANCE = 10;
    const TOTAL_ITERATIONS = 3;
    
    console.log('\n🚀 Starting Heavy Load Memory Profiling...');
    console.log(`   Concurrent instances: ${CONCURRENT_INSTANCES}`);
    console.log(`   Operations per instance: ${OPERATIONS_PER_INSTANCE}`);
    console.log(`   Total iterations: ${TOTAL_ITERATIONS}`);
    console.log('\n');
    
    profiler.measure('Initial');
    
    try {
        // Test 1: Create multiple browser instances
        console.log('📝 Test 1: Creating multiple browser instances...');
        for (let i = 0; i < CONCURRENT_INSTANCES; i++) {
            const pc = new PlayClone({ headless: true });
            instances.push(pc);
            // PlayClone auto-initializes, no need for explicit init
        }
        profiler.measure(`${CONCURRENT_INSTANCES} instances created`);
        
        // Test 2: Concurrent navigation operations
        console.log('📝 Test 2: Running concurrent navigation operations...');
        for (let iter = 0; iter < TOTAL_ITERATIONS; iter++) {
            const navigationPromises = instances.map(async (pc, idx) => {
                const urls = [
                    'https://example.com',
                    'https://www.w3.org/WAI/ARIA/apg/',
                    'https://github.com',
                    'https://nodejs.org',
                    'https://developer.mozilla.org'
                ];
                
                for (let op = 0; op < OPERATIONS_PER_INSTANCE; op++) {
                    const url = urls[op % urls.length];
                    await pc.navigate(url);
                    await pc.getText('body');
                    await pc.getLinks();
                }
            });
            
            await Promise.all(navigationPromises);
            profiler.measure(`Iteration ${iter + 1} complete`);
        }
        
        // Test 3: State management stress test
        console.log('📝 Test 3: State management stress test...');
        const statePromises = instances.map(async (pc, idx) => {
            for (let i = 0; i < 5; i++) {
                const state = await pc.saveState(`stress-test-${idx}-${i}`);
                await pc.restoreState(state.id);
            }
        });
        await Promise.all(statePromises);
        profiler.measure('State management complete');
        
        // Test 4: Data extraction stress test
        console.log('📝 Test 4: Data extraction stress test...');
        const extractionPromises = instances.map(async (pc) => {
            await pc.navigate('https://example.com');
            for (let i = 0; i < 20; i++) {
                await pc.getText('h1');
                await pc.getLinks();
                await pc.screenshot({ fullPage: false });
            }
        });
        await Promise.all(extractionPromises);
        profiler.measure('Data extraction complete');
        
        // Test 5: Cleanup half of the instances
        console.log('📝 Test 5: Cleaning up half of the instances...');
        for (let i = 0; i < Math.floor(CONCURRENT_INSTANCES / 2); i++) {
            await instances[i].close();
        }
        profiler.measure('Half instances closed');
        
        // Test 6: Continue operations with remaining instances
        console.log('📝 Test 6: Continuing with remaining instances...');
        const remainingInstances = instances.slice(Math.floor(CONCURRENT_INSTANCES / 2));
        const finalPromises = remainingInstances.map(async (pc) => {
            for (let i = 0; i < 10; i++) {
                await pc.navigate('https://example.com');
                await pc.getText('body');
            }
        });
        await Promise.all(finalPromises);
        profiler.measure('Final operations complete');
        
        // Cleanup remaining instances
        console.log('🧹 Cleaning up remaining instances...');
        for (const pc of remainingInstances) {
            if (pc && typeof pc.close === 'function') {
                await pc.close();
            }
        }
        profiler.measure('All instances closed');
        
        // Force garbage collection and final measurement
        if (global.gc) {
            global.gc();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        profiler.measure('Final (after GC)');
        
    } catch (error) {
        console.error('❌ Error during profiling:', error);
        // Cleanup on error
        for (const pc of instances) {
            try {
                if (pc && typeof pc.close === 'function') {
                    await pc.close();
                }
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }
    
    // Generate report
    profiler.report();
}

// Run memory profiler with optional GC exposure
async function main() {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║            PlayClone Memory Profiler v1.0.0                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    
    if (!global.gc) {
        console.log('\n⚠️  Note: Run with --expose-gc flag for more accurate measurements');
        console.log('   Example: node --expose-gc memory-profiler.js\n');
    } else {
        console.log('\n✅ Garbage collection exposed for accurate measurements\n');
    }
    
    try {
        await runHeavyLoadTest();
        console.log('✅ Memory profiling completed successfully!\n');
    } catch (error) {
        console.error('❌ Fatal error during profiling:', error);
        process.exit(1);
    }
}

// Execute profiler
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { MemoryProfiler, runHeavyLoadTest };