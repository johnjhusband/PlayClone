/**
 * PlayClone Analytics Dashboard Example
 * Demonstrates real-time analytics and performance monitoring
 */

const { PlayClone } = require('../dist/index');

async function runAnalyticsExample() {
  console.log('📊 PlayClone Analytics Dashboard Example\n');
  console.log('This example demonstrates real-time analytics monitoring');
  console.log('The dashboard will open in your browser automatically\n');

  const pc = new PlayClone({ 
    headless: false,  // Show browser for demo
    viewport: { width: 1280, height: 720 }
  });

  try {
    // Start the analytics dashboard
    console.log('🚀 Starting analytics dashboard...');
    const dashboardResult = await pc.startAnalytics({
      port: 9090,
      host: 'localhost',
      autoOpen: true,  // Auto-open in browser
      updateInterval: 2000,  // Update every 2 seconds
      enableRealtime: true,
      enableHistory: true,
      retentionDays: 7
    });

    if (!dashboardResult.success) {
      console.error('Failed to start dashboard:', dashboardResult.error);
      return;
    }

    console.log(`✅ Dashboard running at: ${dashboardResult.data.url}`);
    console.log(`   Session ID: ${dashboardResult.data.sessionId}`);
    console.log('\n📌 Open your browser to view real-time metrics\n');

    // Simulate various automation scenarios
    console.log('🤖 Running automation scenarios...\n');

    // Scenario 1: E-commerce browsing
    console.log('1️⃣ E-commerce Scenario');
    await pc.navigate('https://www.amazon.com');
    await new Promise(r => setTimeout(r, 2000));
    
    // Record custom metrics
    await pc.recordPerformanceMetric('pageLoad', 1234, 2000);
    await pc.recordDataExtraction('products', 50, 10240);

    // Search for a product
    const searchResult = await pc.fill('search box', 'laptop');
    if (searchResult.success) {
      await pc.click('search button');
      await new Promise(r => setTimeout(r, 2000));
      
      // Extract product data
      const products = await pc.getText('.s-result-item');
      await pc.recordDataExtraction('searchResults', 20, 5120);
    }

    // Scenario 2: News website navigation
    console.log('2️⃣ News Website Scenario');
    await pc.navigate('https://news.ycombinator.com');
    await new Promise(r => setTimeout(r, 1500));
    
    await pc.recordPerformanceMetric('pageLoad', 890, 2000);
    
    // Extract headlines
    const headlines = await pc.getLinks();
    if (headlines.success && headlines.data) {
      await pc.recordDataExtraction('headlines', headlines.data.length, 2048);
      console.log(`   Extracted ${headlines.data.length} headlines`);
    }

    // Click on a story
    await pc.click('first story link');
    await new Promise(r => setTimeout(r, 2000));

    // Scenario 3: Form interaction
    console.log('3️⃣ Form Interaction Scenario');
    await pc.navigate('https://www.w3schools.com/html/html_forms.asp');
    await new Promise(r => setTimeout(r, 1500));
    
    // Try to fill a form
    await pc.fill('firstname', 'John');
    await pc.fill('lastname', 'Doe');
    await pc.recordPerformanceMetric('formFillTime', 450, 1000);

    // Scenario 4: GitHub repository exploration
    console.log('4️⃣ GitHub Repository Scenario');
    await pc.navigate('https://github.com/microsoft/playwright');
    await new Promise(r => setTimeout(r, 2000));
    
    // Extract repository stats
    const stats = await pc.getText('.BorderGrid');
    if (stats.success) {
      await pc.recordDataExtraction('repoStats', 10, 512);
    }

    // Record some performance metrics
    await pc.recordPerformanceMetric('cpu', 45, 80);
    await pc.recordPerformanceMetric('memory', 62, 90);
    await pc.recordPerformanceMetric('networkLatency', 120, 200);

    // Get current metrics
    console.log('\n📊 Current Analytics Metrics:');
    const metrics = await pc.getAnalyticsMetrics();
    
    if (metrics.success) {
      const data = metrics.data;
      console.log(`   Total Actions: ${data.totalActions}`);
      console.log(`   Success Rate: ${data.successRate.toFixed(1)}%`);
      console.log(`   Avg Response Time: ${data.avgActionDuration.toFixed(0)}ms`);
      console.log(`   Data Extracted: ${data.totalDataExtracted} items`);
      
      if (data.topActions.length > 0) {
        console.log('\n   Most Common Actions:');
        data.topActions.slice(0, 5).forEach((action, i) => {
          console.log(`   ${i + 1}. ${action.action}: ${action.count} times`);
        });
      }

      if (data.urlVisits.length > 0) {
        console.log('\n   Sites Visited:');
        data.urlVisits.slice(0, 5).forEach((visit, i) => {
          const url = new URL(visit.url);
          console.log(`   ${i + 1}. ${url.hostname}: ${visit.count} visits`);
        });
      }
    }

    // Keep dashboard running for observation
    console.log('\n📌 Dashboard is running. View it in your browser!');
    console.log('   The dashboard shows:');
    console.log('   - Real-time metrics updates');
    console.log('   - Success rate trends');
    console.log('   - Action distribution charts');
    console.log('   - Performance metrics');
    console.log('   - Active session monitoring');
    console.log('\n⏸️  Press Ctrl+C to stop the dashboard and exit\n');

    // Keep the process alive
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Cleanup will happen on Ctrl+C
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Stopping dashboard...');
      await pc.stopAnalytics();
      await pc.close();
      console.log('✅ Dashboard stopped. Goodbye!');
      process.exit(0);
    });
  }
}

// Run the example
console.log('Starting PlayClone Analytics Dashboard Example...\n');
runAnalyticsExample().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});