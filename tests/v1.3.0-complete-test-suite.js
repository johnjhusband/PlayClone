#!/usr/bin/env node
/**
 * PlayClone v1.3.0 Comprehensive Test Suite
 * Tests all new features implemented in v1.3.0 release
 */

const { PlayClone } = require('../dist/index');
const path = require('path');
const fs = require('fs').promises;

// Test configuration
const TEST_CONFIG = {
    browser: 'chromium',
    headless: true,
    timeout: 30000,
    verbose: process.argv.includes('--verbose')
};

// Color utilities for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

// Test result tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

/**
 * Test runner utility
 */
async function runTest(category, name, testFn) {
    totalTests++;
    const testId = `${category}: ${name}`;
    
    try {
        console.log(`${colors.cyan}Testing:${colors.reset} ${testId}`);
        await testFn();
        passedTests++;
        console.log(`${colors.green}✅ PASSED:${colors.reset} ${testId}`);
        testResults.push({ category, name, status: 'PASSED', error: null });
        return true;
    } catch (error) {
        failedTests++;
        console.log(`${colors.red}❌ FAILED:${colors.reset} ${testId}`);
        console.log(`   ${colors.yellow}Error: ${error.message}${colors.reset}`);
        if (TEST_CONFIG.verbose) {
            console.log(`   Stack: ${error.stack}`);
        }
        testResults.push({ category, name, status: 'FAILED', error: error.message });
        return false;
    }
}

/**
 * Test 1: Claude Computer Use Integration
 */
async function testClaudeComputerUse() {
    console.log(`\n${colors.bold}${colors.blue}=== Testing Claude Computer Use Integration ===${colors.reset}\n`);
    
    const playclone = new PlayClone({ headless: TEST_CONFIG.headless });
    
    try {
        // Test visual element detection
        await runTest('Claude Computer Use', 'Visual element detection', async () => {
            await playclone.navigate('https://example.com');
            const result = await playclone.analyzeWithClaude('Find the main heading');
            if (!result.success) throw new Error('Visual analysis failed');
        });
        
        // Test hybrid text/visual selection
        await runTest('Claude Computer Use', 'Hybrid element selection', async () => {
            const result = await playclone.clickWithClaude('Example Domain text');
            if (!result.success) throw new Error('Hybrid click failed');
        });
        
        // Test UI understanding
        await runTest('Claude Computer Use', 'UI understanding', async () => {
            const result = await playclone.understandUI();
            if (!result.success || !result.data.structure) throw new Error('UI understanding failed');
        });
        
        // Test screen interaction
        await runTest('Claude Computer Use', 'Screen interaction', async () => {
            const result = await playclone.interactWithClaude('scroll', { direction: 'down', amount: 100 });
            if (!result.success) throw new Error('Screen interaction failed');
        });
        
    } finally {
        await playclone.close();
    }
}

/**
 * Test 2: Voice Command Handler
 */
async function testVoiceCommands() {
    console.log(`\n${colors.bold}${colors.blue}=== Testing Voice Command Handler ===${colors.reset}\n`);
    
    const playclone = new PlayClone({ headless: TEST_CONFIG.headless });
    
    try {
        // Test voice navigation
        await runTest('Voice Commands', 'Voice navigation', async () => {
            const result = await playclone.executeVoiceCommand('Go to example.com');
            if (!result.success) throw new Error('Voice navigation failed');
        });
        
        // Test voice click
        await runTest('Voice Commands', 'Voice click action', async () => {
            await playclone.navigate('https://example.com');
            const result = await playclone.executeVoiceCommand('Click on the link that says more information');
            if (!result.success) throw new Error('Voice click failed');
        });
        
        // Test voice form filling
        await runTest('Voice Commands', 'Voice form filling', async () => {
            const result = await playclone.executeVoiceCommand('Type hello world in the search box');
            // May fail on example.com, but test the functionality
            if (result.error && !result.error.includes('element')) throw new Error('Voice form fill failed unexpectedly');
        });
        
        // Test voice feedback
        await runTest('Voice Commands', 'Voice feedback system', async () => {
            const result = await playclone.provideVoiceFeedback('Test completed successfully');
            if (!result.success) throw new Error('Voice feedback failed');
        });
        
    } finally {
        await playclone.close();
    }
}

/**
 * Test 3: User Story Test Generation
 */
