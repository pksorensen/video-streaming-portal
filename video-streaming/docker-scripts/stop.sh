#!/bin/bash
# Video Streaming Platform - Docker Stop Script

set -e

echo "🛑 Stopping Video Streaming Platform..."

# Stop all services
docker-compose down

echo "✅ All services stopped successfully!"
echo ""
echo "To completely remove containers and volumes:"
echo "  docker-compose down -v"
echo ""
echo "To restart:"
echo "  ./docker-scripts/start.sh"