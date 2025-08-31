#!/usr/bin/env node

/**
 * Quick Cross-Browser Compatibility Test
 * Fast verification that PlayClone works on all supported browsers
 */

const { PlayClone } = require('../dist/index');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

async function testBrowser(browserType) {
    console.log(`\n${colors.cyan}Testing ${browserType}...${colors.reset}`);
    
    let pc;
    const results = [];
    
    try {
        // 1. Launch browser
        console.log('  1. Launching browser...');
        pc = new PlayClone({
            browser: browserType,
            headless: true,
            timeout: 15000
        });
        results.push({ test: 'Launch', passed: true });
        console.log(`     ${colors.green}✓ Browser launched${colors.reset}`);
        
        // 2. Navigate to example.com
        console.log('  2. Testing navigation...');
        const navResult = await pc.navigate('https://example.com');
        if (navResult.success) {
            results.push({ test: 'Navigation', passed: true });
            console.log(`     ${colors.green}✓ Navigation successful${colors.reset}`);
        } else {
            results.push({ test: 'Navigation', passed: false, error: navResult.error });
            console.log(`     ${colors.red}✗ Navigation failed: ${navResult.error}${colors.reset}`);
        }
        
        // 3. Get page text
        console.log('  3. Testing text extraction...');
        const textResult = await pc.getText('body');
        if (textResult.success && textResult.data.includes('Example Domain')) {
            results.push({ test: 'Text extraction', passed: true });
            console.log(`     ${colors.green}✓ Text extraction successful${colors.reset}`);
        } else {
            results.push({ test: 'Text extraction', passed: false });
            console.log(`     ${colors.red}✗ Text extraction failed${colors.reset}`);
        }
        
        // 4. Click a link
        console.log('  4. Testing click action...');
        const clickResult = await pc.click('more information');
        if (clickResult.success) {
            results.push({ test: 'Click', passed: true });
            console.log(`     ${colors.green}✓ Click successful${colors.reset}`);
        } else {
            results.push({ test: 'Click', passed: false });
            console.log(`     ${colors.red}✗ Click failed${colors.reset}`);
        }
        
        // 5. Navigate back
        console.log('  5. Testing back navigation...');
        const backResult = await pc.back();
        if (backResult.success) {
            results.push({ test: 'Back navigation', passed: true });
            console.log(`     ${colors.green}✓ Back navigation successful${colors.reset}`);
        } else {
            results.push({ test: 'Back navigation', passed: false });
            console.log(`     ${colors.red}✗ Back navigation failed${colors.reset}`);
        }
        
        // 6. Take screenshot
        console.log('  6. Testing screenshot...');
        const screenshotResult = await pc.screenshot();
        if (screenshotResult.success && screenshotResult.data) {
            results.push({ test: 'Screenshot', passed: true });
            console.log(`     ${colors.green}✓ Screenshot captured${colors.reset}`);
        } else {
            results.push({ test: 'Screenshot', passed: false });
            console.log(`     ${colors.red}✗ Screenshot failed${colors.reset}`);
        }
        
    } catch (error) {
        console.log(`  ${colors.red}✗ Browser test failed: ${error.message}${colors.reset}`);
        results.push({ test: 'Overall', passed: false, error: error.message });
    } finally {
        if (pc) {
            try {
                await pc.close();
                console.log(`  ${colors.cyan}Browser closed${colors.reset}`);
            } catch (e) {
                // Ignore close errors
            }
        }
    }
    
    // Calculate pass rate
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const passRate = ((passed / total) * 100).toFixed(0);
    
    return {
        browser: browserType,
        passed,
        total,
        passRate,
        results
    };
}

async function main() {
    console.log(`${colors.cyan}═══════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}  PlayClone Cross-Browser Quick Test${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════════${colors.reset}`);
    
    const browsers = ['chromium', 'firefox', 'webkit'];
    const allResults = [];
    
    for (const browser of browsers) {
        try {
            const result = await testBrowser(browser);
            allResults.push(result);
        } catch (error) {
            console.log(`${colors.red}Failed to test ${browser}: ${error.message}${colors.reset}`);
            allResults.push({
                browser,
                passed: 0,
                total: 1,
                passRate: '0',
                results: [{ test: 'Overall', passed: false, error: error.message }]
            });
        }
    }
    
    // Print summary
    console.log(`\n${colors.cyan}═══════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}  SUMMARY${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════════${colors.reset}`);
    
    for (const result of allResults) {
        const color = result.passRate >= 80 ? colors.green : 
                     result.passRate >= 60 ? colors.yellow : colors.red;
        console.log(
            `  ${result.browser.padEnd(10)}: ${color}${result.passed}/${result.total} tests passed (${result.passRate}%)${colors.reset}`
        );
    }
    
    // Overall results
    const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
    const totalTests = allResults.reduce((sum, r) => sum + r.total, 0);
    const overallRate = ((totalPassed / totalTests) * 100).toFixed(0);
    
    console.log('───────────────────────────────────────────────');
    const overallColor = overallRate >= 80 ? colors.green :
                         overallRate >= 60 ? colors.yellow : colors.red;
    console.log(
        `  Overall: ${overallColor}${totalPassed}/${totalTests} tests passed (${overallRate}%)${colors.reset}`
    );
    
    // Compatibility status
    console.log(`\n${colors.cyan}Compatibility Status:${colors.reset}`);
    for (const result of allResults) {
        if (result.passRate >= 80) {
            console.log(`  ✅ ${result.browser}: Fully compatible`);
        } else if (result.passRate >= 60) {
            console.log(`  ⚠️  ${result.browser}: Partially compatible`);
        } else {
            console.log(`  ❌ ${result.browser}: Not compatible`);
        }
    }
    
    process.exit(overallRate >= 80 ? 0 : 1);
}

if (require.main === module) {
    main().catch(error => {
        console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
        process.exit(1);
    });
}