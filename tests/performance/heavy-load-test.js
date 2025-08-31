#!/usr/bin/env node

/**
 * Heavy Load Test for PlayClone
 * Simulates extreme usage patterns to test memory and performance
 */

const { PlayClone } = require('../../dist/index');
const { performance } = require('perf_hooks');

class LoadTester {
    constructor() {
        this.results = {
            operations: [],
            errors: [],
            memorySnapshots: []
        };
    }
    
    logOperation(name, duration, success, error = null) {
        this.results.operations.push({
            name,
            duration,
            success,
            error: error ? error.message : null,
            timestamp: Date.now()
        });
    }
    
    captureMemory(label) {
        const mem = process.memoryUsage();
        this.results.memorySnapshots.push({
            label,
            heapUsed: mem.heapUsed / 1024 / 1024,
            heapTotal: mem.heapTotal / 1024 / 1024,
            rss: mem.rss / 1024 / 1024,
            timestamp: Date.now()
        });
    }
    
    async runTest(name, testFn) {
        console.log(`\n🧪 Running: ${name}`);
        const start = performance.now();
        let success = false;
        let error = null;
        
        try {
            await testFn();
            success = true;
            console.log(`   ✅ Completed in ${((performance.now() - start) / 1000).toFixed(2)}s`);
        } catch (err) {
            error = err;
            console.log(`   ❌ Failed: ${err.message}`);
            this.results.errors.push({ test: name, error: err.message });
        }
        
        const duration = performance.now() - start;
        this.logOperation(name, duration, success, error);
        return success;
    }
    
    generateReport() {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║                  HEAVY LOAD TEST REPORT                      ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');
        
        // Success rate
        const successful = this.results.operations.filter(op => op.success).length;
        const total = this.results.operations.length;
        const successRate = (successful / total * 100).toFixed(2);
        
        console.log('📊 OVERALL STATISTICS');
        console.log('─────────────────────────────────────────────────────────────');
        console.log(`  Total Tests:    ${total}`);
        console.log(`  Successful:     ${successful}`);
        console.log(`  Failed:         ${total - successful}`);
        console.log(`  Success Rate:   ${successRate}%`);
        
        // Performance metrics
        const durations = this.results.operations.map(op => op.duration);
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length / 1000;
        const maxDuration = Math.max(...durations) / 1000;
        const minDuration = Math.min(...durations) / 1000;
        
        console.log(`\n  Avg Duration:   ${avgDuration.toFixed(2)}s`);
        console.log(`  Max Duration:   ${maxDuration.toFixed(2)}s`);
        console.log(`  Min Duration:   ${minDuration.toFixed(2)}s`);
        
        // Memory analysis
        if (this.results.memorySnapshots.length > 0) {
            const memStart = this.results.memorySnapshots[0].heapUsed;
            const memEnd = this.results.memorySnapshots[this.results.memorySnapshots.length - 1].heapUsed;
            const memGrowth = memEnd - memStart;
            
            console.log(`\n  Initial Memory: ${memStart.toFixed(2)} MB`);
            console.log(`  Final Memory:   ${memEnd.toFixed(2)} MB`);
            console.log(`  Memory Growth:  ${memGrowth.toFixed(2)} MB`);
            
            if (memGrowth < 50) {
                console.log('  ✅ Memory usage is acceptable');
            } else {
                console.log('  ⚠️  High memory growth detected');
            }
        }
        
        // Error summary
        if (this.results.errors.length > 0) {
            console.log('\n❌ ERRORS ENCOUNTERED');
            console.log('─────────────────────────────────────────────────────────────');
            this.results.errors.forEach(err => {
                console.log(`  ${err.test}: ${err.error}`);
            });
        }
        
        console.log('\n═══════════════════════════════════════════════════════════════\n');
    }
}

