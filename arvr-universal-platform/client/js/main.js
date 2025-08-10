// main.js - Universal AR/VR Platform Entry Point (Working Version)

import { ARPlatform } from './platform-init.js';
import { AREngine } from './ar-engine.js';

class UniversalARVRPlatform {
    constructor() {
        this.isInitialized = false;
        this.currentSession = null;
        this.connectedDevices = new Map();
        this.activeRoom = null;
        this.remoteUsers = new Map();
        
        // Core modules
        this.platform = new ARPlatform();
        this.arEngine = new AREngine();
        
        // Placeholders for future modules
        this.deviceConnector = null;
        this.webrtcClient = null;
        this.spatialAudio = null;
        this.uiManager = null;

        // WebSocket connection for signaling (placeholder)
        this.socket = null;
        this.serverUrl = 'ws://localhost:8080';

        // Event handlers
        this.eventHandlers = new Map();
    }

    async init() {
        console.log('🚀 Initializing Universal AR/VR Platform...');
        
        try {
            // 1. Initialize platform first
            const platformSuccess = await this.platform.initialize({
                debugMode: true,
                enablePolyfill: true,
                autoSetupUI: true
            });
            
            if (!platformSuccess) {
                throw new Error('Platform initialization failed');
            }

            this.platform.updateLoadingProgress(30, 'Loading AR/VR engine...');
            
            // 2. Initialize AR/VR engine
            await this.arEngine.init();
            
            this.platform.updateLoadingProgress(50, 'Setting up device discovery...');
            
            // 3. Initialize placeholder modules
            this.initPlaceholderModules();
            
            this.platform.updateLoadingProgress(70, 'Setting up communication...');
            
            // 4. Setup event listeners
            this.setupEventListeners();
            
            this.platform.updateLoadingProgress(90, 'Finalizing setup...');
            
            // 5. Setup cross-module integration
            this.setupCrossModuleIntegration();
            
            this.platform.updateLoadingProgress(100, 'Platform ready!');
            
            setTimeout(() => {
                this.platform.hideLoading();
                this.isInitialized = true;
                console.log('✅ Platform initialized successfully');
            }, 500);
            
        } catch (error) {
            console.error('❌ Platform initialization failed:', error);
            this.platform.showError('Platform initialization failed: ' + error.message);
        }
    }

    initPlaceholderModules() {
        // Initialize placeholder modules
        this.deviceConnector = {
            scanAllDevices: async () => {
                console.log('🔍 Device scanning (placeholder)');
                // Simulate device discovery
                const mockDevices = [
                    { id: 'tv-001', name: 'Living Room TV', type: 'tv', status: 'available' },
                    { id: 'speaker-001', name: 'Kitchen Speaker', type: 'speaker', status: 'available' },
                    { id: 'phone-001', name: 'John\'s iPhone', type: 'smartphone', status: 'available' }
                ];
                
                setTimeout(() => {
                    mockDevices.forEach(device => this.onDeviceFound(device));
                }, 1000);
                
                return mockDevices;
            },
            on: (event, callback) => {
                if (!this.eventHandlers.has(event)) {
                    this.eventHandlers.set(event, []);
                }
                this.eventHandlers.get(event).push(callback);
            },
            emit: (event, data) => {
                if (this.eventHandlers.has(event)) {
                    this.eventHandlers.get(event).forEach(callback => callback(data));
                }
            }
        };

        this.webrtcClient = {
            broadcastData: (data) => {
                console.log('📡 Broadcasting data (placeholder):', data);
            },
            createPeerConnection: (userId) => {
                console.log('🔗 Creating peer connection (placeholder):', userId);
            },
            closePeerConnection: (userId) => {
                console.log('🔌 Closing peer connection (placeholder):', userId);
            },
            on: (event, callback) => {
                if (!this.eventHandlers.has(event)) {
                    this.eventHandlers.set(event, []);
                }
                this.eventHandlers.get(event).push(callback);
            }
        };

        this.spatialAudio = {
            mute: () => console.log('🔇 Audio muted'),
            unmute: () => console.log('🎤 Audio unmuted'),
            updateUserPosition: (userId, position) => console.log('📍 Audio position updated:', userId)
        };

        this.uiManager = {
            showNotification: (message, type) => {
                console.log(`📢 ${type.toUpperCase()}: ${message}`);
                this.platform.showError(message); // Use platform's error display
            },
            addDeviceToList: (device) => {
                console.log('📱 Device added to UI:', device);
                this.updateDeviceList();
            },
            updateDeviceStatus: (deviceId, status) => {
                console.log('🔄 Device status updated:', deviceId, status);
            }
        };
    }

