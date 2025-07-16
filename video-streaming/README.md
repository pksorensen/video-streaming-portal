# Video Streaming Platform

A professional-grade live video streaming platform built with RTMP support, real-time web interface, and comprehensive management features.

## 🚀 Features

- **RTMP Live Streaming**: Full RTMP server with secure stream ingestion
- **Automatic Recording**: Live streams are automatically recorded and stored
- **RTMP Forwarding**: Forward live streams to multiple RTMP destinations (YouTube, Twitch, etc.)
- **Real-time Web Interface**: Modern web dashboard with live stream monitoring
- **Multi-format Support**: RTMP, HLS, and HTTP-FLV streaming protocols
- **Stream Management**: Start, stop, and monitor streams in real-time
- **Recording Management**: View, download, and manage recorded broadcasts
- **Forwarding Configuration**: Easy setup for multi-platform streaming
- **Performance Monitoring**: Live statistics and analytics
- **Responsive Design**: Mobile-friendly web interface
- **Professional Integration**: Compatible with OBS, XSplit, FFmpeg, and more

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Streaming     │    │      RTMP       │    │   Web Client    │
│   Software      │───▶│     Server      │───▶│   Interface     │
│ (OBS, FFmpeg)   │    │ (Node Media)    │    │  (React/Vue)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Authentication│
                       │   & Management  │
                       │     Layer       │
                       └─────────────────┘
```

## 📋 Prerequisites

- **Node.js** 16.0.0 or higher
- **FFmpeg** (for transcoding and processing)
- **Git** (for cloning the repository)

### Installing FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)

## 🚀 Quick Start

### Option 1: Docker (Recommended)
```bash
# Set up permissions for volume mounts (important for recording functionality)
./setup-permissions.sh

# Start with Docker (includes FFmpeg)
./docker-scripts/start.sh

# Access at http://localhost:3000
```

**Alternative Docker commands:**
```bash
# Development mode with hot reload
docker-compose -f docker-compose.dev.yml up

# Production deployment
docker-compose up -d
```

### Option 2: Local Development
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start the platform
npm start
```

### Access Points
- **Web Dashboard**: http://localhost:3000
- **RTMP Server**: rtmp://localhost:1935/live
- **HTTP-FLV**: http://localhost:8000/live

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RTMP_PORT` | 1935 | RTMP server port |
| `HTTP_PORT` | 8000 | HTTP-FLV server port |
| `PORT` | 3000 | Web interface port |
| `MEDIA_ROOT` | ./media | Media storage directory |
| `RECORDING_PATH` | ./recordings | Recording storage directory |
| `ENABLE_RECORDING` | true | Enable automatic recording |
| `MAX_BITRATE` | 5000 | Maximum stream bitrate (kbps) |
| `ENABLE_AUTH` | false | Enable authentication |
| `SECRET_KEY` | random | JWT secret key |
| `FFMPEG_PATH` | /usr/bin/ffmpeg | Path to FFmpeg executable |

### RTMP Configuration

The platform uses the Node Media Server with optimized settings:

- **Chunk Size**: 60KB for optimal performance
- **GOP Cache**: Enabled for faster stream startup
- **Ping Timeout**: 60 seconds
- **Multi-format Output**: RTMP, HLS, HTTP-FLV

## 📺 Streaming Setup

### OBS Studio Configuration

1. **Settings → Stream**
2. **Service**: Custom
3. **Server**: `rtmp://your-server:1935/live`
4. **Stream Key**: Generate from web interface

### Recommended OBS Settings

- **Output Mode**: Advanced
- **Encoder**: x264 (CPU) or NVENC (GPU)
- **Rate Control**: CBR
- **Bitrate**: 2500-5000 kbps
- **Keyframe Interval**: 2 seconds
- **Preset**: Fast or Medium

## 🎬 Recording & Forwarding Features

### Automatic Recording
- **Auto-start**: Recordings begin automatically when a stream starts
- **Storage**: Files saved to `./recordings/completed/` directory
- **Formats**: Recordings saved in FLV format for compatibility
- **Management**: View, download, and delete recordings from the web dashboard

### RTMP Forwarding
- **Multi-destination**: Forward to multiple RTMP endpoints simultaneously
- **Platform Support**: Pre-configured for YouTube Live, Twitch, Facebook Live
- **Custom RTMP**: Support for any RTMP destination
- **Retry Logic**: Automatic retry on connection failures
- **Real-time Monitoring**: Live status updates for all forwarding destinations

### Setting Up Forwarding
1. **Access Dashboard**: Navigate to the "Forwarding" section
2. **Add Destination**: Click "Add Destination"
3. **Choose Platform**: Select YouTube, Twitch, or Custom
4. **Enter Details**: Provide stream key and destination URL
5. **Enable**: Toggle the destination to active
6. **Start Streaming**: Forwarding begins automatically with your stream

