import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PlayClone } from '../../index';
import { Logger } from '../../utils/Logger';
import { AuthMiddleware, AuthSession, AuthUser } from './AuthMiddleware';

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  priority?: number;
  inherits?: string[];
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

export interface RBACConfig {
  roles: Role[];
  defaultRole?: string;
  superAdminRoles?: string[];
  resourceHierarchy?: Record<string, string[]>;
  customPermissionEvaluator?: (user: AuthUser, resource: string, action: string) => boolean;
}

export interface SessionLimit {
  maxConcurrentSessions?: number;
  maxSessionsPerUser?: number;
  maxIdleTime?: number;
  maxSessionDuration?: number;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  sessionId: string;
  action: string;
  resource?: string;
  details?: Record<string, any>;
  result: 'success' | 'failure' | 'denied';
  ipAddress?: string;
  userAgent?: string;
}

export interface EnterpriseConfig {
  rbac: RBACConfig;
  sessionLimits?: SessionLimit;
  auditLogging?: {
    enabled: boolean;
    logPath?: string;
    retention?: number;
  };
  compliance?: {
    gdpr?: boolean;
    hipaa?: boolean;
    sox?: boolean;
    pci?: boolean;
  };
}

export class EnterpriseSessionManager extends EventEmitter {
  private config: EnterpriseConfig;
  private logger: Logger;
  private authMiddleware: AuthMiddleware;
  private sessions: Map<string, AuthSession> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private auditLogs: AuditLog[] = [];
  private roleCache: Map<string, Role> = new Map();
  private playclonePool: Map<string, PlayClone> = new Map();

  constructor(config: EnterpriseConfig, authMiddleware: AuthMiddleware) {
    super();
    this.config = config;
    this.authMiddleware = authMiddleware;
    this.logger = Logger.getInstance();
    
    // Initialize role cache
    this.initializeRoles();
    
    // Start audit log rotation if enabled
    if (config.auditLogging?.enabled) {
      this.startAuditLogRotation();
    }

    // Monitor session limits
    setInterval(() => this.enforceSessionLimits(), 30000); // Every 30 seconds
    
    this.logger.info('Enterprise session manager initialized');
  }

  /**
   * Create enterprise session with RBAC
   */
  public async createSession(authSession: AuthSession): Promise<string> {
    // Check session limits
    await this.checkSessionLimits(authSession.userId);
    
    // Assign roles to user
    const userRoles = this.assignUserRoles(authSession.user);
    
    // Calculate effective permissions
    const permissions = this.calculateEffectivePermissions(userRoles);
    
    // Enhance auth session with enterprise features
    const enhancedSession = {
      ...authSession,
      roles: userRoles.map(r => r.name),
      permissions: this.permissionsToStrings(permissions),
      metadata: {
        createdAt: new Date(),
        lastActivity: new Date(),
        ipAddress: this.getClientIP(),
        userAgent: this.getUserAgent()
      }
    };

    // Store session
    this.sessions.set(authSession.id, enhancedSession);
    
    // Track user sessions
    if (!this.userSessions.has(authSession.userId)) {
      this.userSessions.set(authSession.userId, new Set());
    }
    this.userSessions.get(authSession.userId)!.add(authSession.id);

    // Audit log
    await this.auditLog({
      userId: authSession.userId,
      sessionId: authSession.id,
      action: 'session.create',
      result: 'success',
      details: { roles: userRoles.map(r => r.name) }
    });

    this.emit('sessionCreated', enhancedSession);
    this.logger.info('Enterprise session created', { 
      sessionId: authSession.id, 
      userId: authSession.userId,
      roles: userRoles.map(r => r.name)
    });

    return authSession.id;
  }

  /**
   * Authorize action with RBAC
   */
  public async authorize(
    sessionId: string, 
    resource: string, 
    action: string,
    context?: Record<string, any>
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      await this.auditLog({
        userId: 'unknown',
        sessionId,
        action: `${resource}.${action}`,
        result: 'denied',
        details: { reason: 'Session not found' }
      });
      return false;
    }

    // Update last activity
    session.lastActivity = new Date();

    // Check if user has permission
    const hasPermission = this.checkPermission(session, resource, action, context);
    
    // Audit log
    await this.auditLog({
      userId: session.userId,
      sessionId,
      action: `${resource}.${action}`,
      resource,
      result: hasPermission ? 'success' : 'denied',
      details: context
    });

