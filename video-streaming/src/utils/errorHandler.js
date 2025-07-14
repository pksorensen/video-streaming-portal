/**
 * Error Handling Utilities
 * Centralized error handling for the streaming platform
 */

class ErrorHandler {
    static handleAsync(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }
    
    static handleError(err, req, res, next) {
        console.error('Error:', err);
        
        // Default error response
        let statusCode = 500;
        let message = 'Internal server error';
        
        // Handle specific error types
        if (err.name === 'ValidationError') {
            statusCode = 400;
            message = 'Validation error';
        } else if (err.name === 'UnauthorizedError') {
            statusCode = 401;
            message = 'Unauthorized';
        } else if (err.code === 'ENOENT') {
            statusCode = 404;
            message = 'Resource not found';
        }
        
        res.status(statusCode).json({
            success: false,
            error: message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
    }
    
    static handleNotFound(req, res) {
        res.status(404).json({
            success: false,
            error: 'Route not found'
        });
    }
    
    static safeJsonResponse(res, data, statusCode = 200) {
        try {
            res.status(statusCode).json(data);
        } catch (error) {
            console.error('Error sending JSON response:', error);
            res.status(500).json({
                success: false,
                error: 'Error sending response'
            });
        }
    }
    
    static validateStreamSession(session) {
        if (!session) return false;
        if (typeof session !== 'object') return false;
        return true;
    }
    
    static getSafeSessions(nms) {
        try {
            const sessions = nms.getSession();
            if (!sessions || typeof sessions !== 'object') {
                return {};
            }
            return sessions;
        } catch (error) {
            console.error('Error getting sessions:', error);
            return {};
        }
    }
}

module.exports = ErrorHandler;