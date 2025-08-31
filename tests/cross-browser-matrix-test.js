#!/usr/bin/env node

/**
 * Cross-Browser Feature Matrix Test
 * Tests each PlayClone feature across all supported browsers
 * Generates a compatibility matrix showing what works where
 */

const { PlayClone } = require('../dist/index');
const fs = require('fs').promises;
const path = require('path');

// Test configuration
const BROWSERS = ['chromium', 'firefox', 'webkit'];
const TIMEOUT = 20000;

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

// Feature tests
const features = [
    {
        name: 'Basic Navigation',
        category: 'Core',
        test: async (pc) => {
            const result = await pc.navigate('https://example.com');
            return result.success;
        }
    },
    {
        name: 'Get Text (Full Page)',
        category: 'Data Extraction',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            const result = await pc.getText();
            return result.success && result.data && result.data.length > 0;
        }
    },
    {
        name: 'Get Text (Selector)',
        category: 'Data Extraction',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            const result = await pc.getText('h1');
            return result.success && result.data && result.data.includes('Example');
        }
    },
    {
        name: 'Natural Language Click',
        category: 'Interaction',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            const result = await pc.click('more information');
            return result.success;
        }
    },
    {
        name: 'Get Links',
        category: 'Data Extraction',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            const result = await pc.getLinks();
            return result.success && Array.isArray(result.data);
        }
    },
    {
        name: 'Back Navigation',
        category: 'Navigation',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            await pc.click('more information');
            const result = await pc.back();
            return result.success;
        }
    },
    {
        name: 'Forward Navigation',
        category: 'Navigation',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            await pc.click('more information');
            await pc.back();
            const result = await pc.forward();
            return result.success;
        }
    },
    {
        name: 'Page Reload',
        category: 'Navigation',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            const result = await pc.reload();
            return result.success;
        }
    },
    {
        name: 'Screenshot',
        category: 'Data Extraction',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            const result = await pc.screenshot();
            return result.success && result.data && result.data.length > 0;
        }
    },
    {
        name: 'Form Fill',
        category: 'Interaction',
        test: async (pc) => {
            await pc.navigate('https://httpbin.org/forms/post');
            const result = await pc.fill('input[name="custname"]', 'Test User');
            return result.success;
        }
    },
    {
        name: 'Cookie Set',
        category: 'State',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            const result = await pc.setCookie({
                name: 'test',
                value: 'value',
                url: 'https://example.com'
            });
            return result.success;
        }
    },
    {
        name: 'Cookie Get',
        category: 'State',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            await pc.setCookie({
                name: 'test',
                value: 'value',
                url: 'https://example.com'
            });
            const result = await pc.getCookies();
            return result.success && Array.isArray(result.data);
        }
    },
    {
        name: 'State Save',
        category: 'State',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            const result = await pc.saveState('test-state');
            return result.success;
        }
    },
    {
        name: 'State Restore',
        category: 'State',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            await pc.saveState('test-state');
            await pc.navigate('https://google.com');
            const result = await pc.restoreState('test-state');
            return result.success;
        }
    },
    {
        name: 'Response Optimization',
        category: 'Performance',
        test: async (pc) => {
            await pc.navigate('https://example.com');
            const result = await pc.getText();
            const size = JSON.stringify(result).length;
            return result.success && size < 2048; // 2KB limit for responses
        }
    }
];

// Results matrix
const matrix = {};

/**
 * Test a feature on a specific browser
 */
async function testFeature(pc, feature, browser) {
    try {
        const passed = await feature.test(pc);
        
        if (!matrix[feature.name]) {
            matrix[feature.name] = { category: feature.category };
        }
        matrix[feature.name][browser] = passed ? '✅' : '❌';
        
        return passed;
    } catch (error) {
        if (!matrix[feature.name]) {
            matrix[feature.name] = { category: feature.category };
        }
        matrix[feature.name][browser] = '❌';
        return false;
    }
}

/**
 * Test all features on a browser
 */
