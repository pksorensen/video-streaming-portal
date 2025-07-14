#!/usr/bin/env node

/**
 * Comprehensive validation script for the streaming platform fix
 * Tests the race condition fix by simulating stream events and checking dashboard response
 */

const { spawn } = require('child_process');
const http = require('http');
const { io } = require('socket.io-client');

class StreamingFixValidator {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.rtmpUrl = 'rtmp://localhost:1935/live/';
        this.streamKey = `validate-fix-${Date.now()}`;
        this.socket = null;
        this.events = [];
        this.startTime = Date.now();
    }

    log(message) {
        const timestamp = Date.now() - this.startTime;
        console.log(`[${timestamp}ms] ${message}`);
        this.events.push({ timestamp, message });
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async checkApiStreams() {
        return new Promise((resolve, reject) => {
            const req = http.get(`${this.baseUrl}/api/streams`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            req.on('error', reject);
            req.setTimeout(5000, () => reject(new Error('API request timeout')));
        });
    }

    setupWebSocketListener() {
        this.socket = io(this.baseUrl);
        
        this.socket.on('connect', () => {
            this.log('✅ WebSocket connected');
        });

        this.socket.on('disconnect', () => {
            this.log('❌ WebSocket disconnected');
        });

        this.socket.on('stream_started', (data) => {
            this.log(`🚀 TOAST NOTIFICATION: Stream started - ${JSON.stringify(data)}`);
            // Immediately check API after toast notification
            setTimeout(async () => {
                try {
                    const apiResponse = await this.checkApiStreams();
                    this.log(`📊 API RESPONSE (100ms after toast): ${JSON.stringify(apiResponse)}`);
                    
                    if (apiResponse.streams && apiResponse.streams.length > 0) {
                        this.log('✅ SUCCESS: Dashboard shows streams immediately after toast!');
                        this.testResult = 'PASS';
                    } else {
                        this.log('❌ FAIL: Dashboard still empty after toast notification');
                        this.testResult = 'FAIL';
                    }
                } catch (error) {
                    this.log(`❌ API ERROR: ${error.message}`);
                    this.testResult = 'ERROR';
                }
            }, 100);
        });

        this.socket.on('stream_ended', (data) => {
            this.log(`🛑 Stream ended - ${JSON.stringify(data)}`);
        });
    }

    async startTestStream() {
        this.log(`🎬 Starting test stream with key: ${this.streamKey}`);
        
        const ffmpegArgs = [
            '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=15',
            '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=22050',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
            '-c:a', 'aac', '-ar', '22050', '-b:a', '64k',
            '-g', '30', '-keyint_min', '30', '-sc_threshold', '0',
            '-b:v', '500k', '-maxrate', '500k', '-bufsize', '1000k',
            '-f', 'flv',
            '-t', '10',  // 10 second test stream
            `${this.rtmpUrl}${this.streamKey}`
        ];

        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            ffmpeg.stdout.on('data', (data) => {
                // Log key ffmpeg output
                const output = data.toString();
                if (output.includes('fps=') || output.includes('bitrate=')) {
                    this.log(`📺 FFmpeg: ${output.trim().slice(-50)}`);
                }
            });

            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                if (output.includes('frame=') || output.includes('fps=')) {
                    // Log encoding progress
                    const lines = output.split('\n');
                    const progressLine = lines.find(line => line.includes('frame='));
                    if (progressLine) {
                        this.log(`⚡ Encoding: ${progressLine.trim()}`);
                    }
                }
            });

            ffmpeg.on('close', (code) => {
                this.log(`🏁 FFmpeg stream ended with code: ${code}`);
                resolve(code);
            });

            ffmpeg.on('error', (error) => {
                this.log(`❌ FFmpeg error: ${error.message}`);
                reject(error);
            });

            // Kill ffmpeg after timeout
            setTimeout(() => {
                if (!ffmpeg.killed) {
                    this.log('⏰ Timeout - stopping FFmpeg');
                    ffmpeg.kill('SIGTERM');
                }
            }, 15000);
        });
    }

    async runValidation() {
        console.log('🧪 STREAMING PLATFORM FIX VALIDATION');
        console.log('=====================================');
        
        try {
            // Initial state check
            this.log('🔍 Checking initial state...');
            const initialStreams = await this.checkApiStreams();
            this.log(`📊 Initial streams: ${JSON.stringify(initialStreams)}`);

            // Setup WebSocket listener
            this.log('🔌 Setting up WebSocket listener...');
            this.setupWebSocketListener();
            
            // Wait for WebSocket connection
            await this.wait(2000);

            // Start test stream
            this.log('🎯 Starting validation test...');
            await this.startTestStream();

            // Wait for events to settle
            await this.wait(3000);

            // Final state check
            this.log('🔍 Checking final state...');
            const finalStreams = await this.checkApiStreams();
            this.log(`📊 Final streams: ${JSON.stringify(finalStreams)}`);

            // Generate report
            this.generateReport();

        } catch (error) {
            this.log(`❌ Validation failed: ${error.message}`);
            this.testResult = 'ERROR';
        } finally {
            if (this.socket) {
                this.socket.disconnect();
            }
        }
    }

    generateReport() {
        console.log('\n🎯 VALIDATION REPORT');
        console.log('===================');
        
        const hasToastEvent = this.events.some(e => e.message.includes('TOAST NOTIFICATION'));
        const hasApiResponse = this.events.some(e => e.message.includes('API RESPONSE'));
        const hasSuccess = this.events.some(e => e.message.includes('SUCCESS: Dashboard shows streams'));
        
        console.log(`📈 Test Result: ${this.testResult || 'INCOMPLETE'}`);
        console.log(`🚀 Toast Notification Received: ${hasToastEvent ? '✅ YES' : '❌ NO'}`);
        console.log(`📊 API Response Checked: ${hasApiResponse ? '✅ YES' : '❌ NO'}`);
        console.log(`✅ Fix Validated: ${hasSuccess ? '✅ YES' : '❌ NO'}`);
        
        if (this.testResult === 'PASS') {
            console.log('\n🎉 SUCCESS! The race condition fix is working correctly.');
            console.log('   Toast notifications and dashboard updates are now synchronized.');
        } else if (this.testResult === 'FAIL') {
            console.log('\n❌ FAILURE! The race condition still exists.');
            console.log('   Dashboard is not updating immediately when toast notifications appear.');
        } else {
            console.log('\n⚠️  Test was incomplete or encountered errors.');
        }
        
        console.log('\n📝 Event Timeline:');
        this.events.forEach(event => {
            console.log(`   ${event.timestamp}ms: ${event.message}`);
        });
    }
}

// Run validation
const validator = new StreamingFixValidator();
validator.runValidation().then(() => {
    console.log('\n🏁 Validation completed');
    process.exit(0);
}).catch((error) => {
    console.error('💥 Validation failed:', error);
    process.exit(1);
});