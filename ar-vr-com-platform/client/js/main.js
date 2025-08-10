import { AREngine } from './ar-engine.js';
import { DeviceConnector } from './device-connector.js';
import { WebRTCClient } from './webrtc-client.js';
import { SpatialAudio } from './spatial-audio.js';
import { UIManager } from './ui-manager.js';

/**
 * AR/VR Communication Platform
 * Main application entry point
 */
class ARVRComPlatform {
  constructor() {
    console.log('🚀 Initializing AR/VR Communication Platform...');
    
    // Core systems
    this.arEngine = null;
    this.deviceConnector = null;
    this.webrtcClient = null;
    this.spatialAudio = null;
    this.uiManager = null;
    
    // Connection state
    this.socket = null;
    this.isConnected = false;
    this.currentRoom = null;
    this.currentUser = null;
    
    // Application state
    this.isInitialized = false;
    this.connectedDevices = new Map();
    this.roomUsers = new Map();
    this.sharedObjects = new Map();
    
    // Performance monitoring
    this.performanceStats = {
      fps: 0,
      frameCount: 0,
      lastTime: 0,
      avgLatency: 0
    };
    
    // Event handlers
    this.eventHandlers = new Map();
    
    this.init();
  }

  async init() {
    try {
      console.log('📊 Starting initialization sequence...');
      this.updateLoadingProgress(10, 'Checking browser capabilities...');
      
      // Check browser capabilities
      await this.checkBrowserSupport();
      this.updateLoadingProgress(20, 'Initializing core systems...');
      
      // Initialize core systems
      await this.initializeCoreSystem();
      this.updateLoadingProgress(40, 'Setting up AR/VR engine...');
      
      // Initialize AR/VR engine
      await this.initializeAREngine();
      this.updateLoadingProgress(60, 'Connecting to communication server...');
      
      // Initialize WebSocket connection
      await this.initializeWebSocket();
      this.updateLoadingProgress(80, 'Setting up device connectivity...');
      
      // Initialize device connector
      await this.initializeDeviceConnector();
      this.updateLoadingProgress(90, 'Finalizing setup...');
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Initialize UI
      this.initializeUI();
      
      this.updateLoadingProgress(100, 'Ready!');
      
      // Hide loading screen and show app
      setTimeout(() => {
        this.hideLoadingScreen();
        this.isInitialized = true;
        console.log('✅ AR/VR Communication Platform initialized successfully');
        this.emit('platform-ready');
      }, 500);
      
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      this.showError('Initialization failed', error.message);
    }
  }

  async checkBrowserSupport() {
    const checks = {
      webgl: !!window.WebGLRenderingContext,
      webrtc: !!(window.RTCPeerConnection || window.webkitRTCPeerConnection),
      websockets: !!window.WebSocket,
      devicemotion: 'DeviceMotionEvent' in window,
      geolocation: 'geolocation' in navigator,
      camera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      webxr: 'xr' in navigator
    };
    
    console.log('Browser Support Check:', checks);
    
    // Check critical features
    if (!checks.webgl) {
      throw new Error('WebGL is required but not supported');
    }
    
    if (!checks.webrtc) {
      throw new Error('WebRTC is required but not supported');
    }
    
    if (!checks.websockets) {
      throw new Error('WebSockets are required but not supported');
    }
    
    // Warn about optional features
    if (!checks.webxr) {
      console.warn('⚠️ WebXR not supported - AR/VR features will be limited');
    }
    
    if (!checks.camera) {
      console.warn('⚠️ Camera access not available - video calling disabled');
    }
    
    return checks;
  }

  async initializeCoreSystem() {
    // Generate user ID
    this.currentUser = {
      id: this.generateUserId(),
      name: this.getUserName(),
      avatar: this.getDefaultAvatar(),
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      isActive: true
    };
    
    // Set global user reference
    window.currentUserId = this.currentUser.id;
    
    console.log('👤 User initialized:', this.currentUser);
  }

  async initializeAREngine() {
    try {
      this.arEngine = new AREngine();
      
      // Setup AR engine event handlers
      this.arEngine.on('xr-support-checked', (support) => {
        console.log('XR Support:', support);
        this.updateXRButtons(support);
      });
      
      this.arEngine.on('session-started', (data) => {
        console.log('XR Session started:', data.mode);
        this.uiManager?.updateXRStatus('active', data.mode);
      });
      
      this.arEngine.on('session-ended', () => {
        console.log('XR Session ended');
        this.uiManager?.updateXRStatus('inactive');
      });
      
      this.arEngine.on('object-interaction', (data) => {
        this.handleObjectInteraction(data);
      });
      
      this.arEngine.on('render', (data) => {
        this.updatePerformanceStats(data.timestamp);
      });
      
      console.log('🥽 AR/VR Engine initialized');
    } catch (error) {
      console.error('AR Engine initialization failed:', error);
      throw error;
    }
  }

