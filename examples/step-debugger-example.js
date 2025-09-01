/**
 * Step-by-Step Debugger Example
 * Demonstrates interactive debugging of browser automation scripts
 */

const { PlayClone } = require('../dist');
const { StepDebugger } = require('../dist/devtools/StepDebugger');

async function runWithDebugger() {
    console.log('🔍 PlayClone Step-by-Step Debugger Example\n');
    
    // Initialize PlayClone
    const browser = new PlayClone({
        headless: false, // Show browser for debugging
        viewport: { width: 1280, height: 720 }
    });
    
    try {
        // Create debugger instance
        const debugger = new StepDebugger({
            mode: 'cli',              // Use CLI interface (or 'web' for web UI)
            pauseOnStart: true,        // Pause at the beginning
            pauseOnError: true,        // Pause when errors occur
            autoScreenshot: true,      // Take screenshots at each step
            enableBreakpoints: true,   // Enable breakpoint support
            enableWatch: true,         // Enable watch expressions
            enableProfiler: true,      // Enable performance profiling
            logLevel: 'normal'        // Log level: verbose, normal, minimal
        });
        
        // Initialize debugger with browser
        await browser.launch();
        const page = browser.page;
        const browserInstance = browser.browser;
        await debugger.initialize(page, browserInstance);
        
        console.log('Debugger initialized. You are now in debug mode.');
        console.log('Type "help" for available commands.\n');
        
        // Define automation steps
        const steps = [
            {
                type: 'navigation',
                description: 'Navigate to Example.com',
                value: 'https://example.com'
            },
            {
                type: 'wait',
                description: 'Wait for page to load',
                value: 1000
            },
            {
                type: 'extract',
                description: 'Extract page title',
                selector: 'h1'
            },
            {
                type: 'screenshot',
                description: 'Take screenshot of page'
            },
            {
                type: 'navigation',
                description: 'Navigate to Google',
                value: 'https://google.com'
            },
            {
                type: 'wait',
                description: 'Wait for search box',
                value: 'input[name="q"]'
            },
            {
                type: 'input',
                description: 'Type search query',
                selector: 'input[name="q"]',
                value: 'PlayClone browser automation'
            },
            {
                type: 'click',
                description: 'Click search button',
                selector: 'input[type="submit"]'
            },
            {
                type: 'wait',
                description: 'Wait for results',
                value: 2000
            },
            {
                type: 'extract',
                description: 'Extract search results count',
                selector: '#result-stats'
            },
            {
                type: 'script',
                description: 'Count links on page',
                value: '() => document.querySelectorAll("a").length'
            },
            {
                type: 'screenshot',
                description: 'Take screenshot of results'
            }
        ];
        
        // Add all steps to debugger
        console.log('Adding automation steps...');
        for (const step of steps) {
            await debugger.addStep(step);
        }
        console.log(`Added ${steps.length} steps to debug.\n`);
        
        // Set some example breakpoints
        debugger.setBreakpoint({ stepIndex: 4, enabled: true });
        console.log('Breakpoint set at step 5 (Navigate to Google)');
        
        debugger.setBreakpoint({ selector: 'input[name="q"]', enabled: true });
        console.log('Breakpoint set for search input selector\n');
        
        // Add watch expressions
        debugger.addWatch('window.location.href');
        debugger.addWatch('document.title');
        debugger.addWatch('document.querySelectorAll("a").length');
        console.log('Added watch expressions for URL, title, and link count\n');
        
        // Set up event listeners
        debugger.on('step-started', (step) => {
            console.log(`\n▶️  Starting: ${step.description}`);
        });
        
        debugger.on('step-completed', (step) => {
            console.log(`✅ Completed: ${step.description} (${step.duration}ms)`);
            if (step.result) {
                console.log(`   Result: ${JSON.stringify(step.result)}`);
            }
        });
        
        debugger.on('step-error', (step, error) => {
            console.error(`❌ Error in step: ${step.description}`);
            console.error(`   ${error.message}`);
        });
        
        debugger.on('breakpoint-hit', (breakpoint) => {
            console.log(`\n🔴 Breakpoint hit: ${JSON.stringify(breakpoint)}`);
        });
        
        debugger.on('watches-updated', (watches) => {
            console.log('\n📊 Watch Expressions:');
            watches.forEach(watch => {
                if (watch.error) {
                    console.log(`   ${watch.expression}: ERROR - ${watch.error}`);
                } else {
                    console.log(`   ${watch.expression}: ${JSON.stringify(watch.value)}`);
                }
            });
        });
        
        // Execute steps with debugging
        console.log('Starting step-by-step execution...\n');
        console.log('Debug Commands:');
        console.log('  c/continue - Continue execution');
        console.log('  n/next     - Step to next');
        console.log('  b <n>      - Set breakpoint at step n');
        console.log('  l          - List all steps');
        console.log('  p <expr>   - Evaluate expression');
        console.log('  h          - Show help');
        console.log('  q          - Quit\n');
        
        // Execute all steps
        for (let i = 0; i < steps.length; i++) {
            await debugger.executeStep();
        }
        
        console.log('\n✨ All steps completed!');
        
        // Export debug session
        const session = debugger.exportSession();
        console.log('\nDebug Session Summary:');
        console.log(`  Total steps: ${session.steps.length}`);
        console.log(`  Successful: ${session.steps.filter(s => s.status === 'success').length}`);
        console.log(`  Errors: ${session.steps.filter(s => s.status === 'error').length}`);
        console.log(`  Breakpoints hit: ${session.breakpoints.reduce((sum, bp) => sum + bp.hitCount, 0)}`);
        
        // Calculate total execution time
        const totalTime = session.steps.reduce((sum, step) => sum + (step.duration || 0), 0);
        console.log(`  Total execution time: ${totalTime}ms`);
        
        // Clean up
        await debugger.cleanup();
        
    } catch (error) {
        console.error('Error during debugging:', error);
    } finally {
        await browser.close();
    }
}

