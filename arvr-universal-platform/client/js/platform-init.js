// ar-platform.js - Platform Initialization for AR/VR Engine

export class ARPlatform {
    constructor() {
        this.isInitialized = false;
        this.dependencies = {
            three: false,
            webxrPolyfill: false,
            dom: false
        };
        this.config = {
            threejsVersion: 'r128',
            enablePolyfill: true,
            autoSetupUI: true,
            debugMode: false
        };
    }

    /**
     * Initialize the complete AR/VR platform
     * @param {Object} options - Configuration options
     * @returns {Promise<boolean>} - Success status
     */
    async initialize(options = {}) {
        console.log('🚀 Initializing AR/VR Platform...');
        
        // Merge configuration
        this.config = { ...this.config, ...options };
        
        try {
            // 1. Setup DOM structure
            await this.setupDOM();
            
            // 2. Load Three.js
            await this.loadThreeJS();
            
            // 3. Setup WebXR polyfill
            if (this.config.enablePolyfill) {
                await this.setupWebXRPolyfill();
            }
            
            // 4. Initialize platform globals
            this.setupGlobals();
            
            // 5. Setup UI if requested
            if (this.config.autoSetupUI) {
                this.setupUI();
            }
            
            // 6. Setup event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('✅ AR/VR Platform initialized successfully');
            
            return true;
            
        } catch (error) {
            console.error('❌ Platform initialization failed:', error);
            return false;
        }
    }

    /**
     * Setup required DOM structure
     */
    async setupDOM() {
        console.log('📄 Setting up DOM structure...');
        
        // Create main container if it doesn't exist
        if (!document.getElementById('ar-container')) {
            const container = document.createElement('div');
            container.id = 'ar-container';
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: #000;
                z-index: 1;
            `;
            document.body.appendChild(container);
        }
        
        // Create canvas if it doesn't exist
        if (!document.getElementById('ar-canvas')) {
            const canvas = document.createElement('canvas');
            canvas.id = 'ar-canvas';
            canvas.style.cssText = `
                display: block;
                width: 100%;
                height: 100%;
                touch-action: none;
            `;
            document.getElementById('ar-container').appendChild(canvas);
        }
        
        // Create spatial UI container
        if (!document.getElementById('spatial-ui')) {
            const spatialUI = document.createElement('div');
            spatialUI.id = 'spatial-ui';
            spatialUI.className = 'hidden';
            spatialUI.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                background: rgba(0, 0, 0, 0.8);
                border-radius: 12px;
                padding: 16px;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                min-width: 200px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            `;
            document.body.appendChild(spatialUI);
        }
        
        // Create loading overlay
        this.createLoadingOverlay();
        
        this.dependencies.dom = true;
        console.log('✅ DOM structure ready');
    }

