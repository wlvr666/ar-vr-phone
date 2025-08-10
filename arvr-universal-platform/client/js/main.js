// main.js - Universal AR/VR Platform Entry Point

import { AREngine } from './ar-engine.js';
import { DeviceConnector } from './device-connector.js';
import { WebRTCClient } from './webrtc-client.js';
import { SpatialAudio } from './spatial-audio.js';
import { UIManager } from './ui-manager.js';

class UniversalARVRPlatform {
    constructor() {
        this.isInitialized = false;
        this.currentSession = null;
        this.connectedDevices = new Map();
        this.activeRoom = null;
        this.remoteUsers = new Map();
        
        // Core modules
        this.arEngine = new AREngine();
        this.deviceConnector = new DeviceConnector();
        this.webrtcClient = new WebRTCClient();
        this.spatialAudio = new SpatialAudio();
        this.uiManager = new UIManager();

        // WebSocket connection for signaling
        this.socket = null;
        this.serverUrl = 'ws://localhost:8080';

        // Event handlers
        this.eventHandlers = new Map();
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Universal AR/VR Platform...');
        
        try {
            await this.updateLoadingProgress(10, 'Setting up core systems...');
            
            // Initialize UI Manager first
            await this.uiManager.init();
            this.setupEventListeners();
            
            await this.updateLoadingProgress(25, 'Initializing AR/VR engine...');
            await this.arEngine.init();
            
            await this.updateLoadingProgress(40, 'Setting up device discovery...');
            await this.deviceConnector.init();
            
            await this.updateLoadingProgress(60, 'Configuring spatial audio...');
            await this.spatialAudio.init();
            
            await this.updateLoadingProgress(75, 'Establishing server connection...');
            await this.connectToServer();
            
            await this.updateLoadingProgress(90, 'Finalizing setup...');
            await this.setupCrossModuleIntegration();
            
            await this.updateLoadingProgress(100, 'Platform ready!');
            
            setTimeout(() => {
                this.showMainUI();
                this.isInitialized = true;
                console.log('✅ Platform initialized successfully');
            }, 500);
            
        } catch (error) {
            console.error('❌ Platform initialization failed:', error);
            this.uiManager.showNotification('Platform initialization failed', 'error');
        }
    }

    async updateLoadingProgress(percent, status) {
        const progressBar = document.getElementById('progress-bar');
        const statusElement = document.getElementById('loading-status');
        
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        
        if (statusElement) {
            statusElement.textContent = status;
        }
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    showMainUI() {
        document.getElementById('loading-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('main-ui').classList.remove('hidden');
        }, 500);
    }

    setupEventListeners() {
        // AR/VR Controls
        document.getElementById('ar-btn').addEventListener('click', () => this.startAR());
        document.getElementById('vr-btn').addEventListener('click', () => this.startVR());
        document.getElementById('share-space-btn').addEventListener('click', () => this.shareSpace());

        // Device Controls
        document.getElementById('scan-devices-btn').addEventListener('click', () => this.scanDevices());

        // Communication Controls
        document.getElementById('create-room-btn').addEventListener('click', () => this.createRoom());
        document.getElementById('join-room-btn').addEventListener('click', () => this.joinRoom());

        // Media Controls
        document.getElementById('mic-btn').addEventListener('click', () => this.toggleMicrophone());
        document.getElementById('video-btn').addEventListener('click', () => this.toggleCamera());
        document.getElementById('screen-share-btn').addEventListener('click', () => this.shareScreen());
        document.getElementById('end-call-btn').addEventListener('click', () => this.endCall());

        // Settings
        document.getElementById('settings-btn').addEventListener('click', () => this.showSettings());
        document.getElementById('close-settings').addEventListener('click', () => this.hideSettings());

        // Listen for device connection events
        this.deviceConnector.on('deviceFound', (device) => this.onDeviceFound(device));
        this.deviceConnector.on('deviceConnected', (device) => this.onDeviceConnected(device));
        this.deviceConnector.on('deviceDisconnected', (device) => this.onDeviceDisconnected(device));

        // Listen for WebRTC events
        this.webrtcClient.on('userJoined', (userId, userData) => this.onUserJoined(userId, userData));
        this.webrtcClient.on('userLeft', (userId) => this.onUserLeft(userId));
        this.webrtcClient.on('dataReceived', (userId, data) => this.onDataReceived(userId, data));
    }

