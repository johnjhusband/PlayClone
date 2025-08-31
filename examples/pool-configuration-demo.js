#!/usr/bin/env node

/**
 * Demonstration of PlayClone's configuration system and connection pooling
 * Shows how to use config files, environment variables, and runtime updates
 */

const { PlayClone } = require('../dist/index');
const { ConfigManager } = require('../dist/config/ConfigManager');
const fs = require('fs');
const path = require('path');

// Create a test configuration file
const testConfig = {
  browser: {
    defaultBrowser: "chromium",
    headless: true,
    viewport: {
      width: 1920,
      height: 1080
    }
  },
  connectionPool: {
    enabled: true,
    minSize: 3,
    maxSize: 8,
    idleTimeout: 60000,
    preWarm: true,
    preWarmCount: 3,
    reuseStrategy: "round-robin"
  },
  ai: {
    responseOptimization: true,
    maxResponseSize: 512
  }
};

// Write test config to file
const configPath = path.join(process.cwd(), 'playclone.config.json');
console.log('📝 Creating configuration file:', configPath);
fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));

async function demonstrateConfiguration() {
  console.log('\n🎯 PlayClone Configuration System Demo\n');
  console.log('=' .repeat(50));

  try {
    // 1. Get configuration manager instance
    const configManager = ConfigManager.getInstance();
    
    // 2. Display loaded configuration
    console.log('\n📋 Loaded Configuration:');
    const config = configManager.getConfig();
    console.log('Browser:', config.browser);
    console.log('Connection Pool:', config.connectionPool);
    
    // 3. Test environment variable override
    console.log('\n🔧 Testing Environment Variable Override:');
    console.log('Setting PLAYCLONE_POOL_MAX_SIZE=15');
    process.env.PLAYCLONE_POOL_MAX_SIZE = '15';
    
    // Reload config to pick up env var
    configManager.reloadConfig();
    console.log('New max pool size:', configManager.get('connectionPool')?.maxSize);
    
    // 4. Runtime configuration update
    console.log('\n🔄 Runtime Configuration Update:');
    configManager.updateSection('connectionPool', {
      maxSize: 20,
      preWarmCount: 5
    });
    console.log('Updated pool config:', configManager.get('connectionPool'));
    
    // 5. Create PlayClone instance with configuration
    console.log('\n🚀 Creating PlayClone Instance with Config:');
    const pc = new PlayClone();
    
    // 6. Test pool configuration with multiple operations
    console.log('\n🏊 Testing Connection Pool:');
    console.log('Starting 5 parallel browser operations...');
    
    const operations = [];
    const urls = [
      'https://example.com',
      'https://google.com',
      'https://github.com',
      'https://stackoverflow.com',
      'https://nodejs.org'
    ];
    
    // Launch parallel operations
    const startTime = Date.now();
    for (let i = 0; i < urls.length; i++) {
      operations.push(
        pc.navigate(urls[i]).then(result => {
          const elapsed = Date.now() - startTime;
          console.log(`  ✅ [${i+1}] Loaded ${urls[i]} in ${elapsed}ms`);
          return result;
        })
      );
    }
    
    // Wait for all operations
    await Promise.all(operations);
    const totalTime = Date.now() - startTime;
    console.log(`\n⏱️  Total time for 5 parallel operations: ${totalTime}ms`);
    
    // 7. Configuration validation
    console.log('\n✔️  Configuration Validation:');
    const invalidConfig = {
      connectionPool: {
        minSize: 10,
        maxSize: 5  // Invalid: min > max
      }
    };
    
    const validation = configManager.validateConfig(invalidConfig);
    console.log('Validation result:', validation);
    
    // 8. Save updated configuration
    console.log('\n💾 Saving Updated Configuration:');
    const updatedConfigPath = path.join(process.cwd(), 'playclone.updated.json');
    configManager.saveConfig(updatedConfigPath);
    console.log('Configuration saved to:', updatedConfigPath);
    
    // 9. Watch for configuration changes
    console.log('\n👁️  Setting up Configuration Watcher:');
    configManager.watch('demo', (newConfig) => {
      console.log('Configuration changed! New pool size:', newConfig.connectionPool?.maxSize);
    });
    
    // Trigger a change
    configManager.updateSection('connectionPool', { maxSize: 25 });
    
    // Clean up
    await pc.close();
    configManager.unwatch('demo');
    
    console.log('\n✨ Configuration Demo Complete!');
    console.log('\nKey Features Demonstrated:');
    console.log('  ✓ Loading configuration from file');
    console.log('  ✓ Environment variable overrides');
    console.log('  ✓ Runtime configuration updates');
    console.log('  ✓ Connection pool with pre-warming');
    console.log('  ✓ Configuration validation');
    console.log('  ✓ Configuration persistence');
    console.log('  ✓ Change notifications');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Clean up config files
    try {
      fs.unlinkSync(configPath);
      fs.unlinkSync(path.join(process.cwd(), 'playclone.updated.json'));
      console.log('\n🧹 Cleaned up test configuration files');
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Run the demo
demonstrateConfiguration().catch(console.error);