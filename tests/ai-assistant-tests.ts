#!/usr/bin/env ts-node

/**
 * AI Assistant Integration Tests for PlayClone
 * 
 * These tests verify PlayClone works effectively for AI assistant use cases
 * as specified in Phase 15 requirements:
 * 
 * 1. Search Engine Interaction (DuckDuckGo, Google, Bing)
 * 2. Documentation Sites (MDN)
 * 3. GitHub Repository Analysis
 * 4. Stack Overflow Integration
 * 5. NPM Package Lookup
 * 6. Error Recovery
 * 7. State Management
 * 8. Performance
 */

import { PlayClone } from '../dist/index.js';

// Test configuration
const TEST_CONFIG = {
    headless: true,
    timeout: 10000,
    maxRetries: 2
};

// Test results tracking
interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    error?: string;
    responseSize?: number;
}

const results: TestResult[] = [];

/**
 * Helper function to run a test with timing and error handling
 */
async function runTest(
    name: string, 
    testFn: () => Promise<void>
): Promise<void> {
    const startTime = Date.now();
    console.log(`\n🧪 Test: ${name}`);
    console.log('─'.repeat(50));
    
    try {
        await testFn();
        const duration = Date.now() - startTime;
        results.push({ name, passed: true, duration });
        console.log(`✅ PASSED in ${duration}ms`);
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ name, passed: false, duration, error: errorMsg });
        console.log(`❌ FAILED in ${duration}ms`);
        console.log(`   Error: ${errorMsg}`);
    }
}

/**
 * Test 1: Search Engine Interaction - DuckDuckGo
 */
async function testDuckDuckGoSearch(): Promise<void> {
    const pc = new PlayClone({ ...TEST_CONFIG });
    
    try {
        // Navigate to DuckDuckGo
        const navResult = await pc.navigate('https://duckduckgo.com');
        if (!navResult.success) throw new Error('Failed to navigate to DuckDuckGo');
        
        // Fill search box using natural language
        const fillResult = await pc.fill('search box', 'TypeScript browser automation');
        if (!fillResult.success) throw new Error('Failed to fill search box');
        
        // Press Enter to search
        const pressResult = await pc.press('Enter');
        if (!pressResult.success) throw new Error('Failed to press Enter');
        
        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Extract search results - getText returns ExtractedData directly
        const textResult = await pc.getText();
        if (!textResult.data) {
            throw new Error('Failed to extract search results');
        }
        
        // Verify we got results
        const extractedText = textResult.data.text || textResult.data || '';
        if (!extractedText.toLowerCase().includes('typescript')) {
            throw new Error('Search results do not contain expected content');
        }
        
        console.log(`   📊 Response size: ${JSON.stringify(textResult).length} bytes`);
        console.log(`   ✓ Search completed successfully`);
        console.log(`   ✓ Results contain "TypeScript"`);
        
    } finally {
        await pc.close();
    }
}

/**
 * Test 2: Search Engine Interaction - Google
 */
async function testGoogleSearch(): Promise<void> {
    const pc = new PlayClone({ ...TEST_CONFIG });
    
    try {
        // Navigate to Google
        const navResult = await pc.navigate('https://google.com');
        if (!navResult.success) throw new Error('Failed to navigate to Google');
        
        // Fill search using natural language
        const fillResult = await pc.fill('search', 'Playwright vs Puppeteer');
        if (!fillResult.success) throw new Error('Failed to fill Google search');
        
        // Submit search
        const pressResult = await pc.press('Enter');
        if (!pressResult.success) throw new Error('Failed to submit search');
        
        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get page text - getText returns ExtractedData
        const textResult = await pc.getText();
        if (!textResult.data) throw new Error('Failed to get search results');
        
        console.log(`   ✓ Google search completed`);
        console.log(`   📊 Response size: ${JSON.stringify(textResult).length} bytes`);
        
    } finally {
        await pc.close();
    }
}

/**
 * Test 3: Documentation Sites - MDN
 */
async function testMDNDocumentation(): Promise<void> {
    const pc = new PlayClone({ ...TEST_CONFIG });
    
    try {
        // Navigate to MDN
        const navResult = await pc.navigate('https://developer.mozilla.org');
        if (!navResult.success) throw new Error('Failed to navigate to MDN');
        
        // Search for Array documentation
        const fillResult = await pc.fill('search', 'JavaScript Array');
        if (!fillResult.success) {
            // Try alternative selector
            const altFill = await pc.fill('Search MDN', 'JavaScript Array');
            if (!altFill.success) throw new Error('Failed to search MDN');
        }
        
        // Press Enter
        await pc.press('Enter');
        
        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extract documentation - getText returns ExtractedData
        const textResult = await pc.getText();
        if (!textResult.data) throw new Error('Failed to extract documentation');
        
        console.log(`   ✓ MDN documentation accessed`);
        console.log(`   📊 Response size: ${JSON.stringify(textResult).length} bytes`);
        
    } finally {
        await pc.close();
    }
}

