// Quick test to check server logs
const { spawn } = require('child_process');

console.log('📝 Checking server logs for session handling...');

// Run a quick test stream and capture server output
const ffmpeg = spawn('ffmpeg', [
    '-f', 'lavfi', '-i', 'testsrc2=size=160x120:rate=5',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=22050',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
    '-c:a', 'aac', '-ar', '22050', '-b:a', '32k',
    '-g', '15', '-keyint_min', '15', '-sc_threshold', '0',
    '-b:v', '200k', '-maxrate', '200k', '-bufsize', '400k',
    '-f', 'flv',
    '-t', '3',  // 3 second test
    'rtmp://localhost:1935/live/session-test-' + Date.now()
], { stdio: ['ignore', 'ignore', 'ignore'] });

console.log('🎬 Running 3-second test stream...');

ffmpeg.on('close', (code) => {
    console.log(`✅ Test stream completed with code: ${code}`);
    
    // Check API after stream
    const http = require('http');
    http.get('http://localhost:3000/api/streams', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('📊 API Response:', data);
            process.exit(0);
        });
    }).on('error', (err) => {
        console.error('API Error:', err.message);
        process.exit(1);
    });
});

ffmpeg.on('error', (error) => {
    console.error('FFmpeg Error:', error.message);
    process.exit(1);
});

// Timeout
setTimeout(() => {
    if (!ffmpeg.killed) {
        ffmpeg.kill('SIGTERM');
    }
}, 10000);