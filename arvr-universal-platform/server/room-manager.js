// server/room-manager.js - Room and User Management

const { v4: uuidv4 } = require('uuid');

class Room {
    constructor(id, options = {}) {
        this.id = id;
        this.createdAt = new Date();
        this.createdBy = options.createdBy || null;
        this.isPublic = options.isPublic || false;
        this.maxUsers = options.maxUsers || 50;
        this.users = new Map();
        this.metadata = options.metadata || {};
        this.settings = {
            allowDeviceSharing: options.allowDeviceSharing !== false,
            allowScreenShare: options.allowScreenShare !== false,
            allowFileSharing: options.allowFileSharing !== false,
            spatialAudio: options.spatialAudio !== false,
            recordSession: options.recordSession || false,
            requireAuth: options.requireAuth || false,
            ...options.settings
        };
        this.stats = {
            totalUsersJoined: 0,
            messagesCount: 0,
            dataTransferred: 0,
            peakUsers: 0,
            sessionDuration: 0
        };
        this.lastActivity = new Date();
    }

    addUser(userId, userData = {}) {
        if (this.users.has(userId)) {
            throw new Error('User already in room');
        }

        if (this.users.size >= this.maxUsers) {
            throw new Error('Room is full');
        }

        const user = {
            id: userId,
            joinedAt: new Date(),
            userData: {
                name: userData.name || 'Anonymous',
                avatarColor: userData.avatarColor || this.generateRandomColor(),
                capabilities: userData.capabilities || {},
                devices: userData.devices || [],
                ...userData
            },
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            status: 'active',
            lastSeen: new Date(),
            stats: {
                messagesCount: 0,
                dataShared: 0,
                timeInRoom: 0
            }
        };

        this.users.set(userId, user);
        this.stats.totalUsersJoined++;
        
        if (this.users.size > this.stats.peakUsers) {
            this.stats.peakUsers = this.users.size;
        }
        
        this.updateLastActivity();
        return user;
    }

    removeUser(userId) {
        const user = this.users.get(userId);
        if (!user) {
            return false;
        }

        // Update user stats
        user.stats.timeInRoom = Date.now() - user.joinedAt.getTime();
        
        this.users.delete(userId);
        this.updateLastActivity();
        return true;
    }

    updateUserPosition(userId, position, rotation) {
        const user = this.users.get(userId);
        if (!user) {
            return false;
        }

        user.position = { ...position };
        if (rotation) {
            user.rotation = { ...rotation };
        }
        user.lastSeen = new Date();
        this.updateLastActivity();
        return true;
    }

    updateUserData(userId, newData) {
        const user = this.users.get(userId);
        if (!user) {
            return false;
        }

        Object.assign(user.userData, newData);
        user.lastSeen = new Date();
        this.updateLastActivity();
        return true;
    }

    getUser(userId) {
        return this.users.get(userId);
    }

    getAllUsers() {
        return Array.from(this.users.values());
    }

    getUserCount() {
        return this.users.size;
    }

    isUserInRoom(userId) {
        return this.users.has(userId);
    }

    isEmpty() {
        return this.users.size === 0;
    }

    isFull() {
        return this.users.size >= this.maxUsers;
    }

    updateLastActivity() {
        this.lastActivity = new Date();
    }

    incrementMessageCount() {
        this.stats.messagesCount++;
        this.updateLastActivity();
    }

    addDataTransferred(bytes) {
        this.stats.dataTransferred += bytes;
    }

