/**
 * Data Extraction Example
 * 
 * This example demonstrates PlayClone's powerful data extraction capabilities:
 * - Text extraction from various elements
 * - Table data extraction
 * - List and menu extraction
 * - Image metadata extraction
 * - Structured data (JSON-LD, microdata)
 * - PDF and document extraction
 * - Dynamic content extraction
 * - Data transformation and export
 */

import { PlayClone } from '../src/index';
import * as fs from 'fs';
import * as path from 'path';

async function dataExtractionExample() {
    console.log('📊 Starting Data Extraction Example\n');
    
    // Initialize PlayClone
    const pc = new PlayClone({
        headless: false,  // Set to true for production
        viewport: { width: 1280, height: 720 }
    });

    try {
        // Example 1: News Article Extraction
        console.log('📰 Example 1: News Article Extraction\n');
        await extractNewsArticle(pc);
        
        // Example 2: Table Data Extraction
        console.log('\n📋 Example 2: Table Data Extraction\n');
        await extractTableData(pc);
        
        // Example 3: Product Information Extraction
        console.log('\n🛍️ Example 3: Product Data Extraction\n');
        await extractProductData(pc);
        
        // Example 4: Social Media Data
        console.log('\n💬 Example 4: Social Media Extraction\n');
        await extractSocialMediaData(pc);
        
        // Example 5: Financial Data
        console.log('\n💰 Example 5: Financial Data Extraction\n');
        await extractFinancialData(pc);
        
        // Example 6: Search Results
        console.log('\n🔍 Example 6: Search Results Extraction\n');
        await extractSearchResults(pc);
        
    } catch (error) {
        console.error('Error in data extraction:', error);
    } finally {
        await pc.close();
        console.log('\n✅ Data extraction example completed');
    }
}

/**
 * Extract data from news articles
 */
async function extractNewsArticle(pc: PlayClone) {
    console.log('Navigating to news site...');
    await pc.navigate('https://www.bbc.com/news');
    
    // Extract headline articles
    console.log('Extracting top headlines...');
    const headlines = await pc.extractData({
        selector: 'main headlines section',
        fields: ['title', 'summary', 'category', 'timestamp', 'author']
    });
    
    if (headlines.success && headlines.data) {
        console.log(`Found ${headlines.data.length || 0} headlines`);
        
        // Process first headline
        if (Array.isArray(headlines.data) && headlines.data.length > 0) {
            const firstHeadline = headlines.data[0];
            console.log('\nFirst headline:');
            console.log(`  Title: ${firstHeadline.title || 'N/A'}`);
            console.log(`  Category: ${firstHeadline.category || 'N/A'}`);
            console.log(`  Time: ${firstHeadline.timestamp || 'N/A'}`);
        }
    }
    
    // Click on first article to get full content
    const clickResult = await pc.click('first headline link');
    if (clickResult.success) {
        await pc.waitForNavigation();
        
        // Extract full article content
        console.log('\nExtracting full article...');
        const article = await pc.extractData({
            selector: 'article body',
            fields: ['headline', 'author', 'date', 'content', 'related_links']
        });
        
        if (article.success && article.data) {
            const content = article.data.content || '';
            const wordCount = content.split(/\s+/).length;
            console.log(`Article extracted:`);
            console.log(`  Headline: ${article.data.headline || 'N/A'}`);
            console.log(`  Author: ${article.data.author || 'N/A'}`);
            console.log(`  Date: ${article.data.date || 'N/A'}`);
            console.log(`  Word count: ${wordCount}`);
            console.log(`  Preview: ${content.substring(0, 150)}...`);
            
            // Save article to file
            const articleData = {
                url: await pc.getUrl(),
                ...article.data,
                extracted_at: new Date().toISOString()
            };
            
            saveDataToFile('news-article.json', articleData);
        }
    }
}

/**
 * Extract table data from websites
 */
