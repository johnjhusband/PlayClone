/**
 * Test KineticUranium using canvas click coordinates
 */

const { PlayClone } = require('./dist/index');

async function testKUCanvas() {
  const playclone = new PlayClone({
    headless: false,
    devtools: true,
    viewport: { width: 1920, height: 1080 }
  });

  try {
    console.log('🚀 Testing KineticUranium with canvas clicks...\n');

    // Start error capture
    console.log('🔬 Starting deep error extraction...');
    await playclone.startDeepErrorExtraction();

    // Navigate to game
    console.log('📄 Navigating to https://devgame.flippi.ai...');
    await playclone.navigate('https://devgame.flippi.ai');

    // Wait for game to load
    console.log('⏳ Waiting 10 seconds for game to fully load...');
    await new Promise(r => setTimeout(r, 10000));

    // Take a screenshot to see what we're working with
    console.log('📸 Taking screenshot...');
    const screenshot = await playclone.screenshot();
    console.log('  Screenshot taken:', screenshot.success);

    console.log('\n🎮 Attempting canvas clicks for game interaction...');

    // Common button positions for games (center-based)
    // Training button might be in the center or upper portion
    const clicks = [
      { x: 960, y: 400, label: 'Upper center (Training?)' },
      { x: 960, y: 500, label: 'Center (Play/Start?)' },
      { x: 960, y: 600, label: 'Lower center' },
      { x: 800, y: 500, label: 'Left center' },
      { x: 1120, y: 500, label: 'Right center' }
    ];

    for (const pos of clicks) {
      console.log(`\n  Clicking at ${pos.label} (${pos.x}, ${pos.y})...`);
      const result = await playclone.clickAt(pos.x, pos.y);
      console.log(`  Result: ${result.success}`);

      // Wait to see if anything happens
      await new Promise(r => setTimeout(r, 2000));

      // Check if we triggered any errors
      const summary = await playclone.getDeepErrorSummary();
      if (summary) {
        const errorCount = (summary.consoleErrors?.length || 0) +
                          (summary.runtimeErrors?.length || 0);
        if (errorCount > 0) {
          console.log(`  🔴 Errors detected after click: ${errorCount}`);
          break;
        }
      }
    }

    // Try clicking on Israel if Training worked
    console.log('\n  Trying Israel click (left side)...');
    await playclone.clickAt(600, 500);
    await new Promise(r => setTimeout(r, 2000));

    // Type the command
    console.log('\n  Typing command...');
    await playclone.type('nuke Iran');
    await playclone.press('Enter');

    // Wait for errors
    console.log('\n⏳ Waiting for errors...');
    await new Promise(r => setTimeout(r, 5000));

    // Check final error state
    const finalSummary = await playclone.getDeepErrorSummary();
    if (finalSummary) {
      const totalErrors = (finalSummary.compilationErrors?.length || 0) +
                         (finalSummary.runtimeErrors?.length || 0) +
                         (finalSummary.consoleErrors?.length || 0);

      console.log(`\n📊 Total Errors Found: ${totalErrors}`);

      if (finalSummary.consoleErrors?.length > 0) {
        console.log('\n🔴 Console Errors (THE 2 ERRORS YOU WANT!):');
        finalSummary.consoleErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.text}`);
          if (err.location) {
            console.log(`     Location: ${err.location.url}:${err.location.lineNumber}`);
          }
        });
      }

      if (finalSummary.runtimeErrors?.length > 0) {
        console.log('\n🔴 Runtime Errors:');
        finalSummary.runtimeErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.message}`);
        });
      }
    }

    // Get full report
    const report = playclone.getDeepErrorReport();
    console.log('\n📝 Full Report:');
    console.log(report);

    console.log('\n✅ Browser stays open for 15 seconds...');
    await new Promise(r => setTimeout(r, 15000));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await playclone.close();
    console.log('👋 Browser closed');
  }
}

console.log('='.repeat(60));
console.log('KINETIC URANIUM CANVAS INTERACTION TEST');
console.log('Using coordinate-based clicks for WebGL game');
console.log('='.repeat(60));

testKUCanvas().catch(console.error);