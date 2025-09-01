import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

export enum AuditEventType {
  // Authentication Events
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_DESTROYED = 'SESSION_DESTROYED',
  
  // Browser Operations
  BROWSER_LAUNCHED = 'BROWSER_LAUNCHED',
  BROWSER_CLOSED = 'BROWSER_CLOSED',
  NAVIGATION = 'NAVIGATION',
  FORM_FILLED = 'FORM_FILLED',
  BUTTON_CLICKED = 'BUTTON_CLICKED',
  DATA_EXTRACTED = 'DATA_EXTRACTED',
  SCREENSHOT_TAKEN = 'SCREENSHOT_TAKEN',
  
  // Credential Operations
  CREDENTIAL_CREATED = 'CREDENTIAL_CREATED',
  CREDENTIAL_ACCESSED = 'CREDENTIAL_ACCESSED',
  CREDENTIAL_UPDATED = 'CREDENTIAL_UPDATED',
  CREDENTIAL_DELETED = 'CREDENTIAL_DELETED',
  CREDENTIAL_EXPORTED = 'CREDENTIAL_EXPORTED',
  CREDENTIAL_IMPORTED = 'CREDENTIAL_IMPORTED',
  
  // Security Events
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // System Events
  SYSTEM_START = 'SYSTEM_START',
  SYSTEM_STOP = 'SYSTEM_STOP',
  CONFIG_CHANGED = 'CONFIG_CHANGED',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  
  // Compliance Events
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  DATA_DELETION = 'DATA_DELETION',
  POLICY_VIOLATION = 'POLICY_VIOLATION'
}

export enum AuditSeverity {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  sessionId?: string;
  action: string;
  resource?: string;
  details?: Record<string, any>;
  metadata?: {
    ip?: string;
    userAgent?: string;
    location?: string;
    browser?: string;
    os?: string;
  };
  result?: 'SUCCESS' | 'FAILURE';
  error?: string;
  hash?: string;
}

export interface AuditLoggerOptions {
  logPath?: string;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  rotationInterval?: 'daily' | 'weekly' | 'monthly';
  enableConsole?: boolean;
  enableFile?: boolean;
  enableRemote?: boolean;
  remoteEndpoint?: string;
  encryptLogs?: boolean;
  encryptionKey?: string;
  includeStackTrace?: boolean;
  redactSensitiveData?: boolean;
  complianceMode?: 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'SOC2' | 'NONE';
}

export class AuditLogger extends EventEmitter {
  private options: Required<AuditLoggerOptions>;
  private currentLogFile: string;
  private currentFileSize: number = 0;
  private logQueue: AuditEvent[] = [];
  private isWriting: boolean = false;
  private sessionData: Map<string, any> = new Map();

