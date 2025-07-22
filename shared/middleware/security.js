"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityErrorHandler = exports.apiSecurityHeaders = exports.corsOptions = exports.generateRefreshToken = exports.generateToken = exports.comparePassword = exports.hashPassword = exports.linkedinUrlValidation = exports.titleValidation = exports.contentValidation = exports.nameValidation = exports.passwordValidation = exports.emailValidation = exports.validateInput = exports.requireSubscription = exports.authenticateToken = exports.apiRateLimit = exports.authRateLimit = exports.generalRateLimit = exports.createRateLimiter = exports.securityHeaders = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const express_validator_1 = require("express-validator");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Environment variables with defaults
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development';
const NODE_ENV = process.env.NODE_ENV || 'development';
// Security Headers Middleware
exports.securityHeaders = (0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "https://api.linkedin.com", "https://api.openai.com"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
});
// Rate Limiting Configurations
const createRateLimiter = (options) => {
    return (0, express_rate_limit_1.default)({
        windowMs: options.windowMs,
        max: options.max,
        message: {
            error: 'Too many requests',
            message: options.message || 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil(options.windowMs / 1000),
        },
        skipSuccessfulRequests: options.skipSuccessfulRequests || false,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({
                error: 'Too many requests',
                message: options.message || 'Rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil(options.windowMs / 1000),
            });
        },
    });
};
exports.createRateLimiter = createRateLimiter;
// Pre-configured rate limiters
exports.generalRateLimit = (0, exports.createRateLimiter)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
});
exports.authRateLimit = (0, exports.createRateLimiter)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per window
    message: 'Too many login attempts, please try again later.',
});
exports.apiRateLimit = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'API rate limit exceeded.',
    skipSuccessfulRequests: true,
});
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        if (!token) {
            res.status(401).json({
                error: 'Access denied',
                message: 'Authentication token is required',
            });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({
                error: 'Invalid token',
                message: 'Authentication token is invalid',
            });
        }
        else if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({
                error: 'Token expired',
                message: 'Authentication token has expired',
            });
        }
        else {
            res.status(500).json({
                error: 'Authentication error',
                message: 'An error occurred during authentication',
            });
        }
    }
};
exports.authenticateToken = authenticateToken;
// Authorization Middleware (subscription tiers)
const requireSubscription = (requiredTier) => {
    const tierLevels = {
        FREE: 0,
        BASIC: 1,
        PROFESSIONAL: 2,
        ENTERPRISE: 3,
    };
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                message: 'You must be logged in to access this resource',
            });
            return;
        }
        const userTierLevel = tierLevels[req.user.subscriptionTier];
        const requiredTierLevel = tierLevels[requiredTier];
        if (userTierLevel < requiredTierLevel) {
            res.status(403).json({
                error: 'Insufficient subscription',
                message: `This feature requires a ${requiredTier} subscription or higher`,
                required: requiredTier,
                current: req.user.subscriptionTier,
            });
            return;
        }
        next();
    };
};
exports.requireSubscription = requireSubscription;
// Input Validation Middleware
const validateInput = (validations) => {
    return async (req, res, next) => {
        // Run all validations
        await Promise.all(validations.map(validation => validation.run(req)));
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                error: 'Validation failed',
                message: 'Please check your input and try again',
                details: errors.array().map(error => ({
                    field: error.type === 'field' ? error.path : undefined,
                    message: error.msg,
                    value: error.type === 'field' ? error.value : undefined,
                })),
            });
            return;
        }
        next();
    };
};
exports.validateInput = validateInput;
// Common validation rules
exports.emailValidation = (0, express_validator_1.body)('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email address is too long');
exports.passwordValidation = (0, express_validator_1.body)('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character');
const nameValidation = (fieldName) => (0, express_validator_1.body)(fieldName)
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage(`${fieldName} must be between 1 and 50 characters`)
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(`${fieldName} can only contain letters, spaces, hyphens, and apostrophes`);
exports.nameValidation = nameValidation;
// Content validation
exports.contentValidation = (0, express_validator_1.body)('content')
    .trim()
    .isLength({ min: 1, max: 3000 })
    .withMessage('Content must be between 1 and 3000 characters');
exports.titleValidation = (0, express_validator_1.body)('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters');
// LinkedIn URL validation
exports.linkedinUrlValidation = (0, express_validator_1.body)('linkedinUrl')
    .isURL({ protocols: ['https'], host_whitelist: ['www.linkedin.com', 'linkedin.com'] })
    .withMessage('Please provide a valid LinkedIn URL');
// Password Hashing Utilities
const hashPassword = async (password) => {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    return bcryptjs_1.default.hash(password, saltRounds);
};
exports.hashPassword = hashPassword;
const comparePassword = async (password, hashedPassword) => {
    return bcryptjs_1.default.compare(password, hashedPassword);
};
exports.comparePassword = comparePassword;
// JWT Utilities
const generateToken = (payload, expiresIn = '24h') => {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn });
};
exports.generateToken = generateToken;
const generateRefreshToken = (payload) => {
    const refreshSecret = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
    return jsonwebtoken_1.default.sign(payload, refreshSecret, { expiresIn: '7d' });
};
exports.generateRefreshToken = generateRefreshToken;
// CORS Configuration
exports.corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin)
            return callback(null, true);
        const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:8080',
        ];
        if (NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS policy'), false);
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-CSRF-Token',
    ],
    exposedHeaders: ['X-Auth-Token'],
};
// Security Headers for API responses
const apiSecurityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
};
exports.apiSecurityHeaders = apiSecurityHeaders;
// Error handling middleware
const securityErrorHandler = (error, req, res, next) => {
    // Log security-related errors (but don't expose details to client)
    if (NODE_ENV !== 'production') {
        console.error('Security Error:', error);
    }
    // Generic error response for security issues
    if (error.message?.includes('CORS') || error.name === 'UnauthorizedError') {
        res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied',
        });
        return;
    }
    next(error);
};
exports.securityErrorHandler = securityErrorHandler;
//# sourceMappingURL=security.js.map