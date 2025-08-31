/**
 * Test PlayClone with real popular websites
 */

const { PlayClone } = require('./dist/index.js');

async function testRealWebsites() {
  const pc = new PlayClone({ 
    headless: true,
    timeout: 30000 
  });
  
  const tests = [];
  
  try {
    console.log('🎯 Testing PlayClone with Real Websites');
    console.log('=' .repeat(50));
    
    // Test 1: Google Search
    console.log('\n1️⃣  Google Search Test');
    try {
      await pc.navigate('https://google.com');
      await pc.fill('search', 'PlayClone browser automation');
      await pc.click('search button');
      tests.push({ name: 'Google Search', status: 'PASSED ✅' });
      console.log('   ✅ Google search automation successful');
    } catch (e) {
      tests.push({ name: 'Google Search', status: 'FAILED ❌' });
      console.log('   ❌ Google search failed:', e.message);
    }
    
    // Test 2: GitHub Navigation
    console.log('\n2️⃣  GitHub Repository Browse');
    try {
      await pc.navigate('https://github.com');
      await pc.click('search');
      await pc.fill('search input', 'playwright');
      const searchText = await pc.getText();
      if (searchText.data?.text) {
        tests.push({ name: 'GitHub Navigation', status: 'PASSED ✅' });
        console.log('   ✅ GitHub navigation successful');
      }
    } catch (e) {
      tests.push({ name: 'GitHub Navigation', status: 'FAILED ❌' });
      console.log('   ❌ GitHub navigation failed:', e.message);
    }
    
    // Test 3: Wikipedia
    console.log('\n3️⃣  Wikipedia Article');
    try {
      await pc.navigate('https://en.wikipedia.org/wiki/Web_scraping');
      const text = await pc.getText();
      if (text.data?.text?.includes('Web scraping')) {
        tests.push({ name: 'Wikipedia', status: 'PASSED ✅' });
        console.log('   ✅ Wikipedia content extraction successful');
      }
    } catch (e) {
      tests.push({ name: 'Wikipedia', status: 'FAILED ❌' });
      console.log('   ❌ Wikipedia test failed:', e.message);
    }
    
    // Test 4: DuckDuckGo
    console.log('\n4️⃣  DuckDuckGo Search');
    try {
      await pc.navigate('https://duckduckgo.com');
      await pc.fill('search', 'AI browser automation');
      await pc.click('search button');
      tests.push({ name: 'DuckDuckGo', status: 'PASSED ✅' });
      console.log('   ✅ DuckDuckGo search successful');
    } catch (e) {
      tests.push({ name: 'DuckDuckGo', status: 'FAILED ❌' });
      console.log('   ❌ DuckDuckGo search failed:', e.message);
    }
    
    // Test 5: Hacker News
    console.log('\n5️⃣  Hacker News');
    try {
      await pc.navigate('https://news.ycombinator.com');
      const links = await pc.getLinks();
      if (links.data?.internal?.length > 0) {
        tests.push({ name: 'Hacker News', status: 'PASSED ✅' });
        console.log('   ✅ Hacker News link extraction successful');
        console.log(`   📊 Found ${links.data.internal.length} internal links`);
      }
    } catch (e) {
      tests.push({ name: 'Hacker News', status: 'FAILED ❌' });
      console.log('   ❌ Hacker News test failed:', e.message);
    }
    
    // Test 6: Example.com (baseline)
    console.log('\n6️⃣  Example.com (Baseline)');
    try {
      await pc.navigate('https://example.com');
      await pc.click('More information');
      await pc.back();
      tests.push({ name: 'Example.com', status: 'PASSED ✅' });
      console.log('   ✅ Example.com navigation successful');
    } catch (e) {
      tests.push({ name: 'Example.com', status: 'FAILED ❌' });
      console.log('   ❌ Example.com test failed:', e.message);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    
    const passed = tests.filter(t => t.status.includes('PASSED')).length;
    const total = tests.length;
    const passRate = Math.round((passed / total) * 100);
    
    tests.forEach(test => {
      console.log(`   ${test.name}: ${test.status}`);
    });
    
    console.log('\n' + '='.repeat(50));
    console.log(`✨ Pass Rate: ${passRate}% (${passed}/${total} tests)`);
    
    if (passRate === 100) {
      console.log('🎉 PERFECT SCORE! All real website tests passed!');
    } else if (passRate >= 80) {
      console.log('✅ EXCELLENT! Most real website tests passed.');
    } else if (passRate >= 60) {
      console.log('⚠️  GOOD. Some tests need attention.');
    } else {
      console.log('❌ NEEDS WORK. Many tests are failing.');
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await pc.close();
    console.log('\n👋 Browser closed.');
  }
}

// Run tests
testRealWebsites().catch(console.error);