/**
 * Mock Stream Data Tests
 * Tests stream data validation and mock API responses
 */

const { JSDOM } = require('jsdom');

// Mock DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000'
});

global.window = dom.window;
global.document = dom.window.document;
global.fetch = jest.fn();

describe('Stream Data Mocks and Validation', () => {
  let StreamingApp;
  let app;

  // Mock stream data that matches API response format
  const mockStreamData = {
    success: true,
    streams: [
      {
        path: '/live/testStream001',
        publishStreamPath: '/live/testStream001',
        isPublishing: true,
        connectTime: Date.now() - 300000, // 5 minutes ago
        app: 'live',
        stream: 'testStream001',
        clientId: 'client_123',
        bytes: 1024000,
        duration: 300
      },
      {
        path: '/live/testStream002',
        publishStreamPath: '/live/testStream002',
        isPublishing: false,
        connectTime: Date.now() - 600000, // 10 minutes ago
        app: 'live',
        stream: 'testStream002',
        clientId: 'client_456',
        bytes: 2048000,
        duration: 600
      }
    ]
  };

  const mockStatsData = {
    success: true,
    stats: {
      publishingSessions: 1,
      totalSessions: 5,
      uptime: 86400, // 24 hours in seconds
      inBytes: 1024000,
      outBytes: 2048000,
      activeSessions: 1
    }
  };

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Create required DOM elements
    const elements = [
      'streamPlayer', 'currentStreamPath', 'currentStreamStatus', 'player',
      'activeStreams', 'totalSessions', 'serverUptime', 'streamsContainer',
      'streamKey', 'modalStreamKey', 'rtmpUrl'
    ];

    elements.forEach(id => {
      const element = document.createElement(id === 'streamPlayer' ? 'video' : 'div');
      element.id = id;
      document.body.appendChild(element);
    });

    // Load StreamingApp
    const fs = require('fs');
    const appCode = fs.readFileSync('./public/js/app.js', 'utf8');
    eval(appCode);
    
    app = new StreamingApp();
    
    // Reset fetch mock
    fetch.mockClear();
  });

  describe('Stream Data Structure Validation', () => {
    test('should validate complete stream object structure', () => {
      const stream = mockStreamData.streams[0];
      
      // Required properties
      expect(stream).toHaveProperty('path');
      expect(stream).toHaveProperty('publishStreamPath');
      expect(stream).toHaveProperty('isPublishing');
      expect(stream).toHaveProperty('connectTime');
      expect(stream).toHaveProperty('app');
      expect(stream).toHaveProperty('stream');
      
      // Type validation
      expect(typeof stream.path).toBe('string');
      expect(typeof stream.publishStreamPath).toBe('string');
      expect(typeof stream.isPublishing).toBe('boolean');
      expect(typeof stream.connectTime).toBe('number');
      expect(typeof stream.app).toBe('string');
      expect(typeof stream.stream).toBe('string');
    });

    test('should validate stats object structure', () => {
      const stats = mockStatsData.stats;
      
      expect(stats).toHaveProperty('publishingSessions');
      expect(stats).toHaveProperty('totalSessions');
      expect(stats).toHaveProperty('uptime');
      
      expect(typeof stats.publishingSessions).toBe('number');
      expect(typeof stats.totalSessions).toBe('number');
      expect(typeof stats.uptime).toBe('number');
    });

    test('should handle streams with missing optional properties', () => {
      const minimalStream = {
        path: '/live/minimal',
        publishStreamPath: '/live/minimal',
        isPublishing: true,
        connectTime: Date.now()
      };

      expect(() => app.extractStreamKey(minimalStream.publishStreamPath)).not.toThrow();
      expect(app.extractStreamKey(minimalStream.publishStreamPath)).toBe('minimal');
    });

    test('should validate stream with extra properties', () => {
      const extendedStream = {
        ...mockStreamData.streams[0],
        extraProperty: 'should not break validation',
        metadata: { quality: '1080p', fps: 30 }
      };

      expect(() => app.extractStreamKey(extendedStream.publishStreamPath)).not.toThrow();
      expect(app.extractStreamKey(extendedStream.publishStreamPath)).toBe('testStream001');
    });
  });

  describe('Duration and Time Calculations', () => {
    test('should calculate stream duration correctly', () => {
      const stream = mockStreamData.streams[0];
      const duration = Date.now() - stream.connectTime;
      const formatted = app.formatDuration(duration);
      
      // Should be in MM:SS or HH:MM:SS format
      expect(formatted).toMatch(/^\d{1,2}:\d{2}(:\d{2})?$/);
    });

    test('should format uptime correctly', () => {
      const uptime = mockStatsData.stats.uptime;
      const formatted = app.formatUptime(uptime);
      
      // Should be in "Xh Ym" format
      expect(formatted).toMatch(/^\d+h \d+m$/);
      expect(formatted).toBe('24h 0m');
    });

    test('should handle zero duration', () => {
      const formatted = app.formatDuration(0);
      expect(formatted).toBe('0:00');
    });

    test('should handle large durations', () => {
      const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const formatted = app.formatDuration(oneDay);
      expect(formatted).toBe('24:00:00');
    });

    test('should handle negative durations gracefully', () => {
      expect(() => app.formatDuration(-1000)).not.toThrow();
    });
  });

  describe('Stream Card Creation', () => {
    test('should create stream card HTML with correct data', () => {
      const stream = mockStreamData.streams[0];
      const cardHtml = app.createStreamCard(stream);
      
      expect(cardHtml).toContain('testStream001');
      expect(cardHtml).toContain('🔴 LIVE');
      expect(cardHtml).toContain('btn-primary');
      expect(cardHtml).toContain('onclick="app.playStream');
    });

    test('should create card for offline stream', () => {
      const stream = mockStreamData.streams[1];
      const cardHtml = app.createStreamCard(stream);
      
      expect(cardHtml).toContain('testStream002');
      expect(cardHtml).not.toContain('🔴 LIVE');
      expect(cardHtml).toContain('status-offline');
    });

    test('should include all required buttons', () => {
      const stream = mockStreamData.streams[0];
      const cardHtml = app.createStreamCard(stream);
      
      expect(cardHtml).toContain('Watch');
      expect(cardHtml).toContain('VLC');
      expect(cardHtml).toContain('Copy URL');
      expect(cardHtml).toContain('Stop');
    });

    test('should construct correct FLV URL in card', () => {
      const stream = mockStreamData.streams[0];
      const cardHtml = app.createStreamCard(stream);
      
      expect(cardHtml).toContain('localhost:8000/live/testStream001.flv');
    });
  });

  describe('API Response Mocking', () => {
    test('should handle successful streams API response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStreamData)
      });

      await app.refreshStreams();
      
      expect(fetch).toHaveBeenCalledWith('/api/streams');
    });

    test('should handle successful stats API response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatsData)
      });

      await app.loadStats();
      
      expect(fetch).toHaveBeenCalledWith('/api/stats');
      expect(document.getElementById('activeStreams').textContent).toBe('1');
      expect(document.getElementById('totalSessions').textContent).toBe('5');
    });

    test('should handle API error responses', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(app.refreshStreams()).resolves.not.toThrow();
      await expect(app.loadStats()).resolves.not.toThrow();
    });

    test('should handle malformed JSON responses', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(app.refreshStreams()).resolves.not.toThrow();
    });

    test('should handle 404 responses', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ success: false, error: 'Not found' })
      });

      await expect(app.refreshStreams()).resolves.not.toThrow();
    });
  });

  describe('Stream List Updates', () => {
    test('should update streams list with mock data', () => {
      app.updateStreamsList(mockStreamData.streams);
      
      const container = document.getElementById('streamsContainer');
      expect(container.innerHTML).toContain('testStream001');
      expect(container.innerHTML).toContain('testStream002');
    });

    test('should handle empty streams list', () => {
      app.updateStreamsList([]);
      
      const container = document.getElementById('streamsContainer');
      expect(container.innerHTML).toContain('No active streams');
    });

    test('should handle null streams list', () => {
      app.updateStreamsList(null);
      
      const container = document.getElementById('streamsContainer');
      expect(container.innerHTML).toContain('No active streams');
    });

    test('should handle undefined streams list', () => {
      app.updateStreamsList(undefined);
      
      const container = document.getElementById('streamsContainer');
      expect(container.innerHTML).toContain('No active streams');
    });
  });

  describe('Stream State Management', () => {
    test('should add stream to internal state', () => {
      const streamData = {
        streamPath: '/live/testAdd',
        isPublishing: true
      };

      app.addStream(streamData);
      expect(app.streams.has('/live/testAdd')).toBe(true);
    });

    test('should remove stream from internal state', () => {
      const streamData = {
        streamPath: '/live/testRemove',
        isPublishing: true
      };

      app.addStream(streamData);
      expect(app.streams.has('/live/testRemove')).toBe(true);
      
      app.removeStream(streamData);
      expect(app.streams.has('/live/testRemove')).toBe(false);
    });

    test('should stop current stream when removed', () => {
      const streamData = {
        streamPath: '/live/currentStream',
        isPublishing: true
      };

      app.currentStream = '/live/currentStream';
      app.removeStream(streamData);
      
      // Player should be hidden
      expect(document.getElementById('player').style.display).toBe('none');
      expect(app.currentStream).toBeNull();
    });
  });

  describe('Error Handling with Mock Data', () => {
    test('should handle streams with invalid timestamps', () => {
      const invalidStream = {
        ...mockStreamData.streams[0],
        connectTime: 'invalid-timestamp'
      };

      expect(() => app.createStreamCard(invalidStream)).not.toThrow();
    });

    test('should handle streams with missing path', () => {
      const streamWithoutPath = {
        isPublishing: true,
        connectTime: Date.now()
      };

      expect(() => app.createStreamCard(streamWithoutPath)).not.toThrow();
    });

    test('should handle stats with negative values', () => {
      const negativeStats = {
        publishingSessions: -1,
        totalSessions: -5,
        uptime: -100
      };

      expect(() => app.updateStats(negativeStats)).not.toThrow();
    });

    test('should handle stats with non-numeric values', () => {
      const invalidStats = {
        publishingSessions: 'not-a-number',
        totalSessions: null,
        uptime: undefined
      };

      expect(() => app.updateStats(invalidStats)).not.toThrow();
    });
  });

  describe('Mock Data Generation Helpers', () => {
    test('should generate realistic test stream data', () => {
      const generateMockStream = (streamKey, isLive = true) => ({
        path: `/live/${streamKey}`,
        publishStreamPath: `/live/${streamKey}`,
        isPublishing: isLive,
        connectTime: Date.now() - Math.random() * 3600000, // Random time up to 1 hour ago
        app: 'live',
        stream: streamKey,
        clientId: `client_${Math.random().toString(36).substr(2, 9)}`
      });

      const mockStream = generateMockStream('generated123');
      
      expect(mockStream.path).toBe('/live/generated123');
      expect(mockStream.stream).toBe('generated123');
      expect(typeof mockStream.connectTime).toBe('number');
      expect(mockStream.clientId).toMatch(/^client_[a-z0-9]+$/);
    });

    test('should generate mock stats with realistic values', () => {
      const generateMockStats = (activeStreams = 0) => ({
        publishingSessions: activeStreams,
        totalSessions: activeStreams + Math.floor(Math.random() * 50),
        uptime: Math.floor(Math.random() * 86400 * 7), // Up to 1 week
        inBytes: Math.floor(Math.random() * 1000000000), // Up to 1GB
        outBytes: Math.floor(Math.random() * 1000000000)
      });

      const mockStats = generateMockStats(3);
      
      expect(mockStats.publishingSessions).toBe(3);
      expect(mockStats.totalSessions).toBeGreaterThanOrEqual(3);
      expect(typeof mockStats.uptime).toBe('number');
    });
  });

  describe('Performance with Mock Data', () => {
    test('should handle large number of streams efficiently', () => {
      const manyStreams = Array.from({ length: 100 }, (_, i) => ({
        path: `/live/stream${i}`,
        publishStreamPath: `/live/stream${i}`,
        isPublishing: i % 2 === 0,
        connectTime: Date.now() - i * 1000,
        app: 'live',
        stream: `stream${i}`
      }));

      const start = performance.now();
      app.updateStreamsList(manyStreams);
      const end = performance.now();

      expect(end - start).toBeLessThan(1000); // Should complete in less than 1 second
    });

    test('should handle rapid state updates', () => {
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        const streamData = {
          streamPath: `/live/rapid${i}`,
          isPublishing: true
        };
        app.addStream(streamData);
        app.removeStream(streamData);
      }
      
      const end = performance.now();
      expect(end - start).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });
});