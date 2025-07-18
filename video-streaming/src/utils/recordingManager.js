/**
 * Recording Manager - Handles stream recording functionality
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class RecordingManager {
    constructor() {
        this.recordings = new Map(); // Active recordings
        this.recordingHistory = new Map(); // Completed recordings
        this.recordingPath = path.resolve(process.env.RECORDING_PATH || './recordings');
        this.ffmpegPath = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
        
        // Ensure recording directory exists
        this.ensureRecordingDirectory();
        
        // Load existing recordings
        this.loadRecordingHistory();
    }
    
    ensureRecordingDirectory() {
        try {
            // Create main recording directory with proper permissions
            if (!fs.existsSync(this.recordingPath)) {
                fs.mkdirSync(this.recordingPath, { recursive: true, mode: 0o755 });
                console.log(`📁 Created recording directory: ${this.recordingPath}`);
            }
            
            // Create subdirectories with proper permissions
            const subdirs = ['active', 'completed', 'thumbnails'];
            subdirs.forEach(dir => {
                const fullPath = path.join(this.recordingPath, dir);
                if (!fs.existsSync(fullPath)) {
                    fs.mkdirSync(fullPath, { recursive: true, mode: 0o755 });
                    console.log(`📁 Created subdirectory: ${fullPath}`);
                }
            });
            
            // Verify write permissions
            const testFile = path.join(this.recordingPath, 'test_write.tmp');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log(`✅ Recording directory permissions verified: ${this.recordingPath}`);
            
        } catch (error) {
            console.error('❌ Error creating recording directory:', error);
            console.error('💡 Suggestion: Check directory permissions or run with appropriate privileges');
            
            // Fallback to a different directory if possible
            const fallbackPath = path.join(process.cwd(), 'temp_recordings');
            try {
                if (!fs.existsSync(fallbackPath)) {
                    fs.mkdirSync(fallbackPath, { recursive: true, mode: 0o755 });
                }
                this.recordingPath = fallbackPath;
                console.log(`🔄 Using fallback recording directory: ${this.recordingPath}`);
                
                // Create subdirectories in fallback
                const subdirs = ['active', 'completed', 'thumbnails'];
                subdirs.forEach(dir => {
                    const fullPath = path.join(this.recordingPath, dir);
                    if (!fs.existsSync(fullPath)) {
                        fs.mkdirSync(fullPath, { recursive: true, mode: 0o755 });
                    }
                });
                
            } catch (fallbackError) {
                console.error('❌ Fallback directory creation failed:', fallbackError);
                console.error('⚠️ Recording functionality will be disabled');
                this.recordingPath = null;
            }
        }
    }
    
    loadRecordingHistory() {
        try {
            const historyFile = path.join(this.recordingPath, 'recording_history.json');
            if (fs.existsSync(historyFile)) {
                const data = fs.readFileSync(historyFile, 'utf8');
                const history = JSON.parse(data);
                
                // Convert array to Map for easier management
                history.forEach(recording => {
                    this.recordingHistory.set(recording.id, recording);
                });
                
                console.log(`📚 Loaded ${history.length} recordings from history`);
            }
        } catch (error) {
            console.error('❌ Error loading recording history:', error);
        }
    }
    
    saveRecordingHistory() {
        try {
            const historyFile = path.join(this.recordingPath, 'recording_history.json');
            const historyArray = Array.from(this.recordingHistory.values());
            fs.writeFileSync(historyFile, JSON.stringify(historyArray, null, 2));
        } catch (error) {
            console.error('❌ Error saving recording history:', error);
        }
    }
    
    startRecording(streamId, streamPath) {
        try {
            // Check if recording path is available
            if (!this.recordingPath) {
                console.error('❌ Recording path not available, recording disabled');
                return null;
            }
            
            const streamKey = this.extractStreamKey(streamPath);
            const timestamp = Date.now();
            const filename = `${streamKey}_${timestamp}.flv`;
            const outputPath = path.join(this.recordingPath, 'active', filename);
            
            // Input stream URL (from RTMP server)
            const inputUrl = `rtmp://localhost:1935${streamPath}`;
            
            console.log(`🎬 Starting recording for stream: ${streamPath}`);
            console.log(`📁 Output path: ${outputPath}`);
            console.log(`🎯 Input URL: ${inputUrl}`);
            
            // FFmpeg command for recording
            const ffmpegArgs = [
                '-i', inputUrl,
                '-c', 'copy',
                '-f', 'flv',
                '-y', // Overwrite output file
                outputPath
            ];
            
            const ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs);
            
            const recordingData = {
                id: `rec_${timestamp}`,
                streamId,
                streamPath,
                streamKey,
                filename,
                outputPath,
                startTime: timestamp,
                startTimeFormatted: new Date(timestamp).toISOString(),
                status: 'recording',
                process: ffmpegProcess,
                duration: 0,
                fileSize: 0
            };
            
            // Store active recording
            this.recordings.set(streamId, recordingData);
            
            // Handle process events
            ffmpegProcess.stdout.on('data', (data) => {
                console.log(`📺 FFmpeg stdout: ${data}`);
            });
            
            ffmpegProcess.stderr.on('data', (data) => {
                console.log(`📺 FFmpeg stderr: ${data}`);
            });
            
            ffmpegProcess.on('close', (code) => {
                console.log(`🎬 Recording finished with code ${code} for stream: ${streamPath}`);
                this.finishRecording(streamId, code);
            });
            
            ffmpegProcess.on('error', (error) => {
                console.error(`❌ FFmpeg error for stream ${streamPath}:`, error);
                this.finishRecording(streamId, -1);
            });
            
            return recordingData;
            
        } catch (error) {
            console.error('❌ Error starting recording:', error);
            return null;
        }
    }
    
    stopRecording(streamId) {
        try {
            const recording = this.recordings.get(streamId);
            if (!recording) {
                console.log(`⚠️ No active recording found for stream: ${streamId}`);
                return false;
            }
            
            console.log(`🛑 Stopping recording for stream: ${recording.streamPath}`);
            
            // Kill FFmpeg process gracefully
            if (recording.process && !recording.process.killed) {
                recording.process.kill('SIGTERM');
                
                // Force kill if it doesn't stop within 5 seconds
                const timeoutId = setTimeout(() => {
                    // Check if recording still exists (might have been cleaned up)
                    const currentRecording = this.recordings.get(streamId);
                    if (currentRecording && currentRecording.process && !currentRecording.process.killed) {
                        currentRecording.process.kill('SIGKILL');
                    }
                }, 5000);
                
                // Store timeout ID so it can be cleared if needed
                recording.killTimeoutId = timeoutId;
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Error stopping recording:', error);
            return false;
        }
    }
    
    finishRecording(streamId, exitCode) {
        try {
            const recording = this.recordings.get(streamId);
            if (!recording) {
                return;
            }
            
            // Calculate duration
            const endTime = Date.now();
            const duration = Math.floor((endTime - recording.startTime) / 1000);
            
            // Get file size
            let fileSize = 0;
            if (fs.existsSync(recording.outputPath)) {
                const stats = fs.statSync(recording.outputPath);
                fileSize = stats.size;
                
                // Move to completed folder
                const completedPath = path.join(this.recordingPath, 'completed', recording.filename);
                fs.renameSync(recording.outputPath, completedPath);
                recording.outputPath = completedPath;
            }
            
            // Update recording data
            recording.endTime = endTime;
            recording.endTimeFormatted = new Date(endTime).toISOString();
            recording.duration = duration;
            recording.fileSize = fileSize;
            // Exit code 255 is SIGTERM - normal termination
            recording.status = (exitCode === 0 || exitCode === 255) ? 'completed' : 'failed';
            recording.exitCode = exitCode;
            
            // Clear any pending kill timeout
            if (recording.killTimeoutId) {
                clearTimeout(recording.killTimeoutId);
                delete recording.killTimeoutId;
            }
            
            // Remove process reference
            delete recording.process;
            
            // Move to history
            this.recordingHistory.set(recording.id, recording);
            this.recordings.delete(streamId);
            
            // Save history
            this.saveRecordingHistory();
            
            console.log(`✅ Recording finished: ${recording.filename} (${duration}s, ${this.formatFileSize(fileSize)})`);
            
        } catch (error) {
            console.error('❌ Error finishing recording:', error);
        }
    }
    
    getActiveRecordings() {
        const activeRecordings = Array.from(this.recordings.values()).map(rec => {
            return {
                id: rec.id,
                streamId: rec.streamId,
                streamPath: rec.streamPath,
                streamKey: rec.streamKey,
                filename: rec.filename,
                startTime: rec.startTime,
                startTimeFormatted: rec.startTimeFormatted,
                status: rec.status,
                duration: Math.floor((Date.now() - rec.startTime) / 1000)
            };
        });
        
        return activeRecordings;
    }
    
    getRecordingHistory() {
        return Array.from(this.recordingHistory.values()).sort((a, b) => b.startTime - a.startTime);
    }
    
    getRecordingById(id) {
        return this.recordingHistory.get(id);
    }
    
    deleteRecording(id) {
        try {
            const recording = this.recordingHistory.get(id);
            if (!recording) {
                return false;
            }
            
            // Delete file
            if (fs.existsSync(recording.outputPath)) {
                fs.unlinkSync(recording.outputPath);
            }
            
            // Remove from history
            this.recordingHistory.delete(id);
            this.saveRecordingHistory();
            
            console.log(`🗑️ Deleted recording: ${recording.filename}`);
            return true;
            
        } catch (error) {
            console.error('❌ Error deleting recording:', error);
            return false;
        }
    }
    
    extractStreamKey(streamPath) {
        if (!streamPath) return 'unknown';
        const parts = streamPath.split('/');
        return parts[parts.length - 1] || 'unknown';
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

module.exports = RecordingManager;