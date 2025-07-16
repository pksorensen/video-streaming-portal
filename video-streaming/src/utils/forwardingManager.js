/**
 * Forwarding Manager - Handles RTMP stream forwarding/relay functionality
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ForwardingManager {
    constructor() {
        this.forwardingTasks = new Map(); // Active forwarding tasks
        this.forwardingConfig = new Map(); // Forwarding configurations
        this.ffmpegPath = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
        
        // Load existing forwarding configurations
        this.loadForwardingConfig();
    }
    
    loadForwardingConfig() {
        try {
            const configFile = path.join(__dirname, '../../config/forwarding.json');
            if (fs.existsSync(configFile)) {
                const data = fs.readFileSync(configFile, 'utf8');
                const config = JSON.parse(data);
                
                // Convert array to Map for easier management
                config.forEach(forward => {
                    this.forwardingConfig.set(forward.id, forward);
                });
                
                console.log(`📡 Loaded ${config.length} forwarding configurations`);
            }
        } catch (error) {
            console.error('❌ Error loading forwarding config:', error);
        }
    }
    
    saveForwardingConfig() {
        try {
            const configDir = path.join(__dirname, '../../config');
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            const configFile = path.join(configDir, 'forwarding.json');
            const configArray = Array.from(this.forwardingConfig.values());
            fs.writeFileSync(configFile, JSON.stringify(configArray, null, 2));
            
            console.log(`💾 Saved ${configArray.length} forwarding configurations`);
        } catch (error) {
            console.error('❌ Error saving forwarding config:', error);
        }
    }
    
    /**
     * Start forwarding a stream to multiple destinations
     */
    startForwarding(streamId, streamPath, forwardingConfigs) {
        if (!forwardingConfigs || forwardingConfigs.length === 0) {
            console.log(`⚠️ No forwarding configurations for stream: ${streamId}`);
            return [];
        }
        
        const inputUrl = `rtmp://localhost:1935${streamPath}`;
        const activeForwards = [];
        
        forwardingConfigs.forEach(config => {
            if (config.enabled) {
                const forwardingTask = this.createForwardingTask(streamId, inputUrl, config);
                if (forwardingTask) {
                    activeForwards.push(forwardingTask);
                }
            }
        });
        
        // Store active forwarding tasks
        if (activeForwards.length > 0) {
            this.forwardingTasks.set(streamId, activeForwards);
            console.log(`📡 Started ${activeForwards.length} forwarding tasks for stream: ${streamId}`);
        }
        
        return activeForwards;
    }
    
    /**
     * Create a single forwarding task
     */
    createForwardingTask(streamId, inputUrl, config) {
        try {
            const taskId = `${streamId}_${config.id}`;
            const outputUrl = config.rtmpUrl;
            
            console.log(`🚀 Starting forwarding task: ${taskId}`);
            console.log(`📥 Input: ${inputUrl}`);
            console.log(`📤 Output: ${outputUrl}`);
            
            // FFmpeg command for forwarding
            const ffmpegArgs = [
                '-i', inputUrl,
                '-c', 'copy', // Copy streams without re-encoding for better performance
                '-f', 'flv',
                '-flvflags', 'no_duration_filesize',
                '-y', // Overwrite output
                outputUrl
            ];
            
            // Add custom arguments if specified
            if (config.customArgs && config.customArgs.length > 0) {
                ffmpegArgs.splice(-1, 0, ...config.customArgs);
            }
            
            const ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs);
            
            const forwardingTask = {
                id: taskId,
                streamId,
                configId: config.id,
                name: config.name,
                platform: config.platform,
                inputUrl,
                outputUrl,
                startTime: Date.now(),
                status: 'running',
                process: ffmpegProcess,
                retryCount: 0,
                maxRetries: config.maxRetries || 3,
                retryDelay: config.retryDelay || 5000
            };
            
            // Handle process events
            ffmpegProcess.stdout.on('data', (data) => {
                if (config.debug) {
                    console.log(`📡 FFmpeg stdout [${taskId}]: ${data}`);
                }
            });
            
            ffmpegProcess.stderr.on('data', (data) => {
                if (config.debug) {
                    console.log(`📡 FFmpeg stderr [${taskId}]: ${data}`);
                }
                
                // Check for common errors
                const errorString = data.toString();
                if (errorString.includes('Connection refused') || 
                    errorString.includes('No such file or directory') ||
                    errorString.includes('Server returned 404')) {
                    forwardingTask.status = 'error';
                    forwardingTask.error = errorString;
                }
            });
            
            ffmpegProcess.on('close', (code) => {
                console.log(`📡 Forwarding task ${taskId} finished with code ${code}`);
                
                if (code !== 0 && forwardingTask.retryCount < forwardingTask.maxRetries) {
                    // Retry after delay
                    setTimeout(() => {
                        this.retryForwarding(forwardingTask);
                    }, forwardingTask.retryDelay);
                } else {
                    forwardingTask.status = code === 0 ? 'completed' : 'failed';
                    forwardingTask.endTime = Date.now();
                }
            });
            
            ffmpegProcess.on('error', (error) => {
                console.error(`❌ FFmpeg error for forwarding task ${taskId}:`, error);
                forwardingTask.status = 'error';
                forwardingTask.error = error.message;
                forwardingTask.endTime = Date.now();
            });
            
            return forwardingTask;
            
        } catch (error) {
            console.error('❌ Error creating forwarding task:', error);
            return null;
        }
    }
    
    /**
     * Retry a failed forwarding task
     */
    retryForwarding(forwardingTask) {
        if (forwardingTask.retryCount >= forwardingTask.maxRetries) {
            console.log(`⚠️ Max retries reached for forwarding task: ${forwardingTask.id}`);
            forwardingTask.status = 'failed';
            return;
        }
        
        forwardingTask.retryCount++;
        console.log(`🔄 Retrying forwarding task: ${forwardingTask.id} (attempt ${forwardingTask.retryCount})`);
        
        // Find the config for this task
        const config = this.forwardingConfig.get(forwardingTask.configId);
        if (!config) {
            console.error(`❌ Config not found for forwarding task: ${forwardingTask.id}`);
            return;
        }
        
        // Create new forwarding task
        const newTask = this.createForwardingTask(forwardingTask.streamId, forwardingTask.inputUrl, config);
        if (newTask) {
            // Update the existing task data
            Object.assign(forwardingTask, newTask);
        }
    }
    
    /**
     * Stop forwarding for a stream
     */
    stopForwarding(streamId) {
        const forwardingTasks = this.forwardingTasks.get(streamId);
        if (!forwardingTasks) {
            console.log(`⚠️ No active forwarding tasks for stream: ${streamId}`);
            return false;
        }
        
        console.log(`🛑 Stopping ${forwardingTasks.length} forwarding tasks for stream: ${streamId}`);
        
        forwardingTasks.forEach(task => {
            if (task.process && !task.process.killed) {
                task.process.kill('SIGTERM');
                task.status = 'stopped';
                task.endTime = Date.now();
                
                // Force kill if it doesn't stop within 5 seconds
                setTimeout(() => {
                    if (!task.process.killed) {
                        task.process.kill('SIGKILL');
                    }
                }, 5000);
            }
        });
        
        this.forwardingTasks.delete(streamId);
        return true;
    }
    
    /**
     * Get active forwarding tasks
     */
    getActiveForwarding() {
        const activeForwarding = [];
        
        for (const [streamId, tasks] of this.forwardingTasks) {
            tasks.forEach(task => {
                activeForwarding.push({
                    id: task.id,
                    streamId: task.streamId,
                    configId: task.configId,
                    name: task.name,
                    platform: task.platform,
                    outputUrl: task.outputUrl,
                    startTime: task.startTime,
                    status: task.status,
                    retryCount: task.retryCount,
                    error: task.error,
                    duration: task.endTime ? (task.endTime - task.startTime) : (Date.now() - task.startTime)
                });
            });
        }
        
        return activeForwarding;
    }
    
    /**
     * Add a new forwarding configuration
     */
    addForwardingConfig(config) {
        const id = config.id || `config_${Date.now()}`;
        const forwardingConfig = {
            id,
            name: config.name || 'Unknown',
            platform: config.platform || 'custom',
            rtmpUrl: config.rtmpUrl,
            enabled: config.enabled !== false,
            customArgs: config.customArgs || [],
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 5000,
            debug: config.debug || false,
            createdAt: Date.now()
        };
        
        this.forwardingConfig.set(id, forwardingConfig);
        this.saveForwardingConfig();
        
        console.log(`✅ Added forwarding config: ${forwardingConfig.name}`);
        return forwardingConfig;
    }
    
    /**
     * Update forwarding configuration
     */
    updateForwardingConfig(id, updates) {
        const config = this.forwardingConfig.get(id);
        if (!config) {
            return null;
        }
        
        Object.assign(config, updates);
        config.updatedAt = Date.now();
        
        this.saveForwardingConfig();
        
        console.log(`✅ Updated forwarding config: ${config.name}`);
        return config;
    }
    
    /**
     * Delete forwarding configuration
     */
    deleteForwardingConfig(id) {
        const config = this.forwardingConfig.get(id);
        if (!config) {
            return false;
        }
        
        this.forwardingConfig.delete(id);
        this.saveForwardingConfig();
        
        console.log(`🗑️ Deleted forwarding config: ${config.name}`);
        return true;
    }
    
    /**
     * Get all forwarding configurations
     */
    getForwardingConfigs() {
        return Array.from(this.forwardingConfig.values());
    }
    
    /**
     * Get forwarding configuration by ID
     */
    getForwardingConfig(id) {
        return this.forwardingConfig.get(id);
    }
    
    /**
     * Get enabled forwarding configurations
     */
    getEnabledForwardingConfigs() {
        return Array.from(this.forwardingConfig.values()).filter(config => config.enabled);
    }
    
    /**
     * Get preset configurations for popular platforms
     */
    getPresetConfigs() {
        return {
            youtube: {
                name: 'YouTube Live',
                platform: 'youtube',
                rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/YOUR_STREAM_KEY',
                customArgs: ['-f', 'flv'],
                maxRetries: 5,
                retryDelay: 10000
            },
            twitch: {
                name: 'Twitch',
                platform: 'twitch',
                rtmpUrl: 'rtmp://live.twitch.tv/live/YOUR_STREAM_KEY',
                customArgs: ['-f', 'flv'],
                maxRetries: 5,
                retryDelay: 10000
            },
            facebook: {
                name: 'Facebook Live',
                platform: 'facebook',
                rtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp/YOUR_STREAM_KEY',
                customArgs: ['-f', 'flv'],
                maxRetries: 3,
                retryDelay: 15000
            },
            custom: {
                name: 'Custom RTMP',
                platform: 'custom',
                rtmpUrl: 'rtmp://your-server.com/live/YOUR_STREAM_KEY',
                customArgs: ['-f', 'flv'],
                maxRetries: 3,
                retryDelay: 5000
            }
        };
    }
}

module.exports = ForwardingManager;