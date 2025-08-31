/**
 * Unit tests for response formatter
 */

import { formatResponse, formatError, formatSuccess, compressResponse } from '../../src/utils/responseFormatter';

describe('ResponseFormatter', () => {
  describe('formatResponse', () => {
    it('should remove null and undefined values', () => {
      const input = {
        success: true,
        action: 'test',
        value: null,
        error: undefined,
        timestamp: 123456,
      };

      const result = formatResponse(input as any);
      
      expect(result).toEqual({
        success: true,
        action: 'test',
        timestamp: 123456,
      });
      expect(result).not.toHaveProperty('value');
      expect(result).not.toHaveProperty('error');
    });

    it('should keep falsy values that are not null/undefined', () => {
      const input = {
        success: false,
        action: 'test',
        value: 0,
        error: '',
        timestamp: 0,
      };

      const result = formatResponse(input as any);
      
      expect(result).toEqual(input);
    });
  });

  describe('formatError', () => {
    it('should format error from Error object', () => {
      const error = new Error('Test error');
      const result = formatError(error, 'testAction');

      expect(result.success).toBe(false);
      expect(result.action).toBe('testAction');
      expect(result.error).toBe('Test error');
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should format error from string', () => {
      const result = formatError('String error', 'testAction');

      expect(result.success).toBe(false);
      expect(result.action).toBe('testAction');
      expect(result.error).toBe('String error');
    });
  });

  describe('formatSuccess', () => {
    it('should create success response with minimal fields', () => {
      const result = formatSuccess('testAction');

      expect(result.success).toBe(true);
      expect(result.action).toBe('testAction');
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result).not.toHaveProperty('value');
      expect(result).not.toHaveProperty('target');
    });

    it('should include optional value and target', () => {
      const result = formatSuccess('testAction', { data: 'test' }, 'button');

      expect(result.success).toBe(true);
      expect(result.value).toEqual({ data: 'test' });
      expect(result.target).toBe('button');
    });
  });

  describe('compressResponse', () => {
    it('should not compress small responses', () => {
      const data = { test: 'small data' };
      const result = compressResponse(data);

      expect(result.result).toEqual(data);
      expect(result.compressed).toBe(false);
      expect(result.size).toBeLessThan(1024);
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(2000);
      const result = compressResponse(longString);

      expect(result.compressed).toBe(true);
      expect(result.result).toContain('[truncated]');
      expect(result.result.length).toBeLessThan(1100);
    });

    it('should limit array length', () => {
      const longArray = Array(100).fill('item');
      const result = compressResponse(longArray, 50); // Force compression with small maxSize

      expect(result.compressed).toBe(true);
      expect(Array.isArray(result.result)).toBe(true);
      expect(result.result.length).toBe(10);
    });

    it('should keep only essential fields for objects', () => {
      const largeObject = {
        success: true,
        action: 'test',
        metadata: { large: 'data'.repeat(500) },
        extra: 'field',
        value: 'important',
        url: 'https://example.com',
      };

      const result = compressResponse(largeObject, 100);

      expect(result.compressed).toBe(true);
      expect(result.result).toHaveProperty('success');
      expect(result.result).toHaveProperty('action');
      expect(result.result).toHaveProperty('value');
      expect(result.result).toHaveProperty('url');
      expect(result.result).not.toHaveProperty('metadata');
      expect(result.result).not.toHaveProperty('extra');
    });
  });
});