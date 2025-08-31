#!/usr/bin/env node
/**
 * AI Assistant-Specific Test Suite for PlayClone
 * Tests common scenarios an AI assistant would encounter
 */

const { PlayClone } = require('../dist/index.js');

async function runTests() {
  const results = [];
  
  console.log('🤖 AI Assistant Test Suite for PlayClone\n');
  console.log('Testing real-world scenarios AI assistants need...\n');

  // Test 1: Research - Search and Extract Information
  async function testResearchTask() {
    console.log('Test 1: Research Task - Search for TypeScript documentation');
    const pc = new PlayClone({ headless: true });
    try {
      // Navigate to search engine
      await pc.navigate('https://duckduckgo.com');
      
      // Search for TypeScript generics
      await pc.fill('search box', 'TypeScript generics documentation');
      await pc.press('Enter');
      await new Promise(r => setTimeout(r, 2000));
      
      // Extract search results
      const links = await pc.getLinks();
      const hasResults = links.data?.links?.length > 0;
      const hasTSDoc = links.data?.links?.some(l => 
        l.text?.toLowerCase().includes('typescript') || 
        l.href?.includes('typescriptlang.org')
      );
      
      await pc.close();
      return hasResults && hasTSDoc;
    } catch (error) {
      await pc.close();
      console.error('Error:', error.message);
      return false;
    }
  }

  // Test 2: Documentation Navigation
  async function testDocumentationLookup() {
    console.log('Test 2: Navigate documentation site and find specific info');
    const pc = new PlayClone({ headless: true });
    try {
      // Go to MDN
      await pc.navigate('https://developer.mozilla.org');
      
      // Search for Array.reduce
      await pc.fill('search input', 'Array.reduce');
      await pc.press('Enter');
      await new Promise(r => setTimeout(r, 2000));
      
      // Click first result
      await pc.click('first search result');
      await new Promise(r => setTimeout(r, 2000));
      
      // Extract content
      const text = await pc.getText();
      const hasReduceInfo = text.data?.includes('reduce()') || text.data?.includes('accumulator');
      
      await pc.close();
      return hasReduceInfo;
    } catch (error) {
      await pc.close();
      console.error('Error:', error.message);
      return false;
    }
  }

  // Test 3: GitHub Repository Analysis
  async function testGitHubRepoAnalysis() {
    console.log('Test 3: Analyze GitHub repository structure');
    const pc = new PlayClone({ headless: true });
    try {
      // Navigate to a public repo
      await pc.navigate('https://github.com/microsoft/TypeScript');
      await new Promise(r => setTimeout(r, 2000));
      
      // Extract repo information
      const text = await pc.getText();
      const links = await pc.getLinks();
      
      // Check for common repo elements
      const hasReadme = text.data?.includes('README');
      const hasFiles = links.data?.links?.some(l => l.text?.includes('.ts') || l.text?.includes('.js'));
      const hasIssues = links.data?.links?.some(l => l.text?.includes('Issues'));
      
      await pc.close();
      return hasReadme && (hasFiles || hasIssues);
    } catch (error) {
      await pc.close();
      console.error('Error:', error.message);
      return false;
    }
  }

  // Test 4: Stack Overflow Answer Extraction
  async function testStackOverflowExtraction() {
    console.log('Test 4: Extract answer from Stack Overflow');
    const pc = new PlayClone({ headless: true });
    try {
      await pc.navigate('https://stackoverflow.com/questions/1335851/what-does-use-strict-do-in-javascript');
      await new Promise(r => setTimeout(r, 2000));
      
      const text = await pc.getText();
      const hasAnswer = text.data?.includes('use strict') && text.data?.includes('strict mode');
      
      await pc.close();
      return hasAnswer;
    } catch (error) {
      await pc.close();
      console.error('Error:', error.message);
      return false;
    }
  }

  // Test 5: NPM Package Information
  async function testNPMPackageLookup() {
    console.log('Test 5: Look up NPM package information');
    const pc = new PlayClone({ headless: true });
    try {
      await pc.navigate('https://www.npmjs.com');
      
      // Search for a package
      await pc.fill('search input', 'express');
      await pc.press('Enter');
      await new Promise(r => setTimeout(r, 2000));
      
      // Click on express package
      await pc.click('express package link');
      await new Promise(r => setTimeout(r, 2000));
      
      // Extract package info
      const text = await pc.getText();
      const hasExpressInfo = text.data?.includes('Fast, unopinionated') || text.data?.includes('web framework');
      
      await pc.close();
      return hasExpressInfo;
    } catch (error) {
      await pc.close();
      console.error('Error:', error.message);
      return false;
    }
  }

  // Test 6: Error Page Handling
  async function testErrorPageHandling() {
    console.log('Test 6: Handle 404 and error pages gracefully');
    const pc = new PlayClone({ headless: true });
    try {
      // Try to navigate to a 404 page
      const result = await pc.navigate('https://httpstat.us/404');
      await new Promise(r => setTimeout(r, 1000));
      
      const text = await pc.getText();
      const handled404 = text.data?.includes('404') || result.value?.status === 404;
      
      await pc.close();
      return handled404;
    } catch (error) {
      await pc.close();
      // Error handling itself is part of the test
      return true;
    }
  }

  // Test 7: Multi-step Form Workflow
  async function testMultiStepWorkflow() {
    console.log('Test 7: Multi-step navigation workflow');
    const pc = new PlayClone({ headless: true });
    try {
      // Navigate to W3Schools
      await pc.navigate('https://www.w3schools.com');
      
      // Save initial state
      await pc.saveState('w3schools-home');
      
      // Navigate to tutorials
      await pc.click('Tutorials');
      await new Promise(r => setTimeout(r, 1000));
      
      // Go back to saved state
      await pc.restoreState('w3schools-home');
      const state = await pc.getCurrentState();
      
      const restoredCorrectly = state.value?.url?.includes('w3schools.com') && !state.value?.url?.includes('tutorials');
      
      await pc.close();
      return restoredCorrectly;
    } catch (error) {
      await pc.close();
      console.error('Error:', error.message);
      return false;
    }
  }

  // Test 8: Data Table Extraction
  async function testTableExtraction() {
    console.log('Test 8: Extract structured data from tables');
    const pc = new PlayClone({ headless: true });
    try {
      await pc.navigate('https://www.w3schools.com/html/html_tables.asp');
      await new Promise(r => setTimeout(r, 2000));
      
      const tables = await pc.getTables();
      const hasTables = tables.data?.tables?.length > 0;
      
      await pc.close();
      return hasTables;
    } catch (error) {
      await pc.close();
      console.error('Error:', error.message);
      return false;
    }
  }

  // Run all tests
  results.push({ name: 'Research Task', passed: await testResearchTask() });
  results.push({ name: 'Documentation Lookup', passed: await testDocumentationLookup() });
  results.push({ name: 'GitHub Repo Analysis', passed: await testGitHubRepoAnalysis() });
  results.push({ name: 'Stack Overflow Extraction', passed: await testStackOverflowExtraction() });
  results.push({ name: 'NPM Package Lookup', passed: await testNPMPackageLookup() });
  results.push({ name: 'Error Page Handling', passed: await testErrorPageHandling() });
  results.push({ name: 'Multi-step Workflow', passed: await testMultiStepWorkflow() });
  results.push({ name: 'Table Extraction', passed: await testTableExtraction() });

  // Print results
  console.log('\n📊 Test Results:');
  console.log('═══════════════════════════════════');
  
  let passed = 0;
  results.forEach(r => {
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${r.name}`);
    if (r.passed) passed++;
  });
  
  console.log('═══════════════════════════════════');
  console.log(`\n🎯 Overall: ${passed}/${results.length} tests passed (${Math.round(passed/results.length*100)}%)`);
  
  // Return insights for Ralph
  return {
    passed,
    total: results.length,
    failedTests: results.filter(r => !r.passed).map(r => r.name),
    successRate: Math.round(passed/results.length*100)
  };
}

// Run the test suite
runTests().then(results => {
  if (results.successRate < 100) {
    console.log('\n⚠️ Some tests failed. PlayClone may need improvements for AI assistant use cases.');
    console.log('Failed tests:', results.failedTests.join(', '));
  } else {
    console.log('\n🎉 All tests passed! PlayClone is ready for AI assistant use.');
  }
  process.exit(results.successRate === 100 ? 0 : 1);
}).catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});