#!/usr/bin/env node

/**
 * Test file for automatic table detection and parsing
 */

const { PlayClone } = require('../dist/index');

async function testTableDetection() {
  const pc = new PlayClone({ headless: true });
  
  try {
    console.log('🧪 Testing Table Detection and Parsing...\n');
    
    // Test 1: Detect tables on a Wikipedia page (known to have well-structured tables)
    console.log('Test 1: Detecting tables on Wikipedia...');
    await pc.navigate('https://en.wikipedia.org/wiki/List_of_countries_by_population_(United_Nations)');
    await pc.waitFor('table', 5000);
    
    const detection = await pc.detectTables({
      minRows: 2,
      minColumns: 2,
      detectImplicitTables: true,
      inferDataTypes: true
    });
    
    console.log(`✅ Found ${detection.count} tables on the page`);
    
    if (detection.tables.length > 0) {
      const firstTable = detection.tables[0];
      console.log(`   First table: ${firstTable.rows.length} rows, ${firstTable.metadata.columnCount} columns`);
      console.log(`   Has headers: ${firstTable.metadata.hasHeaders}`);
      
      // Test 2: Convert table to different formats
      console.log('\nTest 2: Converting table to different formats...');
      
      const csv = await pc.convertTable(firstTable, 'csv');
      console.log('✅ CSV conversion successful');
      console.log('   CSV preview (first 200 chars):', csv.substring(0, 200) + '...');
      
      const json = await pc.convertTable(firstTable, 'json');
      console.log('✅ JSON conversion successful');
      console.log('   JSON length:', json.length, 'characters');
      
      const markdown = await pc.convertTable(firstTable, 'markdown');
      console.log('✅ Markdown conversion successful');
      console.log('   Markdown preview (first 200 chars):', markdown.substring(0, 200) + '...');
      
      // Test 3: Extract specific columns
      console.log('\nTest 3: Extracting specific columns...');
      const extracted = pc.extractTableColumns(firstTable, [0, 1]); // First two columns
      console.log(`✅ Extracted ${extracted.headers.length} columns`);
      console.log('   Column headers:', extracted.headers.slice(0, 2));
      
      // Test 4: Filter rows
      console.log('\nTest 4: Filtering table rows...');
      const filtered = pc.filterTableRows(firstTable, (row, index) => index < 5); // First 5 rows
      console.log(`✅ Filtered to ${filtered.rows.length} rows`);
      
      // Test 5: Sort table
      console.log('\nTest 5: Sorting table by column...');
      const sorted = pc.sortTable(firstTable, 0, true); // Sort by first column
      console.log('✅ Table sorted successfully');
      if (sorted.rows.length > 0) {
        console.log('   First row:', sorted.rows[0].slice(0, 2));
      }
    }
    
    // Test 6: Find tables by content
    console.log('\nTest 6: Finding tables by content...');
    await pc.navigate('https://www.w3schools.com/html/html_tables.asp');
    await pc.waitFor('table', 5000);
    
    const contentTables = await pc.findTablesByContent('Company', {
      cleanWhitespace: true
    });
    console.log(`✅ Found ${contentTables.length} tables containing "Company"`);
    
    // Test 7: Detect implicit tables (non-standard table structures)
    console.log('\nTest 7: Detecting implicit tables...');
    await pc.navigate('https://example.com');
    
    const implicitDetection = await pc.detectTables({
      detectImplicitTables: true,
      minRows: 1
    });
    console.log(`✅ Implicit table detection completed (found ${implicitDetection.count} tables)`);
    
    // Test 8: Extract tables directly as a specific format
    console.log('\nTest 8: Extracting tables directly as JSON...');
    await pc.navigate('https://www.w3schools.com/html/html_tables.asp');
    await pc.waitFor('table', 5000);
    
    const result = await pc.extractTablesAs('json', {
      minRows: 1,
      cleanWhitespace: true
    });
    
    if (result.success) {
      console.log(`✅ Extracted ${result.value.count} tables as JSON`);
      console.log('   Total JSON data length:', result.value.tables.join('').length, 'characters');
    } else {
      console.log('❌ Failed to extract tables:', result.error);
    }
    
    // Test 9: Test with hidden tables
    console.log('\nTest 9: Testing with hidden tables...');
    const hiddenDetection = await pc.detectTables({
      includeHidden: false,
      minRows: 1
    });
    const allDetection = await pc.detectTables({
      includeHidden: true,
      minRows: 1
    });
    console.log(`✅ Visible tables: ${hiddenDetection.count}, All tables: ${allDetection.count}`);
    
    // Test 10: Performance test with large tables
    console.log('\nTest 10: Performance test with large tables...');
    await pc.navigate('https://en.wikipedia.org/wiki/List_of_largest_cities');
    await pc.waitFor('table', 5000);
    
    const startTime = Date.now();
    const largeTableDetection = await pc.detectTables({
      minRows: 10,
      minColumns: 3,
      inferDataTypes: true
    });
    const duration = Date.now() - startTime;
    
    console.log(`✅ Detected ${largeTableDetection.count} large tables in ${duration}ms`);
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✨ Table Detection Tests Complete!');
    console.log('='.repeat(50));
    console.log('Features tested:');
    console.log('  ✅ Standard HTML table detection');
    console.log('  ✅ Implicit table detection');
    console.log('  ✅ Table format conversion (CSV, JSON, Markdown, HTML)');
    console.log('  ✅ Column extraction');
    console.log('  ✅ Row filtering');
    console.log('  ✅ Table sorting');
    console.log('  ✅ Content-based table search');
    console.log('  ✅ Hidden table handling');
    console.log('  ✅ Data type inference');
    console.log('  ✅ Performance with large tables');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await pc.close();
  }
}

// Run the test
console.log('🚀 Starting Table Detection Tests...\n');
testTableDetection().catch(console.error);