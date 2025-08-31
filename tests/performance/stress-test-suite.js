#!/usr/bin/env node

/**
 * PlayClone Stress Testing Suite
 * Tests system behavior under extreme load with 100+ concurrent operations
 */

const { PlayClone } = require('../../dist/index');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

// Test configuration
const CONFIG = {
    // Concurrency levels to test
    concurrencyLevels: [10, 25, 50, 75, 100, 150],
    
    // Operations per level
    operationsPerLevel: 10,
    
    // Test URLs (using lightweight pages)
    testUrls: [
        'https://example.com',
        'https://httpbin.org/html',
        'https://www.google.com/404',
        'https://duckduckgo.com',
        'https://www.w3.org/'
    ],
    
    // Timeout for individual operations
    operationTimeout: 30000,
    
    // Results output directory
    resultsDir: path.join(__dirname, 'stress-test-results'),
    
    // Resource monitoring interval
    monitoringInterval: 1000,
    
    // Maximum allowed memory (MB)
    maxMemoryMB: 2048,
    
    // Maximum allowed CPU usage (%)
    maxCpuPercent: 90
};

// Performance metrics collector
class MetricsCollector {
    constructor() {
        this.metrics = {
            startTime: Date.now(),
            operations: [],
            resourceUsage: [],
            errors: [],
            summary: {}
        };
        this.monitoring = false;
    }

    startMonitoring() {
        this.monitoring = true;
        this.monitorResources();
    }

    stopMonitoring() {
        this.monitoring = false;
    }

    async monitorResources() {
        while (this.monitoring) {
            const usage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            
            this.metrics.resourceUsage.push({
                timestamp: Date.now(),
                memory: {
                    rss: Math.round(usage.rss / 1024 / 1024),
                    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
                    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
                    external: Math.round(usage.external / 1024 / 1024)
                },
                cpu: cpuUsage,
                loadAvg: os.loadavg()
            });

            await new Promise(resolve => setTimeout(resolve, CONFIG.monitoringInterval));
        }
    }

    recordOperation(operation) {
        this.metrics.operations.push(operation);
    }

    recordError(error) {
        this.metrics.errors.push({
            timestamp: Date.now(),
            message: error.message,
            stack: error.stack,
            type: error.constructor.name
        });
    }

    generateSummary() {
        const operations = this.metrics.operations;
        const successful = operations.filter(op => op.status === 'success');
        const failed = operations.filter(op => op.status === 'failed');
        
        const durations = successful.map(op => op.duration);
        durations.sort((a, b) => a - b);
        
        const memoryUsage = this.metrics.resourceUsage.map(r => r.memory.heapUsed);
        const peakMemory = Math.max(...memoryUsage);
        const avgMemory = memoryUsage.reduce((a, b) => a + b, 0) / memoryUsage.length;
        
        this.metrics.summary = {
            totalOperations: operations.length,
            successful: successful.length,
            failed: failed.length,
            successRate: (successful.length / operations.length * 100).toFixed(2) + '%',
            timing: {
                min: Math.min(...durations),
                max: Math.max(...durations),
                avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
                median: durations[Math.floor(durations.length / 2)],
                p95: durations[Math.floor(durations.length * 0.95)],
                p99: durations[Math.floor(durations.length * 0.99)]
            },
            memory: {
                peak: peakMemory,
                average: Math.round(avgMemory),
                final: memoryUsage[memoryUsage.length - 1]
            },
            duration: Date.now() - this.metrics.startTime,
            errors: this.metrics.errors.length
        };
        
        return this.metrics.summary;
    }

    async saveResults(filename) {
        await fs.mkdir(CONFIG.resultsDir, { recursive: true });
        const filepath = path.join(CONFIG.resultsDir, filename);
        await fs.writeFile(filepath, JSON.stringify(this.metrics, null, 2));
        console.log(`Results saved to: ${filepath}`);
    }
}

// Stress test operations
class StressTestOperations {
    constructor(browser) {
        this.browser = browser;
    }

    async navigation(url) {
        const start = Date.now();
        try {
            const result = await this.browser.navigate(url);
            return {
                type: 'navigation',
                url,
                status: result.success ? 'success' : 'failed',
                duration: Date.now() - start,
                error: result.error
            };
        } catch (error) {
            return {
                type: 'navigation',
                url,
                status: 'failed',
                duration: Date.now() - start,
                error: error.message
            };
        }
    }