async function extractTableData(pc: PlayClone) {
    console.log('Navigating to data tables example...');
    await pc.navigate('https://www.w3schools.com/html/html_tables.asp');
    
    // Extract first table
    console.log('Extracting HTML table...');
    const tableData = await pc.extractTable({
        selector: 'first data table',
        hasHeaders: true
    });
    
    if (tableData.success && tableData.data) {
        console.log(`Table extracted with ${tableData.data.length} rows`);
        
        // Display first few rows
        if (tableData.data.length > 0) {
            console.log('\nFirst 3 rows:');
            tableData.data.slice(0, 3).forEach((row: any, index: number) => {
                console.log(`  Row ${index + 1}:`, JSON.stringify(row));
            });
        }
        
        // Save as CSV
        const csv = convertToCSV(tableData.data);
        saveDataToFile('extracted-table.csv', csv);
    }
    
    // Extract table with specific columns
    console.log('\nExtracting specific columns...');
    const specificColumns = await pc.extractTable({
        selector: 'data table',
        columns: ['Company', 'Contact', 'Country']
    });
    
    if (specificColumns.success) {
        console.log('Specific columns extracted successfully');
    }
    
    // Wikipedia table example
    console.log('\nExtracting Wikipedia table...');
    await pc.navigate('https://en.wikipedia.org/wiki/List_of_countries_by_population_(United_Nations)');
    
    const wikiTable = await pc.extractTable({
        selector: 'population data table',
        columns: ['Country', 'Population', 'Percentage'],
        limit: 10
    });
    
    if (wikiTable.success && wikiTable.data) {
        console.log('Top 10 countries by population:');
        wikiTable.data.forEach((country: any, index: number) => {
            console.log(`  ${index + 1}. ${country.Country}: ${country.Population}`);
        });
    }
}

/**
 * Extract product information from e-commerce sites
 */
async function extractProductData(pc: PlayClone) {
    console.log('Navigating to product page...');
    await pc.navigate('https://www.amazon.com/best-sellers');
    
    // Extract bestseller products
    console.log('Extracting bestseller products...');
    const products = await pc.extractData({
        selector: 'product grid',
        fields: ['title', 'price', 'rating', 'reviews_count', 'category', 'rank'],
        limit: 10
    });
    
    if (products.success && products.data) {
        console.log(`Extracted ${products.data.length} products`);
        
        // Analyze price distribution
        if (Array.isArray(products.data)) {
            const prices = products.data
                .map((p: any) => parseFloat(p.price?.replace(/[^0-9.]/g, '') || '0'))
                .filter((p: number) => p > 0);
            
            if (prices.length > 0) {
                const avgPrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                
                console.log('\nPrice Analysis:');
                console.log(`  Average: $${avgPrice.toFixed(2)}`);
                console.log(`  Min: $${minPrice.toFixed(2)}`);
                console.log(`  Max: $${maxPrice.toFixed(2)}`);
            }
        }
        
        // Extract structured data (JSON-LD)
        console.log('\nExtracting structured data...');
        const structuredData = await pc.extractStructuredData();
        
        if (structuredData.success && structuredData.data) {
            console.log('Structured data found:');
            console.log(`  Type: ${structuredData.data['@type'] || 'Unknown'}`);
            console.log(`  Items: ${structuredData.data.items?.length || 0}`);
        }
    }
}

/**
 * Extract social media data
 */
async function extractSocialMediaData(pc: PlayClone) {
    console.log('Extracting social media patterns...');
    
    // Twitter/X example
    console.log('Navigating to Twitter/X...');
    await pc.navigate('https://twitter.com/explore');
    
    // Extract trending topics
    const trending = await pc.extractData({
        selector: 'trending section',
        fields: ['topic', 'tweet_count', 'category']
    });
    
    if (trending.success && trending.data) {
        console.log('Trending topics extracted');
        if (Array.isArray(trending.data)) {
            trending.data.slice(0, 5).forEach((topic: any, index: number) => {
                console.log(`  ${index + 1}. ${topic.topic || 'N/A'} (${topic.tweet_count || 'N/A'} tweets)`);
            });
        }
    }
    
    // GitHub repository data
    console.log('\nExtracting GitHub repository data...');
    await pc.navigate('https://github.com/trending');
    
    const repos = await pc.extractData({
        selector: 'trending repositories',
        fields: ['name', 'description', 'language', 'stars', 'forks', 'contributors']
    });
    
    if (repos.success && repos.data) {
        console.log('Trending repositories:');
        if (Array.isArray(repos.data)) {
            repos.data.slice(0, 5).forEach((repo: any, index: number) => {
                console.log(`  ${index + 1}. ${repo.name || 'N/A'} - ${repo.stars || '0'} stars (${repo.language || 'Unknown'})`);
            });
        }
    }
}

