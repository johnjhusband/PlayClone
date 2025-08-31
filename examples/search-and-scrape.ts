#!/usr/bin/env npx tsx
/**
 * Real-World Demo: Search and Scrape with PlayClone
 * This demonstrates using natural language to control a browser
 * for searching and extracting information
 */

import { PlayClone } from '../dist/index';

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function section(title: string) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function info(msg: string) {
  console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);
}

function success(msg: string) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function data(key: string, value: string) {
  console.log(`${colors.yellow}📊 ${key}:${colors.reset} ${value}`);
}

async function searchAndScrape() {
  const pc = new PlayClone({ headless: false });
  
  try {
    // Demo 1: Search on DuckDuckGo
    section('DEMO 1: SEARCH ENGINE AUTOMATION');
    
    info('Navigating to DuckDuckGo...');
    await pc.navigate('https://duckduckgo.com');
    success('Loaded DuckDuckGo');
    
    info('Using natural language to fill search: "search box"');
    await pc.fill('search box', 'playwright vs puppeteer 2025');
    success('Filled search query');
    
    info('Using natural language to click: "search button"');
    await pc.click('search button');
    success('Performed search');
    
    // Wait for results
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    info('Extracting search results...');
    const links = await pc.getLinks();
    const externalLinks = links.data?.external || [];
    
    success(`Found ${externalLinks.length} external links`);
    
    // Show first 5 results
    console.log('\n📋 Top Search Results:');
    externalLinks.slice(0, 5).forEach((link: any, i: number) => {
      console.log(`  ${i + 1}. ${link.text || 'No text'}`);
      console.log(`     ${colors.blue}${link.href}${colors.reset}`);
    });
    
    // Demo 2: Navigate to a news site and extract headlines
    section('DEMO 2: NEWS EXTRACTION');
    
    info('Navigating to Hacker News...');
    await pc.navigate('https://news.ycombinator.com');
    success('Loaded Hacker News');
    
    info('Taking screenshot for reference...');
    const screenshot = await pc.screenshot('hacker-news-demo.png');
    if (screenshot.success) {
      success('Screenshot saved to hacker-news-demo.png');
    }
    
    info('Extracting all links from the page...');
    const newsLinks = await pc.getLinks();
    const allNewsLinks = newsLinks.data?.external || [];
    
    // Filter for story links (they have specific patterns)
    const storyLinks = allNewsLinks.filter((link: any) => 
      link.text && !link.href.includes('ycombinator.com')
    ).slice(0, 10);
    
    console.log('\n📰 Top Stories:');
    storyLinks.forEach((link: any, i: number) => {
      console.log(`  ${i + 1}. ${link.text}`);
      console.log(`     ${colors.blue}${link.href}${colors.reset}`);
    });
    
    // Demo 3: Form automation on a test site
    section('DEMO 3: FORM AUTOMATION');
    
    info('Navigating to form test site...');
    await pc.navigate('https://www.w3schools.com/html/html_forms.asp');
    success('Loaded W3Schools forms page');
    
    info('Using natural language to interact with form elements...');
    
    // Try to find and fill form fields using natural language
    try {
      await pc.fill('first name input', 'PlayClone');
      success('Filled first name');
    } catch (e) {
      info('First name field not found or not fillable');
    }
    
    try {
      await pc.fill('last name field', 'AI Assistant');
      success('Filled last name');
    } catch (e) {
      info('Last name field not found or not fillable');
    }
    
    // Demo 4: State Management
    section('DEMO 4: STATE MANAGEMENT');
    
    info('Saving current browser state...');
    await pc.saveState('demo-checkpoint');
    success('State saved as "demo-checkpoint"');
    
    info('Navigating away to GitHub...');
    await pc.navigate('https://github.com');
    success('Now on GitHub');
    
    const currentState = await pc.getCurrentState();
    data('Current URL', currentState.value?.url || 'unknown');
    
    info('Restoring saved state...');
    await pc.restoreState('demo-checkpoint');
    success('State restored!');
    
    const restoredState = await pc.getCurrentState();
    data('Restored URL', restoredState.value?.url || 'unknown');
    
    // Demo 5: Extract structured data
    section('DEMO 5: DATA EXTRACTION');
    
    info('Navigating to example table page...');
    await pc.navigate('https://www.w3schools.com/html/html_tables.asp');
    success('Loaded tables page');
    
    info('Extracting table data...');
    const tables = await pc.getTables();
    
    if (tables.data && tables.data.length > 0) {
      success(`Found ${tables.data.length} tables`);
      const firstTable = tables.data[0];
      
      console.log('\n📊 First Table Preview:');
      console.log('Headers:', firstTable.headers?.join(' | '));
      if (firstTable.rows && firstTable.rows.length > 0) {
        console.log('First row:', firstTable.rows[0].join(' | '));
      }
    }
    
    // Summary
    section('DEMO COMPLETE!');
    
    console.log(`${colors.green}🎉 Successfully demonstrated:${colors.reset}`);
    console.log('  • Natural language element selection');
    console.log('  • Search engine automation');
    console.log('  • Data extraction from news sites');
    console.log('  • Form filling with descriptions');
    console.log('  • State management (save/restore)');
    console.log('  • Table data extraction');
    console.log('  • Screenshot capture');
    
    console.log(`\n${colors.magenta}✨ PlayClone makes browser automation AI-native!${colors.reset}`);
    
  } catch (error) {
    console.error('Error during demo:', error);
  } finally {
    console.log('\n📝 Closing browser in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await pc.close();
  }
}

// Run the demo
console.log(`${colors.bright}${colors.cyan}`);
console.log('🚀 PLAYCLONE REAL-WORLD DEMO');
console.log('AI-Native Browser Automation in Action!');
console.log(`${colors.reset}`);

searchAndScrape().catch(console.error);