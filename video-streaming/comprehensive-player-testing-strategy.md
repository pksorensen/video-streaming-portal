# Comprehensive Player Testing Strategy

## Overview
This document outlines a comprehensive testing strategy for the video streaming platform's player URL validation and functionality. The testing strategy covers unit tests, integration tests, end-to-end tests, and performance validation.

## Testing Scope

### 1. Play Button Functionality
- Button click event handling
- UI state changes during playback
- Error state handling
- Loading state management
- Stream status updates

### 2. URL Construction & Validation
- Stream key extraction from paths
- Base URL construction logic
- Port number validation (8000 for FLV)
- Protocol handling (HTTP/HTTPS)
- Multiple format URL generation (FLV, HLS)

### 3. Player Integration
- Video.js initialization
- FLV.js plugin functionality
- Fallback mechanism testing
- Stream source loading
- Error recovery processes

### 4. Stream Data Validation
- API response format validation
- Stream metadata parsing
- Live status verification
- Duration calculation accuracy
- Connection status tracking

## Test Implementation Plan

### Phase 1: Unit Tests for URL Construction

#### Test Cases for `extractStreamKey()`
```javascript
describe('Stream Key Extraction', () => {
  test('should extract key from standard path', () => {
    const result = app.extractStreamKey('/live/myStreamKey123');
    expect(result).toBe('myStreamKey123');
  });

  test('should handle paths with multiple segments', () => {
    const result = app.extractStreamKey('/rtmp/live/stream/testKey456');
    expect(result).toBe('testKey456');
  });

  test('should return "unknown" for invalid paths', () => {
    expect(app.extractStreamKey('')).toBe('unknown');
    expect(app.extractStreamKey(null)).toBe('unknown');
    expect(app.extractStreamKey(undefined)).toBe('unknown');
  });
});
```

#### Test Cases for URL Construction
```javascript
describe('Stream URL Construction', () => {
  test('should construct correct FLV URL', () => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { protocol: 'http:', hostname: 'localhost' }
    });
    
    const streamKey = 'testStream123';
    const expectedUrl = 'http://localhost:8000/live/testStream123.flv';
    const actualUrl = constructFlvUrl(streamKey);
    expect(actualUrl).toBe(expectedUrl);
  });

  test('should handle HTTPS protocol', () => {
    Object.defineProperty(window, 'location', {
      value: { protocol: 'https:', hostname: 'example.com' }
    });
    
    const streamKey = 'secureStream';
    const expectedUrl = 'https://example.com:8000/live/secureStream.flv';
    const actualUrl = constructFlvUrl(streamKey);
    expect(actualUrl).toBe(expectedUrl);
  });
});
```

### Phase 2: Mock Stream Data Testing

#### Mock API Responses
```javascript
const mockStreamData = {
  success: true,
  streams: [
    {
      path: '/live/testStream001',
      publishStreamPath: '/live/testStream001',
      isPublishing: true,
      connectTime: Date.now() - 300000, // 5 minutes ago
      app: 'live',
      stream: 'testStream001'
    }
  ]
};

const mockStreamStats = {
  success: true,
  stats: {
    publishingSessions: 1,
    totalSessions: 5,
    uptime: 86400 // 24 hours in seconds
  }
};
```

#### API Response Validation Tests
```javascript
describe('Stream Data Validation', () => {
  test('should validate stream data structure', () => {
    const stream = mockStreamData.streams[0];
    
    expect(stream).toHaveProperty('path');
    expect(stream).toHaveProperty('publishStreamPath');
    expect(stream).toHaveProperty('isPublishing');
    expect(stream).toHaveProperty('connectTime');
    expect(typeof stream.isPublishing).toBe('boolean');
    expect(typeof stream.connectTime).toBe('number');
  });

  test('should calculate duration correctly', () => {
    const stream = mockStreamData.streams[0];
    const duration = Date.now() - stream.connectTime;
    const formatted = app.formatDuration(duration);
    
    expect(formatted).toMatch(/^\d{1,2}:\d{2}$/); // MM:SS format
  });
});
```

### Phase 3: Player Integration Testing

#### Video.js Player Tests
```javascript
describe('Video Player Integration', () => {
  let mockPlayer;
  
  beforeEach(() => {
    // Mock Video.js player
    mockPlayer = {
      ready: jest.fn(callback => callback()),
      reset: jest.fn(),
      src: jest.fn(),
      play: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      one: jest.fn()
    };
    
    window.videojs = jest.fn(() => mockPlayer);
  });

  test('should initialize player with correct configuration', () => {
    app.initPlayer();
    
    expect(window.videojs).toHaveBeenCalledWith('streamPlayer', 
      expect.objectContaining({
        fluid: true,
        responsive: true,
        plugins: expect.objectContaining({
          flvjs: expect.any(Object)
        })
      })
    );
  });

  test('should load stream sources correctly', async () => {
    const streamKey = 'testStream123';
    const expectedSources = [
      {
        src: 'http://localhost:8000/live/testStream123.flv',
        type: 'video/x-flv'
      },
      {
        src: 'http://localhost:8000/live/testStream123/index.m3u8',
        type: 'application/x-mpegURL'
      }
    ];

    app.player = mockPlayer;
    app.playStream('/live/testStream123');

    expect(mockPlayer.src).toHaveBeenCalledWith(expectedSources);
  });
});
```

