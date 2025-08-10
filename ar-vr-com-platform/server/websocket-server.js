import { v4 as uuidv4 } from 'uuid';

/**
 * WebSocket Server for AR/VR Communication Platform
 * Handles real-time communication between clients
 */
export class WebSocketServer {
  constructor(io, roomManager, peerManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.peerManager = peerManager;
    
    // Connected clients tracking
    this.connectedClients = new Map();
    this.userSessions = new Map();
    
    console.log('🌐 WebSocket Server initialized');
  }

  // Room Management Handlers
  handleJoinRoom(socket, data) {
    try {
      const { roomId, user } = data;
      
      console.log(`User ${user.id} attempting to join room ${roomId}`);
      
      // Get or create room
      let room = this.roomManager.getRoom(roomId);
      if (!room) {
        // Create room if it doesn't exist
        room = this.roomManager.createRoom({
          id: roomId,
          name: `Room ${roomId}`,
          isPrivate: false,
          maxUsers: 50
        });
      }
      
      // Check room capacity
      if (room.users.length >= room.maxUsers) {
        socket.emit('join-room-error', {
          error: 'Room is full',
          roomId
        });
        return;
      }
      
      // Add user to room
      const userInRoom = {
        ...user,
        socketId: socket.id,
        joinedAt: new Date().toISOString(),
        isActive: true
      };
      
      room.users.push(userInRoom);
      
      // Join socket room
      socket.join(roomId);
      
      // Store user session
      this.userSessions.set(socket.id, {
        userId: user.id,
        roomId: roomId,
        user: userInRoom
      });
      
      // Notify user of successful join
      socket.emit('room-joined', {
        room: {
          id: room.id,
          name: room.name,
          users: room.users,
          objects: room.objects || [],
          environment: room.environment || {}
        }
      });
      
      // Notify other users in room
      socket.to(roomId).emit('user-joined', {
        user: userInRoom,
        roomId
      });
      
      console.log(`✅ User ${user.id} joined room ${roomId}`);
      
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('join-room-error', {
        error: error.message,
        roomId: data.roomId
      });
    }
  }

  handleLeaveRoom(socket, data) {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) return;
      
      const { roomId, userId } = session;
      
      // Remove user from room
      const room = this.roomManager.getRoom(roomId);
      if (room) {
        room.users = room.users.filter(u => u.id !== userId);
        
        // Clean up room if empty
        if (room.users.length === 0 && !room.isPersistent) {
          this.roomManager.removeRoom(roomId);
        }
      }
      
      // Leave socket room
      socket.leave(roomId);
      
      // Remove user session
      this.userSessions.delete(socket.id);
      
      // Notify other users
      socket.to(roomId).emit('user-left', {
        user: session.user,
        roomId
      });
      
      // Confirm to user
      socket.emit('room-left', { roomId });
      
