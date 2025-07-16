# Video Streaming Platform - Docker Image
FROM node:20-alpine

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

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN apk add --no-cache rsync
RUN apk add --no-cache openssh
RUN apk add --no-cache sshpass

# Create necessary directories with proper structure as root user
RUN mkdir -p media ssl logs public/hls public/dash config

# Change ownership of all directories to node user
RUN chown -R nextjs:nodejs /app

ENV RECORDINGS_DIR="/app/recordings"
RUN mkdir -p ${RECORDINGS_DIR} && chown -R nextjs:nodejs ${RECORDINGS_DIR} && chmod 755 ${RECORDINGS_DIR}

# Switch to non-root user
USER nextjs

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