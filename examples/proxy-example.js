#!/usr/bin/env node
/**
 * Proxy Configuration Example
 * Demonstrates how to use PlayClone with various proxy configurations
 */

const { PlayClone } = require('../dist/index');

async function proxyExamples() {
  console.log('🔐 PlayClone Proxy Configuration Examples\n');
  
  // Example 1: Basic HTTP Proxy
  console.log('1. Basic HTTP Proxy Configuration:');
  console.log('─'.repeat(50));
  
  const pc1 = new PlayClone({
    headless: false,
    proxy: {
      server: 'http://proxy.yourcompany.com:8080',
      bypass: 'localhost,127.0.0.1,*.internal.com'
    }
  });
  
  console.log('Created PlayClone with HTTP proxy');
  console.log('Proxy server: http://proxy.yourcompany.com:8080');
  console.log('Bypassing: localhost, 127.0.0.1, *.internal.com\n');
  
  // Example 2: Authenticated Proxy
  console.log('2. Proxy with Authentication:');
  console.log('─'.repeat(50));
  
  const pc2 = new PlayClone({
    headless: false,
    proxy: {
      server: 'http://proxy.yourcompany.com:8080',
      username: 'your_username',
      password: 'your_password',
      bypass: 'localhost,127.0.0.1'
    }
  });
  
  console.log('Created PlayClone with authenticated proxy');
  console.log('Username/password authentication configured\n');
  
  // Example 3: SOCKS5 Proxy
  console.log('3. SOCKS5 Proxy Configuration:');
  console.log('─'.repeat(50));
  
  const pc3 = new PlayClone({
    headless: false,
    proxy: {
      server: 'socks5://socks-proxy.yourcompany.com:1080',
      username: 'socks_user',
      password: 'socks_pass'
    }
  });
  
  console.log('Created PlayClone with SOCKS5 proxy');
  console.log('SOCKS5 server: socks5://socks-proxy.yourcompany.com:1080\n');
  
  // Example 4: Different proxy per browser
  console.log('4. Browser-Specific Proxy Configurations:');
  console.log('─'.repeat(50));
  
  // Chromium with proxy
  const chromiumProxy = new PlayClone({
    browser: 'chromium',
    headless: false,
    proxy: {
      server: 'http://chromium-proxy.com:8080'
    }
  });
  console.log('✅ Chromium configured with specific proxy');
  
  // Firefox with different proxy
  const firefoxProxy = new PlayClone({
    browser: 'firefox',
    headless: false,
    proxy: {
      server: 'http://firefox-proxy.com:8080'
    }
  });
  console.log('✅ Firefox configured with different proxy\n');
  
  // Example 5: Dynamic proxy switching
  console.log('5. Working Example - Check Your IP:');
  console.log('─'.repeat(50));
  
  try {
    // Create instance without proxy
    const pcNoProxy = new PlayClone({ headless: false });
    
    // Check IP without proxy
    console.log('Checking IP without proxy...');
    await pcNoProxy.navigate('http://httpbin.org/ip');
    const normalIP = await pcNoProxy.getText('body');
    console.log('Your normal IP:', normalIP.data);
    await pcNoProxy.close();
    
    // Create instance with proxy (use a working proxy here)
    console.log('\nTo test with proxy, configure a working proxy:');
    console.log(`
const pcWithProxy = new PlayClone({
  proxy: {
    server: 'http://working-proxy:8080'
  }
});

await pcWithProxy.navigate('http://httpbin.org/ip');
const proxyIP = await pcWithProxy.getText('body');
console.log('Your IP through proxy:', proxyIP.data);
`);
    
  } catch (error) {
    console.log('Error in IP check example:', error.message);
  }
  
  // Example 6: Proxy for web scraping
  console.log('\n6. Web Scraping with Rotating Proxies:');
  console.log('─'.repeat(50));
  
  const proxies = [
    'http://proxy1.com:8080',
    'http://proxy2.com:8080',
    'http://proxy3.com:8080'
  ];
  
  console.log('Rotating proxy example:');
  for (let i = 0; i < proxies.length; i++) {
    console.log(`
// Scrape iteration ${i + 1}
const pc = new PlayClone({
  proxy: { server: '${proxies[i]}' }
});
await pc.navigate('https://target-site.com');
const data = await pc.getText('content');
await pc.close();
`);
  }
  
  // Configuration tips
  console.log('\n' + '='.repeat(60));
  console.log('📝 PROXY CONFIGURATION TIPS:');
  console.log('='.repeat(60));
  console.log(`
1. HTTP/HTTPS Proxies:
   - Format: 'http://proxy.com:8080' or 'https://proxy.com:8443'
   - Works with all browsers

2. SOCKS Proxies:
   - Format: 'socks5://proxy.com:1080' or 'socks4://proxy.com:1080'
   - Better for bypassing restrictions

3. Authentication:
   - Add username and password fields
   - Credentials are passed securely to the browser

4. Bypass List:
   - Use comma-separated hostnames
   - Wildcards supported: '*.local', '192.168.*'
   - Useful for internal resources

5. Testing Your Proxy:
   - Visit http://httpbin.org/ip to check your IP
   - Visit http://www.whatismyproxy.com to verify proxy
   - Check browser console for proxy errors

6. Common Issues:
   - Proxy server unreachable: Check server and port
   - Authentication failed: Verify credentials
   - SSL errors: May need to accept certificates
   - Slow performance: Normal with proxy routing
`);
  
  console.log('For more examples, see the documentation.');
}

// Run examples
proxyExamples().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});