      console.log(`👋 User ${userId} left room ${roomId}`);
      
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }

  handleCreateRoom(socket, data) {
    try {
      const { name, isPrivate, maxUsers, creator } = data;
      
      const room = this.roomManager.createRoom({
        name,
        isPrivate: isPrivate || false,
        maxUsers: maxUsers || 50,
        createdBy: creator.id,
        createdAt: new Date().toISOString()
      });
      
      socket.emit('room-created', { room });
      
      console.log(`🏠 Room created: ${room.id} by ${creator.id}`);
      
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('create-room-error', {
        error: error.message
      });
    }
  }

  // Device Management Handlers
  handleScanDevices(socket) {
    try {
      console.log(`🔍 Device scan requested by ${socket.id}`);
      
      // Emit scan start acknowledgment
      socket.emit('device-scan-started');
      
      // This would trigger the device discovery service
      // For now, we'll emit a mock device discovery event
      setTimeout(() => {
        socket.emit('devices-discovered', {
          devices: [
            {
              id: 'smart-tv-001',
              name: 'Living Room TV',
              type: 'smart-tv',
              protocol: 'wifi',
              capabilities: ['display', 'audio', 'control']
            },
            {
              id: 'speaker-001',
              name: 'Bluetooth Speaker',
              type: 'audio',
              protocol: 'bluetooth',
              capabilities: ['audio']
            }
          ]
        });
      }, 2000);
      
    } catch (error) {
      console.error('Error scanning devices:', error);
      socket.emit('device-scan-error', {
        error: error.message
      });
    }
  }

  handleConnectDevice(socket, data) {
    try {
      const { deviceId, protocol } = data;
      
      console.log(`🔗 Device connection requested: ${deviceId} via ${protocol}`);
      
      // Mock device connection
      setTimeout(() => {
        socket.emit('device-connected', {
          device: {
            id: deviceId,
            name: 'Connected Device',
            type: 'smart-device',
            protocol,
            status: 'connected',
            connectedAt: new Date().toISOString()
          }
        });
      }, 1000);
      
    } catch (error) {
      console.error('Error connecting device:', error);
      socket.emit('device-connect-error', {
        error: error.message,
        deviceId: data.deviceId
      });
    }
  }

  handleDeviceCommand(socket, data) {
    try {
      const { deviceId, command, params } = data;
      
      console.log(`📱 Device command: ${command} to ${deviceId}`);
      
      // Mock command execution
      socket.emit('device-command-result', {
        deviceId,
        command,
        result: 'success',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error executing device command:', error);
      socket.emit('device-command-error', {
        error: error.message,
        deviceId: data.deviceId,
        command: data.command
      });
    }
  }

  // AR/VR Object Management
  handleSpawnObject(socket, data) {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) return;
      
      const { roomId, object } = data;
      
      // Add object to room
      const room = this.roomManager.getRoom(roomId);
      if (room) {
        if (!room.objects) room.objects = [];
        
        const objectWithMeta = {
          ...object,
          id: object.id || uuidv4(),
          createdBy: session.userId,
          createdAt: new Date().toISOString(),
          roomId
        };
        
        room.objects.push(objectWithMeta);
        
        // Broadcast to all users in room
        this.io.to(roomId).emit('object-spawned', {
          object: objectWithMeta,
          roomId
        });
        
        console.log(`📦 Object spawned in room ${roomId}:`, objectWithMeta.type);
      }
      
    } catch (error) {
      console.error('Error spawning object:', error);
    }
  }

  handleObjectInteraction(socket, data) {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) return;
      
      const { roomId, objectId, interaction } = data;
      
      // Broadcast interaction to room (except sender)
      socket.to(roomId).emit('object-interaction', {
        objectId,
        interaction,
        userId: session.userId,
        timestamp: new Date().toISOString()
      });
      
      console.log(`🤏 Object interaction in room ${roomId}:`, objectId);
      
    } catch (error) {
      console.error('Error handling object interaction:', error);
    }
  }

  // Position and Movement Updates
  handlePositionUpdate(socket, data) {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) return;
      
      const { position, rotation, roomId } = data;
      
      // Update user position in room
      const room = this.roomManager.getRoom(roomId || session.roomId);
      if (room) {
        const user = room.users.find(u => u.id === session.userId);
        if (user) {
          user.position = position;
          user.rotation = rotation;
          user.lastUpdate = new Date().toISOString();
        }
      }
      
      // Broadcast position update to room (except sender)
      socket.to(roomId || session.roomId).emit('user-position-update', {
        userId: session.userId,
        position,
        rotation,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error handling position update:', error);
    }
  }

  // WebRTC Signaling Handlers
  handleWebRTCSignal(socket, data) {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) return;
      
      const { type, target, signal } = data;
      
      // Find target user's socket
      const targetSession = Array.from(this.userSessions.values())
        .find(s => s.userId === target && s.roomId === session.roomId);
      
      if (targetSession) {
        const targetSocket = this.io.sockets.sockets.get(targetSession.socketId);
        if (targetSocket) {
          targetSocket.emit('webrtc-signal', {
            type,
            from: session.userId,
            signal,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      console.log(`📡 WebRTC signal ${type} from ${session.userId} to ${target}`);
      
    } catch (error) {
      console.error('Error handling WebRTC signal:', error);
    }
  }

  // Spatial Audio Updates
  handleSpatialAudioUpdate(socket, data) {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) return;
      
      const { audioSettings, roomId } = data;
      
      // Broadcast audio settings to room (except sender)
      socket.to(roomId || session.roomId).emit('spatial-audio-update', {
        userId: session.userId,
        audioSettings,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error handling spatial audio update:', error);
    }
  }

  // Room State Management
  handleGetRoomState(socket, data) {
    try {
      const { roomId } = data;
      
      const room = this.roomManager.getRoom(roomId);
      if (room) {
        socket.emit('room-state', {
          room: {
            id: room.id,
            name: room.name,
            users: room.users,
            objects: room.objects || [],
            environment: room.environment || {},
            settings: room.settings || {}
          }
        });
      } else {
        socket.emit('room-state-error', {
          error: 'Room not found',
          roomId
        });
      }
      
    } catch (error) {
      console.error('Error getting room state:', error);
      socket.emit('room-state-error', {
        error: error.message,
        roomId: data.roomId
      });
    }
  }

  handleUpdateRoomSettings(socket, data) {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) return;
      
      const { roomId, settings } = data;
      
      const room = this.roomManager.getRoom(roomId);
      if (room) {
        // Check if user has permission to update settings
        const user = room.users.find(u => u.id === session.userId);
        if (user && (room.createdBy === session.userId || user.isAdmin)) {
          room.settings = { ...room.settings, ...settings };
          
          // Broadcast settings update to all users in room
          this.io.to(roomId).emit('room-settings-updated', {
            settings: room.settings,
            updatedBy: session.userId,
            timestamp: new Date().toISOString()
          });
          
          console.log(`⚙️ Room settings updated for ${roomId}`);
        } else {
          socket.emit('room-settings-error', {
            error: 'Permission denied',
            roomId
          });
        }
      }
      
    } catch (error) {
      console.error('Error updating room settings:', error);
    }
  }

  // User Management
  handleUpdateUserStatus(socket, data) {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) return;
      
      const { status, metadata } = data;
      
      // Update user status in room
      const room = this.roomManager.getRoom(session.roomId);
      if (room) {
        const user = room.users.find(u => u.id === session.userId);
        if (user) {
          user.status = status;
          user.metadata = { ...user.metadata, ...metadata };
          user.lastStatusUpdate = new Date().toISOString();
        }
      }
      
      // Broadcast status update to room
      socket.to(session.roomId).emit('user-status-update', {
        userId: session.userId,
        status,
        metadata,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  }

  // Message Broadcasting
  handleBroadcastMessage(socket, data) {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) return;
      
      const { message, type, targets } = data;
      
      const messageData = {
        id: uuidv4(),
        from: session.userId,
        message,
        type: type || 'text',
        timestamp: new Date().toISOString(),
        roomId: session.roomId
      };
      
      if (targets && targets.length > 0) {
        // Send to specific users
        targets.forEach(targetId => {
          const targetSession = Array.from(this.userSessions.values())
            .find(s => s.userId === targetId && s.roomId === session.roomId);
          
          if (targetSession) {
            const targetSocket = this.io.sockets.sockets.get(targetSession.socketId);
            if (targetSocket) {
              targetSocket.emit('message-received', messageData);
            }
          }
        });
      } else {
        // Broadcast to entire room
        socket.to(session.roomId).emit('message-received', messageData);
      }
      
      console.log(`💬 Message broadcast in room ${session.roomId}`);
      
    } catch (error) {
      console.error('Error broadcasting message:', error);
    }
  }

  // Connection Management
  handleDisconnect(socket) {
    try {
      const session = this.userSessions.get(socket.id);
      
      if (session) {
        const { userId, roomId, user } = session;
        
        console.log(`🔌 User ${userId} disconnecting from room ${roomId}`);
        
        // Remove user from room
        const room = this.roomManager.getRoom(roomId);
        if (room) {
          room.users = room.users.filter(u => u.id !== userId);
          
          // Notify other users in room
          socket.to(roomId).emit('user-disconnected', {
            user,
            userId,
            timestamp: new Date().toISOString()
          });
          
          // Clean up empty room if not persistent
          if (room.users.length === 0 && !room.isPersistent) {
            this.roomManager.removeRoom(roomId);
            console.log(`🗑️ Empty room ${roomId} removed`);
          }
        }
        
        // Clean up session
        this.userSessions.delete(socket.id);
        
        // Clean up peer connections
        this.peerManager.cleanupUserConnections(userId);
      }
      
      // Remove from connected clients
      this.connectedClients.delete(socket.id);
      
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  }

  // Heartbeat and Health Monitoring
  handlePing(socket, data) {
    try {
      socket.emit('pong', {
        timestamp: new Date().toISOString(),
        serverTime: Date.now()
      });
    } catch (error) {
      console.error('Error handling ping:', error);
    }
  }

  handleGetServerStats(socket) {
    try {
      const stats = {
        connectedUsers: this.userSessions.size,
        activeRooms: this.roomManager.getActiveRooms().length,
        totalMessages: this.getTotalMessageCount(),
        serverUptime: process.uptime(),
        timestamp: new Date().toISOString()
      };
      
      socket.emit('server-stats', stats);
      
    } catch (error) {
      console.error('Error getting server stats:', error);
    }
  }

  // Utility Methods
  getTotalMessageCount() {
    // This would typically come from a database or message counter
    return 0;
  }

  getRoomUsers(roomId) {
    const room = this.roomManager.getRoom(roomId);
    return room ? room.users : [];
  }

  isUserInRoom(userId, roomId) {
    const room = this.roomManager.getRoom(roomId);
    return room ? room.users.some(u => u.id === userId) : false;
  }

  broadcastToRoom(roomId, event, data, excludeSocketId = null) {
    try {
      if (excludeSocketId) {
        this.io.to(roomId).except(excludeSocketId).emit(event, data);
      } else {
        this.io.to(roomId).emit(event, data);
      }
    } catch (error) {
      console.error('Error broadcasting to room:', error);
    }
  }

  getUserSocket(userId) {
    const session = Array.from(this.userSessions.values())
      .find(s => s.userId === userId);
    
    if (session) {
      return this.io.sockets.sockets.get(session.socketId);
    }
    
    return null;
  }

  // Event Emission Helpers
  emitToUser(userId, event, data) {
    const socket = this.getUserSocket(userId);
    if (socket) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }

  emitToRoom(roomId, event, data, excludeUserId = null) {
    const room = this.roomManager.getRoom(roomId);
    if (room) {
      room.users.forEach(user => {
        if (!excludeUserId || user.id !== excludeUserId) {
          this.emitToUser(user.id, event, data);
        }
      });
    }
  }

  // Cleanup and Maintenance
  cleanupInactiveUsers() {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes
    
    for (const [socketId, session] of this.userSessions) {
      const socket = this.io.sockets.sockets.get(socketId);
      
      if (!socket || (session.lastActivity && now - session.lastActivity > inactiveThreshold)) {
        console.log(`🧹 Cleaning up inactive user: ${session.userId}`);
        this.handleDisconnect({ id: socketId });
      }
    }
  }

  // Start periodic cleanup
  startMaintenance() {
    setInterval(() => {
      this.cleanupInactiveUsers();
    }, 60000); // Run every minute
    
    console.log('🔧 Maintenance tasks started');
  }
}