  constructor(options: AuditLoggerOptions = {}) {
    super();
    
    this.options = {
      logPath: options.logPath || path.join(process.cwd(), '.playclone', 'audit'),
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: options.maxFiles || 100,
      rotationInterval: options.rotationInterval || 'daily',
      enableConsole: options.enableConsole ?? false,
      enableFile: options.enableFile ?? true,
      enableRemote: options.enableRemote ?? false,
      remoteEndpoint: options.remoteEndpoint || '',
      encryptLogs: options.encryptLogs ?? false,
      encryptionKey: options.encryptionKey || '',
      includeStackTrace: options.includeStackTrace ?? false,
      redactSensitiveData: options.redactSensitiveData ?? true,
      complianceMode: options.complianceMode || 'NONE'
    };

    this.currentLogFile = this.getLogFileName();
    this.ensureLogDirectory();
    this.startRotationSchedule();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.options.logPath)) {
      fs.mkdirSync(this.options.logPath, { recursive: true, mode: 0o700 });
    }
  }

  private getLogFileName(): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    return path.join(this.options.logPath, `audit-${dateStr}.log`);
  }

  private startRotationSchedule(): void {
    const interval = this.getRotationInterval();
    setInterval(() => {
      this.rotateLogFile();
    }, interval);
  }

  private getRotationInterval(): number {
    switch (this.options.rotationInterval) {
      case 'daily':
        return 24 * 60 * 60 * 1000;
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  private rotateLogFile(): void {
    const newLogFile = this.getLogFileName();
    if (newLogFile !== this.currentLogFile) {
      this.currentLogFile = newLogFile;
      this.currentFileSize = 0;
      this.cleanupOldLogs();
    }
  }

  private cleanupOldLogs(): void {
    const files = fs.readdirSync(this.options.logPath)
      .filter(f => f.startsWith('audit-') && f.endsWith('.log'))
      .sort()
      .reverse();

    if (files.length > this.options.maxFiles) {
      const filesToDelete = files.slice(this.options.maxFiles);
      filesToDelete.forEach(file => {
        fs.unlinkSync(path.join(this.options.logPath, file));
      });
    }
  }

  async log(
    type: AuditEventType,
    action: string,
    details?: {
      userId?: string;
      sessionId?: string;
      resource?: string;
      result?: 'SUCCESS' | 'FAILURE';
      error?: string;
      metadata?: Record<string, any>;
      severity?: AuditSeverity;
      additionalData?: Record<string, any>;
    }
  ): Promise<void> {
    const event: AuditEvent = {
      id: crypto.randomBytes(16).toString('hex'),
      timestamp: new Date(),
      type,
      severity: details?.severity || this.getSeverityForType(type),
      userId: details?.userId,
      sessionId: details?.sessionId,
      action,
      resource: details?.resource,
      details: details?.additionalData,
      metadata: details?.metadata as any,
      result: details?.result,
      error: details?.error
    };

    // Add stack trace if enabled and error occurred
    if (this.options.includeStackTrace && details?.error) {
      event.details = {
        ...event.details,
        stackTrace: new Error().stack
      };
    }

    // Redact sensitive data if enabled
    if (this.options.redactSensitiveData) {
      event.details = this.redactSensitive(event.details);
    }

    // Add compliance-specific fields
    this.addComplianceFields(event);

    // Calculate hash for integrity
    event.hash = this.calculateEventHash(event);

    // Emit event for real-time monitoring
    this.emit('audit', event);

    // Add to queue for batch writing
    this.logQueue.push(event);

    // Process queue
    await this.processQueue();
  }

  private getSeverityForType(type: AuditEventType): AuditSeverity {
    const severityMap: Record<AuditEventType, AuditSeverity> = {
      [AuditEventType.LOGIN_ATTEMPT]: AuditSeverity.INFO,
      [AuditEventType.LOGIN_SUCCESS]: AuditSeverity.INFO,
      [AuditEventType.LOGIN_FAILURE]: AuditSeverity.WARNING,
      [AuditEventType.LOGOUT]: AuditSeverity.INFO,
      [AuditEventType.SESSION_CREATED]: AuditSeverity.INFO,
      [AuditEventType.SESSION_DESTROYED]: AuditSeverity.INFO,
      [AuditEventType.BROWSER_LAUNCHED]: AuditSeverity.DEBUG,
      [AuditEventType.BROWSER_CLOSED]: AuditSeverity.DEBUG,
      [AuditEventType.NAVIGATION]: AuditSeverity.DEBUG,
      [AuditEventType.FORM_FILLED]: AuditSeverity.INFO,
      [AuditEventType.BUTTON_CLICKED]: AuditSeverity.DEBUG,
      [AuditEventType.DATA_EXTRACTED]: AuditSeverity.INFO,
      [AuditEventType.SCREENSHOT_TAKEN]: AuditSeverity.INFO,
      [AuditEventType.CREDENTIAL_CREATED]: AuditSeverity.INFO,
      [AuditEventType.CREDENTIAL_ACCESSED]: AuditSeverity.INFO,
      [AuditEventType.CREDENTIAL_UPDATED]: AuditSeverity.INFO,
      [AuditEventType.CREDENTIAL_DELETED]: AuditSeverity.WARNING,
      [AuditEventType.CREDENTIAL_EXPORTED]: AuditSeverity.WARNING,
      [AuditEventType.CREDENTIAL_IMPORTED]: AuditSeverity.WARNING,
      [AuditEventType.SECURITY_VIOLATION]: AuditSeverity.CRITICAL,
      [AuditEventType.PERMISSION_DENIED]: AuditSeverity.WARNING,
      [AuditEventType.SUSPICIOUS_ACTIVITY]: AuditSeverity.WARNING,
      [AuditEventType.RATE_LIMIT_EXCEEDED]: AuditSeverity.WARNING,
      [AuditEventType.SYSTEM_START]: AuditSeverity.INFO,
      [AuditEventType.SYSTEM_STOP]: AuditSeverity.INFO,
      [AuditEventType.CONFIG_CHANGED]: AuditSeverity.INFO,
      [AuditEventType.ERROR_OCCURRED]: AuditSeverity.ERROR,
      [AuditEventType.DATA_ACCESS]: AuditSeverity.INFO,
      [AuditEventType.DATA_MODIFICATION]: AuditSeverity.INFO,
      [AuditEventType.DATA_DELETION]: AuditSeverity.WARNING,
      [AuditEventType.POLICY_VIOLATION]: AuditSeverity.CRITICAL
    };

    return severityMap[type] || AuditSeverity.INFO;
  }

  private redactSensitive(data: any): any {
    if (!data) return data;

    const sensitiveKeys = [
      'password', 'token', 'apiKey', 'secret', 'credential',
      'ssn', 'creditCard', 'cvv', 'pin', 'privateKey'
    ];

    const redact = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;

      const result: any = Array.isArray(obj) ? [] : {};

      for (const key in obj) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          result[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          result[key] = redact(obj[key]);
        } else {
          result[key] = obj[key];
        }
      }

      return result;
    };

    return redact(data);
  }

  private addComplianceFields(event: AuditEvent): void {
    switch (this.options.complianceMode) {
      case 'GDPR':
        event.details = {
          ...event.details,
          dataController: process.env.GDPR_DATA_CONTROLLER || 'Unknown',
          legalBasis: process.env.GDPR_LEGAL_BASIS || 'Legitimate Interest',
          dataRetention: '90 days'
        };
        break;
        
      case 'HIPAA':
        event.details = {
          ...event.details,
          phi: false,
          encryptionStatus: 'AES-256',
          accessControl: 'RBAC'
        };
        break;
        
      case 'PCI-DSS':
        event.details = {
          ...event.details,
          cardDataPresent: false,
          pciLevel: process.env.PCI_LEVEL || 'Level 4'
        };
        break;
        
      case 'SOC2':
        event.details = {
          ...event.details,
          controlFamily: this.getSOC2ControlFamily(event.type),
          auditTrail: true
        };
        break;
    }
  }

  private getSOC2ControlFamily(type: AuditEventType): string {
    const controlMap: Record<string, string> = {
      [AuditEventType.LOGIN_ATTEMPT]: 'Access Control',
      [AuditEventType.DATA_ACCESS]: 'Confidentiality',
      [AuditEventType.SYSTEM_START]: 'Availability',
      [AuditEventType.ERROR_OCCURRED]: 'Processing Integrity',
      [AuditEventType.SECURITY_VIOLATION]: 'Security'
    };

    return controlMap[type] || 'General';
  }

  private calculateEventHash(event: AuditEvent): string {
    const content = JSON.stringify({
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      action: event.action,
      userId: event.userId,
      result: event.result
    });

    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async processQueue(): Promise<void> {
    if (this.isWriting || this.logQueue.length === 0) return;

    this.isWriting = true;
    const events = [...this.logQueue];
    this.logQueue = [];

    try {
      // Write to console if enabled
      if (this.options.enableConsole) {
        events.forEach(event => this.logToConsole(event));
      }

      // Write to file if enabled
      if (this.options.enableFile) {
        await this.writeToFile(events);
      }

      // Send to remote if enabled
      if (this.options.enableRemote && this.options.remoteEndpoint) {
        await this.sendToRemote(events);
      }
    } catch (error) {
      console.error('Failed to process audit queue:', error);
      // Re-add events to queue for retry
      this.logQueue.unshift(...events);
    } finally {
      this.isWriting = false;
    }
  }

  private logToConsole(event: AuditEvent): void {
    const severityColors: Record<AuditSeverity, string> = {
      [AuditSeverity.DEBUG]: '\x1b[90m',    // Gray
      [AuditSeverity.INFO]: '\x1b[36m',     // Cyan
      [AuditSeverity.WARNING]: '\x1b[33m',  // Yellow
      [AuditSeverity.ERROR]: '\x1b[31m',    // Red
      [AuditSeverity.CRITICAL]: '\x1b[35m'  // Magenta
    };

    const color = severityColors[event.severity];
    const reset = '\x1b[0m';

    console.log(
      `${color}[${event.timestamp.toISOString()}] ${event.severity} - ${event.type}: ${event.action}${reset}`
    );

    if (event.details) {
      console.log('  Details:', JSON.stringify(event.details, null, 2));
    }
  }

  private async writeToFile(events: AuditEvent[]): Promise<void> {
    const lines = events.map(event => {
      const logLine = JSON.stringify(event);
      return this.options.encryptLogs ? this.encryptLine(logLine) : logLine;
    });

    const content = lines.join('\n') + '\n';
    const contentSize = Buffer.byteLength(content);

    // Check if rotation is needed
    if (this.currentFileSize + contentSize > this.options.maxFileSize) {
      this.rotateLogFile();
    }

    // Append to file
    fs.appendFileSync(this.currentLogFile, content, { mode: 0o600 });
    this.currentFileSize += contentSize;
  }

  private encryptLine(line: string): string {
    if (!this.options.encryptionKey) return line;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      crypto.createHash('sha256').update(this.options.encryptionKey).digest(),
      iv
    );

    let encrypted = cipher.update(line, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = (cipher as any).getAuthTag();

    return JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted
    });
  }

  private async sendToRemote(events: AuditEvent[]): Promise<void> {
    try {
      const response = await fetch(this.options.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Audit-Source': 'PlayClone'
        },
        body: JSON.stringify({ events })
      });

      if (!response.ok) {
        throw new Error(`Remote logging failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send audit logs to remote:', error);
    }
  }

  async query(options: {
    startDate?: Date;
    endDate?: Date;
    types?: AuditEventType[];
    severities?: AuditSeverity[];
    userId?: string;
    sessionId?: string;
    limit?: number;
  }): Promise<AuditEvent[]> {
    const results: AuditEvent[] = [];
    const files = this.getLogFilesInRange(options.startDate, options.endDate);

    for (const file of files) {
      const events = await this.readLogFile(file);
      
      for (const event of events) {
        // Apply filters
        if (options.types && !options.types.includes(event.type)) continue;
        if (options.severities && !options.severities.includes(event.severity)) continue;
        if (options.userId && event.userId !== options.userId) continue;
        if (options.sessionId && event.sessionId !== options.sessionId) continue;

        results.push(event);

        if (options.limit && results.length >= options.limit) {
          return results;
        }
      }
    }

    return results;
  }

  private getLogFilesInRange(startDate?: Date, endDate?: Date): string[] {
    const files = fs.readdirSync(this.options.logPath)
      .filter(f => f.startsWith('audit-') && f.endsWith('.log'))
      .sort();

    if (!startDate && !endDate) return files;

    return files.filter(file => {
      const match = file.match(/audit-(\d{4}-\d{2}-\d{2})\.log/);
      if (!match) return false;

      const fileDate = new Date(match[1]);
      if (startDate && fileDate < startDate) return false;
      if (endDate && fileDate > endDate) return false;

      return true;
    });
  }

  private async readLogFile(filename: string): Promise<AuditEvent[]> {
    const filepath = path.join(this.options.logPath, filename);
    if (!fs.existsSync(filepath)) return [];

    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    const events: AuditEvent[] = [];
    for (const line of lines) {
      try {
        const data = this.options.encryptLogs ? this.decryptLine(line) : line;
        const event = JSON.parse(data);
        event.timestamp = new Date(event.timestamp);
        events.push(event);
      } catch (error) {
        console.error('Failed to parse audit log line:', error);
      }
    }

    return events;
  }

  private decryptLine(line: string): string {
    if (!this.options.encryptionKey) return line;

    try {
      const encrypted = JSON.parse(line);
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        crypto.createHash('sha256').update(this.options.encryptionKey).digest(),
        Buffer.from(encrypted.iv, 'hex')
      );

      (decipher as any).setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

      let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt audit log line:', error);
      return '';
    }
  }

  async generateReport(options: {
    startDate: Date;
    endDate: Date;
    format?: 'json' | 'csv' | 'html';
  }): Promise<string> {
    const events = await this.query({
      startDate: options.startDate,
      endDate: options.endDate
    });

    switch (options.format || 'json') {
      case 'csv':
        return this.generateCSVReport(events);
      case 'html':
        return this.generateHTMLReport(events, options);
      default:
        return JSON.stringify(events, null, 2);
    }
  }

  private generateCSVReport(events: AuditEvent[]): string {
    const headers = ['Timestamp', 'Type', 'Severity', 'Action', 'User', 'Session', 'Result', 'Resource'];
    const rows = events.map(e => [
      e.timestamp.toISOString(),
      e.type,
      e.severity,
      e.action,
      e.userId || '',
      e.sessionId || '',
      e.result || '',
      e.resource || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private generateHTMLReport(events: AuditEvent[], options: any): string {
    const summary = this.generateSummary(events);

    return `<!DOCTYPE html>
<html>
<head>
  <title>Audit Report: ${options.startDate.toISOString()} to ${options.endDate.toISOString()}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
    th { background: #4CAF50; color: white; }
    tr:nth-child(even) { background: #f2f2f2; }
    .severity-CRITICAL { color: #d32f2f; font-weight: bold; }
    .severity-ERROR { color: #f44336; }
    .severity-WARNING { color: #ff9800; }
    .severity-INFO { color: #2196f3; }
    .severity-DEBUG { color: #9e9e9e; }
  </style>
</head>
<body>
  <h1>Audit Report</h1>
  <div class="summary">
    <h2>Summary</h2>
    <p>Period: ${options.startDate.toISOString()} to ${options.endDate.toISOString()}</p>
    <p>Total Events: ${summary.totalEvents}</p>
    <p>Critical: ${summary.critical} | Error: ${summary.error} | Warning: ${summary.warning}</p>
    <p>Success Rate: ${summary.successRate}%</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Type</th>
        <th>Severity</th>
        <th>Action</th>
        <th>User</th>
        <th>Result</th>
      </tr>
    </thead>
    <tbody>
      ${events.map(e => `
        <tr>
          <td>${e.timestamp.toISOString()}</td>
          <td>${e.type}</td>
          <td class="severity-${e.severity}">${e.severity}</td>
          <td>${e.action}</td>
          <td>${e.userId || '-'}</td>
          <td>${e.result || '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;
  }

  private generateSummary(events: AuditEvent[]): any {
    const summary = {
      totalEvents: events.length,
      critical: 0,
      error: 0,
      warning: 0,
      info: 0,
      debug: 0,
      success: 0,
      failure: 0,
      successRate: 0
    };

    events.forEach(e => {
      switch (e.severity) {
        case AuditSeverity.CRITICAL: summary.critical++; break;
        case AuditSeverity.ERROR: summary.error++; break;
        case AuditSeverity.WARNING: summary.warning++; break;
        case AuditSeverity.INFO: summary.info++; break;
        case AuditSeverity.DEBUG: summary.debug++; break;
      }

      if (e.result === 'SUCCESS') summary.success++;
      if (e.result === 'FAILURE') summary.failure++;
    });

    if (summary.success + summary.failure > 0) {
      summary.successRate = Math.round(summary.success / (summary.success + summary.failure) * 100);
    }

    return summary;
  }

  destroy(): void {
    this.removeAllListeners();
    this.logQueue = [];
  }
}