    /**
     * Load Three.js library
     */
    async loadThreeJS() {
        console.log('📦 Loading Three.js...');
        
        // Check if Three.js is already loaded
        if (window.THREE) {
            console.log('✅ Three.js already loaded');
            this.dependencies.three = true;
            return;
        }
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://cdnjs.cloudflare.com/ajax/libs/three.js/${this.config.threejsVersion}/three.min.js`;
            script.onload = () => {
                if (window.THREE) {
                    console.log('✅ Three.js loaded successfully');
                    this.dependencies.three = true;
                    resolve();
                } else {
                    reject(new Error('Three.js failed to load properly'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load Three.js'));
            document.head.appendChild(script);
        });
    }

    /**
     * Setup WebXR polyfill for broader device support
     */
    async setupWebXRPolyfill() {
        console.log('🔧 Setting up WebXR polyfill...');
        
        // Check if WebXR is natively supported
        if (navigator.xr) {
            console.log('✅ Native WebXR detected, skipping polyfill');
            this.dependencies.webxrPolyfill = true;
            return;
        }
        
        try {
            // Load WebXR polyfill
            const polyfillScript = document.createElement('script');
            polyfillScript.src = 'https://cdn.jsdelivr.net/npm/webxr-polyfill@latest/build/webxr-polyfill.min.js';
            
            await new Promise((resolve, reject) => {
                polyfillScript.onload = resolve;
                polyfillScript.onerror = reject;
                document.head.appendChild(polyfillScript);
            });
            
            // Initialize polyfill
            if (window.WebXRPolyfill) {
                new window.WebXRPolyfill();
                console.log('✅ WebXR polyfill initialized');
            }
            
            this.dependencies.webxrPolyfill = true;
            
        } catch (error) {
            console.warn('⚠️ WebXR polyfill failed to load:', error);
            // Continue without polyfill
            this.dependencies.webxrPolyfill = true;
        }
    }

    /**
     * Setup platform globals and utilities
     */
    setupGlobals() {
        console.log('🌐 Setting up platform globals...');
        
        // Create platform namespace
        if (!window.ARPlatform) {
            window.ARPlatform = {
                version: '1.0.0',
                initialized: true,
                capabilities: this.getCapabilities(),
                utils: {
                    isMobile: this.isMobile(),
                    isIOS: this.isIOS(),
                    isAndroid: this.isAndroid(),
                    hasWebXR: !!navigator.xr,
                    hasCamera: this.hasCamera(),
                    hasGyroscope: this.hasGyroscope()
                }
            };
        }
        
        // Setup performance monitoring
        this.setupPerformanceMonitoring();
        
        console.log('✅ Platform globals configured');
    }

    /**
     * Setup basic UI elements
     */
    setupUI() {
        console.log('🎨 Setting up UI elements...');
        
        // Create control panel if it doesn't exist
        if (!document.getElementById('ar-controls')) {
            const controls = document.createElement('div');
            controls.id = 'ar-controls';
            controls.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1000;
                display: flex;
                gap: 12px;
                background: rgba(0, 0, 0, 0.8);
                border-radius: 24px;
                padding: 12px 20px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            `;
            
            // AR Button
            const arBtn = document.createElement('button');
            arBtn.id = 'ar-btn';
            arBtn.textContent = '📱 Start AR';
            arBtn.style.cssText = this.getButtonStyles('#10b981');
            
            // VR Button
            const vrBtn = document.createElement('button');
            vrBtn.id = 'vr-btn';
            vrBtn.textContent = '🥽 Start VR';
            vrBtn.style.cssText = this.getButtonStyles('#6366f1');
            
            // Share Space Button
            const shareBtn = document.createElement('button');
            shareBtn.id = 'share-space-btn';
            shareBtn.textContent = '🤝 Share Space';
            shareBtn.className = 'disabled';
            shareBtn.style.cssText = this.getButtonStyles('#64748b');
            
            controls.appendChild(arBtn);
            controls.appendChild(vrBtn);
            controls.appendChild(shareBtn);
            document.body.appendChild(controls);
        }
        
        // Create debug panel if in debug mode
        if (this.config.debugMode) {
            this.createDebugPanel();
        }
        
        console.log('✅ UI elements created');
    }

    /**
     * Get consistent button styles
     */
    getButtonStyles(color) {
        return `
            background: ${color};
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
        `;
    }

    /**
     * Setup event listeners for platform
     */
    setupEventListeners() {
        console.log('🎧 Setting up event listeners...');
        
        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (window.AREngine && window.AREngine.renderer) {
                    window.AREngine.renderer.setSize(window.innerWidth, window.innerHeight);
                }
            }, 100);
        });
        
        // Handle visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                // Pause AR/VR if running
                if (window.AREngine && window.AREngine.getSessionInfo().isActive) {
                    console.log('🔄 Pausing session due to visibility change');
                }
            }
        });
        
        // Handle errors
        window.addEventListener('error', (event) => {
            console.error('🚨 Platform error:', event.error);
            this.showError('An error occurred. Please refresh the page.');
        });
        
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('🚨 Unhandled promise rejection:', event.reason);
        });
        
        console.log('✅ Event listeners configured');
    }

    /**
     * Create loading overlay
     */
    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        overlay.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">🌐</div>
                <h2 style="margin: 0 0 10px 0; font-weight: 600;">AR/VR Platform</h2>
                <p style="margin: 0; opacity: 0.7; font-size: 16px;">Initializing spatial computing...</p>
                <div style="margin-top: 30px; width: 200px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                    <div id="loading-progress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981, #6366f1); transition: width 0.3s; border-radius: 2px;"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    /**
     * Update loading progress
     */
    updateLoadingProgress(percent, message = '') {
        const progressBar = document.getElementById('loading-progress');
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        
        if (message) {
            const overlay = document.getElementById('loading-overlay');
            const messageEl = overlay.querySelector('p');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                overlay.remove();
            }, 500);
        }
    }

    /**
     * Create debug panel
     */
    createDebugPanel() {
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debug-panel';
        debugPanel.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 1000;
            background: rgba(0, 0, 0, 0.9);
            border-radius: 8px;
            padding: 16px;
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            max-width: 300px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(0, 255, 0, 0.3);
        `;
        
        debugPanel.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: #00ff00;">🔍 Debug Info</h4>
            <div id="debug-content">
                <div>Platform: <span id="debug-platform">-</span></div>
                <div>WebXR: <span id="debug-webxr">-</span></div>
                <div>FPS: <span id="debug-fps">-</span></div>
                <div>Memory: <span id="debug-memory">-</span></div>
            </div>
        `;
        
        document.body.appendChild(debugPanel);
        
        // Update debug info periodically
        setInterval(() => {
            this.updateDebugInfo();
        }, 1000);
    }

    /**
     * Update debug information
     */
    updateDebugInfo() {
        const platformEl = document.getElementById('debug-platform');
        const webxrEl = document.getElementById('debug-webxr');
        const fpsEl = document.getElementById('debug-fps');
        const memoryEl = document.getElementById('debug-memory');
        
        if (platformEl) platformEl.textContent = navigator.platform;
        if (webxrEl) webxrEl.textContent = navigator.xr ? 'Yes' : 'No';
        
        // FPS (approximate)
        if (fpsEl && window.AREngine) {
            fpsEl.textContent = Math.round(1 / window.AREngine.clock.getDelta()) || '-';
        }
        
        // Memory usage (if available)
        if (memoryEl && performance.memory) {
            const used = Math.round(performance.memory.usedJSHeapSize / 1048576);
            memoryEl.textContent = `${used}MB`;
        }
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        if (typeof performance !== 'undefined' && performance.mark) {
            performance.mark('ar-platform-init-start');
        }
    }

    /**
     * Show error message to user
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            background: #dc2626;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    /**
     * Get device capabilities
     */
    getCapabilities() {
        return {
            webxr: !!navigator.xr,
            webgl: this.hasWebGL(),
            camera: this.hasCamera(),
            gyroscope: this.hasGyroscope(),
            touch: 'ontouchstart' in window,
            fullscreen: document.fullscreenEnabled,
            devicePixelRatio: window.devicePixelRatio || 1
        };
    }

    /**
     * Device detection utilities
     */
    isMobile() {
        return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent);
    }

    isAndroid() {
        return /Android/.test(navigator.userAgent);
    }

    hasWebGL() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && canvas.getContext('webgl'));
        } catch (e) {
            return false;
        }
    }

    hasCamera() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    hasGyroscope() {
        return 'DeviceOrientationEvent' in window;
    }

    /**
     * Get initialization status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            dependencies: this.dependencies,
            config: this.config,
            capabilities: this.getCapabilities()
        };
    }

    /**
     * Clean up platform resources
     */
    dispose() {
        console.log('🧹 Disposing platform resources...');
        
        // Remove event listeners
        window.removeEventListener('orientationchange', this.handleOrientationChange);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Clean up DOM elements
        const elementsToRemove = ['loading-overlay', 'debug-panel'];
        elementsToRemove.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.remove();
        });
        
        this.isInitialized = false;
        console.log('✅ Platform resources disposed');
    }
}

// Auto-initialize if running in browser
if (typeof window !== 'undefined') {
    window.ARPlatform = ARPlatform;
}
