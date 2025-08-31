#!/usr/bin/env node

/**
 * Performance Regression Test Suite
 * Monitors PlayClone performance metrics across releases
 * Detects performance regressions and generates reports
 */

const { PlayClone } = require('../../dist/index');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

// Performance baselines (in milliseconds)
const BASELINES = {
    browserLaunch: 3000,      // Max time to launch browser
    navigation: 2000,          // Max time to navigate
    elementClick: 500,         // Max time to click element
    textExtraction: 300,       // Max time to extract text
    screenshot: 1000,          // Max time to take screenshot
    formFill: 400,            // Max time to fill form
    stateOps: 500,            // Max time for state operations
    memoryPerOperation: 5,     // Max MB memory increase per operation
    responseSize: 1024         // Max response size in bytes
};

// Tolerance for performance variations (20%)
const TOLERANCE = 0.2;

// Test results
const results = {
    passed: [],
    failed: [],
    warnings: [],
    metrics: {}
};

// Color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

/**
 * Measure execution time of a function
 */
async function measureTime(fn, name) {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    
    results.metrics[name] = {
        duration,
        baseline: BASELINES[name] || 1000,
        withinTolerance: duration <= (BASELINES[name] || 1000) * (1 + TOLERANCE)
    };
    
    return { result, duration };
}

/**
 * Measure memory usage
 */
function measureMemory() {
    if (global.gc) {
        global.gc();
    }
    const usage = process.memoryUsage();
    return {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024),
        rss: Math.round(usage.rss / 1024 / 1024)
    };
}

/**
 * Performance tests
 */
const performanceTests = [
    {
        name: 'Browser Launch Time',
        key: 'browserLaunch',
        test: async () => {
            const { duration } = await measureTime(async () => {
                const pc = new PlayClone({ headless: true });
                await pc.close();
                return true;
            }, 'browserLaunch');
            
            return {
                metric: 'Launch Time',
                value: duration,
                baseline: BASELINES.browserLaunch,
                unit: 'ms'
            };
        }
    },
    {
        name: 'Navigation Speed',
        key: 'navigation',
        test: async (pc) => {
            const { duration } = await measureTime(async () => {
                return await pc.navigate('https://example.com');
            }, 'navigation');
            
            return {
                metric: 'Navigation Time',
                value: duration,
                baseline: BASELINES.navigation,
                unit: 'ms'
            };
        }
    },
    {
        name: 'Element Click Speed',
        key: 'elementClick',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            
            const { duration } = await measureTime(async () => {
                return await pc.click('more information');
            }, 'elementClick');
            
            return {
                metric: 'Click Time',
                value: duration,
                baseline: BASELINES.elementClick,
                unit: 'ms'
            };
        }
    },
    {
        name: 'Text Extraction Speed',
        key: 'textExtraction',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            
            const { result, duration } = await measureTime(async () => {
                return await pc.getText('body');
            }, 'textExtraction');
            
            return {
                metric: 'Text Extraction Time',
                value: duration,
                baseline: BASELINES.textExtraction,
                unit: 'ms'
            };
        }
    },
    {
        name: 'Screenshot Performance',
        key: 'screenshot',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            
            const { duration } = await measureTime(async () => {
                return await pc.screenshot();
            }, 'screenshot');
            
            return {
                metric: 'Screenshot Time',
                value: duration,
                baseline: BASELINES.screenshot,
                unit: 'ms'
            };
        }
    },
    {
        name: 'Form Fill Speed',
        key: 'formFill',
        test: async (pc) => {
            await pc.navigate('https://httpbin.org/forms/post');
            
            const { duration } = await measureTime(async () => {
                return await pc.fill('input[name="custname"]', 'Test User');
            }, 'formFill');
            
            return {
                metric: 'Form Fill Time',
                value: duration,
                baseline: BASELINES.formFill,
                unit: 'ms'
            };
        }
    },
    {
        name: 'State Operations',
        key: 'stateOps',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            
            const { duration } = await measureTime(async () => {
                await pc.saveState('perf-test');
                await pc.navigate('https://google.com');
                return await pc.restoreState('perf-test');
            }, 'stateOps');
            
            return {
                metric: 'State Operation Time',
                value: duration,
                baseline: BASELINES.stateOps,
                unit: 'ms'
            };
        }
    },
    {
        name: 'Response Size Optimization',
        key: 'responseSize',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            const result = await pc.getText('body');
            const size = JSON.stringify(result).length;
            
            return {
                metric: 'Response Size',
                value: size,
                baseline: BASELINES.responseSize,
                unit: 'bytes'
            };
        }
    },
    {
        name: 'Memory Usage Per Operation',
        key: 'memoryPerOperation',
        test: async (pc) => {
            const memStart = measureMemory();
            
            // Perform 10 operations
            for (let i = 0; i < 10; i++) {
                await pc.navigate('https://example.com');
                await pc.getText('body');
                await pc.click('more information');
                await pc.back();
            }
            
            const memEnd = measureMemory();
            const memIncrease = memEnd.heapUsed - memStart.heapUsed;
            const avgIncrease = memIncrease / 10;
            
            return {
                metric: 'Memory/Operation',
                value: avgIncrease,
                baseline: BASELINES.memoryPerOperation,
                unit: 'MB'
            };
        }
    }
];

