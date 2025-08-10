// ar-engine.js - AR/VR Core Engine using WebXR and Three.js

export class AREngine extends EventTarget {
    constructor() {
        super();
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.session = null;
        this.sessionType = null;
        this.referenceSpace = null;
        
        // XR specific
        this.xrSession = null;
        this.gl = null;
        this.xrManager = null;
        
        // Scene objects
        this.avatars = new Map();
        this.devices = new Map();
        this.virtualObjects = new Map();
        
        // Tracking
        this.userPosition = new THREE.Vector3();
        this.userRotation = new THREE.Quaternion();
        this.hitTestSource = null;
        
        // Animation
        this.clock = new THREE.Clock();
        this.animationFrame = null;
        
        // Capabilities
        this.capabilities = {
            ar: false,
            vr: false,
            handTracking: false,
            eyeTracking: false,
            hitTest: false,
            planeDetection: false
        };
        
        this.isInitialized = false;
    }

    async init() {
        console.log('🔧 Initializing AR/VR Engine...');
        
        try {
            // Check WebXR support
            await this.checkWebXRSupport();
            
            // Initialize Three.js
            this.setupThreeJS();
            
            // Setup XR
            await this.setupWebXR();
            
            // Create basic scene
            this.createScene();
            
            // Start render loop
            this.startRenderLoop();
            
            this.isInitialized = true;
            console.log('✅ AR/VR Engine initialized');
            
        } catch (error) {
            console.error('❌ AR/VR Engine initialization failed:', error);
            throw error;
        }
    }

    async checkWebXRSupport() {
        if (!navigator.xr) {
            throw new Error('WebXR not supported');
        }

        // Check for AR support
        try {
            this.capabilities.ar = await navigator.xr.isSessionSupported('immersive-ar');
            console.log('📱 AR support:', this.capabilities.ar);
        } catch (e) {
            console.log('📱 AR not supported');
        }

        // Check for VR support
        try {
            this.capabilities.vr = await navigator.xr.isSessionSupported('immersive-vr');
            console.log('🥽 VR support:', this.capabilities.vr);
        } catch (e) {
            console.log('🥽 VR not supported');
        }

        if (!this.capabilities.ar && !this.capabilities.vr) {
            throw new Error('No WebXR sessions supported');
        }

        // Check additional features
        try {
            this.capabilities.handTracking = await navigator.xr.isSessionSupported('immersive-ar', {
                requiredFeatures: ['hand-tracking']
            });
        } catch (e) {
            console.log('👐 Hand tracking not supported');
        }

        // Check hit testing
        try {
            this.capabilities.hitTest = await navigator.xr.isSessionSupported('immersive-ar', {
                requiredFeatures: ['hit-test']
            });
        } catch (e) {
            console.log('🎯 Hit testing not supported');
        }
    }

    setupThreeJS() {
        // Create scene
        this.scene = new THREE.Scene();
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        
        // Create renderer
        const canvas = document.getElementById('ar-canvas');
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.xr.enabled = true;
        
        // Configure renderer for XR
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        // Handle resize
        window.addEventListener('resize', () => {
            if (!this.xrSession) {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            }
        });
    }

    async setupWebXR() {
        this.xrManager = this.renderer.xr;
        
        // Setup XR manager events
        this.xrManager.addEventListener('sessionstart', () => {
            console.log('🎬 XR Session started');
            this.onXRSessionStart();
        });
        
        this.xrManager.addEventListener('sessionend', () => {
            console.log('🛑 XR Session ended');
            this.onXRSessionEnd();
        });
    }

    createScene() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // Add ground plane (for VR mode)
        this.createGroundPlane();
        
