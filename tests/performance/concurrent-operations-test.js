#!/usr/bin/env node

/**
 * PlayClone Concurrent Operations Test
 * Tests 100+ simultaneous browser operations to verify system stability
 */

const { PlayClone } = require('../../dist/index');
const cluster = require('cluster');
const os = require('os');

// Test scenarios for concurrent operations
const TEST_SCENARIOS = {
    // Simple navigation test
    navigation: async (browser, id) => {
        const urls = [
            'https://example.com',
            'https://httpbin.org/html',
            'https://www.w3.org/',
            'https://duckduckgo.com',
            'https://www.wikipedia.org'
        ];
        const url = urls[id % urls.length];
        const result = await browser.navigate(url);
        return { id, type: 'navigation', url, success: result.success };
    },

    // Text extraction test
    textExtraction: async (browser, id) => {
        await browser.navigate('https://example.com');
        const result = await browser.getText('body');
        return { id, type: 'textExtraction', success: result.success, length: result.data?.length };
    },

    // Form interaction test
    formInteraction: async (browser, id) => {
        await browser.navigate('https://httpbin.org/forms/post');
        const fillResult = await browser.fill('input[name="custname"]', `User${id}`);
        const selectResult = await browser.select('select[name="custtel"]', '+1');
        return { id, type: 'formInteraction', success: fillResult.success && selectResult.success };
    },

    // Screenshot capture test
    screenshot: async (browser, id) => {
        await browser.navigate('https://example.com');
        const result = await browser.screenshot();
        return { id, type: 'screenshot', success: result.success, size: result.data?.length };
    },

    // Link extraction test
    linkExtraction: async (browser, id) => {
        await browser.navigate('https://www.w3.org/');
        const result = await browser.getLinks();
        return { id, type: 'linkExtraction', success: result.success, count: result.data?.length };
    },

    // Complex workflow test
    complexWorkflow: async (browser, id) => {
        const steps = [];
        
        // Step 1: Navigate
        const navResult = await browser.navigate('https://duckduckgo.com');
        steps.push({ step: 'navigate', success: navResult.success });
        
        // Step 2: Fill search
        const fillResult = await browser.fill('input[type="text"]', `test query ${id}`);
        steps.push({ step: 'fill', success: fillResult.success });
        
        // Step 3: Extract text
        const textResult = await browser.getText('body');
        steps.push({ step: 'getText', success: textResult.success });
        
        // Step 4: Screenshot
        const screenshotResult = await browser.screenshot();
        steps.push({ step: 'screenshot', success: screenshotResult.success });
        
        const allSuccess = steps.every(s => s.success);
        return { id, type: 'complexWorkflow', success: allSuccess, steps };
    }
};

// Worker process for parallel execution
async function runWorkerOperation(workerId, operationId, scenarioName) {
    const browser = new PlayClone({ 
        headless: true,
        viewport: { width: 1280, height: 720 },
        timeout: 30000
    });
    
    try {
        const scenario = TEST_SCENARIOS[scenarioName];
        const result = await scenario(browser, operationId);
        result.workerId = workerId;
        result.timestamp = Date.now();
        return result;
    } catch (error) {
        return {
            workerId,
            operationId,
            type: scenarioName,
            success: false,
            error: error.message
        };
    } finally {
        await browser.close();
    }
}

// Main concurrent test runner
class ConcurrentTestRunner {
    constructor(concurrentOps = 100) {
        this.concurrentOps = concurrentOps;
        this.results = [];
        this.startTime = null;
        this.endTime = null;
    }

    async runBatchOperations(batchSize, scenario) {
        console.log(`🚀 Running ${batchSize} concurrent ${scenario} operations...`);
        
        const promises = [];
        for (let i = 0; i < batchSize; i++) {
            promises.push(runWorkerOperation(i, i, scenario));
        }
        
        const batchStart = Date.now();
        const results = await Promise.allSettled(promises);
        const batchDuration = Date.now() - batchStart;
        
        const successful = results.filter(r => 
            r.status === 'fulfilled' && r.value.success
        ).length;
        
        const failed = results.length - successful;
        
        console.log(`✅ Batch complete: ${successful}/${batchSize} successful`);
        console.log(`⏱️  Batch duration: ${(batchDuration / 1000).toFixed(2)}s`);
        console.log(`📊 Ops/sec: ${(batchSize / (batchDuration / 1000)).toFixed(2)}`);
        
        return {
            scenario,
            batchSize,
            successful,
            failed,
            duration: batchDuration,
            opsPerSecond: batchSize / (batchDuration / 1000),
            results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
        };
    }