/**
 * Extract financial data
 */
async function extractFinancialData(pc: PlayClone) {
    console.log('Extracting financial data...');
    await pc.navigate('https://finance.yahoo.com/most-active');
    
    // Extract stock data
    console.log('Extracting most active stocks...');
    const stocks = await pc.extractTable({
        selector: 'stocks table',
        columns: ['Symbol', 'Name', 'Price', 'Change', 'Change %', 'Volume'],
        limit: 10
    });
    
    if (stocks.success && stocks.data) {
        console.log('Most active stocks:');
        stocks.data.forEach((stock: any, index: number) => {
            console.log(`  ${index + 1}. ${stock.Symbol} - $${stock.Price} (${stock['Change %']})`);
        });
        
        // Calculate statistics
        const changes = stocks.data
            .map((s: any) => parseFloat(s['Change %']?.replace(/[^0-9.-]/g, '') || '0'))
            .filter((c: number) => !isNaN(c));
        
        if (changes.length > 0) {
            const gainers = changes.filter((c: number) => c > 0).length;
            const losers = changes.filter((c: number) => c < 0).length;
            const avgChange = changes.reduce((a: number, b: number) => a + b, 0) / changes.length;
            
            console.log('\nMarket Summary:');
            console.log(`  Gainers: ${gainers}`);
            console.log(`  Losers: ${losers}`);
            console.log(`  Average change: ${avgChange.toFixed(2)}%`);
        }
    }
    
    // Extract cryptocurrency data
    console.log('\nExtracting cryptocurrency data...');
    await pc.navigate('https://coinmarketcap.com');
    
    const crypto = await pc.extractTable({
        selector: 'cryptocurrency table',
        columns: ['Name', 'Symbol', 'Price', 'Market Cap', '24h Change'],
        limit: 10
    });
    
    if (crypto.success && crypto.data) {
        console.log('Top cryptocurrencies:');
        crypto.data.forEach((coin: any, index: number) => {
            console.log(`  ${index + 1}. ${coin.Name} (${coin.Symbol}) - ${coin.Price}`);
        });
    }
}

/**
 * Extract search results from search engines
 */
async function extractSearchResults(pc: PlayClone) {
    console.log('Extracting search results...');
    
    // Google search example
    await pc.navigate('https://www.google.com');
    await pc.fill('search box', 'artificial intelligence news 2025');
    await pc.press('Enter');
    await pc.waitForNavigation();
    
    console.log('Extracting Google search results...');
    const googleResults = await pc.extractData({
        selector: 'search results',
        fields: ['title', 'url', 'snippet', 'date'],
        limit: 10
    });
    
    if (googleResults.success && googleResults.data) {
        console.log(`Found ${googleResults.data.length} results`);
        if (Array.isArray(googleResults.data)) {
            googleResults.data.slice(0, 3).forEach((result: any, index: number) => {
                console.log(`\n  ${index + 1}. ${result.title || 'N/A'}`);
                console.log(`     URL: ${result.url || 'N/A'}`);
                console.log(`     Snippet: ${result.snippet?.substring(0, 100) || 'N/A'}...`);
            });
        }
        
        // Save results
        saveDataToFile('search-results.json', googleResults.data);
    }
    
    // Extract related searches
    const relatedSearches = await pc.extractData({
        selector: 'related searches',
        fields: ['query']
    });
    
    if (relatedSearches.success && relatedSearches.data) {
        console.log('\nRelated searches:');
        if (Array.isArray(relatedSearches.data)) {
            relatedSearches.data.forEach((search: any) => {
                console.log(`  - ${search.query || search}`);
            });
        }
    }
}

/**
 * Utility function to save extracted data to file
 */
