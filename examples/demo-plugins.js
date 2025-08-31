#!/usr/bin/env node

/**
 * PlayClone Plugin System Demo
 * Demonstrates loading and using plugins for enhanced browser automation
 */

const { PlayClone } = require('../dist/index');
const path = require('path');

async function main() {
  console.log('🔌 PlayClone Plugin System Demo\n');
  
  const pc = new PlayClone({ 
    headless: false,
    pluginStorageDir: './plugin-data'
  });
  
  try {
    // Load the analytics plugin
    console.log('📊 Loading Analytics Plugin...');
    const analyticsResult = await pc.loadPlugin(
      path.join(__dirname, 'plugins', 'analytics-plugin.ts'),
      { 
        enabled: true, 
        priority: 10 
      }
    );
    console.log(analyticsResult.success ? '✅ Analytics plugin loaded' : '❌ Failed to load analytics plugin');
    
    // Load the SEO analyzer plugin
    console.log('🔍 Loading SEO Analyzer Plugin...');
    const seoResult = await pc.loadPlugin(
      path.join(__dirname, 'plugins', 'seo-analyzer-plugin.ts'),
      { 
        enabled: true, 
        priority: 5,
        settings: { autoAnalyze: true }
      }
    );
    console.log(seoResult.success ? '✅ SEO plugin loaded' : '❌ Failed to load SEO plugin');
    
    // List loaded plugins
    console.log('\n📋 Loaded Plugins:');
    const plugins = pc.getPlugins();
    plugins.forEach(plugin => {
      console.log(`  - ${plugin.name} v${plugin.version} (${plugin.enabled ? 'enabled' : 'disabled'})`);
    });
    
    // List available commands
    console.log('\n⚡ Available Plugin Commands:');
    const commands = pc.getPluginCommands();
    commands.forEach(cmd => console.log(`  - ${cmd}`));
    
    // Navigate to a website
    console.log('\n🌐 Navigating to example.com...');
    await pc.navigate('https://example.com');
    
    // Wait a moment for plugins to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Execute plugin commands
    console.log('\n📈 Getting Analytics...');
    const analyticsData = await pc.executePluginCommand('getAnalytics', {});
    if (analyticsData.success) {
      const data = analyticsData.data;
      console.log('Analytics Summary:');
      console.log(`  Session Duration: ${data.session.durationFormatted}`);
      console.log(`  Navigations: ${data.counts.navigations}`);
      console.log(`  Total Events: ${data.counts.totalEvents}`);
    }
    
    console.log('\n🔎 Analyzing SEO...');
    const seoData = await pc.executePluginCommand('analyzeSEO', {});
    if (seoData.success) {
      const analysis = seoData.data;
      console.log('SEO Analysis:');
      console.log(`  Score: ${analysis.score}/100 (Grade: ${analysis.grade})`);
      console.log(`  Issues: ${analysis.summary.issues}`);
      console.log(`  Warnings: ${analysis.summary.warnings}`);
      console.log(`  Passes: ${analysis.summary.passes}`);
      
      if (analysis.recommendations.length > 0) {
        console.log('\n  Recommendations:');
        analysis.recommendations.forEach(rec => {
          console.log(`    • ${rec}`);
        });
      }
    }
    
    // Navigate to another page
    console.log('\n🌐 Navigating to GitHub...');
    await pc.navigate('https://github.com');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Click on something
    console.log('🖱️ Clicking on a link...');
    await pc.click('link containing "Explore"');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get updated analytics
    console.log('\n📊 Final Analytics Report:');
    const finalAnalytics = await pc.executePluginCommand('getAnalytics', {});
    if (finalAnalytics.success) {
      const data = finalAnalytics.data;
      console.log(`  Total Navigations: ${data.counts.navigations}`);
      console.log(`  Total Clicks: ${data.counts.clicks}`);
      console.log(`  Error Rate: ${data.rates.errorRate}`);
      console.log('\n  Top Event Types:');
      data.topEventTypes.forEach(event => {
        console.log(`    - ${event.type}: ${event.count} times`);
      });
    }
    
    // Export analytics
    console.log('\n💾 Exporting analytics data...');
    const exportResult = await pc.executePluginCommand('exportAnalytics', {});
    if (exportResult.success) {
      console.log('✅ Analytics exported successfully');
    }
    
    // Demonstrate disabling a plugin
    console.log('\n🔧 Disabling SEO plugin...');
    const disableResult = pc.setPluginEnabled('seo-analyzer', false);
    console.log(disableResult.success ? '✅ Plugin disabled' : '❌ Failed to disable plugin');
    
    // Unload a plugin
    console.log('🗑️ Unloading analytics plugin...');
    const unloadResult = await pc.unloadPlugin('analytics-plugin');
    console.log(unloadResult.success ? '✅ Plugin unloaded' : '❌ Failed to unload plugin');
    
    console.log('\n✨ Plugin demo complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc.close();
  }
}

// Run the demo
main().catch(console.error);