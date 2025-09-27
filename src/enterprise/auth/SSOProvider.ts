import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { Logger } from '../../utils/Logger';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  callbackUrl: string;
  scope?: string;
  responseType?: 'code' | 'token';
  grantType?: string;
  pkce?: boolean;
  state?: boolean;
  nonce?: boolean;
}

export interface OIDCConfig extends OAuthConfig {
  issuer: string;
  jwksUri?: string;
  discoveryUrl?: string;
  idTokenSignedResponseAlg?: string;
  userInfoSignedResponseAlg?: string;
  requestObjectSigningAlg?: string;
  tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post' | 'client_secret_jwt' | 'private_key_jwt';
}

export interface SSOUser {
  id: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  locale?: string;
  provider: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: Date;
  claims?: Record<string, any>;
  roles?: string[];
  groups?: string[];
}

export interface AuthorizationRequest {
  url: string;
  state?: string;
  nonce?: string;
  codeVerifier?: string;
  codeChallenge?: string;
}

export class SSOProvider extends EventEmitter {
  protected config: OAuthConfig | OIDCConfig;
  protected logger: Logger;
  private stateCache: Map<string, { timestamp: number; returnUrl?: string; codeVerifier?: string; nonce?: string }> = new Map();
  private tokenCache: Map<string, SSOUser> = new Map();

  constructor(config: OAuthConfig | OIDCConfig) {
    super();
    this.config = {
      responseType: 'code',
      grantType: 'authorization_code',
      scope: 'openid profile email',
      state: true,
      nonce: true,
      pkce: false,
      ...config
    };
    this.logger = Logger.getInstance();
    this.logger.info('SSO Provider initialized', { clientId: config.clientId });

    // Auto-discover OIDC configuration if discoveryUrl is provided
    if (this.isOIDC() && (config as OIDCConfig).discoveryUrl) {
      this.discoverConfiguration();
    }

    // Clean up expired states periodically
    setInterval(() => this.cleanupExpiredStates(), 60000);
  }