    setupEventListeners() {
        console.log('🎧 Setting up event listeners...');
        
        // AR/VR Controls - these should exist from platform-init.js
        const arBtn = document.getElementById('ar-btn');
        const vrBtn = document.getElementById('vr-btn');
        const shareBtn = document.getElementById('share-space-btn');
        
        if (arBtn) arBtn.addEventListener('click', () => this.startAR());
        if (vrBtn) vrBtn.addEventListener('click', () => this.startVR());
        if (shareBtn) shareBtn.addEventListener('click', () => this.shareSpace());

        // Add device scanning button if it doesn't exist
        this.addDeviceScanButton();
        
        // Add room controls if they don't exist
        this.addRoomControls();
        
        // Listen for AR engine events
        this.arEngine.addEventListener('sessionStarted', (event) => {
            this.onSessionStarted(event.detail);
        });
    }

    addDeviceScanButton() {
        const controls = document.getElementById('ar-controls');
        if (controls && !document.getElementById('scan-devices-btn')) {
            const scanBtn = document.createElement('button');
            scanBtn.id = 'scan-devices-btn';
            scanBtn.textContent = '🔍 Scan Devices';
            scanBtn.style.cssText = `
                background: #f59e0b;
                color: white;
                border: none;
                border-radius: 12px;
                padding: 12px 20px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
                min-width: 120px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin-left: 12px;
            `;
            
            scanBtn.addEventListener('click', () => this.scanDevices());
            controls.appendChild(scanBtn);
        }
    }

    addRoomControls() {
        const spatialUI = document.getElementById('spatial-ui');
        if (spatialUI && !document.getElementById('room-controls')) {
            const roomControls = document.createElement('div');
            roomControls.id = 'room-controls';
            roomControls.innerHTML = `
                <h3 style="margin: 0 0 12px 0; font-size: 16px;">🏠 Room Controls</h3>
                <div style="margin-bottom: 12px;">
                    <button id="create-room-btn" style="width: 100%; padding: 8px; margin-bottom: 8px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        Create Room
                    </button>
                    <button id="join-room-btn" style="width: 100%; padding: 8px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        Join Room
                    </button>
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; opacity: 0.8;">Room ID:</label>
                    <input id="room-id" type="text" placeholder="Enter room ID" style="width: 100%; padding: 6px; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; background: rgba(255,255,255,0.1); color: white; font-size: 12px;">
                </div>
                <div id="device-list-container" style="margin-top: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">📱 Devices (<span id="device-count">0</span>)</h4>
                    <div id="device-list" style="font-size: 12px; opacity: 0.8;">
                        No devices connected
                    </div>
                </div>
                <div id="user-list-container" style="margin-top: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">👥 Users (<span id="user-count">1</span>)</h4>
                    <div id="user-list" style="font-size: 12px; opacity: 0.8;">
                        You
                    </div>
                </div>
            `;
            
            spatialUI.appendChild(roomControls);
            
            // Setup room control handlers
            document.getElementById('create-room-btn').addEventListener('click', () => this.createRoom());
            document.getElementById('join-room-btn').addEventListener('click', () => this.joinRoom());
        }
    }

    setupCrossModuleIntegration() {
        console.log('🔗 Setting up cross-module integration...');
        // This will be expanded when actual modules are implemented
    }

