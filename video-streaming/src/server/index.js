/**
 * Video Streaming Platform - Main Server
 * RTMP Live Streaming with Web Interface
 */

const express = require('express');
const NodeMediaServer = require('node-media-server');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');
const ErrorHandler = require('../utils/errorHandler');
const RecordingManager = require('../utils/recordingManager');
const ForwardingManager = require('../utils/forwardingManager');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// Our own session tracking to fix the race condition
const activeStreams = new Map();

// Initialize Recording Manager
const recordingManager = new RecordingManager();

// Initialize Forwarding Manager
const forwardingManager = new ForwardingManager();

// RTMP Server Configuration
const rtmpConfig = {
  logType: parseInt(process.env.LOG_LEVEL) || 3,
  rtmp: {
    port: parseInt(process.env.RTMP_PORT) || 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: parseInt(process.env.HTTP_PORT) || 8000,
    mediaroot: process.env.MEDIA_ROOT || './media',
    allow_origin: process.env.ALLOW_ORIGIN || '*'
  },
  // HTTPS disabled by default - uncomment after SSL certificate setup
  // https: {
  //   port: 8443,
  //   key: './ssl/privatekey.pem',
  //   cert: './ssl/certificate.pem'
  // },
  relay: {
    ffmpeg: process.env.FFMPEG_PATH || '/usr/local/bin/ffmpeg',
    tasks: []
  }
};

// Initialize RTMP Server
const nms = new NodeMediaServer(rtmpConfig);

// Access sessions properly through the server instance
nms.getSession = () => {
  try {
    // node-media-server stores sessions in nms.sessions object
    return nms.sessions || {};
  } catch (error) {
    console.error('Error getting sessions:', error);
    return {};
  }
};

// RTMP Event Handlers
nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('postConnect', (id, args) => {
  console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
  console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('prePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  // Authentication logic would go here
  // For now, allow all streams
  
  // Add to our own tracking immediately when stream starts
  const streamData = {
    id: id,
    publishStreamPath: StreamPath,
    isPublishing: true,
    connectTime: Date.now(),
    prePublishTime: Date.now()
  };
  
  activeStreams.set(id, streamData);
  console.log(`✅ Stream ${id} added to activeStreams: ${StreamPath}`);
  console.log(`📊 Total active streams: ${activeStreams.size}`);
  console.log(`🔍 ActiveStreams contents:`, Array.from(activeStreams.entries()));
  
  // Start recording if enabled
  if (process.env.ENABLE_RECORDING === 'true') {
    const recording = recordingManager.startRecording(id, StreamPath);
    if (recording) {
      console.log(`🎬 Recording started for stream ${id}: ${recording.filename}`);
      streamData.recording = recording;
    }
  }
  
  // Start forwarding if configurations exist
  const enabledForwardingConfigs = forwardingManager.getEnabledForwardingConfigs();
  if (enabledForwardingConfigs.length > 0) {
    const forwardingTasks = forwardingManager.startForwarding(id, StreamPath, enabledForwardingConfigs);
    if (forwardingTasks.length > 0) {
      console.log(`📡 Started ${forwardingTasks.length} forwarding tasks for stream ${id}`);
      streamData.forwarding = forwardingTasks;
    }
  }
  
  // Notify clients about new stream
  io.emit('stream_started', {
    streamPath: StreamPath,
    timestamp: Date.now(),
    recording: streamData.recording ? {
      id: streamData.recording.id,
      filename: streamData.recording.filename,
      startTime: streamData.recording.startTime
    } : null
  });
  
  console.log('Active streams after prePublish:', Array.from(activeStreams.keys()));
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  // Debug: Show sessions (isPublishing flag should already be set in prePublish)
  const sessions = nms.getSession() || {};
  console.log('Sessions after postPublish:', Object.keys(sessions));
  
  // Verify session is marked as publishing from prePublish
  if (sessions[id]) {
    console.log(`Session ${id} status in postPublish:`, {
      isPublishing: sessions[id].isPublishing,
      publishStreamPath: sessions[id].publishStreamPath
    });
  } else {
    console.log(`WARNING: Session ${id} not found in postPublish`);
  }
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  // Stop recording if it was active
  const streamData = activeStreams.get(id);
  if (streamData && streamData.recording) {
    console.log(`🛑 Stopping recording for stream ${id}`);
    recordingManager.stopRecording(id);
  }
  
  // Stop forwarding if it was active
  if (streamData && streamData.forwarding) {
    console.log(`🛑 Stopping forwarding for stream ${id}`);
    forwardingManager.stopForwarding(id);
  }
  
  // Remove from our tracking
  if (activeStreams.has(id)) {
    activeStreams.delete(id);
    console.log(`🗑️ Stream ${id} removed from activeStreams`);
    console.log(`📊 Total active streams: ${activeStreams.size}`);
  }
  
  // Notify clients about stream end
  io.emit('stream_ended', {
    streamPath: StreamPath,
    timestamp: Date.now()
  });
});

nms.on('prePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('postPlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

// Recording API endpoints
app.get('/api/recordings', (req, res) => {
  try {
    const recordings = recordingManager.getRecordingHistory();
    res.json({
      success: true,
      recordings
    });
  } catch (error) {
    console.error('Error getting recordings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recordings'
    });
  }
});

app.get('/api/recordings/active', (req, res) => {
  try {
    const activeRecordings = recordingManager.getActiveRecordings();
    res.json({
      success: true,
      recordings: activeRecordings
    });
  } catch (error) {
    console.error('Error getting active recordings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active recordings'
    });
  }
});

