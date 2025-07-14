#!/bin/bash

# Test stream script for validating the streaming platform fix
echo "🎬 Starting test stream to validate dashboard fix..."

# Generate a test stream key
STREAM_KEY="test-fix-$(date +%s)"
echo "📡 Stream Key: $STREAM_KEY"

# Test stream parameters
RTMP_URL="rtmp://localhost:1935/live/$STREAM_KEY"
echo "🔗 RTMP URL: $RTMP_URL"

# Create a test pattern video with ffmpeg and stream it
echo "▶️ Starting ffmpeg test stream..."
echo "   This will create a 30-second test stream with color bars and timer"
echo "   Use Ctrl+C to stop the stream"

# Run ffmpeg to create test stream
ffmpeg -f lavfi -i testsrc2=size=640x480:rate=30 \
       -f lavfi -i sine=frequency=1000:sample_rate=44100 \
       -c:v libx264 -preset veryfast -tune zerolatency \
       -c:a aac -ar 44100 -b:a 128k \
       -g 60 -keyint_min 60 -sc_threshold 0 \
       -b:v 1000k -maxrate 1000k -bufsize 2000k \
       -f flv \
       -t 30 \
       "$RTMP_URL" 2>&1 | head -20

echo "✅ Test stream completed"
echo "🧪 Check the dashboard at http://localhost:3000 to verify the fix"
echo "📊 Check API at http://localhost:3000/api/streams"