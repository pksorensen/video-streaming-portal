# Coolify Deployment Guide

## Overview
This guide explains how to deploy the video streaming platform using Coolify with the provided `docker-compose.coolify.yml` file.

## Key Differences from Standard Docker Compose
- **No Port Bindings**: All `ports:` sections removed from services
- **Internal Networking**: Services communicate via container names on the `streaming-network`
- **Coolify Labels**: Added for proper service identification

## Traefik Configuration (Automatic Routing)

This deployment uses Traefik labels for automatic service discovery and routing. No manual port mapping in Coolify UI is needed.

### Required Traefik Entrypoints

You need to configure these entrypoints in your Traefik static configuration:

```yaml
entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"
  rtmp:
    address: ":1935"  # Custom TCP entrypoint for RTMP
```

### Service Access URLs

- **Web Interface**: `https://stream-app.kjeldager.io`
- **RTMP Streaming**: `rtmp://stream-app.kjeldager.io:1935/live`
- **HTTP-FLV Playback**: `https://stream-app.kjeldager.io/live/{stream-key}.flv`

### Manual Port Mapping (Alternative)

If you prefer manual configuration in Coolify UI instead of Traefik labels:

### Main Streaming Application
- **Container Port**: 3000
- **Protocol**: HTTP
- **Domain**: `stream-app.kjeldager.io`
- **Purpose**: Web interface and main application

### RTMP Server
- **Container Port**: 1935
- **Protocol**: TCP
- **Domain**: `stream-app.kjeldager.io:1935`
- **Purpose**: RTMP streaming ingestion

### HTTP-FLV Server
- **Container Port**: 8000
- **Protocol**: HTTP
- **Path**: `/live`
- **Purpose**: HTTP-FLV streaming output

## Services Overview

### streaming-platform
- Main Node.js application
- Handles web interface, RTMP, and HTTP-FLV
- Internal ports: 3000, 1935, 8000
- Exposes all functionality

### redis
- Session storage and caching
- Internal only (no external access needed)
- Port 6379 (internal)

### nginx (optional)
- Reverse proxy and load balancer
- Only needed if using custom routing
- Internal ports: 80, 443

## Environment Variables

Set these in Coolify's environment configuration:

```
NODE_ENV=production
RTMP_PORT=1935
HTTP_PORT=8000
PORT=3000
MEDIA_ROOT=/app/media
FFMPEG_PATH=/usr/bin/ffmpeg
ENABLE_AUTH=false
ENABLE_RECORDING=true
ENABLE_HLS=true
ENABLE_DASH=false
MAX_CONNECTIONS=1000
MAX_BITRATE=5000
LOG_LEVEL=2
```

## Volume Mounts

Ensure these directories are accessible:
- `./media` → `/app/media` (uploaded media files)
- `./recordings` → `/app/recordings` (recorded streams)
- `./logs` → `/app/logs` (application logs)
- `./ssl` → `/app/ssl` (SSL certificates)

## Deployment Steps

1. **Upload Files**: Copy `docker-compose.coolify.yml` to your Coolify project
2. **Configure Domains**: Set up domain mappings for ports 3000, 1935, 8000
3. **Set Environment Variables**: Configure the variables listed above
4. **Deploy**: Use Coolify's deployment interface
5. **Verify**: Check that all services start correctly and are accessible

## Testing the Deployment

### Web Interface
```bash
curl https://stream.yourdomain.com/health
```

### RTMP Streaming (using OBS or similar)
```
Server: rtmp://rtmp.yourdomain.com/live
Stream Key: test-stream
```

### HTTP-FLV Playback
```
http://flv.yourdomain.com/live/test-stream.flv
```

## Troubleshooting

### Service Communication Issues
- Verify all services are on the `streaming-network`
- Check that container names are being used for internal communication
- Ensure no port conflicts in Coolify configuration

### External Access Issues
- Verify domain mappings in Coolify UI
- Check that correct ports are mapped (3000, 1935, 8000)
- Ensure firewall rules allow the configured ports

### Volume Mount Issues
- Verify file permissions on host directories
- Ensure Coolify has read/write access to mounted paths
- Check that directories exist before deployment

## Security Considerations

- Use HTTPS for the web interface (port 3000)
- Consider enabling authentication (`ENABLE_AUTH=true`)
- Implement proper firewall rules
- Use secure stream keys for RTMP
- Regularly update the base images

## Monitoring

The application includes a health check endpoint:
- **URL**: `/health`
- **Method**: GET
- **Expected Response**: 200 OK

Monitor logs through Coolify's log viewer or the mounted `./logs` directory.