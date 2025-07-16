# Video Streaming Platform - Docker Image
FROM node:18-alpine

# Install FFmpeg and other dependencies
RUN apk add --no-cache \
    ffmpeg \
    ffmpeg-dev \
    python3 \
    make \
    g++ \
    git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Switch to non-root user
USER node

# Create necessary directories with proper structure as node user
RUN mkdir -p media recordings/active recordings/completed recordings/thumbnails ssl logs public/hls public/dash config

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "const http = require('http'); \
    const req = http.request('http://localhost:3000/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Expose ports
EXPOSE 3000 1935 8000

# Start the application
CMD ["npm", "start"]