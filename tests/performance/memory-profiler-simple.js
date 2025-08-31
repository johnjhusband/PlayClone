#!/usr/bin/env node

/**
 * Simple Memory Profiler for PlayClone
 * Tests memory usage with a more lightweight approach
 */

const { PlayClone } = require('../../dist/index');
const v8 = require('v8');

function formatMemory(bytes) {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function getMemorySnapshot(label) {
    const mem = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    
    return {
        label,
        heapUsed: formatMemory(mem.heapUsed),
        heapTotal: formatMemory(mem.heapTotal),
        external: formatMemory(mem.external),
        rss: formatMemory(mem.rss),
        heapLimit: formatMemory(heapStats.heap_size_limit)
    };
}

async function profileMemory() {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         PlayClone Memory Profiler (Simple) v1.0.0            ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    
    const snapshots = [];
    
    // Initial measurement
    if (global.gc) global.gc();
    snapshots.push(getMemorySnapshot('Initial'));
    
    console.log('🚀 Starting memory profiling...\n');
    
    try {
        // Test 1: Single instance basic operations
        console.log('📝 Test 1: Single instance operations');
        const pc1 = new PlayClone({ headless: true });
        snapshots.push(getMemorySnapshot('After creating 1 instance'));
        
        await pc1.navigate('https://example.com');
        snapshots.push(getMemorySnapshot('After navigation'));
        
        await pc1.getText('body');
        await pc1.getLinks();
        snapshots.push(getMemorySnapshot('After data extraction'));
        
        await pc1.close();
        if (global.gc) global.gc();
        snapshots.push(getMemorySnapshot('After closing instance'));
        
        // Test 2: Multiple instances
        console.log('📝 Test 2: Multiple instances (3 browsers)');
        const instances = [];
        for (let i = 0; i < 3; i++) {
            instances.push(new PlayClone({ headless: true }));
        }
        snapshots.push(getMemorySnapshot('After creating 3 instances'));
        
        // Navigate all
        await Promise.all(instances.map(pc => pc.navigate('https://example.com')));
        snapshots.push(getMemorySnapshot('After 3 navigations'));
        
        // Close all
        await Promise.all(instances.map(pc => pc.close()));
        if (global.gc) global.gc();
        snapshots.push(getMemorySnapshot('After closing all'));
        
        // Test 3: Repeated operations
        console.log('📝 Test 3: Repeated operations (10 iterations)');
        const pc2 = new PlayClone({ headless: true });
        
        for (let i = 0; i < 10; i++) {
            await pc2.navigate('https://example.com');
            await pc2.getText('h1');
        }
        snapshots.push(getMemorySnapshot('After 10 iterations'));
        
        await pc2.close();
        if (global.gc) global.gc();
        snapshots.push(getMemorySnapshot('Final (after GC)'));
        
    } catch (error) {
        console.error('❌ Error during profiling:', error.message);
    }
    
    // Report results
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    MEMORY PROFILE RESULTS');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log('Label                          | Heap Used | Heap Total | RSS');
    console.log('-------------------------------|-----------|------------|----------');
    
    snapshots.forEach(snap => {
        const label = snap.label.padEnd(30);
        console.log(`${label} | ${snap.heapUsed.padStart(9)} | ${snap.heapTotal.padStart(10)} | ${snap.rss.padStart(9)}`);
    });
    
    // Memory growth analysis
    const initial = parseFloat(snapshots[0].heapUsed);
    const final = parseFloat(snapshots[snapshots.length - 1].heapUsed);
    const growth = final - initial;
    const growthPercent = (growth / initial * 100).toFixed(2);
    
    console.log('\n📊 ANALYSIS');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`Initial heap: ${snapshots[0].heapUsed}`);
    console.log(`Final heap:   ${snapshots[snapshots.length - 1].heapUsed}`);
    console.log(`Growth:       ${growth.toFixed(2)} MB (${growthPercent}%)`);
    
    if (Math.abs(growth) < 10) {
        console.log('✅ Memory usage is stable - no significant leaks detected');
    } else if (growth > 0) {
        console.log('⚠️  Memory growth detected - possible leak');
    } else {
        console.log('✅ Memory was properly released');
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// Run the profiler
if (require.main === module) {
    const useGC = process.argv.includes('--expose-gc') || global.gc;
    
    if (!global.gc) {
        console.log('💡 Tip: Run with --expose-gc for more accurate measurements');
        console.log('   node --expose-gc memory-profiler-simple.js\n');
    }
    
    profileMemory().catch(console.error);
}

module.exports = { profileMemory, getMemorySnapshot };