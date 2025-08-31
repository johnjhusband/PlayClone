/**
 * Performance Benchmarks for PlayClone
 * 
 * This suite measures performance metrics for PlayClone operations:
 * - Browser launch time
 * - Page navigation speed
 * - Element selection performance
 * - Action execution time
 * - Data extraction speed
 * - Memory usage
 * - Response size optimization
 */

import { PlayClone } from '../dist/index';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

interface BenchmarkResult {
    operation: string;
    averageTime: number;
    minTime: number;
    maxTime: number;
    iterations: number;
    memoryUsed: number;
    responseSize: number;
    tokenEstimate: number;
}

class PerformanceBenchmark {
    private results: BenchmarkResult[] = [];
    private pc: PlayClone | null = null;

    /**
     * Run all benchmarks
     */
    async runAll(): Promise<void> {
        console.log('🚀 Starting PlayClone Performance Benchmarks\n');
        console.log('=' .repeat(60));
        
        try {
            // Browser lifecycle benchmarks
            await this.benchmarkBrowserLaunch();
            await this.benchmarkBrowserClose();
            
            // Navigation benchmarks
            await this.benchmarkNavigation();
            await this.benchmarkMultipleNavigations();
            
            // Element selection benchmarks
            await this.benchmarkElementSelection();
            await this.benchmarkNaturalLanguageSelection();
            
            // Action benchmarks
            await this.benchmarkClickAction();
            await this.benchmarkFormFilling();
            await this.benchmarkKeyboardInput();
            
            // Data extraction benchmarks
            await this.benchmarkTextExtraction();
            await this.benchmarkTableExtraction();
            await this.benchmarkDataExtraction();
            
            // State management benchmarks
            await this.benchmarkStateSaving();
            await this.benchmarkStateRestoration();
            
            // Response optimization benchmarks
            await this.benchmarkResponseSize();
            await this.benchmarkTokenOptimization();
            
            // Generate report
            this.generateReport();
            
        } catch (error) {
            console.error('Benchmark failed:', error);
        } finally {
            if (this.pc) {
                await this.pc.close();
            }
        }
    }

    /**
     * Benchmark browser launch time
     */
    async benchmarkBrowserLaunch(): Promise<void> {
        console.log('\n📊 Benchmarking: Browser Launch');
        const iterations = 5;
        const times: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            const pc = new PlayClone({ headless: true });
            await pc.navigate('about:blank');
            const end = performance.now();
            times.push(end - start);
            await pc.close();
            
            // Brief pause between iterations
            await this.sleep(100);
        }
        