    // AR/VR Functions
    async startAR() {
        try {
            console.log('🔍 Starting AR session...');
            const arBtn = document.getElementById('ar-btn');
            arBtn.textContent = '📱 Starting...';
            
            this.currentSession = await this.arEngine.startARSession();
            arBtn.textContent = '🔄 Stop AR';
            
            const shareBtn = document.getElementById('share-space-btn');
            if (shareBtn) {
                shareBtn.classList.remove('disabled');
                shareBtn.style.background = '#10b981';
            }
            
            this.uiManager.showNotification('AR session started', 'success');
        } catch (error) {
            console.error('AR start failed:', error);
            document.getElementById('ar-btn').textContent = '📱 Start AR';
            this.uiManager.showNotification('Failed to start AR: ' + error.message, 'error');
        }
    }

    async startVR() {
        try {
            console.log('🥽 Starting VR session...');
            const vrBtn = document.getElementById('vr-btn');
            vrBtn.textContent = '🥽 Starting...';
            
            this.currentSession = await this.arEngine.startVRSession();
            vrBtn.textContent = '🔄 Stop VR';
            
            const shareBtn = document.getElementById('share-space-btn');
            if (shareBtn) {
                shareBtn.classList.remove('disabled');
                shareBtn.style.background = '#10b981';
            }
            
            this.uiManager.showNotification('VR session started', 'success');
        } catch (error) {
            console.error('VR start failed:', error);
            document.getElementById('vr-btn').textContent = '🥽 Start VR';
            this.uiManager.showNotification('Failed to start VR: ' + error.message, 'error');
        }
    }

    async shareSpace() {
        if (!this.currentSession) {
            this.uiManager.showNotification('Start AR/VR session first', 'error');
            return;
        }

        try {
            const sessionInfo = this.arEngine.getSessionInfo();
            const deviceList = Array.from(this.connectedDevices.values());
            
            const sharePackage = {
                type: 'space-share',
                sessionInfo: sessionInfo,
                devices: deviceList,
                timestamp: Date.now()
            };

            console.log('🤝 Sharing space:', sharePackage);
            this.webrtcClient.broadcastData(sharePackage);
            this.uiManager.showNotification('Space shared with room participants', 'success');
        } catch (error) {
            console.error('Space sharing failed:', error);
            this.uiManager.showNotification('Failed to share space', 'error');
        }
    }

    onSessionStarted(sessionInfo) {
        console.log('📱 Session started:', sessionInfo);
        
        // Add some demo objects
        this.addDemoObjects();
    }

    addDemoObjects() {
        // Add a demo cube
        this.arEngine.addVirtualObject('demo-cube', {
            type: 'cube',
            position: { x: 0, y: 1, z: -2 },
            color: 0x6366f1,
            size: 0.3,
            animation: { type: 'float', offset: 0 }
        });
        
        // Add welcome text
        this.arEngine.addVirtualObject('welcome-text', {
            type: 'text',
            text: 'Universal AR/VR Platform',
            position: { x: 0, y: 1.5, z: -2 },
            fontSize: 20,
            textColor: 'white',
            backgroundColor: 'rgba(99, 102, 241, 0.8)'
        });
    }

    // Device Functions
    async scanDevices() {
        try {
            console.log('🔍 Scanning for devices...');
            const scanBtn = document.getElementById('scan-devices-btn');
            scanBtn.textContent = '🔄 Scanning...';
            
            const devices = await this.deviceConnector.scanAllDevices();
            
            scanBtn.textContent = '🔍 Scan Devices';
            this.uiManager.showNotification(`Found ${devices.length} devices`, 'success');
        } catch (error) {
            console.error('Device scan failed:', error);
            document.getElementById('scan-devices-btn').textContent = '🔍 Scan Devices';
            this.uiManager.showNotification('Device scan failed', 'error');
        }
    }

    onDeviceFound(device) {
        console.log('📱 Device found:', device);
        this.connectedDevices.set(device.id, device);
        this.updateDeviceList();
        this.updateDeviceCount();
        
        // Add device visualization to AR scene if session is active
        if (this.currentSession) {
            this.arEngine.addDeviceVisualization({
                id: device.id,
                name: device.name,
                type: device.type,
                position: { 
                    x: (Math.random() - 0.5) * 4, 
                    y: 1, 
                    z: -2 + (Math.random() - 0.5) * 2 
                }
            });
        }
    }

