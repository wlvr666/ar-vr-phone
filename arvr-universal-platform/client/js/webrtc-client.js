// webrtc-client.js - Global Peer-to-Peer Communication

export class WebRTCClient extends EventTarget {
    constructor() {
        super();
        this.localStream = null;
        this.peerConnections = new Map();
        this.dataChannels = new Map();
        this.signalingSocket = null;
        this.localUserId = null;
        this.currentRoom = null;
        
        // WebRTC configuration
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun.stunprotocol.org:3478' },
                // Add TURN servers for production
                // { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' }
            ],
            iceCandidatePoolSize: 10
        };
        
        // Media constraints
        this.mediaConstraints = {
            video: {
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                frameRate: { ideal: 30, max: 60 },
                facingMode: 'user'
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000
            }
        };
        
        // Connection states
        this.connectionStates = new Map();
        this.remoteStreams = new Map();
        this.pendingOffers = new Map();
        this.pendingAnswers = new Map();
        
        // Data channel settings
        this.dataChannelConfig = {
            ordered: true,
            maxRetransmits: 3
        };
        
        this.isInitialized = false;
    }

    async init(signalingServerUrl = 'ws://localhost:8080') {
        console.log('🔧 Initializing WebRTC Client...');
        
        try {
            // Generate unique user ID
            this.localUserId = this.generateUserId();
            
            // Connect to signaling server
            await this.connectToSignalingServer(signalingServerUrl);
            
            // Setup media devices
            await this.setupMediaDevices();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('✅ WebRTC Client initialized');
            console.log('👤 Local User ID:', this.localUserId);
            
        } catch (error) {
            console.error('❌ WebRTC Client initialization failed:', error);
            throw error;
        }
    }

    async connectToSignalingServer(url) {
        return new Promise((resolve, reject) => {
            try {
                this.signalingSocket = io(url);
                
                this.signalingSocket.on('connect', () => {
                    console.log('🔗 Connected to signaling server');
                    this.signalingSocket.emit('register', {
                        userId: this.localUserId,
                        capabilities: this.getLocalCapabilities()
                    });
                    resolve();
                });

                this.signalingSocket.on('disconnect', () => {
                    console.log('🔌 Disconnected from signaling server');
                    this.dispatchEvent(new CustomEvent('signalingDisconnected'));
                });

                this.signalingSocket.on('error', (error) => {
                    console.error('❌ Signaling server error:', error);
                    reject(new Error(`Signaling server error: ${error}`));
                });

                // WebRTC signaling events
                this.signalingSocket.on('offer', (data) => this.handleOffer(data));
                this.signalingSocket.on('answer', (data) => this.handleAnswer(data));
                this.signalingSocket.on('ice-candidate', (data) => this.handleIceCandidate(data));
                this.signalingSocket.on('user-joined', (data) => this.handleUserJoined(data));
                this.signalingSocket.on('user-left', (data) => this.handleUserLeft(data));
                this.signalingSocket.on('room-data', (data) => this.handleRoomData(data));

                // Timeout if connection takes too long
                setTimeout(() => {
                    if (!this.signalingSocket.connected) {
                        reject(new Error('Signaling server connection timeout'));
                    }
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });
    }

    async setupMediaDevices() {
        try {
            // Get available media devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            console.log('📹 Available media devices:', devices.length);
            
            // Request user media with fallback options
            this.localStream = await this.getUserMedia();
            
            console.log('🎥 Local media stream acquired');
            
        } catch (error) {
            console.warn('⚠️ Could not access media devices:', error.message);
            // Continue without media - data-only mode
        }
    }

    async getUserMedia(constraints = this.mediaConstraints) {
        try {
            return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
            console.warn('Media request failed, trying fallback...', error.message);
            
            // Try with lower quality settings
            const fallbackConstraints = {
                video: { width: 640, height: 480 },
                audio: true
            };
            
            try {
                return await navigator.mediaDevices.getUserMedia(fallbackConstraints);
            } catch (fallbackError) {
                console.warn('Fallback failed, trying audio only...', fallbackError.message);
                
                // Try audio only
                try {
                    return await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (audioError) {
                    console.warn('Audio only failed, continuing without media...', audioError.message);
                    return null;
                }
            }
        }
    }

    setupEventListeners() {
        // Handle media device changes
        navigator.mediaDevices.addEventListener('devicechange', () => {
            console.log('📱 Media devices changed');
            this.dispatchEvent(new CustomEvent('mediaDevicesChanged'));
        });

        // Handle network changes
        window.addEventListener('online', () => {
            console.log('🌐 Network online');
            this.handleNetworkChange(true);
        });

        window.addEventListener('offline', () => {
            console.log('📴 Network offline');
            this.handleNetworkChange(false);
        });
    }

    // Peer connection management
    async createPeerConnection(remoteUserId) {
        console.log(`🤝 Creating peer connection to ${remoteUserId}`);
        
        try {
            const peerConnection = new RTCPeerConnection(this.rtcConfig);
            
            // Add local stream if available
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, this.localStream);
                });
            }
            
            // Create data channel
            const dataChannel = peerConnection.createDataChannel('data', this.dataChannelConfig);
            this.setupDataChannel(dataChannel, remoteUserId);
            
            // Setup event handlers
            this.setupPeerConnectionEvents(peerConnection, remoteUserId);
            
            // Store connections
            this.peerConnections.set(remoteUserId, peerConnection);
            this.connectionStates.set(remoteUserId, 'connecting');
            
            console.log(`✅ Peer connection created for ${remoteUserId}`);
            return peerConnection;
            
        } catch (error) {
            console.error(`❌ Failed to create peer connection to ${remoteUserId}:`, error);
            throw error;
        }
    }

    setupPeerConnectionEvents(peerConnection, remoteUserId) {
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log(`📺 Remote stream received from ${remoteUserId}`);
            const [remoteStream] = event.streams;
            this.remoteStreams.set(remoteUserId, remoteStream);
            
            this.dispatchEvent(new CustomEvent('remoteStreamAdded', {
                detail: { userId: remoteUserId, stream: remoteStream }
            }));
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.signalingSocket.emit('ice-candidate', {
                    to: remoteUserId,
                    candidate: event.candidate
                });
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            console.log(`🔄 Connection state with ${remoteUserId}: ${state}`);
            
            this.connectionStates.set(remoteUserId, state);
            
            this.dispatchEvent(new CustomEvent('connectionStateChanged', {
                detail: { userId: remoteUserId, state }
            }));
            
            if (state === 'connected') {
                this.onPeerConnected(remoteUserId);
            } else if (state === 'disconnected' || state === 'failed') {
                this.onPeerDisconnected(remoteUserId);
            }
        };

        // Handle data channel from remote peer
        peerConnection.ondatachannel = (event) => {
            console.log(`📡 Data channel received from ${remoteUserId}`);
            this.setupDataChannel(event.channel, remoteUserId);
        };

        // Handle ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
            console.log(`🧊 ICE connection state with ${remoteUserId}: ${peerConnection.iceConnectionState}`);
        };
    }

    setupDataChannel(dataChannel, remoteUserId) {
        this.dataChannels.set(remoteUserId, dataChannel);
        
        dataChannel.onopen = () => {
            console.log(`📡 Data channel opened with ${remoteUserId}`);
            this.dispatchEvent(new CustomEvent('dataChannelOpened', {
                detail: { userId: remoteUserId }
            }));
        };
        
        dataChannel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log(`📥 Data received from ${remoteUserId}:`, data.type);
                
                this.dispatchEvent(new CustomEvent('dataReceived', {
                    detail: { userId: remoteUserId, data }
                }));
            } catch (error) {
                console.error('Failed to parse received data:', error);
            }
        };
        
        dataChannel.onclose = () => {
            console.log(`📡 Data channel closed with ${remoteUserId}`);
            this.dataChannels.delete(remoteUserId);
        };
        
        dataChannel.onerror = (error) => {
            console.error(`❌ Data channel error with ${remoteUserId}:`, error);
        };
    }

    // Signaling handlers
    async handleOffer(data) {
        const { from, offer } = data;
        console.log(`📨 Received offer from ${from}`);
        
        try {
            // Create peer connection if it doesn't exist
            if (!this.peerConnections.has(from)) {
                await this.createPeerConnection(from);
            }
            
            const peerConnection = this.peerConnections.get(from);
            
            // Set remote description
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Create and send answer
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            this.signalingSocket.emit('answer', {
                to: from,
                answer: answer
            });
            
            console.log(`📤 Sent answer to ${from}`);
            
        } catch (error) {
            console.error(`❌ Failed to handle offer from ${from}:`, error);
        }
    }

    async handleAnswer(data) {
        const { from, answer } = data;
        console.log(`📨 Received answer from ${from}`);
        
        try {
            const peerConnection = this.peerConnections.get(from);
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                console.log(`✅ Set remote description for ${from}`);
            }
        } catch (error) {
            console.error(`❌ Failed to handle answer from ${from}:`, error);
        }
    }

    async handleIceCandidate(data) {
        const { from, candidate } = data;
        console.log(`🧊 Received ICE candidate from ${from}`);
        
        try {
            const peerConnection = this.peerConnections.get(from);
            if (peerConnection) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            console.error(`❌ Failed to add ICE candidate from ${from}:`, error);
        }
    }

    handleUserJoined(data) {
        const { userId, userData } = data;
        console.log(`👤 User joined: ${userId}`);
        
        this.dispatchEvent(new CustomEvent('userJoined', {
            detail: { userId, userData }
        }));
    }

    handleUserLeft(data) {
        const { userId } = data;
        console.log(`👋 User left: ${userId}`);
        
        // Clean up connections
        this.closePeerConnection(userId);
        
        this.dispatchEvent(new CustomEvent('userLeft', {
            detail: { userId }
        }));
    }

    handleRoomData(data) {
        console.log('🏠 Room data received:', data);
        this.currentRoom = data;
        
        this.dispatchEvent(new CustomEvent('roomDataReceived', {
            detail: data
        }));
    }

    // Public API methods
    async joinRoom(roomId, userData = {}) {
        console.log(`🚪 Joining room: ${roomId}`);
        
        this.signalingSocket.emit('join-room', {
            roomId,
            userData: {
                userId: this.localUserId,
                name: userData.name || 'Anonymous',
                avatarColor: userData.avatarColor || this.generateRandomColor(),
                capabilities: this.getLocalCapabilities(),
                ...userData
            }
        });
    }

    async leaveRoom() {
        if (this.currentRoom) {
            console.log(`🚪 Leaving room: ${this.currentRoom.roomId}`);
            
            // Close all peer connections
            this.peerConnections.forEach((_, userId) => {
                this.closePeerConnection(userId);
            });
            
            this.signalingSocket.emit('leave-room', {
                roomId: this.currentRoom.roomId
            });
            
            this.currentRoom = null;
        }
    }

    async initiateCall(remoteUserId) {
        console.log(`📞 Initiating call to ${remoteUserId}`);
        
        try {
            // Create peer connection
            const peerConnection = await this.createPeerConnection(remoteUserId);
            
            // Create offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            // Send offer through signaling
            this.signalingSocket.emit('offer', {
                to: remoteUserId,
                offer: offer
            });
            
            console.log(`📤 Sent offer to ${remoteUserId}`);
            
        } catch (error) {
            console.error(`❌ Failed to initiate call to ${remoteUserId}:`, error);
            throw error;
        }
    }

    // Data channel communication
    sendData(userId, data) {
        const dataChannel = this.dataChannels.get(userId);
        if (dataChannel && dataChannel.readyState === 'open') {
            try {
                const message = JSON.stringify(data);
                dataChannel.send(message);
                console.log(`📤 Sent data to ${userId}:`, data.type);
                return true;
            } catch (error) {
                console.error(`❌ Failed to send data to ${userId}:`, error);
                return false;
            }
        } else {
            console.warn(`⚠️ Data channel to ${userId} not available`);
            return false;
        }
    }

    broadcastData(data) {
        let sentCount = 0;
        this.dataChannels.forEach((dataChannel, userId) => {
            if (this.sendData(userId, data)) {
                sentCount++;
            }
        });
        console.log(`📡 Broadcast data to ${sentCount} users:`, data.type);
        return sentCount;
    }

    sendSpatialData(spatialData) {
        const data = {
            type: 'spatial-update',
            timestamp: Date.now(),
            ...spatialData
        };
        return this.broadcastData(data);
    }

    // Media controls
    async toggleMicrophone() {
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                const isEnabled = audioTracks[0].enabled;
                audioTracks.forEach(track => {
                    track.enabled = !isEnabled;
                });
                console.log(`🎤 Microphone ${isEnabled ? 'muted' : 'unmuted'}`);
                return !isEnabled;
            }
        }
        return false;
    }

    async toggleCamera() {
        if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            if (videoTracks.length > 0) {
                const isEnabled = videoTracks[0].enabled;
                videoTracks.forEach(track => {
                    track.enabled = !isEnabled;
                });
                console.log(`📹 Camera ${isEnabled ? 'disabled' : 'enabled'}`);
                return !isEnabled;
            }
        }
        return false;
    }

    async switchCamera() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                const currentFacingMode = videoTrack.getSettings().facingMode;
                const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
                
                try {
                    const newStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: newFacingMode },
                        audio: true
                    });
                    
                    // Replace video track in all peer connections
                    const newVideoTrack = newStream.getVideoTracks()[0];
                    this.peerConnections.forEach((pc) => {
                        const sender = pc.getSenders().find(s => 
                            s.track && s.track.kind === 'video'
                        );
                        if (sender) {
                            sender.replaceTrack(newVideoTrack);
                        }
                    });
                    
                    // Stop old track and update local stream
                    videoTrack.stop();
                    this.localStream.removeTrack(videoTrack);
                    this.localStream.addTrack(newVideoTrack);
                    
                    console.log(`📹 Switched to ${newFacingMode} camera`);
                    return true;
                    
                } catch (error) {
                    console.error('❌ Failed to switch camera:', error);
                    return false;
                }
            }
        }
        return false;
    }

    async startScreenShare() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            
            const videoTrack = screenStream.getVideoTracks()[0];
            
            // Replace video track in all peer connections
            this.peerConnections.forEach((pc) => {
                const sender = pc.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            });
            
            // Handle screen share end
            videoTrack.onended = () => {
                this.stopScreenShare();
            };
            
            console.log('📺 Screen sharing started');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to start screen share:', error);
            return false;
        }
    }

    async stopScreenShare() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                // Replace screen share with camera
                this.peerConnections.forEach((pc) => {
                    const sender = pc.getSenders().find(s => 
                        s.track && s.track.kind === 'video'
                    );
                    if (sender) {
                        sender.replaceTrack(videoTrack);
                    }
                });
                
                console.log('📺 Screen sharing stopped');
                return true;
            }
        }
        return false;
    }

    // Connection management
    closePeerConnection(userId) {
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
        
        this.connectionStates.delete(userId);
        this.remoteStreams.delete(userId);
        
        console.log(`🔌 Closed connection to ${userId}`);
    }

    onPeerConnected(userId) {
        console.log(`✅ Peer connected: ${userId}`);
        
        this.dispatchEvent(new CustomEvent('peerConnected', {
            detail: { userId }
        }));
    }

    onPeerDisconnected(userId) {
        console.log(`❌ Peer disconnected: ${userId}`);
        
        this.dispatchEvent(new CustomEvent('peerDisconnected', {
            detail: { userId }
        }));
    }

    handleNetworkChange(online) {
        if (online) {
            // Attempt to reconnect to signaling server
            if (!this.signalingSocket.connected) {
                console.log('🔄 Reconnecting to signaling server...');
                this.signalingSocket.connect();
            }
        } else {
            // Handle offline mode
            console.log('📴 Entering offline mode');
        }
        
        this.dispatchEvent(new CustomEvent('networkChanged', {
            detail: { online }
        }));
    }

    // Utility methods
    generateUserId() {
        return 'user_' + Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }

    generateRandomColor() {
        const colors = [
            0x4ecdc4, 0x44a08d, 0x093637, 0xc94b4b, 0x4b134f,
            0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    getLocalCapabilities() {
        return {
            video: this.localStream ? this.localStream.getVideoTracks().length > 0 : false,
            audio: this.localStream ? this.localStream.getAudioTracks().length > 0 : false,
            screenShare: 'getDisplayMedia' in navigator.mediaDevices,
            dataChannel: true,
            spatialAudio: true
        };
    }

    // Status methods
    getConnectionState(userId) {
        return this.connectionStates.get(userId) || 'disconnected';
    }

    getConnectedUsers() {
        return Array.from(this.peerConnections.keys());
    }

    getRemoteStream(userId) {
        return this.remoteStreams.get(userId);
    }

    isConnectedToUser(userId) {
        return this.connectionStates.get(userId) === 'connected';
    }

    getLocalStream() {
        return this.localStream;
    }

    // Statistics
    async getConnectionStats(userId) {
        const peerConnection = this.peerConnections.get(userId);
        if (peerConnection) {
            const stats = await peerConnection.getStats();
            return this.processStats(stats);
        }
        return null;
    }

    processStats(stats) {
        const processed = {
            video: { bytesReceived: 0, bytesSent: 0, packetsLost: 0 },
            audio: { bytesReceived: 0, bytesSent: 0, packetsLost: 0 },
            connection: { rtt: 0, availableOutgoingBitrate: 0 }
        };

        stats.forEach(report => {
            if (report.type === 'inbound-rtp') {
                if (report.kind === 'video') {
                    processed.video.bytesReceived = report.bytesReceived || 0;
                    processed.video.packetsLost = report.packetsLost || 0;
                } else if (report.kind === 'audio') {
                    processed.audio.bytesReceived = report.bytesReceived || 0;
                    processed.audio.packetsLost = report.packetsLost || 0;
                }
            } else if (report.type === 'outbound-rtp') {
                if (report.kind === 'video') {
                    processed.video.bytesSent = report.bytesSent || 0;
                } else if (report.kind === 'audio') {
                    processed.audio.bytesSent = report.bytesSent || 0;
                }
            } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                processed.connection.rtt = report.currentRoundTripTime || 0;
                processed.connection.availableOutgoingBitrate = report.availableOutgoingBitrate || 0;
            }
        });

        return processed;
    }

    // Cleanup
    async destroy() {
        console.log('🧹 Cleaning up WebRTC Client...');
        
        // Leave current room
        await this.leaveRoom();
        
        // Close all peer connections
        this.peerConnections.forEach((_, userId) => {
            this.closePeerConnection(userId);
        });
        
        // Stop local media
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Disconnect from signaling server
        if (this.signalingSocket) {
            this.signalingSocket.disconnect();
            this.signalingSocket = null;
        }
        
        // Clear all data structures
        this.peerConnections.clear();
        this.dataChannels.clear();
        this.connectionStates.clear();
        this.remoteStreams.clear();
        this.pendingOffers.clear();
        this.pendingAnswers.clear();
        
        console.log('✅ WebRTC Client cleaned up');
    }
}
