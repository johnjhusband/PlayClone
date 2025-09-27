#!/usr/bin/env node

/**
 * Test script for mock enterprise authentication providers
 * Demonstrates how to use mock auth providers for testing without real SAML/SSO infrastructure
 */

const { 
  MockSAMLAuthProvider,
  MockSSOProvider,
  MockAuthTestHelper,
  MOCK_USERS
} = require('../dist/enterprise/auth/MockAuthProviders');

const chalk = require('chalk');

// Helper for colored console output
const log = {
  info: (msg) => console.log(chalk.blue('ℹ'), msg),
  success: (msg) => console.log(chalk.green('✓'), msg),
  error: (msg) => console.log(chalk.red('✗'), msg),
  section: (msg) => console.log(chalk.cyan.bold(`\n=== ${msg} ===`)),
  data: (label, data) => console.log(chalk.gray(`  ${label}:`), JSON.stringify(data, null, 2))
};

async function testMockSAML() {
  log.section('Testing Mock SAML Provider');
  
  try {
    // Create mock SAML provider with auto-authentication
    const samlProvider = new MockSAMLAuthProvider(
      {
        entityId: 'test-app',
        issuer: 'test-app-issuer'
      },
      {
        autoAuthenticate: true,
        defaultUser: 'admin',
        simulateDelay: 200
      }
    );
    
    log.info('Created mock SAML provider');
    
    // Test authentication request generation
    const authRequest = samlProvider.generateAuthRequest('/protected-page');
    log.success('Generated auth request');
    log.data('Request ID', authRequest.requestId);
    log.data('URL', authRequest.url);
    
    // Test SAML response validation (simulating browser callback)
    const mockResponse = Buffer.from('<saml-response userId="admin" />').toString('base64');
    const user = await samlProvider.validateSAMLResponse(mockResponse, authRequest.requestId);
    
    log.success('Validated SAML response and authenticated user');
    log.data('User', {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      groups: user.groups
    });
    
    // Test logout
    const logoutRequest = await samlProvider.generateLogoutRequest(user);
    log.success('Generated logout request');
    log.data('Logout URL', logoutRequest.url);
    
    return true;
  } catch (error) {
    log.error(`SAML test failed: ${error.message}`);
    return false;
  }
}

async function testMockOAuth() {
  log.section('Testing Mock OAuth/OIDC Provider');
  
  try {
    // Create mock OAuth provider
    const oauthProvider = new MockSSOProvider(
      {
        clientId: 'test-client',
        clientSecret: 'test-secret'
      },
      {
        autoAuthenticate: true,
        defaultUser: 'manager',
        simulateDelay: 150
      }
    );
    
    log.info('Created mock OAuth provider');
    
    // Test authorization URL generation
    const authRequest = oauthProvider.generateAuthorizationUrl('/dashboard');
    log.success('Generated authorization URL');
    log.data('URL', authRequest.url);
    log.data('State', authRequest.state);
    
    // Test token exchange (simulating callback with auth code)
    const mockCode = `mock_auth_code_${authRequest.state}_user_manager`;
    const user = await oauthProvider.exchangeCodeForToken(mockCode, authRequest.codeVerifier);
    
    log.success('Exchanged code for tokens');
    log.data('User', {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      roles: user.roles,
      hasAccessToken: !!user.accessToken,
      hasIdToken: !!user.idToken
    });
    
    // Test user info retrieval
    const userInfo = await oauthProvider.getMockUserInfo(user.accessToken);
    log.success('Retrieved user info with access token');
    log.data('Email verified', userInfo.emailVerified);
    
    // Test token refresh
    const refreshedUser = await oauthProvider.refreshMockAccessToken(user.refreshToken);
    log.success('Refreshed access token');
    log.data('New token', refreshedUser.accessToken.substring(0, 20) + '...');
    
    // Test logout
    await oauthProvider.logout(refreshedUser);
    log.success('User logged out');
    
    return true;
  } catch (error) {
    log.error(`OAuth test failed: ${error.message}`);
    return false;
  }
}