    async runFullTest() {
        console.log('🔥 PlayClone 100+ Concurrent Operations Test');
        console.log('=============================================');
        console.log(`System: ${os.cpus().length} CPUs, ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB RAM`);
        console.log(`Target: ${this.concurrentOps} concurrent operations\n`);
        
        this.startTime = Date.now();
        const testResults = [];
        
        // Test different scenarios with increasing concurrency
        const testPlan = [
            { scenario: 'navigation', count: 25 },
            { scenario: 'textExtraction', count: 25 },
            { scenario: 'screenshot', count: 20 },
            { scenario: 'linkExtraction', count: 15 },
            { scenario: 'formInteraction', count: 10 },
            { scenario: 'complexWorkflow', count: 5 }
        ];
        
        let totalOperations = 0;
        let totalSuccessful = 0;
        
        for (const test of testPlan) {
            const result = await this.runBatchOperations(test.count, test.scenario);
            testResults.push(result);
            totalOperations += test.count;
            totalSuccessful += result.successful;
            
            // Brief cooldown between batches
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Run the mega test: 100 concurrent simple operations
        console.log('\n🔥 MEGA TEST: 100 concurrent navigation operations');
        const megaResult = await this.runBatchOperations(100, 'navigation');
        testResults.push(megaResult);
        totalOperations += 100;
        totalSuccessful += megaResult.successful;
        
        this.endTime = Date.now();
        const totalDuration = this.endTime - this.startTime;
        
        // Generate summary
        console.log('\n📊 FINAL RESULTS');
        console.log('================');
        console.log(`Total Operations: ${totalOperations}`);
        console.log(`Successful: ${totalSuccessful}`);
        console.log(`Failed: ${totalOperations - totalSuccessful}`);
        console.log(`Success Rate: ${(totalSuccessful / totalOperations * 100).toFixed(2)}%`);
        console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
        console.log(`Average Ops/sec: ${(totalOperations / (totalDuration / 1000)).toFixed(2)}`);
        
        console.log('\n📈 Breakdown by Scenario:');
        for (const result of testResults) {
            console.log(`  ${result.scenario}: ${result.successful}/${result.batchSize} (${(result.successful/result.batchSize*100).toFixed(1)}%) - ${result.opsPerSecond.toFixed(2)} ops/sec`);
        }
        
        // Memory usage report
        const memUsage = process.memoryUsage();
        console.log('\n💾 Memory Usage:');
        console.log(`  RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
        console.log(`  Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
        console.log(`  Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
        
        return {
            totalOperations,
            totalSuccessful,
            successRate: (totalSuccessful / totalOperations * 100),
            duration: totalDuration,
            testResults
        };
    }
}

// Quick concurrent test for CI/CD
async function quickConcurrentTest() {
    console.log('⚡ Quick Concurrent Test (10 operations)');
    
    const promises = [];
    for (let i = 0; i < 10; i++) {
        promises.push(runWorkerOperation(i, i, 'navigation'));
    }
    
    const start = Date.now();
    const results = await Promise.allSettled(promises);
    const duration = Date.now() - start;
    
    const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
    ).length;
    
    console.log(`Results: ${successful}/10 successful in ${(duration/1000).toFixed(2)}s`);
    return successful === 10;
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--quick')) {
        // Run quick test
        const success = await quickConcurrentTest();
        process.exit(success ? 0 : 1);
    } else {
        // Run full test
        const runner = new ConcurrentTestRunner(100);
        
        try {
            const results = await runner.runFullTest();
            
            if (results.successRate >= 95) {
                console.log('\n✅ Concurrent operations test PASSED!');
                process.exit(0);
            } else if (results.successRate >= 80) {
                console.log('\n⚠️  Test passed with warnings (80-95% success rate)');
                process.exit(0);
            } else {
                console.log('\n❌ Test FAILED (success rate below 80%)');
                process.exit(1);
            }
        } catch (error) {
            console.error('\n💥 Fatal error:', error);
            process.exit(1);
        }
    }
}

// Handle termination
process.on('SIGINT', () => {
    console.log('\n⚠️  Test interrupted');
    process.exit(130);
});

if (require.main === module) {
    main();
}

module.exports = { ConcurrentTestRunner, runWorkerOperation };