/**
 * Run performance test
 */
async function runPerformanceTest(test, pc) {
    console.log(`  Testing: ${test.name}...`);
    
    try {
        const result = await test.test(pc);
        const variance = ((result.value - result.baseline) / result.baseline) * 100;
        const withinTolerance = Math.abs(variance) <= (TOLERANCE * 100);
        
        if (withinTolerance) {
            results.passed.push({
                test: test.name,
                ...result,
                variance: variance.toFixed(1)
            });
            
            console.log(
                `    ${colors.green}✓${colors.reset} ${result.metric}: ` +
                `${result.value.toFixed(0)}${result.unit} ` +
                `(baseline: ${result.baseline}${result.unit}, ` +
                `${variance > 0 ? '+' : ''}${variance.toFixed(1)}%)`
            );
        } else if (variance > 0) {
            // Performance regression
            results.failed.push({
                test: test.name,
                ...result,
                variance: variance.toFixed(1),
                regression: true
            });
            
            console.log(
                `    ${colors.red}✗ REGRESSION${colors.reset} ${result.metric}: ` +
                `${result.value.toFixed(0)}${result.unit} ` +
                `(baseline: ${result.baseline}${result.unit}, ` +
                `${colors.red}+${variance.toFixed(1)}%${colors.reset})`
            );
        } else {
            // Performance improvement (but outside tolerance)
            results.warnings.push({
                test: test.name,
                ...result,
                variance: variance.toFixed(1),
                improvement: true
            });
            
            console.log(
                `    ${colors.yellow}⚠ IMPROVEMENT${colors.reset} ${result.metric}: ` +
                `${result.value.toFixed(0)}${result.unit} ` +
                `(baseline: ${result.baseline}${result.unit}, ` +
                `${colors.green}${variance.toFixed(1)}%${colors.reset})`
            );
        }
        
        return withinTolerance;
    } catch (error) {
        results.failed.push({
            test: test.name,
            error: error.message
        });
        
        console.log(
            `    ${colors.red}✗ ERROR${colors.reset}: ${error.message}`
        );
        
        return false;
    }
}

/**
 * Compare with historical data
 */
async function compareWithHistory() {
    const historyFile = path.join(__dirname, 'performance-history.json');
    
    try {
        const historyData = await fs.readFile(historyFile, 'utf-8');
        const history = JSON.parse(historyData);
        
        console.log(`\n${colors.cyan}Historical Comparison:${colors.reset}`);
        console.log('─'.repeat(50));
        
        // Get last 5 runs
        const recent = history.runs.slice(-5);
        
        for (const metric of Object.keys(BASELINES)) {
            const values = recent.map(run => run.metrics[metric]?.duration || 0).filter(v => v > 0);
            if (values.length > 0) {
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                const current = results.metrics[metric]?.duration || 0;
                const change = ((current - avg) / avg) * 100;
                
                console.log(
                    `${metric.padEnd(20)}: ` +
                    `Current: ${current.toFixed(0)}ms, ` +
                    `Avg: ${avg.toFixed(0)}ms ` +
                    `(${change > 0 ? '+' : ''}${change.toFixed(1)}%)`
                );
            }
        }
        
        // Update history
        history.runs.push({
            timestamp: new Date().toISOString(),
            metrics: results.metrics,
            summary: {
                passed: results.passed.length,
                failed: results.failed.length,
                warnings: results.warnings.length
            }
        });
        
        // Keep only last 100 runs
        if (history.runs.length > 100) {
            history.runs = history.runs.slice(-100);
        }
        
        await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
        
    } catch (error) {
        // No history file, create one
        const history = {
            created: new Date().toISOString(),
            runs: [{
                timestamp: new Date().toISOString(),
                metrics: results.metrics,
                summary: {
                    passed: results.passed.length,
                    failed: results.failed.length,
                    warnings: results.warnings.length
                }
            }]
        };
        
        await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
        console.log(`${colors.cyan}Created new performance history file${colors.reset}`);
    }
}

