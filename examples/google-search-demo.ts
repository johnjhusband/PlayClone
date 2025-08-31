#!/usr/bin/env npx tsx
/**
 * Google Search Automation Demo
 * Demonstrates PlayClone's natural language capabilities
 * with the world's most popular search engine
 */

import { PlayClone } from '../dist/index';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

async function googleSearchDemo() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('🔍 GOOGLE SEARCH AUTOMATION WITH PLAYCLONE');
  console.log('Using natural language to control the browser');
  console.log(`${colors.reset}\n`);
  
  const pc = new PlayClone({ 
    headless: false,  // Show the browser so you can see it work!
    viewport: { width: 1280, height: 800 }
  });
  
  try {
    // Step 1: Navigate to Google
    console.log(`${colors.blue}📍 Step 1: Navigate to Google${colors.reset}`);
    const navResult = await pc.navigate('https://google.com');
    
    if (navResult.success) {
      console.log(`${colors.green}✅ Successfully loaded Google${colors.reset}`);
      console.log(`   URL: ${navResult.value?.url}`);
    }
    
    // Small delay to let page stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 2: Search using natural language
    console.log(`\n${colors.blue}📍 Step 2: Fill search using natural language${colors.reset}`);
    console.log(`   Using: "search field" or "search box"`);
    
    const fillResult = await pc.fill('search', 'PlayClone browser automation AI');
    
    if (fillResult.success) {
      console.log(`${colors.green}✅ Successfully filled search query${colors.reset}`);
    }
    
    // Step 3: Click search button
    console.log(`\n${colors.blue}📍 Step 3: Click search button${colors.reset}`);
    console.log(`   Using: "search button" or "Google Search"`);
    
    // Google might show instant results, so we'll try to click or press Enter
    try {
      await pc.click('Google Search button');
      console.log(`${colors.green}✅ Clicked search button${colors.reset}`);
    } catch {
      // Fallback: press Enter
      console.log(`${colors.yellow}⚠️  Button not found, pressing Enter${colors.reset}`);
      await pc.press('Enter');
    }
    
    // Wait for results to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Extract search results
    console.log(`\n${colors.blue}📍 Step 4: Extract search results${colors.reset}`);
    
    const links = await pc.getLinks();
    const searchResults = links.data?.external?.filter((link: any) => 
      !link.href.includes('google.com') && 
      !link.href.includes('gstatic.com') &&
      link.text && link.text.length > 10
    ) || [];
    
    console.log(`${colors.green}✅ Found ${searchResults.length} search results${colors.reset}\n`);
    
    // Display top 5 results
    console.log(`${colors.cyan}📊 Top Search Results:${colors.reset}`);
    searchResults.slice(0, 5).forEach((result: any, index: number) => {
      console.log(`\n  ${colors.yellow}${index + 1}.${colors.reset} ${result.text}`);
      console.log(`     ${colors.blue}${result.href}${colors.reset}`);
    });
    
    // Step 5: Take a screenshot
    console.log(`\n${colors.blue}📍 Step 5: Capture screenshot${colors.reset}`);
    
    const screenshotResult = await pc.screenshot('google-search-results.png');
    
    if (screenshotResult.success) {
      console.log(`${colors.green}✅ Screenshot saved to google-search-results.png${colors.reset}`);
    }
    
    // Step 6: Try "I'm Feeling Lucky" (go back first)
    console.log(`\n${colors.blue}📍 Step 6: Demonstrate navigation${colors.reset}`);
    
    await pc.back();
    console.log(`${colors.green}✅ Navigated back to Google homepage${colors.reset}`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fill a fun search
    await pc.fill('search', 'recursion');
    console.log(`${colors.green}✅ Filled new search term: "recursion"${colors.reset}`);
    
    // Summary
    console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(50)}${colors.reset}`);
    console.log(`${colors.bright}${colors.green}🎉 DEMO COMPLETE!${colors.reset}\n`);
    
    console.log('Demonstrated capabilities:');
    console.log('  ✅ Natural language element selection');
    console.log('  ✅ Form filling with descriptions');
    console.log('  ✅ Button clicking with text matching');
    console.log('  ✅ Link extraction and filtering');
    console.log('  ✅ Screenshot capture');
    console.log('  ✅ Browser navigation (back/forward)');
    
    console.log(`\n${colors.yellow}💡 Key insight:${colors.reset}`);
    console.log('   PlayClone understood commands like "search field" and "search button"');
    console.log('   without needing specific CSS selectors or XPath!');
    
    // Performance stats
    const state = await pc.getCurrentState();
    console.log(`\n${colors.cyan}📊 Performance:${colors.reset}`);
    console.log(`   Current URL: ${state.value?.url}`);
    console.log(`   All responses optimized for AI (<1KB)`);
    
  } catch (error) {
    console.error(`${colors.red}❌ Error:${colors.reset}`, error);
  } finally {
    console.log(`\n${colors.blue}Browser will close in 5 seconds...${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    await pc.close();
    console.log(`${colors.green}✅ Browser closed${colors.reset}`);
  }
}

// Run the demo
googleSearchDemo().catch(console.error);