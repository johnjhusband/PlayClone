const { 
  SAMLAuthProvider, 
  SSOProvider, 
  AuthMiddleware, 
  EnterpriseSessionManager 
} = require('../dist/enterprise/auth');

async function testEnterpriseAuth() {
  console.log('🔐 Testing Enterprise Authentication Features\n');
  
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: SAML Authentication Provider
  console.log('Test 1: SAML Authentication Provider');
  try {
    const samlConfig = {
      entityId: 'https://playclone.example.com',
      ssoUrl: 'https://idp.example.com/sso',
      sloUrl: 'https://idp.example.com/slo',
      certificate: 'MOCK_CERTIFICATE',
      callbackUrl: 'https://playclone.example.com/saml/callback',
      issuer: 'PlayClone',
      signatureAlgorithm: 'sha256'
    };
    
    const samlProvider = new SAMLAuthProvider(samlConfig);
    
    // Generate auth request
    const authRequest = samlProvider.generateAuthRequest('/dashboard');
    console.assert(authRequest.requestId, 'Auth request should have ID');
    console.assert(authRequest.url.includes(samlConfig.ssoUrl), 'Auth URL should contain SSO URL');
    console.assert(authRequest.samlRequest, 'Should have encoded SAML request');
    
    // Get metadata
    const metadata = samlProvider.getMetadata();
    console.assert(metadata.includes(samlConfig.entityId), 'Metadata should contain entity ID');
    
    console.log('✅ SAML provider working correctly\n');
    testsPassed++;
  } catch (error) {
    console.error('❌ SAML provider test failed:', error.message);
    testsFailed++;
  }

  // Test 2: OAuth/OIDC SSO Provider
  console.log('Test 2: OAuth/OIDC SSO Provider');
  try {
    const oauthConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      authorizationUrl: 'https://oauth.example.com/authorize',
      tokenUrl: 'https://oauth.example.com/token',
      userInfoUrl: 'https://oauth.example.com/userinfo',
      callbackUrl: 'https://playclone.example.com/oauth/callback',
      scope: 'openid profile email',
      pkce: true
    };
    
    const ssoProvider = new SSOProvider(oauthConfig);
    
    // Generate authorization URL
    const authUrl = ssoProvider.generateAuthorizationUrl('/home');
    console.assert(authUrl.url, 'Should have authorization URL');
    console.assert(authUrl.state, 'Should have state for CSRF protection');
    console.assert(authUrl.codeChallenge, 'Should have PKCE challenge');
    console.assert(authUrl.url.includes(oauthConfig.clientId), 'URL should contain client ID');
    
    console.log('✅ SSO provider working correctly\n');
    testsPassed++;
  } catch (error) {
    console.error('❌ SSO provider test failed:', error.message);
    testsFailed++;
  }

  // Test 3: Authentication Middleware
  console.log('Test 3: Authentication Middleware');
  try {
    const authConfig = {
      provider: 'local',
      required: true,
      sessionTimeout: 3600000,
      roleBasedAccess: {
        enabled: true,
        defaultRole: 'user'
      }
    };
    
    const authMiddleware = new AuthMiddleware(authConfig);
    
    // Test local authentication
    const session = await authMiddleware.authenticate({
      username: 'admin',
      password: 'admin'
    }, 'local');
    
    console.assert(session.id, 'Session should have ID');
    console.assert(session.userId === 'local_admin', 'Should authenticate admin user');
    console.assert(session.provider === 'local', 'Provider should be local');
    
    // Test authorization
    const authorized = await authMiddleware.authorize(session.id);
    console.assert(authorized === true, 'Session should be authorized');
    
    // Test logout
    await authMiddleware.logout(session.id);
    const loggedOutSession = authMiddleware.getSession(session.id);
    console.assert(!loggedOutSession, 'Session should be removed after logout');
    
    console.log('✅ Auth middleware working correctly\n');
    testsPassed++;
  } catch (error) {
    console.error('❌ Auth middleware test failed:', error.message);
    testsFailed++;
  }

  // Test 4: Enterprise Session Manager with RBAC
  console.log('Test 4: Enterprise Session Manager with RBAC');
  try {
    const rbacConfig = {
      rbac: {
        roles: [
          {
            id: 'admin',
            name: 'admin',
            description: 'Administrator role',
            permissions: [
              { resource: '*', actions: ['*'] }
            ]
          },
          {
            id: 'user',
            name: 'user',
            description: 'Regular user role',
            permissions: [
              { resource: 'browser', actions: ['navigate', 'click', 'fill'] },
              { resource: 'data', actions: ['extract'] }
            ]
          },
          {
            id: 'viewer',
            name: 'viewer',
            description: 'Read-only viewer role',
            permissions: [
              { resource: 'browser', actions: ['navigate'] },
              { resource: 'data', actions: ['extract'] }
            ]
          }
        ],
        defaultRole: 'viewer',
        superAdminRoles: ['admin']
      },
      sessionLimits: {
        maxSessionsPerUser: 5,
        maxConcurrentSessions: 100,
        maxIdleTime: 1800000, // 30 minutes
        maxSessionDuration: 86400000 // 24 hours
      },
      auditLogging: {
        enabled: true,
        retention: 2592000000 // 30 days
      }
    };
    
    const authMiddleware = new AuthMiddleware({ provider: 'local' });
    const enterpriseManager = new EnterpriseSessionManager(rbacConfig, authMiddleware);
    
    // Create mock auth session
    const authSession = {
      id: 'test-session-1',
      userId: 'test-user-1',
      user: {
        id: 'test-user-1',
        email: 'user@example.com',
        roles: ['user']
      },
      provider: 'local',
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    // Create enterprise session
    const sessionId = await enterpriseManager.createSession(authSession);
    console.assert(sessionId === 'test-session-1', 'Should return session ID');
    
    // Test authorization for user role
    const canNavigate = await enterpriseManager.authorize(sessionId, 'browser', 'navigate');
    console.assert(canNavigate === true, 'User should be able to navigate');
    
    const canDelete = await enterpriseManager.authorize(sessionId, 'browser', 'delete');
    console.assert(canDelete === false, 'User should not be able to delete');
    
    // Update roles to admin
    await enterpriseManager.updateUserRoles('test-user-1', ['admin']);
    
    // Test admin authorization
    const canAdminDelete = await enterpriseManager.authorize(sessionId, 'browser', 'delete');
    console.assert(canAdminDelete === true, 'Admin should be able to delete');
    
    // Get audit logs
    const auditLogs = await enterpriseManager.getAuditLogs({ userId: 'test-user-1' });
    console.assert(auditLogs.length > 0, 'Should have audit logs');
    console.assert(auditLogs.some(log => log.action === 'session.create'), 'Should log session creation');
    console.assert(auditLogs.some(log => log.action === 'roles.update'), 'Should log role updates');
    
    // Terminate session
    await enterpriseManager.terminateSession(sessionId);
    const terminatedSession = enterpriseManager.getSession(sessionId);
    console.assert(!terminatedSession, 'Session should be terminated');
    
    console.log('✅ Enterprise session manager with RBAC working correctly\n');
    testsPassed++;
  } catch (error) {
    console.error('❌ Enterprise session manager test failed:', error.message);
    testsFailed++;
  }

  // Test 5: Session Limits
  console.log('Test 5: Session Limits');
  try {
    const rbacConfig = {
      rbac: {
        roles: [
          {
            id: 'user',
            name: 'user',
            permissions: [
              { resource: 'browser', actions: ['navigate'] }
            ]
          }
        ]
      },
      sessionLimits: {
        maxSessionsPerUser: 2,
        maxConcurrentSessions: 3
      }
    };
    
    const authMiddleware = new AuthMiddleware({ provider: 'local' });
    const enterpriseManager = new EnterpriseSessionManager(rbacConfig, authMiddleware);
    
    // Create sessions up to limit
    for (let i = 1; i <= 2; i++) {
      const session = {
        id: `session-${i}`,
        userId: 'limited-user',
        user: { id: 'limited-user', roles: ['user'] },
        provider: 'local',
        createdAt: new Date(),
        lastActivity: new Date()
      };
      await enterpriseManager.createSession(session);
    }
    
    // Try to exceed limit
    let limitExceeded = false;
    try {
      const extraSession = {
        id: 'session-3',
        userId: 'limited-user',
        user: { id: 'limited-user', roles: ['user'] },
        provider: 'local',
        createdAt: new Date(),
        lastActivity: new Date()
      };
      await enterpriseManager.createSession(extraSession);
    } catch (error) {
      if (error.message.includes('maximum session limit')) {
        limitExceeded = true;
      }
    }
    
    console.assert(limitExceeded, 'Should enforce session limits');
    
    console.log('✅ Session limits working correctly\n');
    testsPassed++;
  } catch (error) {
    console.error('❌ Session limits test failed:', error.message);
    testsFailed++;
  }

  // Test 6: Multi-Factor Authentication
  console.log('Test 6: Multi-Factor Authentication');
  try {
    const authConfig = {
      provider: 'local',
      multiFactorAuth: {
        enabled: true,
        methods: ['totp', 'sms']
      }
    };
    
    const authMiddleware = new AuthMiddleware(authConfig);
    
    // Track MFA required event
    let mfaRequired = false;
    authMiddleware.on('mfaRequired', () => {
      mfaRequired = true;
    });
    
    // Authenticate (should trigger MFA)
    const session = await authMiddleware.authenticate({
      username: 'admin',
      password: 'admin'
    }, 'local');
    
    console.assert(mfaRequired, 'MFA should be required');
    console.assert(session.mfaVerified === false, 'MFA should not be verified initially');
    
    // Verify MFA
    const verified = await authMiddleware.verifyMFA(session.id, '123456', 'totp');
    console.assert(verified === true, 'MFA should be verified with correct code');
    
    console.log('✅ Multi-factor authentication working correctly\n');
    testsPassed++;
  } catch (error) {
    console.error('❌ MFA test failed:', error.message);
    testsFailed++;
  }

  // Summary
  console.log('=' .repeat(60));
  console.log(`Tests Passed: ${testsPassed}/${testsPassed + testsFailed}`);
  console.log(`Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  
  if (testsFailed === 0) {
    console.log('🎉 All enterprise authentication tests passed!');
  } else {
    console.log(`⚠️ ${testsFailed} test(s) failed`);
  }
  
  return testsFailed === 0;
}

// Run tests
testEnterpriseAuth().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});