async function runHeavyLoadTests() {
    const tester = new LoadTester();
    
    console.log('\n🚀 Starting Heavy Load Tests for PlayClone');
    console.log('   This will simulate extreme usage patterns...\n');
    
    tester.captureMemory('Initial');
    
    // Test 1: Rapid instance creation and destruction
    await tester.runTest('Rapid Instance Creation (20 instances)', async () => {
        const instances = [];
        for (let i = 0; i < 20; i++) {
            const pc = new PlayClone({ headless: true });
            instances.push(pc);
        }
        
        // Close all
        await Promise.all(instances.map(pc => pc.close()));
    });
    
    tester.captureMemory('After rapid creation');
    
    // Test 2: Concurrent operations on single instance
    await tester.runTest('Concurrent Operations (50 ops)', async () => {
        const pc = new PlayClone({ headless: true });
        await pc.navigate('https://example.com');
        
        const operations = [];
        for (let i = 0; i < 50; i++) {
            operations.push(pc.getText('body'));
            operations.push(pc.getLinks());
        }
        
        await Promise.all(operations);
        await pc.close();
    });
    
    tester.captureMemory('After concurrent ops');
    
    // Test 3: Maximum parallel browsers
    await tester.runTest('Maximum Parallel Browsers (10)', async () => {
        const instances = [];
        const maxBrowsers = 10;
        
        // Create and navigate all
        for (let i = 0; i < maxBrowsers; i++) {
            const pc = new PlayClone({ headless: true });
            instances.push(pc);
            await pc.navigate('https://example.com');
        }
        
        // Parallel operations
        await Promise.all(instances.map(async pc => {
            await pc.getText('h1');
            await pc.getLinks();
            await pc.screenshot({ fullPage: false });
        }));
        
        // Cleanup
        await Promise.all(instances.map(pc => pc.close()));
    });
    
    tester.captureMemory('After parallel browsers');
    
    // Test 4: Long-running session
    await tester.runTest('Long-Running Session (100 navigations)', async () => {
        const pc = new PlayClone({ headless: true });
        
        for (let i = 0; i < 100; i++) {
            await pc.navigate('https://example.com');
            if (i % 20 === 0) {
                await pc.getText('body');
            }
        }
        
        await pc.close();
    });
    
    tester.captureMemory('After long session');
    
    // Test 5: State management stress
    await tester.runTest('State Management Stress (50 saves/restores)', async () => {
        const pc = new PlayClone({ headless: true });
        await pc.navigate('https://example.com');
        
        const states = [];
        
        // Save many states
        for (let i = 0; i < 25; i++) {
            const state = await pc.saveState(`stress-${i}`);
            states.push(state);
        }
        
        // Restore randomly
        for (let i = 0; i < 25; i++) {
            const randomState = states[Math.floor(Math.random() * states.length)];
            await pc.restoreState(randomState.id);
        }
        
        await pc.close();
    });
    
    tester.captureMemory('After state stress');
    
    // Test 6: Error recovery
    await tester.runTest('Error Recovery (invalid operations)', async () => {
        const pc = new PlayClone({ headless: true });
        
        // Try invalid operations
        const invalidOps = [
            pc.navigate('not-a-url'),
            pc.click('non-existent-element-xyz-123'),
            pc.fill('fake-input', 'test'),
            pc.getText('element-that-does-not-exist')
        ];
        
        // Should handle errors gracefully
        await Promise.allSettled(invalidOps);
        
        // Should still work after errors
        await pc.navigate('https://example.com');
        await pc.getText('body');
        
        await pc.close();
    });
    
    tester.captureMemory('After error recovery');
    
    // Test 7: Memory leak detection
    await tester.runTest('Memory Leak Detection (create/destroy loop)', async () => {
        for (let i = 0; i < 10; i++) {
            const pc = new PlayClone({ headless: true });
            await pc.navigate('https://example.com');
            await pc.getText('body');
            await pc.close();
            
            // Force GC if available
            if (global.gc && i % 5 === 0) {
                global.gc();
            }
        }
    });
    
    tester.captureMemory('Final');
    
    // Force final GC
    if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 1000));
        tester.captureMemory('After GC');
    }
    
    // Generate report
    tester.generateReport();
    
    // Performance recommendations
    console.log('💡 PERFORMANCE RECOMMENDATIONS');
    console.log('─────────────────────────────────────────────────────────────');
    
    const finalMem = tester.results.memorySnapshots[tester.results.memorySnapshots.length - 1];
    if (finalMem.heapUsed > 100) {
        console.log('  ⚠️  Consider implementing browser instance pooling');
        console.log('  ⚠️  Add memory limits for long-running sessions');
    } else {
        console.log('  ✅ Memory usage is within acceptable limits');
    }
    
    const avgTime = tester.results.operations.reduce((a, op) => a + op.duration, 0) / tester.results.operations.length / 1000;
    if (avgTime > 5) {
        console.log('  ⚠️  Operations are taking longer than expected');
        console.log('  💡 Consider connection pooling and caching');
    } else {
        console.log('  ✅ Performance is good');
    }
    
    console.log('\n');
}

// Main execution
if (require.main === module) {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║             PlayClone Heavy Load Tester v1.0.0               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    
    if (!global.gc) {
        console.log('\n💡 Tip: Run with --expose-gc for better memory analysis');
        console.log('   node --expose-gc heavy-load-test.js\n');
    }
    
    runHeavyLoadTests()
        .then(() => {
            console.log('✅ Heavy load testing completed!\n');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { LoadTester, runHeavyLoadTests };