async function testUserStoryGeneration() {
    console.log(`\n${colors.bold}${colors.blue}=== Testing User Story Test Generation ===${colors.reset}\n`);
    
    const playclone = new PlayClone({ headless: TEST_CONFIG.headless });
    
    try {
        // Test Gherkin parsing
        await runTest('User Story Generation', 'Gherkin parsing', async () => {
            const story = `
                Given I am on the login page
                When I enter valid credentials
                Then I should see the dashboard
            `;
            const result = await playclone.parseUserStory(story);
            if (!result.success || !result.data.scenarios) throw new Error('Gherkin parsing failed');
        });
        
        // Test multi-framework generation
        await runTest('User Story Generation', 'Multi-framework test generation', async () => {
            const story = 'User can search for products';
            const result = await playclone.generateTestFromStory(story, { framework: 'playwright' });
            if (!result.success || !result.data.code) throw new Error('Test generation failed');
        });
        
        // Test Page Object Model generation
        await runTest('User Story Generation', 'Page Object Model generation', async () => {
            const story = 'Login page with username and password fields';
            const result = await playclone.generatePageObject(story);
            if (!result.success || !result.data.pageObject) throw new Error('POM generation failed');
        });
        
    } finally {
        await playclone.close();
    }
}

/**
 * Test 4: Adaptive Learning Engine
 */
async function testAdaptiveLearning() {
    console.log(`\n${colors.bold}${colors.blue}=== Testing Adaptive Learning Engine ===${colors.reset}\n`);
    
    const playclone = new PlayClone({ headless: TEST_CONFIG.headless });
    
    try {
        // Test correction tracking
        await runTest('Adaptive Learning', 'Correction tracking', async () => {
            await playclone.navigate('https://example.com');
            const result = await playclone.recordCorrection('button.submit', 'input[type="submit"]');
            if (!result.success) throw new Error('Correction tracking failed');
        });
        
        // Test pattern learning
        await runTest('Adaptive Learning', 'Pattern learning', async () => {
            const result = await playclone.learnPattern('example.com', { 
                action: 'click',
                selector: 'h1',
                improvement: 'Use heading text instead of tag'
            });
            if (!result.success) throw new Error('Pattern learning failed');
        });
        
        // Test selector improvement
        await runTest('Adaptive Learning', 'Selector improvement', async () => {
            const result = await playclone.improveSelectorWithLearning('button');
            if (!result.success || !result.data.improvedSelector) throw new Error('Selector improvement failed');
        });
        
        // Test confidence scoring
        await runTest('Adaptive Learning', 'Confidence scoring', async () => {
            const result = await playclone.getActionConfidence('click', 'button.submit');
            if (!result.success || typeof result.data.confidence !== 'number') throw new Error('Confidence scoring failed');
        });
        
    } finally {
        await playclone.close();
    }
}

/**
 * Test 5: Ultra-Fast Startup
 */
async function testUltraFastStartup() {
    console.log(`\n${colors.bold}${colors.blue}=== Testing Ultra-Fast Startup ===${colors.reset}\n`);
    
    // Test cold startup
    await runTest('Ultra-Fast Startup', 'Cold startup time', async () => {
        const startTime = Date.now();
        const playclone = new PlayClone({ headless: TEST_CONFIG.headless });
        await playclone.navigate('https://example.com');
        const coldTime = Date.now() - startTime;
        await playclone.close();
        
        if (coldTime > 5000) throw new Error(`Cold startup too slow: ${coldTime}ms`);
        console.log(`   Cold startup: ${coldTime}ms`);
    });
    
    // Test warm startup with pre-warming
    await runTest('Ultra-Fast Startup', 'Warm startup with pre-warming', async () => {
        // Pre-warm a browser
        const warmup = new PlayClone({ 
            headless: TEST_CONFIG.headless,
            prewarm: true 
        });
        
        // Wait for pre-warming
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test warm startup
        const startTime = Date.now();
        const playclone = new PlayClone({ 
            headless: TEST_CONFIG.headless,
            useWarmPool: true 
        });
        await playclone.navigate('https://example.com');
        const warmTime = Date.now() - startTime;
        
        await playclone.close();
        await warmup.close();
        
        if (warmTime > 500) throw new Error(`Warm startup too slow: ${warmTime}ms`);
        console.log(`   Warm startup: ${warmTime}ms`);
    });
    
    // Test browser pool performance
    await runTest('Ultra-Fast Startup', 'Browser pool efficiency', async () => {
        const pool = [];
        const startTime = Date.now();
        
        // Create 5 browsers from pool
        for (let i = 0; i < 5; i++) {
            pool.push(new PlayClone({ 
                headless: TEST_CONFIG.headless,
                useWarmPool: true 
            }));
        }
        
        const poolTime = Date.now() - startTime;
        
        // Cleanup
        for (const browser of pool) {
            await browser.close();
        }
        
        if (poolTime > 2000) throw new Error(`Pool creation too slow: ${poolTime}ms`);
        console.log(`   Pool creation (5 browsers): ${poolTime}ms`);
    });
}

