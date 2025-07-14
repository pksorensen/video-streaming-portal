#!/bin/bash
# Video Streaming Platform - Docker Startup Script

set -e

echo "🐳 Starting Video Streaming Platform with Docker..."

# Create required directories
mkdir -p media recordings logs ssl

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
fi

# Build and start services
echo "🏗️ Building Docker images..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."
docker-compose ps

# Show connection information
echo ""
echo "✅ Video Streaming Platform is ready!"
echo "┌─────────────────────────────────────────┐"
echo "│  🌐 Web Interface:                      │"
echo "│  http://localhost:3000                  │"
echo "│                                         │"
echo "│  📡 RTMP Stream URL:                    │"
echo "│  rtmp://localhost:1935/live/STREAM_KEY  │"
echo "│                                         │"
echo "│  🎥 HTTP-FLV Playback:                  │"
echo "│  http://localhost:8000/live/STREAM_KEY.flv │"
echo "│                                         │"
echo "│  📊 With Nginx (optional):              │"
echo "│  http://localhost (port 80)             │"
echo "└─────────────────────────────────────────┘"
echo ""
echo "📋 Useful commands:"
echo "  docker-compose logs -f streaming-platform  # View logs"
echo "  docker-compose stop                        # Stop services"
echo "  docker-compose down                        # Stop and remove containers"
echo "  docker-compose down -v                     # Stop and remove containers + volumes"
echo ""
echo "🎬 Ready for streaming! Configure OBS with the RTMP URL above."