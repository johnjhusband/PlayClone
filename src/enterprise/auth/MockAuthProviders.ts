import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { Logger } from '../../utils/Logger';
import { 
  SAMLConfig, 
  SAMLAssertion, 
  SAMLUser,
  SAMLAuthProvider 
} from './SAMLAuthProvider';
import { 
  OAuthConfig, 
  OIDCConfig, 
  SSOUser, 
  AuthorizationRequest,
  SSOProvider 
} from './SSOProvider';

/**
 * Mock SAML configuration for testing
 */
export const MOCK_SAML_CONFIG: SAMLConfig = {
  entityId: 'https://mock-saml-provider.example.com',
  ssoUrl: 'https://mock-saml-provider.example.com/sso',
  sloUrl: 'https://mock-saml-provider.example.com/slo',
  certificate: `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKLdQVPy90L8MA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMSEwHwYDVQQKDBhNb2NrIFNBTUwg
UHJvdmlkZXIgVGVzdDAeFw0yNDAxMDEwMDAwMDBaFw0zNDAxMDEwMDAwMDBaMEUx
CzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMSEwHwYDVQQKDBhNb2Nr
IFNBTUYGUHJ2aWRlciBUZXN0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC
AQEAx5XhRmJPBzsL4HLlH5GvwFdG8Rz0AbMDN4Xy5V6C3JH3QKObPOQrFGK0mfFx
-----END CERTIFICATE-----`,
  privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHleFGYk8HOwvg
-----END PRIVATE KEY-----`,
  callbackUrl: 'http://localhost:3000/auth/saml/callback',
  issuer: 'playclone-test',
  audience: 'playclone-test-audience',
  attributeMapping: {
    id: 'uid',
    email: 'email',
    name: 'displayName',
    firstName: 'givenName',
    lastName: 'sn',
    groups: 'memberOf',
    roles: 'roles'
  }
};

/**
 * Mock OAuth/OIDC configuration for testing
 */
export const MOCK_OAUTH_CONFIG: OAuthConfig = {
  clientId: 'mock-oauth-client-id',
  clientSecret: 'mock-oauth-client-secret',
  authorizationUrl: 'https://mock-oauth-provider.example.com/authorize',
  tokenUrl: 'https://mock-oauth-provider.example.com/token',
  userInfoUrl: 'https://mock-oauth-provider.example.com/userinfo',
  callbackUrl: 'http://localhost:3000/auth/oauth/callback',
  scope: 'openid profile email',
  responseType: 'code',
  grantType: 'authorization_code',
  pkce: true,
  state: true,
  nonce: true
};

export const MOCK_OIDC_CONFIG: OIDCConfig = {
  ...MOCK_OAUTH_CONFIG,
  issuer: 'https://mock-oidc-provider.example.com',
  jwksUri: 'https://mock-oidc-provider.example.com/.well-known/jwks.json',
  discoveryUrl: 'https://mock-oidc-provider.example.com/.well-known/openid-configuration',
  idTokenSignedResponseAlg: 'RS256',
  userInfoSignedResponseAlg: 'RS256',
  tokenEndpointAuthMethod: 'client_secret_post'
};

/**
 * Predefined mock users for testing
 */
export const MOCK_USERS = {
  admin: {
    id: 'user-001',
    email: 'admin@example.com',
    name: 'Admin User',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['admin', 'user'],
    groups: ['administrators', 'users'],
    department: 'IT',
    title: 'System Administrator'
  },
  manager: {
    id: 'user-002',
    email: 'manager@example.com',
    name: 'Manager User',
    firstName: 'Manager',
    lastName: 'User',
    roles: ['manager', 'user'],
    groups: ['managers', 'users'],
    department: 'Operations',
    title: 'Operations Manager'
  },
  user: {
    id: 'user-003',
    email: 'user@example.com',
    name: 'Regular User',
    firstName: 'Regular',
    lastName: 'User',
    roles: ['user'],
    groups: ['users'],
    department: 'Sales',
    title: 'Sales Representative'
  },
  readonly: {
    id: 'user-004',
    email: 'readonly@example.com',
    name: 'ReadOnly User',
    firstName: 'ReadOnly',
    lastName: 'User',
    roles: ['readonly'],
    groups: ['viewers'],
    department: 'Support',
    title: 'Support Analyst'
  }
};

/**
 * Mock SAML Authentication Provider for testing
 * Simulates SAML authentication without requiring actual SAML infrastructure
 */
export class MockSAMLAuthProvider extends SAMLAuthProvider {
  private mockUsers = MOCK_USERS;
  private autoAuthenticate: boolean;
  private defaultUser: string;
  private simulateDelay: number;
  private simulateErrors: boolean;
  private errorRate: number;
  protected mockLogger: Logger;

  constructor(config?: Partial<SAMLConfig>, options?: {
    autoAuthenticate?: boolean;
    defaultUser?: string;
    simulateDelay?: number;
    simulateErrors?: boolean;
    errorRate?: number;
  }) {
    super({ ...MOCK_SAML_CONFIG, ...config });
    
    this.autoAuthenticate = options?.autoAuthenticate ?? true;
    this.defaultUser = options?.defaultUser ?? 'user';
    this.simulateDelay = options?.simulateDelay ?? 100;
    this.simulateErrors = options?.simulateErrors ?? false;
    this.errorRate = options?.errorRate ?? 0.1;
    
    this.mockLogger = Logger.getInstance();
    this.mockLogger.info('Mock SAML Auth Provider initialized', {
      autoAuthenticate: this.autoAuthenticate,
      defaultUser: this.defaultUser
    });
  }

  /**
   * Override generateAuthRequest to return mock data
   */
  public override generateAuthRequest(returnUrl?: string): { requestId: string; url: string; samlRequest: string } {
    const requestId = `_mock_${crypto.randomBytes(16).toString('hex')}`;
    
    // Simulate error if configured
    if (this.simulateErrors && Math.random() < this.errorRate) {
      throw new Error('Mock SAML: Simulated SSO service unavailable');
    }
    
    // For mock provider, redirect to a mock login page or auto-authenticate
    const callbackUrl = (this as any).config.callbackUrl;
    const mockLoginUrl = this.autoAuthenticate
      ? `${callbackUrl}?mockAuth=true&requestId=${requestId}&user=${this.defaultUser}`
      : `http://localhost:3000/mock-saml-login?requestId=${requestId}&returnUrl=${encodeURIComponent(returnUrl || '/')}`;
    
    const samlRequest = Buffer.from(`<mock-saml-request id="${requestId}" />`).toString('base64');
    
    this.emit('authRequestGenerated', { requestId, returnUrl });
    
    return {
      requestId,
      url: mockLoginUrl,
      samlRequest
    };
  }

  /**
   * Mock SAML response validation
   */
  public async validateSAMLResponse(samlResponse: string, requestId?: string): Promise<SAMLUser> {
    await this.simulateNetworkDelay();
    
    // Simulate validation errors
    if (this.simulateErrors && Math.random() < this.errorRate) {
      throw new Error('Mock SAML: Invalid SAML response signature');
    }
    
    // Decode mock response or use default user
    let userId = this.defaultUser;
    try {
      const decoded = Buffer.from(samlResponse, 'base64').toString();
      const match = decoded.match(/userId="([^"]+)"/);
      if (match) {
        userId = match[1];
      }
    } catch (e) {
      // Use default user if decoding fails
    }
    
    const mockUser = this.mockUsers[userId as keyof typeof MOCK_USERS] || this.mockUsers.user;
    
    const samlUser: SAMLUser = {
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      groups: mockUser.groups,
      roles: mockUser.roles,
      attributes: {
        department: mockUser.department,
        title: mockUser.title
      },
      sessionIndex: `mock-session-${Date.now()}`,
      nameId: mockUser.email
    };
    
    this.emit('userAuthenticated', samlUser);
    return samlUser;
  }

  /**
   * Mock single logout
   */
  public generateLogoutRequest(user: SAMLUser): { requestId: string; url: string } {
    const requestId = `_mock_logout_${crypto.randomBytes(16).toString('hex')}`;
    const sloUrl = (this as any).config.sloUrl || 'https://mock-saml-provider.example.com/slo';
    const logoutRequest = Buffer.from(`<mock-logout userId="${user.id}" requestId="${requestId}" />`).toString('base64');
    const url = `${sloUrl}?SAMLRequest=${encodeURIComponent(logoutRequest)}`;
    
    this.emit('logoutRequestGenerated', { userId: user.id, requestId });
    
    return { requestId, url };
  }

  /**
   * Add mock user for testing
   */
  public addMockUser(id: string, user: any): void {
    this.mockUsers[id as keyof typeof MOCK_USERS] = user;
  }

  /**
   * Simulate network delay
   */
  private async simulateNetworkDelay(): Promise<void> {
    if (this.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.simulateDelay));
    }
  }
}

