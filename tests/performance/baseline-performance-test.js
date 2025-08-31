#!/usr/bin/env node

/**
 * Baseline Performance Test
 * Establishes performance baselines for PlayClone operations
 * Run this to update performance expectations
 */

const { PlayClone } = require('../../dist/index');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

// Number of iterations for each test
const ITERATIONS = 5;

// Results storage
const baselines = {};
const measurements = {};

// Color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m'
};

/**
 * Run a test multiple times and calculate statistics
 */
async function measureOperation(name, operation, iterations = ITERATIONS) {
    const times = [];
    
    console.log(`  Measuring ${name}...`);
    
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await operation();
        const duration = performance.now() - start;
        times.push(duration);
        process.stdout.write('.');
    }
    
    // Calculate statistics
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
    
    // Use 95th percentile as baseline (allowing for some variance)
    const p95Index = Math.floor(times.length * 0.95);
    const p95 = times.sort((a, b) => a - b)[p95Index] || max;
    
    measurements[name] = {
        avg: Math.round(avg),
        min: Math.round(min),
        max: Math.round(max),
        median: Math.round(median),
        p95: Math.round(p95),
        samples: iterations
    };
    
    // Set baseline as p95 + 20% buffer
    baselines[name] = Math.round(p95 * 1.2);
    
    console.log(` ${colors.green}✓${colors.reset}`);
    console.log(`    Average: ${Math.round(avg)}ms, Min: ${Math.round(min)}ms, Max: ${Math.round(max)}ms`);
    console.log(`    Median: ${Math.round(median)}ms, P95: ${Math.round(p95)}ms`);
    console.log(`    ${colors.cyan}Baseline: ${baselines[name]}ms${colors.reset}`);
    
    return baselines[name];
}

/**
 * Main baseline establishment
 */
async function main() {
    console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║   Establishing PlayClone Performance Baselines  ║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════╝${colors.reset}`);
    
    console.log(`\n${colors.yellow}Running ${ITERATIONS} iterations per test...${colors.reset}\n`);
    
    let pc;
    
    try {
        // Test browser launch
        console.log(`${colors.cyan}Browser Operations:${colors.reset}`);
        await measureOperation('browserLaunch', async () => {
            const browser = new PlayClone({ headless: true });
            await browser.close();
        });
        
        // Create persistent browser for other tests
        pc = new PlayClone({ headless: true });
        
        // Test navigation
        console.log(`\n${colors.cyan}Navigation Operations:${colors.reset}`);
        await measureOperation('navigation', async () => {
            await pc.navigate('https://example.com');
        });
        
        await measureOperation('navigationBack', async () => {
            await pc.navigate('https://example.com');
            await pc.click('more information');
            await pc.back();
        });
        
        await measureOperation('reload', async () => {
            await pc.reload();
        });
        
        // Test interactions
        console.log(`\n${colors.cyan}Interaction Operations:${colors.reset}`);
        await pc.navigate('https://example.com');
        
        await measureOperation('elementClick', async () => {
            await pc.navigate('https://example.com');
            await pc.click('more information');
        });
        
        await measureOperation('formFill', async () => {
            await pc.navigate('https://httpbin.org/forms/post');
            await pc.fill('input[name="custname"]', 'Test User');
        });
        
        // Test data extraction
        console.log(`\n${colors.cyan}Data Extraction Operations:${colors.reset}`);
        await pc.navigate('https://example.com');
        
        await measureOperation('textExtraction', async () => {
            await pc.getText('body');
        });
        
        await measureOperation('getLinks', async () => {
            await pc.getLinks();
        });
        
        await measureOperation('screenshot', async () => {
            await pc.screenshot();
        });
        
        // Test state operations
        console.log(`\n${colors.cyan}State Management Operations:${colors.reset}`);
        
        await measureOperation('stateOps', async () => {
            await pc.navigate('https://example.com');
            await pc.saveState('baseline-test');
            await pc.navigate('https://google.com');
            await pc.restoreState('baseline-test');
        });
        
        await measureOperation('cookieOps', async () => {
            await pc.setCookie({
                name: 'test',
                value: 'value',
                url: 'https://example.com'
            });
            await pc.getCookies();
            await pc.clearCookies();
        });
        
        // Test response size
        console.log(`\n${colors.cyan}Response Optimization:${colors.reset}`);
        await pc.navigate('https://example.com');
        const textResult = await pc.getText('body');
        const responseSize = JSON.stringify(textResult).length;
        baselines['responseSize'] = 2048; // 2KB limit
        console.log(`  Response size: ${responseSize} bytes`);
        console.log(`  ${colors.cyan}Baseline: ${baselines['responseSize']} bytes${colors.reset}`);
        
        // Memory baseline
        console.log(`\n${colors.cyan}Memory Usage:${colors.reset}`);
        const memUsage = process.memoryUsage();
        const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        baselines['memoryPerOperation'] = 10; // 10MB per operation max
        console.log(`  Current heap: ${heapMB}MB`);
        console.log(`  ${colors.cyan}Baseline: ${baselines['memoryPerOperation']}MB per operation${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    } finally {
        if (pc) {
            await pc.close();
        }
    }
    
    // Save baselines
    const baselineFile = path.join(__dirname, 'performance-baselines.json');
    const baselineData = {
        created: new Date().toISOString(),
        iterations: ITERATIONS,
        baselines,
        measurements,
        environment: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            cpus: require('os').cpus().length,
            memory: Math.round(require('os').totalmem() / 1024 / 1024 / 1024) + 'GB'
        }
    };
    
    await fs.writeFile(baselineFile, JSON.stringify(baselineData, null, 2));
    
    // Also update the regression test baselines
    const regressionTestPath = path.join(__dirname, 'performance-regression-test.js');
    const regressionContent = await fs.readFile(regressionTestPath, 'utf-8');
    
    // Create updated baselines object
    const updatedBaselines = `const BASELINES = {
    browserLaunch: ${baselines.browserLaunch || 3000},      // Max time to launch browser
    navigation: ${baselines.navigation || 2000},          // Max time to navigate
    elementClick: ${baselines.elementClick || 500},         // Max time to click element
    textExtraction: ${baselines.textExtraction || 300},       // Max time to extract text
    screenshot: ${baselines.screenshot || 1000},          // Max time to take screenshot
    formFill: ${baselines.formFill || 400},            // Max time to fill form
    stateOps: ${baselines.stateOps || 500},            // Max time for state operations
    memoryPerOperation: ${baselines.memoryPerOperation || 5},     // Max MB memory increase per operation
    responseSize: ${baselines.responseSize || 1024}         // Max response size in bytes
};`;
    
    // Summary
    console.log(`\n${colors.bright}${colors.cyan}BASELINES ESTABLISHED${colors.reset}`);
    console.log('═'.repeat(50));
    
    console.log(`\n${colors.green}✓ Baselines saved to: ${baselineFile}${colors.reset}`);
    console.log(`\n${colors.cyan}Key Performance Baselines:${colors.reset}`);
    
    for (const [key, value] of Object.entries(baselines)) {
        const unit = key === 'responseSize' ? 'bytes' : 
                    key === 'memoryPerOperation' ? 'MB' : 'ms';
        console.log(`  ${key.padEnd(20)}: ${value}${unit}`);
    }
    
    console.log(`\n${colors.yellow}Note: Run 'npm run perf:regression' to test against these baselines${colors.reset}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
        process.exit(1);
    });
}