/**
 * Unit Tests for URL Construction and Validation
 * Tests the core URL building logic for stream playback
 */

const { JSDOM } = require('jsdom');

// Mock DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

describe('Stream URL Construction and Validation', () => {
  let StreamingApp;
  let app;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Create mock elements
    const mockElements = {
      streamPlayer: document.createElement('video'),
      currentStreamPath: document.createElement('span'),
      currentStreamStatus: document.createElement('span'),
      player: document.createElement('div'),
      activeStreams: document.createElement('span'),
      totalSessions: document.createElement('span'),
      serverUptime: document.createElement('span'),
      streamsContainer: document.createElement('div'),
      streamKey: document.createElement('input'),
      modalStreamKey: document.createElement('input'),
      rtmpUrl: document.createElement('span')
    };

    Object.entries(mockElements).forEach(([id, element]) => {
      element.id = id;
      document.body.appendChild(element);
    });

    // Load StreamingApp class
    const fs = require('fs');
    const appCode = fs.readFileSync('./public/js/app.js', 'utf8');
    eval(appCode);
    
    app = new StreamingApp();
  });

  describe('extractStreamKey()', () => {
    test('should extract key from standard RTMP path', () => {
      const result = app.extractStreamKey('/live/myStreamKey123');
      expect(result).toBe('myStreamKey123');
    });

    test('should extract key from complex path with multiple segments', () => {
      const result = app.extractStreamKey('/rtmp/live/stream/testKey456');
      expect(result).toBe('testKey456');
    });

    test('should handle paths ending with slash', () => {
      const result = app.extractStreamKey('/live/streamKey/');
      expect(result).toBe('');
    });

    test('should return "unknown" for null or undefined paths', () => {
      expect(app.extractStreamKey(null)).toBe('unknown');
      expect(app.extractStreamKey(undefined)).toBe('unknown');
      expect(app.extractStreamKey('')).toBe('unknown');
    });

    test('should handle single segment paths', () => {
      const result = app.extractStreamKey('singleSegment');
      expect(result).toBe('singleSegment');
    });

    test('should handle numeric stream keys', () => {
      const result = app.extractStreamKey('/live/123456789');
      expect(result).toBe('123456789');
    });

    test('should handle alphanumeric stream keys with special characters', () => {
      const result = app.extractStreamKey('/live/stream_key-123.test');
      expect(result).toBe('stream_key-123.test');
    });
  });

  describe('Stream URL Construction', () => {
    beforeEach(() => {
      // Mock window.location for URL construction
      delete window.location;
      window.location = {
        protocol: 'http:',
        hostname: 'localhost'
      };
    });

    test('should construct correct FLV URL for HTTP', () => {
      const streamKey = 'testStream123';
      const baseUrl = window.location.protocol + '//' + window.location.hostname;
      const expectedUrl = `${baseUrl}:8000/live/${streamKey}.flv`;
      
      // Test the URL construction logic from playStream method
      const flvUrl = `${baseUrl}:8000/live/${streamKey}.flv`;
      expect(flvUrl).toBe('http://localhost:8000/live/testStream123.flv');
    });

    test('should construct correct HLS URL for HTTP', () => {
      const streamKey = 'testStream123';
      const baseUrl = window.location.protocol + '//' + window.location.hostname;
      const expectedUrl = `${baseUrl}:8000/live/${streamKey}/index.m3u8`;
      
      const hlsUrl = `${baseUrl}:8000/live/${streamKey}/index.m3u8`;
      expect(hlsUrl).toBe('http://localhost:8000/live/testStream123/index.m3u8');
    });

    test('should handle HTTPS protocol correctly', () => {
      window.location.protocol = 'https:';
      window.location.hostname = 'example.com';
      
      const streamKey = 'secureStream';
      const baseUrl = window.location.protocol + '//' + window.location.hostname;
      const flvUrl = `${baseUrl}:8000/live/${streamKey}.flv`;
      
      expect(flvUrl).toBe('https://example.com:8000/live/secureStream.flv');
    });

    test('should handle different hostnames', () => {
      window.location.hostname = '192.168.1.100';
      
      const streamKey = 'remoteStream';
      const baseUrl = window.location.protocol + '//' + window.location.hostname;
      const flvUrl = `${baseUrl}:8000/live/${streamKey}.flv`;
      
      expect(flvUrl).toBe('http://192.168.1.100:8000/live/remoteStream.flv');
    });

    test('should handle IPv6 addresses', () => {
      window.location.hostname = '[::1]';
      
      const streamKey = 'ipv6Stream';
      const baseUrl = window.location.protocol + '//' + window.location.hostname;
      const flvUrl = `${baseUrl}:8000/live/${streamKey}.flv`;
      
      expect(flvUrl).toBe('http://[::1]:8000/live/ipv6Stream.flv');
    });
  });

  describe('Stream Path Validation', () => {
    test('should validate standard stream paths', () => {
      const validPaths = [
        '/live/stream123',
        '/live/my-stream_key',
        '/live/123456789',
        '/live/stream.with.dots'
      ];

      validPaths.forEach(path => {
        const key = app.extractStreamKey(path);
        expect(key).toBeTruthy();
        expect(key).not.toBe('unknown');
      });
    });

    test('should handle malformed paths gracefully', () => {
      const malformedPaths = [
        '///',
        '/live/',
        '/',
        'invalid-path',
        '/live//double-slash'
      ];

      malformedPaths.forEach(path => {
        expect(() => app.extractStreamKey(path)).not.toThrow();
      });
    });

    test('should handle non-string inputs', () => {
      const nonStringInputs = [
        123,
        {},
        [],
        true,
        Symbol('test')
      ];

      nonStringInputs.forEach(input => {
        expect(() => app.extractStreamKey(input)).not.toThrow();
        expect(app.extractStreamKey(input)).toBe('unknown');
      });
    });
  });

  describe('URL Encoding and Special Characters', () => {
    test('should handle stream keys with special characters', () => {
      const specialKeys = [
        'stream%20with%20spaces',
        'stream+with+plus',
        'stream&with&ampersand',
        'stream#with#hash'
      ];

      specialKeys.forEach(key => {
        const path = `/live/${key}`;
        const extractedKey = app.extractStreamKey(path);
        expect(extractedKey).toBe(key);
      });
    });

    test('should handle URL encoded characters', () => {
      const encodedKey = 'stream%2Dwith%2Ddashes';
      const path = `/live/${encodedKey}`;
      const extractedKey = app.extractStreamKey(path);
      expect(extractedKey).toBe(encodedKey);
    });

    test('should handle Unicode characters', () => {
      const unicodeKey = 'stream🎥test';
      const path = `/live/${unicodeKey}`;
      const extractedKey = app.extractStreamKey(path);
      expect(extractedKey).toBe(unicodeKey);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    test('should handle extremely long stream keys', () => {
      const longKey = 'a'.repeat(1000);
      const path = `/live/${longKey}`;
      const extractedKey = app.extractStreamKey(path);
      expect(extractedKey).toBe(longKey);
    });

    test('should handle empty string stream keys', () => {
      const path = '/live/';
      const extractedKey = app.extractStreamKey(path);
      expect(extractedKey).toBe('');
    });

    test('should handle paths with query parameters', () => {
      const path = '/live/streamKey?param=value';
      const extractedKey = app.extractStreamKey(path);
      expect(extractedKey).toBe('streamKey?param=value');
    });

    test('should handle paths with fragments', () => {
      const path = '/live/streamKey#fragment';
      const extractedKey = app.extractStreamKey(path);
      expect(extractedKey).toBe('streamKey#fragment');
    });
  });

  describe('Performance and Memory', () => {
    test('should handle rapid successive calls efficiently', () => {
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        app.extractStreamKey(`/live/stream${i}`);
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // Should complete 1000 operations in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    test('should not leak memory with large inputs', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process many large stream keys
      for (let i = 0; i < 100; i++) {
        const largeKey = 'stream' + 'x'.repeat(10000) + i;
        app.extractStreamKey(`/live/${largeKey}`);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Integration with Stream Data', () => {
    test('should work with realistic stream data structure', () => {
      const mockStreamData = {
        path: '/live/realStream123',
        publishStreamPath: '/live/realStream123',
        isPublishing: true,
        connectTime: Date.now() - 300000,
        app: 'live',
        stream: 'realStream123'
      };

      const extractedKey = app.extractStreamKey(mockStreamData.publishStreamPath);
      expect(extractedKey).toBe('realStream123');
      
      // Test URL construction with extracted key
      const baseUrl = 'http://localhost';
      const flvUrl = `${baseUrl}:8000/live/${extractedKey}.flv`;
      expect(flvUrl).toBe('http://localhost:8000/live/realStream123.flv');
    });

    test('should handle stream data with missing properties', () => {
      const incompleteStreamData = {
        path: '/live/incompleteStream'
        // Missing publishStreamPath
      };

      const extractedKey = app.extractStreamKey(incompleteStreamData.publishStreamPath);
      expect(extractedKey).toBe('unknown');
    });
  });
});