#### FLV.js Fallback Tests
```javascript
describe('FLV.js Fallback Mechanism', () => {
  let mockFlvPlayer;

  beforeEach(() => {
    mockFlvPlayer = {
      attachMediaElement: jest.fn(),
      load: jest.fn(),
      play: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn()
    };

    window.flvjs = {
      createPlayer: jest.fn(() => mockFlvPlayer),
      Events: {
        LOADING_COMPLETE: 'loading_complete',
        ERROR: 'error'
      }
    };
  });

  test('should create FLV player when Video.js fails', () => {
    const flvUrl = 'http://localhost:8000/live/testStream.flv';
    
    app.tryDirectFLV(flvUrl);

    expect(window.flvjs.createPlayer).toHaveBeenCalledWith({
      type: 'flv',
      url: flvUrl,
      isLive: true,
      cors: true,
      withCredentials: false
    });
  });

  test('should handle FLV.js errors gracefully', () => {
    const flvUrl = 'http://localhost:8000/live/testStream.flv';
    
    app.tryDirectFLV(flvUrl);
    
    // Simulate error event
    const errorCallback = mockFlvPlayer.on.mock.calls
      .find(call => call[0] === window.flvjs.Events.ERROR)[1];
    
    expect(() => errorCallback('NetworkError', 'Connection failed')).not.toThrow();
  });
});
```

### Phase 4: End-to-End Testing with Real Streams

#### Enhanced Stream Simulator Tests
```javascript
describe('E2E Player Testing with Real Streams', () => {
  let streamSimulator;
  let page;

  beforeAll(async () => {
    streamSimulator = new StreamSimulator();
  });

  afterAll(async () => {
    await streamSimulator.cleanup();
  });

  test('should play stream immediately when available', async () => {
    const streamKey = 'e2e-test-001';
    
    // Start real stream
    await streamSimulator.startStream(streamKey, {
      duration: 60,
      quality: '720p'
    });

    // Wait for stream to be available
    await streamSimulator.waitForStreamStart(streamKey);

    // Navigate to page and click play
    await page.goto('/');
    await page.waitForSelector(`[data-stream-key="${streamKey}"]`);
    await page.click(`[data-stream-key="${streamKey}"] .btn-play`);

    // Verify player loads
    await page.waitForSelector('#player:not([style*="display: none"])', {
      timeout: 10000
    });

    // Verify stream status
    const status = await page.textContent('#currentStreamStatus');
    expect(['Loading...', 'Connecting...', 'Ready', 'Playing']).toContain(status);
  });

  test('should handle stream URL validation errors', async () => {
    const invalidStreamKey = 'nonexistent-stream';
    
    await page.goto('/');
    
    // Try to play non-existent stream
    await page.evaluate((key) => {
      window.app.playStream(`/live/${key}`);
    }, invalidStreamKey);

    // Should show error state
    await page.waitForSelector('.alert-danger', { timeout: 15000 });
    
    const errorMessage = await page.textContent('.alert-danger');
    expect(errorMessage).toContain('error');
  });
});
```

### Phase 5: Browser Compatibility Testing

#### Cross-Browser Player Tests
```javascript
describe('Cross-Browser Compatibility', () => {
  const browsers = ['chromium', 'firefox', 'webkit'];
  
  browsers.forEach(browserName => {
    test(`should work in ${browserName}`, async () => {
      const { browser, page } = await setupBrowser(browserName);
      
      try {
        await page.goto('/');
        
        // Test basic functionality
        await page.click('button[onclick*="generateStreamKey"]');
        const streamKey = await page.inputValue('#streamKey');
        expect(streamKey).toBeTruthy();
        
        // Test player initialization
        await page.evaluate(() => window.app.initPlayer());
        await page.waitForSelector('.video-js');
        
        // Verify Video.js loaded
        const videoJsLoaded = await page.evaluate(() => 
          typeof window.videojs !== 'undefined'
        );
        expect(videoJsLoaded).toBe(true);
        
      } finally {
        await browser.close();
      }
    });
  });
});
```

### Phase 6: Performance & Load Testing

#### Stream Load Testing
```javascript
describe('Performance Testing', () => {
  test('should handle multiple concurrent streams', async () => {
    const streamKeys = Array.from({length: 5}, (_, i) => `load-test-${i}`);
    
    // Start multiple streams simultaneously
    const streamPromises = streamKeys.map(key => 
      streamSimulator.startStream(key, { duration: 30 })
    );
    
    await Promise.all(streamPromises);
    
    // Navigate to dashboard
    await page.goto('/');
    
    // Verify all streams appear
    for (const key of streamKeys) {
      await page.waitForSelector(`[data-stream-key="${key}"]`);
    }
    
    // Check performance metrics
    const metrics = await page.evaluate(() => performance.now());
    expect(metrics).toBeLessThan(5000); // Page should load in < 5s
  });

  test('should maintain responsiveness during playback', async () => {
    const streamKey = 'performance-test';
    
    await streamSimulator.startStream(streamKey, { duration: 60 });
    await page.goto('/');
    
    // Start playback
    await page.click(`[data-stream-key="${streamKey}"] .btn-play`);
    
    // Measure interaction responsiveness
    const startTime = Date.now();
    await page.click('#refreshButton');
    const responseTime = Date.now() - startTime;
    
    expect(responseTime).toBeLessThan(1000); // Should respond within 1s
  });
});
```

