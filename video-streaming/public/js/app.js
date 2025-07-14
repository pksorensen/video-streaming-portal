/**
 * Video Streaming Platform - Frontend Application
 * Real-time streaming interface with WebSocket integration
 */

class StreamingApp {
    constructor() {
        this.socket = null;
        this.player = null;
        this.flvPlayer = null;
        this.currentStream = null;
        this.streams = new Map();
        this.stats = {
            activeStreams: 0,
            totalSessions: 0,
            uptime: 0
        };
        
        this.init();
    }
    
    init() {
        this.initSocket();
        this.initPlayer();
        this.loadStats();
        this.generateStreamKey();
        this.setupEventListeners();
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            this.loadStats();
            this.refreshStreams();
        }, 30000);
        
        console.log('🎥 Streaming App Initialized');
    }
    
    initSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('🔌 Connected to server');
            this.updateConnectionStatus(true);
        });
        
        this.socket.on('disconnect', () => {
            console.log('🔌 Disconnected from server');
            this.updateConnectionStatus(false);
        });
        
        this.socket.on('stream_started', (data) => {
            console.log('🎬 New stream started:', data);
            this.addStream(data);
            this.showNotification('New stream started!', 'success');
        });
        
        this.socket.on('stream_ended', (data) => {
            console.log('🛑 Stream ended:', data);
            this.removeStream(data);
            this.showNotification('Stream ended', 'info');
        });
        
        this.socket.on('active_streams', (streams) => {
            console.log('📺 Active streams:', streams);
            this.updateStreamsList(streams);
        });
        
        this.socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
            this.showNotification('Connection error', 'danger');
        });
    }
    
    initPlayer() {
        // Initialize Video.js player
        if (document.getElementById('streamPlayer')) {
            this.player = videojs('streamPlayer', {
                fluid: true,
                responsive: true,
                playbackRates: [0.5, 1, 1.25, 1.5, 2],
                plugins: {
                    flvjs: {
                        mediaDataSource: {
                            isLive: true,
                            cors: true,
                            withCredentials: false
                        }
                    }
                },
                html5: {
                    vhs: {
                        overrideNative: true
                    }
                }
            });
            
            this.player.ready(() => {
                console.log('🎥 Video player ready');
            });
            
            this.player.on('error', (error) => {
                console.error('❌ Player error:', error);
                this.showNotification('Playback error occurred', 'danger');
            });
        }
    }
    
    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();
            
            if (data.success) {
                this.updateStats(data.stats);
            }
        } catch (error) {
            console.error('❌ Failed to load stats:', error);
        }
    }
    
    async refreshStreams() {
        try {
            const response = await fetch('/api/streams');
            const data = await response.json();
            
            if (data.success) {
                this.updateStreamsList(data.streams);
            }
        } catch (error) {
            console.error('❌ Failed to refresh streams:', error);
            this.showNotification('Failed to refresh streams', 'danger');
        }
    }
    
    updateStats(stats) {
        this.stats = stats;
        
        // Update UI
        document.getElementById('activeStreams').textContent = stats.publishingSessions || 0;
        document.getElementById('totalSessions').textContent = stats.totalSessions || 0;
        document.getElementById('serverUptime').textContent = this.formatUptime(stats.uptime || 0);
    }
    
    updateStreamsList(streams) {
        const container = document.getElementById('streamsContainer');
        
        if (!streams || streams.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-video fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No active streams. Start broadcasting to see streams here!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = streams.map(stream => this.createStreamCard(stream)).join('');
    }
    
    createStreamCard(stream) {
        const streamKey = this.extractStreamKey(stream.publishStreamPath);
        const isLive = stream.isPublishing;
        const duration = stream.connectTime ? this.formatDuration(Date.now() - stream.connectTime) : '00:00';
        const baseUrl = window.location.protocol + '//' + window.location.hostname;
        const flvUrl = `${baseUrl}:8000/live/${streamKey}.flv`;
        
        return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card stream-card">
                    <div class="card-img-top bg-dark d-flex align-items-center justify-content-center position-relative" style="height: 200px;">
                        <i class="fas fa-video fa-3x text-white"></i>
                        ${isLive ? '<span class="badge bg-danger position-absolute top-0 start-0 m-2">🔴 LIVE</span>' : ''}
                    </div>
                    <div class="card-body">
                        <h5 class="card-title d-flex align-items-center">
                            <span class="status-indicator ${isLive ? 'status-live' : 'status-offline'}"></span>
                            Stream: ${streamKey}
                        </h5>
                        <p class="card-text">
                            <small class="text-muted">
                                <i class="fas fa-clock me-1"></i>Duration: ${duration}<br>
                                <i class="fas fa-link me-1"></i>URL: <code class="small">${flvUrl}</code>
                            </small>
                        </p>
                        <div class="btn-group w-100 mb-2">
                            <button class="btn btn-primary" onclick="app.playStream('${stream.publishStreamPath}')">
                                <i class="fas fa-play me-1"></i>Watch
                            </button>
                            <button class="btn btn-outline-info" onclick="app.openInVLC('${streamKey}')">
                                <i class="fas fa-external-link-alt me-1"></i>VLC
                            </button>
                        </div>
                        <div class="btn-group w-100">
                            <button class="btn btn-outline-secondary btn-sm" onclick="app.copyStreamUrl('${streamKey}')">
                                <i class="fas fa-copy me-1"></i>Copy URL
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="app.stopStreamByPath('${stream.publishStreamPath}')">
                                <i class="fas fa-stop me-1"></i>Stop
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    playStream(streamPath) {
        if (!this.player) {
            this.showNotification('Player not initialized', 'danger');
            return;
        }
        
        if (!streamPath) {
            console.error('❌ playStream: streamPath is undefined/null/empty:', streamPath);
            this.showNotification('Invalid stream path provided', 'danger');
            return;
        }
        
        console.log('🎥 playStream: Starting playback for streamPath:', streamPath);
        const streamKey = this.extractStreamKey(streamPath);
        const baseUrl = window.location.protocol + '//' + window.location.hostname;
        const flvUrl = `${baseUrl}:8000/live/${streamKey}.flv`;
        
        console.log('🎥 Attempting to play stream:', flvUrl);
        
        // Show player section
        document.getElementById('player').style.display = 'block';
        document.getElementById('player').scrollIntoView({ behavior: 'smooth' });
        
        // Update stream info
        document.getElementById('currentStreamPath').textContent = streamPath;
        document.getElementById('currentStreamStatus').textContent = 'Loading...';
        
        // Reset player first
        this.player.reset();
        
        // Try multiple stream formats with FLV as primary
        const sources = [
            {
                src: flvUrl,
                type: 'video/x-flv'
            },
            {
                src: `${baseUrl}:8000/live/${streamKey}/index.m3u8`,
                type: 'application/x-mpegURL'
            }
        ];
        
        // Load stream with FLV.js plugin support
        this.player.src(sources);
        
        // Additional FLV.js direct fallback if Video.js plugin fails
        this.player.one('error', () => {
            console.log('🔄 Video.js failed, trying direct FLV.js...');
            this.tryDirectFLV(flvUrl);
        });
        
        // Add error handling
        this.player.on('error', (error) => {
            console.error('❌ Player error:', error);
            document.getElementById('currentStreamStatus').textContent = 'Error';
            this.showNotification('Stream playback error. Check if stream is active.', 'danger');
        });
        
        this.player.on('loadstart', () => {
            console.log('📡 Stream loading started');
            document.getElementById('currentStreamStatus').textContent = 'Connecting...';
        });
        
        this.player.on('canplay', () => {
            console.log('▶️ Stream ready to play');
            document.getElementById('currentStreamStatus').textContent = 'Ready';
        });
        
        this.player.ready(() => {
            this.player.play().then(() => {
                console.log('▶️ Stream playback started');
                document.getElementById('currentStreamStatus').textContent = 'Playing';
                this.showNotification(`Now playing: ${streamKey}`, 'success');
            }).catch(error => {
                console.error('❌ Playback failed:', error);
                document.getElementById('currentStreamStatus').textContent = 'Error';
                
                // Try alternative playback method
                setTimeout(() => {
                    console.log('🔄 Trying alternative playback...');
                    this.tryAlternativePlayback(streamKey);
                }, 2000);
            });
        });
        
        this.currentStream = streamPath;
    }
    
    tryDirectFLV(flvUrl) {
        if (typeof flvjs === 'undefined') {
            console.error('❌ FLV.js not loaded');
            return;
        }
        
        const videoElement = document.getElementById('streamPlayer_html5_api');
        if (!videoElement) {
            console.error('❌ Video element not found');
            return;
        }
        
        // Create FLV.js player directly
        if (this.flvPlayer) {
            this.flvPlayer.destroy();
        }
        
        this.flvPlayer = flvjs.createPlayer({
            type: 'flv',
            url: flvUrl,
            isLive: true,
            cors: true,
            withCredentials: false
        });
        
        this.flvPlayer.attachMediaElement(videoElement);
        this.flvPlayer.load();
        
        this.flvPlayer.on(flvjs.Events.LOADING_COMPLETE, () => {
            console.log('📺 FLV.js direct loading complete');
            document.getElementById('currentStreamStatus').textContent = 'Playing (FLV.js)';
            this.showNotification('Stream loaded via FLV.js', 'success');
        });
        
        this.flvPlayer.on(flvjs.Events.ERROR, (errorType, errorDetail) => {
            console.error('❌ FLV.js error:', errorType, errorDetail);
            this.showStreamInstructions(this.extractStreamKey(flvUrl));
        });
        
        this.flvPlayer.play();
    }
    
    tryAlternativePlayback(streamKey) {
        const baseUrl = window.location.protocol + '//' + window.location.hostname;
        const flvUrl = `${baseUrl}:8000/live/${streamKey}.flv`;
        
        // Try FLV.js direct approach first
        this.tryDirectFLV(flvUrl);
    }
    
    showStreamInstructions(streamKey) {
        const baseUrl = window.location.protocol + '//' + window.location.hostname;
        const message = `
            <strong>Stream not available for playback.</strong><br>
            <br>
            <strong>Direct URLs to try:</strong><br>
            • FLV: <code>${baseUrl}:8000/live/${streamKey}.flv</code><br>
            • HLS: <code>${baseUrl}:8000/live/${streamKey}/index.m3u8</code><br>
            <br>
            <em>You can open these URLs in VLC or another media player.</em>
        `;
        
        document.getElementById('currentStreamStatus').innerHTML = message;
        this.showNotification('Stream URLs generated - try in VLC player', 'info');
    }
    
    async stopStreamByPath(streamPath) {
        const streamKey = this.extractStreamKey(streamPath);
        
        try {
            const response = await fetch(`/api/streams/${streamKey}/stop`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Stream stopped successfully', 'success');
                this.refreshStreams();
            } else {
                this.showNotification(data.message || 'Failed to stop stream', 'danger');
            }
        } catch (error) {
            console.error('❌ Failed to stop stream:', error);
            this.showNotification('Failed to stop stream', 'danger');
        }
    }
    
    stopStream() {
        if (this.player) {
            this.player.pause();
            this.player.src('');
        }
        
        // Clean up FLV.js player if it exists
        if (this.flvPlayer) {
            this.flvPlayer.destroy();
            this.flvPlayer = null;
        }
        
        document.getElementById('player').style.display = 'none';
        document.getElementById('currentStreamStatus').textContent = 'Stopped';
        this.currentStream = null;
        
        this.showNotification('Playback stopped', 'info');
    }
    
    generateStreamKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let key = '';
        for (let i = 0; i < 16; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        document.getElementById('streamKey').value = key;
        document.getElementById('modalStreamKey').value = key;
        
        return key;
    }
    
    addStream(streamData) {
        this.streams.set(streamData.streamPath, streamData);
        this.refreshStreams();
    }
    
    removeStream(streamData) {
        this.streams.delete(streamData.streamPath);
        this.refreshStreams();
        
        // Stop playing if this was the current stream
        if (this.currentStream === streamData.streamPath) {
            this.stopStream();
        }
    }
    
    extractStreamKey(streamPath) {
        if (!streamPath) {
            console.error('❌ extractStreamKey: streamPath is undefined/null/empty:', streamPath);
            return 'unknown';
        }
        
        console.log('🔍 extractStreamKey: Processing streamPath:', streamPath);
        const parts = streamPath.split('/');
        const key = parts[parts.length - 1] || 'unknown';
        console.log('🔑 extractStreamKey: Extracted key:', key);
        return key;
    }
    
    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
    
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        }
        return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    
    updateConnectionStatus(connected) {
        const indicator = document.querySelector('.connection-status');
        if (indicator) {
            indicator.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
            indicator.textContent = connected ? 'Connected' : 'Disconnected';
        }
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
    
    setupEventListeners() {
        // Update RTMP URL based on current location
        const rtmpUrl = `rtmp://${window.location.hostname}:1935/live`;
        document.getElementById('rtmpUrl').textContent = rtmpUrl;
        
        // Copy stream settings functionality
        window.copyStreamSettings = () => {
            const url = document.getElementById('rtmpUrl').textContent;
            const key = document.getElementById('streamKey').value;
            const settings = `RTMP URL: ${url}\nStream Key: ${key}`;
            
            navigator.clipboard.writeText(settings).then(() => {
                this.showNotification('Stream settings copied to clipboard!', 'success');
            }).catch(() => {
                this.showNotification('Failed to copy settings', 'danger');
            });
        };
    }
    
    copyStreamUrl(streamKey) {
        const baseUrl = window.location.protocol + '//' + window.location.hostname;
        const flvUrl = `${baseUrl}:8000/live/${streamKey}.flv`;
        
        navigator.clipboard.writeText(flvUrl).then(() => {
            this.showNotification('Stream URL copied to clipboard!', 'success');
        }).catch(() => {
            this.showNotification('Failed to copy URL', 'danger');
        });
    }
    
    openInVLC(streamKey) {
        const baseUrl = window.location.protocol + '//' + window.location.hostname;
        const flvUrl = `${baseUrl}:8000/live/${streamKey}.flv`;
        
        // Try to open VLC protocol
        const vlcUrl = `vlc://${flvUrl}`;
        
        // Create a temporary link and click it
        const link = document.createElement('a');
        link.href = vlcUrl;
        link.click();
        
        // Also show instructions
        this.showNotification(`
            <strong>VLC Instructions:</strong><br>
            1. Open VLC Media Player<br>
            2. Media → Open Network Stream<br>
            3. Enter: <code>${flvUrl}</code><br>
            4. Click Play
        `, 'info');
    }
}

// Global functions for HTML onclick handlers
window.showStreamingInfo = () => {
    const modal = new bootstrap.Modal(document.getElementById('streamModal'));
    modal.show();
};

window.viewLiveStreams = () => {
    document.getElementById('streams').scrollIntoView({ behavior: 'smooth' });
};

window.refreshStreams = () => {
    app.refreshStreams();
};

window.generateStreamKey = () => {
    app.generateStreamKey();
};

window.stopStream = () => {
    app.stopStream();
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new StreamingApp();
});