// ui-manager.js - User Interface Management System

export class UIManager extends EventTarget {
    constructor() {
        super();
        this.elements = new Map();
        this.notifications = [];
        this.activeModals = new Set();
        this.deviceList = new Map();
        this.callList = new Map();
        
        // UI state
        this.uiState = {
            isInitialized: false,
            currentView: 'main',
            settingsOpen: false,
            devicePanelOpen: true,
            commPanelOpen: true,
            spatialUIVisible: false
        };
        
        // Animation settings
        this.animationSettings = {
            defaultDuration: 300,
            easingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            staggerDelay: 50
        };
        
        // Notification settings
        this.notificationSettings = {
            duration: 5000,
            maxNotifications: 5,
            position: 'top-right'
        };
        
        // Responsive breakpoints
        this.breakpoints = {
            mobile: 768,
            tablet: 1024,
            desktop: 1200
        };
        
        this.currentBreakpoint = 'desktop';
        this.touchDevice = false;
    }

    async init() {
        console.log('🔧 Initializing UI Manager...');
        
        try {
            // Detect device capabilities
            this.detectDeviceCapabilities();
            
            // Cache DOM elements
            this.cacheElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize responsive design
            this.initializeResponsiveDesign();
            
            // Setup accessibility features
            this.setupAccessibility();
            
            // Initialize animations
            this.initializeAnimations();
            
            this.uiState.isInitialized = true;
            console.log('✅ UI Manager initialized');
            
        } catch (error) {
            console.error('❌ UI Manager initialization failed:', error);
            throw error;
        }
    }

    detectDeviceCapabilities() {
        // Detect touch support
        this.touchDevice = 'ontouchstart' in window || 
                          navigator.maxTouchPoints > 0 || 
                          navigator.msMaxTouchPoints > 0;
        
        // Detect screen size
        this.updateBreakpoint();
        
        // Add device-specific classes
        document.body.classList.toggle('touch-device', this.touchDevice);
        document.body.classList.add(`breakpoint-${this.currentBreakpoint}`);
        
        console.log(`📱 Device: ${this.touchDevice ? 'Touch' : 'Mouse'}, Breakpoint: ${this.currentBreakpoint}`);
    }

    cacheElements() {
        // Main UI elements
        this.elements.set('loadingScreen', document.getElementById('loading-screen'));
        this.elements.set('mainUI', document.getElementById('main-ui'));
        this.elements.set('progressBar', document.getElementById('progress-bar'));
        this.elements.set('loadingStatus', document.getElementById('loading-status'));
        
        // Top bar elements
        this.elements.set('connectionStatus', document.getElementById('connection-status'));
        this.elements.set('deviceCount', document.getElementById('device-count'));
        this.elements.set('userCount', document.getElementById('user-count'));
        this.elements.set('settingsBtn', document.getElementById('settings-btn'));
        this.elements.set('helpBtn', document.getElementById('help-btn'));
        
        // Side panels
        this.elements.set('devicePanel', document.getElementById('device-panel'));
        this.elements.set('commPanel', document.getElementById('comm-panel'));
        this.elements.set('deviceList', document.getElementById('device-list'));
        this.elements.set('callList', document.getElementById('call-list'));
        
        // AR/VR controls
        this.elements.set('arContainer', document.getElementById('ar-container'));
        this.elements.set('arCanvas', document.getElementById('ar-canvas'));
        this.elements.set('spatialUI', document.getElementById('spatial-ui'));
        this.elements.set('arBtn', document.getElementById('ar-btn'));
        this.elements.set('vrBtn', document.getElementById('vr-btn'));
        this.elements.set('shareSpaceBtn', document.getElementById('share-space-btn'));
        
        // Communication controls
        this.elements.set('roomId', document.getElementById('room-id'));
        this.elements.set('createRoomBtn', document.getElementById('create-room-btn'));
        this.elements.set('joinRoomBtn', document.getElementById('join-room-btn'));
        this.elements.set('scanDevicesBtn', document.getElementById('scan-devices-btn'));
        
        // Media controls
        this.elements.set('micBtn', document.getElementById('mic-btn'));
        this.elements.set('videoBtn', document.getElementById('video-btn'));
        this.elements.set('screenShareBtn', document.getElementById('screen-share-btn'));
        this.elements.set('endCallBtn', document.getElementById('end-call-btn'));
        
        // Modal elements
        this.elements.set('settingsModal', document.getElementById('settings-modal'));
        this.elements.set('closeSettings', document.getElementById('close-settings'));
        
        // Notifications
        this.elements.set('notifications', document.getElementById('notifications'));
        
        console.log('🗂️ DOM elements cached');
    }