## Error Handling Test Cases

### Network Error Scenarios
```javascript
describe('Network Error Handling', () => {
  test('should handle offline scenarios', async () => {
    await page.setOfflineMode(true);
    
    await page.goto('/');
    await page.click('.btn-play');
    
    await page.waitForSelector('.alert-danger');
    const errorText = await page.textContent('.alert-danger');
    expect(errorText).toContain('connection');
  });

  test('should recover from temporary network issues', async () => {
    // Start stream
    const streamKey = 'network-test';
    await streamSimulator.startStream(streamKey, { duration: 120 });
    
    await page.goto('/');
    await page.click(`[data-stream-key="${streamKey}"] .btn-play`);
    
    // Simulate network disruption
    await page.setOfflineMode(true);
    await page.waitForTimeout(5000);
    await page.setOfflineMode(false);
    
    // Should recover
    await page.waitForSelector('#currentStreamStatus:not(:contains("Error"))');
  });
});
```

### Invalid Stream Data
```javascript
describe('Invalid Stream Data Handling', () => {
  test('should handle malformed stream paths', () => {
    expect(() => app.extractStreamKey('///')).not.toThrow();
    expect(() => app.extractStreamKey(123)).not.toThrow();
    expect(() => app.extractStreamKey({})).not.toThrow();
  });

  test('should handle invalid stream responses', async () => {
    // Mock invalid API response
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ success: false, error: 'Stream not found' })
    });

    await expect(app.refreshStreams()).not.toThrow();
  });
});
```

## Test Data Management

### Mock Stream Configurations
```javascript
const testStreamConfigs = {
  highQuality: {
    quality: '1080p',
    fps: 60,
    duration: 120,
    audioFreq: 1000
  },
  
  lowQuality: {
    quality: '480p',
    fps: 24,
    duration: 60,
    audioFreq: 440
  },
  
  unstableConnection: {
    quality: '720p',
    fps: 30,
    duration: 300,
    networkConditions: {
      bandwidth: '100k',
      latency: '500ms',
      packetLoss: '5%'
    }
  }
};
```

### Test Environment Setup
```javascript
const testEnvironment = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  rtmpPort: process.env.RTMP_PORT || 1935,
  httpFlvPort: process.env.HTTP_FLV_PORT || 8000,
  
  timeouts: {
    streamStart: 30000,
    playerLoad: 15000,
    apiResponse: 10000
  },
  
  retries: {
    flaky: 3,
    network: 2
  }
};
```

## Continuous Integration Integration

### Jest Configuration for Player Tests
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'public/js/**/*.js',
    '!public/js/vendor/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  }
};
```

### Playwright Configuration for E2E Tests
```javascript
module.exports = {
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 2,
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
};
```

## Testing Implementation Priority

### Phase 1 (Immediate - Week 1)
1. ✅ Unit tests for URL construction
2. ✅ Mock stream data validation
3. ✅ Basic player initialization tests

### Phase 2 (Week 2)
1. ✅ Integration tests with Video.js
2. ✅ FLV.js fallback mechanism tests
3. ✅ Error handling validation

### Phase 3 (Week 3)
1. ✅ E2E tests with real streams
2. ✅ Cross-browser compatibility
3. ✅ Performance benchmarking

### Phase 4 (Week 4)
1. ✅ Load testing with multiple streams
2. ✅ Network condition simulation
3. ✅ CI/CD integration

## Success Metrics

### Code Coverage Targets
- Unit Tests: 90%+ coverage
- Integration Tests: 85%+ coverage
- E2E Tests: Key user journeys covered

### Performance Benchmarks
- Page load time: < 3 seconds
- Stream start time: < 5 seconds
- Player initialization: < 2 seconds
- Error recovery: < 10 seconds

### Reliability Targets
- 99.5% test pass rate
- Zero false positives
- Stable across all supported browsers
- Consistent performance under load

## Tools and Dependencies

### Testing Frameworks
- **Jest**: Unit and integration testing
- **Playwright**: E2E and browser testing
- **FFmpeg**: Stream simulation
- **Sinon**: Mocking and stubbing

### Browser Testing
- **Chrome/Chromium**: Primary development browser
- **Firefox**: Secondary browser support
- **Safari/WebKit**: macOS/iOS compatibility

### Performance Tools
- **Lighthouse**: Performance auditing
- **Chrome DevTools**: Detailed profiling
- **Custom metrics**: Stream-specific monitoring

This comprehensive testing strategy ensures robust validation of the player URL functionality while maintaining high code quality and user experience standards.