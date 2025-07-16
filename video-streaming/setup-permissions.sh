#!/bin/bash

# Video Streaming Platform - Setup Permissions Script
# This script ensures proper permissions for Docker volume mounts

echo "🔧 Setting up permissions for video streaming platform..."

# Create directories if they don't exist
mkdir -p media recordings/active recordings/completed recordings/thumbnails logs ssl config

# Set proper permissions
echo "📁 Setting permissions for media directory..."
chmod -R 755 media

echo "📁 Setting permissions for recordings directory..."
chmod -R 755 recordings

echo "📁 Setting permissions for logs directory..."
chmod -R 755 logs

echo "📁 Setting permissions for ssl directory..."
chmod -R 755 ssl

echo "📁 Setting permissions for config directory..."
chmod -R 755 config

# Make sure current user owns the directories
echo "👤 Setting ownership for current user..."
chown -R $USER:$USER media recordings logs ssl config

# Verify permissions
echo "✅ Verifying permissions..."
ls -la media recordings logs ssl config

echo "🎉 Permissions setup complete!"
echo "💡 You can now run 'docker-compose up' safely."