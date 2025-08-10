import { v4 as uuidv4 } from 'uuid';

/**
 * Room Manager for AR/VR Communication Platform
 * Manages virtual rooms, user sessions, and shared states
 */
export class RoomManager {
  constructor() {
    // Active rooms storage
    this.rooms = new Map();
    
    // Room templates and presets
    this.roomTemplates = new Map();
    
    // Room statistics
    this.stats = {
      totalRoomsCreated: 0,
      currentActiveRooms: 0,
      peakConcurrentRooms: 0,
      totalUsersServed: 0
    };
    
    // Configuration
    this.config = {
      maxRoomsPerServer: 1000,
      maxUsersPerRoom: 50,
      roomInactivityTimeout: 30 * 60 * 1000, // 30 minutes
      persistentRoomCleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
      maxObjectsPerRoom: 200,
      maxRoomNameLength: 50,
      defaultRoomSettings: {
        spatialAudio: true,
        handTracking: true,
        objectCollision: true,
        voiceChat: true,
        textChat: true,
        recordingSessions: false,
        maxBitrate: 2000000 // 2 Mbps
      }
    };
    
    this.initializeDefaultTemplates();
    this.startMaintenanceTasks();
    
    console.log('🏠 Room Manager initialized');
  }

  // Room Creation and Management
  createRoom(roomData) {
    try {
      // Validate room data
      this.validateRoomData(roomData);
      
      // Check server capacity
      if (this.rooms.size >= this.config.maxRoomsPerServer) {
        throw new Error('Server room capacity reached');
      }
      
      const roomId = roomData.id || this.generateRoomId();
      
      // Check if room already exists
      if (this.rooms.has(roomId)) {
        throw new Error(`Room ${roomId} already exists`);
      }
      
      const room = {
        id: roomId,
        name: roomData.name || `Room ${roomId}`,
        description: roomData.description || '',
        isPrivate: roomData.isPrivate || false,
        password: roomData.password || null,
        maxUsers: Math.min(roomData.maxUsers || 10, this.config.maxUsersPerRoom),
        
        // Room state
        users: [],
        objects: [],
        environment: roomData.environment || {},
        settings: { ...this.config.defaultRoomSettings, ...roomData.settings },
        
        // Metadata
        createdBy: roomData.createdBy,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        isPersistent: roomData.isPersistent || false,
        template: roomData.template || null,
        
        // Room statistics
        stats: {
          totalUsersJoined: 0,
          totalObjectsCreated: 0,
          totalInteractions: 0,
          averageSessionDuration: 0,
          peakConcurrentUsers: 0
        },
        
        // Room capabilities
        capabilities: {
          ar: true,
          vr: true,
          webrtc: true,
          spatialAudio: true,
          handTracking: roomData.handTracking !== false,
          eyeTracking: roomData.eyeTracking || false,
          faceTracking: roomData.faceTracking || false
        }
      };
      
      // Apply template if specified
      if (roomData.template && this.roomTemplates.has(roomData.template)) {
        this.applyRoomTemplate(room, roomData.template);
      }
      
      // Store room
      this.rooms.set(roomId, room);
      
      // Update statistics
      this.stats.totalRoomsCreated++;
      this.stats.currentActiveRooms++;
      this.stats.peakConcurrentRooms = Math.max(
        this.stats.peakConcurrentRooms, 
        this.stats.currentActiveRooms
      );
      
      console.log(`🏠 Room created: ${roomId} (${room.name})`);
      
      return room;
      
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  removeRoom(roomId) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        return false;
      }
      
      // Don't remove persistent rooms unless explicitly requested
      if (room.isPersistent && room.users.length > 0) {
        console.log(`⚠️ Attempted to remove persistent room ${roomId} with active users`);
        return false;
      }
      
      // Clean up room resources
      this.cleanupRoomResources(room);
      
      // Remove from storage
      this.rooms.delete(roomId);
      this.stats.currentActiveRooms--;
      
      console.log(`🗑️ Room removed: ${roomId}`);
      
      return true;
      
    } catch (error) {
      console.error('Error removing room:', error);
      return false;
    }
  }

  // Room Discovery and Listing
  getPublicRooms() {
    const publicRooms = [];
    
    for (const room of this.rooms.values()) {
      if (!room.isPrivate) {
        publicRooms.push({
          id: room.id,
          name: room.name,
          description: room.description,
          userCount: room.users.length,
          maxUsers: room.maxUsers,
          capabilities: room.capabilities,
          createdAt: room.createdAt,
          lastActivity: room.lastActivity,
          template: room.template
        });
      }
    }
    
    // Sort by activity and user count
    return publicRooms.sort((a, b) => {
      const scoreA = a.userCount * 2 + (new Date(a.lastActivity).getTime() / 1000000);
      const scoreB = b.userCount * 2 + (new Date(b.lastActivity).getTime() / 1000000);
      return scoreB - scoreA;
    });
  }

  getActiveRooms() {
    return Array.from(this.rooms.values()).filter(room => room.users.length > 0);
  }

  searchRooms(query, filters = {}) {
    const results = [];
    const searchTerm = query.toLowerCase();
    
    for (const room of this.rooms.values()) {
      // Skip private rooms unless specifically searching for them
      if (room.isPrivate && !filters.includePrivate) {
        continue;
      }
      
      // Text search
      const matchesText = !query || 
        room.name.toLowerCase().includes(searchTerm) ||
        room.description.toLowerCase().includes(searchTerm);
      
      // Capability filters
      const matchesCapabilities = !filters.capabilities || 
        filters.capabilities.every(cap => room.capabilities[cap]);
      
      // User count filter
      const matchesUserCount = !filters.minUsers || room.users.length >= filters.minUsers;
      
      // Template filter
      const matchesTemplate = !filters.template || room.template === filters.template;
      
      if (matchesText && matchesCapabilities && matchesUserCount && matchesTemplate) {
        results.push({
          id: room.id,
          name: room.name,
          description: room.description,
          userCount: room.users.length,
          maxUsers: room.maxUsers,
          capabilities: room.capabilities,
          template: room.template,
          relevanceScore: this.calculateRelevanceScore(room, query, filters)
        });
      }
    }
    
    // Sort by relevance score
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // User Management
  addUserToRoom(roomId, user) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }
      
      // Check room capacity
      if (room.users.length >= room.maxUsers) {
        throw new Error('Room is at maximum capacity');
      }
      
      // Check if user already in room
      if (room.users.some(u => u.id === user.id)) {
        throw new Error('User already in room');
      }
      
      // Add user to room
      const userInRoom = {
        ...user,
        joinedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        isActive: true,
        permissions: this.getUserPermissions(user, room),
        sessionStats: {
          objectsCreated: 0,
          interactions: 0,
          messagesPosted: 0,
          timeSpent: 0
        }
      };
      
      room.users.push(userInRoom);
      room.lastActivity = new Date().toISOString();
      
      // Update statistics
      room.stats.totalUsersJoined++;
      room.stats.peakConcurrentUsers = Math.max(
        room.stats.peakConcurrentUsers,
        room.users.length
      );
      
      console.log(`👤 User ${user.id} added to room ${roomId}`);
      
      return userInRoom;
      
    } catch (error) {
      console.error('Error adding user to room:', error);
      throw error;
    }
  }

  removeUserFromRoom(roomId, userId) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        return false;
      }
      
      const userIndex = room.users.findIndex(u => u.id === userId);
      if (userIndex === -1) {
        return false;
      }
      
      // Calculate session duration
      const user = room.users[userIndex];
      const sessionDuration = Date.now() - new Date(user.joinedAt).getTime();
      
      // Update room statistics
      room.stats.averageSessionDuration = (
        (room.stats.averageSessionDuration * (room.stats.totalUsersJoined - 1) + sessionDuration) /
        room.stats.totalUsersJoined
      );
      
      // Remove user
      room.users.splice(userIndex, 1);
      room.lastActivity = new Date().toISOString();
      
      console.log(`👤 User ${userId} removed from room ${roomId}`);
      
      return true;
      
    } catch (error) {
      console.error('Error removing user from room:', error);
      return false;
    }
  }

  updateUserActivity(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (room) {
      const user = room.users.find(u => u.id === userId);
      if (user) {
        user.lastActivity = new Date().toISOString();
        room.lastActivity = new Date().toISOString();
      }
    }
  }

  // Object Management
  addObjectToRoom(roomId, object) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }
      
      // Check object limit
      if (room.objects.length >= this.config.maxObjectsPerRoom) {
        throw new Error('Room object limit reached');
      }
      
      const objectWithMeta = {
        ...object,
        id: object.id || uuidv4(),
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        roomId: roomId,
        interactions: 0
      };
      
      room.objects.push(objectWithMeta);
      room.stats.totalObjectsCreated++;
      room.lastActivity = new Date().toISOString();
      
      console.log(`📦 Object added to room ${roomId}:`, objectWithMeta.id);
      
      return objectWithMeta;
      
    } catch (error) {
      console.error('Error adding object to room:', error);
      throw error;
    }
  }

  removeObjectFromRoom(roomId, objectId) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        return false;
      }
      
      const objectIndex = room.objects.findIndex(obj => obj.id === objectId);
      if (objectIndex === -1) {
        return false;
      }
      
      room.objects.splice(objectIndex, 1);
      room.lastActivity = new Date().toISOString();
      
      console.log(`📦 Object removed from room ${roomId}:`, objectId);
      
      return true;
      
    } catch (error) {
      console.error('Error removing object from room:', error);
      return false;
    }
  }

  updateObjectInRoom(roomId, objectId, updates) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        return false;
      }
      
      const object = room.objects.find(obj => obj.id === objectId);
      if (!object) {
        return false;
      }
      
      // Apply updates
      Object.assign(object, updates, {
        lastModified: new Date().toISOString()
      });
      
      room.lastActivity = new Date().toISOString();
      
      return object;
      
    } catch (error) {
      console.error('Error updating object in room:', error);
      return false;
    }
  }

  // Room Templates
  initializeDefaultTemplates() {
    // Conference Room Template
    this.roomTemplates.set('conference', {
      name: 'Conference Room',
      description: 'Professional meeting space with presentation tools',
      maxUsers: 20,
      environment: {
        lighting: 'office',
        background: 'modern_office',
        acoustics: 'conference'
      },
      objects: [
        {
          type: 'presentation_screen',
          position: [0, 2, -3],
          rotation: [0, 0, 0],
          scale: [2, 1.5, 0.1]
        },
        {
          type: 'conference_table',
          position: [0, 0.75, 0],
          rotation: [0, 0, 0],
          scale: [3, 0.1, 1.5]
        }
      ],
      settings: {
        spatialAudio: true,
        handTracking: true,
        recordingSessions: true,
        voiceChat: true,
        textChat: true
      }
    });
    
    // Social Space Template
    this.roomTemplates.set('social', {
      name: 'Social Space',
      description: 'Casual environment for social interaction',
      maxUsers: 30,
      environment: {
        lighting: 'warm',
        background: 'park',
        acoustics: 'outdoor'
      },
      objects: [
        {
          type: 'campfire',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        },
        {
          type: 'seating_circle',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [4, 0.5, 4]
        }
      ],
      settings: {
        spatialAudio: true,
        handTracking: true,
        objectCollision: false,
        voiceChat: true,
        textChat: true
      }
    });
    
    // Creative Studio Template
    this.roomTemplates.set('creative', {
      name: 'Creative Studio',
      description: 'Interactive space for creative collaboration',
      maxUsers: 15,
      environment: {
        lighting: 'creative',
        background: 'studio',
        acoustics: 'studio'
      },
      objects: [
        {
          type: 'easel',
          position: [-2, 0, -1],
          rotation: [0, 0.5, 0],
          scale: [1, 1, 1]
        },
        {
          type: 'work_table',
          position: [2, 0.8, 0],
          rotation: [0, 0, 0],
          scale: [1.5, 0.1, 1]
        }
      ],
      settings: {
        spatialAudio: true,
        handTracking: true,
        objectCollision: true,
        voiceChat: true,
        textChat: true
      }
    });
    
    console.log(`📝 ${this.roomTemplates.size} room templates initialized`);
  }

  applyRoomTemplate(room, templateName) {
    const template = this.roomTemplates.get(templateName);
    if (!template) {
      console.warn(`Template ${templateName} not found`);
      return;
    }
    
    // Apply template properties
    room.environment = { ...room.environment, ...template.environment };
    room.settings = { ...room.settings, ...template.settings };
    
    // Add template objects
    if (template.objects) {
      room.objects.push(...template.objects.map(obj => ({
        ...obj,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        isTemplate: true
      })));
    }
    
    console.log(`📝 Template ${templateName} applied to room ${room.id}`);
  }

  // Utility Methods
  validateRoomData(roomData) {
    if (!roomData.name || roomData.name.trim().length === 0) {
      throw new Error('Room name is required');
    }
    
    if (roomData.name.length > this.config.maxRoomNameLength) {
      throw new Error(`Room name too long (max ${this.config.maxRoomNameLength} characters)`);
    }
    
    if (roomData.maxUsers && (roomData.maxUsers < 1 || roomData.maxUsers > this.config.maxUsersPerRoom)) {
      throw new Error(`Invalid max users (must be 1-${this.config.maxUsersPerRoom})`);
    }
    
    if (roomData.isPrivate && !roomData.password) {
      console.warn('Private room created without password');
    }
  }

  generateRoomId() {
    return `room_${uuidv4().substr(0, 8)}_${Date.now()}`;
  }

  getUserPermissions(user, room) {
    const permissions = {
      canSpawnObjects: true,
      canDeleteObjects: false,
      canModifyRoom: false,
      canInviteUsers: true,
      canKickUsers: false,
      canRecordSessions: false
    };
    
    // Room creator gets admin permissions
    if (room.createdBy === user.id) {
      Object.keys(permissions).forEach(key => {
        permissions[key] = true;
      });
      permissions.isAdmin = true;
    }
    
    return permissions;
  }

  calculateRelevanceScore(room, query, filters) {
    let score = 0;
    
    // Text relevance
    if (query) {
      const searchTerm = query.toLowerCase();
      if (room.name.toLowerCase().includes(searchTerm)) score += 10;
      if (room.description.toLowerCase().includes(searchTerm)) score += 5;
    }
    
    // Activity score
    score += room.users.length * 2;
    
    // Recency score
    const daysSinceActivity = (Date.now() - new Date(room.lastActivity).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - daysSinceActivity);
    
    return score;
  }

  cleanupRoomResources(room) {
    // Clean up any room-specific resources
    // This could include file uploads, temporary data, etc.
    console.log(`🧹 Cleaning up resources for room ${room.id}`);
  }

  // Maintenance Tasks
  startMaintenanceTasks() {
    // Clean up inactive rooms
    setInterval(() => {
      this.cleanupInactiveRooms();
    }, 60000); // Every minute
    
    // Update room statistics
    setInterval(() => {
      this.updateRoomStatistics();
    }, 300000); // Every 5 minutes
    
    console.log('🔧 Room maintenance tasks started');
  }

  cleanupInactiveRooms() {
    const now = Date.now();
    const roomsToRemove = [];
    
    for (const [roomId, room] of this.rooms) {
      const inactiveTime = now - new Date(room.lastActivity).getTime();
      
      // Remove non-persistent rooms that are empty and inactive
      if (!room.isPersistent && 
          room.users.length === 0 && 
          inactiveTime > this.config.roomInactivityTimeout) {
        roomsToRemove.push(roomId);
      }
      
      // Clean up very old persistent rooms
      if (room.isPersistent && 
          room.users.length === 0 && 
          inactiveTime > this.config.persistentRoomCleanupInterval) {
        roomsToRemove.push(roomId);
      }
    }
    
    roomsToRemove.forEach(roomId => {
      this.removeRoom(roomId);
    });
    
    if (roomsToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${roomsToRemove.length} inactive rooms`);
    }
  }

  updateRoomStatistics() {
    // Update global statistics
    this.stats.currentActiveRooms = this.getActiveRooms().length;
    
    // Calculate total users currently in rooms
    let totalCurrentUsers = 0;
    for (const room of this.rooms.values()) {
      totalCurrentUsers += room.users.length;
    }
    
    console.log(`📊 Room stats: ${this.stats.currentActiveRooms} active rooms, ${totalCurrentUsers} users`);
  }

  // Public API Methods
  getRoomStatistics() {
    return {
      ...this.stats,
      currentUsers: Array.from(this.rooms.values()).reduce((sum, room) => sum + room.users.length, 0)
    };
  }

  getRoomTemplates() {
    return Array.from(this.roomTemplates.entries()).map(([id, template]) => ({
      id,
      name: template.name,
      description: template.description,
      maxUsers: template.maxUsers
    }));
  }
}
