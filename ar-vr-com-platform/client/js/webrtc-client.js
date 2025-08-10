/**
 * WebRTC Client for AR/VR Communication Platform
 * Handles peer-to-peer connections, media streaming, and data channels
 */
export class WebRTCClient {
  constructor(socket) {
    this.socket = socket;
    
    // Connection management
    this.peerConnections = new Map();
    this.dataChannels = new Map();
    this.pendingConnections = new Map();
    
    // Media streams
    this.localStream = null;
    this.remoteStreams = new Map();
    this.screenShareStream = null;
    
    // Room and user management
    this.currentRoomId = null;
    this.currentUserId = null;
    this.roomUsers = new Map();
    
    // Configuration
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      
      mediaConstraints: {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2
        },
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        }
      },
      
      dataChannelConfig: {
        ordered: true,
        maxRetransmits: 3
      },
      
      connectionTimeout: 10000,
      reconnectAttempts: 3,
      reconnectDelay: 2000
    };
    
    // State tracking
    this.isInitialized = false;
    this.isConnectedToRoom = false;
    this.mediaEnabled = {
      audio: true,
      video: true,
      screen: false
    };
    
    // Statistics
    this.stats = {
      connectionsCreated: 0,
      connectionsSuccessful: 0,
      connectionsFailed: 0,
      dataChannelsCreated: 0,
      bytesReceived: 0,
      bytesSent: 0
    };
    
    // Event handlers
    this.eventHandlers = new Map();
    
    this.init();
  }

  async init() {
    try {
      console.log('📡 Initializing WebRTC Client...');
      
      // Check WebRTC support
      this.checkWebRTCSupport();
      
      // Setup socket event handlers
      this.setupSocketHandlers();
      
      // Initialize media devices
      await this.initializeMediaDevices();
      
      this.isInitialized = true;
      
      console.log('✅ WebRTC Client initialized');
      
    } catch (error) {
      console.error('❌ WebRTC Client initialization failed:', error);
      throw error;
    }
  }

  checkWebRTCSupport() {
    if (!window.RTCPeerConnection) {
      throw new Error('WebRTC is not supported in this browser');
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('⚠️ Media devices API not available');
    }
    
    console.log('✅ WebRTC support confirmed');
  }

  setupSocketHandlers() {
    // WebRTC signaling events
    this.socket.on('webrtc-offer', (data) => {
      this.handleOffer(data);
    });
    
    this.socket.on('webrtc-answer', (data) => {
      this.handleAnswer(data);
    });
    
    this.socket.on('webrtc-ice-candidate', (data) => {
      this.handleIceCandidate(data);
    });
    
    // Room events
    this.socket.on('room-joined', (data) => {
      this.handleRoomJoined(data);
    });
    
    this.socket.on('user-joined', (data) => {
      this.handleUserJoined(data);
    });
    
    this.socket.on('user-left', (data) => {
      this.handleUserLeft(data);
    });
    
    console.log('📡 Socket handlers setup complete');
  }

  async initializeMediaDevices() {
    try {
      // Get available media devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      console.log(`📹 Found ${videoDevices.length} video devices`);
      console.log(`🎤 Found ${audioDevices.length} audio devices`);
      
      // Initialize user media
      if (this.mediaEnabled.audio || this.mediaEnabled.video) {
        await this.getUserMedia();
      }
      
    } catch (error) {
      console.error('Media device initialization failed:', error);
      throw error;
    }
  }

  async getUserMedia(constraints = null) {
    try {
      const mediaConstraints = constraints || {
        audio: this.mediaEnabled.audio ? this.config.mediaConstraints.audio : false,
        video: this.mediaEnabled.video ? this.config.mediaConstraints.video : false
      };
      
      console.log('🎥 Requesting user media...', mediaConstraints);
      
      this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      
      console.log('✅ User media acquired');
      
      this.emit('local-stream-acquired', { stream: this.localStream });
      
      return this.localStream;
      
    } catch (error) {
      console.error('Failed to get user media:', error);
      this.emit('media-error', error);
      throw error;
    }
  }

  // Room Management
  async joinRoom(roomId, userId) {
    this.currentRoomId = roomId;
    this.currentUserId = userId;
    this.isConnectedToRoom = true;
    
    console.log(`📡 Joined room ${roomId} as user ${userId}`);
    
    this.emit('room-joined', { roomId, userId });
  }

  async leaveRoom() {
    if (!this.isConnectedToRoom) return;
    
    console.log(`📡 Leaving room ${this.currentRoomId}`);
    
    // Close all peer connections
    for (const [userId, connection] of this.peerConnections) {
      await this.closePeerConnection(userId);
    }
    
    // Clear room state
    this.currentRoomId = null;
    this.currentUserId = null;
    this.isConnectedToRoom = false;
    this.roomUsers.clear();
    
    this.emit('room-left');
  }

  // Peer Connection Management
  async createPeerConnection(userId, isInitiator = false) {
    try {
      console.log(`📡 Creating peer connection to user ${userId} (initiator: ${isInitiator})`);
      
      // Create peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: this.config.iceServers
      });
      
      // Setup event handlers
      this.setupPeerConnectionHandlers(peerConnection, userId, isInitiator);
      
      // Add local stream if available
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, this.localStream);
        });
      }
      
      // Create data channel if initiator
      if (isInitiator) {
        const dataChannel = peerConnection.createDataChannel(
          'communication',
          this.config.dataChannelConfig
        );
        
        this.setupDataChannelHandlers(dataChannel, userId);
        this.dataChannels.set(userId, dataChannel);
        this.stats.dataChannelsCreated++;
      }
      
      // Store connection
      this.peerConnections.set(userId, peerConnection);
      this.stats.connectionsCreated++;
      
      // Start connection process if initiator
      if (isInitiator) {
        await this.createOffer(userId);
      }
      
      this.emit('peer-connection-created', { userId, isInitiator });
      
      return peerConnection;
      
    } catch (error) {
      console.error(`Failed to create peer connection to ${userId}:`, error);
      this.stats.connectionsFailed++;
      throw error;
    }
  }

  setupPeerConnectionHandlers(peerConnection, userId, isInitiator) {
    // ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendIceCandidate(userId, event.candidate);
      } else {
        console.log(`📡 ICE gathering complete for ${userId}`);
      }
    };
    
    // Connection state changes
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`📡 Connection state changed for ${userId}: ${state}`);
      
      this.handleConnectionStateChange(userId, state);
    };
    
    // ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log(`📡 ICE connection state changed for ${userId}: ${state}`);
      
      if (state === 'connected' || state === 'completed') {
        this.stats.connectionsSuccessful++;
        this.emit('peer-connected', { userId });
      } else if (state === 'failed') {
        this.stats.connectionsFailed++;
        this.handleConnectionFailure(userId);
      }
    };
    
    // Remote stream handling
    peerConnection.ontrack = (event) => {
      console.log(`📡 Received remote track from ${userId}`);
      this.handleRemoteStream(userId, event.streams[0]);
    };
    
    // Data channel handling (for non-initiators)
    if (!isInitiator) {
      peerConnection.ondatachannel = (event) => {
        const dataChannel = event.channel;
        this.setupDataChannelHandlers(dataChannel, userId);
        this.dataChannels.set(userId, dataChannel);
      };
    }
  }

  setupDataChannelHandlers(dataChannel, userId) {
    dataChannel.onopen = () => {
      console.log(`📡 Data channel opened with ${userId}`);
      this.emit('data-channel-opened', { userId });
    };
    
    dataChannel.onclose = () => {
      console.log(`📡 Data channel closed with ${userId}`);
      this.emit('data-channel-closed', { userId });
    };
    
    dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(userId, event.data);
    };
    
    dataChannel.onerror = (error) => {
      console.error(`Data channel error with ${userId}:`, error);
      this.emit('data-channel-error', { userId, error });
    };
  }

  // Signaling Methods
  async createOffer(userId) {
    try {
      const peerConnection = this.peerConnections.get(userId);
      if (!peerConnection) {
        throw new Error(`No peer connection found for user ${userId}`);
      }
      
      console.log(`📡 Creating offer for ${userId}`);
      
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerConnection.setLocalDescription(offer);
      
      // Send offer through signaling server
      this.socket.emit('webrtc-signal', {
        type: 'offer',
        target: userId,
        signal: {
          type: offer.type,
          sdp: offer.sdp
        }
      });
      
      console.log(`📡 Offer sent to ${userId}`);
      
    } catch (error) {
      console.error(`Failed to create offer for ${userId}:`, error);
      throw error;
    }
  }

  async createAnswer(userId, offer) {
    try {
      const peerConnection = this.peerConnections.get(userId);
      if (!peerConnection) {
        throw new Error(`No peer connection found for user ${userId}`);
      }
      
      console.log(`📡 Creating answer for ${userId}`);
      
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      // Send answer through signaling server
      this.socket.emit('webrtc-signal', {
        type: 'answer',
        target: userId,
        signal: {
          type: answer.type,
          sdp: answer.sdp
        }
      });
      
      console.log(`📡 Answer sent to ${userId}`);
      
    } catch (error) {
      console.error(`Failed to create answer for ${userId}:`, error);
      throw error;
    }
  }

  sendIceCandidate(userId, candidate) {
    this.socket.emit('webrtc-signal', {
      type: 'ice-candidate',
      target: userId,
      signal: {
        candidate: candidate.candidate,
        sdpMLineIndex: candidate.sdpMLineIndex,
        sdpMid: candidate.sdpMid
      }
    });
  }

  // Signal Handlers
  async handleOffer(data) {
    try {
      const { from, signal } = data;
      
      console.log(`📡 Received offer from ${from}`);
      
      // Create peer connection if it doesn't exist
      if (!this.peerConnections.has(from)) {
        await this.createPeerConnection(from, false);
      }
      
      await this.createAnswer(from, signal);
      
    } catch (error) {
      console.error(`Failed to handle offer from ${data.from}:`, error);
    }
  }

  async handleAnswer(data) {
    try {
      const { from, signal } = data;
      
      console.log(`📡 Received answer from ${from}`);
      
      const peerConnection = this.peerConnections.get(from);
      if (!peerConnection) {
        console.error(`No peer connection found for user ${from}`);
        return;
      }
      
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
      
    } catch (error) {
      console.error(`Failed to handle answer from ${data.from}:`, error);
    }
  }

  async handleIceCandidate(data) {
    try {
      const { from, signal } = data;
      
      const peerConnection = this.peerConnections.get(from);
      if (!peerConnection) {
        console.error(`No peer connection found for user ${from}`);
        return;
      }
      
      const candidate = new RTCIceCandidate({
        candidate: signal.candidate,
        sdpMLineIndex: signal.sdpMLineIndex,
        sdpMid: signal.sdpMid
      });
      
      await peerConnection.addIceCandidate(candidate);
      
    } catch (error) {
      console.error(`Failed to handle ICE candidate from ${data.from}:`, error);
    }
  }

  // Room Event Handlers
  async handleRoomJoined(data) {
    const { room } = data;
    
    console.log(`📡 Room joined event received:`, room);
    
    // Connect to existing users in the room
    for (const user of room.users) {
      if (user.id !== this.currentUserId) {
        this.roomUsers.set(user.id, user);
        
        // Create peer connection as initiator
        await this.createPeerConnection(user.id, true);
      }
    }
  }

  async handleUserJoined(data) {
    const { user } = data;
    
    if (user.id === this.currentUserId) return;
    
    console.log(`📡 User joined: ${user.id}`);
    
    this.roomUsers.set(user.id, user);
    
    // The new user will initiate connections to existing users
    // We don't need to do anything here
  }

  async handleUserLeft(data) {
    const { user } = data;
    
    console.log(`📡 User left: ${user.userId || user.id}`);
    
    const userId = user.userId || user.id;
    
    // Clean up connection
    await this.closePeerConnection(userId);
    
    // Remove from room users
    this.roomUsers.delete(userId);
    
    this.emit('user-left', { userId });
  }

  // Stream Management
  handleRemoteStream(userId, stream) {
    console.log(`📡 Handling remote stream from ${userId}`);
    
    this.remoteStreams.set(userId, stream);
    
    this.emit('remote-stream-added', { userId, stream });
  }

  removeRemoteStream(userId) {
    const stream = this.remoteStreams.get(userId);
    if (stream) {
      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());
      
      this.remoteStreams.delete(userId);
      
      this.emit('remote-stream-removed', { userId });
    }
  }

  // Media Control
  async enableAudio() {
    try {
      if (!this.localStream) {
        await this.getUserMedia();
      }
      
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = true;
      });
      
      this.mediaEnabled.audio = true;
      this.emit('audio-enabled');
      
    } catch (error) {
      console.error('Failed to enable audio:', error);
    }
  }

  disableAudio() {
    if (!this.localStream) return;
    
    const audioTracks = this.localStream.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = false;
    });
    
    this.mediaEnabled.audio = false;
    this.emit('audio-disabled');
  }

  async enableVideo() {
    try {
      if (!this.localStream) {
        await this.getUserMedia();
      }
      
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = true;
      });
      
      this.mediaEnabled.video = true;
      this.emit('video-enabled');
      
    } catch (error) {
      console.error('Failed to enable video:', error);
    }
  }

  disableVideo() {
    if (!this.localStream) return;
    
    const videoTracks = this.localStream.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = false;
    });
    
    this.mediaEnabled.video = false;
    this.emit('video-disabled');
  }

  async startScreenShare() {
    try {
      console.log('🖥️ Starting screen share...');
      
      this.screenShareStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      // Replace video track in all peer connections
      for (const [userId, peerConnection] of this.peerConnections) {
        const videoSender = peerConnection.getSenders().find(sender => 
          sender.track && sender.track.kind === 'video'
        );
        
        if (videoSender) {
          const videoTrack = this.screenShareStream.getVideoTracks()[0];
          await videoSender.replaceTrack(videoTrack);
        }
      }
      
      // Handle screen share end
      this.screenShareStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };
      
      this.mediaEnabled.screen = true;
      this.emit('screen-share-started');
      
    } catch (error) {
      console.error('Failed to start screen share:', error);
      this.emit('screen-share-error', error);
    }
  }

  async stopScreenShare() {
    if (!this.screenShareStream) return;
    
    console.log('🖥️ Stopping screen share...');
    
    // Stop screen share tracks
    this.screenShareStream.getTracks().forEach(track => track.stop());
    
    // Replace with camera video track
    if (this.localStream) {
      for (const [userId, peerConnection] of this.peerConnections) {
        const videoSender = peerConnection.getSenders().find(sender => 
          sender.track && sender.track.kind === 'video'
        );
        
        if (videoSender) {
          const videoTrack = this.localStream.getVideoTracks()[0];
          if (videoTrack) {
            await videoSender.replaceTrack(videoTrack);
          }
        }
      }
    }
    
    this.screenShareStream = null;
    this.mediaEnabled.screen = false;
    this.emit('screen-share-stopped');
  }

  // Data Channel Communication
  sendDataToUser(userId, data) {
    const dataChannel = this.dataChannels.get(userId);
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.warn(`Data channel not available for user ${userId}`);
      return false;
    }
    
    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      dataChannel.send(message);
      
      this.stats.bytesSent += message.length;
      
      return true;
    } catch (error) {
      console.error(`Failed to send data to ${userId}:`, error);
      return false;
    }
  }

  sendDataToRoom(data) {
    let successCount = 0;
    
    for (const userId of this.roomUsers.keys()) {
      if (this.sendDataToUser(userId, data)) {
        successCount++;
      }
    }
    
    return successCount;
  }

  handleDataChannelMessage(userId, data) {
    try {
      let message;
      
      try {
        message = JSON.parse(data);
      } catch {
        message = data; // Plain text message
      }
      
      this.stats.bytesReceived += data.length;
      
      this.emit('data-received', { userId, data: message });
      
    } catch (error) {
      console.error(`Failed to handle data from ${userId}:`, error);
    }
  }

  // Connection Management
  handleConnectionStateChange(userId, state) {
    console.log(`📡 Connection state for ${userId}: ${state}`);
    
    switch (state) {
      case 'connected':
        this.emit('peer-connected', { userId });
        break;
      case 'disconnected':
        this.emit('peer-disconnected', { userId });
        break;
      case 'failed':
        this.handleConnectionFailure(userId);
        break;
      case 'closed':
        this.cleanupPeerConnection(userId);
        break;
    }
  }

  async handleConnectionFailure(userId) {
    console.warn(`📡 Connection failed for user ${userId}`);
    
    this.emit('peer-connection-failed', { userId });
    
    // Attempt reconnection
    setTimeout(() => {
      this.attemptReconnection(userId);
    }, this.config.reconnectDelay);
  }

  async attemptReconnection(userId) {
    if (!this.roomUsers.has(userId)) {
      console.log(`User ${userId} no longer in room, skipping reconnection`);
      return;
    }
    
    console.log(`📡 Attempting to reconnect to user ${userId}`);
    
    try {
      // Close existing connection
      await this.closePeerConnection(userId);
      
      // Create new connection
      await this.createPeerConnection(userId, true);
      
      this.emit('peer-reconnection-attempted', { userId });
      
    } catch (error) {
      console.error(`Reconnection failed for user ${userId}:`, error);
      this.emit('peer-reconnection-failed', { userId, error });
    }
  }

  async closePeerConnection(userId) {
    const peerConnection = this.peerConnections.get(userId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(userId);
    }
    
    const dataChannel = this.dataChannels.get(userId);
    if (dataChannel) {
      dataChannel.close();
      this.dataChannels.delete(userId);
    }
    
    // Remove remote stream
    this.removeRemoteStream(userId);
    
    console.log(`📡 Closed peer connection to ${userId}`);
  }

  cleanupPeerConnection(userId) {
    this.peerConnections.delete(userId);
    this.dataChannels.delete(userId);
    this.removeRemoteStream(userId);
  }

  // Statistics and Monitoring
  async getConnectionStats(userId) {
    const peerConnection = this.peerConnections.get(userId);
    if (!peerConnection) {
      return null;
    }
    
    try {
      const stats = await peerConnection.getStats();
      const connectionStats = {};
      
      stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          connectionStats.rtt = report.currentRoundTripTime;
          connectionStats.bytesReceived = report.bytesReceived;
          connectionStats.bytesSent = report.bytesSent;
        }
        
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
          connectionStats.videoPacketsReceived = report.packetsReceived;
          connectionStats.videoPacketsLost = report.packetsLost;
        }
        
        if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
          connectionStats.audioPacketsReceived = report.packetsReceived;
          connectionStats.audioPacketsLost = report.packetsLost;
        }
      });
      
      return connectionStats;
    } catch (error) {
      console.error(`Failed to get stats for ${userId}:`, error);
      return null;
    }
  }

  getOverallStats() {
    return {
      ...this.stats,
      activePeerConnections: this.peerConnections.size,
      activeDataChannels: this.dataChannels.size,
      remoteStreams: this.remoteStreams.size,
      roomUsers: this.roomUsers.size,
      isConnectedToRoom: this.isConnectedToRoom,
      mediaEnabled: { ...this.mediaEnabled }
    };
  }

  // Cleanup
  async cleanup() {
    console.log('📡 Cleaning up WebRTC Client...');
    
    // Stop screen share
    if (this.screenShareStream) {
      await this.stopScreenShare();
    }
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Close all peer connections
    for (const userId of this.peerConnections.keys()) {
      await this.closePeerConnection(userId);
    }
    
    // Clear state
    this.peerConnections.clear();
    this.dataChannels.clear();
    this.remoteStreams.clear();
    this.roomUsers.clear();
    
    this.isConnectedToRoom = false;
    this.currentRoomId = null;
    this.currentUserId = null;
    
    console.log('✅ WebRTC Client cleanup complete');
  }

  // Event System
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`WebRTC event handler error for ${event}:`, error);
        }
      });
    }
  }

  // Public API Methods
  getPeerConnections() {
    return Array.from(this.peerConnections.keys());
  }

  getRemoteStreams() {
    return Array.from(this.remoteStreams.entries());
  }

  getLocalStream() {
    return this.localStream;
  }

  isAudioEnabled() {
    return this.mediaEnabled.audio;
  }

  isVideoEnabled() {
    return this.mediaEnabled.video;
  }

  isScreenSharing() {
    return this.mediaEnabled.screen;
  }

  isConnected() {
    return this.isConnectedToRoom;
  }

  getRoomUsers() {
    return Array.from(this.roomUsers.values());
  }

  getCurrentRoomId() {
    return this.currentRoomId;
  }

  getCurrentUserId() {
    return this.currentUserId;
  }
}