    async textExtraction(selector = 'body') {
        const start = Date.now();
        try {
            const result = await this.browser.getText(selector);
            return {
                type: 'textExtraction',
                selector,
                status: result.success ? 'success' : 'failed',
                duration: Date.now() - start,
                dataSize: result.data?.length || 0,
                error: result.error
            };
        } catch (error) {
            return {
                type: 'textExtraction',
                selector,
                status: 'failed',
                duration: Date.now() - start,
                error: error.message
            };
        }
    }

    async screenshot() {
        const start = Date.now();
        try {
            const result = await this.browser.screenshot();
            return {
                type: 'screenshot',
                status: result.success ? 'success' : 'failed',
                duration: Date.now() - start,
                dataSize: result.data?.length || 0,
                error: result.error
            };
        } catch (error) {
            return {
                type: 'screenshot',
                status: 'failed',
                duration: Date.now() - start,
                error: error.message
            };
        }
    }

    async linkExtraction() {
        const start = Date.now();
        try {
            const result = await this.browser.getLinks();
            return {
                type: 'linkExtraction',
                status: result.success ? 'success' : 'failed',
                duration: Date.now() - start,
                linkCount: result.data?.length || 0,
                error: result.error
            };
        } catch (error) {
            return {
                type: 'linkExtraction',
                status: 'failed',
                duration: Date.now() - start,
                error: error.message
            };
        }
    }

    async complexOperation() {
        const start = Date.now();
        const operations = [];
        
        try {
            // Navigate
            const navResult = await this.browser.navigate(CONFIG.testUrls[0]);
            operations.push({ type: 'nav', success: navResult.success });
            
            // Extract text
            const textResult = await this.browser.getText('body');
            operations.push({ type: 'text', success: textResult.success });
            
            // Get links
            const linksResult = await this.browser.getLinks();
            operations.push({ type: 'links', success: linksResult.success });
            
            // Take screenshot
            const screenshotResult = await this.browser.screenshot();
            operations.push({ type: 'screenshot', success: screenshotResult.success });
            
            const allSuccess = operations.every(op => op.success);
            
            return {
                type: 'complexOperation',
                status: allSuccess ? 'success' : 'partial',
                duration: Date.now() - start,
                operations,
                error: allSuccess ? null : 'Some operations failed'
            };
        } catch (error) {
            return {
                type: 'complexOperation',
                status: 'failed',
                duration: Date.now() - start,
                operations,
                error: error.message
            };
        }
    }
}

// Main stress test runner
class StressTestRunner {
    constructor() {
        this.browsers = [];
        this.metrics = new MetricsCollector();
    }

    async runConcurrentTest(concurrency, operationCount) {
        console.log(`\n🔥 Starting stress test: ${concurrency} concurrent browsers, ${operationCount} operations each`);
        
        const promises = [];
        const startTime = Date.now();
        
        // Create browser instances
        for (let i = 0; i < concurrency; i++) {
            promises.push(this.runBrowserOperations(i, operationCount));
        }
        
        // Wait for all operations with timeout
        const results = await Promise.allSettled(promises);
        
        const duration = Date.now() - startTime;
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        console.log(`✅ Completed: ${successful}/${concurrency} browsers successful`);
        console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
        console.log(`📊 Operations/sec: ${((concurrency * operationCount) / (duration / 1000)).toFixed(2)}`);
        
        if (failed > 0) {
            console.log(`❌ Failed: ${failed} browsers encountered errors`);
        }
        
        return {
            concurrency,
            operationCount,
            duration,
            successful,
            failed,
            operationsPerSecond: (concurrency * operationCount) / (duration / 1000)
        };
    }

    async runBrowserOperations(browserId, operationCount) {
        let browser = null;
        
        try {
            // Create browser with timeout
            browser = await this.createBrowserWithTimeout();
            this.browsers.push(browser);
            
            const ops = new StressTestOperations(browser);
            const operations = [];
            
            // Run mixed operations
            for (let i = 0; i < operationCount; i++) {
                const operationType = i % 5;
                let result;
                
                switch (operationType) {
                    case 0:
                        const url = CONFIG.testUrls[i % CONFIG.testUrls.length];
                        result = await ops.navigation(url);
                        break;
                    case 1:
                        result = await ops.textExtraction();
                        break;
                    case 2:
                        result = await ops.screenshot();
                        break;
                    case 3:
                        result = await ops.linkExtraction();
                        break;
                    case 4:
                        result = await ops.complexOperation();
                        break;
                }
                
                result.browserId = browserId;
                result.operationId = i;
                operations.push(result);
                this.metrics.recordOperation(result);
            }
            
            return operations;
            
        } catch (error) {
            this.metrics.recordError(error);
            throw error;
        } finally {
            // Clean up browser
            if (browser) {
                try {
                    await browser.close();
                } catch (e) {
                    console.error(`Failed to close browser ${browserId}:`, e.message);
                }
                const index = this.browsers.indexOf(browser);
                if (index > -1) {
                    this.browsers.splice(index, 1);
                }
            }
        }
    }