### Recording Management
- **View Recordings**: Browse all recorded broadcasts
- **Download**: Save recordings to your local device
- **Stream Info**: View duration, file size, and recording date
- **Playback**: Watch recordings directly in the web interface
- **Delete**: Remove recordings with confirmation

### FFmpeg Streaming

```bash
# Stream file to RTMP server
ffmpeg -re -i input.mp4 -c:v libx264 -c:a aac -f flv rtmp://localhost:1935/live/your_stream_key

# Stream webcam (Linux)
ffmpeg -f v4l2 -i /dev/video0 -c:v libx264 -c:a aac -f flv rtmp://localhost:1935/live/your_stream_key

# Stream webcam (macOS)
ffmpeg -f avfoundation -i "0:0" -c:v libx264 -c:a aac -f flv rtmp://localhost:1935/live/your_stream_key
```

## 🔐 Authentication

### Stream Key Management

```javascript
// Generate stream key
POST /api/auth/stream-keys
{
  "userId": "user123",
  "permissions": ["publish"],
  "expiresIn": "7d"
}

// Validate stream key
GET /api/auth/stream-keys/validate/:streamKey
```

### JWT Authentication

```javascript
// Login
POST /api/auth/login
{
  "username": "user",
  "password": "password"
}

// Protected routes
GET /api/streams
Authorization: Bearer <jwt_token>
```

## 📊 API Reference

### Stream Management

```javascript
// Get active streams
GET /api/streams

// Get stream statistics
GET /api/stats

// Stop stream
POST /api/streams/:streamKey/stop

// Health check
GET /health
```

### WebSocket Events

```javascript
// Stream started
socket.on('stream_started', (data) => {
  console.log('New stream:', data.streamPath);
});

// Stream ended
socket.on('stream_ended', (data) => {
  console.log('Stream ended:', data.streamPath);
});

// Active streams update
socket.on('active_streams', (streams) => {
  console.log('Current streams:', streams);
});
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration

# Run with coverage
npm run test:coverage
```

## 📱 Client Integration

### HTML5 Video Player

```html
<video id="player" controls>
  <source src="http://localhost:8000/live/stream_key.flv" type="video/x-flv">
</video>
```

### Video.js Integration

```javascript
const player = videojs('player', {
  sources: [{
    src: 'http://localhost:8000/live/stream_key.flv',
    type: 'video/x-flv'
  }]
});
```

## 🔧 Development

### Project Structure

```
video-streaming/
├── src/
│   ├── server/          # Express.js server
│   ├── rtmp/           # RTMP configuration
│   ├── client/         # Frontend components
│   └── utils/          # Utilities and helpers
├── public/             # Static web assets
├── tests/              # Test suites
├── config/             # Configuration files
└── docs/               # Documentation
```

### Development Commands

```bash
# Development server with auto-reload
npm run dev

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

## 🚀 Production Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000 1935 8000
CMD ["npm", "start"]
```

### Nginx Configuration

```nginx
upstream streaming_backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://streaming_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /socket.io/ {
        proxy_pass http://streaming_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 📈 Performance Tuning

### System Optimization

```bash
# TCP optimization for streaming
echo 'net.core.rmem_max = 16777216' >> /etc/sysctl.conf
echo 'net.core.wmem_max = 16777216' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_rmem = 4096 65536 16777216' >> /etc/sysctl.conf
```

### Application Tuning

- **Chunk Size**: Adjust based on network conditions
- **GOP Cache**: Enable for faster stream startup
- **Connection Limits**: Set based on server capacity
- **Transcoding**: Use hardware acceleration when available

## 🐛 Troubleshooting

### Common Issues

1. **Stream Not Starting**
   - Check RTMP URL and stream key
   - Verify firewall settings (port 1935)
   - Check FFmpeg installation

2. **Playback Issues**
   - Ensure HTTP-FLV port (8000) is accessible
   - Check browser compatibility
   - Verify stream is active

3. **Authentication Errors**
   - Check JWT secret configuration
   - Verify stream key validity
   - Check token expiration

### Debug Mode

```bash
# Enable debug logging
NODE_ENV=development npm start

# Check RTMP connection
telnet localhost 1935
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Node Media Server](https://github.com/illuspas/Node-Media-Server) - Core RTMP functionality
- [Video.js](https://videojs.com/) - HTML5 video player
- [Bootstrap](https://getbootstrap.com/) - UI framework
- [Socket.io](https://socket.io/) - Real-time communication

## 📞 Support

- 📧 Email: support@streaming-platform.com
- 💬 Discord: [Join our community](https://discord.gg/streaming)
- 📖 Documentation: [Full documentation](https://docs.streaming-platform.com)
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/issues)

---

**Built with ❤️ by the Hive Mind Collective Intelligence System**