  async initializeWebSocket() {
    try {
      const serverUrl = window.location.protocol === 'https:' 
        ? `wss://${window.location.host}`
        : `ws://${window.location.host}`;
      
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true
      });
      
      // Connection events
      this.socket.on('connect', () => {
        console.log('🔌 Connected to server');
        this.isConnected = true;
        this.uiManager?.updateConnectionStatus('server', 'connected');
        this.emit('server-connected');
      });
      
      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from server:', reason);
        this.isConnected = false;
        this.uiManager?.updateConnectionStatus('server', 'disconnected');
        this.emit('server-disconnected', reason);
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.showNotification('Connection failed', 'error');
      });
      
      // Room events
      this.socket.on('room-joined', (data) => {
        this.handleRoomJoined(data);
      });
      
      this.socket.on('room-left', (data) => {
        this.handleRoomLeft(data);
      });
      
      this.socket.on('user-joined', (data) => {
        this.handleUserJoined(data);
      });
      
      this.socket.on('user-left', (data) => {
        this.handleUserLeft(data);
      });
      
      this.socket.on('user-position-update', (data) => {
        this.handleUserPositionUpdate(data);
      });
      
      // Object events
      this.socket.on('object-spawned', (data) => {
        this.handleObjectSpawned(data);
      });
      
      this.socket.on('object-updated', (data) => {
        this.handleObjectUpdated(data);
      });
      
      this.socket.on('object-removed', (data) => {
        this.handleObjectRemoved(data);
      });
      
      // Device events
      this.socket.on('device-discovered', (data) => {
        this.handleDeviceDiscovered(data);
      });
      
      this.socket.on('device-connected', (data) => {
        this.handleDeviceConnected(data);
      });
      
      this.socket.on('device-disconnected', (data) => {
        this.handleDeviceDisconnected(data);
      });
      
      // WebRTC signaling
      this.socket.on('webrtc-offer', (data) => {
        this.webrtcClient?.handleOffer(data);
      });
      
      this.socket.on('webrtc-answer', (data) => {
        this.webrtcClient?.handleAnswer(data);
      });
      
      this.socket.on('webrtc-ice-candidate', (data) => {
        this.webrtcClient?.handleIceCandidate(data);
      });
      
      console.log('🌐 WebSocket client initialized');
    } catch (error) {
      console.error('WebSocket initialization failed:', error);
      throw error;
    }
  }

  async initializeDeviceConnector() {
    try {
      this.deviceConnector = new DeviceConnector();
      
      this.deviceConnector.on('device-found', (device) => {
        console.log('📱 Device found:', device);
        this.uiManager?.addDeviceToList(device);
      });
      
      this.deviceConnector.on('device-connected', (device) => {
        console.log('🔗 Device connected:', device);
        this.connectedDevices.set(device.id, device);
        this.updateDeviceCount();
        this.showNotification(`Connected to ${device.name}`, 'success');
      });
      
      this.deviceConnector.on('device-disconnected', (device) => {
        console.log('🔌 Device disconnected:', device);
        this.connectedDevices.delete(device.id);
        this.updateDeviceCount();
        this.showNotification(`Disconnected from ${device.name}`, 'info');
      });
      
      console.log('📡 Device connector initialized');
    } catch (error) {
      console.error('Device connector initialization failed:', error);
      // Don't throw - device connectivity is optional
      console.warn('⚠️ Device connectivity features disabled');
    }
  }

  initializeUI() {
    this.uiManager = new UIManager(this);
    
    // Setup UI event handlers
    this.uiManager.on('create-room-requested', (roomData) => {
      this.createRoom(roomData);
    });
    
    this.uiManager.on('join-room-requested', (roomId) => {
      this.joinRoom(roomId);
    });
    
    this.uiManager.on('leave-room-requested', () => {
      this.leaveRoom();
    });
    
    this.uiManager.on('start-ar-requested', () => {
      this.startAR();
    });
    
    this.uiManager.on('start-vr-requested', () => {
      this.startVR();
    });
    
    this.uiManager.on('stop-xr-requested', () => {
      this.stopXR();
    });
    
    this.uiManager.on('scan-devices-requested', () => {
      this.scanDevices();
    });
    
    this.uiManager.on('object-spawn-requested', (objectType) => {
      this.spawnObject(objectType);
    });
    
    console.log('🎨 UI Manager initialized');
  }

  setupEventHandlers() {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handlePageHidden();
      } else {
        this.handlePageVisible();
      }
    });
    
    // Handle before unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
    
    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.handleOrientationChange();
      }, 100);
    });
    
    // Handle device motion for AR
    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', (event) => {
        this.handleDeviceMotion(event);
      });
    }
    
    console.log('📋 Event handlers setup complete');
  }

  // Room Management
  async createRoom(roomData) {
    try {
      this.socket.emit('create-room', {
        ...roomData,
        creator: this.currentUser
      });
    } catch (error) {
      console.error('Failed to create room:', error);
      this.showNotification('Failed to create room', 'error');
    }
  }

  async joinRoom(roomId) {
    try {
      this.socket.emit('join-room', {
        roomId,
        user: this.currentUser
      });
    } catch (error) {
      console.error('Failed to join room:', error);
      this.showNotification('Failed to join room', 'error');
    }
  }

  async leaveRoom() {
    if (this.currentRoom) {
      try {
        this.socket.emit('leave-room', {
          roomId: this.currentRoom.id,
          userId: this.currentUser.id
        });
        
        this.currentRoom = null;
        this.roomUsers.clear();
        this.arEngine?.scene.clear();
        
      } catch (error) {
        console.error('Failed to leave room:', error);
      }
    }
  }

  // AR/VR Session Management
  async startAR() {
    try {
      await this.arEngine.startSession('immersive-ar');
      this.showNotification('AR session started', 'success');
    } catch (error) {
      console.error('Failed to start AR session:', error);
      this.showNotification('Failed to start AR session', 'error');
    }
  }

  async startVR() {
    try {
      await this.arEngine.startSession('immersive-vr');
      this.showNotification('VR session started', 'success');
    } catch (error) {
      console.error('Failed to start VR session:', error);
      this.showNotification('Failed to start VR session', 'error');
    }
  }

  async stopXR() {
    try {
      if (this.arEngine.xrSession) {
        await this.arEngine.xrSession.end();
        this.showNotification('XR session ended', 'info');
      }
    } catch (error) {
      console.error('Failed to stop XR session:', error);
    }
  }

  // Device Management
  async scanDevices() {
    try {
      this.showNotification('Scanning for devices...', 'info');
      await this.deviceConnector.scanAll();
    } catch (error) {
      console.error('Device scan failed:', error);
      this.showNotification('Device scan failed', 'error');
    }
  }

  // Object Management
  spawnObject(type) {
    if (!this.currentRoom) {
      this.showNotification('Join a room first', 'warning');
      return;
    }
    
    const objectData = {
      id: this.generateObjectId(),
      type,
      position: [0, 1.5, -2], // In front of user
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      owner: this.currentUser.id,
      timestamp: Date.now()
    };
    
    // Add to local scene
    this.arEngine.spawnObject(objectData);
    
    // Broadcast to room
    this.socket.emit('spawn-object', {
      roomId: this.currentRoom.id,
      object: objectData
    });
  }

  // Event Handlers
  handleRoomJoined(data) {
    console.log('📍 Joined room:', data);
    this.currentRoom = data.room;
    this.uiManager?.updateRoomInfo(data.room.name, data.room.users.length);
    
    // Load existing users and objects
    data.room.users.forEach(user => {
      if (user.id !== this.currentUser.id) {
        this.addUserToRoom(user);
      }
    });
    
    // Setup room in AR engine
    this.arEngine.setupRoom(data.room.id, data.room);
    
    this.showNotification(`Joined room: ${data.room.name}`, 'success');
  }

  handleUserJoined(data) {
    console.log('👋 User joined:', data.user);
    this.addUserToRoom(data.user);
    this.showNotification(`${data.user.name} joined`, 'info');
  }

  handleUserLeft(data) {
    console.log('👋 User left:', data.user);
    this.removeUserFromRoom(data.user.id);
    this.showNotification(`${data.user.name} left`, 'info');
  }

  addUserToRoom(user) {
    this.roomUsers.set(user.id, user);
    this.arEngine.addUserAvatar(user.id, user.position, user.rotation);
    this.uiManager?.updateUserCount(this.roomUsers.size + 1);
  }

  removeUserFromRoom(userId) {
    this.roomUsers.delete(userId);
    this.arEngine.removeObject(`avatar-${userId}`);
    this.uiManager?.updateUserCount(this.roomUsers.size + 1);
  }

  handleUserPositionUpdate(data) {
    const user = this.roomUsers.get(data.userId);
    if (user) {
      user.position = data.position;
      user.rotation = data.rotation;
      this.arEngine.updateUserPosition(data.userId, data.position, data.rotation);
    }
  }

  handleObjectSpawned(data) {
    this.arEngine.spawnObject(data.object);
    this.sharedObjects.set(data.object.id, data.object);
  }

  handleObjectInteraction(data) {
    console.log('🤏 Object interaction:', data);
    
    // Broadcast interaction to room
    if (this.currentRoom) {
      this.socket.emit('interact-object', {
        roomId: this.currentRoom.id,
        ...data
      });
    }
  }

  // Utility Methods
  generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  generateObjectId() {
    return 'obj_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  getUserName() {
    return localStorage.getItem('ar-vr-username') || 'Anonymous User';
  }

  getDefaultAvatar() {
    return {
      color: Math.floor(Math.random() * 16777215).toString(16),
      shape: 'capsule'
    };
  }

  updateLoadingProgress(percentage, message) {
    const progressBar = document.getElementById('loading-progress');
    const progressText = document.getElementById('loading-percentage');
    const loadingText = document.querySelector('.loading-text');
    
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (progressText) progressText.textContent = `${percentage}%`;
    if (loadingText) loadingText.textContent = message;
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const appContainer = document.getElementById('app-container');
    
    if (loadingScreen) {
      loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);
    }
    
    if (appContainer) {
      appContainer.classList.remove('hidden');
    }
  }

  showError(title, message) {
    const errorScreen = document.getElementById('error-screen');
    const errorMessage = document.getElementById('error-message');
    const appContainer = document.getElementById('app-container');
    const loadingScreen = document.getElementById('loading-screen');
    
    if (errorMessage) errorMessage.textContent = message;
    
    if (errorScreen) {
      errorScreen.classList.remove('hidden');
    }
    
    if (appContainer) appContainer.style.display = 'none';
    if (loadingScreen) loadingScreen.style.display = 'none';
    
    // Setup retry button
    const retryButton = document.getElementById('retry-button');
    if (retryButton) {
      retryButton.onclick = () => {
        window.location.reload();
      };
    }
  }

  showNotification(message, type = 'info') {
    this.uiManager?.showNotification(message, type);
  }

  updateDeviceCount() {
    this.uiManager?.updateConnectionStatus('devices', this.connectedDevices.size.toString());
  }

  updatePerformanceStats(timestamp) {
    this.performanceStats.frameCount++;
    
    if (timestamp - this.performanceStats.lastTime >= 1000) {
      this.performanceStats.fps = this.performanceStats.frameCount;
      this.performanceStats.frameCount = 0;
      this.performanceStats.lastTime = timestamp;
      
      // Update debug panel
      const fpsCounter = document.getElementById('fps-counter');
      if (fpsCounter) {
        fpsCounter.textContent = this.performanceStats.fps;
      }
    }
  }

  updateXRButtons(support) {
    const startARBtn = document.getElementById('start-ar-btn');
    const startVRBtn = document.getElementById('start-vr-btn');
    
    if (startARBtn) {
      startARBtn.disabled = !support.ar;
      startARBtn.title = support.ar ? 'Start AR Session' : 'AR not supported';
    }
    
    if (startVRBtn) {
      startVRBtn.disabled = !support.vr;
      startVRBtn.title = support.vr ? 'Start VR Session' : 'VR not supported';
    }
  }

  handlePageHidden() {
    // Pause non-essential operations
    console.log('📱 Page hidden - pausing operations');
  }

  handlePageVisible() {
    // Resume operations
    console.log('📱 Page visible - resuming operations');
  }

  handleOrientationChange() {
    // Handle device orientation change
    if (this.arEngine && this.arEngine.renderer) {
      this.arEngine.renderer.setSize(window.innerWidth, window.innerHeight);
      this.arEngine.camera.aspect = window.innerWidth / window.innerHeight;
      this.arEngine.camera.updateProjectionMatrix();
    }
  }

  handleDeviceMotion(event) {
    // Handle device motion for AR tracking
    if (this.arEngine && this.arEngine.isXRActive) {
      // Device motion data can supplement XR tracking
      const motion = {
        acceleration: event.acceleration,
        accelerationIncludingGravity: event.accelerationIncludingGravity,
        rotationRate: event.rotationRate
      };
      
      this.emit('device-motion', motion);
    }
  }

  cleanup() {
    console.log('🧹 Cleaning up AR/VR Platform...');
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    if (this.arEngine && this.arEngine.xrSession) {
      this.arEngine.xrSession.end();
    }
    
    if (this.deviceConnector) {
      this.deviceConnector.disconnectAll();
    }
  }

  // Event system
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Event handler error for ${event}:`, error);
        }
      });
    }
  }
}

// Initialize the platform when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.arvrPlatform = new ARVRComPlatform();
});

export { ARVRComPlatform };