function saveDataToFile(filename: string, data: any) {
    try {
        const outputDir = path.join(process.cwd(), 'extracted-data');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const filepath = path.join(outputDir, filename);
        const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`  ✓ Data saved to: ${filepath}`);
    } catch (error) {
        console.error(`  ✗ Failed to save data: ${error}`);
    }
}

/**
 * Convert array of objects to CSV format
 */
function convertToCSV(data: any[]): string {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
        return headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in values
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
}

/**
 * Advanced extraction: Extract data from PDFs
 */
async function extractPDFData(pc: PlayClone, pdfUrl: string) {
    console.log(`Extracting data from PDF: ${pdfUrl}`);
    
    await pc.navigate(pdfUrl);
    await pc.waitForContent();
    
    // If browser renders PDF with plugin
    const pdfContent = await pc.extractData({
        selector: 'pdf content or viewer',
        fields: ['text', 'pages', 'metadata']
    });
    
    if (pdfContent.success && pdfContent.data) {
        console.log('PDF Data extracted:');
        console.log(`  Pages: ${pdfContent.data.pages || 'Unknown'}`);
        console.log(`  Text preview: ${pdfContent.data.text?.substring(0, 200) || 'N/A'}...`);
        
        return pdfContent.data;
    }
    
    return null;
}

/**
 * Extract data with pagination
 */
async function extractWithPagination(pc: PlayClone, config: {
    url: string;
    dataSelector: string;
    nextButtonSelector: string;
    maxPages?: number;
}) {
    const allData: any[] = [];
    let currentPage = 1;
    const maxPages = config.maxPages || 5;
    
    console.log(`Extracting data with pagination from ${config.url}`);
    await pc.navigate(config.url);
    
    while (currentPage <= maxPages) {
        console.log(`  Extracting page ${currentPage}...`);
        
        // Extract data from current page
        const pageData = await pc.extractData({
            selector: config.dataSelector,
            fields: ['all']
        });
        
        if (pageData.success && pageData.data) {
            allData.push(...(Array.isArray(pageData.data) ? pageData.data : [pageData.data]));
        }
        
        // Try to go to next page
        const hasNext = await pc.exists(config.nextButtonSelector);
        if (!hasNext) {
            console.log('  No more pages found');
            break;
        }
        
        const nextResult = await pc.click(config.nextButtonSelector);
        if (!nextResult.success) {
            console.log('  Failed to navigate to next page');
            break;
        }
        
        await pc.waitForContent();
        currentPage++;
    }
    
    console.log(`✓ Extracted ${allData.length} items across ${currentPage} pages`);
    return allData;
}

/**
 * Extract and monitor real-time data
 */
async function extractRealTimeData(pc: PlayClone, config: {
    url: string;
    selector: string;
    interval: number;
    duration: number;
}) {
    const data: any[] = [];
    const startTime = Date.now();
    
    console.log(`Monitoring real-time data from ${config.url}`);
    await pc.navigate(config.url);
    
    const intervalId = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= config.duration) {
            clearInterval(intervalId);
            console.log(`\n✓ Monitoring completed. Collected ${data.length} data points`);
            return;
        }
        
        const snapshot = await pc.extractData({
            selector: config.selector,
            fields: ['value', 'timestamp']
        });
        
        if (snapshot.success && snapshot.data) {
            const dataPoint = {
                ...snapshot.data,
                captured_at: new Date().toISOString()
            };
            data.push(dataPoint);
            console.log(`  Data point ${data.length}: ${JSON.stringify(dataPoint)}`);
        }
    }, config.interval);
    
    // Wait for monitoring to complete
    await new Promise(resolve => setTimeout(resolve, config.duration));
    
    return data;
}

// Run the example if executed directly
if (require.main === module) {
    dataExtractionExample().catch(console.error);
}

export {
    dataExtractionExample,
    extractNewsArticle,
    extractTableData,
    extractProductData,
    extractSocialMediaData,
    extractFinancialData,
    extractSearchResults,
    extractPDFData,
    extractWithPagination,
    extractRealTimeData,
    saveDataToFile,
    convertToCSV
};