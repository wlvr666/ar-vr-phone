/**
 * UI Manager for AR/VR Communication Platform
 * Handles all user interface interactions and state management
 */
export class UIManager {
  constructor(platform) {
    this.platform = platform;
    
    // UI state
    this.isUIVisible = true;
    this.currentModal = null;
    this.sideMenuOpen = false;
    this.notifications = [];
    this.deviceList = [];
    
    // UI elements cache
    this.elements = new Map();
    
    // Notification queue
    this.notificationQueue = [];
    this.maxNotifications = 5;
    this.notificationTimeout = 5000;
    
    // Animation state
    this.animations = new Map();
    
    // Touch/gesture handling
    this.touchStartTime = 0;
    this.touchStartPos = { x: 0, y: 0 };
    this.isGestureActive = false;
    
    // Configuration
    this.config = {
      autoHideUI: true,
      autoHideDelay: 10000, // 10 seconds
      animationDuration: 300,
      notificationPosition: 'top-right',
      debugMode: false
    };
    
    // Event handlers
    this.eventHandlers = new Map();
    
    this.init();
  }

  init() {
    try {
      console.log('🎨 Initializing UI Manager...');
      
      // Cache UI elements
      this.cacheUIElements();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Initialize UI components
      this.initializeComponents();
      
      // Setup auto-hide behavior
      this.setupAutoHide();
      
      // Initialize gesture recognition
      this.setupGestureRecognition();
      
      console.log('✅ UI Manager initialized');
      
    } catch (error) {
      console.error('❌ UI Manager initialization failed:', error);
      throw error;
    }
  }