    setupEventListeners() {
        // Window events
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('orientationchange', () => this.handleOrientationChange());
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Mouse/touch events for custom interactions
        this.setupCustomInteractions();
        
        // Settings modal events
        const settingsBtn = this.elements.get('settingsBtn');
        const closeSettings = this.elements.get('closeSettings');
        const settingsModal = this.elements.get('settingsModal');
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }
        
        if (closeSettings) {
            closeSettings.addEventListener('click', () => this.closeSettings());
        }
        
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    this.closeSettings();
                }
            });
        }
        
        // Panel toggle events (for mobile)
        this.setupPanelToggles();
        
        console.log('👂 Event listeners setup');
    }

    setupCustomInteractions() {
        // Device list interactions
        const deviceList = this.elements.get('deviceList');
        if (deviceList) {
            deviceList.addEventListener('click', (e) => this.handleDeviceClick(e));
        }
        
        // AR/VR canvas interactions
        const arCanvas = this.elements.get('arCanvas');
        if (arCanvas) {
            arCanvas.addEventListener('click', (e) => this.handleCanvasClick(e));
            
            if (this.touchDevice) {
                arCanvas.addEventListener('touchstart', (e) => this.handleCanvasTouch(e));
                arCanvas.addEventListener('touchmove', (e) => this.handleCanvasTouch(e));
                arCanvas.addEventListener('touchend', (e) => this.handleCanvasTouch(e));
            }
        }
        
        // Room ID input enhancements
        const roomIdInput = this.elements.get('roomId');
        if (roomIdInput) {
            roomIdInput.addEventListener('input', (e) => this.handleRoomIdInput(e));
            roomIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.dispatchEvent(new CustomEvent('joinRoomRequested', {
                        detail: { roomId: e.target.value }
                    }));
                }
            });
        }
    }

    setupPanelToggles() {
        if (this.currentBreakpoint === 'mobile') {
            // Add toggle buttons for mobile
            this.createMobilePanelToggles();
        }
    }

    createMobilePanelToggles() {
        const topBar = document.querySelector('.top-bar');
        if (!topBar) return;
        
        // Create device panel toggle
        const deviceToggle = document.createElement('button');
        deviceToggle.className = 'icon-btn mobile-toggle';
        deviceToggle.innerHTML = '📱';
        deviceToggle.title = 'Toggle Devices';
        deviceToggle.addEventListener('click', () => this.toggleDevicePanel());
        
        // Create communication panel toggle
        const commToggle = document.createElement('button');
        commToggle.className = 'icon-btn mobile-toggle';
        commToggle.innerHTML = '💬';
        commToggle.title = 'Toggle Communication';
        commToggle.addEventListener('click', () => this.toggleCommPanel());
        
        // Insert toggles
        const controls = topBar.querySelector('.controls');
        if (controls) {
            controls.insertBefore(deviceToggle, controls.firstChild);
            controls.insertBefore(commToggle, controls.firstChild);
        }
    }

    initializeResponsiveDesign() {
        this.updateBreakpoint();
        this.applyResponsiveLayout();
        
        console.log('📱 Responsive design initialized');
    }

    setupAccessibility() {
        // Add ARIA labels and roles
        this.addAriaLabels();
        
        // Setup keyboard navigation
        this.setupKeyboardNavigation();
        
        // Setup screen reader announcements
        this.setupScreenReaderSupport();
        
        console.log('♿ Accessibility features setup');
    }

    addAriaLabels() {
        const ariaLabels = {
            'ar-btn': 'Start Augmented Reality',
            'vr-btn': 'Start Virtual Reality',
            'share-space-btn': 'Share current space with others',
            'mic-btn': 'Toggle microphone',
            'video-btn': 'Toggle camera',
            'screen-share-btn': 'Share screen',
            'end-call-btn': 'End current call',
            'scan-devices-btn': 'Scan for nearby devices',
            'create-room-btn': 'Create new room',
            'join-room-btn': 'Join existing room',
            'settings-btn': 'Open settings',
            'help-btn': 'Show help'
        };
        
        Object.entries(ariaLabels).forEach(([id, label]) => {
            const element = document.getElementById(id);
            if (element) {
                element.setAttribute('aria-label', label);
            }
        });
    }

    setupKeyboardNavigation() {
        // Tab navigation enhancement
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-navigation');
            }
        });
        
        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-navigation');
        });
    }

    setupScreenReaderSupport() {
        // Create live region for announcements
        const liveRegion = document.createElement('div');
        liveRegion.id = 'live-region';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
        document.body.appendChild(liveRegion);
        
        this.elements.set('liveRegion', liveRegion);
    }

    initializeAnimations() {
        // Setup intersection observer for scroll animations
        this.setupScrollAnimations();
        
        // Initialize loading animations
        this.initializeLoadingAnimations();
        
        console.log('✨ Animations initialized');
    }

    setupScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        this.scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);
        
        // Observe animatable elements
        document.querySelectorAll('.device-item, .notification').forEach(el => {
            this.scrollObserver.observe(el);
        });
    }

    initializeLoadingAnimations() {
        const progressBar = this.elements.get('progressBar');
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.style.transition = `width ${this.animationSettings.defaultDuration}ms ${this.animationSettings.easingFunction}`;
        }
    }

    // Device management UI
    addDeviceToList(device) {
        const deviceList = this.elements.get('deviceList');
        if (!deviceList) return;
        
        const deviceItem = this.createDeviceItem(device);
        this.deviceList.set(device.id, deviceItem);
        
        // Animate device appearance
        deviceItem.style.opacity = '0';
        deviceItem.style.transform = 'translateY(20px)';
        deviceList.appendChild(deviceItem);
        
        // Trigger animation
        requestAnimationFrame(() => {
            deviceItem.style.transition = `all ${this.animationSettings.defaultDuration}ms ${this.animationSettings.easingFunction}`;
            deviceItem.style.opacity = '1';
            deviceItem.style.transform = 'translateY(0)';
        });
        
        this.announceToScreenReader(`Device found: ${device.name}`);
    }

    createDeviceItem(device) {
        const item = document.createElement('div');
        item.className = 'device-item';
        item.dataset.deviceId = device.id;
        item.dataset.protocol = device.protocol;
        
        item.innerHTML = `
            <div class="device-icon">${this.getDeviceIcon(device.type)}</div>
            <div class="device-info">
                <div class="device-name">${device.name}</div>
                <div class="device-type">${device.type} • ${device.protocol}</div>
                <div class="device-status">Discovered</div>
            </div>
            <div class="device-actions">
                <button class="connect-btn" aria-label="Connect to ${device.name}">
                    🔗 Connect
                </button>
            </div>
        `;
        
        // Add connection button listener
        const connectBtn = item.querySelector('.connect-btn');
        connectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dispatchEvent(new CustomEvent('deviceConnectionRequested', {
                detail: { deviceId: device.id, protocol: device.protocol }
            }));
        });
        
        return item;
    }

    getDeviceIcon(type) {
        const icons = {
            smartphone: '📱',
            tv: '📺',
            speaker: '🔊',
            console: '🎮',
            computer: '💻',
            iot: '💡',
            unknown: '📟'
        };
        return icons[type] || icons.unknown;
    }

    updateDeviceStatus(deviceId, status) {
        const deviceItem = this.deviceList.get(deviceId);
        if (!deviceItem) return;
        
        const statusElement = deviceItem.querySelector('.device-status');
        const connectBtn = deviceItem.querySelector('.connect-btn');
        
        if (statusElement) {
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
        
        // Update visual state
        deviceItem.classList.remove('connecting', 'connected', 'disconnected');
        deviceItem.classList.add(status);
        
        // Update button
        if (connectBtn) {
            if (status === 'connected') {
                connectBtn.innerHTML = '🔌 Disconnect';
                connectBtn.setAttribute('aria-label', `Disconnect from ${deviceItem.querySelector('.device-name').textContent}`);
            } else {
                connectBtn.innerHTML = '🔗 Connect';
                connectBtn.setAttribute('aria-label', `Connect to ${deviceItem.querySelector('.device-name').textContent}`);
            }
        }
        
        // Add status animation
        deviceItem.style.animation = `statusUpdate ${this.animationSettings.defaultDuration}ms ${this.animationSettings.easingFunction}`;
        
        this.announceToScreenReader(`Device ${deviceItem.querySelector('.device-name').textContent} is now ${status}`);
    }

    removeDeviceFromList(deviceId) {
        const deviceItem = this.deviceList.get(deviceId);
        if (!deviceItem) return;
        
        // Animate removal
        deviceItem.style.transition = `all ${this.animationSettings.defaultDuration}ms ${this.animationSettings.easingFunction}`;
        deviceItem.style.opacity = '0';
        deviceItem.style.transform = 'translateX(-100%)';
        
        setTimeout(() => {
            if (deviceItem.parentNode) {
                deviceItem.parentNode.removeChild(deviceItem);
            }
            this.deviceList.delete(deviceId);
        }, this.animationSettings.defaultDuration);
    }

    // Call management UI
    addCallToList(callData) {
        const callList = this.elements.get('callList');
        if (!callList) return;
        
        const callItem = this.createCallItem(callData);
        this.callList.set(callData.id, callItem);
        
        // Animate call appearance
        callItem.style.opacity = '0';
        callItem.style.transform = 'translateY(-20px)';
        callList.appendChild(callItem);
        
        requestAnimationFrame(() => {
            callItem.style.transition = `all ${this.animationSettings.defaultDuration}ms ${this.animationSettings.easingFunction}`;
            callItem.style.opacity = '1';
            callItem.style.transform = 'translateY(0)';
        });
    }

    createCallItem(callData) {
        const item = document.createElement('div');
        item.className = 'call-item';
        item.dataset.callId = callData.id;
        
        item.innerHTML = `
            <div class="call-info">
                <div class="call-room">${callData.roomId}</div>
                <div class="call-users">${callData.userCount} users</div>
                <div class="call-duration">00:00</div>
            </div>
            <div class="call-controls">
                <button class="call-control-btn mute-btn" aria-label="Toggle mute">
                    🎤
                </button>
                <button class="call-control-btn video-btn" aria-label="Toggle video">
                    📹
                </button>
                <button class="call-control-btn end-btn" aria-label="End call">
                    📞
                </button>
            </div>
        `;
        
        // Setup call control listeners
        this.setupCallControls(item, callData);
        
        return item;
    }

    setupCallControls(callItem, callData) {
        const muteBtn = callItem.querySelector('.mute-btn');
        const videoBtn = callItem.querySelector('.video-btn');
        const endBtn = callItem.querySelector('.end-btn');
        
        muteBtn?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('toggleMicrophone', {
                detail: { callId: callData.id }
            }));
        });
        
        videoBtn?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('toggleCamera', {
                detail: { callId: callData.id }
            }));
        });
        
        endBtn?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('endCall', {
                detail: { callId: callData.id }
            }));
        });
    }

    updateCallStatus(callId, status) {
        const callItem = this.callList.get(callId);
        if (!callItem) return;
        
        callItem.classList.remove('active', 'muted', 'video-off');
        callItem.classList.add(status);
        
        // Update button states based on status
        const muteBtn = callItem.querySelector('.mute-btn');
        const videoBtn = callItem.querySelector('.video-btn');
        
        if (status.includes('muted') && muteBtn) {
            muteBtn.innerHTML = '🔇';
            muteBtn.classList.add('active');
        } else if (muteBtn) {
            muteBtn.innerHTML = '🎤';
            muteBtn.classList.remove('active');
        }
        
        if (status.includes('video-off') && videoBtn) {
            videoBtn.innerHTML = '📷';
            videoBtn.classList.add('active');
        } else if (videoBtn) {
            videoBtn.innerHTML = '📹';
            videoBtn.classList.remove('active');
        }
    }

    // Notification system
    showNotification(message, type = 'info', duration = this.notificationSettings.duration) {
        const notification = this.createNotification(message, type, duration);
        const notificationsContainer = this.elements.get('notifications');
        
        if (!notificationsContainer) return;
        
        // Add to container
        notificationsContainer.appendChild(notification);
        this.notifications.push(notification);
        
        // Animate in
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification);
            }, duration);
        }
        
        // Limit max notifications
        while (this.notifications.length > this.notificationSettings.maxNotifications) {
            const oldestNotification = this.notifications.shift();
            this.removeNotification(oldestNotification);
        }
        
        // Announce to screen reader
        this.announceToScreenReader(message);
        
        console.log(`📢 Notification: ${message}`);
    }

    createNotification(message, type, duration) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = this.getNotificationIcon(type);
        
        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-message">${message}</div>
                ${duration > 0 ? `<div class="notification-progress"></div>` : ''}
            </div>
            <button class="notification-close" aria-label="Close notification">×</button>
        `;
        
        // Setup close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.removeNotification(notification);
        });
        
        // Setup progress bar animation
        if (duration > 0) {
            const progressBar = notification.querySelector('.notification-progress');
            if (progressBar) {
                progressBar.style.animation = `notificationProgress ${duration}ms linear`;
            }
        }
        
        return notification;
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

    removeNotification(notification) {
        if (!notification || !notification.parentNode) return;
        
        // Animate out
        notification.classList.add('removing');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            
            // Remove from array
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, this.animationSettings.defaultDuration);
    }

    clearAllNotifications() {
        this.notifications.forEach(notification => {
            this.removeNotification(notification);
        });
    }

    // Progress and loading
    updateProgress(percentage, status = '') {
        const progressBar = this.elements.get('progressBar');
        const loadingStatus = this.elements.get('loadingStatus');
        
        if (progressBar) {
            progressBar.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
        }
        
        if (loadingStatus && status) {
            loadingStatus.textContent = status;
        }
    }

    hideLoadingScreen() {
        const loadingScreen = this.elements.get('loadingScreen');
        const mainUI = this.elements.get('mainUI');
        
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
                if (mainUI) {
                    mainUI.classList.remove('hidden');
                }
            }, 500);
        }
    }

    // Settings management
    openSettings() {
        const settingsModal = this.elements.get('settingsModal');
        if (settingsModal) {
            settingsModal.classList.remove('hidden');
            this.uiState.settingsOpen = true;
            this.activeModals.add('settings');
            
            // Focus first focusable element
            const firstFocusable = settingsModal.querySelector('input, button, select, textarea');
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }
    }

    closeSettings() {
        const settingsModal = this.elements.get('settingsModal');
        if (settingsModal) {
            settingsModal.classList.add('hidden');
            this.uiState.settingsOpen = false;
            this.activeModals.delete('settings');
        }
    }

    // Panel management
    toggleDevicePanel() {
        const devicePanel = this.elements.get('devicePanel');
        if (devicePanel) {
            this.uiState.devicePanelOpen = !this.uiState.devicePanelOpen;
            devicePanel.classList.toggle('collapsed', !this.uiState.devicePanelOpen);
        }
    }

    toggleCommPanel() {
        const commPanel = this.elements.get('commPanel');
        if (commPanel) {
            this.uiState.commPanelOpen = !this.uiState.commPanelOpen;
            commPanel.classList.toggle('collapsed', !this.uiState.commPanelOpen);
        }
    }

    // Event handlers
    handleResize() {
        const oldBreakpoint = this.currentBreakpoint;
        this.updateBreakpoint();
        
        if (oldBreakpoint !== this.currentBreakpoint) {
            this.applyResponsiveLayout();
            document.body.className = document.body.className.replace(/breakpoint-\w+/, `breakpoint-${this.currentBreakpoint}`);
        }
    }

    updateBreakpoint() {
        const width = window.innerWidth;
        
        if (width < this.breakpoints.mobile) {
            this.currentBreakpoint = 'mobile';
        } else if (width < this.breakpoints.tablet) {
            this.currentBreakpoint = 'tablet';
        } else {
            this.currentBreakpoint = 'desktop';
        }
    }

    applyResponsiveLayout() {
        switch (this.currentBreakpoint) {
            case 'mobile':
                this.applyMobileLayout();
                break;
            case 'tablet':
                this.applyTabletLayout();
                break;
            case 'desktop':
                this.applyDesktopLayout();
                break;
        }
    }

    applyMobileLayout() {
        // Collapse panels by default on mobile
        this.uiState.devicePanelOpen = false;
        this.uiState.commPanelOpen = false;
        
        const devicePanel = this.elements.get('devicePanel');
        const commPanel = this.elements.get('commPanel');
        
        if (devicePanel) devicePanel.classList.add('collapsed');
        if (commPanel) commPanel.classList.add('collapsed');
    }

    applyTabletLayout() {
        // Show one panel on tablet
        this.uiState.devicePanelOpen = true;
        this.uiState.commPanelOpen = false;
        
        const devicePanel = this.elements.get('devicePanel');
        const commPanel = this.elements.get('commPanel');
        
        if (devicePanel) devicePanel.classList.remove('collapsed');
        if (commPanel) commPanel.classList.add('collapsed');
    }

    applyDesktopLayout() {
        // Show both panels on desktop
        this.uiState.devicePanelOpen = true;
        this.uiState.commPanelOpen = true;
        
        const devicePanel = this.elements.get('devicePanel');
        const commPanel = this.elements.get('commPanel');
        
        if (devicePanel) devicePanel.classList.remove('collapsed');
        if (commPanel) commPanel.classList.remove('collapsed');
    }

    handleOrientationChange() {
        setTimeout(() => {
            this.handleResize();
        }, 100); // Delay to ensure new dimensions are available
    }

    handleKeyDown(e) {
        // Handle keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case ',':
                    e.preventDefault();
                    this.openSettings();
                    break;
                case 'm':
                    e.preventDefault();
                    this.dispatchEvent(new CustomEvent('toggleMicrophone'));
                    break;
                case 'v':
                    e.preventDefault();
                    this.dispatchEvent(new CustomEvent('toggleCamera'));
                    break;
            }
        }
        
        // Handle escape key
        if (e.key === 'Escape') {
            if (this.activeModals.size > 0) {
                this.closeSettings();
            }
        }
    }

    handleKeyUp(e) {
        // Handle key releases if needed
    }

    handleDeviceClick(e) {
        const deviceItem = e.target.closest('.device-item');
        if (!deviceItem) return;
        
        const deviceId = deviceItem.dataset.deviceId;
        const protocol = deviceItem.dataset.protocol;
        
        if (e.target.classList.contains('connect-btn')) {
            // Button click is handled separately
            return;
        }
        
        // Handle device item click (show details, etc.)
        this.dispatchEvent(new CustomEvent('deviceSelected', {
            detail: { deviceId, protocol }
        }));
    }

    handleCanvasClick(e) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.dispatchEvent(new CustomEvent('canvasClicked', {
            detail: { x, y, event: e }
        }));