  /**
   * Generate authorization URL
   */
  public generateAuthorizationUrl(returnUrl?: string): AuthorizationRequest {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      response_type: this.config.responseType || 'code',
      scope: this.config.scope || 'openid profile email'
    });

    const request: AuthorizationRequest = {
      url: ''
    };

    // Add state for CSRF protection
    if (this.config.state) {
      request.state = this.generateRandomString(32);
      params.append('state', request.state);
    }

    // Add nonce for OIDC
    if (this.isOIDC() && this.config.nonce) {
      request.nonce = this.generateRandomString(32);
      params.append('nonce', request.nonce);
    }

    // Add PKCE challenge
    if (this.config.pkce) {
      request.codeVerifier = this.generateRandomString(128);
      request.codeChallenge = this.generateCodeChallenge(request.codeVerifier);
      params.append('code_challenge', request.codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    // Store state for validation
    if (request.state) {
      this.stateCache.set(request.state, {
        timestamp: Date.now(),
        returnUrl,
        codeVerifier: request.codeVerifier,
        nonce: request.nonce
      });
    }

    request.url = `${this.config.authorizationUrl}?${params.toString()}`;

    this.emit('authorizationUrlGenerated', request);
    this.logger.debug('Authorization URL generated', { state: request.state });

    return request;
  }

  /**
   * Handle OAuth callback
   */
  public async handleCallback(code: string, state?: string): Promise<SSOUser> {
    try {
      // Validate state
      if (this.config.state && state) {
        const stateData = this.stateCache.get(state);
        if (!stateData) {
          throw new Error('Invalid state parameter');
        }
        this.stateCache.delete(state);
        
        // Check state expiration (5 minutes)
        if (Date.now() - stateData.timestamp > 300000) {
          throw new Error('State parameter expired');
        }
      }

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code, state);
      
      // Get user info
      const user = await this.getUserInfo(tokens);
      
      // Store user session
      this.tokenCache.set(user.id, user);
      
      this.emit('userAuthenticated', user);
      this.logger.info('User authenticated via SSO', { userId: user.id, provider: user.provider });

      return user;
    } catch (error) {
      this.logger.error('SSO callback handling failed', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(code: string, state?: string): Promise<any> {
    const params = new URLSearchParams({
      grant_type: this.config.grantType || 'authorization_code',
      code,
      redirect_uri: this.config.callbackUrl,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    // Add PKCE verifier if used
    if (this.config.pkce && state) {
      const stateData = this.stateCache.get(state);
      if (stateData?.codeVerifier) {
        params.append('code_verifier', stateData.codeVerifier);
      }
    }

    // Make token request (simplified - in production use fetch or axios)
    const response = await this.makeTokenRequest(params);
    
    return response;
  }

  /**
   * Get user information
   */
  private async getUserInfo(tokens: any): Promise<SSOUser> {
    let userInfo: any = {};
    
    // If OIDC, decode ID token
    if (this.isOIDC() && tokens.id_token) {
      userInfo = this.decodeIdToken(tokens.id_token);
    }
    
    // Fetch additional user info if endpoint available
    if (this.config.userInfoUrl && tokens.access_token) {
      const additionalInfo = await this.fetchUserInfo(tokens.access_token);
      userInfo = { ...userInfo, ...additionalInfo };
    }

    return {
      id: userInfo.sub || userInfo.id || userInfo.user_id,
      email: userInfo.email,
      emailVerified: userInfo.email_verified,
      name: userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim(),
      picture: userInfo.picture || userInfo.avatar_url,
      locale: userInfo.locale,
      provider: this.getProviderName(),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
      claims: userInfo
    };
  }

  /**
   * Refresh access token
   */
  public async refreshToken(userId: string): Promise<SSOUser> {
    const user = this.tokenCache.get(userId);
    if (!user || !user.refreshToken) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: user.refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    const tokens = await this.makeTokenRequest(params);
    
    // Update user tokens
    user.accessToken = tokens.access_token;
    if (tokens.refresh_token) {
      user.refreshToken = tokens.refresh_token;
    }
    if (tokens.expires_in) {
      user.expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    }
    
    this.tokenCache.set(userId, user);
    this.emit('tokenRefreshed', { userId });
    
    return user;
  }

  /**
   * Revoke tokens
   */
  public async revokeTokens(userId: string): Promise<void> {
    const user = this.tokenCache.get(userId);
    if (!user) return;

    // Revoke tokens if revocation endpoint is available
    // This would make an API call to the revocation endpoint
    // For now, just remove from cache
    this.tokenCache.delete(userId);
    
    this.emit('tokensRevoked', { userId });
    this.logger.info('User tokens revoked', { userId });
  }

  /**
   * Get authenticated user
   */
  public getUser(userId: string): SSOUser | undefined {
    return this.tokenCache.get(userId);
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(userId: string): boolean {
    const user = this.tokenCache.get(userId);
    if (!user) return false;
    
    // Check token expiration
    if (user.expiresAt && new Date() >= user.expiresAt) {
      return false;
    }
    
    return true;
  }

  /**
   * Generate logout URL
   */
  public generateLogoutUrl(userId: string, returnUrl?: string): string {
    const user = this.tokenCache.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const params = new URLSearchParams();
    
    // OIDC logout
    if (this.isOIDC() && user.idToken) {
      params.append('id_token_hint', user.idToken);
    }
    
    if (returnUrl) {
      params.append('post_logout_redirect_uri', returnUrl);
    }

    // Remove user from cache
    this.tokenCache.delete(userId);
    
    // Build logout URL (varies by provider)
    const logoutUrl = this.getLogoutEndpoint();
    if (!logoutUrl) {
      return returnUrl || '/';
    }

    return `${logoutUrl}?${params.toString()}`;
  }

  /**
   * Helper methods
   */
  private isOIDC(): boolean {
    return 'issuer' in this.config;
  }

  private generateRandomString(length: number): string {
    return crypto.randomBytes(length).toString('base64url').slice(0, length);
  }

  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  private decodeIdToken(idToken: string): any {
    // Decode JWT payload (simplified - in production verify signature)
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid ID token format');
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    
    // Validate nonce if present
    const state = Array.from(this.stateCache.values()).find(s => s.nonce === payload.nonce);
    if (this.config.nonce && !state) {
      throw new Error('Invalid nonce in ID token');
    }
    
    return payload;
  }

  private async makeTokenRequest(params: URLSearchParams): Promise<any> {
    // Simplified - in production use fetch or axios
    // This is a placeholder that returns mock data
    this.logger.debug('Making token request', { url: this.config.tokenUrl });
    
    return {
      access_token: `access_${this.generateRandomString(32)}`,
      refresh_token: `refresh_${this.generateRandomString(32)}`,
      id_token: this.isOIDC() ? this.generateMockIdToken() : undefined,
      token_type: 'Bearer',
      expires_in: 3600
    };
  }

  private async fetchUserInfo(accessToken: string): Promise<any> {
    // Simplified - in production make actual API call
    this.logger.debug('Fetching user info', { url: this.config.userInfoUrl });
    
    return {
      sub: `user_${this.generateRandomString(16)}`,
      email: 'user@example.com',
      email_verified: true,
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
      locale: 'en-US'
    };
  }

  private generateMockIdToken(): string {
    // Generate a mock ID token for testing
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: (this.config as OIDCConfig).issuer,
      sub: `user_${this.generateRandomString(16)}`,
      aud: this.config.clientId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: 'user@example.com',
      email_verified: true,
      name: 'Test User'
    };
    
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.generateRandomString(86);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private getProviderName(): string {
    // Detect provider from URLs
    const url = this.config.authorizationUrl.toLowerCase();
    if (url.includes('google')) return 'Google';
    if (url.includes('microsoft') || url.includes('login.microsoftonline')) return 'Microsoft';
    if (url.includes('okta')) return 'Okta';
    if (url.includes('auth0')) return 'Auth0';
    if (url.includes('github')) return 'GitHub';
    if (url.includes('gitlab')) return 'GitLab';
    return 'OAuth2';
  }

  private getLogoutEndpoint(): string | undefined {
    // Provider-specific logout endpoints
    const provider = this.getProviderName();
    switch (provider) {
      case 'Google':
        return 'https://accounts.google.com/logout';
      case 'Microsoft':
        return 'https://login.microsoftonline.com/common/oauth2/v2.0/logout';
      case 'Okta':
        return this.config.authorizationUrl.replace('/authorize', '/logout');
      case 'Auth0':
        return this.config.authorizationUrl.replace('/authorize', '/v2/logout');
      default:
        return undefined;
    }
  }

  private async discoverConfiguration(): Promise<void> {
    // OIDC discovery (simplified - in production fetch from discovery URL)
    const config = this.config as OIDCConfig;
    if (!config.discoveryUrl) return;
    
    this.logger.info('Discovering OIDC configuration', { url: config.discoveryUrl });
    // Would fetch and parse .well-known/openid-configuration
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    const expired: string[] = [];
    
    for (const [state, data] of this.stateCache.entries()) {
      if (now - data.timestamp > 300000) { // 5 minutes
        expired.push(state);
      }
    }
    
    for (const state of expired) {
      this.stateCache.delete(state);
    }
    
    if (expired.length > 0) {
      this.logger.debug(`Cleaned up ${expired.length} expired states`);
    }
  }
}