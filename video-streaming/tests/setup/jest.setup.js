/**
 * Jest Setup for Player Testing
 * Global setup and mocks for Video.js and FLV.js testing
 */

// Mock console methods to reduce noise during tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error // Keep errors visible
};

// Mock fetch globally
global.fetch = jest.fn();

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  timing: {}
};

// Mock Video.js
const mockVideoJsPlayer = {
  ready: jest.fn(callback => {
    if (callback) callback();
    return mockVideoJsPlayer;
  }),
  reset: jest.fn(() => mockVideoJsPlayer),
  src: jest.fn(() => mockVideoJsPlayer),
  play: jest.fn(() => Promise.resolve()),
  pause: jest.fn(() => mockVideoJsPlayer),
  on: jest.fn(() => mockVideoJsPlayer),
  one: jest.fn(() => mockVideoJsPlayer),
  off: jest.fn(() => mockVideoJsPlayer),
  trigger: jest.fn(() => mockVideoJsPlayer),
  dispose: jest.fn(),
  currentSrc: jest.fn(() => ''),
  error: jest.fn(() => null),
  readyState: jest.fn(() => 4),
  paused: jest.fn(() => true),
  ended: jest.fn(() => false),
  duration: jest.fn(() => 0),
  currentTime: jest.fn(() => 0),
  volume: jest.fn(() => 1),
  muted: jest.fn(() => false)
};

global.videojs = jest.fn(() => mockVideoJsPlayer);
global.videojs.getPlayer = jest.fn(() => mockVideoJsPlayer);
global.videojs.getPlugin = jest.fn(() => ({}));

// Mock FLV.js
const mockFlvPlayer = {
  attachMediaElement: jest.fn(),
  load: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  destroy: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  unload: jest.fn()
};

global.flvjs = {
  createPlayer: jest.fn(() => mockFlvPlayer),
  isSupported: jest.fn(() => true),
  Events: {
    LOADING_COMPLETE: 'loading_complete',
    ERROR: 'error'
  },
  ErrorTypes: {
    NETWORK_ERROR: 'network_error',
    MEDIA_ERROR: 'media_error'
  }
};

// Mock Socket.io
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn()
};

global.io = jest.fn(() => mockSocket);

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve(''))
  },
  writable: true
});

// Mock Bootstrap
global.bootstrap = {
  Modal: jest.fn(() => ({
    show: jest.fn(),
    hide: jest.fn()
  }))
};

// Setup DOM cleanup
afterEach(() => {
  // Clean up DOM
  document.body.innerHTML = '';
  
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset fetch mock
  if (fetch.mockClear) {
    fetch.mockClear();
  }
});

// Setup test utilities
beforeEach(() => {
  // Reset window.location mock
  delete window.location;
  window.location = {
    protocol: 'http:',
    hostname: 'localhost',
    href: 'http://localhost:3000/'
  };
  
  // Reset performance timer
  performance.now.mockReturnValue(Date.now());
});

// Global test helpers
global.testUtils = {
  // Create mock stream data
  createMockStream: (streamKey, isLive = true) => ({
    path: `/live/${streamKey}`,
    publishStreamPath: `/live/${streamKey}`,
    isPublishing: isLive,
    connectTime: Date.now() - Math.random() * 3600000,
    app: 'live',
    stream: streamKey
  }),
  
  // Create mock DOM element
  createElement: (tag, id, attributes = {}) => {
    const element = document.createElement(tag);
    if (id) element.id = id;
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  },
  
  // Wait for async operations
  waitFor: (condition, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
};

// Custom matchers
expect.extend({
  toBeValidStreamUrl(received) {
    const urlPattern = /^https?:\/\/[\w\.-]+:\d+\/live\/[\w\.-]+\.(flv|m3u8)$/;
    const pass = urlPattern.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid stream URL`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid stream URL`,
        pass: false
      };
    }
  },
  
  toBeValidStreamKey(received) {
    const pass = typeof received === 'string' && 
                 received.length > 0 && 
                 received !== 'unknown';
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid stream key`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid stream key`,
        pass: false
      };
    }
  }
});

// Suppress known warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  
  // Filter out known warnings we can't avoid in tests
  const ignoredWarnings = [
    'Video.js',
    'FLV.js',
    'WebSocket connection'
  ];
  
  if (!ignoredWarnings.some(warning => message.includes(warning))) {
    originalWarn.apply(console, args);
  }
};

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Test environment info
console.log('🧪 Jest setup completed for Video Player Testing');
console.log('📦 Mocks loaded: Video.js, FLV.js, Socket.io, Fetch, Clipboard');
console.log('🎯 Test environment: jsdom with enhanced DOM support');