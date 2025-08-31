#!/usr/bin/env node
/**
 * PlayClone Self-Test Demo
 * 
 * This is meta-testing at its finest - PlayClone testing PlayClone!
 * Watch as PlayClone uses its own API to test its own functionality.
 * 
 * This demonstrates:
 * 1. PlayClone can control browsers using natural language
 * 2. PlayClone's responses are AI-optimized (<1KB)
 * 3. PlayClone can test itself (dogfooding)
 * 4. All core features work in real-world scenarios
 */

import { PlayClone } from '../src/index';
import * as fs from 'fs';
import * as path from 'path';

// Color output for better visibility
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

function section(title: string) {
  console.log();
  log(`${'='.repeat(60)}`, colors.cyan);
  log(title.toUpperCase(), colors.bright + colors.cyan);
  log(`${'='.repeat(60)}`, colors.cyan);
  console.log();
}

async function measureResponseSize(data: any): Promise<number> {
  const json = JSON.stringify(data);
  return Buffer.byteLength(json, 'utf8');
}

async function runSelfTests() {
  section('🚀 PlayClone Self-Test Suite Starting');
  
  let testsRun = 0;
  let testsPassed = 0;
  let totalResponseSize = 0;
  let maxResponseSize = 0;
  
  // Create PlayClone instance
  info('Creating PlayClone instance...');
  const pc = new PlayClone({ 
    headless: false, // Set to false to see the browser in action!
    browser: 'chromium'
  });
  
  try {
    // Test 1: Navigation
    section('Test 1: Navigation Using PlayClone');
    info('PlayClone navigating to example.com...');
    const navResult = await pc.navigate('https://example.com');
    testsRun++;
    
    const navSize = await measureResponseSize(navResult);
    totalResponseSize += navSize;
    maxResponseSize = Math.max(maxResponseSize, navSize);
    
    if (navResult.success && navResult.value?.url?.includes('example.com')) {
      success(`Navigation successful! URL: ${navResult.value.url}`);
      success(`Response size: ${navSize} bytes (${navSize < 1024 ? 'AI-optimized ✨' : 'needs optimization'})`);
      testsPassed++;
    } else {
      error('Navigation failed');
    }
    
    // Test 2: Natural Language Element Selection
    section('Test 2: Natural Language Click');
    info('PlayClone clicking "More information" using natural language...');
    const clickResult = await pc.click('More information link');
    testsRun++;
    
    const clickSize = await measureResponseSize(clickResult);
    totalResponseSize += clickSize;
    maxResponseSize = Math.max(maxResponseSize, clickSize);
    
    if (clickResult.success) {
      success('Click successful using natural language!');
      success(`Response size: ${clickSize} bytes`);
      
      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify we navigated
      const state = await pc.getCurrentState();
      if (state.value?.url?.includes('iana.org')) {
        success('Navigation after click confirmed!');
        testsPassed++;
      }
    } else {
      error('Click failed');
    }
    
    // Test 3: Back Navigation
    section('Test 3: Browser Navigation Controls');
    info('PlayClone going back...');
    const backResult = await pc.back();
    testsRun++;
    
    if (backResult.success && backResult.value?.url?.includes('example.com')) {
      success('Back navigation successful!');
      testsPassed++;
    } else {
      error('Back navigation failed');
    }
    
    // Longer delay to ensure page is fully loaded after back navigation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Test 4: Text Extraction
    section('Test 4: Data Extraction');
    info('PlayClone extracting text from page...');
    
    // Try text extraction with retry
    let textResult = await pc.getText();
    let textContent = textResult.data?.text;
    
    // If text is null, wait and retry once
    if (!textContent) {
      info('Retrying text extraction after additional wait...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      textResult = await pc.getText();
      textContent = textResult.data?.text;
    }
    
    testsRun++;
    
    const textSize = await measureResponseSize(textResult);
    totalResponseSize += textSize;
    maxResponseSize = Math.max(maxResponseSize, textSize);
    
    if (textContent && typeof textContent === 'string' && textContent.includes('Example Domain')) {
      success('Text extraction successful!');
      success(`Found text: "${textContent.substring(0, 50)}..."`);
      success(`Response size: ${textSize} bytes`);
      testsPassed++;
    } else {
      error(`Text extraction failed - data: ${JSON.stringify(textResult.data).substring(0, 100)}`);
    }
    
    // Test 5: Link Extraction
    section('Test 5: Link Discovery');
    info('PlayClone finding all links...');
    const linksResult = await pc.getLinks();
    testsRun++;
    
    const linksSize = await measureResponseSize(linksResult);
    totalResponseSize += linksSize;
    maxResponseSize = Math.max(maxResponseSize, linksSize);
    
    // The response has internal and external links
    const allLinks = [
      ...(linksResult.data?.internal || []),
      ...(linksResult.data?.external || [])
    ];
    
    if (allLinks.length > 0) {
      success(`Found ${allLinks.length} links!`);
      allLinks.forEach((link: any, i: number) => {
        if (i < 3) { // Show first 3 links
          info(`  - ${link.text}: ${link.href}`);
        }
      });
      success(`Response size: ${linksSize} bytes`);
      testsPassed++;
    } else {
      error('Link extraction failed');
    }
    
    // Test 6: Form Interaction
    section('Test 6: Form Filling');
    info('Navigating to Google for form test...');
    await pc.navigate('https://www.google.com');
    
    info('PlayClone filling search form using natural language...');
    const fillResult = await pc.fill('search', 'PlayClone AI browser automation');
    testsRun++;
    
    const fillSize = await measureResponseSize(fillResult);
    totalResponseSize += fillSize;
    maxResponseSize = Math.max(maxResponseSize, fillSize);
    
    if (fillResult.success) {
      success('Form filling successful!');
      success(`Response size: ${fillSize} bytes`);
      testsPassed++;
    } else {
      error('Form filling failed');
    }
    
    // Test 7: Screenshot
    section('Test 7: Screenshot Capture');
    info('PlayClone taking screenshot...');
    const screenshotResult = await pc.screenshot();
    testsRun++;
    
    // For screenshot, measure metadata only (not the image data)
    const screenshotMetaSize = await measureResponseSize({
      type: screenshotResult.type,
      metadata: screenshotResult.metadata
    });
    totalResponseSize += screenshotMetaSize;
    maxResponseSize = Math.max(maxResponseSize, screenshotMetaSize);
    
    if (screenshotResult.data) {
      success('Screenshot captured!');
      success(`Image data size: ${screenshotResult.data.length} bytes (base64)`);
      success(`Metadata size: ${screenshotMetaSize} bytes`);
      
      // Save screenshot to file
      const screenshotPath = path.join(process.cwd(), 'playclone-self-test-screenshot.png');
      fs.writeFileSync(screenshotPath, Buffer.from(screenshotResult.data, 'base64'));
      info(`Screenshot saved to: ${screenshotPath}`);
      testsPassed++;
    } else {
      error('Screenshot failed');
    }
    
    // Test 8: State Management
    section('Test 8: State Management');
    info('PlayClone saving current state...');
    const saveResult = await pc.saveState('test-checkpoint');
    testsRun++;
    
    if (saveResult.success) {
      success('State saved successfully!');
      
      // Navigate away
      info('Navigating to different page...');
      await pc.navigate('https://github.com');
      
      // Restore state
      info('PlayClone restoring saved state...');
      const restoreResult = await pc.restoreState('test-checkpoint');
      
      if (restoreResult.success) {
        success('State restored successfully!');
        
        // Verify we're back
        const currentState = await pc.getCurrentState();
        if (currentState.value?.url?.includes('google.com')) {
          success('State restoration verified - back at Google!');
          testsPassed++;
        }
      }
    } else {
      error('State management failed');
    }
    
    // Test 9: Multiple Element Selection
    section('Test 9: Complex Element Selection');
    await pc.navigate('https://example.com');
    info('Testing various natural language selectors...');
    
    const selectors = [
      'main heading',
      'first paragraph',
      'link with more information'
    ];
    
    for (const selector of selectors) {
      const result = await pc.getText(selector);
      testsRun++;
      const content = typeof result.data === 'string' ? result.data : result.data?.text || '';
      if (content) {
        success(`Found element: "${selector}" → "${content.substring(0, 30)}..."`);
        testsPassed++;
      } else {
        error(`Could not find: "${selector}"`);
      }
    }
    
    // Test 10: Performance Metrics
    section('Test 10: AI Optimization Verification');
    info('Analyzing response sizes for AI optimization...');
    
    const avgSize = Math.round(totalResponseSize / testsRun);
    
    log(`📊 Performance Metrics:`, colors.magenta);
    log(`  Average response size: ${avgSize} bytes`, colors.yellow);
    log(`  Maximum response size: ${maxResponseSize} bytes`, colors.yellow);
    log(`  Target size: <1024 bytes`, colors.yellow);
    
    if (avgSize < 1024) {
      success('✨ Responses are AI-optimized! Average < 1KB');
      testsRun++;
      testsPassed++;
    } else {
      error('Response optimization needs improvement');
      testsRun++;
    }
    
  } catch (err) {
    error(`Test failed with error: ${err}`);
  } finally {
    // Clean up
    section('Cleanup');
    info('Closing browser...');
    await pc.close();
    success('Browser closed');
  }
  
  // Final Report
  section('📊 Final Test Report');
  
  const passRate = Math.round((testsPassed / testsRun) * 100);
  
  log(`Tests Run: ${testsRun}`, colors.bright);
  log(`Tests Passed: ${testsPassed}`, colors.green);
  log(`Tests Failed: ${testsRun - testsPassed}`, testsRun - testsPassed > 0 ? colors.red : colors.green);
  log(`Pass Rate: ${passRate}%`, passRate >= 80 ? colors.green : colors.red);
  
  console.log();
  
  if (passRate === 100) {
    log('🎉 PERFECT SCORE! PlayClone successfully tested itself!', colors.bright + colors.green);
    log('🤖 Meta-testing complete: PlayClone is production ready!', colors.bright + colors.green);
  } else if (passRate >= 80) {
    log('✅ PlayClone self-test PASSED with good results!', colors.green);
  } else {
    log('⚠️  PlayClone self-test needs improvement', colors.yellow);
  }
  
  console.log();
  info('This was PlayClone testing PlayClone - the ultimate dogfooding!');
  
  return passRate === 100 ? 0 : 1;
}

// Run the self-tests
if (require.main === module) {
  runSelfTests()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(err => {
      error(`Fatal error: ${err}`);
      process.exit(1);
    });
}

export { runSelfTests };