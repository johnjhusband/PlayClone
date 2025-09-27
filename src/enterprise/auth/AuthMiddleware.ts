import { EventEmitter } from 'events';
import { PlayClone } from '../../index';
import { Logger } from '../../utils/Logger';
import { SAMLAuthProvider, SAMLUser } from './SAMLAuthProvider';
import { SSOProvider, SSOUser } from './SSOProvider';

export type AuthProvider = 'saml' | 'oauth' | 'oidc' | 'local';
export type AuthUser = SAMLUser | SSOUser | LocalUser;

export interface LocalUser {
  id: string;
  username: string;
  email?: string;
  name?: string;
  roles?: string[];
  groups?: string[];
}

export interface AuthConfig {
  provider: AuthProvider;
  required?: boolean;
  sessionTimeout?: number;
  allowAnonymous?: boolean;
  roleBasedAccess?: {
    enabled: boolean;
    defaultRole?: string;
    adminRoles?: string[];
  };
  multiFactorAuth?: {
    enabled: boolean;
    methods?: ('totp' | 'sms' | 'email')[];
  };
}

export interface AuthSession {
  id: string;
  userId: string;
  user: AuthUser;
  provider: AuthProvider;
  createdAt: Date;
  lastActivity: Date;
  expiresAt?: Date;
  mfaVerified?: boolean;
  permissions?: string[];
  roles?: string[];
}

export class AuthMiddleware extends EventEmitter {
  private config: AuthConfig;
  private logger: Logger;
  private sessions: Map<string, AuthSession> = new Map();
  private authProviders: Map<AuthProvider, SAMLAuthProvider | SSOProvider> = new Map();
  private playcloneSessions: Map<string, PlayClone> = new Map();

  constructor(config: AuthConfig) {
    super();
    this.config = {
      required: true,
      sessionTimeout: 3600000, // 1 hour default
      allowAnonymous: false,
      ...config
    };
    this.logger = Logger.getInstance();
    this.logger.info('Auth middleware initialized', { provider: config.provider });

    // Clean up expired sessions periodically
    setInterval(() => this.cleanupExpiredSessions(), 60000);
  }

  /**
   * Register authentication provider
   */
  public registerProvider(type: AuthProvider, provider: SAMLAuthProvider | SSOProvider): void {
    this.authProviders.set(type, provider);
    this.logger.info('Auth provider registered', { type });
  }

  /**
   * Authenticate user and create session
   */
  public async authenticate(credentials: any, provider?: AuthProvider): Promise<AuthSession> {
    const authProvider = provider || this.config.provider;
    const providerInstance = this.authProviders.get(authProvider);

    if (!providerInstance && authProvider !== 'local') {
      throw new Error(`Auth provider ${authProvider} not registered`);
    }

    let user: AuthUser;

    switch (authProvider) {
      case 'saml':
        user = await (providerInstance as SAMLAuthProvider).validateResponse(credentials.samlResponse);
        break;
      case 'oauth':
      case 'oidc':
        user = await (providerInstance as SSOProvider).handleCallback(credentials.code, credentials.state);
        break;
      case 'local':
        user = await this.authenticateLocal(credentials);
        break;
      default:
        throw new Error(`Unsupported auth provider: ${authProvider}`);
    }

    // Create session
    const session = this.createSession(user, authProvider);
    
    // Check MFA if enabled
    if (this.config.multiFactorAuth?.enabled && !session.mfaVerified) {
      this.emit('mfaRequired', { sessionId: session.id, userId: user.id });
    }

    this.emit('userAuthenticated', { session, user });
    this.logger.info('User authenticated', { userId: user.id, sessionId: session.id });

    return session;
  }

  /**
   * Verify MFA code
   */
  public async verifyMFA(sessionId: string, code: string, method: 'totp' | 'sms' | 'email'): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Simplified MFA verification - in production use proper TOTP/SMS/Email verification
    const verified = this.verifyMFACode(session.userId, code, method);
    
    if (verified) {
      session.mfaVerified = true;
      this.emit('mfaVerified', { sessionId, userId: session.userId });
      this.logger.info('MFA verified', { sessionId, userId: session.userId });
    }

