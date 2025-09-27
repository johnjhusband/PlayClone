#!/usr/bin/env node
/**
 * PlayClone Demo: GitHub Repository Search
 *
 * This demo shows PlayClone automating a real-world task:
 * 1. Navigate to GitHub
 * 2. Search for a repository
 * 3. Click on search results
 * 4. Extract repository information
 * 5. Take screenshots
 */
import { PlayClone } from './dist/index.js';
async function runDemo() {
    console.log('🚀 Starting PlayClone Demo: GitHub Repository Search\n');
    // Initialize PlayClone with visible browser
    const browser = new PlayClone({
        headless: false, // Show the browser window
        viewport: { width: 1280, height: 800 }
    });
    try {
        // Step 1: Navigate to GitHub
        console.log('📍 Navigating to GitHub...');
        const navResult = await browser.navigate('https://github.com');
        console.log(`   ✅ Navigation: ${navResult.success ? 'Success' : 'Failed'}`);
        // Wait a moment for the page to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Step 2: Click on the search box using natural language
        console.log('\n🔍 Clicking on search box...');
        const clickResult = await browser.click('search input');
        console.log(`   ✅ Click search: ${clickResult.success ? 'Success' : 'Failed'}`);
        // Step 3: Type search query
        console.log('\n⌨️  Typing search query...');
        const typeResult = await browser.type('playwright', 100);
        console.log(`   ✅ Type query: ${typeResult.success ? 'Success' : 'Failed'}`);
        // Step 4: Press Enter to search
        console.log('\n🔎 Submitting search...');
        const pressResult = await browser.press('Enter');
        console.log(`   ✅ Press Enter: ${pressResult.success ? 'Success' : 'Failed'}`);
        // Wait for search results
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Step 5: Take a screenshot of search results
        console.log('\n📸 Taking screenshot of search results...');
        const screenshotResult = await browser.screenshot({
            path: 'github-search-results.png',
            fullPage: false
        });
        console.log(`   ✅ Screenshot saved: github-search-results.png`);
        // Step 6: Extract search results information
        console.log('\n📊 Extracting search results...');
        const textData = await browser.getText();
        if (textData.data) {
            const lines = textData.data.split('\\n').slice(0, 5);
            console.log('   Top results preview:');
            lines.forEach(line => {
                if (line.trim())
                    console.log(`     - ${line.substring(0, 60)}...`);
            });
        }
        // Step 7: Get all links on the page
        console.log('\n🔗 Extracting repository links...');
        const linksData = await browser.getLinks();
        if (linksData.data && Array.isArray(linksData.data)) {
            const repoLinks = linksData.data
                .filter(link => link.href && link.href.includes('/microsoft/playwright'))
                .slice(0, 3);
            console.log('   Found Playwright repository links:');
            repoLinks.forEach(link => {
                console.log(`     - ${link.text || 'Link'}: ${link.href}`);
            });
        }
        // Step 8: Click on the first repository result
        console.log('\n🖱️  Clicking on first repository result...');
        const repoClickResult = await browser.click('microsoft/playwright');
        console.log(`   ✅ Click repository: ${repoClickResult.success ? 'Success' : 'Failed'}`);
        // Wait for repository page to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Step 9: Take final screenshot
        console.log('\n📸 Taking screenshot of repository page...');
        await browser.screenshot({
            path: 'github-playwright-repo.png',
            fullPage: false
        });
        console.log(`   ✅ Screenshot saved: github-playwright-repo.png`);
        // Step 10: Get current page state
        console.log('\n📍 Current page state:');
        const state = await browser.getCurrentState();
        if (state.success && state.value) {
            console.log(`   URL: ${state.value.url}`);
            console.log(`   Title: ${state.value.title}`);
        }
        // Demo complete!
        console.log('\n✨ Demo completed successfully!');
        console.log('   - Navigated to GitHub');
        console.log('   - Searched for "playwright"');
        console.log('   - Clicked on repository');
        console.log('   - Extracted data and took screenshots');
        console.log('\n👀 Check the screenshots:');
        console.log('   - github-search-results.png');
        console.log('   - github-playwright-repo.png');
    }
    catch (error) {
        console.error('❌ Demo failed:', error);
    }
    finally {
        // Close the browser after a delay to see the final state
        console.log('\n⏰ Closing browser in 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await browser.close();
        console.log('👋 Browser closed. Demo finished!');
    }
}
// Run the demo
runDemo().catch(console.error);
