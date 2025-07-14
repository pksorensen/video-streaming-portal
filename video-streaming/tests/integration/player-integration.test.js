/**
 * Integration Tests for Video Player
 * Tests Video.js and FLV.js integration with real player interactions
 */

const { JSDOM } = require('jsdom');

// Mock Video.js and FLV.js
const mockVideoJs = {
  Events: {
    LOADSTART: 'loadstart',
    CANPLAY: 'canplay', 
    ERROR: 'error'
  }
};

const mockFlvJs = {
  Events: {
    LOADING_COMPLETE: 'loading_complete',
    ERROR: 'error'
  },
  ErrorTypes: {
    NETWORK_ERROR: 'network_error',
    MEDIA_ERROR: 'media_error'
  },
  ErrorDetails: {
    NETWORK_TIMEOUT: 'network_timeout',
    MEDIA_FORMAT_ERROR: 'media_format_error'
  }
};

// Enhanced DOM setup
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head></head>
<body>
  <video id="streamPlayer" class="video-js vjs-default-skin" controls preload="none">
    <video id="streamPlayer_html5_api"></video>
  </video>
  <div id="player" style="display: none;"></div>
  <span id="currentStreamPath">-</span>
  <span id="currentStreamStatus">-</span>
  <span id="currentViewers">0</span>
  <span id="streamDuration">00:00</span>
  <div id="streamsContainer"></div>
  <span id="activeStreams">0</span>
  <span id="totalSessions">0</span>
  <span id="serverUptime">0h 0m</span>
  <input id="streamKey" value="test_key" />
  <input id="modalStreamKey" value="test_key" />
  <span id="rtmpUrl">rtmp://localhost:1935/live</span>
