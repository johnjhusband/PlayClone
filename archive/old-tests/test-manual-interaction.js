/**
 * Open KineticUranium for manual interaction testing
 */

const { PlayClone } = require('./dist/index');

async function openForManualTesting() {
  const playclone = new PlayClone({
    headless: false,
    devtools: true
  });

  try {
    console.log('🚀 Opening KineticUranium for manual testing...\n');

    // Start deep error extraction BEFORE navigation
    console.log('🔬 Starting deep error extraction...');
    const deepResult = await playclone.startDeepErrorExtraction();
    console.log('Deep extraction started:', deepResult.success);

    // Navigate to KineticUranium
    console.log('\n📄 Navigating to https://devgame.flippi.ai...');
    const navResult = await playclone.navigate('https://devgame.flippi.ai');
    if (!navResult.success) {
      console.error('Failed to navigate:', navResult.error);
      return;
    }

    console.log('\n✅ Browser opened successfully!');
    console.log('\n📝 MANUAL TESTING INSTRUCTIONS:');
    console.log('====================================');
    console.log('1. Click on "Training" button');
    console.log('2. Click on "Israel" option');
    console.log('3. Tell the AI general to "nuke Iran"');
    console.log('4. Watch for 2 errors to appear in console');
    console.log('====================================\n');

    console.log('⏰ Browser will stay open for 2 minutes.');
    console.log('   Perform the interaction sequence above.');
    console.log('   Errors will be captured automatically.\n');

    // Check for errors every 5 seconds
    let checkCount = 0;
    const checkInterval = setInterval(async () => {
      checkCount++;
      console.log(`\n[Check ${checkCount}] Checking for errors...`);

      const deepSummary = await playclone.getDeepErrorSummary();
      if (deepSummary) {
        const totalErrors = (deepSummary.compilationErrors?.length || 0) +
                           (deepSummary.runtimeErrors?.length || 0) +
                           (deepSummary.consoleErrors?.length || 0) +
                           (deepSummary.networkErrors?.length || 0) +
                           (deepSummary.pageErrors?.length || 0);

        if (totalErrors > 0) {
          console.log(`\n🔴 ERRORS DETECTED: ${totalErrors} total`);

          if (deepSummary.consoleErrors?.length > 0) {
            console.log(`\n  Console Errors (${deepSummary.consoleErrors.length}):`);
            deepSummary.consoleErrors.forEach((err, i) => {
              console.log(`    ${i + 1}. ${err.text}`);
              if (err.location) {
                console.log(`       Location: ${err.location.url}:${err.location.lineNumber}`);
              }
            });
          }

          if (deepSummary.runtimeErrors?.length > 0) {
            console.log(`\n  Runtime Errors (${deepSummary.runtimeErrors.length}):`);
            deepSummary.runtimeErrors.forEach((err, i) => {
              console.log(`    ${i + 1}. ${err.message}`);
            });
          }

          // Stop checking once we found errors
          clearInterval(checkInterval);

          // Get full report
          console.log('\n📝 Full Error Report:');
          console.log('======================');
          const report = playclone.getDeepErrorReport();
          console.log(report);

          // Keep browser open for inspection
          console.log('\n✅ Errors captured! Browser will stay open for 30 more seconds...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        } else {
          console.log('  No errors detected yet...');
        }
      }

      if (checkCount >= 24) { // 2 minutes
        clearInterval(checkInterval);
        console.log('\n⏰ Time expired. No errors were captured.');
      }
    }, 5000);

    // Wait for 2 minutes
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await playclone.close();
    console.log('\n👋 Browser closed');
  }
}

// Run the test
console.log('='.repeat(60));
console.log('KINETIC URANIUM MANUAL INTERACTION TEST');
console.log('='.repeat(60));

openForManualTesting().catch(console.error);