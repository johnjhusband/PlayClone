#!/usr/bin/env node

/**
 * Example: Using Mock Authentication Providers with PlayClone
 * 
 * This example demonstrates how to use mock enterprise authentication
 * providers to test protected browser automation workflows without
 * needing actual SAML/SSO infrastructure.
 */

const { PlayClone } = require('../dist/index');
const { 
  MockSAMLAuthProvider,
  MockSSOProvider,
  MockAuthTestHelper,
  MOCK_USERS
} = require('../dist/enterprise/auth/MockAuthProviders');
const { EnterpriseSessionManager } = require('../dist/enterprise/auth/EnterpriseSessionManager');

// Create a mock protected web application
class MockProtectedApp {
  constructor(port = 3001) {
    this.port = port;
    this.baseUrl = `http://localhost:${port}`;
    this.sessions = new Map();
  }

  /**
   * Simulate a protected application with login page
   */
  async createMockPages(pc) {
    // Create login page HTML
    const loginPageHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mock Enterprise Login</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          .login-box { max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #ccc; }
          button { padding: 10px 20px; margin: 10px; cursor: pointer; }
          .sso-button { background: #4CAF50; color: white; }
          .saml-button { background: #2196F3; color: white; }
        </style>
      </head>
      <body>
        <div class="login-box">
          <h2>Enterprise Login</h2>
          <p>Choose your authentication method:</p>
          <button class="saml-button" onclick="loginSAML()">Login with SAML</button>
          <button class="sso-button" onclick="loginSSO()">Login with SSO</button>
          <div id="status"></div>
        </div>
        <script>
          function loginSAML() {
            document.getElementById('status').innerText = 'Redirecting to SAML provider...';
            // Simulate SAML redirect
            window.location.href = '/auth/saml/callback?user=admin&success=true';
          }
          function loginSSO() {
            document.getElementById('status').innerText = 'Redirecting to SSO provider...';
            // Simulate OAuth redirect
            window.location.href = '/auth/oauth/callback?user=manager&success=true';
          }
        </script>
      </body>
      </html>
    `;

    // Create dashboard page HTML (protected)
    const dashboardHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Enterprise Dashboard</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          .dashboard { max-width: 800px; margin: 0 auto; }
          .user-info { background: #f0f0f0; padding: 15px; margin-bottom: 20px; }
          .section { border: 1px solid #ddd; padding: 15px; margin: 10px 0; }
          button { padding: 8px 15px; }
        </style>
      </head>
      <body>
        <div class="dashboard">
          <div class="user-info">
            <h2>Welcome to Enterprise Dashboard</h2>
            <p>User: <span id="username">Admin User</span></p>
            <p>Email: <span id="email">admin@example.com</span></p>
            <p>Roles: <span id="roles">admin, user</span></p>
          </div>
          <div class="section">
            <h3>Admin Section</h3>
            <p>Only visible to admins</p>
            <button onclick="performAdminAction()">Admin Action</button>
          </div>
          <div class="section">
            <h3>User Section</h3>
            <p>Visible to all authenticated users</p>
            <button onclick="performUserAction()">User Action</button>
          </div>
          <button onclick="logout()">Logout</button>
        </div>
        <script>
          function performAdminAction() {
            alert('Admin action performed!');
          }
          function performUserAction() {
            alert('User action performed!');
          }
          function logout() {
            window.location.href = '/logout';
          }
        </script>
      </body>
      </html>
    `;

    return { loginPageHtml, dashboardHtml };
  }
}

async function demonstrateMockSAMLAuth() {
  console.log('\n🔐 Demonstrating Mock SAML Authentication with PlayClone\n');
  
  const pc = new PlayClone({ headless: true });
  const mockApp = new MockProtectedApp();
  const helper = new MockAuthTestHelper();
  
  try {
    // Step 1: Set up mock SAML provider
    console.log('1. Setting up mock SAML provider...');
    const samlProvider = new MockSAMLAuthProvider(
      {
        callbackUrl: `${mockApp.baseUrl}/auth/saml/callback`
      },
      {
        autoAuthenticate: true,
        defaultUser: 'admin'
      }
    );
    
    // Step 2: Generate mock pages
    const { loginPageHtml, dashboardHtml } = await mockApp.createMockPages(pc);
    
    // Step 3: Navigate to login page
    console.log('2. Navigating to mock login page...');
    await pc.navigate(`data:text/html,${encodeURIComponent(loginPageHtml)}`);
    
    // Step 4: Click SAML login button
    console.log('3. Clicking SAML login button...');
    await pc.click('Login with SAML');
    
    // Step 5: Simulate SAML authentication flow
    console.log('4. Simulating SAML authentication flow...');
    const samlUser = await helper.simulateSAMLFlow('admin');
    console.log(`   ✓ Authenticated as: ${samlUser.name} (${samlUser.email})`);
    console.log(`   ✓ Roles: ${samlUser.roles.join(', ')}`);
    
    // Step 6: Navigate to protected dashboard
    console.log('5. Navigating to protected dashboard...');
    await pc.navigate(`data:text/html,${encodeURIComponent(dashboardHtml)}`);
    
    // Step 7: Verify user is logged in
    const username = await pc.getText('#username');
    console.log(`   ✓ Dashboard shows user: ${username}`);
    
    // Step 8: Test role-based access
    console.log('6. Testing role-based access control...');
    const hasAdminAccess = await helper.testPermissions(samlUser, ['admin']);
    if (hasAdminAccess) {
      console.log('   ✓ User has admin access - performing admin action');
      await pc.click('Admin Action');
    }
    
    // Step 9: Logout
    console.log('7. Logging out...');
    const logoutRequest = await samlProvider.generateLogoutRequest(samlUser);
    console.log(`   ✓ Logout URL: ${logoutRequest.url}`);
    
    await pc.close();
    console.log('\n✅ Mock SAML authentication demonstration complete!\n');
    
  } catch (error) {
    console.error('Error:', error.message);
    await pc.close();
  }
}

async function demonstrateMockOAuthAuth() {
  console.log('\n🔑 Demonstrating Mock OAuth/OIDC Authentication with PlayClone\n');
  
  const pc = new PlayClone({ headless: true });
  const mockApp = new MockProtectedApp();
  
  try {
    // Step 1: Set up mock OAuth provider
    console.log('1. Setting up mock OAuth provider...');
    const oauthProvider = new MockSSOProvider(
      {
        clientId: 'playclone-test',
        callbackUrl: `${mockApp.baseUrl}/auth/oauth/callback`
      },
      {
        autoAuthenticate: true,
        defaultUser: 'manager'
      }
    );
    
    // Step 2: Generate mock pages
    const { loginPageHtml, dashboardHtml } = await mockApp.createMockPages(pc);
    
    // Step 3: Navigate to login page
    console.log('2. Navigating to mock login page...');
    await pc.navigate(`data:text/html,${encodeURIComponent(loginPageHtml)}`);
    
    // Step 4: Click SSO login button
    console.log('3. Clicking SSO login button...');
    await pc.click('Login with SSO');
    
    // Step 5: Generate authorization URL
    console.log('4. Generating OAuth authorization URL...');
    const authRequest = oauthProvider.generateAuthorizationUrl('/dashboard');
    console.log(`   ✓ State: ${authRequest.state}`);
    
    // Step 6: Simulate OAuth callback with authorization code
    console.log('5. Simulating OAuth callback...');
    const mockCode = `mock_auth_code_${authRequest.state}_user_manager`;
    const oauthUser = await oauthProvider.exchangeCodeForToken(mockCode);
    console.log(`   ✓ Authenticated as: ${oauthUser.name} (${oauthUser.email})`);
    console.log(`   ✓ Provider: ${oauthUser.provider}`);
    console.log(`   ✓ Has tokens: Access=${!!oauthUser.accessToken}, ID=${!!oauthUser.idToken}`);
    
    // Step 7: Get user info using access token
    console.log('6. Fetching user info with access token...');
    const userInfo = await oauthProvider.getUserInfo(oauthUser.accessToken);
    console.log(`   ✓ Email verified: ${userInfo.emailVerified}`);
    console.log(`   ✓ Groups: ${userInfo.groups.join(', ')}`);
    
    // Step 8: Refresh token
    console.log('7. Refreshing access token...');
    const refreshedUser = await oauthProvider.refreshAccessToken(oauthUser.refreshToken);
    console.log(`   ✓ New access token: ${refreshedUser.accessToken.substring(0, 30)}...`);
    
    // Step 9: Logout
    console.log('8. Logging out...');
    await oauthProvider.logout(refreshedUser);
    console.log('   ✓ User logged out successfully');
    
    await pc.close();
    console.log('\n✅ Mock OAuth authentication demonstration complete!\n');
    
  } catch (error) {
    console.error('Error:', error.message);
    await pc.close();
  }
}

async function demonstrateEnterpriseSession() {
  console.log('\n🏢 Demonstrating Enterprise Session Management\n');
  
  const pc = new PlayClone({ headless: true });
  
  try {
    // Create enterprise session manager
    console.log('1. Creating enterprise session manager...');
    const sessionManager = new EnterpriseSessionManager({
      maxConcurrentSessions: 5,
      sessionTimeout: 3600000, // 1 hour
      enforceRBAC: true
    });
    
    // Create mock users with different roles
    const users = [
      { id: 'u1', name: 'Alice Admin', roles: ['admin'], permissions: ['read', 'write', 'delete'] },
      { id: 'u2', name: 'Bob Manager', roles: ['manager'], permissions: ['read', 'write'] },
      { id: 'u3', name: 'Charlie User', roles: ['user'], permissions: ['read'] }
    ];
    
    console.log('2. Creating sessions for different users...');
    for (const user of users) {
      const session = await sessionManager.createSession(user);
      console.log(`   ✓ Session created for ${user.name}`);
      console.log(`     - Session ID: ${session.id}`);
      console.log(`     - Roles: ${user.roles.join(', ')}`);
      console.log(`     - Permissions: ${user.permissions.join(', ')}`);
      
      // Test permission checking
      const canDelete = await sessionManager.checkPermission(session.id, 'delete');
      console.log(`     - Can delete: ${canDelete}`);
    }
    
    // Get active sessions
    console.log('\n3. Active sessions:');
    const activeSessions = await sessionManager.getActiveSessions();
    console.log(`   ✓ Total active sessions: ${activeSessions.length}`);
    
    // Test session limits per role
    console.log('\n4. Testing session limits...');
    const roleLimit = await sessionManager.getSessionLimitForRole('admin');
    console.log(`   ✓ Admin session limit: ${roleLimit || 'unlimited'}`);
    
    await pc.close();
    console.log('\n✅ Enterprise session management demonstration complete!\n');
    
  } catch (error) {
    console.error('Error:', error.message);
    await pc.close();
  }
}

async function demonstrateErrorHandling() {
  console.log('\n⚠️ Demonstrating Error Handling and Recovery\n');
  
  try {
    // Create provider with error simulation
    console.log('1. Creating provider with simulated errors...');
    const errorProvider = new MockSSOProvider(
      {},
      {
        simulateErrors: true,
        errorRate: 0.3, // 30% error rate
        simulateDelay: 100
      }
    );
    
    console.log('2. Attempting multiple authentication requests...');
    let successCount = 0;
    let errorCount = 0;
    const attempts = 10;
    
    for (let i = 0; i < attempts; i++) {
      try {
        const authRequest = errorProvider.generateAuthorizationUrl();
        const code = `mock_auth_code_${authRequest.state}`;
        await errorProvider.exchangeCodeForToken(code);
        successCount++;
        console.log(`   ✓ Attempt ${i + 1}: Success`);
      } catch (error) {
        errorCount++;
        console.log(`   ✗ Attempt ${i + 1}: ${error.message}`);
      }
    }
    
    console.log(`\n3. Results:`);
    console.log(`   - Success rate: ${(successCount / attempts * 100).toFixed(0)}%`);
    console.log(`   - Error rate: ${(errorCount / attempts * 100).toFixed(0)}%`);
    console.log(`   - Total attempts: ${attempts}`);
    
    console.log('\n✅ Error handling demonstration complete!\n');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function runAllDemonstrations() {
  console.log('=' .repeat(60));
  console.log('  PlayClone Mock Enterprise Authentication Demonstrations');
  console.log('=' .repeat(60));
  
  await demonstrateMockSAMLAuth();
  await demonstrateMockOAuthAuth();
  await demonstrateEnterpriseSession();
  await demonstrateErrorHandling();
  
  console.log('=' .repeat(60));
  console.log('  All demonstrations completed successfully!');
  console.log('=' .repeat(60));
}

// Run demonstrations if executed directly
if (require.main === module) {
  runAllDemonstrations().catch(console.error);
}

module.exports = {
  demonstrateMockSAMLAuth,
  demonstrateMockOAuthAuth,
  demonstrateEnterpriseSession,
  demonstrateErrorHandling
};