/**
 * SessionManagerBasic - Basic session management for in-memory sessions
 * This complements the browser-focused SessionManager
 */

import { promises as fs } from 'fs';
import * as path from 'path';

export interface Session {
  id: string;
  createdAt: Date;
  lastAccessedAt: Date;
  data: Record<string, any>;
  metadata: Record<string, any>;
}

export class SessionManagerBasic {
  private sessions: Map<string, Session> = new Map();
  private sessionPath: string;

  constructor(sessionPath?: string) {
    this.sessionPath = sessionPath || path.join(process.cwd(), 'sessions');
  }

  /**
   * Create a new session
   */
  createSession(metadata: Record<string, any> = {}): Session {
    const session: Session = {
      id: this.generateSessionId(),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      data: {},
      metadata
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = new Date();
    }
    return session;
  }

  /**
   * Update session data
   */
  updateSession(sessionId: string, data: Record<string, any>, merge: boolean = false): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (merge) {
      session.data = { ...session.data, ...data };
    } else {
      session.data = data;
    }

    session.lastAccessedAt = new Date();
    return true;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Save session to disk
   */
  async saveSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await fs.mkdir(this.sessionPath, { recursive: true });
    const sessionFile = path.join(this.sessionPath, `${sessionId}.json`);
    await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
  }

  /**
   * Load session from disk
   */
  async loadSession(sessionId: string): Promise<Session | null> {
    try {
      const sessionFile = path.join(this.sessionPath, `${sessionId}.json`);
      const data = await fs.readFile(sessionFile, 'utf-8');
      const sessionData = JSON.parse(data);
      
      // Convert date strings back to Date objects
      const session: Session = {
        ...sessionData,
        createdAt: new Date(sessionData.createdAt),
        lastAccessedAt: new Date(sessionData.lastAccessedAt)
      };

      this.sessions.set(session.id, session);
      return session;
    } catch (error: any) {
      if (error.message.includes('ENOENT')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all active sessions
   */
  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * List saved session files
   */
  async listSavedSessions(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.sessionPath);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error: any) {
      if (error.message.includes('ENOENT')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Clear expired sessions
   */
  async clearExpiredSessions(ttlMinutes: number): Promise<void> {
    const now = Date.now();
    const ttlMs = ttlMinutes * 60 * 1000;
    const expiredSessions: string[] = [];

    for (const [id, session] of this.sessions) {
      if (now - session.lastAccessedAt.getTime() > ttlMs) {
        expiredSessions.push(id);
      }
    }

    for (const id of expiredSessions) {
      this.sessions.delete(id);
      
      // Try to delete saved file
      try {
        const sessionFile = path.join(this.sessionPath, `${id}.json`);
        await fs.access(sessionFile);
        await fs.unlink(sessionFile);
      } catch {
        // File doesn't exist, ignore
      }
    }
  }

  /**
   * Export session as JSON string
   */
  exportSession(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    return JSON.stringify(session);
  }

  /**
   * Import session from JSON string
   */
  importSession(jsonData: string): Session {
    const sessionData = JSON.parse(jsonData);
    const session: Session = {
      ...sessionData,
      createdAt: new Date(sessionData.createdAt),
      lastAccessedAt: new Date(sessionData.lastAccessedAt)
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}