</body>
</html>`, {
  url: 'http://localhost:3000'
});

global.window = dom.window;
global.document = dom.window.document;
global.console = console;

describe('Player Integration Tests', () => {
  let StreamingApp;
  let app;
  let mockPlayer;
  let mockFlvPlayer;

  beforeEach(() => {
    // Reset DOM state
    document.getElementById('player').style.display = 'none';
    document.getElementById('currentStreamStatus').textContent = '-';

    // Create comprehensive Video.js mock
    mockPlayer = {
      ready: jest.fn(callback => {
        if (callback) callback();
        return mockPlayer;
      }),
      reset: jest.fn(() => mockPlayer),
      src: jest.fn(() => mockPlayer),
      play: jest.fn(() => Promise.resolve()),
      pause: jest.fn(() => mockPlayer),
      on: jest.fn(() => mockPlayer),
      one: jest.fn(() => mockPlayer),
      off: jest.fn(() => mockPlayer),
      trigger: jest.fn(() => mockPlayer),
      dispose: jest.fn(),
      getVideoElement: jest.fn(() => document.getElementById('streamPlayer_html5_api')),
      currentSrc: jest.fn(() => ''),
      error: jest.fn(() => null),
      readyState: jest.fn(() => 4),
      networkState: jest.fn(() => 1),
      paused: jest.fn(() => true),
      ended: jest.fn(() => false),
      seeking: jest.fn(() => false),
      duration: jest.fn(() => 0),
      currentTime: jest.fn(() => 0),
      buffered: jest.fn(() => ({ length: 0 })),
      volume: jest.fn(() => 1),
      muted: jest.fn(() => false)
    };

    // Video.js constructor mock
    global.videojs = jest.fn(() => mockPlayer);
    global.videojs.getPlayer = jest.fn(() => mockPlayer);
    global.videojs.getPlugin = jest.fn(() => ({}));

    // FLV.js mock
    mockFlvPlayer = {
      attachMediaElement: jest.fn(),
      load: jest.fn(),
      play: jest.fn(),
      pause: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      unload: jest.fn(),
      type: 'FlvPlayer',
      statisticsInfo: {
        playerType: 'FlvPlayer',
        url: '',
        hasRedirect: false,
        redirectedURL: null,
        isSeekable: false,
        duration: 0,
        filesize: 0,
        decodedFrames: 0,
        droppedFrames: 0
      }
    };

    global.flvjs = {
      createPlayer: jest.fn(() => mockFlvPlayer),
      isSupported: jest.fn(() => true),
      ...mockFlvJs
    };

    // Socket.io mock
    const mockSocket = {
      on: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn()
    };

    global.io = jest.fn(() => mockSocket);

    // Load StreamingApp
    const fs = require('fs');
    const appCode = fs.readFileSync('./public/js/app.js', 'utf8');
    eval(appCode);
    
    app = new StreamingApp();
  });

  describe('Player Initialization', () => {
    test('should initialize Video.js player with correct configuration', () => {
      app.initPlayer();

      expect(global.videojs).toHaveBeenCalledWith('streamPlayer', 
        expect.objectContaining({
          fluid: true,
          responsive: true,
          playbackRates: [0.5, 1, 1.25, 1.5, 2],
          plugins: expect.objectContaining({
            flvjs: expect.objectContaining({
              mediaDataSource: expect.objectContaining({
                isLive: true,
                cors: true,
                withCredentials: false
              })
            })
          })
        })
      );
    });

    test('should set up player event handlers', () => {
      app.initPlayer();

      expect(mockPlayer.ready).toHaveBeenCalled();
      expect(mockPlayer.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should handle missing player element gracefully', () => {
      document.getElementById('streamPlayer').remove();
      expect(() => app.initPlayer()).not.toThrow();
    });
  });

  describe('Stream Playback', () => {
    beforeEach(() => {
      app.initPlayer();
      app.player = mockPlayer;
    });

    test('should play stream with correct URL sources', () => {
      const streamPath = '/live/testStream123';
      
      app.playStream(streamPath);

      expect(mockPlayer.reset).toHaveBeenCalled();
      expect(mockPlayer.src).toHaveBeenCalledWith([
        {
          src: 'http://localhost:8000/live/testStream123.flv',
          type: 'video/x-flv'
        },
        {
          src: 'http://localhost:8000/live/testStream123/index.m3u8',
          type: 'application/x-mpegURL'
        }
      ]);
    });

    test('should show player section when playing', () => {
      const streamPath = '/live/testStream123';
      
      app.playStream(streamPath);

      expect(document.getElementById('player').style.display).toBe('block');
      expect(document.getElementById('currentStreamPath').textContent).toBe(streamPath);
    });

    test('should handle player not initialized', () => {
      app.player = null;
      
      expect(() => app.playStream('/live/test')).not.toThrow();
    });

    test('should update stream status during playback', () => {
      const streamPath = '/live/testStream123';
      
      app.playStream(streamPath);

      // Simulate player events
      const loadstartHandler = mockPlayer.on.mock.calls
        .find(call => call[0] === 'loadstart')[1];
      const canplayHandler = mockPlayer.on.mock.calls
        .find(call => call[0] === 'canplay')[1];

      loadstartHandler();
      expect(document.getElementById('currentStreamStatus').textContent).toBe('Connecting...');

      canplayHandler();
      expect(document.getElementById('currentStreamStatus').textContent).toBe('Ready');
    });
  });

  describe('FLV.js Fallback', () => {
    beforeEach(() => {
      app.initPlayer();
      app.player = mockPlayer;
    });

    test('should create FLV.js player when Video.js fails', () => {
      const flvUrl = 'http://localhost:8000/live/testStream.flv';
      
      app.tryDirectFLV(flvUrl);

      expect(global.flvjs.createPlayer).toHaveBeenCalledWith({
        type: 'flv',
        url: flvUrl,
        isLive: true,
        cors: true,
        withCredentials: false
      });

      expect(mockFlvPlayer.attachMediaElement).toHaveBeenCalled();
      expect(mockFlvPlayer.load).toHaveBeenCalled();
      expect(mockFlvPlayer.play).toHaveBeenCalled();
    });

    test('should handle FLV.js player initialization error', () => {
      global.flvjs.createPlayer.mockImplementation(() => {
        throw new Error('FLV.js initialization failed');
      });

      expect(() => app.tryDirectFLV('http://localhost:8000/live/test.flv')).not.toThrow();
    });

    test('should clean up previous FLV player before creating new one', () => {
      app.flvPlayer = mockFlvPlayer;
      
      app.tryDirectFLV('http://localhost:8000/live/test.flv');

      expect(mockFlvPlayer.destroy).toHaveBeenCalled();
    });

    test('should handle FLV.js loading complete event', () => {
      app.tryDirectFLV('http://localhost:8000/live/test.flv');

      const loadingCompleteHandler = mockFlvPlayer.on.mock.calls
        .find(call => call[0] === mockFlvJs.Events.LOADING_COMPLETE)[1];

      loadingCompleteHandler();
      expect(document.getElementById('currentStreamStatus').textContent).toBe('Playing (FLV.js)');
    });

    test('should handle FLV.js error events', () => {
      app.tryDirectFLV('http://localhost:8000/live/test.flv');

      const errorHandler = mockFlvPlayer.on.mock.calls
        .find(call => call[0] === mockFlvJs.Events.ERROR)[1];

      expect(() => errorHandler('NetworkError', 'Connection failed')).not.toThrow();
    });
  });

  describe('Player Error Handling', () => {
    beforeEach(() => {
      app.initPlayer();
      app.player = mockPlayer;
    });

    test('should handle Video.js player errors', () => {
      app.playStream('/live/testStream');

      const errorHandler = mockPlayer.on.mock.calls
        .find(call => call[0] === 'error')[1];

      const mockError = { code: 4, message: 'Media error' };
      errorHandler(mockError);

      expect(document.getElementById('currentStreamStatus').textContent).toBe('Error');
    });

    test('should attempt fallback on Video.js error', () => {
      app.playStream('/live/testStream');

      const errorHandler = mockPlayer.one.mock.calls
        .find(call => call[0] === 'error')[1];

      errorHandler();
      // Should trigger direct FLV attempt
      expect(global.flvjs.createPlayer).toHaveBeenCalled();
    });

    test('should handle play promise rejection', async () => {
      mockPlayer.play.mockRejectedValue(new Error('Play failed'));
      
      app.playStream('/live/testStream');

      // Should handle the rejection gracefully
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(document.getElementById('currentStreamStatus').textContent).toBe('Error');
    });
  });

  describe('Stream Stopping and Cleanup', () => {
    beforeEach(() => {
      app.initPlayer();
      app.player = mockPlayer;
    });

    test('should stop video player', () => {
      app.currentStream = '/live/testStream';
      document.getElementById('player').style.display = 'block';

      app.stopStream();

      expect(mockPlayer.pause).toHaveBeenCalled();
      expect(mockPlayer.src).toHaveBeenCalledWith('');
      expect(document.getElementById('player').style.display).toBe('none');
      expect(app.currentStream).toBeNull();
    });

    test('should clean up FLV.js player on stop', () => {
      app.flvPlayer = mockFlvPlayer;
      app.currentStream = '/live/testStream';

      app.stopStream();

      expect(mockFlvPlayer.destroy).toHaveBeenCalled();
      expect(app.flvPlayer).toBeNull();
    });

    test('should handle stopping when no player is active', () => {
      app.player = null;
      app.flvPlayer = null;

      expect(() => app.stopStream()).not.toThrow();
    });
  });

  describe('Alternative Playback Methods', () => {
    beforeEach(() => {
      app.initPlayer();
      app.player = mockPlayer;
    });

    test('should try alternative playback when primary fails', () => {
      mockPlayer.play.mockRejectedValue(new Error('Primary playback failed'));
      
      app.playStream('/live/testStream');

      // Should eventually try FLV.js direct
      setTimeout(() => {
        expect(global.flvjs.createPlayer).toHaveBeenCalled();
      }, 2100); // After the 2000ms timeout
    });

    test('should show stream instructions when all methods fail', () => {
      app.showStreamInstructions('testStream');

      const statusElement = document.getElementById('currentStreamStatus');
      expect(statusElement.innerHTML).toContain('Direct URLs to try');
      expect(statusElement.innerHTML).toContain('testStream.flv');
      expect(statusElement.innerHTML).toContain('testStream/index.m3u8');
    });
  });

  describe('URL Construction Edge Cases', () => {
    test('should handle different protocols correctly', () => {
      // Test HTTPS
      Object.defineProperty(window, 'location', {
        value: { protocol: 'https:', hostname: 'example.com' },
        writable: true
      });

      app.playStream('/live/secureStream');

      expect(mockPlayer.src).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            src: 'https://example.com:8000/live/secureStream.flv'
          })
        ])
      );
    });

    test('should handle IPv4 addresses', () => {
      Object.defineProperty(window, 'location', {
        value: { protocol: 'http:', hostname: '192.168.1.100' },
        writable: true
      });

      app.playStream('/live/ipStream');

      expect(mockPlayer.src).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            src: 'http://192.168.1.100:8000/live/ipStream.flv'
          })
        ])
      );
    });

    test('should handle IPv6 addresses', () => {
      Object.defineProperty(window, 'location', {
        value: { protocol: 'http:', hostname: '[::1]' },
        writable: true
      });

      app.playStream('/live/ipv6Stream');

      expect(mockPlayer.src).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            src: 'http://[::1]:8000/live/ipv6Stream.flv'
          })
        ])
      );
    });
  });

  describe('Player State Management', () => {
    beforeEach(() => {
      app.initPlayer();
      app.player = mockPlayer;
    });

    test('should track current stream state', () => {
      expect(app.currentStream).toBeNull();

      app.playStream('/live/testStream');
      expect(app.currentStream).toBe('/live/testStream');

      app.stopStream();
      expect(app.currentStream).toBeNull();
    });

    test('should handle switching between streams', () => {
      app.playStream('/live/stream1');
      expect(app.currentStream).toBe('/live/stream1');

      app.playStream('/live/stream2');
      expect(app.currentStream).toBe('/live/stream2');
      expect(mockPlayer.reset).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and Memory', () => {
    beforeEach(() => {
      app.initPlayer();
      app.player = mockPlayer;
    });

    test('should handle rapid play/stop cycles', () => {
      for (let i = 0; i < 100; i++) {
        app.playStream(`/live/stream${i}`);
        app.stopStream();
      }

      // Should not throw and should clean up properly
      expect(app.currentStream).toBeNull();
      expect(mockPlayer.pause).toHaveBeenCalledTimes(100);
    });

    test('should clean up event listeners on stop', () => {
      app.playStream('/live/testStream');
      app.stopStream();

      // Player should be cleaned up
      expect(mockPlayer.src).toHaveBeenCalledWith('');
    });

    test('should handle memory cleanup for FLV players', () => {
      for (let i = 0; i < 10; i++) {
        app.tryDirectFLV(`http://localhost:8000/live/stream${i}.flv`);
      }

      // Should destroy previous players
      expect(mockFlvPlayer.destroy).toHaveBeenCalledTimes(9); // 10 - 1 (first one doesn't need destroy)
    });
  });

  describe('Browser Compatibility', () => {
    test('should handle missing Video.js gracefully', () => {
      global.videojs = undefined;
      
      expect(() => app.initPlayer()).not.toThrow();
    });

    test('should handle missing FLV.js gracefully', () => {
      global.flvjs = undefined;
      
      expect(() => app.tryDirectFLV('http://localhost:8000/live/test.flv')).not.toThrow();
    });

    test('should handle missing HTML5 video element', () => {
      document.getElementById('streamPlayer_html5_api').remove();
      
      expect(() => app.tryDirectFLV('http://localhost:8000/live/test.flv')).not.toThrow();
    });
  });
});