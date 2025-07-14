/**
 * RTMP Server Configuration
 * Production-ready settings based on hive mind research
 */

const path = require('path');

const defaultConfig = {
  // Logging configuration
  logType: 3, // 0: ERROR, 1: WARN, 2: INFO, 3: DEBUG
  
  // RTMP server settings
  rtmp: {
    port: parseInt(process.env.RTMP_PORT) || 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
    
    // Authentication settings
    allow_origin: process.env.ALLOW_ORIGIN || '*',
    
    // Stream processing
    stream: {
      timeout: 60000,
      drop_when_full: true
    }
  },
  
  // HTTP server for playback
  http: {
    port: parseInt(process.env.HTTP_PORT) || 8000,
    mediaroot: process.env.MEDIA_ROOT || './media',
    allow_origin: process.env.ALLOW_ORIGIN || '*',
    
    // API endpoints
    api: true,
    
    // Cross-origin settings
    cors: {
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }
  },
  
  // HTTPS for secure streaming (disabled by default - enable after SSL setup)
  https: {
    port: 8443,
    key: './ssl/privatekey.pem',
    cert: './ssl/certificate.pem',
    enabled: process.env.ENABLE_HTTPS === 'true'
  },
  
  // Recording configuration
  record: {
    enabled: process.env.ENABLE_RECORDING === 'true',
    path: './recordings',
    format: 'flv',
    append: false
  },
  
  // FFmpeg relay and transcoding
  relay: {
    ffmpeg: process.env.FFMPEG_PATH || '/usr/local/bin/ffmpeg',
    
    // Transcoding presets
    presets: {
      hd: [
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-ar', '44100',
        '-b:a', '128k',
        '-f', 'flv'
      ],
      sd: [
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-s', '854x480',
        '-crf', '25',
        '-c:a', 'aac',
        '-ar', '44100',
        '-b:a', '96k',
        '-f', 'flv'
      ],
      mobile: [
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-s', '640x360',
        '-crf', '28',
        '-c:a', 'aac',
        '-ar', '44100',
        '-b:a', '64k',
        '-f', 'flv'
      ]
    },
    
    // Multi-streaming tasks (can be configured dynamically)
    tasks: [
      // Example: Forward to YouTube
      // {
      //   app: 'live',
      //   mode: 'push',
      //   edge: 'rtmp://a.rtmp.youtube.com/live2/YOUR_STREAM_KEY'
      // }
    ]
  },
  
  // HLS (HTTP Live Streaming) configuration
  hls: {
    enabled: process.env.ENABLE_HLS === 'true',
    path: './public/hls',
    fragment: 3,
    listSize: 10,
    cleanup: true
  },
  
  // DASH (Dynamic Adaptive Streaming) configuration
  dash: {
    enabled: process.env.ENABLE_DASH === 'true',
    path: './public/dash',
    fragment: 3,
    listSize: 10,
    cleanup: true
  },
  
  // Authentication and security
  auth: {
    // Play authentication
    play: process.env.ENABLE_AUTH === 'true',
    
    // Publish authentication
    publish: process.env.ENABLE_AUTH === 'true',
    
    // Secret key for token generation
    secret: process.env.SECRET_KEY || 'default-secret-key',
    
    // JWT configuration
    jwt: {
      secret: process.env.JWT_SECRET || 'jwt-secret-key',
      expiresIn: '24h'
    },
    
    // Stream keys configuration
    streamKeys: {
      length: 16,
      characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    }
  },
  
  // Rate limiting and performance
  performance: {
    maxConnections: parseInt(process.env.MAX_CONNECTIONS) || 1000,
    maxBitrate: parseInt(process.env.MAX_BITRATE) || 5000,
    
    // Connection limits per IP
    connectionLimits: {
      perIP: 10,
      windowMs: 60000 // 1 minute
    },
    
    // Bandwidth throttling
    bandwidth: {
      enabled: false,
      limit: '10mb' // per connection
    }
  },
  
  // Monitoring and analytics
  monitoring: {
    enabled: true,
    
    // Metrics collection
    metrics: {
      connections: true,
      bandwidth: true,
      errors: true,
      performance: true
    },
    
    // Health checks
    healthCheck: {
      interval: 30000, // 30 seconds
      timeout: 5000    // 5 seconds
    }
  }
};

/**
 * Get configuration based on environment
 */
function getConfig(environment = 'development') {
  const config = { ...defaultConfig };
  
  switch (environment) {
    case 'production':
      config.logType = 1; // WARN level
      config.auth.play = true;
      config.auth.publish = true;
      config.https.port = 443;
      config.performance.maxConnections = 10000;
      break;
      
    case 'staging':
      config.logType = 2; // INFO level
      config.auth.play = true;
      config.auth.publish = true;
      break;
      
    case 'development':
    default:
      config.logType = 3; // DEBUG level
      config.auth.play = false;
      config.auth.publish = false;
      break;
  }
  
  return config;
}

/**
 * Validate configuration
 */
function validateConfig(config) {
  const errors = [];
  
  if (!config.rtmp.port || config.rtmp.port < 1024 || config.rtmp.port > 65535) {
    errors.push('RTMP port must be between 1024 and 65535');
  }
  
  if (!config.http.port || config.http.port < 1024 || config.http.port > 65535) {
    errors.push('HTTP port must be between 1024 and 65535');
  }
  
  if (config.auth.publish && !config.auth.secret) {
    errors.push('Secret key is required when authentication is enabled');
  }
  
  if (config.relay.ffmpeg && !require('fs').existsSync(config.relay.ffmpeg)) {
    console.warn(`Warning: FFmpeg path not found: ${config.relay.ffmpeg}`);
  }
  
  return errors;
}

module.exports = {
  getConfig,
  validateConfig,
  defaultConfig
};