        // Add reference objects
        this.createReferenceObjects();
    }

    createGroundPlane() {
        const geometry = new THREE.PlaneGeometry(20, 20);
        const material = new THREE.MeshLambertMaterial({ 
            color: 0x1a1a2e, 
            transparent: true, 
            opacity: 0.8 
        });
        
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.visible = false; // Hidden in AR, visible in VR
        ground.name = 'ground';
        
        this.scene.add(ground);
    }

    createReferenceObjects() {
        // Create coordinate system helper (for debugging)
        const axesHelper = new THREE.AxesHelper(0.5);
        axesHelper.visible = false;
        axesHelper.name = 'axes';
        this.scene.add(axesHelper);
        
        // Create room boundary indicators
        this.createRoomBoundaries();
    }

    createRoomBoundaries() {
        const geometry = new THREE.RingGeometry(1.8, 2, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x6366f1,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        const boundary = new THREE.Mesh(geometry, material);
        boundary.rotation.x = -Math.PI / 2;
        boundary.position.y = -0.01;
        boundary.visible = false;
        boundary.name = 'boundary';
        
        this.scene.add(boundary);
    }

    async startARSession() {
        if (!this.capabilities.ar) {
            throw new Error('AR not supported');
        }

        try {
            const sessionInit = {
                requiredFeatures: ['local'],
                optionalFeatures: ['hand-tracking', 'hit-test', 'plane-detection']
            };

            this.xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
            this.sessionType = 'ar';
            
            await this.xrManager.setSession(this.xrSession);
            
            // Setup AR-specific features
            await this.setupARFeatures();
            
            this.dispatchEvent(new CustomEvent('sessionStarted', { 
                detail: { type: 'ar', session: this.xrSession } 
            }));
            
            return this.xrSession;
            
        } catch (error) {
            console.error('Failed to start AR session:', error);
            throw error;
        }
    }

    async startVRSession() {
        if (!this.capabilities.vr) {
            throw new Error('VR not supported');
        }

        try {
            const sessionInit = {
                requiredFeatures: ['local'],
                optionalFeatures: ['hand-tracking', 'eye-tracking']
            };

            this.xrSession = await navigator.xr.requestSession('immersive-vr', sessionInit);
            this.sessionType = 'vr';
            
            await this.xrManager.setSession(this.xrSession);
            
            // Setup VR-specific features
            this.setupVRFeatures();
            
            this.dispatchEvent(new CustomEvent('sessionStarted', { 
                detail: { type: 'vr', session: this.xrSession } 
            }));
            
            return this.xrSession;
            
        } catch (error) {
            console.error('Failed to start VR session:', error);
            throw error;
        }
    }

    async setupARFeatures() {
        // Show room boundaries in AR
        const boundary = this.scene.getObjectByName('boundary');
        if (boundary) boundary.visible = true;
        
        // Hide ground plane in AR
        const ground = this.scene.getObjectByName('ground');
        if (ground) ground.visible = false;
        
        // Setup hit testing if supported
        if (this.capabilities.hitTest) {
            await this.setupHitTesting();
        }
        
        // Setup plane detection
        if (this.xrSession.enabledFeatures.includes('plane-detection')) {
            this.setupPlaneDetection();
        }
    }

    setupVRFeatures() {
        // Hide room boundaries in VR
        const boundary = this.scene.getObjectByName('boundary');
        if (boundary) boundary.visible = false;
        
        // Show ground plane in VR
        const ground = this.scene.getObjectByName('ground');
        if (ground) ground.visible = true;
        
        // Position user above ground
        this.camera.position.set(0, 1.6, 0);
    }

    async setupHitTesting() {
        try {
            this.hitTestSource = await this.xrSession.requestHitTestSource({ space: 'viewer' });
            console.log('🎯 Hit testing enabled');
        } catch (error) {
            console.log('Hit test setup failed:', error);
        }
    }

    setupPlaneDetection() {
        console.log('🏠 Plane detection enabled');
        // Plane detection logic will be handled in render loop
    }

    onXRSessionStart() {
        // Update UI
        document.getElementById('spatial-ui').classList.remove('hidden');
        
        // Start tracking user position
        this.startUserTracking();
    }

    onXRSessionEnd() {
        this.sessionType = null;
        this.xrSession = null;
        this.hitTestSource = null;
        
        // Update UI
        document.getElementById('spatial-ui').classList.add('hidden');
        
        // Reset buttons
        document.getElementById('ar-btn').textContent = '📱 Start AR';
        document.getElementById('vr-btn').textContent = '🥽 Start VR';
        document.getElementById('share-space-btn').classList.add('disabled');
    }

    startUserTracking() {
        // User
