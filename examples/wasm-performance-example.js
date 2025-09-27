const { PlayClone } = require('../dist/index');

/**
 * WebAssembly Performance Module Example
 * Demonstrates accelerated DOM parsing, text extraction, and selector matching
 */

async function runWasmExample() {
  console.log('🚀 PlayClone WebAssembly Performance Module Demo\n');
  
  const pc = new PlayClone({ 
    headless: true,
    enableWasm: true // Enable WASM acceleration
  });

  try {
    // Navigate to a content-heavy page for performance testing
    console.log('📄 Navigating to Wikipedia for performance testing...');
    const navResult = await pc.navigate('https://en.wikipedia.org/wiki/JavaScript');
    
    if (!navResult.success) {
      throw new Error(`Navigation failed: ${navResult.error}`);
    }
    
    console.log('✅ Page loaded successfully\n');

    // 1. Text extraction with WASM acceleration
    console.log('📝 Extracting text with WebAssembly...');
    const startText = Date.now();
    const textResult = await pc.extractTextWasm({ maxLength: 10000 });
    const textTime = Date.now() - startText;
    
    if (textResult.success) {
      console.log(`✅ Extracted ${textResult.data.text.length} characters in ${textTime}ms`);
      console.log(`   Method: ${textResult.data.method}`);
      if (textResult.data.performance) {
        console.log(`   WASM calls: ${textResult.data.performance.wasmCalls}`);
        console.log(`   Avg WASM time: ${textResult.data.performance.avgWasmTime?.toFixed(2)}ms`);
      }
    }

    // 2. HTML parsing with WASM
    console.log('\n🔍 Parsing HTML with WebAssembly...');
    const startParse = Date.now();
    const parseResult = await pc.parseHtmlWasm();
    const parseTime = Date.now() - startParse;
    
    if (parseResult.success) {
      console.log(`✅ Parsed ${parseResult.data.elements?.length || 0} elements in ${parseTime}ms`);
      console.log(`   Parse time: ${parseResult.data.parseTime?.toFixed(2)}ms`);
    }

    // 3. CSS selector matching with WASM
    console.log('\n🎯 Matching CSS selectors with WebAssembly...');
    const selectors = ['a', 'h2', 'p', 'div.mw-content-text'];
    
    for (const selector of selectors) {
      const startMatch = Date.now();
      const matchResult = await pc.matchSelectorWasm(selector);
      const matchTime = Date.now() - startMatch;
      
      if (matchResult.success) {
        console.log(`   ${selector}: ${matchResult.data.count} matches in ${matchTime}ms`);
      }
    }

    // 4. Fuzzy search with WASM
    console.log('\n🔤 Performing fuzzy search with WebAssembly...');
    const searchPatterns = ['JavaScr', 'progra', 'develop'];
    
    for (const pattern of searchPatterns) {
      const startSearch = Date.now();
      const searchResult = await pc.fuzzySearchWasm(pattern, 'p');
      const searchTime = Date.now() - startSearch;
      
      if (searchResult.success) {
        console.log(`   Pattern "${pattern}": ${searchResult.data.matches.length} matches in ${searchTime}ms`);
        if (searchResult.data.matches.length > 0) {
          const topMatch = searchResult.data.matches[0];
          console.log(`     Top match: "${topMatch.text.substring(0, 50)}..." (score: ${topMatch.score.toFixed(3)})`);
        }
      }
    }

    // 5. Run benchmark comparison
    console.log('\n📊 Running WebAssembly vs JavaScript benchmark...');
    const benchResult = await pc.benchmarkWasm();
    
    if (benchResult.success) {
      const bench = benchResult.data.benchmark;
      console.log('Benchmark Results:');
      
      if (bench.wasm && bench.javascript) {
        console.log(`   DOM Parsing:`);
        console.log(`     WASM: ${bench.wasm.domParse?.toFixed(2)}ms`);
        console.log(`     JavaScript: ${bench.javascript.domParse?.toFixed(2)}ms`);
        console.log(`     Speedup: ${bench.speedup?.domParse?.toFixed(2)}x`);
        
        console.log(`   Text Extraction:`);
        console.log(`     WASM: ${bench.wasm.textExtract?.toFixed(2)}ms`);
        console.log(`     JavaScript: ${bench.javascript.textExtract?.toFixed(2)}ms`);
        console.log(`     Speedup: ${bench.speedup?.textExtract?.toFixed(2)}x`);
        
        console.log(`   Average Speedup: ${bench.averageSpeedup?.toFixed(2)}x`);
      }
      
      console.log(`\n💡 ${benchResult.data.recommendation}`);
    }

    // 6. Get performance statistics
    console.log('\n📈 WebAssembly Performance Statistics:');
    const statsResult = pc.getWasmStats();
    
    if (statsResult.success) {
      const stats = statsResult.data;
      console.log(`   Total WASM calls: ${stats.wasmCalls}`);
      console.log(`   Total JS fallback calls: ${stats.jsCalls}`);
      console.log(`   WASM usage: ${stats.wasmPercentage?.toFixed(1)}%`);
      console.log(`   Average speedup: ${stats.speedup?.toFixed(2)}x`);
      console.log(`   WASM enabled: ${stats.wasmEnabled}`);
      console.log(`   WASM available: ${stats.wasmAvailable}`);
    }

    // Test on different page sizes
    console.log('\n🔬 Testing performance on different page sizes...\n');
    
    const testPages = [
      { url: 'https://example.com', name: 'Small page' },
      { url: 'https://www.gnu.org/licenses/gpl-3.0.en.html', name: 'Medium page' },
      { url: 'https://en.wikipedia.org/wiki/World_War_II', name: 'Large page' }
    ];

    for (const testPage of testPages) {
      console.log(`Testing ${testPage.name}...`);
      await pc.navigate(testPage.url);
      
      // Reset stats for clean measurement
      pc.resetWasmStats();
      
      // Run operations
      const ops = [
        pc.extractTextWasm(),
        pc.parseHtmlWasm(),
        pc.matchSelectorWasm('a'),
        pc.fuzzySearchWasm('the', 'p')
      ];
      
      const startOps = Date.now();
      await Promise.all(ops);
      const opsTime = Date.now() - startOps;
      
      const stats = pc.getWasmStats().data;
      console.log(`   Total time: ${opsTime}ms`);
      console.log(`   WASM operations: ${stats.wasmCalls}`);
      console.log(`   Avg operation time: ${(opsTime / ops.length).toFixed(2)}ms`);
      console.log('');
    }

    console.log('✨ WebAssembly performance demo complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pc.close();
  }
}

// Run the example
runWasmExample().catch(console.error);