    return verified;
  }

  /**
   * Authorize request with session
   */
  public async authorize(sessionId: string, resource?: string, action?: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    
    // Check if auth is required
    if (!this.config.required && !session) {
      return this.config.allowAnonymous || false;
    }

    if (!session) {
      throw new Error('Unauthorized: No valid session');
    }

    // Check session expiration
    if (session.expiresAt && new Date() >= session.expiresAt) {
      this.sessions.delete(sessionId);
      throw new Error('Session expired');
    }

    // Update last activity
    session.lastActivity = new Date();

    // Check MFA if required
    if (this.config.multiFactorAuth?.enabled && !session.mfaVerified) {
      throw new Error('MFA verification required');
    }

    // Check role-based access if enabled
    if (this.config.roleBasedAccess?.enabled && resource && action) {
      const authorized = this.checkRoleBasedAccess(session, resource, action);
      if (!authorized) {
        throw new Error(`Unauthorized: Insufficient permissions for ${action} on ${resource}`);
      }
    }

    return true;
  }

  /**
   * Create PlayClone session with authentication
   */
  public async createAuthenticatedPlayCloneSession(
    sessionId: string,
    options?: any
  ): Promise<PlayClone> {
    // Authorize the session
    await this.authorize(sessionId);
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Create or retrieve PlayClone instance
    let pc = this.playcloneSessions.get(sessionId);
    if (!pc) {
      pc = new PlayClone({
        ...options,
        metadata: {
          userId: session.userId,
          sessionId: session.id,
          provider: session.provider
        }
      });
      this.playcloneSessions.set(sessionId, pc);
    }

    this.emit('playcloneSessionCreated', { sessionId, userId: session.userId });
    return pc;
  }

  /**
   * Logout user and cleanup sessions
   */
  public async logout(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Close PlayClone session if exists
    const pc = this.playcloneSessions.get(sessionId);
    if (pc) {
      await pc.close();
      this.playcloneSessions.delete(sessionId);
    }

    // Revoke provider tokens if applicable
    const provider = this.authProviders.get(session.provider);
    if (provider) {
      if (session.provider === 'saml') {
        (provider as SAMLAuthProvider).revokeSession(session.userId);
      } else if (session.provider === 'oauth' || session.provider === 'oidc') {
        await (provider as SSOProvider).revokeTokens(session.userId);
      }
    }

    // Remove session
    this.sessions.delete(sessionId);
    
    this.emit('userLoggedOut', { sessionId, userId: session.userId });
    this.logger.info('User logged out', { sessionId, userId: session.userId });
  }

  /**
   * Get session information
   */
  public getSession(sessionId: string): AuthSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions for a user
   */
  public getUserSessions(userId: string): AuthSession[] {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }

  /**
   * Refresh session expiration
   */
  public refreshSession(sessionId: string): AuthSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.lastActivity = new Date();
    if (this.config.sessionTimeout) {
      session.expiresAt = new Date(Date.now() + this.config.sessionTimeout);
    }

    this.emit('sessionRefreshed', { sessionId });
    return session;
  }

  /**
   * Private helper methods
   */
  private createSession(user: AuthUser, provider: AuthProvider): AuthSession {
    const sessionId = this.generateSessionId();
    const now = new Date();
    
    const session: AuthSession = {
      id: sessionId,
      userId: user.id,
      user,
      provider,
      createdAt: now,
      lastActivity: now,
      expiresAt: this.config.sessionTimeout 
        ? new Date(now.getTime() + this.config.sessionTimeout)
        : undefined,
      mfaVerified: false,
      permissions: this.extractPermissions(user)
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  private async authenticateLocal(credentials: { username: string; password: string }): Promise<LocalUser> {
    // Simplified local authentication - in production use proper password hashing
    // This is just a placeholder for demonstration
    if (credentials.username === 'admin' && credentials.password === 'admin') {
      return {
        id: 'local_admin',
        username: 'admin',
        email: 'admin@example.com',
        name: 'Administrator',
        roles: ['admin'],
        groups: ['administrators']
      };
    }
    throw new Error('Invalid credentials');
  }

  private verifyMFACode(userId: string, code: string, method: string): boolean {
    // Simplified MFA verification - in production use proper TOTP library
    // This is just a placeholder
    return code === '123456';
  }

  private checkRoleBasedAccess(session: AuthSession, resource: string, action: string): boolean {
    // Check if user has admin role
    const adminRoles = this.config.roleBasedAccess?.adminRoles || ['admin'];
    const userRoles = (session.user as any).roles || [];
    const userGroups = (session.user as any).groups || [];
    
    // Admins have full access
    if (userRoles.some((role: string) => adminRoles.includes(role))) {
      return true;
    }

    // Check specific permissions
    const requiredPermission = `${resource}:${action}`;
    if (session.permissions?.includes(requiredPermission)) {
      return true;
    }

    // Check group-based permissions
    // This would be expanded with actual permission mapping
    return false;
  }

  private extractPermissions(user: AuthUser): string[] {
    const permissions: string[] = [];
    
    // Extract permissions based on roles
    const roles = (user as any).roles || [];
    if (roles.includes('admin')) {
      permissions.push('*:*'); // Full access
    } else if (roles.includes('user')) {
      permissions.push('browser:navigate', 'browser:click', 'browser:fill', 'data:extract');
    } else if (roles.includes('viewer')) {
      permissions.push('browser:navigate', 'data:extract');
    }

    // Add group-based permissions
    const groups = (user as any).groups || [];
    if (groups.includes('developers')) {
      permissions.push('browser:*', 'data:*', 'state:*');
    }

    return permissions;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expired: string[] = [];
    
    for (const [id, session] of this.sessions.entries()) {
      // Check expiration
      if (session.expiresAt && now >= session.expiresAt) {
        expired.push(id);
        continue;
      }
      
      // Check inactivity timeout
      if (this.config.sessionTimeout) {
        const inactiveTime = now.getTime() - session.lastActivity.getTime();
        if (inactiveTime > this.config.sessionTimeout) {
          expired.push(id);
        }
      }
    }
    
    // Clean up expired sessions
    for (const id of expired) {
      const session = this.sessions.get(id);
      if (session) {
        this.logout(id).catch(err => {
          this.logger.error('Error during session cleanup', err);
        });
      }
    }
    
    if (expired.length > 0) {
      this.logger.debug(`Cleaned up ${expired.length} expired sessions`);
    }
  }
}