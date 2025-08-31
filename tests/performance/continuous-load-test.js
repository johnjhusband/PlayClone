#!/usr/bin/env node

/**
 * PlayClone Continuous Load Test
 * Runs continuous load testing to identify memory leaks and performance degradation
 */

const { PlayClone } = require('../../dist/index');
const fs = require('fs').promises;
const path = require('path');

class ContinuousLoadTester {
    constructor(options = {}) {
        this.options = {
            duration: options.duration || 60000, // 1 minute default
            concurrency: options.concurrency || 10,
            checkpointInterval: options.checkpointInterval || 10000, // 10 seconds
            memoryThreshold: options.memoryThreshold || 500, // MB
            ...options
        };
        
        this.stats = {
            startTime: Date.now(),
            operations: 0,
            successful: 0,
            failed: 0,
            checkpoints: [],
            errors: []
        };
        
        this.running = false;
        this.browsers = new Set();
    }

    async start() {
        console.log('🚀 Starting Continuous Load Test');
        console.log(`Duration: ${this.options.duration / 1000}s`);
        console.log(`Concurrency: ${this.options.concurrency}`);
        console.log(`Memory Threshold: ${this.options.memoryThreshold}MB\n`);
        
        this.running = true;
        this.stats.startTime = Date.now();
        
        // Start checkpoint monitoring
        this.startCheckpointing();
        
        // Start worker pools
        const workers = [];
        for (let i = 0; i < this.options.concurrency; i++) {
            workers.push(this.runWorker(i));
        }
        
        // Run for specified duration
        setTimeout(() => {
            this.running = false;
            console.log('\n⏱️  Test duration reached, stopping workers...');
        }, this.options.duration);
        
        // Wait for all workers to complete
        await Promise.allSettled(workers);
        
        // Final cleanup
        await this.cleanup();
        
        return this.generateReport();
    }

