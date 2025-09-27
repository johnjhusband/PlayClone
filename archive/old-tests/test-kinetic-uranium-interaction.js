/**
 * Test KineticUranium by interacting with the app
 * Navigate: Training -> Israel -> Tell AI general to nuke Iran
 */

const { PlayClone } = require('./dist/index');

async function testKineticUraniumInteraction() {
  const playclone = new PlayClone({
    headless: false,
    devtools: true
  });

  try {
    console.log('🚀 Testing KineticUranium with user interaction...\n');

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

    // Wait for page to fully load
    console.log('⏳ Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click on Training
    console.log('\n🎯 Step 1: Clicking on "Training"...');
    const trainingClick = await playclone.click('Training');
    console.log('Training clicked:', trainingClick.success);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click on Israel
    console.log('\n🎯 Step 2: Clicking on "Israel"...');
    const israelClick = await playclone.click('Israel');
    console.log('Israel clicked:', israelClick.success);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to interact with AI general - various approaches
    console.log('\n🎯 Step 3: Looking for AI general interface...');

    // Try typing the command directly
    console.log('Attempting to type command...');
    const typeResult = await playclone.type('nuke Iran');
    console.log('Type result:', typeResult.success);

    // Try pressing enter to submit
    await playclone.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Alternative: try to find and click on any input field or button
    console.log('\nTrying alternative interactions...');

    // Try to find any text input or command interface
    const inputClick = await playclone.click('input');
    if (inputClick.success) {
      await playclone.type('Tell the AI general to nuke Iran');
      await playclone.press('Enter');
    }

    // Wait for any errors to be generated
    console.log('\n⏳ Waiting for errors to be generated...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get the deep error summary
    console.log('\n🔬 Deep Error Summary after interaction:');
    console.log('===========================================');
    const deepSummary = await playclone.getDeepErrorSummary();

    if (deepSummary) {
      const totalErrors = (deepSummary.compilationErrors?.length || 0) +
                         (deepSummary.runtimeErrors?.length || 0) +
                         (deepSummary.consoleErrors?.length || 0) +
                         (deepSummary.networkErrors?.length || 0) +
                         (deepSummary.pageErrors?.length || 0);

      console.log(`\n📊 Total Errors Found: ${totalErrors}`);

      if (deepSummary.compilationErrors?.length > 0) {
        console.log(`\n🔴 Compilation Errors: ${deepSummary.compilationErrors.length}`);
        deepSummary.compilationErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.message}`);
        });
      }

      if (deepSummary.consoleErrors?.length > 0) {
        console.log(`\n🔴 Console Errors: ${deepSummary.consoleErrors.length} (THESE ARE THE 2 ERRORS!)`);
        deepSummary.consoleErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.text}`);
          if (err.location) {
            console.log(`     Location: ${err.location.url}:${err.location.lineNumber}`);
          }
        });
      }

      if (deepSummary.runtimeErrors?.length > 0) {
        console.log(`\n🔴 Runtime Errors: ${deepSummary.runtimeErrors.length}`);
        deepSummary.runtimeErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.message}`);
        });
      }

      if (deepSummary.networkErrors?.length > 0) {
        console.log(`\n🌐 Network Errors: ${deepSummary.networkErrors.length}`);
        deepSummary.networkErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.method} ${err.url} - ${err.errorText}`);
        });
      }

      if (deepSummary.pageErrors?.length > 0) {
        console.log(`\n📄 Page Errors: ${deepSummary.pageErrors.length}`);
        deepSummary.pageErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err}`);
        });
      }

      if (totalErrors === 0) {
        console.log('\n❌ No errors captured yet. The errors might appear later or require different interaction.');
      }
    } else {
      console.log('❌ No deep summary available');
    }

    // Get the formatted report
    console.log('\n📝 Full Deep Error Report:');
    console.log('============================');
    const deepReport = playclone.getDeepErrorReport();
    console.log(deepReport);

    // Copy errors to clipboard if available
    const copyResult = await playclone.copyConsoleErrors();
    if (copyResult.success && copyResult.value !== 'No errors found in console') {
      console.log('\n📋 Errors copied to clipboard!');
    }

    console.log('\n✅ Test completed! Browser will stay open for 15 seconds.');
    console.log('   Please manually check if the interaction worked and if errors appeared.');
    console.log('   You can also manually interact with the game to trigger the errors.');
    await new Promise(resolve => setTimeout(resolve, 15000));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await playclone.close();
    console.log('👋 Browser closed');
  }
}

// Run the test
console.log('='.repeat(60));
console.log('KINETIC URANIUM INTERACTION TEST');
console.log('Testing: Training -> Israel -> Nuke Iran command');
console.log('='.repeat(60));

testKineticUraniumInteraction().catch(console.error);