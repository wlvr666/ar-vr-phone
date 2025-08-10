// server/websocket-server.js - WebSocket Signaling Server

const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

class WebSocketServer {
    constructor(httpServer, roomManager) {
        this.httpServer = httpServer;
        this.roomManager = roomManager;
        this.io = null;
        this.connections = new Map();
        this.userSockets = new Map();
        
        this.stats = {
            totalConnections: 0,
            currentConnections: 0,
            totalMessages: 0,
            roomsCreated: 0,
            peersConnected: 0
        };
    }

    async initialize() {
        console.log('🔧 Initializing WebSocket Server...');
        
        // Create Socket.IO server
        this.io = new Server(this.httpServer, {
            cors: {
                origin: process.env.NODE_ENV === 'production' 
                    ? ['https://yourdomain.com'] 
                    : true,
                credentials: true
            },
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000
        });

        this.setupEventHandlers();
        
        console.log('✅ WebSocket Server initialized');
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });
    }

    handleConnection(socket) {
        const connectionId = uuidv4();
        const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
        const ipAddress = socket.handshake.address;
        
        console.log(`🔗 New connection: ${connectionId} from ${ipAddress}`);
        
        // Store connection info
        const connectionInfo = {
            id: connectionId,
            socketId: socket.id,
            userId: null,
            currentRoom: null,
            connectedAt: new Date(),
            userAgent,
            ipAddress,
            isAuthenticated: false
        };
        
        this.connections.set(socket.id, connectionInfo);
        this.updateStats('connect');
        
        // Setup socket event handlers
        this.setupSocketHandlers(socket, connectionInfo);
        
        // Send welcome message
        socket.emit('connected', {
            connectionId,
            serverTime: new Date().toISOString(),
            capabilities: {
                webrtc: true,
                rooms: true,
                devices: true,
                spatialAudio: true
            }
        });
    }

    setupSocketHandlers(socket, connectionInfo) {
        // User registration
        socket.on('register', (data) => {
            this.handleUserRegistration(socket, connectionInfo, data);
        });

        // Room management
        socket.on('create-room', (data) => {
            this.handleCreateRoom(socket, connectionInfo, data);
        });

        socket.on('join-room', (data) => {
            this.handleJoinRoom(socket, connectionInfo, data);
        });

        socket.on('leave-room', (data) => {
            this.handleLeaveRoom(socket, connectionInfo, data);
        });

        // WebRTC signaling
        socket.on('offer', (data) => {
            this.handleWebRTCOffer(socket, connectionInfo, data);
        });

        socket.on('answer', (data) => {
            this.handleWebRTCAnswer(socket, connectionInfo, data);
        });

        socket.on('ice-candidate', (data) => {
            this.handleICECandidate(socket, connectionInfo, data);
        });

        // Spatial data
        socket.on('spatial-update', (data) => {
            this.handleSpatialUpdate(socket, connectionInfo, data);
        });

        socket.on('device-update', (data) => {
            this.handleDeviceUpdate(socket, connectionInfo, data);
        });

        // Chat and messaging
        socket.on('chat-message', (data) => {
            this.handleChatMessage(socket, connectionInfo, data);
        });

        socket.on('user-action', (data) => {
            this.handleUserAction(socket, connectionInfo, data);
        });

        // Connection events
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });

        socket.on('disconnect', (reason) => {
            this.handleDisconnection(socket, connectionInfo, reason);
        });

        socket.on('error', (error) => {
            console.error(`Socket error for ${connectionInfo.id}:`, error);
        });
    }

    handleUserRegistration(socket, connectionInfo, data) {
        try {
            const { userId, userData } = data;
            
            if (!userId || typeof userId !== 'string') {
                socket.emit('error', { message: 'Invalid user ID' });
                return;
            }

            // Update connection info
            connectionInfo.userId = userId;
            connectionInfo.userData = userData || {};
            connectionInfo.isAuthenticated = true;
            
            // Store user socket mapping
            this.userSockets.set(userId, socket.id);
            
            console.log(`👤 User registered: ${userId}`);
            
            socket.emit('registered', {
                userId,
                connectionId: connectionInfo.id,
                serverCapabilities: {
                    maxRoomSize: 50,
                    supportedProtocols: ['webrtc', 'websocket'],
                    features: ['spatial-audio', 'device-control', 'screen-share']
                }
            });
            
        } catch (error) {
            console.error('Registration error:', error);
            socket.emit('error', { message: 'Registration failed' });
        }
    }

    handleCreateRoom(socket, connectionInfo, data) {
        try {
            const { roomId, roomData = {} } = data;
            
            if (!connectionInfo.isAuthenticated) {
                socket.emit('error', { message: 'Authentication required' });
                return;
            }

            if (!roomId || roomId.length < 3) {
                socket.emit('error', { message: 'Room ID must be at least 3 characters' });
                return;
            }

            // Create room
            const room = this.roomManager.createRoom(roomId, {
                createdBy: connectionInfo.userId,
                ...roomData
            });

            // Join the creator to the room
            socket.join(roomId);
            connectionInfo.currentRoom = roomId;
            
            // Add user to room
            this.roomManager.addUserToRoom(roomId, connectionInfo.userId, {
                socketId: socket.id,
                ...connectionInfo.userData
            });

            this.updateStats('room-created');
            
            console.log(`🏠 Room created: ${roomId} by ${connectionInfo.userId}`);
            
            socket.emit('room-created', {
                roomId,
                room: {
                    id: room.id,
                    createdAt: room.createdAt,
                    userCount: room.users.size,
                    maxUsers: room.maxUsers
                }
            });
            
        } catch (error) {
            console.error('Create room error:', error);
            socket.emit('error', { message: error.message || 'Failed to create room' });
        }
    }

    handleJoinRoom(socket, connectionInfo, data) {
        try {
            const { roomId, userData = {} } = data;
            
            if (!connectionInfo.isAuthenticated) {
                socket.emit('error', { message: 'Authentication required' });
                return;
            }

            const room = this.roomManager.getRoom(roomId);
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }

            if (room.users.size >= room.maxUsers) {
                socket.emit('error', { message: 'Room is full' });
                return;
            }

            // Leave current room if in one
            if (connectionInfo.currentRoom) {
                this.handleLeaveRoom(socket, connectionInfo, { roomId: connectionInfo.currentRoom });
            }

            // Join new room
            socket.join(roomId);
            connectionInfo.currentRoom = roomId;
            
            // Add user to room
            this.roomManager.addUserToRoom(roomId, connectionInfo.userId, {
                socketId: socket.id,
                ...connectionInfo.userData,
                ...userData
            });

            // Get current room users
            const roomUsers = Array.from(room.users.entries()).map(([userId, user]) => ({
                userId,
                userData: user.userData,
                joinedAt: user.joinedAt
            }));

            console.log(`🚪 User ${connectionInfo.userId} joined room: ${roomId}`);
            
            // Notify user they joined
            socket.emit('room-joined', {
                roomId,
                room: {
                    id: room.id,
                    createdAt: room.createdAt,
                    userCount: room.users.size,
                    maxUsers: room.maxUsers
                },
                users: roomUsers
            });
            
            // Notify other users in room
            socket.to(roomId).emit('user-joined-room', {
                userId: connectionInfo.userId,
                userData: {
                    ...connectionInfo.userData,
                    ...userData
                },
                roomId
            });
            
        } catch (error) {
            console.error('Join room error:', error);
            socket.emit('error', { message: error.message || 'Failed to join room' });
        }
    }

    handleLeaveRoom(socket, connectionInfo, data) {
        try {
            const roomId = data.roomId || connectionInfo.currentRoom;
            
            if (!roomId) {
                return; // Not in a room
            }

            // Leave socket room
            socket.leave(roomId);
            
            // Remove user from room
            this.roomManager.removeUserFromRoom(roomId, connectionInfo.userId);
            
            // Notify others in room
            socket.to(roomId).emit('user-left-room', {
                userId: connectionInfo.userId,
                roomId
            });
            
            connectionInfo.currentRoom = null;
            
            console.log(`🚪 User ${connectionInfo.userId} left room: ${roomId}`);
            
            socket.emit('room-left', { roomId });
            
        } catch (error) {
            console.error('Leave room error:', error);
        }
    }

    handleWebRTCOffer(socket, connectionInfo, data) {
        try {
            const { to, offer } = data;
            
            if (!connectionInfo.currentRoom) {
                socket.emit('error', { message: 'Must be in a room to make offers' });
                return;
            }

            const targetSocketId = this.userSockets.get(to);
            if (!targetSocketId) {
                socket.emit('error', { message: 'Target user not found' });
                return;
            }

            // Forward offer to target user
            this.io.to(targetSocketId).emit('offer', {
                from: connectionInfo.userId,
                offer
            });

            this.updateStats('message');
            console.log(`📞 WebRTC offer: ${connectionInfo.userId} -> ${to}`);
            
        } catch (error) {
            console.error('WebRTC offer error:', error);
            socket.emit('error', { message: 'Failed to send offer' });
        }
    }

    handleWebRTCAnswer(socket, connectionInfo, data) {
        try {
            const { to, answer } = data;
            
            const targetSocketId = this.userSockets.get(to);
            if (!targetSocketId) {
                socket.emit('error', { message: 'Target user not found' });
                return;
            }

            // Forward answer to target user
            this.io.to(targetSocketId).emit('answer', {
                from: connectionInfo.userId,
                answer
            });

            this.updateStats('message');
            console.log(`📞 WebRTC answer: ${connectionInfo.userId} -> ${to}`);
            
        } catch (error) {
            console.error('WebRTC answer error:', error);
            socket.emit('error', { message: 'Failed to send answer' });
        }
    }

    handleICECandidate(socket, connectionInfo, data) {
        try {
            const { to, candidate } = data;
            
            const targetSocketId = this.userSockets.get(to);
            if (!targetSocketId) {
                return; // Silently ignore if user disconnected
            }

            // Forward ICE candidate to target user
            this.io.to(targetSocketId).emit('ice-candidate', {
                from: connectionInfo.userId,
                candidate
            });

            this.updateStats('message');
            
        } catch (error) {
            console.error('ICE candidate error:', error);
        }
    }

    handleSpatialUpdate(socket, connectionInfo, data) {
        try {
            if (!connectionInfo.currentRoom) return;
            
            const { position, rotation, spatialData } = data;
            
            // Broadcast spatial update to room (except sender)
            socket.to(connectionInfo.currentRoom).emit('spatial-update', {
                userId: connectionInfo.userId,
                position,
                rotation,
                spatialData,
                timestamp: Date.now()
            });

            this.updateStats('message');
            
        } catch (error) {
            console.error('Spatial update error:', error);
        }
    }

    handleDeviceUpdate(socket, connectionInfo, data) {
        try {
            if (!connectionInfo.currentRoom) return;
            
            const { devices, action } = data;
            
            // Broadcast device update to room
            socket.to(connectionInfo.currentRoom).emit('device-update', {
                userId: connectionInfo.userId,
                devices,
                action,
                timestamp: Date.now()
            });

            this.updateStats('message');
            
        } catch (error) {
            console.error('Device update error:', error);
        }
    }

    handleChatMessage(socket, connectionInfo, data) {
        try {
            if (!connectionInfo.currentRoom) {
                socket.emit('error', { message: 'Must be in a room to send messages' });
                return;
            }

            const { message, type = 'text' } = data;
            
            if (!message || message.trim().length === 0) {
                socket.emit('error', { message: 'Message cannot be empty' });
                return;
            }

            const chatMessage = {
                id: uuidv4(),
                userId: connectionInfo.userId,
                username: connectionInfo.userData.name || 'Anonymous',
                message: message.trim(),
                type,
                timestamp: Date.now(),
                roomId: connectionInfo.currentRoom
            };

            // Broadcast to room
            this.io.to(connectionInfo.currentRoom).emit('chat-message', chatMessage);
            
            this.updateStats('message');
            console.log(`💬 Chat message in ${connectionInfo.currentRoom}: ${connectionInfo.userId}`);
            
        } catch (error) {
            console.error('Chat message error:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    }

    handleUserAction(socket, connectionInfo, data) {
        try {
            if (!connectionInfo.currentRoom) return;
            
            const { action, targetUserId, actionData } = data;
            
            // Broadcast user action to room
            socket.to(connectionInfo.currentRoom).emit('user-action', {
                userId: connectionInfo.userId,
                action,
                targetUserId,
                actionData,
                timestamp: Date.now()
            });

            this.updateStats('message');
            
        } catch (error) {
            console.error('User action error:', error);
        }
    }

    handleDisconnection(socket, connectionInfo, reason) {
        try {
            console.log(`🔌 Disconnection: ${connectionInfo.id} (${reason})`);
            
            // Remove from current room
            if (connectionInfo.currentRoom) {
                this.handleLeaveRoom(socket, connectionInfo, { roomId: connectionInfo.currentRoom });
            }
            
            // Cleanup mappings
            if (connectionInfo.userId) {
                this.userSockets.delete(connectionInfo.userId);
            }
            
            this.connections.delete(socket.id);
            this.updateStats('disconnect');
            
        } catch (error) {
            console.error('Disconnection error:', error);
        }
    }

    updateStats(action) {
        switch (action) {
            case 'connect':
                this.stats.totalConnections++;
                this.stats.currentConnections++;
                break;
            case 'disconnect':
                this.stats.currentConnections--;
                break;
            case 'message':
                this.stats.totalMessages++;
                break;
            case 'room-created':
                this.stats.roomsCreated++;
                break;
            case 'peer-connected':
                this.stats.peersConnected++;
                break;
        }
    }

    // Public API methods
    getConnectionCount() {
        return this.stats.currentConnections;
    }

    getConnectionStats() {
        return {
            ...this.stats,
            rooms: this.roomManager.getRoomCount(),
            uptime: process.uptime()
        };
    }

    getAllConnections() {
        return Array.from(this.connections.values()).map(conn => ({
            id: conn.id,
            userId: conn.userId,
            currentRoom: conn.currentRoom,
            connectedAt: conn.connectedAt,
            userAgent: conn.userAgent,
            ipAddress: conn.ipAddress
        }));
    }

    broadcastToRoom(roomId, event, data) {
        this.io.to(roomId).emit(event, data);
    }

    sendToUser(userId, event, data) {
        const socketId = this.userSockets.get(userId);
        if (socketId) {
            this.io.to(socketId).emit(event, data);
            return true;
        }
        return false;
    }

    async shutdown() {
        console.log('🛑 Shutting down WebSocket server...');
        
        try {
            // Notify all clients of shutdown
            this.io.emit('server-shutdown', {
                message: 'Server is shutting down',
                timestamp: Date.now()
            });

            // Give clients time to receive the message
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Close all connections
            this.io.close();
            
            // Clear data structures
            this.connections.clear();
            this.userSockets.clear();
            
            console.log('✅ WebSocket server shutdown complete');
            
        } catch (error) {
            console.error('❌ WebSocket server shutdown error:', error);
        }
    }
}

module.exports = WebSocketServer;
