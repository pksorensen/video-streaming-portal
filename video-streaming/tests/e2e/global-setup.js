/**
 * Global Setup for Playwright E2E Tests
 * Initializes test environment, starts services, and prepares test data
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

async function globalSetup() {
    console.log('🚀 Starting global setup for E2E tests...');
    
    // Create test output directories
    await ensureDirectories();
    
    // Initialize test data
    await initializeTestData();
    
    // Setup ffmpeg test streams
    await setupFFmpegTestStreams();
    
    // Wait for services to be ready
    await waitForServices();
    
    console.log('✅ Global setup completed successfully');
}

async function ensureDirectories() {
    const directories = [
        'test-results',
        'test-results/screenshots',
        'test-results/videos',
        'test-results/traces',
        'test-results/playwright-report',
        'tests/e2e/fixtures',
        'tests/e2e/utils'
    ];
    
    for (const dir of directories) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                console.error(`❌ Failed to create directory ${dir}:`, error);
            }
        }
    }
}

async function initializeTestData() {
    const testData = {
        testStreams: {
            basic: {
                key: 'test-basic-stream',
                quality: '720p',
                duration: 30,
                rtmpUrl: 'rtmp://localhost:1935/live/test-basic-stream',
                flvUrl: 'http://localhost:8000/live/test-basic-stream.flv'
            },
            highQuality: {
                key: 'test-hq-stream',
                quality: '1080p',
                duration: 60,
                rtmpUrl: 'rtmp://localhost:1935/live/test-hq-stream',
                flvUrl: 'http://localhost:8000/live/test-hq-stream.flv'
            },
            lowBandwidth: {
                key: 'test-low-bw',
                quality: '480p',
                duration: 45,
                rtmpUrl: 'rtmp://localhost:1935/live/test-low-bw',
                flvUrl: 'http://localhost:8000/live/test-low-bw.flv'
            }
        },
        mockData: {
            sessions: [
                {
                    id: 'session-1',
                    streamPath: '/live/test123',
                    isPublishing: true,
                    connectTime: Date.now() - 30000
                }
            ],
            stats: {
                totalSessions: 1,
                publishingSessions: 1,
                playingSessions: 0,
                uptime: 3600
            }
        },
        testUsers: {
            broadcaster: {
                username: 'test-broadcaster',
                streamKey: 'test-broadcaster-key'
            },
            viewer: {
                username: 'test-viewer'
            }
        }
    };
    
    await fs.writeFile(
        'tests/e2e/fixtures/test-data.json',
        JSON.stringify(testData, null, 2)
    );
}

async function setupFFmpegTestStreams() {
    // Create test stream configuration
    const streamConfig = {
        testPattern: {
            input: 'testsrc=size=640x480:rate=30',
            format: 'lavfi',
            duration: 60
        },
        colorBars: {
            input: 'smptebars=size=1280x720:rate=30',
            format: 'lavfi',
            duration: 120
        },
        audioTest: {
            input: 'sine=frequency=1000:duration=60',
            format: 'lavfi',
            duration: 60
        }
    };
    
    await fs.writeFile(
        'tests/e2e/fixtures/stream-config.json',
        JSON.stringify(streamConfig, null, 2)
    );
    
    // Create ffmpeg test script
    const ffmpegScript = `#!/bin/bash
# FFmpeg test stream generation script

# Function to generate test stream
generate_test_stream() {
    local stream_key=$1
    local duration=${2:-60}
    local quality=${3:-720p}
    
    echo "📡 Generating test stream: $stream_key ($quality, ${duration}s)"
    
    case $quality in
        "480p")
            size="640x480"
            bitrate="500k"
            ;;
        "720p")
            size="1280x720"
            bitrate="1500k"
            ;;
        "1080p")
            size="1920x1080"
            bitrate="3000k"
            ;;
        *)
            size="1280x720"
            bitrate="1500k"
            ;;
    esac
    
    ffmpeg -f lavfi -i "testsrc=size=$size:rate=30" \\
           -f lavfi -i "sine=frequency=1000:duration=$duration" \\
           -c:v libx264 -b:v $bitrate -c:a aac -b:a 128k \\
           -f flv rtmp://localhost:1935/live/$stream_key \\
           -t $duration &
    
    echo $! > "/tmp/stream_$stream_key.pid"
}

# Function to stop test stream
stop_test_stream() {
    local stream_key=$1
    local pid_file="/tmp/stream_$stream_key.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        kill $pid 2>/dev/null
        rm "$pid_file"
        echo "🛑 Stopped test stream: $stream_key"
    fi
}

# Export functions
export -f generate_test_stream
export -f stop_test_stream
`;
    
    await fs.writeFile('tests/e2e/utils/ffmpeg-utils.sh', ffmpegScript);
    
    // Make script executable
    try {
        await fs.chmod('tests/e2e/utils/ffmpeg-utils.sh', '755');
    } catch (error) {
        console.warn('⚠️ Could not set execute permissions on ffmpeg script');
    }
}

async function waitForServices() {
    const services = [
        { name: 'Web Server', url: 'http://localhost:3000/health', timeout: 30000 },
        { name: 'RTMP Server', host: 'localhost', port: 1935, timeout: 30000 },
        { name: 'HTTP-FLV Server', url: 'http://localhost:8000', timeout: 30000 }
    ];
    
    for (const service of services) {
        console.log(`🔍 Waiting for ${service.name}...`);
        await waitForService(service);
        console.log(`✅ ${service.name} is ready`);
    }
}

async function waitForService(service) {
    const startTime = Date.now();
    const timeout = service.timeout || 30000;
    
    while (Date.now() - startTime < timeout) {
        try {
            if (service.url) {
                // HTTP service check
                const response = await fetch(service.url);
                if (response.ok) return;
            } else if (service.host && service.port) {
                // TCP service check
                const net = require('net');
                const socket = new net.Socket();
                
                await new Promise((resolve, reject) => {
                    socket.setTimeout(1000);
                    socket.on('connect', () => {
                        socket.destroy();
                        resolve();
                    });
                    socket.on('error', reject);
                    socket.on('timeout', reject);
                    socket.connect(service.port, service.host);
                });
                
                return;
            }
        } catch (error) {
            // Service not ready, continue waiting
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`${service.name} failed to start within ${timeout}ms`);
}

module.exports = globalSetup;