    async connectToServer() {
        return new Promise((resolve, reject) => {
            try {
                this.socket = io(this.serverUrl);
                
                this.socket.on('connect', () => {
                    console.log('🔗 Connected to signaling server');
                    this.updateConnectionStatus(true);
                    resolve();
                });

                this.socket.on('disconnect', () => {
                    console.log('🔌 Disconnected from server');
                    this.updateConnectionStatus(false);
                });

                this.socket.on('room-created', (roomData) => {
                    this.onRoomCreated(roomData);
                });

                this.socket.on('room-joined', (roomData) => {
                    this.onRoomJoined(roomData);
                });

                this.socket.on('user-joined-room', (userData) => {
                    this.onUserJoinedRoom(userData);
                });

                this.socket.on('user-left-room', (userId) => {
                    this.onUserLeftRoom(userId);
                });

                // Timeout if connection takes too long
                setTimeout(() => {
                    if (!this.socket.connected) {
                        reject(new Error('Server connection timeout'));
                    }
                }, 5000);

            } catch (error) {
                reject(error);
            }
        });
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        if (connected) {
            statusElement.classList.remove('offline');
            statusElement.classList.add('online');
            statusElement.textContent = '● Online';
        } else {
            statusElement.classList.remove('online');
            statusElement.classList.add('offline');
            statusElement.textContent = '● Offline';
        }
    }

    async setupCrossModuleIntegration() {
        // Connect AR engine with spatial audio
        this.arEngine.on('userPositionChanged', (userId, position, rotation) => {
            this.spatialAudio.updateUserPosition(userId, position, rotation);
        });

        // Connect device events with AR visualization
        this.deviceConnector.on('deviceConnected', (device) => {
            this.arEngine.addDeviceVisualization(device);
        });

        // Connect WebRTC with AR avatars
        this.webrtcClient.on('userJoined', (userId, userData) => {
            this.arEngine.addUserAvatar(userId, userData);
        });

        // Connect spatial audio with WebRTC
        this.spatialAudio.on('spatialDataUpdated', (audioData) => {
            this.webrtcClient.sendSpatialData(audioData);
        });
    }

    // AR/VR Functions
    async startAR() {
        try {
            console.log('🔍 Starting AR session...');
            this.currentSession = await this.arEngine.startARSession();
            document.getElementById('ar-btn').textContent = '🔄 Stop AR';
            document.getElementById('share-space-btn').classList.remove('disabled');
            this.uiManager.showNotification('AR session started', 'success');
        } catch (error) {
            console.error('AR start failed:', error);
            this.uiManager.showNotification('Failed to start AR: ' + error.message, 'error');
        }
    }

    async startVR() {
        try {
            console.log('🥽 Starting VR session...');
            this.currentSession = await this.arEngine.startVRSession();
            document.getElementById('vr-btn').textContent = '🔄 Stop VR';
            document.getElementById('share-space-btn').classList.remove('disabled');
            this.uiManager.showNotification('VR session started', 'success');
        } catch (error) {
            console.error('VR start failed:', error);
            this.uiManager.showNotification('Failed to start VR: ' + error.message, 'error');
        }
    }

    async shareSpace() {
        if (!this.currentSession) {
            this.uiManager.showNotification('Start AR/VR session first', 'error');
            return;
        }

        try {
            const spaceData = await this.arEngine.captureSpaceData();
            const deviceList = Array.from(this.connectedDevices.values());
            
            const sharePackage = {
                type: 'space-share',
                spaceData: spaceData,
                devices: deviceList,
                timestamp: Date.now()
            };

            this.webrtcClient.broadcastData(sharePackage);
            this.uiManager.showNotification('Space shared with room participants', 'success');
        } catch (error) {
            console.error('Space sharing failed:', error);
            this.uiManager.showNotification('Failed to share space', 'error');
        }
    }

    // Device Functions
    async scanDevices() {
        try {
            console.log('🔍 Scanning for devices...');
            document.getElementById('scan-devices-btn').textContent = '🔄 Scanning...';
            
            const devices = await this.deviceConnector.scanAllDevices();
            
            document.getElementById('scan-devices-btn').textContent = '🔍 Scan for Devices';
            this.uiManager.showNotification(`Found ${devices.length} devices`, 'success');
        } catch (error) {
            console.error('Device scan failed:', error);
            document.getElementById('scan-devices-btn').textContent = '🔍 Scan for Devices';
            this.uiManager.showNotification('Device scan failed', 'error');
        }
    }

    onDeviceFound(device) {
        console.log('📱 Device found:', device);
        this.uiManager.addDeviceToList(device);
    }

    onDeviceConnected(device) {
        console.log('🔗 Device connected:', device);
        this.connectedDevices.set(device.id, device);
        this.uiManager.updateDeviceStatus(device.id, 'connected');
        this.updateDeviceCount();
        this.uiManager.showNotification(`Connected to ${device.name}`, 'success');
    }

    onDeviceDisconnected(device) {
        console.log('🔌 Device disconnected:', device);
        this.connectedDevices.delete(device.id);
        this.uiManager.updateDeviceStatus(device.id, 'disconnected');
        this.updateDeviceCount();
        this.uiManager.showNotification(`Disconnected from ${device.name}`, 'error');
    }

    updateDeviceCount() {
        const count = this.connectedDevices.size;
        document.getElementById('device-count').textContent = `${count} device${count !== 1 ? 's' : ''}`;
    }

