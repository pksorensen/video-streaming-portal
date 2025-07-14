/**
 * Stream Simulator for E2E Testing
 * Generates test streams using ffmpeg for realistic testing scenarios
 */

const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

class StreamSimulator {
    constructor() {
        this.activeStreams = new Map();
        this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    }
    
    /**
     * Start a test stream using ffmpeg
     * @param {string} streamKey - Unique stream identifier
     * @param {object} options - Stream configuration options
     */
    async startStream(streamKey, options = {}) {
        const config = {
            duration: options.duration || 60,
            quality: options.quality || '720p',
            fps: options.fps || 30,
            audioFreq: options.audioFreq || 1000,
            ...options
        };
        
        console.log(`📡 Starting test stream: ${streamKey} (${config.quality}, ${config.duration}s)`);
        
        // Generate stream using ffmpeg
        const ffmpegArgs = this.buildFFmpegArgs(streamKey, config);
        
        try {
            const process = spawn(this.ffmpegPath, ffmpegArgs, {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            this.activeStreams.set(streamKey, {
                process,
                config,
                startTime: Date.now(),
                pid: process.pid
            });
            
            // Handle process events
            process.on('error', (error) => {
                console.error(`❌ FFmpeg error for stream ${streamKey}:`, error);
                this.activeStreams.delete(streamKey);
            });
            
            process.on('exit', (code) => {
                console.log(`🛑 Stream ${streamKey} ended with code ${code}`);
                this.activeStreams.delete(streamKey);
            });
            
            // Log ffmpeg output for debugging
            process.stderr.on('data', (data) => {
                const output = data.toString();
                if (output.includes('frame=') || output.includes('time=')) {
                    // Progress information
                    console.log(`⏱️ Stream ${streamKey} progress: ${output.trim()}`);
                }
            });
            
            // Wait for stream to start
            await this.waitForStreamStart(streamKey);
            
            console.log(`✅ Test stream ${streamKey} started successfully`);
            
        } catch (error) {
            console.error(`❌ Failed to start stream ${streamKey}:`, error);
            throw error;
        }
    }
    
    /**
     * Stop a test stream
     * @param {string} streamKey - Stream identifier to stop
     */
    async stopStream(streamKey) {
        const stream = this.activeStreams.get(streamKey);
        
        if (!stream) {
            console.warn(`⚠️ Stream ${streamKey} not found`);
            return;
        }
        
        try {
            stream.process.kill('SIGTERM');
            
            // Wait for graceful shutdown
            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    stream.process.kill('SIGKILL');
                    resolve();
                }, 5000);
                
                stream.process.on('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
            
            this.activeStreams.delete(streamKey);
            console.log(`🛑 Stream ${streamKey} stopped`);
            
        } catch (error) {
            console.error(`❌ Error stopping stream ${streamKey}:`, error);
        }
    }
    
    /**
     * Validate that a stream is accessible
     * @param {string} streamKey - Stream identifier to validate
     */
    async validateStream(streamKey) {
        const baseUrl = 'http://localhost:8000';
        const flvUrl = `${baseUrl}/live/${streamKey}.flv`;
        
        try {
            const response = await fetch(flvUrl, {
                method: 'HEAD',
                timeout: 5000
            });
            
            return {
                accessible: response.ok,
                status: response.status,
                contentType: response.headers.get('content-type'),
                url: flvUrl
            };
            
        } catch (error) {
            return {
                accessible: false,
                error: error.message,
                url: flvUrl
            };
        }
    }
    
    /**
     * Get stream quality metrics
     * @param {string} streamKey - Stream identifier
     */
    async getStreamMetrics(streamKey) {
        const stream = this.activeStreams.get(streamKey);
        
        if (!stream) {
            return null;
        }
        
        const duration = Date.now() - stream.startTime;
        
        return {
            streamKey,
            duration,
            quality: stream.config.quality,
            fps: stream.config.fps,
            isActive: true,
            pid: stream.pid
        };
    }
    
    /**
     * Create a stream with specific test pattern
     * @param {string} streamKey - Stream identifier
     * @param {string} pattern - Test pattern type
     */
    async createTestPattern(streamKey, pattern = 'colorBars') {
        const patterns = {
            colorBars: {
                video: 'smptebars=size=1280x720:rate=30',
                audio: 'sine=frequency=1000:duration=120'
            },
            testCard: {
                video: 'testsrc=size=1920x1080:rate=30',
                audio: 'sine=frequency=440:duration=120'
            },
            noise: {
                video: 'testsrc=size=640x480:rate=30',
                audio: 'anoisesrc=duration=120:color=white'
            }
        };
        
        const config = patterns[pattern] || patterns.colorBars;
        
        await this.startStream(streamKey, {
            videoInput: config.video,
            audioInput: config.audio,
            duration: 120,
            quality: '720p'
        });
    }
    
    /**
     * Simulate network conditions
     * @param {string} streamKey - Stream identifier
     * @param {object} conditions - Network condition parameters
     */
    async simulateNetworkConditions(streamKey, conditions = {}) {
        const {
            bandwidth = '1000k',
            latency = '100ms',
            packetLoss = '0.1%'
        } = conditions;
        
        // This would integrate with network simulation tools
        // For now, we'll adjust ffmpeg parameters
        const stream = this.activeStreams.get(streamKey);
        
        if (stream) {
            console.log(`🌐 Simulating network conditions for ${streamKey}:`, conditions);
            // Network simulation implementation would go here
        }
    }
    
    /**
     * Get list of all active streams
     */
    getActiveStreams() {
        return Array.from(this.activeStreams.keys());
    }
    
    /**
     * Clean up all active streams
     */
    async cleanup() {
        console.log('🧹 Cleaning up all test streams...');
        
        const streamKeys = this.getActiveStreams();
        
        for (const streamKey of streamKeys) {
            await this.stopStream(streamKey);
        }
        
        // Additional cleanup for any orphaned processes
        try {
            await execAsync('pkill -f "ffmpeg.*rtmp://localhost:1935/live" || true');
        } catch (error) {
            // Ignore cleanup errors
        }
        
        console.log('✅ Stream cleanup completed');
    }
    
    /**
     * Build ffmpeg arguments for stream generation
     */
    buildFFmpegArgs(streamKey, config) {
        const { quality, duration, fps, audioFreq } = config;
        
        // Video settings based on quality
        const videoSettings = this.getVideoSettings(quality);
        
        // Base ffmpeg arguments
        const args = [
            // Video input (test pattern)
            '-f', 'lavfi',
            '-i', config.videoInput || `testsrc=size=${videoSettings.size}:rate=${fps}`,
            
            // Audio input (test tone)
            '-f', 'lavfi',
            '-i', config.audioInput || `sine=frequency=${audioFreq}:duration=${duration}`,
            
            // Video codec settings
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-b:v', videoSettings.bitrate,
            '-maxrate', videoSettings.bitrate,
            '-bufsize', videoSettings.bufsize,
            '-r', fps.toString(),
            '-g', (fps * 2).toString(), // GOP size
            '-keyint_min', fps.toString(),
            
            // Audio codec settings
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '44100',
            '-ac', '2',
            
            // Output settings
            '-f', 'flv',
            '-flvflags', 'no_duration_filesize',
            
            // Duration
            '-t', duration.toString(),
            
            // Output URL
            `rtmp://localhost:1935/live/${streamKey}`
        ];
        
        return args;
    }
    
    /**
     * Get video settings for different quality levels
     */
    getVideoSettings(quality) {
        const settings = {
            '480p': {
                size: '640x480',
                bitrate: '500k',
                bufsize: '1000k'
            },
            '720p': {
                size: '1280x720',
                bitrate: '1500k',
                bufsize: '3000k'
            },
            '1080p': {
                size: '1920x1080',
                bitrate: '3000k',
                bufsize: '6000k'
            }
        };
        
        return settings[quality] || settings['720p'];
    }
    
    /**
     * Wait for stream to start (basic check)
     */
    async waitForStreamStart(streamKey, timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const validation = await this.validateStream(streamKey);
            
            if (validation.accessible) {
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        throw new Error(`Stream ${streamKey} failed to start within ${timeout}ms`);
    }
}

module.exports = StreamSimulator;