// Alternative: Run with Web UI debugger
async function runWithWebDebugger() {
    console.log('🌐 Starting Web UI Debugger...\n');
    
    const browser = new PlayClone({
        headless: false,
        viewport: { width: 1280, height: 720 }
    });
    
    try {
        // Create web debugger
        const debugger = new StepDebugger({
            mode: 'web',
            port: 9229,
            host: 'localhost',
            pauseOnStart: false,
            autoScreenshot: true,
            enableBreakpoints: true,
            enableWatch: true,
            enableProfiler: true
        });
        
        await browser.launch();
        await debugger.initialize(browser.page, browser.browser);
        
        console.log('✅ Web debugger started!');
        console.log('📱 Open http://localhost:9229 in your browser');
        console.log('🎮 Use the web interface to control debugging\n');
        
        // Add steps
        const steps = [
            {
                type: 'navigation',
                description: 'Go to Hacker News',
                value: 'https://news.ycombinator.com'
            },
            {
                type: 'wait',
                description: 'Wait for stories',
                value: '.storylink, .titleline a'
            },
            {
                type: 'extract',
                description: 'Get top story title',
                selector: '.storylink, .titleline a'
            },
            {
                type: 'click',
                description: 'Click on top story',
                selector: '.storylink, .titleline a'
            },
            {
                type: 'wait',
                description: 'Wait for page load',
                value: 2000
            },
            {
                type: 'screenshot',
                description: 'Capture article'
            }
        ];
        
        for (const step of steps) {
            await debugger.addStep(step);
        }
        
        console.log('Steps added. Use the web interface to:');
        console.log('  - Step through execution');
        console.log('  - Set breakpoints');
        console.log('  - Watch expressions');
        console.log('  - View screenshots');
        console.log('  - Monitor performance\n');
        
        // Keep running until user stops
        console.log('Press Ctrl+C to stop the debugger\n');
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\nShutting down debugger...');
            await debugger.cleanup();
            await browser.close();
            process.exit(0);
        });
        
        // Keep process alive
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Error:', error);
        await browser.close();
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args[0] || 'cli';

if (mode === 'web') {
    runWithWebDebugger().catch(console.error);
} else {
    runWithDebugger().catch(console.error);
}

// Usage:
// node step-debugger-example.js       # CLI debugger
// node step-debugger-example.js web   # Web UI debugger