/**
 * Test 4: GitHub Repository Analysis
 */
async function testGitHubAnalysis(): Promise<void> {
    const pc = new PlayClone({ ...TEST_CONFIG });
    
    try {
        // Navigate to a popular repository
        const navResult = await pc.navigate('https://github.com/microsoft/playwright');
        if (!navResult.success) throw new Error('Failed to navigate to GitHub');
        
        // Wait for page load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Extract repository information - getText returns ExtractedData
        const textResult = await pc.getText();
        if (!textResult.data) throw new Error('Failed to extract repo info');
        
        // Get all links - getLinks returns ExtractedData
        const linksResult = await pc.getLinks();
        if (!linksResult.data) throw new Error('Failed to get links');
        
        // Verify we got repository data
        const text = (typeof textResult.data === 'string' ? textResult.data : textResult.data.text) || '';
        if (!text.includes('playwright')) {
            throw new Error('Repository data not found');
        }
        
        console.log(`   ✓ GitHub repository analyzed`);
        const linkCount = Array.isArray(linksResult.data) ? linksResult.data.length : 0;
        console.log(`   ✓ Found ${linkCount} links`);
        console.log(`   📊 Response size: ${JSON.stringify(textResult).length} bytes`);
        
    } finally {
        await pc.close();
    }
}

/**
 * Test 5: Stack Overflow Integration
 */
async function testStackOverflow(): Promise<void> {
    const pc = new PlayClone({ ...TEST_CONFIG });
    
    try {
        // Navigate to Stack Overflow
        const navResult = await pc.navigate('https://stackoverflow.com');
        if (!navResult.success) throw new Error('Failed to navigate to Stack Overflow');
        
        // Search for a topic
        const fillResult = await pc.fill('search', 'typescript async await');
        if (!fillResult.success) {
            // Try clicking search first
            await pc.click('search');
            const retryFill = await pc.fill('search', 'typescript async await');
            if (!retryFill.success) throw new Error('Failed to search Stack Overflow');
        }
        
        // Submit search
        await pc.press('Enter');
        
        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extract Q&A data - getText returns ExtractedData
        const textResult = await pc.getText();
        if (!textResult.data) throw new Error('Failed to extract Q&A');
        
        console.log(`   ✓ Stack Overflow search completed`);
        console.log(`   📊 Response size: ${JSON.stringify(textResult).length} bytes`);
        
    } finally {
        await pc.close();
    }
}

/**
 * Test 6: NPM Package Lookup
 */
async function testNPMPackage(): Promise<void> {
    const pc = new PlayClone({ ...TEST_CONFIG });
    
    try {
        // Navigate to NPM
        const navResult = await pc.navigate('https://www.npmjs.com');
        if (!navResult.success) throw new Error('Failed to navigate to NPM');
        
        // Search for a package
        const fillResult = await pc.fill('search', 'express');
        if (!fillResult.success) throw new Error('Failed to search NPM');
        
        // Submit search
        await pc.press('Enter');
        
        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extract package data - getText returns ExtractedData
        const textResult = await pc.getText();
        if (!textResult.data) throw new Error('Failed to extract package info');
        
        // Get links for package pages - getLinks returns ExtractedData
        const linksResult = await pc.getLinks();
        const linkCount = linksResult.data && Array.isArray(linksResult.data) ? linksResult.data.length : 0;
        
        console.log(`   ✓ NPM package search completed`);
        console.log(`   ✓ Found ${linkCount} package links`);
        console.log(`   📊 Response size: ${JSON.stringify(textResult).length} bytes`);
        
    } finally {
        await pc.close();
    }
}

/**
 * Test 7: Error Recovery
 */