  cacheUIElements() {
    // Cache frequently accessed elements
    const elementIds = [
      'ui-overlay',
      'top-bar',
      'bottom-controls',
      'side-menu',
      'modal-overlay',
      'notifications',
      'connection-status',
      'loading-screen',
      'error-screen',
      'debug-panel',
      
      // Buttons
      'menu-button',
      'device-scan-button',
      'settings-button',
      'create-room-btn',
      'join-room-btn',
      'leave-room-btn',
      'start-ar-btn',
      'start-vr-btn',
      'stop-xr-btn',
      'add-object-btn',
      'hand-tracking-btn',
      'spatial-audio-btn',
      
      // Controls
      'mic-toggle',
      'camera-toggle',
      'speaker-toggle',
      
      // Info displays
      'room-name',
      'user-count',
      'server-status',
      'xr-status',
      'device-status',
      
      // Panels
      'object-panel',
      'device-list',
      
      // Modals
      'create-room-modal',
      'join-room-modal',
      'device-control-modal'
    ];
    
    elementIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.elements.set(id, element);
      } else {
        console.warn(`UI element not found: ${id}`);
      }
    });
    
    console.log(`🎨 Cached ${this.elements.size} UI elements`);
  }

  setupEventListeners() {
    // Menu controls
    this.addClickListener('menu-button', () => this.toggleSideMenu());
    this.addClickListener('close-menu', () => this.closeSideMenu());
    this.addClickListener('settings-button', () => this.openSettings());
    
    // Room controls
    this.addClickListener('create-room-btn', () => this.openCreateRoomModal());
    this.addClickListener('join-room-btn', () => this.openJoinRoomModal());
    this.addClickListener('leave-room-btn', () => this.leaveRoom());
    
    // AR/VR controls
    this.addClickListener('start-ar-btn', () => this.startAR());
    this.addClickListener('start-vr-btn', () => this.startVR());
    this.addClickListener('stop-xr-btn', () => this.stopXR());
    
    // Device controls
    this.addClickListener('device-scan-button', () => this.scanDevices());
    
    // Media controls
    this.addClickListener('mic-toggle', () => this.toggleMicrophone());
    this.addClickListener('camera-toggle', () => this.toggleCamera());
    this.addClickListener('speaker-toggle', () => this.toggleSpeaker());
    
    // Object controls
    this.addClickListener('add-object-btn', () => this.toggleObjectPanel());
    this.addClickListener('close-object-panel', () => this.closeObjectPanel());
    this.addClickListener('hand-tracking-btn', () => this.toggleHandTracking());
    this.addClickListener('spatial-audio-btn', () => this.toggleSpatialAudio());
    
    // Object spawning
    this.setupObjectSpawning();
    
    // Modal controls
    this.setupModalControls();
    
    // Global UI controls
    this.setupGlobalControls();
    
    console.log('🎨 Event listeners setup complete');
  }

  addClickListener(elementId, handler) {
    const element = this.elements.get(elementId);
    if (element) {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.hapticFeedback('light');
        handler(event);
      });
    }
  }

  setupObjectSpawning() {
    // Object type buttons
    const objectTypes = ['cube', 'sphere', 'plane', 'avatar'];
    
    objectTypes.forEach(type => {
      const buttons = document.querySelectorAll(`[data-type="${type}"]`);
      buttons.forEach(button => {
        button.addEventListener('click', () => {
          this.spawnObject(type);
          this.closeObjectPanel();
        });
      });
    });
  }

  setupModalControls() {
    // Create room modal
    const createRoomForm = document.getElementById('create-room-form');
    if (createRoomForm) {
      createRoomForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreateRoom();
      });
    }
    
    this.addClickListener('cancel-create-room', () => this.closeModal());
    this.addClickListener('cancel-join-room', () => this.closeModal());
    this.addClickListener('close-device-control', () => this.closeModal());
    
    // Close modal on overlay click
    const modalOverlay = this.elements.get('modal-overlay');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this.closeModal();
        }
      });
    }
  }

  setupGlobalControls() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });
    
    // Window resize
    window.addEventListener('resize', () => {
      this.handleResize();
    });
    
    // Fullscreen changes
    document.addEventListener('fullscreenchange', () => {
      this.handleFullscreenChange();
    });
    
    // Visibility changes
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });
  }

  initializeComponents() {
    // Initialize status displays
    this.updateConnectionStatus('server', 'disconnected');
    this.updateXRStatus('inactive');
    this.updateDeviceCount(0);
    
    // Initialize room info
    this.updateRoomInfo('No Room', 0);
    
    // Setup initial UI state
    this.hideObjectPanel();
    this.closeSideMenu();
    this.closeModal();
    
    // Initialize debug panel if in debug mode
    if (this.config.debugMode) {
      this.showDebugPanel();
    }
  }

  setupAutoHide() {
    if (!this.config.autoHideUI) return;
    
    let hideTimeout;
    
    const resetHideTimer = () => {
      clearTimeout(hideTimeout);
      this.showUI();
      
      hideTimeout = setTimeout(() => {
        this.hideUI();
      }, this.config.autoHideDelay);
    };
    
    // Reset timer on user interaction
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
      document.addEventListener(event, resetHideTimer, { passive: true });
    });
    
    // Initial timer
    resetHideTimer();
  }

  setupGestureRecognition() {
    const uiOverlay = this.elements.get('ui-overlay');
    if (!uiOverlay) return;
    
    // Touch events
    uiOverlay.addEventListener('touchstart', (e) => {
      this.handleTouchStart(e);
    }, { passive: true });
    
    uiOverlay.addEventListener('touchend', (e) => {
      this.handleTouchEnd(e);
    }, { passive: true });
    
    uiOverlay.addEventListener('touchmove', (e) => {
      this.handleTouchMove(e);
    }, { passive: true });
    
    // Mouse events for desktop
    uiOverlay.addEventListener('mousedown', (e) => {
      this.handleMouseDown(e);
    });
    
    uiOverlay.addEventListener('mouseup', (e) => {
      this.handleMouseUp(e);
    });
  }

  // Event Handlers
  handleKeyboardShortcuts(event) {
    const { key, ctrlKey, altKey, shiftKey } = event;
    
    // Prevent default for our shortcuts
    const shortcuts = {
      'Escape': () => this.closeModal() || this.closeSideMenu(),
      ' ': () => this.togglePlayPause(),
      'm': () => this.toggleMicrophone(),
      'v': () => this.toggleCamera(),
      's': () => this.toggleSpeaker(),
      'r': () => ctrlKey && this.openCreateRoomModal(),
      'j': () => ctrlKey && this.openJoinRoomModal(),
      'a': () => ctrlKey && this.startAR(),
      'h': () => this.toggleUI(),
      'd': () => altKey && this.toggleDebugPanel()
    };
    
    const handler = shortcuts[key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  }

  handleTouchStart(event) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.touchStartTime = Date.now();
      this.touchStartPos = { x: touch.clientX, y: touch.clientY };
      this.isGestureActive = true;
    }
  }

  handleTouchEnd(event) {
    if (!this.isGestureActive) return;
    
    const touchTime = Date.now() - this.touchStartTime;
    const touch = event.changedTouches[0];
    const endPos = { x: touch.clientX, y: touch.clientY };
    
    const deltaX = endPos.x - this.touchStartPos.x;
    const deltaY = endPos.y - this.touchStartPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Detect gestures
    if (touchTime < 300 && distance < 30) {
      // Tap
      this.handleTap(endPos);
    } else if (distance > 50) {
      // Swipe
      this.handleSwipe(deltaX, deltaY, distance);
    }
    
    this.isGestureActive = false;
  }

  handleTouchMove(event) {
    // Handle pan gestures if needed
  }

  handleMouseDown(event) {
    this.touchStartTime = Date.now();
    this.touchStartPos = { x: event.clientX, y: event.clientY };
    this.isGestureActive = true;
  }

  handleMouseUp(event) {
    if (!this.isGestureActive) return;
    
    const clickTime = Date.now() - this.touchStartTime;
    const endPos = { x: event.clientX, y: event.clientY };
    
    const deltaX = endPos.x - this.touchStartPos.x;
    const deltaY = endPos.y - this.touchStartPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (clickTime < 300 && distance < 10) {
      this.handleTap(endPos);
    }
    
    this.isGestureActive = false;
  }

  handleTap(position) {
    // Handle tap gestures
    console.log('🎨 Tap detected at:', position);
  }

  handleSwipe(deltaX, deltaY, distance) {
    const angle = Math.atan2(deltaY, deltaX);
    const direction = this.getSwipeDirection(angle);
    
    console.log('🎨 Swipe detected:', direction, distance);
    
    switch (direction) {
      case 'left':
        if (!this.sideMenuOpen) {
          this.openSideMenu();
        }
        break;
      case 'right':
        if (this.sideMenuOpen) {
          this.closeSideMenu();
        }
        break;
      case 'up':
        this.showObjectPanel();
        break;
      case 'down':
        this.hideObjectPanel();
        break;
    }
  }

  getSwipeDirection(angle) {
    const degrees = angle * 180 / Math.PI;
    
    if (degrees >= -45 && degrees <= 45) return 'right';
    if (degrees >= 45 && degrees <= 135) return 'down';
    if (degrees >= 135 || degrees <= -135) return 'left';
    return 'up';
  }

  handleResize() {
    // Adjust UI for different screen sizes
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Adjust UI scale for mobile
    if (width < 768) {
      document.body.classList.add('mobile');
    } else {
      document.body.classList.remove('mobile');
    }
    
    // Adjust UI for landscape/portrait
    if (width > height) {
      document.body.classList.add('landscape');
      document.body.classList.remove('portrait');
    } else {
      document.body.classList.add('portrait');
      document.body.classList.remove('landscape');
    }
  }

  handleFullscreenChange() {
    const isFullscreen = !!document.fullscreenElement;
    
    if (isFullscreen) {
      document.body.classList.add('fullscreen');
    } else {
      document.body.classList.remove('fullscreen');
    }
    
    this.emit('fullscreen-changed', isFullscreen);
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.emit('ui-hidden');
    } else {
      this.emit('ui-visible');
    }
  }

  // UI State Management
  showUI() {
    if (this.isUIVisible) return;
    
    this.isUIVisible = true;
    const uiOverlay = this.elements.get('ui-overlay');
    
    if (uiOverlay) {
      uiOverlay.classList.remove('hidden');
      this.animateElement(uiOverlay, 'fadeIn');
    }
    
    this.emit('ui-shown');
  }

  hideUI() {
    if (!this.isUIVisible) return;
    
    this.isUIVisible = false;
    const uiOverlay = this.elements.get('ui-overlay');
    
    if (uiOverlay) {
      this.animateElement(uiOverlay, 'fadeOut').then(() => {
        uiOverlay.classList.add('hidden');
      });
    }
    
    this.emit('ui-hidden');
  }

  toggleUI() {
    if (this.isUIVisible) {
      this.hideUI();
    } else {
      this.showUI();
    }
  }

  // Side Menu Management
  openSideMenu() {
    const sideMenu = this.elements.get('side-menu');
    if (!sideMenu) return;
    
    this.sideMenuOpen = true;
    sideMenu.classList.remove('hidden');
    this.animateElement(sideMenu, 'slideInLeft');
    
    // Add backdrop
    this.addBackdrop(() => this.closeSideMenu());
    
    this.emit('side-menu-opened');
  }

  closeSideMenu() {
    const sideMenu = this.elements.get('side-menu');
    if (!sideMenu) return;
    
    this.sideMenuOpen = false;
    
    this.animateElement(sideMenu, 'slideOutLeft').then(() => {
      sideMenu.classList.add('hidden');
    });
    
    this.removeBackdrop();
    
    this.emit('side-menu-closed');
  }

  toggleSideMenu() {
    if (this.sideMenuOpen) {
      this.closeSideMenu();
    } else {
      this.openSideMenu();
    }
  }

  // Modal Management
  openModal(modalId) {
    this.closeModal(); // Close any existing modal
    
    const modalOverlay = this.elements.get('modal-overlay');
    const modal = this.elements.get(modalId);
    
    if (!modalOverlay || !modal) {
      console.error(`Modal not found: ${modalId}`);
      return;
    }
    
    this.currentModal = modalId;
    
    modalOverlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    
    this.animateElement(modalOverlay, 'fadeIn');
    this.animateElement(modal, 'zoomIn');
    
    this.emit('modal-opened', modalId);
  }

  closeModal() {
    if (!this.currentModal) return;
    
    const modalOverlay = this.elements.get('modal-overlay');
    const modal = this.elements.get(this.currentModal);
    
    if (modalOverlay && modal) {
      this.animateElement(modalOverlay, 'fadeOut');
      this.animateElement(modal, 'zoomOut').then(() => {
        modalOverlay.classList.add('hidden');
        modal.classList.add('hidden');
      });
    }
    
    this.emit('modal-closed', this.currentModal);
    this.currentModal = null;
  }

  openCreateRoomModal() {
    this.openModal('create-room-modal');
  }

  openJoinRoomModal() {
    this.openModal('join-room-modal');
    this.loadRoomList();
  }

  openDeviceControlModal(deviceId) {
    this.openModal('device-control-modal');
    this.populateDeviceControl(deviceId);
  }

  // Object Panel Management
  showObjectPanel() {
    const objectPanel = this.elements.get('object-panel');
    if (!objectPanel) return;
    
    objectPanel.classList.remove('hidden');
    this.animateElement(objectPanel, 'slideInUp');
  }

  hideObjectPanel() {
    const objectPanel = this.elements.get('object-panel');
    if (!objectPanel) return;
    
    this.animateElement(objectPanel, 'slideOutDown').then(() => {
      objectPanel.classList.add('hidden');
    });
  }

  toggleObjectPanel() {
    const objectPanel = this.elements.get('object-panel');
    if (!objectPanel) return;
    
    if (objectPanel.classList.contains('hidden')) {
      this.showObjectPanel();
    } else {
      this.hideObjectPanel();
    }
  }

  closeObjectPanel() {
    this.hideObjectPanel();
  }

  // Status Updates
  updateConnectionStatus(type, status) {
    const statusElement = this.elements.get(`${type}-status`);
    if (!statusElement) return;
    
    statusElement.textContent = this.formatStatus(status);
    statusElement.className = `status-value ${status}`;
    
    // Update visual indicators
    this.updateStatusIndicator(type, status);
  }

  updateXRStatus(status, mode = null) {
    const xrStatus = this.elements.get('xr-status');
    if (!xrStatus) return;
    
    const displayText = mode ? `${mode.toUpperCase()} Active` : this.formatStatus(status);
    xrStatus.textContent = displayText;
    xrStatus.className = `status-value ${status}`;
  }

  updateDeviceCount(count) {
    const deviceStatus = this.elements.get('device-status');
    if (deviceStatus) {
      deviceStatus.textContent = count.toString();
    }
  }

  updateRoomInfo(roomName, userCount) {
    const roomNameElement = this.elements.get('room-name');
    const userCountElement = this.elements.get('user-count');
    
    if (roomNameElement) {
      roomNameElement.textContent = roomName;
    }
    
    if (userCountElement) {
      const userText = userCount === 1 ? 'user' : 'users';
      userCountElement.textContent = `${userCount} ${userText}`;
    }
  }

  updateUserCount(count) {
    const userCountElement = this.elements.get('user-count');
    if (userCountElement) {
      const userText = count === 1 ? 'user' : 'users';
      userCountElement.textContent = `${count} ${userText}`;
    }
  }

  formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  updateStatusIndicator(type, status) {
    // Add visual indicators (colors, icons) based on status
    const colors = {
      connected: '#4CAF50',
      disconnected: '#F44336',
      connecting: '#FF9800',
      active: '#2196F3',
      inactive: '#9E9E9E'
    };
    
    const statusElement = this.elements.get(`${type}-status`);
    if (statusElement) {
      statusElement.style.color = colors[status] || colors.inactive;
    }
  }

  // Device Management UI
  addDeviceToList(device) {
    const deviceList = this.elements.get('device-list');
    if (!deviceList) return;
    
    const deviceElement = this.createDeviceElement(device);
    deviceList.appendChild(deviceElement);
    
    this.deviceList.push(device);
  }

  createDeviceElement(device) {
    const deviceElement = document.createElement('div');
    deviceElement.className = 'device-item';
    deviceElement.dataset.deviceId = device.id;
    
    deviceElement.innerHTML = `
      <div class="device-icon">${this.getDeviceIcon(device.type)}</div>
      <div class="device-info">
        <div class="device-name">${device.name}</div>
        <div class="device-type">${device.type} via ${device.protocol}</div>
      </div>
      <div class="device-actions">
        <button class="connect-btn" onclick="ui.connectDevice('${device.id}', '${device.protocol}')">
          Connect
        </button>
      </div>
    `;
    
    return deviceElement;
  }

  getDeviceIcon(deviceType) {
    const icons = {
      'smart-tv': '📺',
      'smart-speaker': '🔊',
      'smartphone': '📱',
      'tablet': '📱',
      'laptop': '💻',
      'vr-headset': '🥽',
      'ar-glasses': '👓',
      'game-console': '🎮',
      'smart-light': '💡',
      'unknown': '📟'
    };
    
    return icons[deviceType] || icons.unknown;
  }

  removeDeviceFromList(deviceId) {
    const deviceElement = document.querySelector(`[data-device-id="${deviceId}"]`);
    if (deviceElement) {
      deviceElement.remove();
    }
    
    this.deviceList = this.deviceList.filter(device => device.id !== deviceId);
  }

  // Notification System
  showNotification(message, type = 'info', duration = null) {
    const notification = {
      id: Date.now(),
      message,
      type,
      duration: duration || this.notificationTimeout,
      timestamp: new Date()
    };
    
    this.notifications.push(notification);
    this.renderNotification(notification);
    
    // Auto-remove notification
    setTimeout(() => {
      this.removeNotification(notification.id);
    }, notification.duration);
    
    return notification.id;
  }

  renderNotification(notification) {
    const notificationsContainer = this.elements.get('notifications');
    if (!notificationsContainer) return;
    
    const notificationElement = document.createElement('div');
    notificationElement.className = `notification ${notification.type}`;
    notificationElement.dataset.notificationId = notification.id;
    
    notificationElement.innerHTML = `
      <div class="notification-content">
        <div class="notification-icon">${this.getNotificationIcon(notification.type)}</div>
        <div class="notification-message">${notification.message}</div>
        <button class="notification-close" onclick="ui.removeNotification(${notification.id})">×</button>
      </div>
    `;
    
    notificationsContainer.appendChild(notificationElement);
    
    // Animate in
    this.animateElement(notificationElement, 'slideInRight');
    
    // Limit number of notifications
    this.limitNotifications();
  }

  getNotificationIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    return icons[type] || icons.info;
  }

  removeNotification(notificationId) {
    const notificationElement = document.querySelector(`[data-notification-id="${notificationId}"]`);
    if (!notificationElement) return;
    
    this.animateElement(notificationElement, 'slideOutRight').then(() => {
      notificationElement.remove();
    });
    
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
  }

  limitNotifications() {
    const notificationElements = document.querySelectorAll('.notification');
    
    if (notificationElements.length > this.maxNotifications) {
      const oldestNotification = notificationElements[0];
      const notificationId = parseInt(oldestNotification.dataset.notificationId);
      this.removeNotification(notificationId);
    }
  }

  clearAllNotifications() {
    this.notifications.forEach(notification => {
      this.removeNotification(notification.id);
    });
    
    this.notifications = [];
  }

  // Animation System
  animateElement(element, animationName, duration = null) {
    return new Promise((resolve) => {
      const animationDuration = duration || this.config.animationDuration;
      
      element.style.animationDuration = `${animationDuration}ms`;
      element.classList.add('animated', animationName);
      
      const handleAnimationEnd = () => {
        element.classList.remove('animated', animationName);
        element.removeEventListener('animationend', handleAnimationEnd);
        resolve();
      };
      
      element.addEventListener('animationend', handleAnimationEnd);
      
      // Fallback timeout
      setTimeout(() => {
        if (element.classList.contains(animationName)) {
          handleAnimationEnd();
        }
      }, animationDuration + 100);
    });
  }

  // Utility Methods
  addBackdrop(clickHandler = null) {
    const backdrop = document.createElement('div');
    backdrop.className = 'ui-backdrop';
    backdrop.id = 'ui-backdrop';
    
    if (clickHandler) {
      backdrop.addEventListener('click', clickHandler);
    }
    
    document.body.appendChild(backdrop);
    
    this.animateElement(backdrop, 'fadeIn');
  }

  removeBackdrop() {
    const backdrop = document.getElementById('ui-backdrop');
    if (backdrop) {
      this.animateElement(backdrop, 'fadeOut').then(() => {
        backdrop.remove();
      });
    }
  }

  hapticFeedback(intensity = 'medium') {
    if ('vibrate' in navigator) {
      const patterns = {
        light: 10,
        medium: 20,
        heavy: 30
      };
      
      navigator.vibrate(patterns[intensity] || patterns.medium);
    }
  }

  // Platform Integration Methods
  leaveRoom() {
    this.emit('leave-room-requested');
  }

  startAR() {
    this.emit('start-ar-requested');
  }

  startVR() {
    this.emit('start-vr-requested');
  }

  stopXR() {
    this.emit('stop-xr-requested');
  }

  scanDevices() {
    this.emit('scan-devices-requested');
    this.showNotification('Scanning for devices...', 'info');
  }

  spawnObject(objectType) {
    this.emit('object-spawn-requested', objectType);
  }

  toggleMicrophone() {
    const micButton = this.elements.get('mic-toggle');
    if (micButton) {
      micButton.classList.toggle('active');
      const isActive = micButton.classList.contains('active');
      this.emit('microphone-toggled', isActive);
      
      this.showNotification(
        `Microphone ${isActive ? 'enabled' : 'disabled'}`,
        'info',
        2000
      );
    }
  }

  toggleCamera() {
    const cameraButton = this.elements.get('camera-toggle');
    if (cameraButton) {
      cameraButton.classList.toggle('active');
      const isActive = cameraButton.classList.contains('active');
      this.emit('camera-toggled', isActive);
      
      this.showNotification(
        `Camera ${isActive ? 'enabled' : 'disabled'}`,
        'info',
        2000
      );
    }
  }

  toggleSpeaker() {
    const speakerButton = this.elements.get('speaker-toggle');
    if (speakerButton) {
      speakerButton.classList.toggle('active');
      const isActive = speakerButton.classList.contains('active');
