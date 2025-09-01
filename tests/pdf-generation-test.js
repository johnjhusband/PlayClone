#!/usr/bin/env node

/**
 * Test PDF generation functionality
 */

const { PlayClone } = require('../dist/index');
const fs = require('fs').promises;
const path = require('path');

async function testPdfGeneration() {
  console.log('🧪 Testing PDF Generation Functionality\n');
  
  const pc = new PlayClone({ headless: true });
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Generate PDF from a simple webpage
    console.log('📝 Test 1: Generate PDF from webpage');
    await pc.navigate('https://example.com');
    const pdfResult = await pc.generatePdf({ format: 'A4' });
    
    if (pdfResult.success && pdfResult.value.size > 0) {
      console.log('✅ Test 1 passed: PDF generated successfully');
      console.log(`   Size: ${pdfResult.value.size} bytes`);
      console.log(`   Estimated pages: ${pdfResult.value.pages}`);
      testsPassed++;
    } else {
      console.log('❌ Test 1 failed: Could not generate PDF');
      testsFailed++;
    }

    // Test 2: Save PDF to file
    console.log('\n📝 Test 2: Save PDF to file');
    const pdfPath = path.join(__dirname, 'test-output.pdf');
    const saveResult = await pc.savePdf(pdfPath, { 
      format: 'Letter',
      printBackground: true 
    });
    
    if (saveResult.success) {
      const stats = await fs.stat(pdfPath);
      console.log('✅ Test 2 passed: PDF saved successfully');
      console.log(`   Path: ${pdfPath}`);
      console.log(`   Size: ${stats.size} bytes`);
      
      // Clean up
      await fs.unlink(pdfPath);
      testsPassed++;
    } else {
      console.log('❌ Test 2 failed: Could not save PDF');
      console.log(`   Error: ${saveResult.error}`);
      testsFailed++;
    }

    // Test 3: Generate PDF with header and footer
    console.log('\n📝 Test 3: Generate PDF with header and footer');
    await pc.navigate('https://www.w3.org/TR/WCAG20/');
    const headerFooterResult = await pc.generatePdfWithHeaderFooter(
      { format: 'A4', margin: { top: '1in', bottom: '1in' } },
      '<div style="font-size: 10px; text-align: center;">WCAG 2.0 Guidelines</div>',
      '<div style="font-size: 10px; text-align: center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
    );
    
    if (headerFooterResult.success) {
      console.log('✅ Test 3 passed: PDF with header/footer generated');
      console.log(`   Size: ${headerFooterResult.value.size} bytes`);
      testsPassed++;
    } else {
      console.log('❌ Test 3 failed: Could not generate PDF with header/footer');
      testsFailed++;
    }

    // Test 4: Generate PDF of specific element
    console.log('\n📝 Test 4: Generate PDF of specific element');
    await pc.navigate('https://example.com');
    const elementPdfResult = await pc.generateElementPdf('h1', { format: 'A6' });
    
    if (elementPdfResult.success) {
      console.log('✅ Test 4 passed: Element PDF generated');
      console.log(`   Selector: ${elementPdfResult.value.selector}`);
      console.log(`   Size: ${elementPdfResult.value.size} bytes`);
      testsPassed++;
    } else {
      console.log('❌ Test 4 failed: Could not generate element PDF');
      testsFailed++;
    }

    // Test 5: Generate print-optimized PDF
    console.log('\n📝 Test 5: Generate print-optimized PDF');
    await pc.navigate('https://github.com');
    const printPdfResult = await pc.generatePrintOptimizedPdf({ 
      format: 'Letter',
      landscape: false 
    });
    
    if (printPdfResult.success) {
      console.log('✅ Test 5 passed: Print-optimized PDF generated');
      console.log(`   Size: ${printPdfResult.value.size} bytes`);
      console.log(`   URL: ${printPdfResult.value.metadata.url}`);
      testsPassed++;
    } else {
      console.log('❌ Test 5 failed: Could not generate print-optimized PDF');
      testsFailed++;
    }

    // Test 6: Generate PDF with table of contents
    console.log('\n📝 Test 6: Generate PDF with table of contents');
    await pc.navigate('https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide');
    const tocPdfResult = await pc.generatePdfWithToc({ 
      format: 'A4',
      outline: true,
      tagged: true 
    });
    
    if (tocPdfResult.success) {
      console.log('✅ Test 6 passed: PDF with TOC generated');
      console.log(`   Size: ${tocPdfResult.value.size} bytes`);
      console.log(`   Pages: ${tocPdfResult.value.pages}`);
      testsPassed++;
    } else {
      console.log('❌ Test 6 failed: Could not generate PDF with TOC');
      testsFailed++;
    }

    // Test 7: Test various PDF formats
    console.log('\n📝 Test 7: Test various PDF formats');
    const formats = ['A4', 'Letter', 'Legal', 'A3'];
    let formatTestPassed = true;
    
    for (const format of formats) {
      const formatResult = await pc.generatePdf({ format });
      if (!formatResult.success) {
        console.log(`   ❌ Failed to generate ${format} format`);
        formatTestPassed = false;
      } else {
        console.log(`   ✅ ${format}: ${formatResult.value.size} bytes`);
      }
    }
    
    if (formatTestPassed) {
      console.log('✅ Test 7 passed: All formats generated successfully');
      testsPassed++;
    } else {
      console.log('❌ Test 7 failed: Some formats failed to generate');
      testsFailed++;
    }

    // Test 8: Test PDF options
    console.log('\n📝 Test 8: Test PDF options');
    await pc.navigate('https://example.com');
    const optionsResult = await pc.generatePdf({
      format: 'A4',
      landscape: true,
      scale: 0.8,
      printBackground: false,
      pageRanges: '1-2'
    });
    
    if (optionsResult.success) {
      console.log('✅ Test 8 passed: PDF with custom options generated');
      console.log(`   Landscape mode, 80% scale, pages 1-2`);
      testsPassed++;
    } else {
      console.log('❌ Test 8 failed: Could not generate PDF with custom options');
      testsFailed++;
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
    testsFailed++;
  } finally {
    await pc.close();
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
  console.log('='.repeat(50));

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
testPdfGeneration().catch(console.error);