/**
 * Mock SSO Provider for testing OAuth/OIDC flows
 */
export class MockSSOProvider extends SSOProvider {
  private mockUsers = MOCK_USERS;
  private autoAuthenticate: boolean;
  private defaultUser: string;
  private simulateDelay: number;
  private simulateErrors: boolean;
  private errorRate: number;
  private mockTokens: Map<string, { user: any; expiresAt: Date }> = new Map();

  constructor(config?: Partial<OAuthConfig | OIDCConfig>, options?: {
    autoAuthenticate?: boolean;
    defaultUser?: string;
    simulateDelay?: number;
    simulateErrors?: boolean;
    errorRate?: number;
  }) {
    const isOIDC = config?.hasOwnProperty('issuer');
    super({ ...(isOIDC ? MOCK_OIDC_CONFIG : MOCK_OAUTH_CONFIG), ...config });
    
    this.autoAuthenticate = options?.autoAuthenticate ?? true;
    this.defaultUser = options?.defaultUser ?? 'user';
    this.simulateDelay = options?.simulateDelay ?? 100;
    this.simulateErrors = options?.simulateErrors ?? false;
    this.errorRate = options?.errorRate ?? 0.1;
    
    this.logger.info('Mock SSO Provider initialized', {
      autoAuthenticate: this.autoAuthenticate,
      defaultUser: this.defaultUser,
      type: isOIDC ? 'OIDC' : 'OAuth'
    });
  }