async function testMockAuthHelper() {
  log.section('Testing Mock Auth Test Helper');
  
  try {
    const helper = new MockAuthTestHelper();
    
    // Test SAML flow with helper
    log.info('Testing SAML flow with helper...');
    const samlUser = await helper.simulateSAMLFlow('user');
    log.success('SAML flow completed');
    log.data('User ID', samlUser.id);
    
    // Test OAuth flow with helper
    log.info('Testing OAuth flow with helper...');
    const oauthUser = await helper.simulateOAuthFlow('readonly');
    log.success('OAuth flow completed');
    log.data('User roles', oauthUser.roles);
    
    // Test permission checking
    log.info('Testing permission checks...');
    const hasAdminAccess = await helper.testPermissions(samlUser, ['admin', 'superuser']);
    log.data('User has admin access', hasAdminAccess);
    
    const hasUserAccess = await helper.testPermissions(samlUser, ['user', 'member']);
    log.data('User has user access', hasUserAccess);
    
    // Test MFA simulation
    log.info('Testing MFA challenge...');
    const mfaSuccess = await helper.simulateMFAChallenge(oauthUser, 'totp');
    log.success(`MFA challenge ${mfaSuccess ? 'passed' : 'failed'}`);
    
    return true;
  } catch (error) {
    log.error(`Helper test failed: ${error.message}`);
    return false;
  }
}

async function testErrorSimulation() {
  log.section('Testing Error Simulation');
  
  try {
    // Create provider with error simulation
    const errorProvider = new MockSSOProvider(
      {},
      {
        simulateErrors: true,
        errorRate: 0.5, // 50% error rate
        simulateDelay: 0
      }
    );
    
    log.info('Created provider with 50% error rate');
    
    let successCount = 0;
    let errorCount = 0;
    
    // Try multiple requests to see error simulation
    for (let i = 0; i < 10; i++) {
      try {
        const authRequest = errorProvider.generateAuthorizationUrl('/test');
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }
    
    log.success(`Requests: ${successCount} succeeded, ${errorCount} failed`);
    log.data('Error rate', `${(errorCount / 10 * 100).toFixed(0)}%`);
    
    return true;
  } catch (error) {
    log.error(`Error simulation test failed: ${error.message}`);
    return false;
  }
}

async function testAllUsers() {
  log.section('Testing All Mock Users');
  
  try {
    const provider = new MockSSOProvider();
    
    for (const [userId, userData] of Object.entries(MOCK_USERS)) {
      // Set provider to use this user
      provider.setAutoAuthenticate(true, userId);
      
      // Generate auth and get user
      const authRequest = provider.generateAuthorizationUrl();
      const code = `mock_auth_code_${authRequest.state}_user_${userId}`;
      const user = await provider.exchangeCodeForToken(code);
      
      log.success(`Authenticated as ${userId}`);
      log.data('Details', {
        name: user.name,
        email: user.email,
        roles: user.roles,
        groups: user.groups
      });
    }
    
    return true;
  } catch (error) {
    log.error(`User test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log(chalk.bold.magenta('\n🔐 PlayClone Mock Enterprise Authentication Test\n'));
  
  const tests = [
    { name: 'Mock SAML', fn: testMockSAML },
    { name: 'Mock OAuth/OIDC', fn: testMockOAuth },
    { name: 'Mock Auth Helper', fn: testMockAuthHelper },
    { name: 'Error Simulation', fn: testErrorSimulation },
    { name: 'All Users', fn: testAllUsers }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await test.fn();
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  log.section('Test Summary');
  console.log(chalk.green(`  ✓ Passed: ${passed}`));
  if (failed > 0) {
    console.log(chalk.red(`  ✗ Failed: ${failed}`));
  }
  console.log(chalk.cyan(`  Total: ${tests.length}`));
  console.log(chalk.yellow(`  Pass Rate: ${(passed / tests.length * 100).toFixed(0)}%`));
  
  if (failed === 0) {
    console.log(chalk.bold.green('\n🎉 All mock authentication tests passed!\n'));
  } else {
    console.log(chalk.bold.yellow('\n⚠️ Some tests failed. Check the output above.\n'));
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testMockSAML,
  testMockOAuth,
  testMockAuthHelper,
  testErrorSimulation,
  testAllUsers
};