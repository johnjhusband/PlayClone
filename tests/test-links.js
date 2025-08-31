/**
 * Test getLinks functionality
 */

const { PlayClone } = require('../dist/index');

async function testLinks() {
  const playclone = new PlayClone({ headless: true });
  
  try {
    await playclone.navigate('https://example.com');
    const result = await playclone.getLinks();
    
    console.log('Links result:', JSON.stringify(result, null, 2));
  } finally {
    await playclone.close();
  }
}

testLinks().catch(console.error);