/**
 * Generate performance report
 */
async function generateReport() {
    const reportPath = path.join(__dirname, 'performance-regression-report.json');
    
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            total: performanceTests.length,
            passed: results.passed.length,
            failed: results.failed.length,
            warnings: results.warnings.length,
            passRate: ((results.passed.length / performanceTests.length) * 100).toFixed(1)
        },
        baselines: BASELINES,
        tolerance: `${TOLERANCE * 100}%`,
        results: {
            passed: results.passed,
            failed: results.failed,
            warnings: results.warnings
        },
        metrics: results.metrics,
        recommendations: []
    };
    
    // Add recommendations
    if (results.failed.length > 0) {
        report.recommendations.push('⚠️ Performance regressions detected - investigate before release');
        
        for (const failure of results.failed) {
            if (failure.regression) {
                report.recommendations.push(
                    `- ${failure.test}: ${failure.variance}% slower than baseline`
                );
            }
        }
    }
    
    if (results.warnings.length > 0) {
        report.recommendations.push('ℹ️ Significant performance improvements detected - consider updating baselines');
    }
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n${colors.green}Report saved to: ${reportPath}${colors.reset}`);
    
    return report;
}

/**
 * Main test runner
 */
async function main() {
    console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║    PlayClone Performance Regression Tests      ║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════╝${colors.reset}`);
    
    console.log(`\n${colors.cyan}Performance Baselines:${colors.reset}`);
    console.log('─'.repeat(50));
    for (const [key, value] of Object.entries(BASELINES)) {
        const unit = key === 'responseSize' ? 'bytes' : key === 'memoryPerOperation' ? 'MB' : 'ms';
        console.log(`${key.padEnd(20)}: ${value}${unit} (±${TOLERANCE * 100}%)`);
    }
    
    let pc;
    
    try {
        console.log(`\n${colors.cyan}Running Performance Tests:${colors.reset}`);
        console.log('─'.repeat(50));
        
        // Launch browser once for most tests
        pc = new PlayClone({ headless: true });
        
        // Run performance tests
        for (const test of performanceTests) {
            // Browser launch test needs special handling
            if (test.key === 'browserLaunch') {
                await runPerformanceTest(test, null);
            } else {
                await runPerformanceTest(test, pc);
            }
        }
        
    } catch (error) {
        console.error(`${colors.red}Test failed: ${error.message}${colors.reset}`);
    } finally {
        if (pc) {
            await pc.close();
        }
    }
    
    // Compare with history
    await compareWithHistory();
    
    // Generate report
    const report = await generateReport();
    
    // Summary
    console.log(`\n${colors.bright}${colors.cyan}SUMMARY${colors.reset}`);
    console.log('═'.repeat(50));
    
    const passRate = parseFloat(report.summary.passRate);
    const statusColor = passRate >= 90 ? colors.green :
                       passRate >= 70 ? colors.yellow : colors.red;
    
    console.log(`Total Tests: ${report.summary.total}`);
    console.log(`${colors.green}Passed: ${report.summary.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${report.summary.failed}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${report.summary.warnings}${colors.reset}`);
    console.log(`${statusColor}Pass Rate: ${report.summary.passRate}%${colors.reset}`);
    
    if (report.recommendations.length > 0) {
        console.log(`\n${colors.cyan}Recommendations:${colors.reset}`);
        for (const rec of report.recommendations) {
            console.log(rec);
        }
    }
    
    // Exit code based on regressions
    const hasRegressions = results.failed.some(f => f.regression);
    process.exit(hasRegressions ? 1 : 0);
}

if (require.main === module) {
    main().catch(error => {
        console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
        process.exit(1);
    });
}

module.exports = { performanceTests, BASELINES };