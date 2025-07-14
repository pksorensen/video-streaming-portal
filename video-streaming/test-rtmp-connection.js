/**
 * Test RTMP Connection Simulation
 * This script simulates an RTMP connection to test the session management
 */

const net = require('net');

// RTMP handshake simulation (simplified)
function createRTMPHandshake() {
  const C0 = Buffer.from([0x03]); // RTMP version 3
  const C1 = Buffer.alloc(1536); // Timestamp + random data
  C1.writeUInt32BE(Math.floor(Date.now() / 1000), 0); // Timestamp
  return Buffer.concat([C0, C1]);
}

// Test RTMP connection
function testRTMPConnection() {
  console.log('🔍 Testing RTMP connection to localhost:1935...');
  
  const client = new net.Socket();
  
  client.connect(1935, 'localhost', () => {
    console.log('✅ Connected to RTMP server');
    
    // Send RTMP handshake
    const handshake = createRTMPHandshake();
    client.write(handshake);
    
    console.log('📡 Sent RTMP handshake');
  });
  
  client.on('data', (data) => {
    console.log('📥 Received data:', data.length, 'bytes');
    
    // For testing, close after receiving response
    setTimeout(() => {
      client.destroy();
      console.log('🔌 Connection closed');
    }, 1000);
  });
  
  client.on('error', (err) => {
    console.error('❌ Connection error:', err.message);
  });
  
  client.on('close', () => {
    console.log('🔌 Connection closed');
  });
}

// Test HTTP-FLV server
function testHTTPFLV() {
  console.log('🔍 Testing HTTP-FLV server on localhost:8000...');
  
  const http = require('http');
  
  const req = http.request({
    hostname: 'localhost',
    port: 8000,
    path: '/live/test123.flv',
    method: 'GET'
  }, (res) => {
    console.log('✅ HTTP-FLV server responded:', res.statusCode);
    console.log('Headers:', res.headers);
    
    res.on('data', (chunk) => {
      console.log('📥 Received chunk:', chunk.length, 'bytes');
    });
    
    res.on('end', () => {
      console.log('📡 HTTP-FLV response ended');
    });
  });
  
  req.on('error', (err) => {
    console.error('❌ HTTP-FLV error:', err.message);
  });
  
  req.setTimeout(5000, () => {
    console.log('⏰ HTTP-FLV request timeout');
    req.destroy();
  });
  
  req.end();
}

// Test WebSocket connection
function testWebSocket() {
  console.log('🔍 Testing WebSocket connection...');
  
  const WebSocket = require('ws');
  
  try {
    const ws = new WebSocket('ws://localhost:3000');
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Close after testing
      setTimeout(() => {
        ws.close();
      }, 2000);
    });
    
    ws.on('message', (data) => {
      console.log('📥 WebSocket message:', data.toString());
    });
    
    ws.on('error', (err) => {
      console.error('❌ WebSocket error:', err.message);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket closed');
    });
  } catch (err) {
    console.error('❌ WebSocket setup error:', err.message);
  }
}

// Run tests
async function runTests() {
  console.log('🧪 Starting connection tests...\n');
  
  // Test RTMP connection
  testRTMPConnection();
  
  // Wait a bit, then test HTTP-FLV
  setTimeout(() => {
    console.log('\n');
    testHTTPFLV();
  }, 2000);
  
  // Test WebSocket
  setTimeout(() => {
    console.log('\n');
    testWebSocket();
  }, 4000);
}

runTests();