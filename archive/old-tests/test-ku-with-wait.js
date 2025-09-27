/**
 * Test KineticUranium with proper wait time for WebGL game to load
 */

const { PlayClone } = require('./dist/index');

async function testKU() {
  const playclone = new PlayClone({
    headless: false,
    devtools: true,
    viewport: { width: 1920, height: 1080 }
  });

  try {
    console.log('🚀 Testing KineticUranium...\n');

    // Start error capture before navigation
    console.log('🔬 Starting deep error extraction...');
    await playclone.startDeepErrorExtraction();

    // Navigate to game
    console.log('📄 Navigating to https://devgame.flippi.ai...');
    await playclone.navigate('https://devgame.flippi.ai');

    // Wait longer for WebGL game to fully initialize
    console.log('⏳ Waiting 10 seconds for game to fully load...');
    await new Promise(r => setTimeout(r, 10000));

    // Try to click on any visible button or text
    console.log('\n🎮 Attempting to interact with game...');

    // Try various selectors that might work for a game menu
    const attempts = [
      'Training',
      'button containing Training',
      'text=Training',
      'Play',
      'Start',
      'New Game',
      'Campaign',
      'Single Player'
    ];

    for (const selector of attempts) {
      console.log(`  Trying: "${selector}"...`);
      const result = await playclone.click(selector);
      if (result.success) {
        console.log(`  ✅ Successfully clicked: ${selector}`);
        break;
      } else {
        console.log(`  ❌ Not found: ${selector}`);
      }
    }

    // Wait and check for Israel option
    await new Promise(r => setTimeout(r, 3000));

    console.log('\n  Trying to click "Israel"...');
    const israelResult = await playclone.click('Israel');
    console.log(`  Israel click result: ${israelResult.success}`);

    // Wait and try to interact with AI general
    await new Promise(r => setTimeout(r, 3000));

    console.log('\n  Trying to type command...');
    await playclone.type('nuke Iran');
    await playclone.press('Enter');

    // Wait for errors
    console.log('\n⏳ Waiting 5 seconds for errors to appear...');
    await new Promise(r => setTimeout(r, 5000));

    // Check for errors
    const summary = await playclone.getDeepErrorSummary();
    if (summary) {
      const totalErrors = (summary.compilationErrors?.length || 0) +
                         (summary.runtimeErrors?.length || 0) +
                         (summary.consoleErrors?.length || 0) +
                         (summary.networkErrors?.length || 0) +
                         (summary.pageErrors?.length || 0);

      console.log(`\n📊 Total Errors Found: ${totalErrors}`);

      if (summary.consoleErrors?.length > 0) {
        console.log('\n🔴 Console Errors:');
        summary.consoleErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.text}`);
        });
      }
    }

    console.log('\n✅ Browser will stay open for 20 seconds for manual inspection...');
    await new Promise(r => setTimeout(r, 20000));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await playclone.close();
    console.log('👋 Browser closed');
  }
}

testKU().catch(console.error);