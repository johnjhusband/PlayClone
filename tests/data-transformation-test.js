const { PlayClone, DataTransformationPipeline } = require('../dist/index');

async function testDataTransformationPipelines() {
  console.log('🧪 Testing Data Transformation Pipelines...\n');
  
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Built-in e-commerce normalization pipeline
  console.log('Test 1: E-commerce data normalization pipeline');
  try {
    const pipeline = new DataTransformationPipeline();
    const ecommerceData = [
      { title: 'Product 1', price: '$29.99', source: 'Amazon' },
      { title: 'Product 2', price: '€19.50', source: 'eBay' },
      { title: '', price: '0', source: 'Unknown' }, // Should be filtered out
      { title: 'Product 3', price: '£39.00', source: 'Store' }
    ];

    const result = await pipeline.execute('ecommerce-normalize', ecommerceData);
    
    if (result.success && result.data?.length === 3) {
      console.log('✅ E-commerce normalization successful');
      console.log(`   Transformed ${result.metrics?.inputCount} items to ${result.metrics?.outputCount} items`);
      testsPassed++;
    } else {
      console.log('❌ E-commerce normalization failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ E-commerce normalization error:', error.message);
    testsFailed++;
  }

  // Test 2: Web scraping cleanup pipeline
  console.log('\nTest 2: Web scraping cleanup pipeline');
  try {
    const pipeline = new DataTransformationPipeline();
    const scrapedData = [
      { title: '  Product A  ', price: 100, description: null, url: 'http://example.com' },
      { title: 'Product B', price: 200, description: '', url: 'http://example.com/b' },
      { title: '  Product A  ', price: 100, description: null, url: 'http://example.com' }, // Duplicate
    ];

    const result = await pipeline.execute('web-scrape-cleanup', scrapedData);
    
    if (result.success && result.data?.length === 2) {
      console.log('✅ Web scraping cleanup successful');
      console.log(`   Cleaned and deduplicated to ${result.data.length} items`);
      testsPassed++;
    } else {
      console.log('❌ Web scraping cleanup failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Web scraping cleanup error:', error.message);
    testsFailed++;
  }

  // Test 3: Analytics aggregation pipeline
  console.log('\nTest 3: Analytics aggregation pipeline');
  try {
    const pipeline = new DataTransformationPipeline();
    const analyticsData = [
      { date: '2025-01-01T10:00:00', value: 100 },
      { date: '2025-01-01T15:00:00', value: 150 },
      { date: '2025-01-02T09:00:00', value: 200 },
      { date: '2025-01-02T14:00:00', value: 250 },
    ];

    const result = await pipeline.execute('analytics-aggregate', analyticsData);
    
    if (result.success && result.data?.length === 2) {
      console.log('✅ Analytics aggregation successful');
      console.log(`   Aggregated to ${result.data.length} daily totals`);
      testsPassed++;
    } else {
      console.log('❌ Analytics aggregation failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Analytics aggregation error:', error.message);
    testsFailed++;
  }

  // Test 4: Custom pipeline builder
  console.log('\nTest 4: Custom pipeline builder');
  try {
    const pipeline = new DataTransformationPipeline();
    const data = [
      { name: 'Alice', age: 30, score: 85 },
      { name: 'Bob', age: 25, score: 92 },
      { name: 'Charlie', age: 35, score: 78 },
      { name: 'David', age: 28, score: 95 }
    ];

    const customPipeline = pipeline.createPipeline('custom-test', 'Filter and sort test')
      .filter(item => item.score > 80, 'Filter high scores')
      .map(item => ({ ...item, grade: item.score >= 90 ? 'A' : 'B' }), 'Add grades')
      .sort((a, b) => b.score - a.score, 'Sort by score desc');

    const result = await customPipeline.execute(data);
    
    if (result.success && result.data?.length === 3 && result.data[0].name === 'David') {
      console.log('✅ Custom pipeline builder successful');
      console.log(`   Filtered to ${result.data.length} items, top scorer: ${result.data[0].name}`);
      testsPassed++;
    } else {
      console.log('❌ Custom pipeline builder failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Custom pipeline builder error:', error.message);
    testsFailed++;
  }

  // Test 5: Chain transformations
  console.log('\nTest 5: Chain transformations');
  try {
    const pipeline = new DataTransformationPipeline();
    
    // Create two simple pipelines to chain
    pipeline.registerPipeline({
      id: 'add-timestamp',
      name: 'Add Timestamp',
      steps: [{
        name: 'Add timestamp',
        type: 'map',
        transform: item => ({ ...item, timestamp: new Date().toISOString() })
      }]
    });

    pipeline.registerPipeline({
      id: 'uppercase-names',
      name: 'Uppercase Names',
      steps: [{
        name: 'Uppercase',
        type: 'map',
        transform: item => ({ ...item, name: item.name?.toUpperCase() })
      }]
    });

    const data = [{ name: 'alice' }, { name: 'bob' }];
    const result = await pipeline.chain(data, 'add-timestamp', 'uppercase-names');
    
    if (result?.length === 2 && result[0].name === 'ALICE' && result[0].timestamp) {
      console.log('✅ Chain transformations successful');
      testsPassed++;
    } else {
      console.log('❌ Chain transformations failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Chain transformations error:', error.message);
    testsFailed++;
  }

  // Test 6: PlayClone integration
  console.log('\nTest 6: PlayClone integration test');
  try {
    const pc = new PlayClone({ headless: true });
    
    // Test the PlayClone methods
    const data = [
      { product: 'Item 1', price: 10 },
      { product: 'Item 2', price: 20 },
      { product: 'Item 3', price: 30 }
    ];

    // List available pipelines
    const pipelinesResult = pc.listTransformationPipelines();
    if (pipelinesResult.success && pipelinesResult.value?.length > 0) {
      console.log(`   ✓ Found ${pipelinesResult.value.length} built-in pipelines`);
    }

    // Create and use a custom pipeline
    const builder = pc.createDataPipeline('test-pipeline', 'Test pipeline');
    const pipeline = builder
      .filter(item => item.price > 15)
      .map(item => ({ ...item, priceWithTax: item.price * 1.1 }))
      .build();

    const transformResult = await pc.transformData(pipeline.id, data);
    
    if (transformResult.success && transformResult.value?.length === 2) {
      console.log('✅ PlayClone integration successful');
      console.log(`   Transformed data using PlayClone API`);
      testsPassed++;
    } else {
      console.log('❌ PlayClone integration failed');
      testsFailed++;
    }

    await pc.close();
  } catch (error) {
    console.log('❌ PlayClone integration error:', error.message);
    testsFailed++;
  }

  // Test 7: Transform and export
  console.log('\nTest 7: Transform and export to CSV');
  try {
    const pipeline = new DataTransformationPipeline();
    const data = [
      { name: 'Product A', price: 100, quantity: 5 },
      { name: 'Product B', price: 200, quantity: 3 },
      { name: 'Product C', price: 150, quantity: 7 }
    ];

    // Register a simple transform pipeline
    pipeline.registerPipeline({
      id: 'calculate-total',
      name: 'Calculate Total',
      steps: [{
        name: 'Add total',
        type: 'map',
        transform: item => ({ ...item, total: item.price * item.quantity })
      }]
    });

    const csv = await pipeline.executeAndExport('calculate-total', data, 'csv');
    
    if (csv && csv.includes('name,price,quantity,total')) {
      console.log('✅ Transform and export successful');
      console.log(`   Generated CSV with ${data.length} rows`);
      testsPassed++;
    } else {
      console.log('❌ Transform and export failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Transform and export error:', error.message);
    testsFailed++;
  }

  // Test 8: Aggregation functions
  console.log('\nTest 8: Aggregation functions');
  try {
    const pipeline = new DataTransformationPipeline();
    const salesData = [
      { product: 'A', sales: 100 },
      { product: 'B', sales: 200 },
      { product: 'C', sales: 150 },
      { product: 'D', sales: 300 }
    ];

    const sumPipeline = pipeline.createPipeline('sum-sales')
      .aggregate('sales', 'sum', 'Total sales');

    const avgPipeline = pipeline.createPipeline('avg-sales')
      .aggregate('sales', 'avg', 'Average sales');

    const [sumResult, avgResult] = await Promise.all([
      sumPipeline.execute(salesData),
      avgPipeline.execute(salesData)
    ]);
    
    if (sumResult.success && sumResult.data[0].sales === 750 &&
        avgResult.success && avgResult.data[0].sales === 187.5) {
      console.log('✅ Aggregation functions successful');
      console.log(`   Sum: ${sumResult.data[0].sales}, Avg: ${avgResult.data[0].sales}`);
      testsPassed++;
    } else {
      console.log('❌ Aggregation functions failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Aggregation functions error:', error.message);
    testsFailed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests Passed: ${testsPassed}/${testsPassed + testsFailed}`);
  console.log(`Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All data transformation pipeline tests passed!');
  } else {
    console.log(`\n⚠️ ${testsFailed} test(s) failed. Please review the errors above.`);
  }

  return testsFailed === 0;
}

// Run tests
if (require.main === module) {
  testDataTransformationPipelines()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testDataTransformationPipelines };