    async createBrowserWithTimeout(timeout = 10000) {
        return new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Browser creation timeout'));
            }, timeout);
            
            try {
                const browser = new PlayClone({
                    headless: true,
                    viewport: { width: 1280, height: 720 },
                    timeout: CONFIG.operationTimeout
                });
                clearTimeout(timer);
                resolve(browser);
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    async runFullSuite() {
        console.log('🚀 PlayClone Stress Testing Suite');
        console.log('==================================');
        console.log(`System: ${os.cpus().length} CPUs, ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB RAM`);
        console.log(`Node: ${process.version}`);
        console.log(`Platform: ${os.platform()} ${os.arch()}`);
        
        this.metrics.startMonitoring();
        const testResults = [];
        
        for (const concurrency of CONFIG.concurrencyLevels) {
            try {
                // Check resource limits before starting
                const memUsage = process.memoryUsage();
                const currentMemMB = memUsage.rss / 1024 / 1024;
                
                if (currentMemMB > CONFIG.maxMemoryMB) {
                    console.warn(`⚠️  Memory limit exceeded (${currentMemMB}MB > ${CONFIG.maxMemoryMB}MB), stopping tests`);
                    break;
                }
                
                const result = await this.runConcurrentTest(concurrency, CONFIG.operationsPerLevel);
                testResults.push(result);
                
                // Cool down period between tests
                console.log('⏸️  Cooling down for 5 seconds...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                    console.log('🗑️  Garbage collection triggered');
                }
                
            } catch (error) {
                console.error(`❌ Test failed at ${concurrency} concurrency:`, error.message);
                this.metrics.recordError(error);
                break;
            }
        }
        
        this.metrics.stopMonitoring();
        
        // Generate and display summary
        const summary = this.metrics.generateSummary();
        
        console.log('\n📊 STRESS TEST SUMMARY');
        console.log('======================');
        console.log(`Total Operations: ${summary.totalOperations}`);
        console.log(`Success Rate: ${summary.successRate}`);
        console.log(`Total Duration: ${(summary.duration / 1000).toFixed(2)}s`);
        console.log('\nTiming Statistics (ms):');
        console.log(`  Min: ${summary.timing.min}ms`);
        console.log(`  Avg: ${summary.timing.avg}ms`);
        console.log(`  Median: ${summary.timing.median}ms`);
        console.log(`  P95: ${summary.timing.p95}ms`);
        console.log(`  P99: ${summary.timing.p99}ms`);
        console.log(`  Max: ${summary.timing.max}ms`);
        console.log('\nMemory Usage (MB):');
        console.log(`  Peak: ${summary.memory.peak}MB`);
        console.log(`  Average: ${summary.memory.average}MB`);
        console.log(`  Final: ${summary.memory.final}MB`);
        console.log(`\nErrors: ${summary.errors}`);
        
        // Save detailed results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await this.metrics.saveResults(`stress-test-${timestamp}.json`);
        
        // Clean up any remaining browsers
        await this.cleanup();
        
        return summary;
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
        this.browsers = [];
    }
}

// Utility functions
function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let value = bytes;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    
    return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
}

// Main execution
async function main() {
    const runner = new StressTestRunner();
    
    try {
        const summary = await runner.runFullSuite();
        
        // Exit with appropriate code
        if (summary.successRate === '100.00%') {
            console.log('\n✅ All stress tests passed successfully!');
            process.exit(0);
        } else if (parseFloat(summary.successRate) >= 95) {
            console.log('\n⚠️  Stress tests passed with warnings (>95% success rate)');
            process.exit(0);
        } else {
            console.log('\n❌ Stress tests failed (success rate below 95%)');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n💥 Fatal error during stress testing:', error);
        await runner.cleanup();
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n⚠️  Received SIGINT, cleaning up...');
    process.exit(130);
});

process.on('SIGTERM', async () => {
    console.log('\n⚠️  Received SIGTERM, cleaning up...');
    process.exit(143);
});

// Run with optional GC flag support
if (require.main === module) {
    console.log('💡 Tip: Run with --expose-gc flag for better memory management:');
    console.log('   node --expose-gc stress-test-suite.js\n');
    main();
}

module.exports = { StressTestRunner, MetricsCollector, StressTestOperations };