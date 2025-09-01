const { PlayClone, DataExporter } = require('../dist/index');

async function testDataExport() {
    const pc = new PlayClone({ headless: true });
    
    try {
        console.log('🧪 Testing Data Export Functionality...\n');
        
        // Navigate to a page with data
        await pc.navigate('https://example.com');
        
        // Extract some sample data
        const sampleData = [
            { id: 1, name: 'Product A', price: 29.99, category: 'Electronics', inStock: true },
            { id: 2, name: 'Product B', price: 49.99, category: 'Clothing', inStock: false },
            { id: 3, name: 'Product C', price: 19.99, category: 'Books', inStock: true },
            { id: 4, name: 'Product D', price: 99.99, category: 'Electronics', inStock: true },
            { id: 5, name: 'Product E', price: 39.99, category: 'Home', inStock: false }
        ];
        
        // Test CSV Export
        console.log('📊 Testing CSV Export...');
        const csvResult = await pc.exportToCSV(sampleData, {
            includeHeaders: true,
            delimiter: ','
        });
        
        if (csvResult.success) {
            console.log('✅ CSV Export successful');
            console.log('Preview (first 200 chars):', csvResult.value.substring(0, 200));
        } else {
            console.log('❌ CSV Export failed:', csvResult.error);
        }
        
        // Test Excel Export
        console.log('\n📊 Testing Excel Export...');
        const excelResult = await pc.exportToExcel(sampleData, {
            sheetName: 'Products',
            includeHeaders: true
        });
        
        if (excelResult.success) {
            console.log('✅ Excel Export successful');
            console.log('Preview (first 200 chars):', excelResult.value.substring(0, 200));
        } else {
            console.log('❌ Excel Export failed:', excelResult.error);
        }
        
        // Test JSON Export
        console.log('\n📊 Testing JSON Export...');
        const jsonResult = await pc.exportToJSON(sampleData, {
            pretty: true,
            indent: 2
        });
        
        if (jsonResult.success) {
            console.log('✅ JSON Export successful');
            console.log('Preview (first 300 chars):', jsonResult.value.substring(0, 300));
        } else {
            console.log('❌ JSON Export failed:', jsonResult.error);
        }
        
        // Test XML Export
        console.log('\n📊 Testing XML Export...');
        const xmlResult = await pc.exportToXML(sampleData, {
            rootElement: 'products',
            itemElement: 'product',
            indent: true,
            declaration: true
        });
        
        if (xmlResult.success) {
            console.log('✅ XML Export successful');
            console.log('Preview (first 400 chars):', xmlResult.value.substring(0, 400));
        } else {
            console.log('❌ XML Export failed:', xmlResult.error);
        }
        
        // Test Export to File
        console.log('\n📊 Testing Export to File...');
        const filePath = './test-export-data.csv';
        const fileResult = await pc.exportToFile(sampleData, filePath);
        
        if (fileResult.success) {
            console.log('✅ Export to file successful:', fileResult.value);
        } else {
            console.log('❌ Export to file failed:', fileResult.error);
        }
        
        // Test Format Conversion
        console.log('\n📊 Testing Format Conversion...');
        const csvData = 'name,age,city\nJohn,30,New York\nJane,25,Los Angeles\nBob,35,Chicago';
        const conversionResult = await pc.convertDataFormat(csvData, 'csv', 'json', {
            pretty: true,
            indent: 2
        });
        
        if (conversionResult.success) {
            console.log('✅ Format conversion successful (CSV to JSON)');
            console.log('Result:', conversionResult.value);
        } else {
            console.log('❌ Format conversion failed:', conversionResult.error);
        }
        
        // Test Export Report
        console.log('\n📊 Testing Export Report Generation...');
        const reportResult = pc.createExportReport(sampleData, 'csv', {
            includeStats: true,
            includeSample: true,
            sampleSize: 2
        });
        
        if (reportResult.success) {
            console.log('✅ Export report generated successfully');
            console.log('Report:', JSON.stringify(reportResult.value, null, 2));
        } else {
            console.log('❌ Export report generation failed:', reportResult.error);
        }
        
        // Test with real extracted data
        console.log('\n📊 Testing with Real Extracted Data...');
        const links = await pc.getLinks();
        if (links.success && links.data.length > 0) {
            const linkData = links.data.map((link, index) => ({
                index: index + 1,
                text: link.text || 'No text',
                url: link.href || '#'
            }));
            
            const realDataResult = await pc.exportToJSON(linkData, { pretty: true });
            if (realDataResult.success) {
                console.log('✅ Real data export successful');
                console.log('Exported', linkData.length, 'links to JSON');
            }
        }
        
        // Test streaming export for large datasets (simulated)
        console.log('\n📊 Testing Streaming Export (simulated)...');
        async function* generateLargeDataset() {
            for (let i = 0; i < 10; i++) {
                yield { id: i, value: Math.random(), timestamp: new Date().toISOString() };
            }
        }
        
        const streamResult = [];
        for await (const chunk of DataExporter.streamExport(generateLargeDataset(), 'csv')) {
            streamResult.push(chunk);
        }
        console.log('✅ Streaming export completed');
        console.log('Generated', streamResult.length, 'chunks');
        
        console.log('\n✨ All data export tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await pc.close();
    }
}

// Run the test
testDataExport().catch(console.error);