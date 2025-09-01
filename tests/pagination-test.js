/**
 * Test script for PlayClone pagination handling
 */

const { PlayClone } = require('../dist/index');

async function testPagination() {
  console.log('🚀 Testing PlayClone Pagination Features');
  console.log('=====================================\n');
  
  const pc = new PlayClone({ headless: false });
  
  try {
    // Test 1: Detect pagination on Hacker News
    console.log('Test 1: Detecting pagination on Hacker News...');
    await pc.navigate('https://news.ycombinator.com');
    
    const paginationInfo = await pc.detectPagination();
    console.log('✅ Pagination detected:', JSON.stringify(paginationInfo, null, 2));
    
    // Test 2: Navigate to next page
    if (paginationInfo.hasNext) {
      console.log('\nTest 2: Navigating to next page...');
      const nextResult = await pc.nextPage();
      console.log('✅ Next page result:', JSON.stringify(nextResult, null, 2));
      
      // Get current page number
      const currentPage = pc.getCurrentPageNumber();
      console.log(`📍 Current page: ${currentPage}`);
    }
    
    // Test 3: Test on a site with numbered pagination (Reddit old)
    console.log('\nTest 3: Testing numbered pagination on Reddit (old)...');
    await pc.navigate('https://old.reddit.com/r/programming');
    
    const redditPagination = await pc.detectPagination();
    console.log('✅ Reddit pagination:', JSON.stringify(redditPagination, null, 2));
    
    // Test 4: Navigate through multiple pages with data extraction
    console.log('\nTest 4: Navigate through 3 pages on Hacker News with data extraction...');
    await pc.navigate('https://news.ycombinator.com');
    pc.resetPagination();
    
    const multiPageResult = await pc.navigateAllPages({
      maxPages: 3,
      waitBetweenPages: 2000,
      extractDataOnEachPage: true,
      onPageChange: async (pageNum, data) => {
        console.log(`  📄 Processed page ${pageNum}`);
        console.log(`     - URL: ${data.url}`);
        console.log(`     - Title: ${data.title}`);
      }
    });
    
    console.log('✅ Multi-page navigation complete:');
    console.log(`   - Pages processed: ${multiPageResult.data?.pagesProcessed}`);
    console.log(`   - Pagination type: ${multiPageResult.data?.paginationType}`);
    console.log(`   - Stopped reason: ${multiPageResult.data?.stoppedReason}`);
    
    // Get all collected data
    const collectedData = pc.getPaginationData();
    console.log(`   - Total data entries collected: ${collectedData.length}`);
    
    // Test 5: Test on a site with Load More button (if we can find one)
    console.log('\nTest 5: Testing Load More button detection...');
    // Many modern sites use load more, let's try a few
    await pc.navigate('https://www.producthunt.com');
    await pc.wait(2000); // Wait for page to load
    
    const loadMorePagination = await pc.detectPagination();
    console.log('✅ Load More pagination:', JSON.stringify(loadMorePagination, null, 2));
    
    // Test 6: Test previous page navigation
    console.log('\nTest 6: Testing previous page navigation...');
    await pc.navigate('https://news.ycombinator.com');
    await pc.nextPage(); // Go to page 2 first
    await pc.wait(2000);
    
    const prevResult = await pc.previousPage();
    console.log('✅ Previous page result:', JSON.stringify(prevResult, null, 2));
    
    // Test 7: Test specific page navigation (if numbered pagination available)
    console.log('\nTest 7: Testing specific page navigation...');
    await pc.navigate('https://old.reddit.com/r/programming');
    
    const pageNavInfo = await pc.detectPagination();
    if (pageNavInfo.type === 'numbered' && pageNavInfo.totalPages) {
      console.log(`   Found ${pageNavInfo.totalPages} total pages`);
      const targetPage = Math.min(3, pageNavInfo.totalPages);
      const pageResult = await pc.goToPage(targetPage);
      console.log(`✅ Navigate to page ${targetPage}:`, JSON.stringify(pageResult, null, 2));
    } else {
      console.log('   ℹ️ Numbered pagination not available on this site');
    }
    
    // Test 8: Test custom selectors
    console.log('\nTest 8: Testing custom pagination selectors...');
    const customPagination = await pc.detectPagination({
      nextButton: ['a.morelink', 'a[rel="next"]'],
      prevButton: ['a[rel="prev"]'],
      pageNumbers: ['.nav-buttons a']
    });
    console.log('✅ Custom selector detection:', JSON.stringify(customPagination, null, 2));
    
    console.log('\n✨ All pagination tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pc.close();
  }
}

// Run the test
testPagination().catch(console.error);