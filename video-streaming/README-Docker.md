# Docker Deployment Guide

## 🐳 Quick Start with Docker

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
./docker-scripts/start.sh

# Or manually:
docker-compose up -d
```

### Option 2: Single Container

```bash
# Build the image
docker build -t video-streaming-platform .

# Run the container
docker run -d \
  --name streaming-platform \
  -p 3000:3000 \
  -p 1935:1935 \
  -p 8000:8000 \
  -v $(pwd)/media:/app/media \
  -v $(pwd)/recordings:/app/recordings \
  video-streaming-platform
```

## 🏗️ Docker Services

### Core Service
- **streaming-platform**: Main application with RTMP server and web interface
- **Ports**: 3000 (web), 1935 (RTMP), 8000 (HTTP-FLV)
- **Volumes**: media, recordings, logs, ssl

### Optional Services
- **redis**: Session storage and caching
- **nginx**: Reverse proxy with SSL termination

## 🔧 Configuration

### Environment Variables

Set in `docker-compose.yml` or `.env` file:

```env
NODE_ENV=production
RTMP_PORT=1935
HTTP_PORT=8000
PORT=3000
MEDIA_ROOT=/app/media
FFMPEG_PATH=/usr/bin/ffmpeg
ENABLE_AUTH=false
ENABLE_RECORDING=true
ENABLE_HLS=true
MAX_CONNECTIONS=1000
MAX_BITRATE=5000
```

### Volume Mounting

```yaml
volumes:
  - ./media:/app/media           # Stream recordings
  - ./recordings:/app/recordings # VOD storage
  - ./logs:/app/logs            # Application logs
  - ./ssl:/app/ssl              # SSL certificates
```

## 🎬 Streaming Setup

### RTMP Configuration
- **Server**: `rtmp://localhost:1935/live`
- **Stream Key**: Generate from web interface
- **Protocols**: RTMP, HTTP-FLV, HLS (optional)

### OBS Studio Setup
1. Settings → Stream
2. Service: Custom
3. Server: `rtmp://localhost:1935/live`
4. Stream Key: `your_generated_key`

### FFmpeg Streaming
```bash
# Stream file to Docker container
ffmpeg -re -i input.mp4 -c:v libx264 -c:a aac -f flv rtmp://localhost:1935/live/your_key

# Stream from webcam
ffmpeg -f v4l2 -i /dev/video0 -c:v libx264 -c:a aac -f flv rtmp://localhost:1935/live/your_key
```

## 🔍 Monitoring & Logs

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f streaming-platform

# Real-time application logs
docker exec -it video-streaming-platform tail -f logs/streaming.log
```

### Health Checks
```bash
# Check service status
docker-compose ps

# Health check endpoint
curl http://localhost:3000/health

# RTMP server test
telnet localhost 1935
```

## 🛡️ Security with Nginx

### SSL Setup
1. Place certificates in `ssl/` directory:
   - `certificate.pem`
   - `privatekey.pem`

2. Uncomment HTTPS server block in `nginx.conf`

3. Restart nginx:
   ```bash
   docker-compose restart nginx
   ```

### Rate Limiting
Nginx configuration includes:
- API rate limiting: 10 requests/second
- Static content: 50 requests/second
- Burst handling with delays

## 📊 Performance Tuning

### Resource Limits
```yaml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
    reservations:
      memory: 512M
      cpus: '0.5'
```

### Scaling
```bash
# Scale streaming service
docker-compose up -d --scale streaming-platform=3

# Use external load balancer for multiple instances
```

## 🚀 Production Deployment

### Docker Swarm
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml streaming-stack
```

### Kubernetes
```bash
# Create namespace
kubectl create namespace streaming

# Deploy with Helm (create helm chart)
helm install streaming-platform ./helm-chart
```

## 🔧 Development

### Development Mode
```bash
# Development with hot reload
docker-compose -f docker-compose.dev.yml up

# Access container shell
docker exec -it video-streaming-platform sh
```

### Debug Mode
```bash
# Start with debug logging
docker-compose exec streaming-platform npm run dev
```

## 🧪 Testing

### Container Testing
```bash
# Run tests in container
docker-compose exec streaming-platform npm test

# Integration tests
docker-compose exec streaming-platform npm run test:integration
```

### Load Testing
```bash
# Use Apache Bench
ab -n 1000 -c 10 http://localhost:3000/

# RTMP stress test with multiple FFmpeg instances
for i in {1..10}; do
  ffmpeg -re -f lavfi -i testsrc2=duration=60:size=1280x720:rate=30 \
    -f flv rtmp://localhost:1935/live/test$i &
done
```

## 🔄 Backup & Recovery

### Data Backup
```bash
# Backup volumes
docker run --rm -v streaming_media:/data -v $(pwd):/backup alpine \
  tar czf /backup/media-backup.tar.gz -C /data .

# Backup database (if using)
docker-compose exec redis redis-cli --rdb /data/dump.rdb
```

### Restore
```bash
# Restore media files
docker run --rm -v streaming_media:/data -v $(pwd):/backup alpine \
  tar xzf /backup/media-backup.tar.gz -C /data
```

## 🆘 Troubleshooting

### Common Issues

1. **Port conflicts**:
   ```bash
   # Check port usage
   netstat -tulpn | grep :1935
   ```

2. **FFmpeg not found**:
   - Already included in Docker image
   - Path: `/usr/bin/ffmpeg`

3. **Permission issues**:
   ```bash
   # Fix volume permissions
   sudo chown -R $(id -u):$(id -g) media recordings logs
   ```

4. **Memory issues**:
   ```bash
   # Increase Docker memory limit
   # Docker Desktop: Settings → Resources → Memory
   ```

### Debug Commands
```bash
# Container resource usage
docker stats

# Network connectivity
docker-compose exec streaming-platform nc -zv localhost 1935

# FFmpeg test
docker-compose exec streaming-platform ffmpeg -version
```

## 📋 Useful Commands

```bash
# Quick commands
./docker-scripts/start.sh    # Start all services
./docker-scripts/stop.sh     # Stop all services

# Manual Docker Compose
docker-compose up -d          # Start in background
docker-compose down           # Stop and remove containers
docker-compose restart       # Restart services
docker-compose pull          # Update images

# Maintenance
docker system prune          # Clean up unused containers/images
docker volume ls             # List volumes
docker network ls            # List networks
```

---

🎉 **Your video streaming platform is now containerized and ready for production deployment!**