app.get('/api/recordings/:id', (req, res) => {
  try {
    const { id } = req.params;
    const recording = recordingManager.getRecordingById(id);
    
    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found'
      });
    }
    
    res.json({
      success: true,
      recording
    });
  } catch (error) {
    console.error('Error getting recording:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recording'
    });
  }
});

app.delete('/api/recordings/:id', (req, res) => {
  try {
    const { id } = req.params;
    const success = recordingManager.deleteRecording(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found or could not be deleted'
      });
    }
    
    res.json({
      success: true,
      message: 'Recording deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting recording:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete recording'
    });
  }
});

app.get('/api/recordings/:id/download', (req, res) => {
  try {
    const { id } = req.params;
    const recording = recordingManager.getRecordingById(id);
    
    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found'
      });
    }
    
    if (!require('fs').existsSync(recording.outputPath)) {
      return res.status(404).json({
        success: false,
        message: 'Recording file not found'
      });
    }
    
    res.download(recording.outputPath, recording.filename);
  } catch (error) {
    console.error('Error downloading recording:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download recording'
    });
  }
});

// Forwarding API endpoints
app.get('/api/forwarding/configs', (req, res) => {
  try {
    const configs = forwardingManager.getForwardingConfigs();
    res.json({
      success: true,
      configs
    });
  } catch (error) {
    console.error('Error getting forwarding configs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get forwarding configs'
    });
  }
});

app.post('/api/forwarding/configs', (req, res) => {
  try {
    const config = forwardingManager.addForwardingConfig(req.body);
    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error adding forwarding config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add forwarding config'
    });
  }
});

app.put('/api/forwarding/configs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const config = forwardingManager.updateForwardingConfig(id, req.body);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Forwarding config not found'
      });
    }
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error updating forwarding config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update forwarding config'
    });
  }
});

app.delete('/api/forwarding/configs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const success = forwardingManager.deleteForwardingConfig(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Forwarding config not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Forwarding config deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting forwarding config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete forwarding config'
    });
  }
});

app.get('/api/forwarding/active', (req, res) => {
  try {
    const activeForwarding = forwardingManager.getActiveForwarding();
    res.json({
      success: true,
      forwarding: activeForwarding
    });
  } catch (error) {
    console.error('Error getting active forwarding:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active forwarding'
    });
  }
});

app.get('/api/forwarding/presets', (req, res) => {
  try {
    const presets = forwardingManager.getPresetConfigs();
    res.json({
      success: true,
      presets
    });
  } catch (error) {
    console.error('Error getting forwarding presets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get forwarding presets'
    });
  }
});