        this.recordResult('Browser Launch', times, 0, 0);
    }

    /**
     * Benchmark browser close time
     */
    async benchmarkBrowserClose(): Promise<void> {
        console.log('📊 Benchmarking: Browser Close');
        const iterations = 5;
        const times: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
            const pc = new PlayClone({ headless: true });
            await pc.navigate('about:blank');
            
            const start = performance.now();
            await pc.close();
            const end = performance.now();
            times.push(end - start);
            
            await this.sleep(100);
        }
        
        this.recordResult('Browser Close', times, 0, 0);
    }

    /**
     * Benchmark page navigation
     */
    async benchmarkNavigation(): Promise<void> {
        console.log('📊 Benchmarking: Page Navigation');
        this.pc = new PlayClone({ headless: true });
        const iterations = 10;
        const times: number[] = [];
        const responseSizes: number[] = [];
        
        const urls = [
            'https://example.com',
            'https://httpbin.org',
            'https://www.google.com',
            'https://github.com',
            'https://jsonplaceholder.typicode.com'
        ];
        
        for (let i = 0; i < iterations; i++) {
            const url = urls[i % urls.length];
            const start = performance.now();
            const result = await this.pc.navigate(url);
            const end = performance.now();
            
            times.push(end - start);
            if (result.success) {
                const responseSize = JSON.stringify(result).length;
                responseSizes.push(responseSize);
            }
            
            await this.sleep(500);
        }
        
        const avgResponseSize = responseSizes.reduce((a, b) => a + b, 0) / responseSizes.length;
        this.recordResult('Page Navigation', times, avgResponseSize, this.estimateTokens(avgResponseSize));
    }

    /**
     * Benchmark multiple concurrent navigations
     */
    async benchmarkMultipleNavigations(): Promise<void> {
        console.log('📊 Benchmarking: Concurrent Navigation');
        const urls = [
            'https://example.com',
            'https://httpbin.org/html',
            'https://jsonplaceholder.typicode.com'
        ];
        
        const start = performance.now();
        const promises = urls.map(async url => {
            const pc = new PlayClone({ headless: true });
            await pc.navigate(url);
            await pc.close();
        });
        
        await Promise.all(promises);
        const end = performance.now();
        
        this.recordResult('Concurrent Navigation (3 pages)', [end - start], 0, 0);
    }

    /**
     * Benchmark element selection by various methods
     */
    async benchmarkElementSelection(): Promise<void> {
        console.log('📊 Benchmarking: Element Selection');
        if (!this.pc) {
            this.pc = new PlayClone({ headless: true });
        }
        
        await this.pc.navigate('https://example.com');
        const iterations = 20;
        const times: number[] = [];
        
        const selectors = [
            'h1',
            'main heading',
            'first paragraph',
            'link with "More"',
            'text containing "domain"'
        ];
        
        for (let i = 0; i < iterations; i++) {
            const selector = selectors[i % selectors.length];
            const start = performance.now();
            await this.pc.getText(selector);
            const end = performance.now();
            times.push(end - start);
        }
        
        this.recordResult('Element Selection', times, 0, 0);
    }

    /**
     * Benchmark natural language element selection
     */
    async benchmarkNaturalLanguageSelection(): Promise<void> {
        console.log('📊 Benchmarking: Natural Language Selection');
        if (!this.pc) {
            this.pc = new PlayClone({ headless: true });
        }
        
        await this.pc.navigate('https://github.com');
        const iterations = 10;
        const times: number[] = [];
        
        const descriptions = [
            'search button',
            'sign in link',
            'main navigation menu',
            'footer links',
            'logo image'
        ];
        
        for (let i = 0; i < iterations; i++) {
            const description = descriptions[i % descriptions.length];
            const start = performance.now();
            await this.pc.elementExists(description);
            const end = performance.now();
            times.push(end - start);
        }
        
        this.recordResult('Natural Language Selection', times, 0, 0);
    }

    /**
     * Benchmark click actions
     */
    async benchmarkClickAction(): Promise<void> {
        console.log('📊 Benchmarking: Click Actions');
        if (!this.pc) {
            this.pc = new PlayClone({ headless: true });
        }
        
        const iterations = 5;
        const times: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
            await this.pc.navigate('https://example.com');
            const start = performance.now();
            await this.pc.click('More information link');
            const end = performance.now();
            times.push(end - start);
            await this.pc.back();
        }
        
        this.recordResult('Click Action', times, 0, 0);
    }

    /**
     * Benchmark form filling
     */
    async benchmarkFormFilling(): Promise<void> {
        console.log('📊 Benchmarking: Form Filling');
        if (!this.pc) {
            this.pc = new PlayClone({ headless: true });
        }
        
        await this.pc.navigate('https://httpbin.org/forms/post');
        const iterations = 5;
        const times: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await this.pc.fill('customer name field', `User ${i}`);
            await this.pc.fill('telephone field', '555-0100');
            await this.pc.fill('email field', `user${i}@example.com`);
            await this.pc.select('pizza size dropdown', 'medium');
            await this.pc.check('bacon topping');
            await this.pc.check('cheese topping');
            const end = performance.now();
            times.push(end - start);
            
            // Reset form
            await this.pc.reload();
        }
        
        this.recordResult('Form Filling (6 fields)', times, 0, 0);
    }

    /**
     * Benchmark keyboard input
     */
    async benchmarkKeyboardInput(): Promise<void> {
        console.log('📊 Benchmarking: Keyboard Input');
        if (!this.pc) {
            this.pc = new PlayClone({ headless: true });
        }
        
        await this.pc.navigate('https://httpbin.org/forms/post');
        const iterations = 10;
        const times: number[] = [];
        
        const testText = 'The quick brown fox jumps over the lazy dog';
        
        for (let i = 0; i < iterations; i++) {
            await this.pc.click('comments field');
            const start = performance.now();
            await this.pc.type(testText);
            const end = performance.now();
            times.push(end - start);
            
            // Clear field
            await this.pc.press('Control+A');
            await this.pc.press('Delete');
        }
        
        this.recordResult(`Keyboard Input (${testText.length} chars)`, times, 0, 0);
    }

    /**
     * Benchmark text extraction
     */
    async benchmarkTextExtraction(): Promise<void> {
        console.log('📊 Benchmarking: Text Extraction');
        if (!this.pc) {
            this.pc = new PlayClone({ headless: true });
        }
        
        await this.pc.navigate('https://en.wikipedia.org/wiki/Web_scraping');
        const iterations = 10;
        const times: number[] = [];
        const responseSizes: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            const result = await this.pc.getText('main content');
            const end = performance.now();
            times.push(end - start);
            
            if (result.success) {
                responseSizes.push(JSON.stringify(result).length);
            }
        }
        
        const avgResponseSize = responseSizes.reduce((a, b) => a + b, 0) / responseSizes.length;
        this.recordResult('Text Extraction', times, avgResponseSize, this.estimateTokens(avgResponseSize));
    }

    /**
     * Benchmark table extraction
     */
    async benchmarkTableExtraction(): Promise<void> {
        console.log('📊 Benchmarking: Table Extraction');
        if (!this.pc) {
            this.pc = new PlayClone({ headless: true });
        }
        
        await this.pc.navigate('https://en.wikipedia.org/wiki/List_of_countries_by_population_(United_Nations)');
        const iterations = 5;
        const times: number[] = [];
        const responseSizes: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            const result = await this.pc.extractTable({
                selector: 'main table',
                columns: ['country', 'population', 'percentage']
            });
            const end = performance.now();
            times.push(end - start);
            
            if (result.success) {
                responseSizes.push(JSON.stringify(result).length);
            }
        }
        
        const avgResponseSize = responseSizes.reduce((a, b) => a + b, 0) / responseSizes.length;
        this.recordResult('Table Extraction', times, avgResponseSize, this.estimateTokens(avgResponseSize));
    }

    /**
     * Benchmark structured data extraction
     */
    async benchmarkDataExtraction(): Promise<void> {
        console.log('📊 Benchmarking: Structured Data Extraction');
        if (!this.pc) {
            this.pc = new PlayClone({ headless: true });
        }
        
        await this.pc.navigate('https://github.com/microsoft/playwright');
        const iterations = 5;
        const times: number[] = [];
        const responseSizes: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            const result = await this.pc.extractData({
                selector: 'repository info',
                fields: ['stars', 'forks', 'watchers', 'description', 'languages']
            });
            const end = performance.now();
            times.push(end - start);
            
            if (result.success) {
                responseSizes.push(JSON.stringify(result).length);
            }
        }
        
        const avgResponseSize = responseSizes.reduce((a, b) => a + b, 0) / responseSizes.length;
        this.recordResult('Structured Data Extraction', times, avgResponseSize, this.estimateTokens(avgResponseSize));
    }

    /**
     * Benchmark state saving
     */
    async benchmarkStateSaving(): Promise<void> {
        console.log('📊 Benchmarking: State Saving');
        if (!this.pc) {
            this.pc = new PlayClone({ headless: true });
        }
        
        await this.pc.navigate('https://example.com');
        const iterations = 10;
        const times: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await this.pc.saveState(`benchmark-state-${i}`);
            const end = performance.now();
            times.push(end - start);
        }
        
        this.recordResult('State Saving', times, 0, 0);
    }

    /**
     * Benchmark state restoration
     */
    async benchmarkStateRestoration(): Promise<void> {
        console.log('📊 Benchmarking: State Restoration');
        if (!this.pc) {
            this.pc = new PlayClone({ headless: true });
        }
        
        // First save a state
        await this.pc.navigate('https://github.com');
        await this.pc.saveState('benchmark-restore-state');
        
        const iterations = 10;
        const times: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
            // Navigate away
            await this.pc.navigate('https://example.com');
            
            // Restore state
            const start = performance.now();
            await this.pc.restoreState('benchmark-restore-state');
            const end = performance.now();
            times.push(end - start);
        }
        
        this.recordResult('State Restoration', times, 0, 0);
    }

    /**
     * Benchmark response size optimization
     */
    async benchmarkResponseSize(): Promise<void> {
        console.log('📊 Benchmarking: Response Size Optimization');
        if (!this.pc) {
            this.pc = new PlayClone({ headless: true });
        }
        
        const operations = [
            { name: 'Navigation', fn: () => this.pc!.navigate('https://example.com') },
            { name: 'Click', fn: () => this.pc!.click('link') },
            { name: 'Fill', fn: () => this.pc!.fill('input', 'test') },
            { name: 'Get Text', fn: () => this.pc!.getText('body') },
            { name: 'Extract Table', fn: () => this.pc!.extractTable({ selector: 'table' }) }
        ];
        
        console.log('\n  Response Sizes:');
        for (const op of operations) {
            try {
                const result = await op.fn();
                const size = JSON.stringify(result).length;
                const tokens = this.estimateTokens(size);
                console.log(`    ${op.name}: ${size} bytes (~${tokens} tokens)`);
            } catch (e) {
                // Ignore errors for this benchmark
            }
        }
    }

    /**
     * Benchmark token optimization
     */
    async benchmarkTokenOptimization(): Promise<void> {
        console.log('📊 Benchmarking: Token Usage');
        if (!this.pc) {
            this.pc = new PlayClone({ headless: true });
        }
        
        await this.pc.navigate('https://news.ycombinator.com');
        
        // Compare verbose vs optimized responses
        const verboseStart = performance.now();
        const verboseResult = await this.pc.extractData({
            selector: 'news items',
            fields: ['title', 'url', 'points', 'author', 'comments', 'time'],
            verbose: true
        });
        const verboseEnd = performance.now();
        
        const optimizedStart = performance.now();
        const optimizedResult = await this.pc.extractData({
            selector: 'news items',
            fields: ['title', 'url', 'points'],
            verbose: false
        });
        const optimizedEnd = performance.now();
        
        if (verboseResult.success && optimizedResult.success) {
            const verboseSize = JSON.stringify(verboseResult).length;
            const optimizedSize = JSON.stringify(optimizedResult).length;
            
            console.log('\n  Token Optimization:');
            console.log(`    Verbose: ${verboseSize} bytes (~${this.estimateTokens(verboseSize)} tokens)`);
            console.log(`    Optimized: ${optimizedSize} bytes (~${this.estimateTokens(optimizedSize)} tokens)`);
            console.log(`    Reduction: ${Math.round((1 - optimizedSize/verboseSize) * 100)}%`);
        }
    }

    /**
     * Record benchmark result
     */
    private recordResult(operation: string, times: number[], responseSize: number, tokenEstimate: number): void {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        
        const result: BenchmarkResult = {
            operation,
            averageTime: Math.round(avgTime),
            minTime: Math.round(minTime),
            maxTime: Math.round(maxTime),
            iterations: times.length,
            memoryUsed: process.memoryUsage().heapUsed / 1024 / 1024, // MB
            responseSize,
            tokenEstimate
        };
        
        this.results.push(result);
        
        console.log(`  ✓ ${operation}`);
        console.log(`    Average: ${result.averageTime}ms`);
        console.log(`    Min/Max: ${result.minTime}ms / ${result.maxTime}ms`);
        if (responseSize > 0) {
            console.log(`    Response: ${responseSize} bytes (~${tokenEstimate} tokens)`);
        }
    }

    /**
     * Generate performance report
     */
    private generateReport(): void {
        console.log('\n' + '=' .repeat(60));
        console.log('📈 PERFORMANCE REPORT');
        console.log('=' .repeat(60));
        
        // Sort by average time
        const sortedResults = [...this.results].sort((a, b) => b.averageTime - a.averageTime);
        
        console.log('\n🏃 Slowest Operations:');
        sortedResults.slice(0, 5).forEach((r, i) => {
            console.log(`  ${i + 1}. ${r.operation}: ${r.averageTime}ms avg`);
        });
        
        console.log('\n⚡ Fastest Operations:');
        sortedResults.slice(-5).reverse().forEach((r, i) => {
            console.log(`  ${i + 1}. ${r.operation}: ${r.averageTime}ms avg`);
        });
        
        // Response size analysis
        const resultsWithResponses = this.results.filter(r => r.responseSize > 0);
        if (resultsWithResponses.length > 0) {
            console.log('\n📦 Response Size Analysis:');
            const avgResponseSize = resultsWithResponses.reduce((sum, r) => sum + r.responseSize, 0) / resultsWithResponses.length;
            const avgTokens = resultsWithResponses.reduce((sum, r) => sum + r.tokenEstimate, 0) / resultsWithResponses.length;
            
            console.log(`  Average Response: ${Math.round(avgResponseSize)} bytes`);
            console.log(`  Average Tokens: ~${Math.round(avgTokens)} tokens`);
            console.log(`  Target Met: ${avgResponseSize < 1024 ? '✅ Yes' : '❌ No'} (<1KB target)`);
        }
        
        // Memory usage
        const avgMemory = this.results.reduce((sum, r) => sum + r.memoryUsed, 0) / this.results.length;
        console.log('\n💾 Memory Usage:');
        console.log(`  Average: ${avgMemory.toFixed(2)} MB`);
        console.log(`  Current: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
        
        // Overall performance
        const totalTime = this.results.reduce((sum, r) => sum + r.averageTime * r.iterations, 0);
        const totalOperations = this.results.reduce((sum, r) => sum + r.iterations, 0);
        
        console.log('\n📊 Overall Statistics:');
        console.log(`  Total Operations: ${totalOperations}`);
        console.log(`  Total Time: ${(totalTime / 1000).toFixed(2)} seconds`);
        console.log(`  Operations/Second: ${(totalOperations / (totalTime / 1000)).toFixed(2)}`);
        
        // Save detailed report to file
        this.saveDetailedReport();
    }

    /**
     * Save detailed report to file
     */
    private saveDetailedReport(): void {
        const reportPath = path.join(__dirname, '..', 'benchmark-results.json');
        const report = {
            timestamp: new Date().toISOString(),
            results: this.results,
            summary: {
                totalOperations: this.results.reduce((sum, r) => sum + r.iterations, 0),
                averageResponseSize: this.results.filter(r => r.responseSize > 0)
                    .reduce((sum, r) => sum + r.responseSize, 0) / 
                    this.results.filter(r => r.responseSize > 0).length || 0,
                averageMemoryUsage: this.results.reduce((sum, r) => sum + r.memoryUsed, 0) / this.results.length
            }
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📁 Detailed report saved to: ${reportPath}`);
    }

    /**
     * Estimate token count from byte size
     */
    private estimateTokens(bytes: number): number {
        // Rough estimate: 1 token ≈ 4 bytes
        return Math.round(bytes / 4);
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Comparison benchmark against raw Playwright
 */
async function compareWithPlaywright(): Promise<void> {
    console.log('\n🔄 Comparing PlayClone vs Raw Playwright\n');
    console.log('=' .repeat(60));
    
    const { chromium } = await import('playwright-core');
    
    // Test case: Navigate and extract text
    const url = 'https://example.com';
    const iterations = 10;
    
    // PlayClone benchmark
    console.log('\n📦 PlayClone Performance:');
    const pcTimes: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
        const pc = new PlayClone({ headless: true });
        const start = performance.now();
        await pc.navigate(url);
        const text = await pc.getText('h1');
        await pc.close();
        const end = performance.now();
        pcTimes.push(end - start);
    }
    
    const pcAvg = pcTimes.reduce((a, b) => a + b, 0) / pcTimes.length;
    console.log(`  Average: ${Math.round(pcAvg)}ms`);
    
    // Playwright benchmark
    console.log('\n🎭 Playwright Performance:');
    const pwTimes: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
        const browser = await chromium.launch({ headless: true });
        const start = performance.now();
        const page = await browser.newPage();
        await page.goto(url);
        await page.textContent('h1');
        await browser.close();
        const end = performance.now();
        pwTimes.push(end - start);
    }
    
    const pwAvg = pwTimes.reduce((a, b) => a + b, 0) / pwTimes.length;
    console.log(`  Average: ${Math.round(pwAvg)}ms`);
    
    // Comparison
    const overhead = ((pcAvg - pwAvg) / pwAvg) * 100;
    console.log('\n📊 Comparison Results:');
    console.log(`  PlayClone Overhead: ${overhead > 0 ? '+' : ''}${overhead.toFixed(1)}%`);
    console.log(`  Verdict: ${overhead < 20 ? '✅ Acceptable' : '⚠️ Needs Optimization'}`);
    
    // Feature comparison
    console.log('\n✨ Feature Advantages:');
    console.log('  PlayClone:');
    console.log('    ✓ Natural language selectors');
    console.log('    ✓ AI-optimized responses');
    console.log('    ✓ Built-in state management');
    console.log('    ✓ Automatic retry logic');
    console.log('    ✓ Token-efficient output');
    console.log('  Playwright:');
    console.log('    ✓ Lower overhead');
    console.log('    ✓ More granular control');
    console.log('    ✓ Broader ecosystem');
}

