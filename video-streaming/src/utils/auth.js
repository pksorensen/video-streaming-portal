/**
 * Authentication and Authorization Utilities
 * JWT-based authentication for streaming platform
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AuthManager {
    constructor(options = {}) {
        this.secret = options.secret || process.env.JWT_SECRET || 'default-jwt-secret';
        this.algorithm = options.algorithm || 'HS256';
        this.expiresIn = options.expiresIn || '24h';
        this.issuer = options.issuer || 'streaming-platform';
        
        // Stream key management
        this.streamKeys = new Map();
        this.streamKeyExpiration = options.streamKeyExpiration || 7 * 24 * 60 * 60 * 1000; // 7 days
    }
    
    /**
     * Generate JWT token for user authentication
     */
    generateToken(payload) {
        return jwt.sign(
            {
                ...payload,
                iss: this.issuer,
                iat: Math.floor(Date.now() / 1000),
            },
            this.secret,
            {
                algorithm: this.algorithm,
                expiresIn: this.expiresIn
            }
        );
    }
    
    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.secret, {
                algorithms: [this.algorithm],
                issuer: this.issuer
            });
        } catch (error) {
            throw new Error(`Token verification failed: ${error.message}`);
        }
    }
    
    /**
     * Generate secure stream key
     */
    generateStreamKey(userId, options = {}) {
        const keyLength = options.length || 32;
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        
        let streamKey = '';
        for (let i = 0; i < keyLength; i++) {
            streamKey += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        
        // Store stream key with metadata
        const keyData = {
            userId,
            streamKey,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.streamKeyExpiration,
            permissions: options.permissions || ['publish'],
            metadata: options.metadata || {}
        };
        
        this.streamKeys.set(streamKey, keyData);
        
        return streamKey;
    }
    
    /**
     * Validate stream key
     */
    validateStreamKey(streamKey) {
        const keyData = this.streamKeys.get(streamKey);
        
        if (!keyData) {
            return { valid: false, error: 'Stream key not found' };
        }
        
        if (Date.now() > keyData.expiresAt) {
            this.streamKeys.delete(streamKey);
            return { valid: false, error: 'Stream key expired' };
        }
        
        return {
            valid: true,
            data: keyData
        };
    }
    
    /**
     * Revoke stream key
     */
    revokeStreamKey(streamKey) {
        return this.streamKeys.delete(streamKey);
    }
    
    /**
     * List stream keys for user
     */
    getUserStreamKeys(userId) {
        return Array.from(this.streamKeys.values())
            .filter(keyData => keyData.userId === userId)
            .map(keyData => ({
                streamKey: keyData.streamKey,
                createdAt: keyData.createdAt,
                expiresAt: keyData.expiresAt,
                permissions: keyData.permissions,
                metadata: keyData.metadata
            }));
    }
    
    /**
     * Clean expired stream keys
     */
    cleanExpiredKeys() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, data] of this.streamKeys.entries()) {
            if (now > data.expiresAt) {
                expiredKeys.push(key);
            }
        }
        
        expiredKeys.forEach(key => this.streamKeys.delete(key));
        
        return expiredKeys.length;
    }
    
    /**
     * Generate API key for external access
     */
    generateApiKey(userId, permissions = []) {
        const apiKey = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
        
        return {
            apiKey,
            hash,
            userId,
            permissions,
            createdAt: Date.now()
        };
    }
    
    /**
     * Hash password
     */
    static hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
        return { salt, hash };
    }
    
    /**
     * Verify password
     */
    static verifyPassword(password, salt, hash) {
        const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
        return computedHash === hash;
    }
    
    /**
     * Middleware for Express.js authentication
     */
    authMiddleware() {
        return (req, res, next) => {
            const token = req.headers.authorization?.replace('Bearer ', '') || 
                         req.query.token || 
                         req.body.token;
            
            if (!token) {
                return res.status(401).json({
                    success: false,
                    error: 'Access token required'
                });
            }
            
            try {
                const decoded = this.verifyToken(token);
                req.user = decoded;
                next();
            } catch (error) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired token'
                });
            }
        };
    }
    
    /**
     * Middleware for stream key validation
     */
    streamKeyMiddleware() {
        return (req, res, next) => {
            const streamKey = req.params.streamKey || 
                             req.query.streamKey || 
                             req.body.streamKey;
            
            if (!streamKey) {
                return res.status(400).json({
                    success: false,
                    error: 'Stream key required'
                });
            }
            
            const validation = this.validateStreamKey(streamKey);
            
            if (!validation.valid) {
                return res.status(401).json({
                    success: false,
                    error: validation.error
                });
            }
            
            req.streamKey = streamKey;
            req.streamData = validation.data;
            next();
        };
    }
    
    /**
     * RTMP authentication handler
     */
    rtmpAuthHandler() {
        return (id, streamPath, args) => {
            const streamKey = this.extractStreamKeyFromPath(streamPath);
            
            if (!streamKey) {
                console.log(`[Auth] No stream key found in path: ${streamPath}`);
                return false;
            }
            
            const validation = this.validateStreamKey(streamKey);
            
            if (!validation.valid) {
                console.log(`[Auth] Invalid stream key: ${streamKey} - ${validation.error}`);
                return false;
            }
            
            console.log(`[Auth] Stream key validated: ${streamKey} for user: ${validation.data.userId}`);
            return true;
        };
    }
    
    /**
     * Extract stream key from RTMP path
     */
    extractStreamKeyFromPath(streamPath) {
        const parts = streamPath.split('/');
        return parts[parts.length - 1];
    }
    
    /**
     * Rate limiting helper
     */
    createRateLimiter(windowMs = 15 * 60 * 1000, max = 100) {
        const requests = new Map();
        
        return (req, res, next) => {
            const clientId = req.ip || req.connection.remoteAddress;
            const now = Date.now();
            const windowStart = now - windowMs;
            
            // Clean old requests
            if (requests.has(clientId)) {
                const clientRequests = requests.get(clientId).filter(time => time > windowStart);
                requests.set(clientId, clientRequests);
            }
            
            const clientRequests = requests.get(clientId) || [];
            
            if (clientRequests.length >= max) {
                return res.status(429).json({
                    success: false,
                    error: 'Too many requests'
                });
            }
            
            clientRequests.push(now);
            requests.set(clientId, clientRequests);
            
            next();
        };
    }
}

module.exports = AuthManager;