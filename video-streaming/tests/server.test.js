/**
 * Video Streaming Platform - Server Tests
 * Comprehensive testing suite for RTMP streaming functionality
 */

const request = require('supertest');
const { app, nms } = require('../src/server/index');
const AuthManager = require('../src/utils/auth');

describe('Video Streaming Platform', () => {
    let server;
    let authManager;
    
    beforeAll((done) => {
        authManager = new AuthManager();
        server = app.listen(3001, done);
    });
    
    afterAll((done) => {
        server.close(done);
    });
    
    describe('Health Check', () => {
        test('should return healthy status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);
            
            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
        });
    });
    
    describe('API Endpoints', () => {
        test('should get empty streams list initially', async () => {
            const response = await request(app)
                .get('/api/streams')
                .expect(200);
            
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('streams');
            expect(Array.isArray(response.body.streams)).toBe(true);
        });
        
        test('should get server statistics', async () => {
            const response = await request(app)
                .get('/api/stats')
                .expect(200);
            
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('stats');
            expect(response.body.stats).toHaveProperty('totalSessions');
            expect(response.body.stats).toHaveProperty('publishingSessions');
            expect(response.body.stats).toHaveProperty('playingSessions');
            expect(response.body.stats).toHaveProperty('uptime');
        });
        
        test('should handle stream stop request', async () => {
            const response = await request(app)
                .post('/api/streams/nonexistent/stop')
                .expect(404);
            
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', 'Stream not found');
        });
    });
    
    describe('Authentication Manager', () => {
        test('should generate valid JWT token', () => {
            const payload = { userId: 'test123', username: 'testuser' };
            const token = authManager.generateToken(payload);
            
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            
            const decoded = authManager.verifyToken(token);
            expect(decoded).toHaveProperty('userId', 'test123');
            expect(decoded).toHaveProperty('username', 'testuser');
        });
        
        test('should generate and validate stream keys', () => {
            const userId = 'test123';
            const streamKey = authManager.generateStreamKey(userId);
            
            expect(streamKey).toBeDefined();
            expect(typeof streamKey).toBe('string');
            expect(streamKey.length).toBe(32);
            
            const validation = authManager.validateStreamKey(streamKey);
            expect(validation.valid).toBe(true);
            expect(validation.data.userId).toBe(userId);
        });
        
        test('should reject invalid stream keys', () => {
            const validation = authManager.validateStreamKey('invalid-key');
            expect(validation.valid).toBe(false);
            expect(validation.error).toBe('Stream key not found');
        });
        
        test('should hash and verify passwords', () => {
            const password = 'testpassword123';
            const { salt, hash } = AuthManager.hashPassword(password);
            
            expect(salt).toBeDefined();
            expect(hash).toBeDefined();
            
            const isValid = AuthManager.verifyPassword(password, salt, hash);
            expect(isValid).toBe(true);
            
            const isInvalid = AuthManager.verifyPassword('wrongpassword', salt, hash);
            expect(isInvalid).toBe(false);
        });
        
        test('should clean expired stream keys', (done) => {
            const userId = 'test123';
            const shortLivedAuth = new AuthManager({ streamKeyExpiration: 100 }); // 100ms
            
            const streamKey = shortLivedAuth.generateStreamKey(userId);
            expect(shortLivedAuth.validateStreamKey(streamKey).valid).toBe(true);
            
            setTimeout(() => {
                const cleaned = shortLivedAuth.cleanExpiredKeys();
                expect(cleaned).toBe(1);
                expect(shortLivedAuth.validateStreamKey(streamKey).valid).toBe(false);
                done();
            }, 150);
        });
    });
    
    describe('RTMP Configuration', () => {
        const { getConfig, validateConfig } = require('../src/rtmp/config');
        
        test('should return valid development config', () => {
            const config = getConfig('development');
            
            expect(config).toHaveProperty('rtmp');
            expect(config).toHaveProperty('http');
            expect(config).toHaveProperty('auth');
            expect(config.rtmp).toHaveProperty('port', 1935);
            expect(config.http).toHaveProperty('port', 8000);
            expect(config.auth.play).toBe(false);
            expect(config.auth.publish).toBe(false);
        });
        
        test('should return valid production config', () => {
            const config = getConfig('production');
            
            expect(config.logType).toBe(1); // WARN level
            expect(config.auth.play).toBe(true);
            expect(config.auth.publish).toBe(true);
            expect(config.performance.maxConnections).toBe(10000);
        });
        
        test('should validate config properly', () => {
            const validConfig = getConfig('development');
            const errors = validateConfig(validConfig);
            expect(errors).toHaveLength(0);
            
            const invalidConfig = { ...validConfig, rtmp: { port: 999 } };
            const invalidErrors = validateConfig(invalidConfig);
            expect(invalidErrors.length).toBeGreaterThan(0);
        });
    });
    
    describe('Stream Path Processing', () => {
        test('should extract stream key from path', () => {
            const auth = new AuthManager();
            
            expect(auth.extractStreamKeyFromPath('/live/test123')).toBe('test123');
            expect(auth.extractStreamKeyFromPath('/live/app/stream456')).toBe('stream456');
            expect(auth.extractStreamKeyFromPath('live/simple')).toBe('simple');
        });
    });
    
    describe('Rate Limiting', () => {
        test('should create rate limiter middleware', (done) => {
            const auth = new AuthManager();
            const rateLimiter = auth.createRateLimiter(1000, 2); // 2 requests per second
            
            const mockReq = { ip: '127.0.0.1' };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const mockNext = jest.fn();
            
            // First request should pass
            rateLimiter(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(1);
            
            // Second request should pass
            rateLimiter(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(2);
            
            // Third request should be rate limited
            rateLimiter(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Too many requests'
            });
            
            done();
        });
    });
});

describe('Integration Tests', () => {
    test('should handle complete streaming workflow', async () => {
        const authManager = new AuthManager();
        
        // 1. Generate stream key
        const streamKey = authManager.generateStreamKey('user123');
        expect(streamKey).toBeDefined();
        
        // 2. Validate stream key
        const validation = authManager.validateStreamKey(streamKey);
        expect(validation.valid).toBe(true);
        
        // 3. Simulate RTMP authentication
        const streamPath = `/live/${streamKey}`;
        const rtmpAuth = authManager.rtmpAuthHandler();
        const authResult = rtmpAuth('session123', streamPath, {});
        expect(authResult).toBe(true);
        
        // 4. Test API access
        const response = await request(app)
            .get('/api/streams')
            .expect(200);
        
        expect(response.body.success).toBe(true);
    });
});