// Configuration endpoint for frontend
app.get('/api/config', (req, res) => {
  try {
    const config = {
      flvBaseUrl: process.env.FLV_BASE_URL || `${req.protocol}://${req.get('host').split(':')[0]}:${rtmpConfig.http.port}`,
      rtmpPort: rtmpConfig.rtmp.port,
      httpPort: rtmpConfig.http.port
    };
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get configuration'
    });
  }
});

// API Routes
app.get('/api/streams', (req, res) => {
  try {
    // Use our own tracking for immediate response
    const streamList = Array.from(activeStreams.values()).map(stream => ({
      id: stream.id,
      publishStreamPath: stream.publishStreamPath,
      isPublishing: stream.isPublishing,
      connectTime: stream.connectTime
    }));
    
    console.log('API /api/streams - Active streams from our tracking:', streamList.length);
    console.log('API /api/streams - Stream details:', streamList);
    console.log('API /api/streams - Raw activeStreams Map size:', activeStreams.size);
    console.log('API /api/streams - Raw activeStreams Map contents:', Array.from(activeStreams.entries()));
    
    res.json({
      success: true,
      streams: streamList
    });
  } catch (error) {
    console.error('Error getting streams:', error);
    res.json({
      success: true,
      streams: []
    });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    // Get server statistics
    const sessions = nms.getSession() || {};
    const stats = {
      totalSessions: Object.keys(sessions).length,
      publishingSessions: Object.values(sessions).filter(s => s && s.isPublishing).length,
      playingSessions: Object.values(sessions).filter(s => s && s.isPlaying).length,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.json({
      success: true,
      stats: {
        totalSessions: 0,
        publishingSessions: 0,
        playingSessions: 0,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });
  }
});

app.post('/api/streams/:streamKey/stop', (req, res) => {
  try {
    const { streamKey } = req.params;
    // Stop a specific stream
    const sessions = nms.getSession() || {};
    const session = Object.values(sessions).find(s => 
      s && s.publishStreamPath && s.publishStreamPath.includes(streamKey)
    );
    
    if (session) {
      session.reject();
      res.json({ success: true, message: 'Stream stopped' });
    } else {
      res.status(404).json({ success: false, message: 'Stream not found' });
    }
  } catch (error) {
    console.error('Error stopping stream:', error);
    res.status(500).json({ success: false, message: 'Error stopping stream' });
  }
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  try {
    // Send current active streams
    const sessions = nms.getSession() || {};
    const activeStreams = Object.values(sessions)
      .filter(s => s && s.isPublishing)
      .map(s => ({
        path: s.publishStreamPath,
        connectTime: s.connectTime
      }));
    
    socket.emit('active_streams', activeStreams);
  } catch (error) {
    console.error('Error sending active streams:', error);
    socket.emit('active_streams', []);
  }
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    const sessions = ErrorHandler.getSafeSessions(nms);
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime(),
      sessions: Object.keys(sessions).length
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: Date.now(),
      error: 'Service unavailable'
    });
  }
});

// Error handling middleware
app.use(ErrorHandler.handleNotFound);
app.use(ErrorHandler.handleError);

// Start servers
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
  console.log(`📡 RTMP server will run on port ${rtmpConfig.rtmp.port}`);
  console.log(`🎥 HTTP-FLV server will run on port ${rtmpConfig.http.port}`);
});

nms.run();

console.log('🚀 Video Streaming Platform Started');
console.log('┌─────────────────────────────────────────┐');
console.log('│  RTMP Stream URL:                       │');
console.log(`│  rtmp://localhost:${rtmpConfig.rtmp.port}/live/STREAM_KEY  │`);
console.log('│                                         │');
console.log('│  HTTP-FLV Playback URL:                 │');
console.log(`│  http://localhost:${rtmpConfig.http.port}/live/STREAM_KEY.flv │`);
console.log('│                                         │');
console.log('│  Web Interface:                         │');
console.log(`│  http://localhost:${PORT}                │`);
console.log('└─────────────────────────────────────────┘');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📡 Shutting down servers...');
  nms.stop();
  server.close(() => {
    console.log('✅ Servers stopped gracefully');
    process.exit(0);
  });
});

module.exports = { app, nms, io };