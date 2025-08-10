// server/index.js - Main Express Server

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const WebSocketServer = require('./websocket-server');
const RoomManager = require('./room-manager');
const DeviceDiscovery = require('./device-discovery');

class UniversalARVRServer {
    constructor() {
        this.app = express();
        this.server = null;
        this.wsServer = null;
        this.roomManager = new RoomManager();
        this.deviceDiscovery = new DeviceDiscovery();
        
        this.port = process.env.PORT || 8080;
        this.host = process.env.HOST || '0.0.0.0';
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "ws:", "wss:", "https:"],
                    fontSrc: ["'self'", "https:"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                },
            },
            crossOriginEmbedderPolicy: false
        }));

        // CORS configuration
        this.app.use(cors({
            origin: process.env.NODE_ENV === 'production' 
                ? ['https://yourdomain.com'] 
                : true,
            credentials: true
        }));

        // Compression and logging
        this.app.use(compression());
        this.app.use(morgan('combined'));

        // JSON parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Static files with cache headers
        this.app.use(express.static(path.join(__dirname, '../client'), {
            setHeaders: (res, path) => {
                // Cache static assets for 1 hour
                if (path.endsWith('.js') || path.endsWith('.css')) {
                    res.setHeader('Cache-Control', 'public, max-age=3600');
                }
                // Cache images for 1 day
                if (path.match(/\.(jpg|jpeg|png|gif|ico|svg)$/)) {
                    res.setHeader('Cache-Control', 'public, max-age=86400');
                }
            }
        }));

        console.log('🛡️ Middleware configured');
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: require('../package.json').version,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                connections: this.wsServer ? this.wsServer.getConnectionCount() : 0,
                rooms: this.roomManager.getRoomCount(),
                devices: this.deviceDiscovery.getDeviceCount()
            });
        });

        // API endpoints
        this.app.get('/api/rooms', (req, res) => {
            try {
                const rooms = this.roomManager.getAllRooms();
                res.json({
                    success: true,
                    rooms: rooms.map(room => ({
                        id: room.id,
                        userCount: room.users.size,
                        createdAt: room.createdAt,
                        isPublic: room.isPublic
                    }))
                });
            } catch (error) {
                console.error('Failed to get rooms:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve rooms'
                });
            }
        });

        this.app.post('/api/rooms', (req, res) => {
            try {
                const { roomId, isPublic = false, maxUsers = 50 } = req.body;
                
                if (!roomId || roomId.length < 3) {
                    return res.status(400).json({
                        success: false,
                        error: 'Room ID must be at least 3 characters'
                    });
                }

                const room = this.roomManager.createRoom(roomId, { isPublic, maxUsers });
                
                res.json({
                    success: true,
                    room: {
                        id: room.id,
                        createdAt: room.createdAt,
                        isPublic: room.isPublic,
                        maxUsers: room.maxUsers
                    }
                });
            } catch (error) {
                console.error('Failed to create room:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to create room'
                });
            }
        });

        this.app.get('/api/rooms/:roomId', (req, res) => {
            try {
                const { roomId } = req.params;
                const room = this.roomManager.getRoom(roomId);
                
                if (!room) {
                    return res.status(404).json({
                        success: false,
                        error: 'Room not found'
                    });
                }

                res.json({
                    success: true,
                    room: {
                        id: room.id,
                        userCount: room.users.size,
                        createdAt: room.createdAt,
                        isPublic: room.isPublic,
                        maxUsers: room.maxUsers
                    }
                });
            } catch (error) {
                console.error('Failed to get room:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve room'
                });
            }
        });

        // Device discovery endpoints
        this.app.get('/api/devices', (req, res) => {
            try {
                const devices = this.deviceDiscovery.getDiscoveredDevices();
                res.json({
                    success: true,
                    devices
                });
            } catch (error) {
                console.error('Failed to get devices:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve devices'
                });
            }
        });

        this.app.post('/api/devices/scan', (req, res) => {
            try {
                this.deviceDiscovery.startScan();
                res.json({
                    success: true,
                    message: 'Device scan started'
                });
            } catch (error) {
                console.error('Failed to start device scan:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to start device scan'
                });
            }
        });

        // WebRTC STUN/TURN server info
        this.app.get('/api/ice-servers', (req, res) => {
            res.json({
                success: true,
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    // Add TURN servers here for production
                    // { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' }
                ]
            });
        });

        // Statistics endpoint
        this.app.get('/api/stats', (req, res) => {
            try {
                const stats = {
                    server: {
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        version: require('../package.json').version,
                        nodeVersion: process.version,
                        platform: process.platform
                    },
                    connections: this.wsServer ? this.wsServer.getConnectionStats() : {},
                    rooms: this.roomManager.getStats(),
                    devices: this.deviceDiscovery.getStats()
                };

                res.json({
                    success: true,
                    stats
                });
            } catch (error) {
                console.error('Failed to get stats:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve statistics'
                });
            }
        });

        // Catch-all route for SPA
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../client/index.html'));
        });

        console.log('🛣️ Routes configured');
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res, next) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                path: req.path
            });
        });

        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error('Server error:', err);
            
            res.status(err.status || 500).json({
                success: false,
                error: process.env.NODE_ENV === 'production' 
                    ? 'Internal server error' 
                    : err.message,
                ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
            });
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            process.exit(1);
        });

        console.log('🚨 Error handling configured');
    }

    async start() {
        try {
            // Create HTTP server
            this.server = http.createServer(this.app);

            // Initialize WebSocket server
            this.wsServer = new WebSocketServer(this.server, this.roomManager);
            await this.wsServer.initialize();

            // Initialize device discovery
            await this.deviceDiscovery.initialize();

            // Start server
            this.server.listen(this.port, this.host, () => {
                console.log('🚀 Universal AR/VR Platform Server Started');
                console.log(`📡 HTTP Server: http://${this.host}:${this.port}`);
                console.log(`🔌 WebSocket Server: ws://${this.host}:${this.port}`);
                console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
                console.log(`🎯 Process ID: ${process.pid}`);
                console.log('✅ Server ready for connections');
            });

            // Graceful shutdown
            this.setupGracefulShutdown();

        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
            
            try {
                // Stop accepting new connections
                this.server.close(() => {
                    console.log('📡 HTTP server closed');
                });

                // Close WebSocket connections
                if (this.wsServer) {
                    await this.wsServer.shutdown();
                    console.log('🔌 WebSocket server closed');
                }

                // Cleanup device discovery
                if (this.deviceDiscovery) {
                    await this.deviceDiscovery.shutdown();
                    console.log('📱 Device discovery stopped');
                }

                // Cleanup room manager
                if (this.roomManager) {
                    await this.roomManager.shutdown();
                    console.log('🏠 Room manager stopped');
                }

                console.log('✅ Graceful shutdown completed');
                process.exit(0);

            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };

        // Listen for shutdown signals
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    // Development helpers
    enableDevelopmentFeatures() {
        if (process.env.NODE_ENV !== 'production') {
            // Hot reload for development
            this.app.get('/api/dev/reload', (req, res) => {
                res.json({ success: true, message: 'Reload triggered' });
                setTimeout(() => process.exit(0), 100);
            });

            // Debug endpoints
            this.app.get('/api/dev/debug', (req, res) => {
                res.json({
                    success: true,
                    debug: {
                        rooms: this.roomManager.getAllRooms(),
                        connections: this.wsServer.getAllConnections(),
                        devices: this.deviceDiscovery.getAllDevices()
                    }
                });
            });

            console.log('🔧 Development features enabled');
        }
    }
}

// Create and start server
const server = new UniversalARVRServer();

// Enable development features in non-production
if (process.env.NODE_ENV !== 'production') {
    server.enableDevelopmentFeatures();
}

// Start the server
server.start().catch(error => {
    console.error('💥 Server startup failed:', error);
    process.exit(1);
});

module.exports = UniversalARVRServer;
