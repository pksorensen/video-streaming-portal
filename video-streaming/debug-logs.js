// Debug script to check server logs in real-time
const { spawn } = require('child_process');
const http = require('http');

console.log('🔍 DEBUGGING ACTIVE STREAMS POPULATION');
console.log('====================================');

async function checkApiStreams() {
    return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:3000/api/streams', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(error);
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(2000, () => reject(new Error('API timeout')));
    });
}

async function runTest() {
    console.log('📊 Initial API check...');
    try {
        const initial = await checkApiStreams();
        console.log('Initial streams:', initial);
    } catch (error) {
        console.log('API Error:', error.message);
    }

    console.log('\n🎬 Starting FFmpeg stream...');
    const streamKey = `debug-${Date.now()}`;
    
    const ffmpeg = spawn('ffmpeg', [
        '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=10',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
        '-g', '30', '-keyint_min', '30', '-sc_threshold', '0',
        '-b:v', '300k', '-maxrate', '300k', '-bufsize', '600k',
        '-f', 'flv',
        '-t', '5',
        `rtmp://localhost:1935/live/${streamKey}`
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    console.log(`📡 Stream Key: ${streamKey}`);
    console.log('⏱️  Checking API every 500ms during stream...');

    // Check API repeatedly during stream
    const checkInterval = setInterval(async () => {
        try {
            const response = await checkApiStreams();
            console.log(`[${new Date().toISOString()}] API Response:`, response);
        } catch (error) {
            console.log(`[${new Date().toISOString()}] API Error:`, error.message);
        }
    }, 500);

    ffmpeg.on('close', (code) => {
        clearInterval(checkInterval);
        console.log(`\n✅ FFmpeg completed with code: ${code}`);
        
        // Final check
        setTimeout(async () => {
            try {
                const final = await checkApiStreams();
                console.log('Final streams:', final);
            } catch (error) {
                console.log('Final API Error:', error.message);
            }
            process.exit(0);
        }, 1000);
    });

    ffmpeg.on('error', (error) => {
        clearInterval(checkInterval);
        console.error('FFmpeg Error:', error.message);
        process.exit(1);
    });

    // Timeout safety
    setTimeout(() => {
        clearInterval(checkInterval);
        if (!ffmpeg.killed) {
            ffmpeg.kill('SIGTERM');
        }
    }, 10000);
}

runTest().catch(console.error);