    async runWorker(workerId) {
        while (this.running) {
            let browser = null;
            
            try {
                // Create browser
                browser = new PlayClone({
                    headless: true,
                    viewport: { width: 1280, height: 720 },
                    timeout: 15000
                });
                this.browsers.add(browser);
                
                // Run random operation
                const operation = this.getRandomOperation();
                const result = await this.executeOperation(browser, operation);
                
                this.stats.operations++;
                if (result.success) {
                    this.stats.successful++;
                } else {
                    this.stats.failed++;
                }
                
                // Close browser
                await browser.close();
                this.browsers.delete(browser);
                
                // Small delay to prevent overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                this.stats.failed++;
                this.stats.errors.push({
                    workerId,
                    timestamp: Date.now(),
                    error: error.message
                });
                
                // Clean up browser on error
                if (browser) {
                    try {
                        await browser.close();
                        this.browsers.delete(browser);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }
            }
        }
    }

    getRandomOperation() {
        const operations = [
            'navigate',
            'getText',
            'getLinks',
            'screenshot',
            'fillForm',
            'complexWorkflow'
        ];
        return operations[Math.floor(Math.random() * operations.length)];
    }

    async executeOperation(browser, operationType) {
        const start = Date.now();
        let success = false;
        
        try {
            switch (operationType) {
                case 'navigate':
                    const navResult = await browser.navigate('https://example.com');
                    success = navResult.success;
                    break;
                    
                case 'getText':
                    await browser.navigate('https://example.com');
                    const textResult = await browser.getText('body');
                    success = textResult.success;
                    break;
                    
                case 'getLinks':
                    await browser.navigate('https://www.w3.org/');
                    const linksResult = await browser.getLinks();
                    success = linksResult.success;
                    break;
                    
                case 'screenshot':
                    await browser.navigate('https://example.com');
                    const screenshotResult = await browser.screenshot();
                    success = screenshotResult.success;
                    break;
                    
                case 'fillForm':
                    await browser.navigate('https://httpbin.org/forms/post');
                    const fillResult = await browser.fill('input[name="custname"]', 'Test User');
                    success = fillResult.success;
                    break;
                    
                case 'complexWorkflow':
                    await browser.navigate('https://duckduckgo.com');
                    const fill = await browser.fill('input[type="text"]', 'test query');
                    const text = await browser.getText('body');
                    success = fill.success && text.success;
                    break;
            }
        } catch (error) {
            success = false;
        }
        
        return {
            type: operationType,
            success,
            duration: Date.now() - start
        };
    }

    startCheckpointing() {
        const checkpointTimer = setInterval(() => {
            if (!this.running) {
                clearInterval(checkpointTimer);
                return;
            }
            
            const checkpoint = this.captureCheckpoint();
            this.stats.checkpoints.push(checkpoint);
            
            // Check memory threshold
            if (checkpoint.memory.rss > this.options.memoryThreshold) {
                console.warn(`⚠️  Memory threshold exceeded: ${checkpoint.memory.rss}MB > ${this.options.memoryThreshold}MB`);
            }
            
            // Display progress
            const elapsed = (Date.now() - this.stats.startTime) / 1000;
            const opsPerSec = this.stats.operations / elapsed;
            console.log(`📊 [${elapsed.toFixed(0)}s] Ops: ${this.stats.operations} | Success: ${this.stats.successful} | Failed: ${this.stats.failed} | Ops/sec: ${opsPerSec.toFixed(2)} | Mem: ${checkpoint.memory.rss}MB`);
            
        }, this.options.checkpointInterval);
    }

    captureCheckpoint() {
        const memUsage = process.memoryUsage();
        return {
            timestamp: Date.now(),
            operations: this.stats.operations,
            successful: this.stats.successful,
            failed: this.stats.failed,
            memory: {
                rss: Math.round(memUsage.rss / 1024 / 1024),
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024)
            },
            activeBrowsers: this.browsers.size
        };
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up resources...');
        for (const browser of this.browsers) {
            try {
                await browser.close();
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        this.browsers.clear();
    }

    generateReport() {
        const duration = Date.now() - this.stats.startTime;
        const opsPerSecond = this.stats.operations / (duration / 1000);
        const successRate = (this.stats.successful / this.stats.operations * 100) || 0;
        
        // Analyze memory trend
        let memoryLeak = false;
        if (this.stats.checkpoints.length > 2) {
            const firstMem = this.stats.checkpoints[0].memory.rss;
            const lastMem = this.stats.checkpoints[this.stats.checkpoints.length - 1].memory.rss;
            const memGrowth = ((lastMem - firstMem) / firstMem * 100);
            memoryLeak = memGrowth > 50; // 50% growth indicates potential leak
        }
        
        const report = {
            duration: duration / 1000,
            totalOperations: this.stats.operations,
            successful: this.stats.successful,
            failed: this.stats.failed,
            successRate: successRate.toFixed(2),
            operationsPerSecond: opsPerSecond.toFixed(2),
            errors: this.stats.errors.length,
            memoryLeak,
            checkpoints: this.stats.checkpoints
        };
        
        console.log('\n📊 CONTINUOUS LOAD TEST REPORT');
        console.log('==============================');
        console.log(`Duration: ${report.duration}s`);
        console.log(`Total Operations: ${report.totalOperations}`);
        console.log(`Success Rate: ${report.successRate}%`);
        console.log(`Operations/sec: ${report.operationsPerSecond}`);
        console.log(`Errors: ${report.errors}`);
        console.log(`Memory Leak Detected: ${report.memoryLeak ? 'YES ⚠️' : 'NO ✅'}`);
        
        if (this.stats.checkpoints.length > 0) {
            const first = this.stats.checkpoints[0];
            const last = this.stats.checkpoints[this.stats.checkpoints.length - 1];
            console.log(`Memory Growth: ${first.memory.rss}MB → ${last.memory.rss}MB`);
        }
        
        return report;
    }

    async saveReport(filename) {
        const dir = path.join(__dirname, 'continuous-load-results');
        await fs.mkdir(dir, { recursive: true });
        
        const filepath = path.join(dir, filename || `load-test-${Date.now()}.json`);
        await fs.writeFile(filepath, JSON.stringify({
            config: this.options,
            stats: this.stats,
            report: this.generateReport()
        }, null, 2));
        
        console.log(`\n💾 Report saved to: ${filepath}`);
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    // Parse command line arguments
    const options = {
        duration: 60000, // 1 minute default
        concurrency: 10
    };
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--duration' && args[i + 1]) {
            options.duration = parseInt(args[i + 1]) * 1000;
        }
        if (args[i] === '--concurrency' && args[i + 1]) {
            options.concurrency = parseInt(args[i + 1]);
        }
        if (args[i] === '--memory-threshold' && args[i + 1]) {
            options.memoryThreshold = parseInt(args[i + 1]);
        }
    }
    
    console.log('🔥 PlayClone Continuous Load Test');
    console.log('Usage: node continuous-load-test.js [options]');
    console.log('  --duration <seconds>     Test duration (default: 60)');
    console.log('  --concurrency <number>   Concurrent workers (default: 10)');
    console.log('  --memory-threshold <MB>  Memory warning threshold (default: 500)\n');
    
    const tester = new ContinuousLoadTester(options);
    
    try {
        const report = await tester.start();
        await tester.saveReport();
        
        // Exit based on results
        if (report.successRate >= 95 && !report.memoryLeak) {
            console.log('\n✅ Continuous load test PASSED!');
            process.exit(0);
        } else if (report.memoryLeak) {
            console.log('\n⚠️  Potential memory leak detected!');
            process.exit(1);
        } else {
            console.log('\n❌ Test failed (success rate below 95%)');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n💥 Fatal error:', error);
        process.exit(1);
    }
}

// Handle termination
process.on('SIGINT', async () => {
    console.log('\n⚠️  Test interrupted, cleaning up...');
    process.exit(130);
});

if (require.main === module) {
    main();
}

module.exports = { ContinuousLoadTester };