    updateDeviceList() {
        const deviceList = document.getElementById('device-list');
        if (deviceList) {
            if (this.connectedDevices.size === 0) {
                deviceList.innerHTML = 'No devices connected';
                return;
            }
            
            deviceList.innerHTML = '';
            this.connectedDevices.forEach(device => {
                const deviceEl = document.createElement('div');
                deviceEl.style.cssText = 'margin-bottom: 6px; padding: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer;';
                deviceEl.innerHTML = `
                    <div style="font-weight: 600;">${this.getDeviceIcon(device.type)} ${device.name}</div>
                    <div style="font-size: 10px; opacity: 0.7;">${device.type} • ${device.status}</div>
                `;
                deviceList.appendChild(deviceEl);
            });
        }
    }

    updateDeviceCount() {
        const count = this.connectedDevices.size;
        const countEl = document.getElementById('device-count');
        if (countEl) {
            countEl.textContent = count;
        }
    }

    getDeviceIcon(type) {
        const icons = {
            tv: '📺',
            speaker: '🔊',
            smartphone: '📱',
            laptop: '💻',
            tablet: '📟',
            default: '📱'
        };
        return icons[type] || icons.default;
    }

    // Room Functions
    createRoom() {
        const roomId = this.generateRoomId();
        document.getElementById('room-id').value = roomId;
        
        this.activeRoom = { roomId: roomId };
        console.log('🏠 Room created:', roomId);
        this.uiManager.showNotification(`Room created: ${roomId}`, 'success');
    }

    joinRoom() {
        const roomId = document.getElementById('room-id').value.trim();
        if (!roomId) {
            this.uiManager.showNotification('Please enter a room ID', 'error');
            return;
        }

        this.activeRoom = { roomId: roomId };
        console.log('🚪 Joining room:', roomId);
        this.uiManager.showNotification(`Joined room: ${roomId}`, 'success');
        
        // Simulate user joining
        setTimeout(() => {
            this.simulateUserJoining();
        }, 2000);
    }

    simulateUserJoining() {
        const userId = 'user-' + Math.random().toString(36).substr(2, 4);
        const userData = {
            id: userId,
            name: 'Remote User',
            avatarColor: 0xff6b6b
        };
        
        this.remoteUsers.set(userId, userData);
        this.updateUserCount();
        
        // Add avatar to AR scene
        if (this.currentSession) {
            this.arEngine.addUserAvatar(userId, userData);
        }
        
        this.uiManager.showNotification(`${userData.name} joined the room`, 'success');
    }

    updateUserCount() {
        const count = this.remoteUsers.size + 1; // +1 for local user
        const countEl = document.getElementById('user-count');
        if (countEl) {
            countEl.textContent = count;
        }
    }

    // Utility Functions
    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Status and debugging
    getStatus() {
        return {
            initialized: this.isInitialized,
            platform: this.platform?.getStatus(),
            engine: this.arEngine?.getSessionInfo(),
            devices: this.connectedDevices.size,
            users: this.remoteUsers.size,
            room: this.activeRoom?.roomId
        };
    }

    // Cleanup
    destroy() {
        console.log('🧹 Destroying Universal AR/VR Platform...');
        
        if (this.currentSession) {
            this.arEngine.endSession();
        }
        
        if (this.arEngine) {
            this.arEngine.dispose();
        }
        
        if (this.platform) {
            this.platform.dispose();
        }
        
        this.connectedDevices.clear();
        this.remoteUsers.clear();
    }
}

// Initialize the platform when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

async function initializeApp() {
    try {
        const platform = new UniversalARVRPlatform();
        await platform.init();
        
        // Make globally available for debugging
        window.universalPlatform = platform;
        
        // Check for room parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        if (roomId) {
            setTimeout(() => {
                document.getElementById('room-id').value = roomId;
                platform.joinRoom();
            }, 2000);
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize platform:', error);
    }
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.universalPlatform) {
        window.universalPlatform.destroy();
    }
});
