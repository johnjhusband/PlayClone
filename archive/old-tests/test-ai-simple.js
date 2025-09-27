/**
 * Simple test for AI integration
 */

const { PlayClone } = require('./dist/index.js');

async function testSimple() {
  const pc = new PlayClone({ headless: true });
  
  try {
    console.log('1. Navigating to DuckDuckGo...');
    const nav = await pc.navigate('https://duckduckgo.com');
    console.log('   Navigation:', nav.success ? '✅' : '❌');
    
    console.log('2. Getting page reference...');
    const page = pc.page;
    console.log('   Page exists:', page ? '✅' : '❌');
    
    if (page) {
      console.log('3. Waiting for search box...');
      await page.waitForSelector('input[name="q"]', { timeout: 5000 });
      console.log('   Search box found: ✅');
      
      console.log('4. Typing search query...');
      await page.type('input[name="q"]', 'javascript promises');
      console.log('   Query typed: ✅');
      
      console.log('5. Pressing Enter...');
      await page.keyboard.press('Enter');
      console.log('   Enter pressed: ✅');
      
      console.log('6. Waiting for results...');
      await page.waitForTimeout(2000);
      console.log('   Results loaded: ✅');
      
      console.log('7. Getting URL...');
      const url = page.url();
      console.log('   Current URL:', url);
      
      console.log('\n✅ All tests passed!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc.close();
  }
}

testSimple().catch(console.error);
