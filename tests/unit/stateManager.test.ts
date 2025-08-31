import { StateManager } from '../../src/state/StateManager';
import { Page, BrowserContext } from 'playwright-core';
import { promises as fs } from 'fs';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
    readdir: jest.fn()
  }
}));

describe('StateManager', () => {
  let stateManager: StateManager;
  let mockPage: jest.Mocked<Page>;
  let mockContext: jest.Mocked<BrowserContext>;

  beforeEach(() => {
    stateManager = new StateManager();

    // Setup mock page
    mockPage = {
      url: jest.fn().mockReturnValue('https://example.com/page'),
      title: jest.fn().mockResolvedValue('Page Title'),
      screenshot: jest.fn().mockResolvedValue(Buffer.from('screenshot')),
      evaluate: jest.fn(),
      context: jest.fn()
    } as any;

    // Setup mock context
    mockContext = {
      cookies: jest.fn().mockResolvedValue([
        { name: 'session', value: 'abc123', domain: 'example.com' }
      ]),
      storageState: jest.fn().mockResolvedValue({
        cookies: [{ name: 'session', value: 'abc123' }],
        origins: []
      }),
      addCookies: jest.fn(),
      clearCookies: jest.fn()
    } as any;

    mockPage.context.mockReturnValue(mockContext);
    jest.clearAllMocks();
  });

  describe('saveState', () => {
    it('should create a state checkpoint', async () => {
      const checkpoint = await stateManager.saveState(mockPage, 'test-checkpoint');

      expect(checkpoint).toBeTruthy();
      expect(checkpoint.name).toBe('test-checkpoint');
      expect(checkpoint.url).toBe('https://example.com/page');
      expect(checkpoint.timestamp).toBeInstanceOf(Date);
    });

    it('should auto-generate checkpoint name if not provided', async () => {
      const checkpoint = await stateManager.saveState(mockPage);

      expect(checkpoint.name).toMatch(/^checkpoint-\d+$/);
    });

    it('should include cookies in state', async () => {
      const checkpoint = await stateManager.saveState(mockPage);

      expect(mockContext.cookies).toHaveBeenCalled();
      expect(checkpoint.cookies).toEqual([
        { name: 'session', value: 'abc123', domain: 'example.com' }
      ]);
    });

    it('should include localStorage if requested', async () => {
      mockPage.evaluate.mockResolvedValue({
        key1: 'value1',
        key2: 'value2'
      });

      const checkpoint = await stateManager.saveState(mockPage, 'checkpoint', {
        includeLocalStorage: true
      });

      expect(checkpoint.localStorage).toEqual({
        key1: 'value1',
        key2: 'value2'
      });
    });

    it('should include sessionStorage if requested', async () => {
      mockPage.evaluate.mockResolvedValue({
        tempKey: 'tempValue'
      });

      const checkpoint = await stateManager.saveState(mockPage, 'checkpoint', {
        includeSessionStorage: true
      });

      expect(checkpoint.sessionStorage).toEqual({
        tempKey: 'tempValue'
      });
    });

    it('should include screenshot if requested', async () => {
      const checkpoint = await stateManager.saveState(mockPage, 'checkpoint', {
        includeScreenshot: true
      });

      expect(mockPage.screenshot).toHaveBeenCalled();
      expect(checkpoint.screenshot).toBeTruthy();
    });

    it('should handle save errors gracefully', async () => {
      mockContext.cookies.mockRejectedValue(new Error('Cannot get cookies'));

      const checkpoint = await stateManager.saveState(mockPage);

      expect(checkpoint).toBeTruthy();
      expect(checkpoint.cookies).toEqual([]);
    });
  });

  describe('restoreState', () => {
    let checkpoint: any;

    beforeEach(async () => {
      checkpoint = await stateManager.saveState(mockPage, 'test-checkpoint');
    });

    it('should restore state from checkpoint', async () => {
      const result = await stateManager.restoreState(mockPage, 'test-checkpoint');

      expect(result).toBe(true);
      expect(mockContext.clearCookies).toHaveBeenCalled();
      expect(mockContext.addCookies).toHaveBeenCalledWith([
        { name: 'session', value: 'abc123', domain: 'example.com' }
      ]);
    });

    it('should navigate to checkpoint URL', async () => {
      const mockGoto = jest.fn();
      mockPage.goto = mockGoto;

      await stateManager.restoreState(mockPage, 'test-checkpoint');

      expect(mockGoto).toHaveBeenCalledWith('https://example.com/page');
    });

    it('should restore localStorage if present', async () => {
      checkpoint.localStorage = { key1: 'value1' };
      
      await stateManager.restoreState(mockPage, 'test-checkpoint');

      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        { key1: 'value1' }
      );
    });

    it('should restore sessionStorage if present', async () => {
      checkpoint.sessionStorage = { tempKey: 'tempValue' };
      
      await stateManager.restoreState(mockPage, 'test-checkpoint');

      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        { tempKey: 'tempValue' }
      );
    });

    it('should return false for non-existent checkpoint', async () => {
      const result = await stateManager.restoreState(mockPage, 'non-existent');

      expect(result).toBe(false);
    });

    it('should handle restore errors', async () => {
      mockContext.addCookies.mockRejectedValue(new Error('Cannot add cookies'));

      const result = await stateManager.restoreState(mockPage, 'test-checkpoint');

      expect(result).toBe(false);
    });
  });

  describe('getState', () => {
    it('should retrieve saved checkpoint', async () => {
      await stateManager.saveState(mockPage, 'checkpoint1');
      
      const state = stateManager.getState('checkpoint1');

      expect(state).toBeTruthy();
      expect(state?.name).toBe('checkpoint1');
    });

    it('should return undefined for non-existent checkpoint', () => {
      const state = stateManager.getState('non-existent');

      expect(state).toBeUndefined();
    });
  });

  describe('deleteState', () => {
    it('should delete checkpoint', async () => {
      await stateManager.saveState(mockPage, 'to-delete');
      
      const result = stateManager.deleteState('to-delete');

      expect(result).toBe(true);
      expect(stateManager.getState('to-delete')).toBeUndefined();
    });

    it('should return false for non-existent checkpoint', () => {
      const result = stateManager.deleteState('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('listStates', () => {
    it('should list all checkpoints', async () => {
      await stateManager.saveState(mockPage, 'checkpoint1');
      await stateManager.saveState(mockPage, 'checkpoint2');

      const states = stateManager.listStates();

      expect(states).toHaveLength(2);
      expect(states[0]).toMatchObject({
        name: 'checkpoint1',
        url: 'https://example.com/page'
      });
      expect(states[1]).toMatchObject({
        name: 'checkpoint2',
        url: 'https://example.com/page'
      });
    });

    it('should return empty array when no checkpoints', () => {
      const states = stateManager.listStates();

      expect(states).toEqual([]);
    });
  });

  describe('clearStates', () => {
    it('should clear all checkpoints', async () => {
      await stateManager.saveState(mockPage, 'checkpoint1');
      await stateManager.saveState(mockPage, 'checkpoint2');

      stateManager.clearStates();

      expect(stateManager.listStates()).toEqual([]);
    });
  });

  describe('exportState', () => {
    it('should export checkpoint as JSON', async () => {
      await stateManager.saveState(mockPage, 'to-export');

      const exported = stateManager.exportState('to-export');
      const parsed = JSON.parse(exported!);

      expect(parsed.name).toBe('to-export');
      expect(parsed.url).toBe('https://example.com/page');
    });

    it('should return null for non-existent checkpoint', () => {
      const exported = stateManager.exportState('non-existent');

      expect(exported).toBeNull();
    });
  });

  describe('importState', () => {
    it('should import checkpoint from JSON', async () => {
      const checkpoint = {
        name: 'imported',
        url: 'https://example.com/imported',
        timestamp: new Date().toISOString(),
        cookies: [],
        localStorage: null,
        sessionStorage: null,
        screenshot: null
      };

      const result = stateManager.importState(JSON.stringify(checkpoint));

      expect(result).toBe(true);
      expect(stateManager.getState('imported')).toBeTruthy();
    });

    it('should handle invalid JSON', () => {
      const result = stateManager.importState('invalid json');

      expect(result).toBe(false);
    });

    it('should validate required fields', () => {
      const invalidCheckpoint = {
        // Missing required fields
        timestamp: new Date().toISOString()
      };

      const result = stateManager.importState(JSON.stringify(invalidCheckpoint));

      expect(result).toBe(false);
    });
  });

  describe('saveToFile', () => {
    it('should save checkpoint to file', async () => {
      await stateManager.saveState(mockPage, 'to-save');

      await stateManager.saveToFile('to-save', '/tmp/checkpoint.json');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/tmp/checkpoint.json',
        expect.any(String)
      );
    });

    it('should throw error for non-existent checkpoint', async () => {
      await expect(stateManager.saveToFile('non-existent', '/tmp/file.json'))
        .rejects.toThrow('State not found: non-existent');
    });
  });

  describe('loadFromFile', () => {
    it('should load checkpoint from file', async () => {
      const checkpoint = {
        name: 'from-file',
        url: 'https://example.com',
        timestamp: new Date().toISOString(),
        cookies: [],
        localStorage: null,
        sessionStorage: null,
        screenshot: null
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(checkpoint));

      const result = await stateManager.loadFromFile('/tmp/checkpoint.json');

      expect(result).toBe(true);
      expect(stateManager.getState('from-file')).toBeTruthy();
    });

    it('should handle file read errors', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await stateManager.loadFromFile('/tmp/missing.json');

      expect(result).toBe(false);
    });

    it('should handle invalid file content', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('invalid json');

      const result = await stateManager.loadFromFile('/tmp/invalid.json');

      expect(result).toBe(false);
    });
  });

  describe('compareStates', () => {
    it('should compare two checkpoints', async () => {
      await stateManager.saveState(mockPage, 'state1');
      
      // Change URL for second state
      mockPage.url.mockReturnValue('https://example.com/different');
      await stateManager.saveState(mockPage, 'state2');

      const diff = stateManager.compareStates('state1', 'state2');

      expect(diff).toBeTruthy();
      expect(diff?.urlChanged).toBe(true);
      expect(diff?.cookiesChanged).toBe(false);
    });

    it('should detect cookie changes', async () => {
      await stateManager.saveState(mockPage, 'state1');
      
      mockContext.cookies.mockResolvedValue([
        { name: 'session', value: 'xyz789', domain: 'example.com' }
      ]);
      await stateManager.saveState(mockPage, 'state2');

      const diff = stateManager.compareStates('state1', 'state2');

      expect(diff?.cookiesChanged).toBe(true);
      expect(diff?.cookieDiff).toBeTruthy();
    });

    it('should return null for non-existent states', () => {
      const diff = stateManager.compareStates('non-existent1', 'non-existent2');

      expect(diff).toBeNull();
    });
  });

  describe('rollback', () => {
    it('should rollback to previous state', async () => {
      await stateManager.saveState(mockPage, 'state1');
      await stateManager.saveState(mockPage, 'state2');
      await stateManager.saveState(mockPage, 'state3');

      const mockGoto = jest.fn();
      mockPage.goto = mockGoto;

      const result = await stateManager.rollback(mockPage);

      expect(result).toBe(true);
      expect(stateManager.getState('state3')).toBeUndefined();
      expect(mockGoto).toHaveBeenCalled();
    });

    it('should rollback multiple steps', async () => {
      await stateManager.saveState(mockPage, 'state1');
      await stateManager.saveState(mockPage, 'state2');
      await stateManager.saveState(mockPage, 'state3');

      const mockGoto = jest.fn();
      mockPage.goto = mockGoto;

      const result = await stateManager.rollback(mockPage, 2);

      expect(result).toBe(true);
      expect(stateManager.listStates()).toHaveLength(1);
      expect(stateManager.getState('state1')).toBeTruthy();
    });

    it('should return false when no states to rollback', async () => {
      const result = await stateManager.rollback(mockPage);

      expect(result).toBe(false);
    });
  });
});