async function testErrorRecovery(): Promise<void> {
    const pc = new PlayClone({ ...TEST_CONFIG });
    
    try {
        // Try to navigate to invalid URL
        const badNav = await pc.navigate('https://this-definitely-does-not-exist-12345.com');
        if (badNav.success) throw new Error('Should have failed on invalid URL');
        
        // Recover by navigating to valid URL
        const goodNav = await pc.navigate('https://example.com');
        if (!goodNav.success) throw new Error('Failed to recover from error');
        
        // Try to click non-existent element
        const badClick = await pc.click('this element does not exist');
        if (badClick.success) throw new Error('Should have failed on non-existent element');
        
        // Verify browser still works - getText returns ExtractedData
        const text = await pc.getText();
        if (!text.data) throw new Error('Browser not functioning after errors');
        
        console.log(`   ✓ Error recovery successful`);
        console.log(`   ✓ Browser remains functional after failures`);
        
    } finally {
        await pc.close();
    }
}

/**
 * Test 8: State Management
 */
async function testStateManagement(): Promise<void> {
    const pc = new PlayClone({ ...TEST_CONFIG });
    
    try {
        // Navigate to first page
        await pc.navigate('https://example.com');
        
        // Save state
        const saveResult = await pc.saveState('test-checkpoint');
        if (!saveResult.success) throw new Error('Failed to save state');
        
        // Navigate elsewhere
        await pc.navigate('https://github.com');
        
        // Restore state
        const restoreResult = await pc.restoreState('test-checkpoint');
        if (!restoreResult.success) throw new Error('Failed to restore state');
        
        // Verify we're back at original page - getCurrentState returns ActionResult
        const state = await pc.getCurrentState();
        if (!state.success || !state.value?.url?.includes('example.com')) {
            throw new Error('State not properly restored');
        }
        
        console.log(`   ✓ State saved and restored successfully`);
        console.log(`   ✓ URL restored to: ${state.value?.url || 'unknown'}`);
        
    } finally {
        await pc.close();
    }
}

/**
 * Test 9: Performance - Quick Operations
 */
async function testPerformance(): Promise<void> {
    const pc = new PlayClone({ ...TEST_CONFIG });
    const startTime = Date.now();
    
    try {
        // Test startup time
        const initTime = Date.now() - startTime;
        console.log(`   ⏱️ Browser init: ${initTime}ms`);
        
        // Navigation performance
        const navStart = Date.now();
        await pc.navigate('https://example.com');
        const navTime = Date.now() - navStart;
        console.log(`   ⏱️ Navigation: ${navTime}ms`);
        
        // Click performance
        const clickStart = Date.now();
        await pc.click('More information');
        const clickTime = Date.now() - clickStart;
        console.log(`   ⏱️ Click action: ${clickTime}ms`);
        
        // Data extraction performance
        const extractStart = Date.now();
        await pc.getText();
        const extractTime = Date.now() - extractStart;
        console.log(`   ⏱️ Text extraction: ${extractTime}ms`);
        
        const totalTime = Date.now() - startTime;
        if (totalTime > 60000) {
            throw new Error(`Performance too slow: ${totalTime}ms`);
        }
        
        console.log(`   ✓ Total time: ${totalTime}ms (< 60s target)`);
        
    } finally {
        await pc.close();
    }
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
    console.log('🚀 PlayClone AI Assistant Integration Tests');
    console.log('=' .repeat(60));
    console.log('📋 Testing 8 critical AI use cases...\n');
    
    // Run all tests
    await runTest('1. DuckDuckGo Search', testDuckDuckGoSearch);
    await runTest('2. Google Search', testGoogleSearch);
    await runTest('3. MDN Documentation', testMDNDocumentation);
    await runTest('4. GitHub Repository Analysis', testGitHubAnalysis);
    await runTest('5. Stack Overflow Q&A', testStackOverflow);
    await runTest('6. NPM Package Lookup', testNPMPackage);
    await runTest('7. Error Recovery', testErrorRecovery);
    await runTest('8. State Management', testStateManagement);
    await runTest('9. Performance Benchmarks', testPerformance);
    
    // Print summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Test Summary');
    console.log('=' .repeat(60));
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
    const avgTime = Math.round(totalTime / results.length);
    
    console.log(`✅ Passed: ${passed}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);
    console.log(`📈 Success Rate: ${Math.round(passed / results.length * 100)}%`);
    console.log(`⏱️ Total Time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`⏱️ Average Time: ${avgTime}ms per test`);
    
    // List failed tests
    if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`   - ${r.name}: ${r.error}`);
        });
    }
    
    // Performance analysis
    console.log('\n📈 Performance Analysis:');
    if (avgTime < 5000) {
        console.log('   ✅ Excellent: Tests complete quickly');
    } else if (avgTime < 10000) {
        console.log('   ⚠️ Good: Tests complete in reasonable time');
    } else {
        console.log('   ❌ Needs improvement: Tests taking too long');
    }
    
    // Exit code
    process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});