/**
 * Run stress test
 */
async function stressTest(): Promise<void> {
    console.log('\n💪 Running Stress Test\n');
    console.log('=' .repeat(60));
    
    const concurrentBrowsers = 5;
    const operationsPerBrowser = 20;
    
    console.log(`Configuration:`);
    console.log(`  Concurrent Browsers: ${concurrentBrowsers}`);
    console.log(`  Operations per Browser: ${operationsPerBrowser}`);
    console.log(`  Total Operations: ${concurrentBrowsers * operationsPerBrowser}\n`);
    
    const start = performance.now();
    
    const browserPromises = Array.from({ length: concurrentBrowsers }, async (_, i) => {
        const pc = new PlayClone({ headless: true });
        
        for (let j = 0; j < operationsPerBrowser; j++) {
            await pc.navigate('https://example.com');
            await pc.getText('h1');
            await pc.click('link');
        }
        
        await pc.close();
        console.log(`  Browser ${i + 1} completed`);
    });
    
    await Promise.all(browserPromises);
    const end = performance.now();
    
    const totalTime = (end - start) / 1000;
    const opsPerSecond = (concurrentBrowsers * operationsPerBrowser) / totalTime;
    
    console.log('\n📊 Stress Test Results:');
    console.log(`  Total Time: ${totalTime.toFixed(2)} seconds`);
    console.log(`  Operations/Second: ${opsPerSecond.toFixed(2)}`);
    console.log(`  Memory Used: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Status: ${opsPerSecond > 10 ? '✅ Pass' : '❌ Fail'}`);
}

/**
 * Main benchmark runner
 */
async function main() {
    console.log('🚀 PlayClone Performance Benchmark Suite');
    console.log('=' .repeat(60));
    console.log(`Date: ${new Date().toISOString()}`);
    console.log(`Node Version: ${process.version}`);
    console.log(`Platform: ${process.platform}`);
    console.log('=' .repeat(60));
    
    try {
        // Run main benchmarks
        const benchmark = new PerformanceBenchmark();
        await benchmark.runAll();
        
        // Run comparison with Playwright
        await compareWithPlaywright();
        
        // Run stress test
        await stressTest();
        
        console.log('\n' + '=' .repeat(60));
        console.log('✅ All benchmarks completed successfully!');
        console.log('=' .repeat(60));
        
    } catch (error) {
        console.error('\n❌ Benchmark failed:', error);
        process.exit(1);
    }
}

// Run benchmarks if executed directly
if (require.main === module) {
    main().catch(console.error);
}

export { PerformanceBenchmark, compareWithPlaywright, stressTest };