  /**
   * Override generateAuthorizationUrl to return mock data
   */
  public override generateAuthorizationUrl(returnUrl?: string): AuthorizationRequest {
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Simulate error if configured
    if (this.simulateErrors && Math.random() < this.errorRate) {
      throw new Error('Mock SSO: Authorization service unavailable');
    }
    
    // For mock provider, redirect to a mock login page or auto-authenticate
    const mockAuthUrl = this.autoAuthenticate
      ? `${this.config.callbackUrl}?code=mock_auth_code_${state}&state=${state}&user=${this.defaultUser}`
      : `http://localhost:3000/mock-oauth-login?state=${state}&returnUrl=${encodeURIComponent(returnUrl || '/')}`;
    
    const request: AuthorizationRequest = {
      url: mockAuthUrl,
      state,
      nonce
    };
    
    // Add PKCE if enabled
    if (this.config.pkce) {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      
      request.codeVerifier = codeVerifier;
      request.codeChallenge = codeChallenge;
    }
    
    this.emit('authorizationUrlGenerated', { state, returnUrl });
    
    return request;
  }

  /**
   * Mock token exchange
   */
  public async exchangeCodeForToken(code: string, codeVerifier?: string): Promise<SSOUser> {
    await this.simulateNetworkDelay();
    
    // Simulate validation errors
    if (this.simulateErrors && Math.random() < this.errorRate) {
      throw new Error('Mock SSO: Invalid authorization code');
    }
    
    // Extract user from code or use default
    let userId = this.defaultUser;
    const match = code.match(/mock_auth_code_.*_user_([^_]+)/);
    if (match) {
      userId = match[1];
    }
    
    const mockUser = this.mockUsers[userId as keyof typeof MOCK_USERS] || this.mockUsers.user;
    
    // Generate mock tokens
    const accessToken = `mock_access_token_${crypto.randomBytes(16).toString('hex')}`;
    const refreshToken = `mock_refresh_token_${crypto.randomBytes(16).toString('hex')}`;
    const idToken = this.generateMockUserIdToken(mockUser);
    
    const ssoUser: SSOUser = {
      id: mockUser.id,
      email: mockUser.email,
      emailVerified: true,
      name: mockUser.name,
      picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(mockUser.name)}`,
      locale: 'en-US',
      provider: 'mock-sso',
      accessToken,
      refreshToken,
      idToken,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
      claims: {
        sub: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        given_name: mockUser.firstName,
        family_name: mockUser.lastName,
        roles: mockUser.roles,
        groups: mockUser.groups
      },
      roles: mockUser.roles,
      groups: mockUser.groups
    };
    
    // Store token for validation
    this.mockTokens.set(accessToken, {
      user: ssoUser,
      expiresAt: ssoUser.expiresAt!
    });
    
    this.emit('tokenExchanged', { userId: ssoUser.id, provider: ssoUser.provider });
    
    return ssoUser;
  }

  /**
   * Mock user info endpoint
   */
  public async getMockUserInfo(accessToken: string): Promise<SSOUser> {
    await this.simulateNetworkDelay();
    
    // Simulate errors
    if (this.simulateErrors && Math.random() < this.errorRate) {
      throw new Error('Mock SSO: User info endpoint error');
    }
    
    // Validate token
    const tokenData = this.mockTokens.get(accessToken);
    if (!tokenData) {
      throw new Error('Mock SSO: Invalid access token');
    }
    
    if (tokenData.expiresAt < new Date()) {
      this.mockTokens.delete(accessToken);
      throw new Error('Mock SSO: Access token expired');
    }
    
    return tokenData.user;
  }

  /**
   * Mock token refresh
   */
  public async refreshMockAccessToken(refreshToken: string): Promise<SSOUser> {
    await this.simulateNetworkDelay();
    
    // Simulate errors
    if (this.simulateErrors && Math.random() < this.errorRate) {
      throw new Error('Mock SSO: Token refresh failed');
    }
    
    // Find user by refresh token
    let user: SSOUser | undefined;
    for (const [_, tokenData] of this.mockTokens) {
      if (tokenData.user.refreshToken === refreshToken) {
        user = tokenData.user;
        break;
      }
    }
    
    if (!user) {
      throw new Error('Mock SSO: Invalid refresh token');
    }
    
    // Generate new tokens
    const newAccessToken = `mock_access_token_${crypto.randomBytes(16).toString('hex')}`;
    user.accessToken = newAccessToken;
    user.expiresAt = new Date(Date.now() + 3600000); // 1 hour
    
    // Update token store
    this.mockTokens.set(newAccessToken, {
      user,
      expiresAt: user.expiresAt
    });
    
    this.emit('tokenRefreshed', { userId: user.id });
    
    return user;
  }

  /**
   * Mock logout
   */
  public async logout(user: SSOUser): Promise<void> {
    await this.simulateNetworkDelay();
    
    // Remove user's tokens
    if (user.accessToken) {
      this.mockTokens.delete(user.accessToken);
    }
    
    this.emit('userLoggedOut', { userId: user.id });
  }

  /**
   * Generate mock ID token for a specific user
   */
  private generateMockUserIdToken(user: any): string {
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: 'mock-key-id'
    };
    
    const payload = {
      iss: (this.config as OIDCConfig).issuer || 'https://mock-oidc-provider.example.com',
      sub: user.id,
      aud: this.config.clientId,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      nonce: crypto.randomBytes(16).toString('hex'),
      email: user.email,
      email_verified: true,
      name: user.name,
      given_name: user.firstName,
      family_name: user.lastName,
      roles: user.roles,
      groups: user.groups
    };
    
    // Create mock JWT (not cryptographically signed for testing)
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const mockSignature = crypto.randomBytes(32).toString('base64url');
    
    return `${encodedHeader}.${encodedPayload}.${mockSignature}`;
  }

  /**
   * Add mock user for testing
   */
  public addMockUser(id: string, user: any): void {
    this.mockUsers[id as keyof typeof MOCK_USERS] = user;
  }

  /**
   * Set authentication behavior
   */
  public setAutoAuthenticate(auto: boolean, defaultUser?: string): void {
    this.autoAuthenticate = auto;
    if (defaultUser) {
      this.defaultUser = defaultUser;
    }
  }

  /**
   * Configure error simulation
   */
  public configureErrorSimulation(enabled: boolean, rate?: number): void {
    this.simulateErrors = enabled;
    if (rate !== undefined) {
      this.errorRate = Math.max(0, Math.min(1, rate));
    }
  }

  /**
   * Simulate network delay
   */
  private async simulateNetworkDelay(): Promise<void> {
    if (this.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.simulateDelay));
    }
  }
}

/**
 * Mock authentication test helper
 */
export class MockAuthTestHelper {
  private samlProvider: MockSAMLAuthProvider;
  private ssoProvider: MockSSOProvider;
  private logger: Logger;

  constructor() {
    this.samlProvider = new MockSAMLAuthProvider();
    this.ssoProvider = new MockSSOProvider();
    this.logger = Logger.getInstance();
  }

  /**
   * Simulate full SAML authentication flow
   */
  public async simulateSAMLFlow(userId: string = 'user'): Promise<SAMLUser> {
    this.logger.info('Starting mock SAML flow', { userId });
    
    // Generate auth request
    const { requestId, url, samlRequest } = this.samlProvider.generateAuthRequest('/dashboard');
    this.logger.info('Auth request generated', { requestId, url });
    
    // Simulate user login (would normally happen in browser)
    const mockResponse = Buffer.from(`<saml-response userId="${userId}" />`).toString('base64');
    
    // Validate response
    const user = await this.samlProvider.validateSAMLResponse(mockResponse, requestId);
    this.logger.info('User authenticated via SAML', { user });
    
    return user;
  }

  /**
   * Simulate full OAuth/OIDC flow
   */
  public async simulateOAuthFlow(userId: string = 'user'): Promise<SSOUser> {
    this.logger.info('Starting mock OAuth flow', { userId });
    
    // Generate authorization URL
    const { url, state } = this.ssoProvider.generateAuthorizationUrl('/dashboard');
    this.logger.info('Authorization URL generated', { url, state });
    
    // Simulate authorization (would normally happen in browser)
    const mockCode = `mock_auth_code_${state}_user_${userId}`;
    
    // Exchange code for token
    const user = await this.ssoProvider.exchangeCodeForToken(mockCode);
    this.logger.info('User authenticated via OAuth', { user });
    
    return user;
  }

  /**
   * Test permission checking
   */
  public async testPermissions(user: SAMLUser | SSOUser, requiredRoles: string[]): Promise<boolean> {
    const userRoles = user.roles || [];
    const hasPermission = requiredRoles.some(role => userRoles.includes(role));
    
    this.logger.info('Permission check', {
      userId: user.id,
      userRoles,
      requiredRoles,
      hasPermission
    });
    
    return hasPermission;
  }

  /**
   * Test MFA flow (simulated)
   */
  public async simulateMFAChallenge(user: SAMLUser | SSOUser, method: 'totp' | 'sms' | 'email' = 'totp'): Promise<boolean> {
    this.logger.info('Starting MFA challenge', { userId: user.id, method });
    
    // Simulate MFA code generation
    const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
    this.logger.info('MFA code generated', { method, code: mockCode });
    
    // Simulate user entering code (with slight delay)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate verification (always succeeds in mock)
    this.logger.info('MFA verification successful', { userId: user.id });
    
    return true;
  }

  /**
   * Get configured providers
   */
  public getProviders(): { saml: MockSAMLAuthProvider; sso: MockSSOProvider } {
    return {
      saml: this.samlProvider,
      sso: this.ssoProvider
    };
  }

  /**
   * Reset all mock data
   */
  public reset(): void {
    this.samlProvider = new MockSAMLAuthProvider();
    this.ssoProvider = new MockSSOProvider();
    this.logger.info('Mock auth providers reset');
  }
}

export default MockAuthTestHelper;