#!/usr/bin/env node

/**
 * Test Search Engine Improvements
 * Tests the enhanced search engine handling with anti-automation bypass
 */

const { PlayClone } = require('./dist/index.js');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSearchEngine(pc, engineName, engineUrl, query) {
  console.log(`\n📋 Testing ${engineName} Search`);
  console.log(`   Navigating to ${engineUrl}...`);
  
  const navResult = await pc.navigate(engineUrl);
  if (!navResult.success) {
    console.log(`   ❌ Failed to navigate: ${navResult.error}`);
    return false;
  }
  console.log(`   ✅ Navigation successful`);
  
  // Use the new search method
  console.log(`   Performing search for: "${query}"...`);
  const searchResult = await pc.search(query);
  
  if (!searchResult.success) {
    console.log(`   ❌ Search failed: ${searchResult.error}`);
    return false;
  }
  
  console.log(`   ✅ Search successful`);
  console.log(`   📍 Results URL: ${searchResult.value?.url}`);
  
  // Extract search results
  console.log(`   Extracting search results...`);
  const results = await pc.getSearchResults(5);
  
  if (results.data && results.data.length > 0) {
    console.log(`   ✅ Found ${results.data.length} results`);
    console.log(`   First result: ${results.data[0]?.title}`);
    return true;
  } else {
    console.log(`   ⚠️ No results extracted (may be due to anti-automation)`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing Enhanced Search Engine Handling\n');
  console.log('============================================================');
  
  const pc = new PlayClone({ 
    headless: false, // Set to false to see the browser
    viewport: { width: 1280, height: 720 }
  });
  
  let passCount = 0;
  let totalTests = 0;
  
  try {
    // Test Google
    totalTests++;
    if (await testSearchEngine(pc, 'Google', 'https://www.google.com', 'PlayClone browser automation')) {
      passCount++;
    }
    await delay(2000);
    
    // Test DuckDuckGo
    totalTests++;
    if (await testSearchEngine(pc, 'DuckDuckGo', 'https://duckduckgo.com', 'AI browser control')) {
      passCount++;
    }
    await delay(2000);
    
    // Test Bing
    totalTests++;
    if (await testSearchEngine(pc, 'Bing', 'https://www.bing.com', 'natural language automation')) {
      passCount++;
    }
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
  } finally {
    await pc.close();
  }
  
  console.log('\n============================================================');
  console.log('📊 SEARCH ENGINE TEST RESULTS');
  console.log('============================================================');
  console.log(`✅ Passed: ${passCount}/${totalTests} (${Math.round(passCount/totalTests*100)}%)`);
  
  if (passCount === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! Search engine handling is working!');
  } else if (passCount > 0) {
    console.log('\n✅ PARTIAL SUCCESS: Some search engines working');
    console.log('📝 Note: Search engines have strong anti-automation measures');
  } else {
    console.log('\n⚠️ All search engines blocked automation');
    console.log('📝 This is expected behavior due to anti-bot measures');
  }
  
  console.log('\n💡 Improvements implemented:');
  console.log('   - Human-like typing delays');
  console.log('   - Mouse movement simulation');
  console.log('   - Proper user agent headers');
  console.log('   - Multiple selector fallbacks');
  console.log('   - Intelligent wait strategies');
}

// Run the tests
runTests().catch(console.error);