    generateRandomColor() {
        const colors = [
            '#4ecdc4', '#44a08d', '#093637', '#c94b4b', '#4b134f',
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    getSessionDuration() {
        return Date.now() - this.createdAt.getTime();
    }

    toJSON() {
        return {
            id: this.id,
            createdAt: this.createdAt,
            createdBy: this.createdBy,
            isPublic: this.isPublic,
            maxUsers: this.maxUsers,
            currentUsers: this.users.size,
            users: this.getAllUsers(),
            metadata: this.metadata,
            settings: this.settings,
            stats: {
                ...this.stats,
                sessionDuration: this.getSessionDuration()
            },
            lastActivity: this.lastActivity
        };
    }
}

class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.userRoomMap = new Map(); // userId -> roomId
        this.stats = {
            totalRoomsCreated: 0,
            currentRooms: 0,
            totalUsersServed: 0,
            peakConcurrentRooms: 0
        };
        
        // Cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupEmptyRooms();
        }, 60000); // Check every minute
        
        console.log('🏠 Room Manager initialized');
    }

    createRoom(roomId, options = {}) {
        if (this.rooms.has(roomId)) {
            throw new Error('Room already exists');
        }

        if (!this.isValidRoomId(roomId)) {
            throw new Error('Invalid room ID format');
        }

        const room = new Room(roomId, options);
        this.rooms.set(roomId, room);
        
        this.stats.totalRoomsCreated++;
        this.stats.currentRooms++;
        
        if (this.stats.currentRooms > this.stats.peakConcurrentRooms) {
            this.stats.peakConcurrentRooms = this.stats.currentRooms;
        }
        
        console.log(`🏠 Room created: ${roomId} (${this.stats.currentRooms} active rooms)`);
        return room;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    deleteRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return false;
        }

        // Remove all users from the room
        room.getAllUsers().forEach(user => {
            this.userRoomMap.delete(user.id);
        });

        this.rooms.delete(roomId);
        this.stats.currentRooms--;
        
        console.log(`🗑️ Room deleted: ${roomId} (${this.stats.currentRooms} active rooms)`);
        return true;
    }

    addUserToRoom(roomId, userId, userData = {}) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error('Room not found');
        }

        // Remove user from previous room if they're in one
        const currentRoomId = this.userRoomMap.get(userId);
        if (currentRoomId && currentRoomId !== roomId) {
            this.removeUserFromRoom(currentRoomId, userId);
        }

        const user = room.addUser(userId, userData);
        this.userRoomMap.set(userId, roomId);
        
        this.stats.totalUsersServed++;
        
        console.log(`👤 User ${userId} joined room ${roomId} (${room.getUserCount()}/${room.maxUsers})`);
        return user;
    }

    removeUserFromRoom(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return false;
        }

        const success = room.removeUser(userId);
        if (success) {
            this.userRoomMap.delete(userId);
            console.log(`👋 User ${userId} left room ${roomId} (${room.getUserCount()}/${room.maxUsers})`);
            
            // Clean up empty room if needed
            if (room.isEmpty()) {
                this.scheduleRoomCleanup(roomId);
            }
        }
        
        return success;
    }

    updateUserPosition(userId, position, rotation) {
        const roomId = this.userRoomMap.get(userId);
        if (!roomId) {
            return false;
        }

        const room = this.rooms.get(roomId);
        return room ? room.updateUserPosition(userId, position, rotation) : false;
    }

    updateUserData(userId, newData) {
        const roomId = this.userRoomMap.get(userId);
        if (!roomId) {
            return false;
        }

        const room = this.rooms.get(roomId);
        return room ? room.updateUserData(userId, newData) : false;
    }

    getUserRoom(userId) {
        const roomId = this.userRoomMap.get(userId);
        return roomId ? this.rooms.get(roomId) : null;
    }

    getUsersInRoom(roomId) {
        const room = this.rooms.get(roomId);
        return room ? room.getAllUsers() : [];
    }

    getRoomCount() {
        return this.rooms.size;
    }

    getAllRooms() {
        return Array.from(this.rooms.values());
    }

    getPublicRooms() {
        return Array.from(this.rooms.values()).filter(room => room.isPublic);
    }

    getRoomsWithUsers() {
        return Array.from(this.rooms.values()).filter(room => !room.isEmpty());
    }

    isValidRoomId(roomId) {
        // Room ID validation rules
        return (
            typeof roomId === 'string' &&
            roomId.length >= 3 &&
            roomId.length <= 50 &&
            /^[a-zA-Z0-9-_]+$/.test(roomId)
        );
    }

    scheduleRoomCleanup(roomId, delay = 30000) { // 30 seconds delay
        setTimeout(() => {
            const room = this.rooms.get(roomId);
            if (room && room.isEmpty()) {
                this.deleteRoom(roomId);
            }
        }, delay);
    }

    cleanupEmptyRooms() {
        const emptyRooms = [];
        const now = Date.now();
        const maxIdleTime = 5 * 60 * 1000; // 5 minutes

        this.rooms.forEach((room, roomId) => {
            if (room.isEmpty()) {
                const idleTime = now - room.lastActivity.getTime();
                if (idleTime > maxIdleTime) {
                    emptyRooms.push(roomId);
                }
            }
        });

        emptyRooms.forEach(roomId => {
            this.deleteRoom(roomId);
        });

        if (emptyRooms.length > 0) {
            console.log(`🧹 Cleaned up ${emptyRooms.length} empty rooms`);
        }
    }

    cleanupInactiveUsers() {
        const now = Date.now();
        const maxInactiveTime = 30 * 60 * 1000; // 30 minutes
        const inactiveUsers = [];

        this.rooms.forEach((room, roomId) => {
            room.users.forEach((user, userId) => {
                const inactiveTime = now - user.lastSeen.getTime();
                if (inactiveTime > maxInactiveTime) {
                    inactiveUsers.push({ roomId, userId });
                }
            });
        });

        inactiveUsers.forEach(({ roomId, userId }) => {
            this.removeUserFromRoom(roomId, userId);
        });

        if (inactiveUsers.length > 0) {
            console.log(`🧹 Removed ${inactiveUsers.length} inactive users`);
        }
    }

    getStats() {
        const roomStats = Array.from(this.rooms.values()).map(room => ({
            id: room.id,
            userCount: room.getUserCount(),
            maxUsers: room.maxUsers,
            createdAt: room.createdAt,
            sessionDuration: room.getSessionDuration(),
            messageCount: room.stats.messagesCount,
            isPublic: room.isPublic
        }));

        return {
            overview: this.stats,
            rooms: roomStats,
            totalActiveUsers: Array.from(this.userRoomMap.keys()).length
        };
    }

    getRoomAnalytics(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return null;
        }

        const users = room.getAllUsers();
        const userAnalytics = users.map(user => ({
            id: user.id,
            name: user.userData.name,
            joinedAt: user.joinedAt,
            timeInRoom: Date.now() - user.joinedAt.getTime(),
            messageCount: user.stats.messagesCount,
            position: user.position,
            lastSeen: user.lastSeen
        }));

        return {
            room: room.toJSON(),
            users: userAnalytics,
            metrics: {
                averageSessionTime: users.reduce((sum, user) => 
                    sum + (Date.now() - user.joinedAt.getTime()), 0) / users.length,
                totalMessages: room.stats.messagesCount,
                peakUsers: room.stats.peakUsers,
                dataTransferred: room.stats.dataTransferred
            }
        };
    }

    exportRoomData(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return null;
        }

        return {
            exportedAt: new Date().toISOString(),
            room: room.toJSON(),
            analytics: this.getRoomAnalytics(roomId)
        };
    }

    // Advanced room management
    setRoomCapacity(roomId, newCapacity) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return false;
        }

        if (newCapacity < room.getUserCount()) {
            throw new Error('Cannot reduce capacity below current user count');
        }

        room.maxUsers = newCapacity;
        return true;
    }

    setRoomSettings(roomId, newSettings) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return false;
        }

        Object.assign(room.settings, newSettings);
        return true;
    }

    transferRoomOwnership(roomId, newOwnerId) {
        const room = this.rooms.get(roomId);
        if (!room || !room.isUserInRoom(newOwnerId)) {
            return false;
        }

        room.createdBy = newOwnerId;
        return true;
    }

    kickUserFromRoom(roomId, userId, reason = 'Kicked by admin') {
        const success = this.removeUserFromRoom(roomId, userId);
        if (success) {
            console.log(`👢 User ${userId} kicked from room ${roomId}: ${reason}`);
        }
        return success;
    }

    async shutdown() {
        console.log('🛑 Shutting down Room Manager...');
        
        try {
            // Clear cleanup interval
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }

            // Save room analytics before shutdown
            const analytics = this.getStats();
            console.log('📊 Final room statistics:', analytics);

            // Clear all data
            this.rooms.clear();
            this.userRoomMap.clear();
            
            console.log('✅ Room Manager shutdown complete');
            
        } catch (error) {
            console.error('❌ Room Manager shutdown error:', error);
        }
    }
}

module.exports = RoomManager;
