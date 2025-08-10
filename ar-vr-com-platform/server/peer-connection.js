import { v4 as uuidv4 } from 'uuid';

/**
 * Peer Connection Manager for AR/VR Communication Platform
 * Handles WebRTC signaling and peer-to-peer connection management
 */
export class PeerConnectionManager {
  constructor() {
    // Active peer connections tracking
    this.connections = new Map();
    this.signalingQueue = new Map();
    
    // Connection statistics
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      failedConnections: 0,
      successfulConnections: 0,
      averageConnectionTime: 0,
      totalDataTransferred: 0
    };
    
    // Configuration
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // Add TURN servers for production
        // {
        //   urls: 'turn:your-turn-server.com:3478',
        //   username: 'username',
        //   credential: 'password'
        // }
      ],
      connectionTimeout: 30000, // 30 seconds
      keepAliveInterval: 5000, // 5 seconds
      maxConnectionsPerUser: 10,
      maxDataChannelSize: 16384, // 16KB
      connectionStates: ['new', 'connecting', 'connected', 'disconnected', 'failed', 'closed']
    };
    
    this.startMaintenanceTasks();
    
    console.log('🔗 Peer Connection Manager initialized');
  }

  // Connection Management
  createConnection(fromUserId, toUserId, roomId, connectionType = 'full') {
    try {
      const connectionId = this.generateConnectionId(fromUserId, toUserId);
      
      // Check if connection already exists
      if (this.connections.has(connectionId)) {
        const existingConnection = this.connections.get(connectionId);
        if (existingConnection.state === 'connected') {
          console.log(`⚠️ Connection already exists: ${connectionId}`);
          return existingConnection;
        }
      }
      
      // Check connection limits
      if (!this.canCreateConnection(fromUserId)) {
        throw new Error(`User ${fromUserId} has reached maximum connections`);
      }
      
      const connection = {
        id: connectionId,
        fromUserId,
        toUserId,
        roomId,
        type: connectionType, // 'full', 'audio-only', 'data-only'
        state: 'new',
        
        // WebRTC components
        peerConnection: null,
        localDescription: null,
        remoteDescription: null,
        iceGatheringComplete: false,
        
        // Data channels
        dataChannels: new Map(),
        
        // Media streams
        localStreams: new Map(),
        remoteStreams: new Map(),
        
        // Connection metadata
        createdAt: new Date().toISOString(),
        connectedAt: null,
        lastActivity: new Date().toISOString(),
        
        // Statistics
        stats: {
          bytesReceived: 0,
          bytesSent: 0,
          packetsLost: 0,
          roundTripTime: 0,
          connectionTime: 0
        },
        
        // Event handlers
        onStateChange: null,
        onDataChannel: null,
        onStream: null
      };
      
      // Store connection
      this.connections.set(connectionId, connection);
      this.stats.totalConnections++;
      
      console.log(`🔗 Connection created: ${connectionId} (${fromUserId} -> ${toUserId})`);
      
      return connection;
      
    } catch (error) {
      console.error('Error creating connection:', error);
      throw error;
    }
  }

  getConnection(fromUserId, toUserId) {
    const connectionId = this.generateConnectionId(fromUserId, toUserId);
    return this.connections.get(connectionId);
  }

  removeConnection(fromUserId, toUserId) {
    try {
      const connectionId = this.generateConnectionId(fromUserId, toUserId);
      const connection = this.connections.get(connectionId);
      
      if (connection) {
        // Clean up WebRTC resources
        this.cleanupConnection(connection);
        
        // Remove from tracking
        this.connections.delete(connectionId);
        this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
        
        console.log(`🔗 Connection removed: ${connectionId}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Error removing connection:', error);
      return false;
    }
  }

  // WebRTC Signaling Handlers
  handleOffer(roomId, offer, fromUserId, toUserId) {
    try {
      console.log(`📤 Handling offer from ${fromUserId} to ${toUserId}`);
      
      // Get or create connection
      let connection = this.getConnection(fromUserId, toUserId);
      if (!connection) {
        connection = this.createConnection(fromUserId, toUserId, roomId);
      }
      
      // Store offer
      connection.localDescription = offer;
      connection.state = 'connecting';
      connection.lastActivity = new Date().toISOString();
      
      // Queue signaling message
      this.queueSignalingMessage(toUserId, {
        type: 'offer',
        connectionId: connection.id,
        fromUserId,
        toUserId,
        roomId,
        offer,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ Offer queued for ${toUserId}`);
      
    } catch (error) {
      console.error('Error handling offer:', error);
      throw error;
    }
  }

  handleAnswer(roomId, answer, fromUserId, toUserId) {
    try {
      console.log(`📥 Handling answer from ${fromUserId} to ${toUserId}`);
      
      // Find existing connection (answer is response to offer)
      const connection = this.getConnection(toUserId, fromUserId);
      if (!connection) {
        throw new Error(`No connection found for answer from ${fromUserId} to ${toUserId}`);
      }
      
      // Store answer
      connection.remoteDescription = answer;
      connection.lastActivity = new Date().toISOString();
      
      // Queue signaling message
      this.queueSignalingMessage(toUserId, {
        type: 'answer',
        connectionId: connection.id,
        fromUserId,
        toUserId,
        roomId,
        answer,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ Answer queued for ${toUserId}`);
      
    } catch (error) {
      console.error('Error handling answer:', error);
      throw error;
    }
  }

  handleIceCandidate(roomId, candidate, fromUserId, toUserId) {
    try {
      console.log(`🧊 Handling ICE candidate from ${fromUserId} to ${toUserId}`);
      
      // Find connection
      let connection = this.getConnection(fromUserId, toUserId);
      if (!connection) {
        connection = this.getConnection(toUserId, fromUserId);
      }
      
      if (!connection) {
        console.warn(`No connection found for ICE candidate from ${fromUserId} to ${toUserId}`);
        return;
      }
      
      // Update activity
      connection.lastActivity = new Date().toISOString();
      
      // Queue signaling message
      this.queueSignalingMessage(toUserId, {
        type: 'ice-candidate',
        connectionId: connection.id,
        fromUserId,
        toUserId,
        roomId,
        candidate,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ ICE candidate queued for ${toUserId}`);
      
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  handleConnectionStateChange(fromUserId, toUserId, newState, metadata = {}) {
    try {
      const connection = this.getConnection(fromUserId, toUserId);
      if (!connection) {
        console.warn(`Connection not found for state change: ${fromUserId} -> ${toUserId}`);
        return;
      }
      
      const oldState = connection.state;
      connection.state = newState;
      connection.lastActivity = new Date().toISOString();
      
      // Handle specific state changes
      switch (newState) {
        case 'connected':
          if (oldState !== 'connected') {
            connection.connectedAt = new Date().toISOString();
            connection.stats.connectionTime = Date.now() - new Date(connection.createdAt).getTime();
            this.stats.activeConnections++;
            this.stats.successfulConnections++;
            
            // Update average connection time
            this.updateAverageConnectionTime(connection.stats.connectionTime);
          }
          break;
          
        case 'failed':
          this.stats.failedConnections++;
          this.scheduleConnectionCleanup(connection.id, 5000); // Clean up in 5 seconds
          break;
          
        case 'disconnected':
          if (oldState === 'connected') {
            this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
          }
          this.scheduleConnectionCleanup(connection.id, 30000); // Clean up in 30 seconds
          break;
          
        case 'closed':
          if (oldState === 'connected') {
            this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
          }
          this.scheduleConnectionCleanup(connection.id, 1000); // Clean up in 1 second
          break;
      }
      
      console.log(`🔄 Connection state changed: ${connection.id} (${oldState} -> ${newState})`);
      
      // Notify if handler is set
      if (connection.onStateChange) {
        connection.onStateChange(oldState, newState, metadata);
      }
      
    } catch (error) {
      console.error('Error handling connection state change:', error);
    }
  }

  // Data Channel Management
  createDataChannel(fromUserId, toUserId, channelName, options = {}) {
    try {
      const connection = this.getConnection(fromUserId, toUserId);
      if (!connection) {
        throw new Error('Connection not found');
      }
      
      const channelId = `${channelName}_${uuidv4().substr(0, 8)}`;
      
      const dataChannel = {
        id: channelId,
        name: channelName,
        connectionId: connection.id,
        state: 'connecting',
        ordered: options.ordered !== false,
        protocol: options.protocol || '',
        maxRetransmits: options.maxRetransmits,
        maxPacketLifeTime: options.maxPacketLifeTime,
        
        // Statistics
        stats: {
          messagesSent: 0,
          messagesReceived: 0,
          bytesSent: 0,
          bytesReceived: 0
        },
        
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };
      
      connection.dataChannels.set(channelId, dataChannel);
      
      console.log(`📡 Data channel created: ${channelId} for connection ${connection.id}`);
      
      return dataChannel;
      
    } catch (error) {
      console.error('Error creating data channel:', error);
      throw error;
    }
  }

  handleDataChannelMessage(fromUserId, toUserId, channelId, message) {
    try {
      const connection = this.getConnection(fromUserId, toUserId);
      if (!connection) {
        console.warn(`Connection not found for data channel message: ${fromUserId} -> ${toUserId}`);
        return;
      }
      
      const dataChannel = connection.dataChannels.get(channelId);
      if (!dataChannel) {
        console.warn(`Data channel not found: ${channelId}`);
        return;
      }
      
      // Update statistics
      dataChannel.stats.messagesReceived++;
      dataChannel.stats.bytesReceived += message.length || 0;
      dataChannel.lastActivity = new Date().toISOString();
      connection.lastActivity = new Date().toISOString();
      
      // Update global statistics
      this.stats.totalDataTransferred += message.length || 0;
      
      console.log(`📨 Data channel message received: ${channelId} (${message.length} bytes)`);
      
    } catch (error) {
      console.error('Error handling data channel message:', error);
    }
  }

  // Media Stream Management
  addStreamToConnection(fromUserId, toUserId, streamId, streamType = 'video') {
    try {
      const connection = this.getConnection(fromUserId, toUserId);
      if (!connection) {
        throw new Error('Connection not found');
      }
      
      const stream = {
        id: streamId,
        type: streamType, // 'video', 'audio', 'screen'
        connectionId: connection.id,
        active: true,
        createdAt: new Date().toISOString(),
        
        // Stream metadata
        metadata: {
          width: null,
          height: null,
          frameRate: null,
          bitrate: null,
          codec: null
        },
        
        // Statistics
        stats: {
          framesDropped: 0,
          totalFrames: 0,
          bytesReceived: 0,
          bytesSent: 0
        }
      };
      
      connection.localStreams.set(streamId, stream);
      connection.lastActivity = new Date().toISOString();
      
      console.log(`🎥 Stream added to connection: ${streamId} (${streamType})`);
      
      return stream;
      
    } catch (error) {
      console.error('Error adding stream to connection:', error);
      throw error;
    }
  }

  removeStreamFromConnection(fromUserId, toUserId, streamId) {
    try {
      const connection = this.getConnection(fromUserId, toUserId);
      if (connection) {
        const removed = connection.localStreams.delete(streamId);
        if (removed) {
          connection.lastActivity = new Date().toISOString();
          console.log(`🎥 Stream removed from connection: ${streamId}`);
        }
        return removed;
      }
      return false;
    } catch (error) {
      console.error('Error removing stream from connection:', error);
      return false;
    }
  }

  // Signaling Queue Management
  queueSignalingMessage(userId, message) {
    if (!this.signalingQueue.has(userId)) {
      this.signalingQueue.set(userId, []);
    }
    
    this.signalingQueue.get(userId).push(message);
    
    // Limit queue size to prevent memory issues
    const queue = this.signalingQueue.get(userId);
    if (queue.length > 100) {
      queue.splice(0, queue.length - 100);
    }
  }

  getSignalingMessages(userId) {
    const messages = this.signalingQueue.get(userId) || [];
    this.signalingQueue.set(userId, []); // Clear queue after retrieval
    return messages;
  }

  // Connection Utilities
  generateConnectionId(fromUserId, toUserId) {
    // Create deterministic connection ID
    const users = [fromUserId, toUserId].sort();
    return `conn_${users[0]}_${users[1]}`;
  }

  canCreateConnection(userId) {
    const userConnections = Array.from(this.connections.values())
      .filter(conn => conn.fromUserId === userId || conn.toUserId === userId);
    
    return userConnections.length < this.config.maxConnectionsPerUser;
  }

  getUserConnections(userId) {
    return Array.from(this.connections.values())
      .filter(conn => conn.fromUserId === userId || conn.toUserId === userId);
  }

  getRoomConnections(roomId) {
    return Array.from(this.connections.values())
      .filter(conn => conn.roomId === roomId);
  }

  cleanupUserConnections(userId) {
    try {
      const userConnections = this.getUserConnections(userId);
      
      userConnections.forEach(connection => {
        this.cleanupConnection(connection);
        this.connections.delete(connection.id);
      });
      
      // Clear signaling queue
      this.signalingQueue.delete(userId);
      
      console.log(`🧹 Cleaned up ${userConnections.length} connections for user ${userId}`);
      
    } catch (error) {
      console.error('Error cleaning up user connections:', error);
    }
  }

  cleanupConnection(connection) {
    try {
      // Close data channels
      connection.dataChannels.clear();
      
      // Clear streams
      connection.localStreams.clear();
      connection.remoteStreams.clear();
      
      // Update state
      connection.state = 'closed';
      
      console.log(`🧹 Connection cleaned up: ${connection.id}`);
      
    } catch (error) {
      console.error('Error cleaning up connection:', error);
    }
  }

  scheduleConnectionCleanup(connectionId, delay) {
    setTimeout(() => {
      const connection = Array.from(this.connections.values())
        .find(conn => conn.id === connectionId);
      
      if (connection && (connection.state === 'failed' || connection.state === 'closed' || connection.state === 'disconnected')) {
        this.connections.delete(connectionId);
        console.log(`🧹 Scheduled cleanup completed for connection: ${connectionId}`);
      }
    }, delay);
  }

  updateAverageConnectionTime(connectionTime) {
    const currentAvg = this.stats.averageConnectionTime;
    const successfulConns = this.stats.successfulConnections;
    
    this.stats.averageConnectionTime = (
      (currentAvg * (successfulConns - 1) + connectionTime) / successfulConns
    );
  }

  // Maintenance Tasks
  startMaintenanceTasks() {
    // Clean up stale connections
    setInterval(() => {
      this.cleanupStaleConnections();
    }, 60000); // Every minute
    
    // Update connection statistics
    setInterval(() => {
      this.updateConnectionStatistics();
    }, 30000); // Every 30 seconds
    
    // Clear old signaling messages
    setInterval(() => {
      this.cleanupSignalingQueue();
    }, 300000); // Every 5 minutes
    
    console.log('🔧 Peer connection maintenance tasks started');
  }

  cleanupStaleConnections() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const connectingThreshold = 60 * 1000; // 1 minute for connecting state
    
    const staleConnections = [];
    
    for (const [connectionId, connection] of this.connections) {
      const lastActivity = new Date(connection.lastActivity).getTime();
      const timeSinceActivity = now - lastActivity;
      
      // Clean up connections that have been connecting too long
      if (connection.state === 'connecting' && timeSinceActivity > connectingThreshold) {
        staleConnections.push(connectionId);
      }
      
      // Clean up inactive connections
      if ((connection.state === 'disconnected' || connection.state === 'failed') && 
          timeSinceActivity > staleThreshold) {
        staleConnections.push(connectionId);
      }
    }
    
    staleConnections.forEach(connectionId => {
      const connection = this.connections.get(connectionId);
      if (connection) {
        this.cleanupConnection(connection);
        this.connections.delete(connectionId);
      }
    });
    
    if (staleConnections.length > 0) {
      console.log(`🧹 Cleaned up ${staleConnections.length} stale connections`);
    }
  }

  updateConnectionStatistics() {
    // Recalculate active connections
    this.stats.activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.state === 'connected').length;
    
    console.log(`📊 Peer stats: ${this.stats.activeConnections} active, ${this.connections.size} total connections`);
  }

  cleanupSignalingQueue() {
    const maxAge = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    
    for (const [userId, messages] of this.signalingQueue) {
      const filteredMessages = messages.filter(msg => {
        const messageAge = now - new Date(msg.timestamp).getTime();
        return messageAge < maxAge;
      });
      
      if (filteredMessages.length !== messages.length) {
        this.signalingQueue.set(userId, filteredMessages);
      }
      
      // Remove empty queues
      if (filteredMessages.length === 0) {
        this.signalingQueue.delete(userId);
      }
    }
  }

  // Public API Methods
  getConnectionStatistics() {
    return {
      ...this.stats,
      currentActiveConnections: this.stats.activeConnections,
      totalTrackedConnections: this.connections.size,
      queuedSignalingMessages: Array.from(this.signalingQueue.values())
        .reduce((sum, queue) => sum + queue.length, 0)
    };
  }

  getConnectionDetails(fromUserId, toUserId) {
    const connection = this.getConnection(fromUserId, toUserId);
    if (!connection) {
      return null;
    }
    
    return {
      id: connection.id,
      fromUserId: connection.fromUserId,
      toUserId: connection.toUserId,
      roomId: connection.roomId,
      state: connection.state,
      type: connection.type,
      createdAt: connection.createdAt,
      connectedAt: connection.connectedAt,
      dataChannelCount: connection.dataChannels.size,
      streamCount: connection.localStreams.size,
      stats: connection.stats
    };
  }
}
