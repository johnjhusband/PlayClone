/**
 * Test KineticUranium using the WORKING DeepErrorExtractor
 */

const { PlayClone } = require('./dist/index');

async function testKineticUranium() {
  const playclone = new PlayClone({
    headless: false,
    devtools: true
  });

  try {
    console.log('🚀 Testing KineticUranium error capture...\n');

    // START DEEP ERROR EXTRACTION BEFORE NAVIGATION!
    console.log('🔬 Starting deep error extraction BEFORE navigation...');
    const deepResult = await playclone.startDeepErrorExtraction();
    console.log('Deep extraction started:', deepResult.success);

    // Navigate to KineticUranium
    console.log('\n📄 Navigating to https://devgame.flippi.ai...');
    const navResult = await playclone.navigate('https://devgame.flippi.ai');
    if (!navResult.success) {
      console.error('Failed to navigate:', navResult.error);
      return;
    }

    // Wait for page to fully load and errors to generate
    console.log('⏳ Waiting 5 seconds for page to fully load...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get the deep error summary
    console.log('\n🔬 Deep Error Summary for KineticUranium:');
    console.log('==========================================');
    const deepSummary = await playclone.getDeepErrorSummary();

    if (deepSummary) {
      console.log(`\nTotal Errors Found:`);
      console.log(`  Compilation Errors: ${deepSummary.compilationErrors.length}`);
      console.log(`  Runtime Errors: ${deepSummary.runtimeErrors.length}`);
      console.log(`  Console Errors: ${deepSummary.consoleErrors.length}`);
      console.log(`  Network Errors: ${deepSummary.networkErrors.length}`);
      console.log(`  Page Errors: ${deepSummary.pageErrors.length}`);

      if (deepSummary.compilationErrors.length > 0) {
        console.log('\n🔴 Compilation Errors:');
        deepSummary.compilationErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.message}`);
          if (err.filename) {
            console.log(`     File: ${err.filename}:${err.line}:${err.column}`);
          }
        });
      }

      if (deepSummary.consoleErrors.length > 0) {
        console.log('\n🔴 Console Errors (THE 2 ERRORS YOU MENTIONED):');
        deepSummary.consoleErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.text}`);
          if (err.location) {
            console.log(`     Location: ${err.location.url}:${err.location.lineNumber}:${err.location.columnNumber}`);
          }
        });
      }

      if (deepSummary.runtimeErrors.length > 0) {
        console.log('\n🔴 Runtime Errors:');
        deepSummary.runtimeErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.message}`);
          if (err.stackTrace) {
            console.log(`     Stack: ${err.stackTrace.substring(0, 200)}...`);
          }
        });
      }

      if (deepSummary.networkErrors.length > 0) {
        console.log('\n🌐 Network Errors:');
        deepSummary.networkErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.method} ${err.url} - ${err.errorText}`);
        });
      }

      if (deepSummary.pageErrors.length > 0) {
        console.log('\n📄 Page Errors:');
        deepSummary.pageErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err}`);
        });
      }
    } else {
      console.log('❌ No deep summary available');
    }

    // Also get the formatted report
    console.log('\n📝 Full Deep Error Report:');
    console.log('============================');
    const deepReport = playclone.getDeepErrorReport();
    console.log(deepReport);

    console.log('\n✅ Test completed! Keeping browser open for 10 seconds...');
    console.log('   Check the browser to see if KineticUranium loaded properly.');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await playclone.close();
    console.log('👋 Browser closed');
  }
}

// Run the test
console.log('='.repeat(60));
console.log('KINETIC URANIUM ERROR CAPTURE TEST');
console.log('Using DeepErrorExtractor (the method that works)');
console.log('='.repeat(60));

testKineticUranium().catch(console.error);