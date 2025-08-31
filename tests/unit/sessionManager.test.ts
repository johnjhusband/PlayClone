import { SessionManagerBasic as SessionManager } from '../../src/core/SessionManagerBasic';
import { promises as fs } from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
    readdir: jest.fn(),
    access: jest.fn()
  }
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  const testSessionsDir = '/tmp/playclone-test-sessions';

  beforeEach(() => {
    sessionManager = new SessionManager(testSessionsDir);
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session with unique ID', () => {
      const session1 = sessionManager.createSession({ userId: 'user1' });
      const session2 = sessionManager.createSession({ userId: 'user2' });

      expect(session1.id).toBeTruthy();
      expect(session2.id).toBeTruthy();
      expect(session1.id).not.toBe(session2.id);
    });

    it('should initialize session with metadata', () => {
      const metadata = { userId: 'test-user', appName: 'test-app' };
      const session = sessionManager.createSession(metadata);

      expect(session.metadata).toEqual(metadata);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastAccessedAt).toBeInstanceOf(Date);
      expect(session.data).toEqual({});
    });

    it('should store session in manager', () => {
      const session = sessionManager.createSession();
      const retrieved = sessionManager.getSession(session.id);

      expect(retrieved).toBe(session);
    });
  });

  describe('getSession', () => {
    it('should retrieve existing session', () => {
      const session = sessionManager.createSession();
      const retrieved = sessionManager.getSession(session.id);

      expect(retrieved).toBe(session);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = sessionManager.getSession('non-existent-id');
      expect(retrieved).toBeUndefined();
    });

    it('should update lastAccessedAt on retrieval', () => {
      const session = sessionManager.createSession();
      const originalTime = session.lastAccessedAt;

      // Wait a bit to ensure time difference
      jest.advanceTimersByTime(100);
      
      sessionManager.getSession(session.id);
      expect(session.lastAccessedAt.getTime()).toBeGreaterThan(originalTime.getTime());
    });
  });

  describe('updateSession', () => {
    it('should update session data', () => {
      const session = sessionManager.createSession();
      const newData = { page: 'home', isLoggedIn: true };

      sessionManager.updateSession(session.id, newData);

      expect(session.data).toEqual(newData);
    });

    it('should merge data when merge option is true', () => {
      const session = sessionManager.createSession();
      session.data = { existing: 'data' };

      sessionManager.updateSession(session.id, { new: 'data' }, true);

      expect(session.data).toEqual({
        existing: 'data',
        new: 'data'
      });
    });

    it('should replace data when merge option is false', () => {
      const session = sessionManager.createSession();
      session.data = { existing: 'data' };

      sessionManager.updateSession(session.id, { new: 'data' }, false);

      expect(session.data).toEqual({ new: 'data' });
    });

    it('should return false for non-existent session', () => {
      const result = sessionManager.updateSession('non-existent', {});
      expect(result).toBe(false);
    });
  });

  describe('deleteSession', () => {
    it('should remove session from manager', () => {
      const session = sessionManager.createSession();
      
      const result = sessionManager.deleteSession(session.id);

      expect(result).toBe(true);
      expect(sessionManager.getSession(session.id)).toBeUndefined();
    });

    it('should return false for non-existent session', () => {
      const result = sessionManager.deleteSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('saveSession', () => {
    it('should save session to disk', async () => {
      const session = sessionManager.createSession({ userId: 'test' });
      session.data = { test: 'data' };

      await sessionManager.saveSession(session.id);

      expect(fs.mkdir).toHaveBeenCalledWith(testSessionsDir, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(testSessionsDir, `${session.id}.json`),
        JSON.stringify(session, null, 2)
      );
    });

    it('should throw error for non-existent session', async () => {
      await expect(sessionManager.saveSession('non-existent'))
        .rejects.toThrow('Session not found: non-existent');
    });

    it('should handle save errors', async () => {
      const session = sessionManager.createSession();
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('Write failed'));

      await expect(sessionManager.saveSession(session.id))
        .rejects.toThrow('Write failed');
    });
  });

  describe('loadSession', () => {
    it('should load session from disk', async () => {
      const savedSession = {
        id: 'test-id',
        createdAt: '2025-01-01T00:00:00.000Z',
        lastAccessedAt: '2025-01-01T00:00:00.000Z',
        data: { test: 'data' },
        metadata: { userId: 'test' }
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(savedSession));

      const session = await sessionManager.loadSession('test-id');

      expect(session).toBeTruthy();
      expect(session?.id).toBe('test-id');
      expect(session?.data).toEqual({ test: 'data' });
      expect(session?.createdAt).toBeInstanceOf(Date);
    });

    it('should handle missing session file', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      const session = await sessionManager.loadSession('missing-id');
      expect(session).toBeNull();
    });

    it('should handle corrupted session file', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('invalid json');

      await expect(sessionManager.loadSession('corrupt-id'))
        .rejects.toThrow();
    });
  });

  describe('listSessions', () => {
    it('should return list of active sessions', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();

      const sessions = sessionManager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.id)).toContain(session1.id);
      expect(sessions.map(s => s.id)).toContain(session2.id);
    });

    it('should return empty array when no sessions', () => {
      const sessions = sessionManager.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('listSavedSessions', () => {
    it('should list saved session files', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([
        'session1.json',
        'session2.json',
        'not-a-session.txt'
      ]);

      const sessions = await sessionManager.listSavedSessions();

      expect(sessions).toEqual(['session1', 'session2']);
    });

    it('should return empty array when directory does not exist', async () => {
      (fs.readdir as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      const sessions = await sessionManager.listSavedSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('clearExpiredSessions', () => {
    it('should remove expired sessions', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();
      
      // Set session1 as expired
      session1.lastAccessedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      sessionManager.clearExpiredSessions(60); // 60 minutes TTL

      expect(sessionManager.getSession(session1.id)).toBeUndefined();
      expect(sessionManager.getSession(session2.id)).toBe(session2);
    });

    it('should delete saved sessions for expired sessions', async () => {
      const session = sessionManager.createSession();
      session.lastAccessedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);

      (fs.access as jest.Mock).mockResolvedValue(undefined);

      await sessionManager.clearExpiredSessions(60);

      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(testSessionsDir, `${session.id}.json`)
      );
    });
  });

  describe('exportSession', () => {
    it('should export session as JSON string', () => {
      const session = sessionManager.createSession({ userId: 'test' });
      session.data = { test: 'data' };

      const exported = sessionManager.exportSession(session.id);
      const parsed = JSON.parse(exported!);

      expect(parsed.id).toBe(session.id);
      expect(parsed.data).toEqual({ test: 'data' });
    });

    it('should return null for non-existent session', () => {
      const exported = sessionManager.exportSession('non-existent');
      expect(exported).toBeNull();
    });
  });

  describe('importSession', () => {
    it('should import session from JSON string', () => {
      const sessionData = {
        id: 'imported-id',
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        data: { imported: 'data' },
        metadata: {}
      };

      const session = sessionManager.importSession(JSON.stringify(sessionData));

      expect(session.id).toBe('imported-id');
      expect(session.data).toEqual({ imported: 'data' });
      expect(sessionManager.getSession('imported-id')).toBe(session);
    });

    it('should handle invalid JSON', () => {
      expect(() => sessionManager.importSession('invalid json'))
        .toThrow();
    });

    it('should override existing session with same ID', () => {
      const original = sessionManager.createSession();
      const importData = {
        id: original.id,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        data: { new: 'data' },
        metadata: {}
      };

      const imported = sessionManager.importSession(JSON.stringify(importData));

      expect(sessionManager.getSession(original.id)).toBe(imported);
      expect(imported.data).toEqual({ new: 'data' });
    });
  });
});