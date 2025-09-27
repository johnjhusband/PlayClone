/**
 * Specific test for Kinetic Uranium error capture
 * This test will navigate to the game and trigger the known errors
 */

const { PlayClone } = require('./dist/index');

async function testKineticUraniumErrors() {
  const playclone = new PlayClone({
    headless: false,
    devtools: true,
    viewport: { width: 1920, height: 1080 }
  });

  try {
    console.log('🚀 Starting Kinetic Uranium Error Test...\n');

    // Start deep error extraction BEFORE navigation
    console.log('🔬 Starting deep error extraction...');
    await playclone.startDeepErrorExtraction();

    // Navigate to KU
    console.log('📄 Navigating to Kinetic Uranium...');
    await playclone.navigate('https://devgame.flippi.ai');

    // Wait for game to load
    console.log('⏳ Waiting for game to load (10s)...');
    await new Promise(r => setTimeout(r, 10000));

    // Take screenshot to see current state
    console.log('📸 Taking screenshot...');
    const screenshot = await playclone.screenshot();
    if (screenshot.success) {
      console.log('Screenshot saved:', screenshot.value);
    }

    // Try to trigger Training mode
    console.log('\n🎮 Attempting to start Training mode...');

    // Click in center area for Training button
    const trainingClick = await playclone.clickAt(960, 500);
    console.log('Training button click:', trainingClick.success);

    // Wait for potential mode transition
    await new Promise(r => setTimeout(r, 3000));

    // Click on Israel (left side of map)
    console.log('\n🗺️ Clicking on Israel (left side)...');
    await playclone.clickAt(600, 500);
    await new Promise(r => setTimeout(r, 2000));

    // Type the command that causes errors
    console.log('\n💬 Typing command: "nuke Iran"');
    await playclone.type('nuke Iran');
    await new Promise(r => setTimeout(r, 500));
    await playclone.press('Enter');

    // Wait for errors to generate
    console.log('\n⏳ Waiting for errors to generate (5s)...');
    await new Promise(r => setTimeout(r, 5000));

    // Get comprehensive error summary
    const summary = await playclone.getDeepErrorSummary();
    console.log('\n📊 DEEP ERROR SUMMARY:');
    console.log('═'.repeat(50));

    if (summary) {
      const totalErrors =
        (summary.compilationErrors?.length || 0) +
        (summary.runtimeErrors?.length || 0) +
        (summary.consoleErrors?.length || 0) +
        (summary.networkErrors?.length || 0) +
        (summary.pageErrors?.length || 0);

      console.log(`Total Errors Found: ${totalErrors}`);
      console.log(`  Compilation: ${summary.compilationErrors?.length || 0}`);
      console.log(`  Runtime: ${summary.runtimeErrors?.length || 0}`);
      console.log(`  Console: ${summary.consoleErrors?.length || 0}`);
      console.log(`  Network: ${summary.networkErrors?.length || 0}`);
      console.log(`  Page: ${summary.pageErrors?.length || 0}`);

      // Display the specific errors we're looking for
      if (summary.consoleErrors?.length > 0) {
        console.log('\n🔴 CONSOLE ERRORS (THE ONES WE WANT!):');
        summary.consoleErrors.forEach((err, i) => {
          console.log(`\nError #${i + 1}:`);
          console.log(`  Message: ${err.text}`);
          if (err.location) {
            console.log(`  Location: ${err.location.url}:${err.location.lineNumber}`);
          }
          if (err.stackTrace) {
            console.log(`  Stack: ${err.stackTrace}`);
          }
        });
      }

      if (summary.runtimeErrors?.length > 0) {
        console.log('\n🔴 RUNTIME ERRORS:');
        summary.runtimeErrors.forEach((err, i) => {
          console.log(`\nError #${i + 1}:`);
          console.log(`  Message: ${err.message}`);
          if (err.stackTrace) {
            console.log(`  Stack: ${err.stackTrace.substring(0, 200)}...`);
          }
        });
      }
    } else {
      console.log('❌ No error summary available');
    }

    // Also try manual error extraction
    console.log('\n📝 Attempting manual error extraction...');
    const allEntries = await playclone.extractAllConsoleEntries();
    if (allEntries.success && allEntries.value) {
      const errors = allEntries.value.filter(e => e.level === 'error');
      if (errors.length > 0) {
        console.log(`Found ${errors.length} console errors via CDP:`);
        errors.forEach((err, i) => {
          console.log(`\n  Error #${i + 1}: ${err.text}`);
        });
      }
    }

    // Get the full error report
    const report = playclone.getDeepErrorReport();
    console.log('\n📄 FULL ERROR REPORT:');
    console.log(report);

    // Keep browser open for inspection
    console.log('\n✅ Test complete! Browser stays open for 20 seconds...');
    await new Promise(r => setTimeout(r, 20000));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await playclone.close();
    console.log('👋 Browser closed');
  }
}

// Run the test
console.log('═'.repeat(60));
console.log('KINETIC URANIUM ERROR CAPTURE TEST');
console.log('Target: Capture the 2 specific errors when commanding units');
console.log('═'.repeat(60));
console.log('');

testKineticUraniumErrors().catch(console.error);