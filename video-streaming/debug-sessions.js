/**
 * Debug Sessions Test
 * This script tests different ways to access sessions in node-media-server
 */

const NodeMediaServer = require('node-media-server');
const context = require('./node_modules/node-media-server/src/node_core_ctx');

// Configuration
const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*'
  }
};

// Create server
const nms = new NodeMediaServer(config);

console.log('🔍 Debugging Node Media Server Sessions\n');

// Test 1: Check if nms has sessions property
console.log('📋 Test 1: nms.sessions property');
console.log('- nms.sessions exists:', 'sessions' in nms);
console.log('- nms.sessions type:', typeof nms.sessions);
console.log('- nms.sessions value:', nms.sessions);

// Test 2: Check getSession method
console.log('\n📋 Test 2: nms.getSession() method');
console.log('- getSession method exists:', typeof nms.getSession);
try {
  const sessionResult = nms.getSession();
  console.log('- getSession() returns:', sessionResult);
  console.log('- getSession() type:', typeof sessionResult);
} catch (error) {
  console.log('- getSession() error:', error.message);
}

// Test 3: Check context.sessions directly
console.log('\n📋 Test 3: context.sessions (internal)');
console.log('- context.sessions exists:', !!context.sessions);
console.log('- context.sessions type:', typeof context.sessions);
console.log('- context.sessions constructor:', context.sessions.constructor.name);
console.log('- context.sessions size:', context.sessions.size);

// Test 4: Check context.publishers
console.log('\n📋 Test 4: context.publishers (internal)');
console.log('- context.publishers exists:', !!context.publishers);
console.log('- context.publishers type:', typeof context.publishers);
console.log('- context.publishers constructor:', context.publishers.constructor.name);
console.log('- context.publishers size:', context.publishers.size);

// Test 5: Add event listeners to see when sessions are created
console.log('\n📋 Test 5: Event listeners for session tracking');

nms.on('preConnect', (id, args) => {
  console.log(`\n🔗 preConnect: id=${id}`);
  console.log('- context.sessions.size:', context.sessions.size);
  console.log('- context.sessions.has(id):', context.sessions.has(id));
});

nms.on('postConnect', (id, args) => {
  console.log(`\n✅ postConnect: id=${id}`);
  console.log('- context.sessions.size:', context.sessions.size);
  console.log('- context.sessions.has(id):', context.sessions.has(id));
  
  if (context.sessions.has(id)) {
    const session = context.sessions.get(id);
    console.log('- session type:', session.constructor.name);
    console.log('- session properties:', Object.keys(session));
  }
});

nms.on('prePublish', (id, streamPath, args) => {
  console.log(`\n📡 prePublish: id=${id}, path=${streamPath}`);
  console.log('- context.sessions.size:', context.sessions.size);
  console.log('- context.publishers.size:', context.publishers.size);
  
  if (context.sessions.has(id)) {
    const session = context.sessions.get(id);
    console.log('- session.publishStreamPath:', session.publishStreamPath);
    console.log('- session.isPublishing:', session.isPublishing);
  }
});

nms.on('postPublish', (id, streamPath, args) => {
  console.log(`\n🚀 postPublish: id=${id}, path=${streamPath}`);
  console.log('- context.sessions.size:', context.sessions.size);
  console.log('- context.publishers.size:', context.publishers.size);
  console.log('- context.publishers.has(streamPath):', context.publishers.has(streamPath));
  
  if (context.sessions.has(id)) {
    const session = context.sessions.get(id);
    console.log('- session.publishStreamPath:', session.publishStreamPath);
    console.log('- session.isPublishing:', session.isPublishing);
  }
});

// Test 6: Function to periodically check sessions
function checkSessions() {
  console.log('\n🔄 Periodic session check:');
  console.log('- context.sessions.size:', context.sessions.size);
  console.log('- context.publishers.size:', context.publishers.size);
  
  if (context.sessions.size > 0) {
    console.log('- Active sessions:');
    context.sessions.forEach((session, id) => {
      console.log(`  - ${id}: ${session.constructor.name}`);
      console.log(`    - publishStreamPath: ${session.publishStreamPath}`);
      console.log(`    - isPublishing: ${session.isPublishing}`);
      console.log(`    - connectTime: ${session.connectTime}`);
    });
  }
  
  if (context.publishers.size > 0) {
    console.log('- Active publishers:');
    context.publishers.forEach((sessionId, streamPath) => {
      console.log(`  - ${streamPath}: ${sessionId}`);
    });
  }
}

// Start server
nms.run();

// Check sessions every 5 seconds
setInterval(checkSessions, 5000);

console.log('\n🚀 Server started. Test with:');
console.log('RTMP: rtmp://localhost:1935/live/test123');
console.log('HTTP-FLV: http://localhost:8000/live/test123.flv');
console.log('\nPress Ctrl+C to exit');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📡 Shutting down...');
  nms.stop();
  process.exit(0);
});