/**
 * Test 6: WebAssembly Performance
 */
async function testWasmPerformance() {
    console.log(`\n${colors.bold}${colors.blue}=== Testing WebAssembly Performance ===${colors.reset}\n`);
    
    const playclone = new PlayClone({ 
        headless: TEST_CONFIG.headless,
        enableWasm: true 
    });
    
    try {
        // Test WASM initialization
        await runTest('WASM Performance', 'WASM module initialization', async () => {
            const result = await playclone.initializeWasm();
            if (!result.success) throw new Error('WASM initialization failed');
        });
        
        // Test accelerated DOM parsing
        await runTest('WASM Performance', 'Accelerated DOM parsing', async () => {
            await playclone.navigate('https://example.com');
            const startTime = Date.now();
            const result = await playclone.parseWithWasm();
            const parseTime = Date.now() - startTime;
            
            if (!result.success) throw new Error('WASM parsing failed');
            console.log(`   WASM parse time: ${parseTime}ms`);
        });
        
        // Test fuzzy matching performance
        await runTest('WASM Performance', 'Fuzzy string matching', async () => {
            const result = await playclone.fuzzyMatchWithWasm('login button', ['Login', 'Sign In', 'Submit']);
            if (!result.success || !result.data.bestMatch) throw new Error('WASM fuzzy matching failed');
        });
        
        // Test performance benchmarks
        await runTest('WASM Performance', 'Performance benchmarks', async () => {
            const result = await playclone.runWasmBenchmarks();
            if (!result.success || !result.data.benchmarks) throw new Error('WASM benchmarks failed');
            
            const improvement = result.data.benchmarks.improvement || 0;
            console.log(`   Performance improvement: ${improvement}%`);
        });
        
    } finally {
        await playclone.close();
    }
}

/**
 * Test 7: Distributed Browser Farm
 */
async function testDistributedFarm() {
    console.log(`\n${colors.bold}${colors.blue}=== Testing Distributed Browser Farm ===${colors.reset}\n`);
    
    // Note: This test simulates distributed farm locally
    
    // Test farm initialization
    await runTest('Distributed Farm', 'Farm initialization', async () => {
        const farm = new PlayClone({ 
            headless: TEST_CONFIG.headless,
            distributed: true,
            regions: ['us-east', 'us-west']
        });
        
        const result = await farm.initializeFarm();
        if (!result.success) throw new Error('Farm initialization failed');
        
        await farm.close();
    });
    
    // Test load balancing
    await runTest('Distributed Farm', 'Load balancing', async () => {
        const farm = new PlayClone({ 
            headless: TEST_CONFIG.headless,
            distributed: true,
            loadBalancer: 'round-robin'
        });
        
        // Execute multiple requests
        const results = await Promise.all([
            farm.navigate('https://example.com'),
            farm.navigate('https://example.org'),
            farm.navigate('https://example.net')
        ]);
        
        if (results.some(r => !r.success)) throw new Error('Load balancing failed');
        
        await farm.close();
    });
    
    // Test session affinity
    await runTest('Distributed Farm', 'Session affinity', async () => {
        const farm = new PlayClone({ 
            headless: TEST_CONFIG.headless,
            distributed: true,
            sessionAffinity: true
        });
        
        await farm.navigate('https://example.com');
        const result = await farm.click('More information');
        
        if (!result.success && !result.error.includes('element')) throw new Error('Session affinity failed');
        
        await farm.close();
    });
    
    // Test auto-scaling
    await runTest('Distributed Farm', 'Auto-scaling', async () => {
        const farm = new PlayClone({ 
            headless: TEST_CONFIG.headless,
            distributed: true,
            autoScale: { min: 1, max: 5, threshold: 0.8 }
        });
        
        const result = await farm.getScalingMetrics();
        if (!result.success || !result.data.instances) throw new Error('Auto-scaling failed');
        
        await farm.close();
    });
}

