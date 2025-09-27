/**
 * Enterprise Authentication Example
 * Demonstrates SAML, OAuth/OIDC, and RBAC features
 */

const { 
  SAMLAuthProvider,
  SSOProvider,
  AuthMiddleware,
  EnterpriseSessionManager,
  PlayClone
} = require('../dist');

async function demonstrateEnterpriseAuth() {
  console.log('🏢 PlayClone Enterprise Authentication Demo\n');
  console.log('=' .repeat(60));
  
  // ========================================
  // 1. SAML Authentication Setup
  // ========================================
  console.log('\n📋 SAML Authentication Setup');
  console.log('-'.repeat(40));
  
  const samlProvider = new SAMLAuthProvider({
    entityId: 'https://app.example.com',
    ssoUrl: 'https://idp.example.com/saml/sso',
    sloUrl: 'https://idp.example.com/saml/slo',
    certificate: `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJALmVVuDWu4NYMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
...certificate content...
-----END CERTIFICATE-----`,
    callbackUrl: 'https://app.example.com/saml/callback',
    issuer: 'PlayClone Enterprise',
    attributeMapping: {
      id: 'uid',
      email: 'mail',
      name: 'displayName',
      groups: 'memberOf',
      roles: 'role'
    }
  });
  
  // Generate SAML login URL
  const samlAuth = samlProvider.generateAuthRequest('/dashboard');
  console.log('SAML Login URL Generated:');
  console.log(`Request ID: ${samlAuth.requestId}`);
  console.log(`SSO URL: ${samlAuth.url.substring(0, 80)}...`);
  
  // Display SAML metadata
  const metadata = samlProvider.getMetadata();
  console.log('\nSAML Metadata (for IdP configuration):');
  console.log(metadata.substring(0, 200) + '...');
  
  // ========================================
  // 2. OAuth 2.0 / OIDC Setup
  // ========================================
  console.log('\n🔐 OAuth 2.0 / OIDC Setup');
  console.log('-'.repeat(40));
  
  // Google OAuth example
  const googleProvider = new SSOProvider({
    clientId: 'YOUR_GOOGLE_CLIENT_ID',
    clientSecret: 'YOUR_GOOGLE_CLIENT_SECRET',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    callbackUrl: 'https://app.example.com/oauth/google/callback',
    scope: 'openid profile email',
    pkce: true // Use PKCE for enhanced security
  });
  
  // Microsoft Azure AD example
  const azureProvider = new SSOProvider({
    clientId: 'YOUR_AZURE_CLIENT_ID',
    clientSecret: 'YOUR_AZURE_CLIENT_SECRET',
    authorizationUrl: 'https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/token',
    callbackUrl: 'https://app.example.com/oauth/azure/callback',
    scope: 'openid profile email User.Read',
    issuer: 'https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0',
    discoveryUrl: 'https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0/.well-known/openid-configuration'
  });
  
  // Generate OAuth login URLs
  const googleAuth = googleProvider.generateAuthorizationUrl('/home');
  console.log('Google OAuth URL:');
  console.log(`State: ${googleAuth.state}`);
  console.log(`URL: ${googleAuth.url.substring(0, 80)}...`);
  
  const azureAuth = azureProvider.generateAuthorizationUrl('/home');
  console.log('\nAzure AD OAuth URL:');
  console.log(`State: ${azureAuth.state}`);
  console.log(`URL: ${azureAuth.url.substring(0, 80)}...`);
  
  // ========================================
  // 3. Enterprise Session Management with RBAC
  // ========================================
  console.log('\n👥 Enterprise Session Management with RBAC');
  console.log('-'.repeat(40));
  
  // Configure authentication middleware
  const authMiddleware = new AuthMiddleware({
    provider: 'local', // Can be 'saml', 'oauth', 'oidc', or 'local'
    required: true,
    sessionTimeout: 3600000, // 1 hour
    allowAnonymous: false,
    roleBasedAccess: {
      enabled: true,
      defaultRole: 'viewer',
      adminRoles: ['admin', 'super-admin']
    },
    multiFactorAuth: {
      enabled: true,
      methods: ['totp', 'sms', 'email']
    }
  });
  
  // Register providers
  authMiddleware.registerProvider('saml', samlProvider);
  authMiddleware.registerProvider('oauth', googleProvider);
  
  // Configure enterprise session manager
  const enterpriseConfig = {
    rbac: {
      roles: [
        {
          id: 'super-admin',
          name: 'super-admin',
          description: 'Full system access',
          permissions: [
            { resource: '*', actions: ['*'] }
          ],
          priority: 100
        },
        {
          id: 'admin',
          name: 'admin',
          description: 'Administrative access',
          permissions: [
            { resource: 'browser', actions: ['*'] },
            { resource: 'data', actions: ['*'] },
            { resource: 'state', actions: ['*'] },
            { resource: 'session', actions: ['create', 'read', 'update', 'delete'] }
          ],
          priority: 90
        },
        {
          id: 'developer',
          name: 'developer',
          description: 'Developer access',
          permissions: [
            { resource: 'browser', actions: ['navigate', 'click', 'fill', 'screenshot'] },
            { resource: 'data', actions: ['extract', 'export'] },
            { resource: 'state', actions: ['save', 'restore'] }
          ],
          priority: 50,
          inherits: ['user']
        },
        {
          id: 'user',
          name: 'user',
          description: 'Standard user access',
          permissions: [
            { resource: 'browser', actions: ['navigate', 'click', 'fill'] },
            { resource: 'data', actions: ['extract'] }
          ],
          priority: 30
        },
        {
          id: 'viewer',
          name: 'viewer',
          description: 'Read-only access',
          permissions: [
            { resource: 'browser', actions: ['navigate'] },
            { resource: 'data', actions: ['extract'] }
          ],
          priority: 10
        }
      ],
      defaultRole: 'viewer',
      superAdminRoles: ['super-admin'],
      resourceHierarchy: {
        'browser.navigate': ['browser'],
        'browser.click': ['browser'],
        'browser.fill': ['browser'],
        'data.extract': ['data'],
        'data.export': ['data']
      }
    },
    sessionLimits: {
      maxConcurrentSessions: 1000,
      maxSessionsPerUser: 5,
      maxIdleTime: 1800000, // 30 minutes
      maxSessionDuration: 86400000 // 24 hours
    },
    auditLogging: {
      enabled: true,
      logPath: './audit-logs',
      retention: 2592000000 // 30 days
    },
    compliance: {
      gdpr: true,
      hipaa: false,
      sox: true,
      pci: false
    }
  };
  
  const sessionManager = new EnterpriseSessionManager(enterpriseConfig, authMiddleware);
  
  // ========================================
  // 4. Authentication Flow Demo
  // ========================================
  console.log('\n🔄 Authentication Flow Demo');
  console.log('-'.repeat(40));
  
  // Simulate local authentication
  console.log('1. Authenticating user...');
  const authSession = await authMiddleware.authenticate({
    username: 'admin',
    password: 'admin'
  }, 'local');
  
  console.log(`   ✅ User authenticated: ${authSession.userId}`);
  console.log(`   Session ID: ${authSession.id}`);
  console.log(`   Provider: ${authSession.provider}`);
  
  // Create enterprise session
  console.log('\n2. Creating enterprise session with RBAC...');
  const sessionId = await sessionManager.createSession(authSession);
  console.log(`   ✅ Enterprise session created: ${sessionId}`);
  
  // Get session details
  const session = sessionManager.getSession(sessionId);
  console.log(`   Roles: ${session.roles.join(', ')}`);
  console.log(`   Permissions: ${session.permissions.slice(0, 5).join(', ')}...`);
  
  // ========================================
  // 5. Authorization Checks
  // ========================================
  console.log('\n🛡️ Authorization Checks');
  console.log('-'.repeat(40));
  
  const checks = [
    { resource: 'browser', action: 'navigate', expected: true },
    { resource: 'browser', action: 'click', expected: true },
    { resource: 'browser', action: 'delete', expected: true }, // Admin can delete
    { resource: 'data', action: 'extract', expected: true },
    { resource: 'system', action: 'shutdown', expected: true }, // Admin has * permission
  ];
  
  for (const check of checks) {
    const authorized = await sessionManager.authorize(
      sessionId, 
      check.resource, 
      check.action
    );
    const icon = authorized === check.expected ? '✅' : '❌';
    console.log(`${icon} ${check.resource}:${check.action} - ${authorized ? 'Allowed' : 'Denied'}`);
  }
  
  // ========================================
  // 6. PlayClone with Authentication
  // ========================================
  console.log('\n🌐 PlayClone with Authentication');
  console.log('-'.repeat(40));
  
  console.log('Creating authenticated PlayClone session...');
  const pc = await sessionManager.getAuthorizedPlayClone(sessionId, {
    headless: true
  });
  
  console.log('✅ PlayClone instance created with authorization wrapper');
  
  // Demonstrate authorized browser actions
  console.log('\nPerforming authorized actions:');
  
  try {
    // Navigate (should succeed)
    console.log('  Navigating to example.com...');
    const navResult = await pc.navigate('https://example.com');
    console.log(`  ✅ Navigation ${navResult.success ? 'succeeded' : 'failed'}`);
    
    // Get text (should succeed)
    console.log('  Extracting page text...');
    const textResult = await pc.getText();
    console.log(`  ✅ Extracted ${textResult.data.length} characters`);
    
  } catch (error) {
    console.log(`  ❌ Action failed: ${error.message}`);
  }
  
  // ========================================
  // 7. Audit Logging
  // ========================================
  console.log('\n📝 Audit Logging');
  console.log('-'.repeat(40));
  
  const auditLogs = await sessionManager.getAuditLogs({
    userId: authSession.userId,
    startDate: new Date(Date.now() - 3600000)
  });
  
  console.log(`Found ${auditLogs.length} audit log entries:`);
  for (const log of auditLogs.slice(-5)) {
    const time = log.timestamp.toISOString().split('T')[1].split('.')[0];
    const result = log.result === 'success' ? '✅' : log.result === 'denied' ? '🚫' : '❌';
    console.log(`  [${time}] ${result} ${log.action} ${log.resource ? `(${log.resource})` : ''}`);
  }
  
  // ========================================
  // 8. Session Management
  // ========================================
  console.log('\n🔧 Session Management');
  console.log('-'.repeat(40));
  
  // Update user roles
  console.log('Changing user role to viewer...');
  await sessionManager.updateUserRoles(authSession.userId, ['viewer']);
  
  // Check new permissions
  const viewerAuth = await sessionManager.authorize(sessionId, 'browser', 'fill');
  console.log(`  Browser fill permission: ${viewerAuth ? 'Allowed' : 'Denied'}`);
  
  // Get all user sessions
  const userSessions = sessionManager.getUserSessions(authSession.userId);
  console.log(`\nUser has ${userSessions.length} active session(s)`);
  
  // ========================================
  // 9. Cleanup
  // ========================================
  console.log('\n🧹 Cleanup');
  console.log('-'.repeat(40));
  
  // Close PlayClone
  await pc.close();
  console.log('✅ PlayClone session closed');
  
  // Terminate session
  await sessionManager.terminateSession(sessionId);
  console.log('✅ Enterprise session terminated');
  
  // Logout
  await authMiddleware.logout(authSession.id);
  console.log('✅ User logged out');
  
  console.log('\n' + '=' .repeat(60));
  console.log('🎉 Enterprise Authentication Demo Complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('  ✓ SAML 2.0 authentication');
  console.log('  ✓ OAuth 2.0 / OIDC integration');
  console.log('  ✓ Role-Based Access Control (RBAC)');
  console.log('  ✓ Multi-Factor Authentication (MFA)');
  console.log('  ✓ Session management with limits');
  console.log('  ✓ Audit logging for compliance');
  console.log('  ✓ Authorized PlayClone operations');
  console.log('  ✓ Dynamic role updates');
}

// Run the demo
demonstrateEnterpriseAuth().catch(error => {
  console.error('Demo failed:', error);
  process.exit(1);
});