    // Room Functions
    async createRoom() {
        const roomId = this.generateRoomId();
        document.getElementById('room-id').value = roomId;
        
        try {
            this.socket.emit('create-room', {
                roomId: roomId,
                devices: Array.from(this.connectedDevices.values()),
                arSession: !!this.currentSession
            });
        } catch (error) {
            console.error('Room creation failed:', error);
            this.uiManager.showNotification('Failed to create room', 'error');
        }
    }

    async joinRoom() {
        const roomId = document.getElementById('room-id').value.trim();
        if (!roomId) {
            this.uiManager.showNotification('Please enter a room ID', 'error');
            return;
        }

        try {
            this.socket.emit('join-room', {
                roomId: roomId,
                devices: Array.from(this.connectedDevices.values()),
                arSession: !!this.currentSession
            });
        } catch (error) {
            console.error('Room join failed:', error);
            this.uiManager.showNotification('Failed to join room', 'error');
        }
    }

    onRoomCreated(roomData) {
        console.log('🏠 Room created:', roomData);
        this.activeRoom = roomData;
        this.uiManager.showNotification(`Room created: ${roomData.roomId}`, 'success');
        this.showCallControls(true);
    }

    onRoomJoined(roomData) {
        console.log('🚪 Room joined:', roomData);
        this.activeRoom = roomData;
        this.uiManager.showNotification(`Joined room: ${roomData.roomId}`, 'success');
        this.showCallControls(true);
        
        // Initialize WebRTC for existing users
        roomData.users.forEach(user => {
            if (user.id !== this.socket.id) {
                this.webrtcClient.createPeerConnection(user.id);
            }
        });
    }

    onUserJoinedRoom(userData) {
        console.log('👤 User joined room:', userData);
        this.remoteUsers.set(userData.id, userData);
        this.updateUserCount();
        this.uiManager.showNotification(`${userData.name || 'User'} joined the room`, 'success');
        
        // Create WebRTC connection
        this.webrtcClient.createPeerConnection(userData.id);
    }

    onUserLeftRoom(userId) {
        console.log('👋 User left room:', userId);
        this.remoteUsers.delete(userId);
        this.updateUserCount();
        this.webrtcClient.closePeerConnection(userId);
        this.arEngine.removeUserAvatar(userId);
    }

    updateUserCount() {
        const count = this.remoteUsers.size + 1; // +1 for local user
        document.getElementById('user-count').textContent = `${count} user${count !== 1 ? 's' : ''}`;
    }

    showCallControls(show) {
        const endCallBtn = document.getElementById('end-call-btn');
        if (show) {
            endCallBtn.classList.remove('hidden');
        } else {
            endCallBtn.classList.add('hidden');
        }
    }

    // Media Controls
    toggleMicrophone() {
        const micBtn = document.getElementById('mic-btn');
        const isMuted = micBtn.classList.contains('muted');
        
        if (isMuted) {
            this.spatialAudio.unmute();
            micBtn.classList.remove('muted');
            micBtn.innerHTML = '🎤 <span>Mute</span>';
        } else {
            this.spatialAudio.mute();
            micBtn.classList.add('muted');
            micBtn.innerHTML = '🔇 <span>Unmute</span>';
        }
    }

    toggleCamera() {
        const videoBtn = document.getElementById('video-btn');
        const isOff = videoBtn.classList.contains('off');
        
        if (isOff) {
            this.arEngine.enableCamera();
            videoBtn.classList.remove('off');
            videoBtn.innerHTML = '📹 <span>Camera</span>';
        } else {
            this.arEngine.disableCamera();
            videoBtn.classList.add('off');
            videoBtn.innerHTML = '📷 <span>Camera Off</span>';
        }
    }

    shareScreen() {
        // Implement screen sharing
        this.uiManager.showNotification('Screen sharing not yet implemented', 'error');
    }

    endCall() {
        if (this.activeRoom) {
            this.socket.emit('leave-room', this.activeRoom.roomId);
            this.activeRoom = null;
            this.remoteUsers.clear();
            this.updateUserCount();
            this.showCallControls(false);
            this.uiManager.showNotification('Left the room', 'success');
        }
    }

    // Settings
    showSettings() {
        document.getElementById('settings-modal').classList.remove('hidden');
    }

    hideSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
    }

    // Utility Functions
    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    onDataReceived(userId, data) {
        console.log('📥 Data received from', userId, data);
        
        if (data.type === 'space-share') {
            this.arEngine.loadSharedSpace(data.spaceData);
            this.uiManager.showNotification('Received shared space data', 'success');
        }
    }

    // Cleanup
    destroy() {
        if (this.socket) {
            this.socket.disconnect();
        }
        
        if (this.currentSession) {
            this.currentSession.end();
        }
        
        this.arEngine.destroy();
        this.deviceConnector.destroy();
        this.webrtcClient.destroy();
        this.spatialAudio.destroy();
    }
}

// Initialize the platform when page loads
window.addEventListener('load', () => {
    window.universalPlatform = new UniversalARVRPlatform();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.universalPlatform) {
        window.universalPlatform.destroy();
    }
});
