#!/usr/bin/env node

/**
 * Enhanced session debugging script to understand the session timing issue
 */

const NodeMediaServer = require('node-media-server');

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
    allow_origin: '*',
    mediaroot: './media'
  },
  relay: {
    ffmpeg: '/usr/bin/ffmpeg',
    tasks: []
  }
};

const nms = new NodeMediaServer(config);

// Enhanced session debugging
console.log('🔍 ENHANCED SESSION DEBUGGING');
console.log('==============================');

nms.on('preConnect', (id, args) => {
  console.log(`📡 [preConnect] id=${id} args=${JSON.stringify(args)}`);
  console.log(`   Session exists: ${!!nms.sessions[id]}`);
  if (nms.sessions[id]) {
    console.log(`   Session data: ${JSON.stringify(nms.sessions[id], null, 2)}`);
  }
});

nms.on('postConnect', (id, args) => {
  console.log(`🔗 [postConnect] id=${id} args=${JSON.stringify(args)}`);
  console.log(`   Session exists: ${!!nms.sessions[id]}`);
  if (nms.sessions[id]) {
    console.log(`   Session data: ${JSON.stringify(nms.sessions[id], null, 2)}`);
  }
});

nms.on('doneConnect', (id, args) => {
  console.log(`✅ [doneConnect] id=${id} args=${JSON.stringify(args)}`);
  console.log(`   Session exists: ${!!nms.sessions[id]}`);
  if (nms.sessions[id]) {
    console.log(`   Session data: ${JSON.stringify(nms.sessions[id], null, 2)}`);
  }
});

nms.on('prePublish', (id, StreamPath, args) => {
  console.log(`🚀 [prePublish] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  console.log(`   All sessions: ${JSON.stringify(Object.keys(nms.sessions || {}))}`);
  console.log(`   Target session exists: ${!!nms.sessions[id]}`);
  
  if (nms.sessions[id]) {
    console.log(`   Session before modification: ${JSON.stringify(nms.sessions[id], null, 2)}`);
    
    // Try to set isPublishing flag
    nms.sessions[id].isPublishing = true;
    nms.sessions[id].publishStreamPath = StreamPath;
    
    console.log(`   Session after modification: ${JSON.stringify(nms.sessions[id], null, 2)}`);
  } else {
    console.log(`   ❌ ERROR: Session ${id} not found in prePublish!`);
    console.log(`   Available sessions: ${JSON.stringify(nms.sessions, null, 2)}`);
  }
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log(`📡 [postPublish] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  console.log(`   Session exists: ${!!nms.sessions[id]}`);
  if (nms.sessions[id]) {
    console.log(`   Session data: ${JSON.stringify(nms.sessions[id], null, 2)}`);
  }
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log(`🛑 [donePublish] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  console.log(`   Session exists: ${!!nms.sessions[id]}`);
  if (nms.sessions[id]) {
    console.log(`   Session data: ${JSON.stringify(nms.sessions[id], null, 2)}`);
  }
});

// API endpoint to check sessions
const express = require('express');
const app = express();

app.get('/debug/sessions', (req, res) => {
  const sessions = nms.sessions || {};
  const sessionData = {};
  
  Object.keys(sessions).forEach(id => {
    sessionData[id] = {
      id,
      publishStreamPath: sessions[id].publishStreamPath,
      isPublishing: sessions[id].isPublishing,
      connectTime: sessions[id].connectTime,
      ip: sessions[id].ip,
      players: sessions[id].players || 0
    };
  });
  
  res.json({
    totalSessions: Object.keys(sessions).length,
    sessions: sessionData,
    rawSessions: sessions
  });
});

app.listen(3001, () => {
  console.log('🔧 Debug API running on http://localhost:3001/debug/sessions');
});

nms.run();

console.log('🎯 Starting debug session...');
console.log('📡 RTMP URL: rtmp://localhost:1935/live/debug-test');
console.log('🔧 Debug API: http://localhost:3001/debug/sessions');
console.log('⏰ Run your test stream and monitor the output');

// Periodic session dump
setInterval(() => {
  const sessions = nms.sessions || {};
  const sessionCount = Object.keys(sessions).length;
  if (sessionCount > 0) {
    console.log(`\n📊 [PERIODIC] ${sessionCount} active sessions:`);
    Object.keys(sessions).forEach(id => {
      const session = sessions[id];
      console.log(`   ${id}: isPublishing=${session.isPublishing}, path=${session.publishStreamPath}`);
    });
  }
}, 5000);