    if (!hasPermission) {
      this.emit('authorizationDenied', { sessionId, resource, action });
      this.logger.warn('Authorization denied', { sessionId, resource, action });
    }

    return hasPermission;
  }

  /**
   * Get authorized PlayClone instance
   */
  public async getAuthorizedPlayClone(
    sessionId: string,
    options?: any
  ): Promise<PlayClone> {
    // Authorize browser access
    const authorized = await this.authorize(sessionId, 'browser', 'create');
    if (!authorized) {
      throw new Error('Unauthorized: Cannot create browser session');
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check if PlayClone instance exists
    let pc = this.playclonePool.get(sessionId);
    if (!pc) {
      // Create new instance with restricted capabilities based on roles
      const restrictions = this.getRestrictions(session);
      pc = new PlayClone({
        ...options,
        ...restrictions,
        metadata: {
          sessionId,
          userId: session.userId,
          roles: session.roles
        }
      });
      
      // Wrap methods with authorization checks
      pc = this.wrapWithAuthorization(pc, sessionId);
      
      this.playclonePool.set(sessionId, pc);
    }

    return pc;
  }

  /**
   * Terminate session
   */
  public async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Close PlayClone instance
    const pc = this.playclonePool.get(sessionId);
    if (pc) {
      await pc.close();
      this.playclonePool.delete(sessionId);
    }

    // Remove from user sessions
    const userSessionSet = this.userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
      if (userSessionSet.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    // Remove session
    this.sessions.delete(sessionId);

    // Audit log
    await this.auditLog({
      userId: session.userId,
      sessionId,
      action: 'session.terminate',
      result: 'success'
    });

    this.emit('sessionTerminated', { sessionId, userId: session.userId });
    this.logger.info('Session terminated', { sessionId, userId: session.userId });
  }

  /**
   * Get session information
   */
  public getSession(sessionId: string): AuthSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a user
   */
  public getUserSessions(userId: string): AuthSession[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return [];
    
    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter(s => s !== undefined) as AuthSession[];
  }

  /**
   * Update user roles
   */
  public async updateUserRoles(userId: string, roleNames: string[]): Promise<void> {
    const sessions = this.getUserSessions(userId);
    const newRoles = roleNames.map(name => this.roleCache.get(name)).filter(r => r !== undefined) as Role[];
    const newPermissions = this.calculateEffectivePermissions(newRoles);
    
    for (const session of sessions) {
      session.roles = roleNames;
      session.permissions = this.permissionsToStrings(newPermissions);
    }

    await this.auditLog({
      userId,
      sessionId: 'system',
      action: 'roles.update',
      result: 'success',
      details: { roles: roleNames }
    });

    this.emit('rolesUpdated', { userId, roles: roleNames });
    this.logger.info('User roles updated', { userId, roles: roleNames });
  }

  /**
   * Get audit logs
   */
  public async getAuditLogs(filters?: {
    userId?: string;
    sessionId?: string;
    startDate?: Date;
    endDate?: Date;
    action?: string;
    result?: 'success' | 'failure' | 'denied';
  }): Promise<AuditLog[]> {
    let logs = [...this.auditLogs];
    
    if (filters) {
      if (filters.userId) logs = logs.filter(l => l.userId === filters.userId);
      if (filters.sessionId) logs = logs.filter(l => l.sessionId === filters.sessionId);
      if (filters.action) logs = logs.filter(l => l.action.includes(filters.action!));
      if (filters.result) logs = logs.filter(l => l.result === filters.result);
      if (filters.startDate) logs = logs.filter(l => l.timestamp >= filters.startDate!);
      if (filters.endDate) logs = logs.filter(l => l.timestamp <= filters.endDate!);
    }
    
    return logs;
  }

  /**
   * Private helper methods
   */
  private initializeRoles(): void {
    for (const role of this.config.rbac.roles) {
      this.roleCache.set(role.name, role);
    }
  }

  private assignUserRoles(user: AuthUser): Role[] {
    const roles: Role[] = [];
    const userRoleNames = user.roles || [];
    
    // Add default role if no roles assigned
    if (userRoleNames.length === 0 && this.config.rbac.defaultRole) {
      userRoleNames.push(this.config.rbac.defaultRole);
    }
    
    // Map role names to Role objects
    for (const roleName of userRoleNames) {
      const role = this.roleCache.get(roleName);
      if (role) {
        roles.push(role);
        // Add inherited roles
        if (role.inherits) {
          for (const inheritedName of role.inherits) {
            const inheritedRole = this.roleCache.get(inheritedName);
            if (inheritedRole && !roles.includes(inheritedRole)) {
              roles.push(inheritedRole);
            }
          }
        }
      }
    }
    
    return roles;
  }

  private calculateEffectivePermissions(roles: Role[]): Permission[] {
    const permissions: Map<string, Permission> = new Map();
    
    // Merge permissions from all roles
    for (const role of roles) {
      for (const perm of role.permissions) {
        const key = `${perm.resource}:${perm.actions.join(',')}`;
        const existing = permissions.get(key);
        
        if (existing) {
          // Merge actions
          const allActions = new Set([...existing.actions, ...perm.actions]);
          existing.actions = Array.from(allActions);
        } else {
          permissions.set(key, { ...perm });
        }
      }
    }
    
    return Array.from(permissions.values());
  }

  private permissionsToStrings(permissions: Permission[]): string[] {
    const result: string[] = [];
    for (const perm of permissions) {
      for (const action of perm.actions) {
        result.push(`${perm.resource}:${action}`);
      }
    }
    return result;
  }

  private checkPermission(
    session: AuthSession,
    resource: string,
    action: string,
    context?: Record<string, any>
  ): boolean {
    // Check super admin
    if (this.config.rbac.superAdminRoles) {
      const hasSuper = session.roles?.some(r => 
        this.config.rbac.superAdminRoles!.includes(r)
      );
      if (hasSuper) return true;
    }
    
    // Check custom evaluator
    if (this.config.rbac.customPermissionEvaluator) {
      const custom = this.config.rbac.customPermissionEvaluator(session.user, resource, action);
      if (custom) return true;
    }
    
    // Check exact permission
    const exactPerm = `${resource}:${action}`;
    if (session.permissions?.includes(exactPerm)) return true;
    
    // Check wildcard permissions
    if (session.permissions?.includes(`${resource}:*`)) return true;
    if (session.permissions?.includes('*:*')) return true;
    
    // Check resource hierarchy
    if (this.config.rbac.resourceHierarchy) {
      const parents = this.config.rbac.resourceHierarchy[resource];
      if (parents) {
        for (const parent of parents) {
          if (session.permissions?.includes(`${parent}:${action}`)) return true;
          if (session.permissions?.includes(`${parent}:*`)) return true;
        }
      }
    }
    
    return false;
  }

  private async checkSessionLimits(userId: string): Promise<void> {
    if (!this.config.sessionLimits) return;
    
    const limits = this.config.sessionLimits;
    const userSessionSet = this.userSessions.get(userId);
    const userSessionCount = userSessionSet ? userSessionSet.size : 0;
    
    // Check max sessions per user
    if (limits.maxSessionsPerUser && userSessionCount >= limits.maxSessionsPerUser) {
      throw new Error(`User has reached maximum session limit (${limits.maxSessionsPerUser})`);
    }
    
    // Check total concurrent sessions
    if (limits.maxConcurrentSessions && this.sessions.size >= limits.maxConcurrentSessions) {
      throw new Error(`System has reached maximum concurrent session limit (${limits.maxConcurrentSessions})`);
    }
  }

  private enforceSessionLimits(): void {
    if (!this.config.sessionLimits) return;
    
    const now = new Date();
    const limits = this.config.sessionLimits;
    const toTerminate: string[] = [];
    
    for (const [sessionId, session] of this.sessions.entries()) {
      // Check idle time
      if (limits.maxIdleTime) {
        const idleTime = now.getTime() - session.lastActivity.getTime();
        if (idleTime > limits.maxIdleTime) {
          toTerminate.push(sessionId);
          this.logger.info('Session exceeded idle time limit', { sessionId, idleTime });
          continue;
        }
      }
      
      // Check session duration
      if (limits.maxSessionDuration) {
        const duration = now.getTime() - session.createdAt.getTime();
        if (duration > limits.maxSessionDuration) {
          toTerminate.push(sessionId);
          this.logger.info('Session exceeded duration limit', { sessionId, duration });
        }
      }
    }
    
    // Terminate exceeded sessions
    for (const sessionId of toTerminate) {
      this.terminateSession(sessionId).catch(err => {
        this.logger.error('Error terminating session', { sessionId, error: err });
      });
    }
  }

  private getRestrictions(session: AuthSession): any {
    const restrictions: any = {};
    
    // Apply restrictions based on roles
    if (!session.roles?.includes('admin')) {
      restrictions.headless = true; // Non-admins get headless mode
      restrictions.timeout = 30000; // Shorter timeout for non-admins
    }
    
    if (session.roles?.includes('viewer')) {
      restrictions.readOnly = true; // Viewers can't modify pages
    }
    
    return restrictions;
  }

  private wrapWithAuthorization(pc: PlayClone, sessionId: string): PlayClone {
    // Wrap navigation methods
    const originalNavigate = pc.navigate.bind(pc);
    pc.navigate = async (url: string) => {
      const authorized = await this.authorize(sessionId, 'browser', 'navigate', { url });
      if (!authorized) throw new Error('Unauthorized: Cannot navigate');
      return originalNavigate(url);
    };
    
    // Wrap action methods
    const originalClick = pc.click.bind(pc);
    pc.click = async (selector: string) => {
      const authorized = await this.authorize(sessionId, 'browser', 'click', { selector });
      if (!authorized) throw new Error('Unauthorized: Cannot click');
      return originalClick(selector);
    };
    
    const originalFill = pc.fill.bind(pc);
    pc.fill = async (selector: string, value: string) => {
      const authorized = await this.authorize(sessionId, 'browser', 'fill', { selector });
      if (!authorized) throw new Error('Unauthorized: Cannot fill');
      return originalFill(selector, value);
    };
    
    // Wrap data extraction
    const originalGetText = pc.getText.bind(pc);
    pc.getText = async (selector?: string) => {
      const authorized = await this.authorize(sessionId, 'data', 'extract', { type: 'text' });
      if (!authorized) throw new Error('Unauthorized: Cannot extract text');
      return originalGetText(selector);
    };
    
    return pc;
  }

  private async auditLog(log: Omit<AuditLog, 'id' | 'timestamp' | 'ipAddress' | 'userAgent'>): Promise<void> {
    if (!this.config.auditLogging?.enabled) return;
    
    const auditLog: AuditLog = {
      ...log,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent()
    };
    
    this.auditLogs.push(auditLog);
    
    // Write to file if configured
    if (this.config.auditLogging.logPath) {
      await this.writeAuditLogToFile(auditLog);
    }
    
    this.emit('auditLog', auditLog);
  }

  private async writeAuditLogToFile(log: AuditLog): Promise<void> {
    if (!this.config.auditLogging?.logPath) return;
    
    const logPath = this.config.auditLogging.logPath;
    const filename = `audit_${new Date().toISOString().split('T')[0]}.log`;
    const filepath = path.join(logPath, filename);
    
    const logLine = JSON.stringify(log) + '\n';
    
    try {
      await fs.appendFile(filepath, logLine);
    } catch (error) {
      this.logger.error('Failed to write audit log', error);
    }
  }

  private startAuditLogRotation(): void {
    if (!this.config.auditLogging?.retention) return;
    
    // Rotate logs daily
    setInterval(() => {
      const retention = this.config.auditLogging!.retention!;
      const cutoff = new Date(Date.now() - retention);
      
      // Remove old logs from memory
      this.auditLogs = this.auditLogs.filter(log => log.timestamp > cutoff);
      
      // Clean up old log files
      if (this.config.auditLogging!.logPath) {
        this.cleanupOldLogFiles(cutoff);
      }
    }, 86400000); // Daily
  }

  private async cleanupOldLogFiles(cutoff: Date): Promise<void> {
    if (!this.config.auditLogging?.logPath) return;
    
    try {
      const files = await fs.readdir(this.config.auditLogging.logPath);
      for (const file of files) {
        if (file.startsWith('audit_') && file.endsWith('.log')) {
          const dateStr = file.replace('audit_', '').replace('.log', '');
          const fileDate = new Date(dateStr);
          if (fileDate < cutoff) {
            await fs.unlink(path.join(this.config.auditLogging.logPath, file));
            this.logger.debug('Deleted old audit log file', { file });
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old log files', error);
    }
  }

  private getClientIP(): string {
    // In a real implementation, this would get the actual client IP
    return '127.0.0.1';
  }

  private getUserAgent(): string {
    // In a real implementation, this would get the actual user agent
    return 'PlayClone/1.0';
  }
}