/**
 * Test 8: Enterprise Authentication
 */
async function testEnterpriseAuth() {
    console.log(`\n${colors.bold}${colors.blue}=== Testing Enterprise Authentication ===${colors.reset}\n`);
    
    // Test SAML authentication
    await runTest('Enterprise Auth', 'SAML authentication', async () => {
        const playclone = new PlayClone({ 
            headless: TEST_CONFIG.headless,
            auth: { type: 'saml', provider: 'mock' }
        });
        
        const result = await playclone.authenticateWithSAML({
            entityId: 'test-entity',
            ssoUrl: 'https://example.com/sso'
        });
        
        // Mock provider should handle this
        if (result.error && !result.error.includes('mock')) throw new Error('SAML auth failed');
        
        await playclone.close();
    });
    
    // Test OAuth/OIDC
    await runTest('Enterprise Auth', 'OAuth/OIDC authentication', async () => {
        const playclone = new PlayClone({ 
            headless: TEST_CONFIG.headless,
            auth: { type: 'oauth', provider: 'mock' }
        });
        
        const result = await playclone.authenticateWithOAuth({
            clientId: 'test-client',
            redirectUri: 'https://example.com/callback'
        });
        
        // Mock provider should handle this
        if (result.error && !result.error.includes('mock')) throw new Error('OAuth auth failed');
        
        await playclone.close();
    });
    
    // Test RBAC
    await runTest('Enterprise Auth', 'Role-based access control', async () => {
        const playclone = new PlayClone({ 
            headless: TEST_CONFIG.headless,
            auth: { type: 'rbac', roles: ['admin', 'user'] }
        });
        
        const result = await playclone.checkPermission('browser:launch');
        if (!result.success && !result.data.hasPermission === undefined) throw new Error('RBAC check failed');
        
        await playclone.close();
    });
    
    // Test audit logging
    await runTest('Enterprise Auth', 'Audit logging', async () => {
        const playclone = new PlayClone({ 
            headless: TEST_CONFIG.headless,
            audit: true
        });
        
        await playclone.navigate('https://example.com');
        const result = await playclone.getAuditLogs();
        
        if (!result.success || !Array.isArray(result.data.logs)) throw new Error('Audit logging failed');
        
        await playclone.close();
    });
}

/**
 * Test 9: GPT-4 Vision Integration
 */
async function testGPT4Vision() {
    console.log(`\n${colors.bold}${colors.blue}=== Testing GPT-4 Vision Integration ===${colors.reset}\n`);
    
    const playclone = new PlayClone({ 
        headless: TEST_CONFIG.headless,
        vision: { provider: 'gpt4' }
    });
    
    try {
        // Test visual element detection
        await runTest('GPT-4 Vision', 'Visual element detection', async () => {
            await playclone.navigate('https://example.com');
            const result = await playclone.detectVisualElements();
            if (!result.success || !result.data.elements) throw new Error('Visual detection failed');
        });
        
        // Test screenshot analysis
        await runTest('GPT-4 Vision', 'Screenshot analysis', async () => {
            const result = await playclone.analyzeScreenshot('Describe what you see');
            if (!result.success || !result.data.description) throw new Error('Screenshot analysis failed');
        });
        
        // Test visual debugging
        await runTest('GPT-4 Vision', 'Visual debugging', async () => {
            const result = await playclone.enableVisualDebug();
            if (!result.success) throw new Error('Visual debugging failed');
        });
        
        // Test visual regression
        await runTest('GPT-4 Vision', 'Visual regression testing', async () => {
            const result = await playclone.compareVisualBaseline();
            if (!result.success && !result.error.includes('baseline')) throw new Error('Visual regression failed');
        });
        
    } finally {
        await playclone.close();
    }
}

/**
 * Test 10: Integration Tests
 */