async function testBrowser(browser) {
    console.log(`\n${colors.cyan}Testing ${browser.toUpperCase()}...${colors.reset}`);
    
    let pc;
    let passed = 0;
    let failed = 0;
    
    try {
        // Try to launch browser
        pc = new PlayClone({
            browser,
            headless: true,
            timeout: TIMEOUT
        });
        
        // Test each feature
        for (const feature of features) {
            process.stdout.write(`  Testing ${feature.name}... `);
            const result = await testFeature(pc, feature, browser);
            
            if (result) {
                passed++;
                console.log(`${colors.green}✓${colors.reset}`);
            } else {
                failed++;
                console.log(`${colors.red}✗${colors.reset}`);
            }
        }
        
    } catch (error) {
        console.log(`  ${colors.red}Browser launch failed: ${error.message}${colors.reset}`);
        // Mark all features as failed for this browser
        for (const feature of features) {
            if (!matrix[feature.name]) {
                matrix[feature.name] = { category: feature.category };
            }
            matrix[feature.name][browser] = '❌';
            failed++;
        }
    } finally {
        if (pc) {
            try {
                await pc.close();
            } catch (e) {
                // Ignore
            }
        }
    }
    
    const total = passed + failed;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(0) : 0;
    
    return { browser, passed, failed, total, passRate };
}

/**
 * Print compatibility matrix
 */
function printMatrix() {
    console.log(`\n${colors.bright}${colors.cyan}COMPATIBILITY MATRIX${colors.reset}`);
    console.log('═'.repeat(70));
    
    // Group by category
    const categories = {};
    for (const [feature, results] of Object.entries(matrix)) {
        const category = results.category;
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push({ name: feature, ...results });
    }
    
    // Print each category
    for (const [category, features] of Object.entries(categories)) {
        console.log(`\n${colors.magenta}${category}:${colors.reset}`);
        console.log('─'.repeat(70));
        
        // Header
        console.log(
            'Feature'.padEnd(30) +
            'Chromium'.padEnd(12) +
            'Firefox'.padEnd(12) +
            'WebKit'.padEnd(12)
        );
        console.log('─'.repeat(70));
        
        // Features
        for (const feature of features) {
            console.log(
                feature.name.padEnd(30) +
                (feature.chromium || '?').padEnd(12) +
                (feature.firefox || '?').padEnd(12) +
                (feature.webkit || '?').padEnd(12)
            );
        }
    }
}

/**
 * Generate compatibility report
 */
async function generateReport(results) {
    const reportPath = path.join(__dirname, 'browser-compatibility-matrix.json');
    
    const report = {
        timestamp: new Date().toISOString(),
        summary: results,
        matrix,
        recommendations: {
            chromium: results.find(r => r.browser === 'chromium')?.passRate >= 80 
                ? 'Fully supported - recommended for production'
                : 'Partially supported - some features may not work',
            firefox: results.find(r => r.browser === 'firefox')?.passRate >= 80
                ? 'Fully supported - recommended for production'
                : 'Partially supported - some features may not work',
            webkit: results.find(r => r.browser === 'webkit')?.passRate >= 80
                ? 'Fully supported - recommended for production'
                : 'Limited support - not recommended for production'
        }
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n${colors.green}Report saved to: ${reportPath}${colors.reset}`);
}

/**
 * Main test runner
 */
async function main() {
    console.log(`${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║  PlayClone Cross-Browser Compatibility Matrix     ║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════╝${colors.reset}`);
    
    const results = [];
    
    // Test each browser
    for (const browser of BROWSERS) {
        const result = await testBrowser(browser);
        results.push(result);
    }
    
    // Print matrix
    printMatrix();
    
    // Print summary
    console.log(`\n${colors.bright}${colors.cyan}SUMMARY${colors.reset}`);
    console.log('═'.repeat(50));
    
    for (const result of results) {
        const color = result.passRate >= 80 ? colors.green :
                     result.passRate >= 60 ? colors.yellow : colors.red;
        console.log(
            `${result.browser.padEnd(12)}: ${color}${result.passed}/${result.total} passed (${result.passRate}%)${colors.reset}`
        );
    }
    
    // Overall compatibility
    console.log(`\n${colors.cyan}Compatibility Recommendations:${colors.reset}`);
    for (const result of results) {
        let recommendation;
        if (result.passRate >= 80) {
            recommendation = '✅ Production Ready';
        } else if (result.passRate >= 60) {
            recommendation = '⚠️  Use with caution';
        } else {
            recommendation = '❌ Not recommended';
        }
        console.log(`  ${result.browser.padEnd(10)}: ${recommendation}`);
    }
    
    // Save report
    await generateReport(results);
    
    // Calculate overall pass rate
    const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
    const totalTests = results.reduce((sum, r) => sum + r.total, 0);
    const overallRate = ((totalPassed / totalTests) * 100).toFixed(0);
    
    console.log(`\n${colors.bright}Overall Cross-Browser Compatibility: ${overallRate}%${colors.reset}`);
    
    process.exit(overallRate >= 70 ? 0 : 1);
}

if (require.main === module) {
    main().catch(error => {
        console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
        process.exit(1);
    });
}