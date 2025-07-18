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
        this.recordings = new Map();
        this.forwardingConfigs = new Map();
        this.activeForwarding = new Map();
        this.stats = {
            activeStreams: 0,
            totalSessions: 0,
            uptime: 0
        };
        this.config = {
            flvBaseUrl: null
        };
        
        this.init();
    }
    
    async init() {
        await this.loadConfig();
        this.initSocket();
        this.initPlayer();
        this.loadStats();
        this.generateStreamKey();
        this.setupEventListeners();
        this.loadRecordings();
        this.loadForwardingConfigs();
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            this.loadStats();
            this.refreshStreams();
            this.refreshRecordings();
            this.refreshActiveForwarding();
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
    
    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            const data = await response.json();
            
            if (data.success) {
                this.config = data.config;
                console.log('⚙️ Configuration loaded:', this.config);
            } else {
                console.error('❌ Failed to load config:', data.message);
                // Fallback to default behavior
                this.config.flvBaseUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
            }
        } catch (error) {
            console.error('❌ Failed to load config:', error);
            // Fallback to default behavior
            this.config.flvBaseUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
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
    
    async loadRecordings() {
        try {
            const response = await fetch('/api/recordings');
            const data = await response.json();
            
            if (data.success) {
                this.updateRecordingsList(data.recordings);
            }
        } catch (error) {
            console.error('❌ Failed to load recordings:', error);
        }
    }
    
    async refreshRecordings() {
        try {
            const response = await fetch('/api/recordings');
            const data = await response.json();
            
            if (data.success) {
                this.updateRecordingsList(data.recordings);
            }
        } catch (error) {
            console.error('❌ Failed to refresh recordings:', error);
            this.showNotification('Failed to refresh recordings', 'danger');
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
    
    updateRecordingsList(recordings) {
        const container = document.getElementById('recordingsContainer');
        
        if (!recordings || recordings.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-video fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No recordings available. Start a live stream to create recordings!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recordings.map(recording => this.createRecordingCard(recording)).join('');
    }
    
    createRecordingCard(recording) {
        const duration = this.formatDuration(recording.duration || 0);
        const fileSize = this.formatFileSize(recording.fileSize || 0);
        const recordingDate = new Date(recording.startTime).toLocaleString();
        const isCompleted = recording.status === 'completed';
        
        return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card recording-card">
                    <div class="card-img-top bg-secondary d-flex align-items-center justify-content-center position-relative" style="height: 200px;">
                        <i class="fas fa-video fa-3x text-white"></i>
                        <span class="badge ${recording.status === 'completed' ? 'bg-success' : recording.status === 'failed' ? 'bg-danger' : 'bg-warning'} position-absolute top-0 start-0 m-2">
                            ${recording.status === 'completed' ? '✅ Completed' : recording.status === 'failed' ? '❌ Failed' : '⏳ Processing'}
                        </span>
                    </div>
                    <div class="card-body">
                        <h5 class="card-title">
                            <i class="fas fa-archive me-2"></i>
                            ${recording.streamKey}
                        </h5>
                        <p class="card-text">
                            <small class="text-muted">
                                <i class="fas fa-clock me-1"></i>Duration: ${duration}<br>
                                <i class="fas fa-hdd me-1"></i>Size: ${fileSize}<br>
                                <i class="fas fa-calendar me-1"></i>Recorded: ${recordingDate}
                            </small>
                        </p>
                        <div class="btn-group w-100 mb-2">
                            ${recording.status === 'completed' ? `
                                <button class="btn btn-primary" onclick="app.playRecording('${recording.id}')">
                                    <i class="fas fa-play me-1"></i>Play
                                </button>
                                <button class="btn btn-outline-success" onclick="app.downloadRecording('${recording.id}')">
                                    <i class="fas fa-download me-1"></i>Download
                                </button>
                            ` : recording.status === 'failed' ? `
                                <button class="btn btn-danger" disabled>
                                    <i class="fas fa-exclamation-triangle me-1"></i>Failed
                                </button>
                            ` : `
                                <button class="btn btn-secondary" disabled>
                                    <i class="fas fa-spinner fa-spin me-1"></i>Processing...
                                </button>
                            `}
                        </div>
                        <div class="btn-group w-100">
                            <button class="btn btn-outline-info btn-sm" onclick="app.showRecordingInfo('${recording.id}')">
                                <i class="fas fa-info-circle me-1"></i>Info
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="app.deleteRecording('${recording.id}')">
                                <i class="fas fa-trash me-1"></i>Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    createStreamCard(stream) {
        const streamKey = this.extractStreamKey(stream.publishStreamPath);
        const isLive = stream.isPublishing;
        const duration = stream.connectTime ? this.formatDuration(Date.now() - stream.connectTime) : '00:00';
        const flvUrl = `${this.config.flvBaseUrl}/live/${streamKey}.flv`;
        
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
        const flvUrl = `${this.config.flvBaseUrl}/live/${streamKey}.flv`;
        
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
                src: `${this.config.flvBaseUrl}/live/${streamKey}/index.m3u8`,
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
        const flvUrl = `${this.config.flvBaseUrl}/live/${streamKey}.flv`;
        
        // Try FLV.js direct approach first
        this.tryDirectFLV(flvUrl);
    }
    
    showStreamInstructions(streamKey) {
        const message = `
            <strong>Stream not available for playback.</strong><br>
            <br>
            <strong>Direct URLs to try:</strong><br>
            • FLV: <code>${this.config.flvBaseUrl}/live/${streamKey}.flv</code><br>
            • HLS: <code>${this.config.flvBaseUrl}/live/${streamKey}/index.m3u8</code><br>
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
        const flvUrl = `${this.config.flvBaseUrl}/live/${streamKey}.flv`;
        
        navigator.clipboard.writeText(flvUrl).then(() => {
            this.showNotification('Stream URL copied to clipboard!', 'success');
        }).catch(() => {
            this.showNotification('Failed to copy URL', 'danger');
        });
    }
    
    openInVLC(streamKey) {
        const flvUrl = `${this.config.flvBaseUrl}/live/${streamKey}.flv`;
        
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
    
    async playRecording(recordingId) {
        try {
            const response = await fetch(`/api/recordings/${recordingId}`);
            const data = await response.json();
            
            if (!data.success) {
                this.showNotification('Recording not found', 'danger');
                return;
            }
            
            const recording = data.recording;
            const recordingUrl = `/api/recordings/${recordingId}/download`;
            
            // Show player section
            document.getElementById('player').style.display = 'block';
            document.getElementById('player').scrollIntoView({ behavior: 'smooth' });
            
            // Update stream info
            document.getElementById('currentStreamPath').textContent = `Recording: ${recording.streamKey}`;
            document.getElementById('currentStreamStatus').textContent = 'Loading...';
            
            // Reset player first
            this.player.reset();
            
            // Load recording
            this.player.src({
                src: recordingUrl,
                type: 'video/x-flv'
            });
            
            this.player.ready(() => {
                this.player.play().then(() => {
                    console.log('▶️ Recording playback started');
                    document.getElementById('currentStreamStatus').textContent = 'Playing Recording';
                    this.showNotification(`Now playing recording: ${recording.streamKey}`, 'success');
                }).catch(error => {
                    console.error('❌ Playback failed:', error);
                    document.getElementById('currentStreamStatus').textContent = 'Error';
                    this.showNotification('Recording playback failed', 'danger');
                });
            });
            
        } catch (error) {
            console.error('❌ Failed to play recording:', error);
            this.showNotification('Failed to play recording', 'danger');
        }
    }
    
    async downloadRecording(recordingId) {
        try {
            const response = await fetch(`/api/recordings/${recordingId}`);
            const data = await response.json();
            
            if (!data.success) {
                this.showNotification('Recording not found', 'danger');
                return;
            }
            
            const recording = data.recording;
            const downloadUrl = `/api/recordings/${recordingId}/download`;
            
            // Create a temporary link and click it
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = recording.filename;
            link.click();
            
            this.showNotification(`Downloading: ${recording.filename}`, 'success');
            
        } catch (error) {
            console.error('❌ Failed to download recording:', error);
            this.showNotification('Failed to download recording', 'danger');
        }
    }
    
    async showRecordingInfo(recordingId) {
        try {
            const response = await fetch(`/api/recordings/${recordingId}`);
            const data = await response.json();
            
            if (!data.success) {
                this.showNotification('Recording not found', 'danger');
                return;
            }
            
            const recording = data.recording;
            const duration = this.formatDuration(recording.duration || 0);
            const fileSize = this.formatFileSize(recording.fileSize || 0);
            const recordingDate = new Date(recording.startTime).toLocaleString();
            const endDate = recording.endTime ? new Date(recording.endTime).toLocaleString() : 'N/A';
            
            const infoMessage = `
                <strong>Recording Information</strong><br><br>
                <strong>Stream Key:</strong> ${recording.streamKey}<br>
                <strong>Filename:</strong> ${recording.filename}<br>
                <strong>Duration:</strong> ${duration}<br>
                <strong>File Size:</strong> ${fileSize}<br>
                <strong>Status:</strong> ${recording.status}<br>
                <strong>Started:</strong> ${recordingDate}<br>
                <strong>Ended:</strong> ${endDate}<br>
                <strong>Stream Path:</strong> ${recording.streamPath}
            `;
            
            this.showNotification(infoMessage, 'info');
            
        } catch (error) {
            console.error('❌ Failed to get recording info:', error);
            this.showNotification('Failed to get recording info', 'danger');
        }
    }
    
    async deleteRecording(recordingId) {
        if (!confirm('Are you sure you want to delete this recording? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/recordings/${recordingId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Recording deleted successfully', 'success');
                this.refreshRecordings();
            } else {
                this.showNotification(data.message || 'Failed to delete recording', 'danger');
            }
            
        } catch (error) {
            console.error('❌ Failed to delete recording:', error);
            this.showNotification('Failed to delete recording', 'danger');
        }
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Forwarding methods
    async loadForwardingConfigs() {
        try {
            const response = await fetch('/api/forwarding/configs');
            const data = await response.json();
            
            if (data.success) {
                this.updateForwardingConfigsList(data.configs);
            }
        } catch (error) {
            console.error('❌ Failed to load forwarding configs:', error);
        }
    }
    
    async refreshForwardingConfigs() {
        try {
            const response = await fetch('/api/forwarding/configs');
            const data = await response.json();
            
            if (data.success) {
                this.updateForwardingConfigsList(data.configs);
            }
        } catch (error) {
            console.error('❌ Failed to refresh forwarding configs:', error);
            this.showNotification('Failed to refresh forwarding configs', 'danger');
        }
    }
    
    async refreshActiveForwarding() {
        try {
            const response = await fetch('/api/forwarding/active');
            const data = await response.json();
            
            if (data.success) {
                this.updateActiveForwardingList(data.forwarding);
            }
        } catch (error) {
            console.error('❌ Failed to refresh active forwarding:', error);
        }
    }
    
    updateForwardingConfigsList(configs) {
        const container = document.getElementById('forwardingConfigsContainer');
        
        if (!configs || configs.length === 0) {
            container.innerHTML = `
                <p class="text-muted">No forwarding configurations. Add a destination to get started!</p>
            `;
            return;
        }
        
        container.innerHTML = configs.map(config => this.createForwardingConfigCard(config)).join('');
    }
    
    createForwardingConfigCard(config) {
        const isEnabled = config.enabled;
        const createdDate = new Date(config.createdAt).toLocaleDateString();
        
        return `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <h5 class="card-title mb-1">
                                <i class="fas fa-${this.getPlatformIcon(config.platform)} me-2"></i>
                                ${config.name}
                                <span class="badge ${isEnabled ? 'bg-success' : 'bg-secondary'} ms-2">
                                    ${isEnabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </h5>
                            <p class="card-text mb-2">
                                <strong>Platform:</strong> ${config.platform}<br>
                                <strong>URL:</strong> <code class="small">${config.rtmpUrl}</code><br>
                                <strong>Created:</strong> ${createdDate}
                            </p>
                        </div>
                        <div class="col-md-4 text-end">
                            <div class="btn-group">
                                <button class="btn btn-sm ${isEnabled ? 'btn-warning' : 'btn-success'}" 
                                        onclick="toggleForwardingConfig('${config.id}')">
                                    <i class="fas fa-${isEnabled ? 'pause' : 'play'} me-1"></i>
                                    ${isEnabled ? 'Disable' : 'Enable'}
                                </button>
                                <button class="btn btn-sm btn-outline-primary" 
                                        onclick="editForwardingConfig('${config.id}')">
                                    <i class="fas fa-edit me-1"></i>Edit
                                </button>
                                <button class="btn btn-sm btn-outline-danger" 
                                        onclick="deleteForwardingConfig('${config.id}')">
                                    <i class="fas fa-trash me-1"></i>Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    updateActiveForwardingList(forwarding) {
        const container = document.getElementById('activeForwardingContainer');
        
        if (!forwarding || forwarding.length === 0) {
            container.innerHTML = `
                <p class="text-muted">No active forwarding sessions</p>
            `;
            return;
        }
        
        container.innerHTML = forwarding.map(forward => this.createActiveForwardingCard(forward)).join('');
    }
    
    createActiveForwardingCard(forward) {
        const duration = this.formatDuration(Math.floor(forward.duration / 1000));
        const status = forward.status;
        const statusClass = status === 'running' ? 'success' : 
                          status === 'error' ? 'danger' : 'warning';
        
        return `
            <div class="card mb-2">
                <div class="card-body py-2">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <h6 class="mb-1">
                                <i class="fas fa-${this.getPlatformIcon(forward.platform)} me-2"></i>
                                ${forward.name}
                                <span class="badge bg-${statusClass} ms-2">
                                    ${status.toUpperCase()}
                                </span>
                            </h6>
                            <small class="text-muted">
                                <i class="fas fa-clock me-1"></i>Duration: ${duration}
                                ${forward.retryCount > 0 ? `<i class="fas fa-redo ms-2 me-1"></i>Retries: ${forward.retryCount}` : ''}
                            </small>
                        </div>
                        <div class="col-md-4 text-end">
                            <small class="text-muted">Stream: ${forward.streamId}</small>
                        </div>
                    </div>
                    ${forward.error ? `<div class="alert alert-danger alert-sm mt-2 mb-0 py-1"><small>${forward.error}</small></div>` : ''}
                </div>
            </div>
        `;
    }
    
    getPlatformIcon(platform) {
        switch (platform) {
            case 'youtube': return 'youtube';
            case 'twitch': return 'twitch';
            case 'facebook': return 'facebook';
            case 'twitter': return 'twitter';
            case 'instagram': return 'instagram';
            default: return 'broadcast-tower';
        }
    }
    
    async saveForwardingConfig() {
        try {
            const config = {
                name: document.getElementById('forwardingName').value,
                platform: document.getElementById('forwardingPlatform').value,
                rtmpUrl: document.getElementById('forwardingUrl').value,
                enabled: document.getElementById('forwardingEnabled').checked,
                debug: document.getElementById('forwardingDebug').checked,
                maxRetries: parseInt(document.getElementById('forwardingMaxRetries').value),
                retryDelay: parseInt(document.getElementById('forwardingRetryDelay').value)
            };
            
            const response = await fetch('/api/forwarding/configs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Forwarding configuration saved successfully', 'success');
                this.refreshForwardingConfigs();
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('addForwardingModal'));
                modal.hide();
                
                // Reset form
                document.getElementById('addForwardingForm').reset();
            } else {
                this.showNotification(data.message || 'Failed to save configuration', 'danger');
            }
            
        } catch (error) {
            console.error('❌ Failed to save forwarding config:', error);
            this.showNotification('Failed to save forwarding config', 'danger');
        }
    }
    
    async toggleForwardingConfig(configId) {
        try {
            // Get current config
            const response = await fetch('/api/forwarding/configs');
            const data = await response.json();
            
            if (!data.success) {
                this.showNotification('Failed to get configuration', 'danger');
                return;
            }
            
            const config = data.configs.find(c => c.id === configId);
            if (!config) {
                this.showNotification('Configuration not found', 'danger');
                return;
            }
            
            // Toggle enabled state
            const updateResponse = await fetch(`/api/forwarding/configs/${configId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled: !config.enabled })
            });
            
            const updateData = await updateResponse.json();
            
            if (updateData.success) {
                this.showNotification(`Configuration ${config.enabled ? 'disabled' : 'enabled'} successfully`, 'success');
                this.refreshForwardingConfigs();
            } else {
                this.showNotification(updateData.message || 'Failed to update configuration', 'danger');
            }
            
        } catch (error) {
            console.error('❌ Failed to toggle forwarding config:', error);
            this.showNotification('Failed to toggle configuration', 'danger');
        }
    }
    
    async deleteForwardingConfig(configId) {
        if (!confirm('Are you sure you want to delete this forwarding configuration?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/forwarding/configs/${configId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Forwarding configuration deleted successfully', 'success');
                this.refreshForwardingConfigs();
            } else {
                this.showNotification(data.message || 'Failed to delete configuration', 'danger');
            }
            
        } catch (error) {
            console.error('❌ Failed to delete forwarding config:', error);
            this.showNotification('Failed to delete configuration', 'danger');
        }
    }
    
    async updateForwardingPreset() {
        try {
            const platform = document.getElementById('forwardingPlatform').value;
            const response = await fetch('/api/forwarding/presets');
            const data = await response.json();
            
            if (data.success && data.presets[platform]) {
                const preset = data.presets[platform];
                document.getElementById('forwardingName').value = preset.name;
                document.getElementById('forwardingUrl').value = preset.rtmpUrl;
                document.getElementById('forwardingMaxRetries').value = preset.maxRetries;
                document.getElementById('forwardingRetryDelay').value = preset.retryDelay;
            }
        } catch (error) {
            console.error('❌ Failed to update preset:', error);
        }
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

window.refreshRecordings = () => {
    app.refreshRecordings();
};

window.generateStreamKey = () => {
    app.generateStreamKey();
};

window.stopStream = () => {
    app.stopStream();
};

// Forwarding global functions
window.showAddForwardingModal = () => {
    const modal = new bootstrap.Modal(document.getElementById('addForwardingModal'));
    modal.show();
};

window.refreshForwardingConfigs = () => {
    app.refreshForwardingConfigs();
};

window.refreshActiveForwarding = () => {
    app.refreshActiveForwarding();
};

window.saveForwardingConfig = () => {
    app.saveForwardingConfig();
};

window.toggleForwardingConfig = (configId) => {
    app.toggleForwardingConfig(configId);
};

window.deleteForwardingConfig = (configId) => {
    app.deleteForwardingConfig(configId);
};

window.updateForwardingPreset = () => {
    app.updateForwardingPreset();
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.app = new StreamingApp();
});