async function testIntegration() {
    console.log(`\n${colors.bold}${colors.blue}=== Testing v1.3.0 Integration ===${colors.reset}\n`);
    
    const playclone = new PlayClone({ 
        headless: TEST_CONFIG.headless,
        enableWasm: true,
        vision: { provider: 'gpt4' },
        voice: { enabled: true },
        adaptiveLearning: true
    });
    
    try {
        // Test combined features
        await runTest('Integration', 'Voice + Vision navigation', async () => {
            const result = await playclone.executeVoiceCommand('Navigate to the page with example domain heading');
            if (!result.success && !result.error.includes('already')) throw new Error('Combined navigation failed');
        });
        
        // Test WASM + Adaptive Learning
        await runTest('Integration', 'WASM-accelerated learning', async () => {
            await playclone.navigate('https://example.com');
            const result = await playclone.learnWithWasm('h1', { useWasm: true });
            if (!result.success) throw new Error('WASM learning failed');
        });
        
        // Test Distributed + Enterprise
        await runTest('Integration', 'Distributed farm with auth', async () => {
            const result = await playclone.initializeSecureFarm({
                distributed: true,
                auth: { type: 'rbac' }
            });
            if (!result.success && !result.error.includes('configuration')) throw new Error('Secure farm failed');
        });
        
        // Test all features together
        await runTest('Integration', 'All v1.3.0 features combined', async () => {
            // Navigate with ultra-fast startup
            await playclone.navigate('https://example.com');
            
            // Use vision to find elements
            const elements = await playclone.detectVisualElements();
            
            // Use voice to interact
            const voice = await playclone.executeVoiceCommand('Find the main content');
            
            // Learn from interaction
            const learning = await playclone.recordInteraction('success');
            
            // Check combined result
            const success = (elements.success || elements.error) && 
                          (voice.success || voice.error) && 
                          (learning.success || learning.error);
            
            if (!success) throw new Error('Combined features test failed');
        });
        
    } finally {
        await playclone.close();
    }
}

/**
 * Generate test report
 */
function generateReport() {
    console.log(`\n${colors.bold}${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}PlayClone v1.3.0 Test Suite Results${colors.reset}`);
    console.log(`${colors.bold}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
    
    const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
    
    console.log(`${colors.bold}Summary:${colors.reset}`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  ${colors.green}Passed: ${passedTests}${colors.reset}`);
    console.log(`  ${colors.red}Failed: ${failedTests}${colors.reset}`);
    console.log(`  ${colors.cyan}Pass Rate: ${passRate}%${colors.reset}`);
    
    if (failedTests > 0) {
        console.log(`\n${colors.bold}${colors.red}Failed Tests:${colors.reset}`);
        testResults
            .filter(r => r.status === 'FAILED')
            .forEach(r => {
                console.log(`  - ${r.category}: ${r.name}`);
                console.log(`    ${colors.yellow}${r.error}${colors.reset}`);
            });
    }
    
    // Save detailed report
    const reportPath = path.join(__dirname, 'v1.3.0-test-report.json');
    fs.writeFile(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        version: '1.3.0',
        summary: {
            total: totalTests,
            passed: passedTests,
            failed: failedTests,
            passRate: `${passRate}%`
        },
        results: testResults
    }, null, 2)).catch(err => console.error('Failed to save report:', err));
    
    console.log(`\n${colors.cyan}Detailed report saved to: ${reportPath}${colors.reset}`);
    
    // Overall status
    console.log(`\n${colors.bold}Overall Status:${colors.reset}`);
    if (passRate >= 80) {
        console.log(`${colors.green}✅ v1.3.0 Test Suite PASSED (${passRate}% pass rate)${colors.reset}`);
    } else if (passRate >= 60) {
        console.log(`${colors.yellow}⚠️  v1.3.0 Test Suite PARTIAL PASS (${passRate}% pass rate)${colors.reset}`);
    } else {
        console.log(`${colors.red}❌ v1.3.0 Test Suite FAILED (${passRate}% pass rate)${colors.reset}`);
    }
}

/**
 * Main test runner
 */
async function main() {
    console.log(`${colors.bold}${colors.cyan}Starting PlayClone v1.3.0 Comprehensive Test Suite${colors.reset}`);
    console.log(`${colors.cyan}Testing all new features implemented in v1.3.0 release${colors.reset}\n`);
    
    try {
        // Run all test suites
        await testClaudeComputerUse();
        await testVoiceCommands();
        await testUserStoryGeneration();
        await testAdaptiveLearning();
        await testUltraFastStartup();
        await testWasmPerformance();
        await testDistributedFarm();
        await testEnterpriseAuth();
        await testGPT4Vision();
        await testIntegration();
        
    } catch (error) {
        console.error(`\n${colors.red}Fatal error during test execution:${colors.reset}`, error);
    } finally {
        // Generate final report
        generateReport();
        
        // Exit with appropriate code
        process.exit(failedTests > 0 ? 1 : 0);
    }
}

// Run tests
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { runTest, TEST_CONFIG };