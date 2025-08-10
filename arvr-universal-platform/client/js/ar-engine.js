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
            // Continue with fallback mode instead of throwing
            await this.initializeFallbackMode();
        }
    }

    async checkWebXRSupport() {
        if (!navigator.xr) {
            console.log('❌ WebXR not supported - using fallback mode');
            return;
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

    async initializeFallbackMode() {
        console.log('🔄 Initializing fallback mode...');
        
        // Initialize Three.js
        this.setupThreeJS();
        
        // Create basic scene
        this.createScene();
        
        // Start render loop
        this.startRenderLoop();
        
        this.isInitialized = true;
        console.log('✅ AR/VR Engine initialized in fallback mode');
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
        
        // Enable XR if supported
        if (navigator.xr) {
            this.renderer.xr.enabled = true;
        }
        
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
        if (!navigator.xr) return;
        
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
        if (this.capabilities.ar && navigator.xr) {
            // Try real WebXR AR
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
                console.error('WebXR AR failed:', error);
                return this.startFallbackAR();
            }
        } else {
            // Use fallback AR
            return this.startFallbackAR();
        }
    }

    async startFallbackAR() {
        console.log('📱 Starting fallback AR mode...');
        
        this.sessionType = 'ar-fallback';
        
        // Try to get camera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            
            const video = document.createElement('video');
            video.srcObject = stream;
            video.autoplay = true;
            video.playsInline = true;
            video.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:-1';
            
            const arContainer = document.getElementById('ar-container');
            if (arContainer) {
                arContainer.insertBefore(video, arContainer.firstChild);
            }
            
            console.log('📷 Camera AR fallback active');
        } catch (error) {
            console.log('📷 Camera not available:', error.message);
        }
        
        // Position camera for AR view
        this.camera.position.set(0, 0, 0);
        
        // Hide ground for AR
        const ground = this.scene.getObjectByName('ground');
        if (ground) ground.visible = false;
        
        this.dispatchEvent(new CustomEvent('sessionStarted', { 
            detail: { type: 'ar-fallback', session: 'fallback' } 
        }));
        
        return 'ar-fallback-session';
    }

    async startVRSession() {
        if (this.capabilities.vr && navigator.xr) {
            // Try real WebXR VR
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
                console.error('WebXR VR failed:', error);
                return this.startFallbackVR();
            }
        } else {
            // Use fallback VR
            return this.startFallbackVR();
        }
    }

    async startFallbackVR() {
        console.log('🥽 Starting fallback VR mode...');
        
        this.sessionType = 'vr-fallback';
        
        // Enter fullscreen
        try {
            await document.documentElement.requestFullscreen();
        } catch (error) {
            console.log('Fullscreen not available:', error);
        }
        
        // Position for VR
        this.camera.position.set(0, 1.6, 3);
        this.camera.lookAt(0, 0, 0);
        
        // Show ground for VR
        const ground = this.scene.getObjectByName('ground');
        if (ground) ground.visible = true;
        
        this.dispatchEvent(new CustomEvent('sessionStarted', { 
            detail: { type: 'vr-fallback', session: 'fallback' } 
        }));
        
        return 'vr-fallback-session';
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
        if (this.xrSession && this.xrSession.enabledFeatures && this.xrSession.enabledFeatures.includes('plane-detection')) {
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
        const spatialUI = document.getElementById('spatial-ui');
        if (spatialUI) spatialUI.classList.remove('hidden');
        
        // Start tracking user position
        this.startUserTracking();
    }

    onXRSessionEnd() {
        this.sessionType = null;
        this.xrSession = null;
        this.hitTestSource = null;
        
        // Update UI
        const spatialUI = document.getElementById('spatial-ui');
        if (spatialUI) spatialUI.classList.add('hidden');
        
        // Reset buttons
        const arBtn = document.getElementById('ar-btn');
        const vrBtn = document.getElementById('vr-btn');
        const shareBtn = document.getElementById('share-space-btn');
        
        if (arBtn) arBtn.textContent = '📱 Start AR';
        if (vrBtn) vrBtn.textContent = '🥽 Start VR';
        if (shareBtn) shareBtn.classList.add('disabled');
    }

    startUserTracking() {
        // User position and rotation will be updated in render loop
        this.trackingEnabled = true;
    }

    startRenderLoop() {
        if (this.renderer.xr && this.renderer.xr.enabled && this.capabilities.ar) {
            this.renderer.setAnimationLoop((time, frame) => {
                this.render(time, frame);
            });
        } else {
            // Use regular animation loop
            const animate = () => {
                this.animationFrame = requestAnimationFrame(animate);
                this.render();
            };
            animate();
        }
    }

    render(time, frame) {
        const delta = this.clock.getDelta();
        
        if (frame && this.xrSession) {
            // XR rendering
            this.renderXR(time, frame);
        } else {
            // Regular rendering
            this.renderRegular(delta);
        }
        
        // Update animations
        this.updateAnimations(delta);
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    renderXR(time, frame) {
        const referenceSpace = this.renderer.xr.getReferenceSpace();
        const session = frame.session;
        
        if (referenceSpace) {
            // Get viewer pose
            const pose = frame.getViewerPose(referenceSpace);
            
            if (pose) {
                // Update user position
                const position = pose.transform.position;
                const orientation = pose.transform.orientation;
                
                this.userPosition.set(position.x, position.y, position.z);
                this.userRotation.set(orientation.x, orientation.y, orientation.z, orientation.w);
                
                // Emit position change event
                this.dispatchEvent(new CustomEvent('userPositionChanged', {
                    detail: {
                        position: this.userPosition.clone(),
                        rotation: this.userRotation.clone()
                    }
                }));
            }
        }
        
        // Handle hit testing in AR
        if (this.hitTestSource && frame.getHitTestResults) {
            const hitTestResults = frame.getHitTestResults(this.hitTestSource);
            this.processHitTestResults(hitTestResults);
        }
        
        // Handle hand tracking
        if (session.inputSources) {
            this.processHandTracking(frame, session.inputSources);
        }
        
        // Update detected planes
        if (session.worldInformation && session.worldInformation.detectedPlanes) {
            this.updateDetectedPlanes(session.worldInformation.detectedPlanes);
        }
    }

    renderRegular(delta) {
        // Non-XR rendering (preview mode)
        // Rotate camera around scene for demo
        if (!this.xrSession && this.sessionType !== 'ar-fallback' && this.sessionType !== 'vr-fallback') {
            const time = Date.now() * 0.0005;
            this.camera.position.x = Math.cos(time) * 3;
            this.camera.position.z = Math.sin(time) * 3;
            this.camera.position.y = 1.6;
            this.camera.lookAt(0, 1, 0);
        }
    }

    updateAnimations(delta) {
        // Update avatar animations
        this.avatars.forEach((avatar, userId) => {
            if (avatar.mixer) {
                avatar.mixer.update(delta);
            }
        });
        
        // Update floating objects
        this.virtualObjects.forEach((obj, id) => {
            if (obj.animation && obj.animation.type === 'float') {
                obj.mesh.position.y += Math.sin(Date.now() * 0.001 + obj.animation.offset) * 0.01;
            }
        });
    }

    processHitTestResults(hitTestResults) {
        if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const hitPose = hit.getPose(this.renderer.xr.getReferenceSpace());
            
            if (hitPose) {
                // Update reticle position (if we have one)
                const reticle = this.scene.getObjectByName('reticle');
                if (reticle) {
                    reticle.position.setFromMatrixPosition(new THREE.Matrix4().fromArray(hitPose.transform.matrix));
                    reticle.visible = true;
                }
                
                // Store hit position for object placement
                this.lastHitPosition = new THREE.Vector3().setFromMatrixPosition(
                    new THREE.Matrix4().fromArray(hitPose.transform.matrix)
                );
            }
        }
    }

    processHandTracking(frame, inputSources) {
        inputSources.forEach(inputSource => {
            if (inputSource.hand) {
                // Process hand joints
                const hand = inputSource.hand;
                const handMesh = this.getOrCreateHandMesh(inputSource.handedness);
                
                hand.forEach((joint, jointName) => {
                    const jointPose = frame.getJointPose(joint, this.renderer.xr.getReferenceSpace());
                    if (jointPose) {
                        // Update hand mesh based on joint positions
                        this.updateHandJoint(handMesh, jointName, jointPose);
                    }
                });
            }
        });
    }

    getOrCreateHandMesh(handedness) {
        const handName = `hand_${handedness}`;
        let handMesh = this.scene.getObjectByName(handName);
        
        if (!handMesh) {
            // Create hand visualization
            handMesh = this.createHandMesh(handedness);
            handMesh.name = handName;
            this.scene.add(handMesh);
        }
        
        return handMesh;
    }

    createHandMesh(handedness) {
        const handGroup = new THREE.Group();
        
        // Create simple hand representation with spheres for joints
        const jointGeometry = new THREE.SphereGeometry(0.01, 8, 8);
        const jointMaterial = new THREE.MeshBasicMaterial({ 
            color: handedness === 'left' ? 0xff6b6b : 0x4ecdc4 
        });
        
        // Hand joint names from WebXR spec
        const joints = [
            'wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
            'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 
            'index-finger-phalanx-distal', 'index-finger-tip',
            'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate',
            'middle-finger-phalanx-distal', 'middle-finger-tip',
            'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate',
            'ring-finger-phalanx-distal', 'ring-finger-tip',
            'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate',
            'pinky-finger-phalanx-distal', 'pinky-finger-tip'
        ];
        
        joints.forEach(jointName => {
            const jointMesh = new THREE.Mesh(jointGeometry, jointMaterial);
            jointMesh.name = jointName;
            jointMesh.visible = false;
            handGroup.add(jointMesh);
        });
        
        return handGroup;
    }

    updateHandJoint(handMesh, jointName, jointPose) {
        const jointMesh = handMesh.getObjectByName(jointName);
        if (jointMesh && jointPose) {
            const matrix = new THREE.Matrix4().fromArray(jointPose.transform.matrix);
            jointMesh.position.setFromMatrixPosition(matrix);
            jointMesh.quaternion.setFromRotationMatrix(matrix);
            jointMesh.visible = true;
        }
    }

    updateDetectedPlanes(detectedPlanes) {
        // Update or create plane visualizations
        detectedPlanes.forEach(plane => {
            const planeMesh = this.getOrCreatePlaneMesh(plane.id);
            this.updatePlaneMesh(planeMesh, plane);
        });
    }

    // Avatar Management
    addUserAvatar(userId, userData) {
        if (this.avatars.has(userId)) {
            this.removeUserAvatar(userId);
        }

        const avatar = this.createAvatar(userData);
        avatar.userData = { userId, ...userData };
        
        this.avatars.set(userId, avatar);
        this.scene.add(avatar.group);
        
        console.log(`👤 Added avatar for user: ${userId}`);
        
        this.dispatchEvent(new CustomEvent('avatarAdded', {
            detail: { userId, avatar }
        }));
    }

    removeUserAvatar(userId) {
        const avatar = this.avatars.get(userId);
        if (avatar) {
            this.scene.remove(avatar.group);
            this.avatars.delete(userId);
            console.log(`👋 Removed avatar for user: ${userId}`);
        }
    }

    createAvatar(userData) {
        const avatarGroup = new THREE.Group();
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const headMaterial = new THREE.MeshLambertMaterial({ 
            color: userData.avatarColor || 0x4ecdc4 
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.6;
        head.castShadow = true;
        avatarGroup.add(head);
        
        // Body
        const bodyGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: userData.avatarColor || 0x4ecdc4 
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.0;
        body.castShadow = true;
        avatarGroup.add(body);
        
        // Name label
        const nameLabel = this.createNameLabel(userData.name || 'User');
        nameLabel.position.y = 1.9;
        avatarGroup.add(nameLabel);
        
        // Audio indicator
        const audioIndicator = this.createAudioIndicator();
        audioIndicator.position.y = 1.4;
        audioIndicator.position.z = 0.2;
        avatarGroup.add(audioIndicator);
        
        return {
            group: avatarGroup,
            head,
            body,
            nameLabel,
            audioIndicator,
            mixer: null
        };
    }

    createNameLabel(name) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.fillStyle = 'white';
        context.font = '24px Arial';
        context.textAlign = 'center';
        context.fillText(name, canvas.width / 2, canvas.height / 2 + 8);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true 
        });
        
        const geometry = new THREE.PlaneGeometry(0.5, 0.125);
        const nameLabel = new THREE.Mesh(geometry, material);
        nameLabel.name = 'nameLabel';
        
        return nameLabel;
    }

    createAudioIndicator() {
        const geometry = new THREE.RingGeometry(0.02, 0.04, 8);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x10b981,
            transparent: true,
            opacity: 0
        });
        
        const indicator = new THREE.Mesh(geometry, material);
        indicator.name = 'audioIndicator';
        
        return indicator;
    }

    updateAvatarPosition(userId, position, rotation) {
        const avatar = this.avatars.get(userId);
        if (avatar) {
            avatar.group.position.copy(position);
            avatar.group.quaternion.copy(rotation);
            
            // Make name label face camera
            avatar.nameLabel.lookAt(this.camera.position);
        }
    }

    updateAvatarAudio(userId, isPlaying, volume = 0) {
        const avatar = this.avatars.get(userId);
        if (avatar && avatar.audioIndicator) {
            const material = avatar.audioIndicator.material;
            if (isPlaying) {
                material.opacity = volume;
                const scale = 1 + volume * 0.5;
                avatar.audioIndicator.scale.set(scale, scale, 1);
            } else {
                material.opacity = 0;
            }
        }
    }

    // Device Visualization
    addDeviceVisualization(device) {
        const deviceMesh = this.createDeviceMesh(device);
        deviceMesh.userData = device;
        
        this.devices.set(device.id, deviceMesh);
        this.scene.add(deviceMesh);
        
        console.log(`📱 Added device visualization: ${device.name}`);
    }

    createDeviceMesh(device) {
        const group = new THREE.Group();
        
        // Device icon based on type
        let geometry, material;
        
        switch (device.type) {
            case 'smartphone':
                geometry = new THREE.BoxGeometry(0.08, 0.15, 0.01);
                material = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
                break;
            case 'tv':
                geometry = new THREE.BoxGeometry(0.4, 0.25, 0.05);
                material = new THREE.MeshLambertMaterial({ color: 0x2d2d2d });
                break;
            case 'speaker':
                geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8);
                material = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
                break;
            default:
                geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
                material = new THREE.MeshLambertMaterial({ color: 0x6366f1 });
        }
        
        const deviceMesh = new THREE.Mesh(geometry, material);
        deviceMesh.castShadow = true;
        deviceMesh.receiveShadow = true;
        
        // Add device label
        const label = this.createNameLabel(device.name);
        label.position.y = 0.2;
        label.scale.set(0.5, 0.5, 0.5);
        
        group.add(deviceMesh);
        group.add(label);
        
        // Position device
        if (device.position) {
            group.position.copy(device.position);
        }
        
        return group;
    }

    updateDevicePosition(deviceId, position, rotation) {
        const device = this.devices.get(deviceId);
        if (device) {
            device.position.copy(position);
            if (rotation) {
                device.quaternion.copy(rotation);
            }
        }
    }

    removeDeviceVisualization(deviceId) {
        const device = this.devices.get(deviceId);
        if (device) {
            this.scene.remove(device);
            this.devices.delete(deviceId);
            console.log(`📱 Removed device visualization: ${deviceId}`);
        }
    }

    getOrCreatePlaneMesh(planeId) {
        const planeName = `plane_${planeId}`;
        let planeMesh = this.scene.getObjectByName(planeName);
        
        if (!planeMesh) {
            const geometry = new THREE.PlaneGeometry(1, 1);
            const material = new THREE.MeshBasicMaterial({
                color: 0x6366f1,
                transparent: true,
                opacity: 0.1,
                side: THREE.DoubleSide
            });
            
            planeMesh = new THREE.Mesh(geometry, material);
            planeMesh.name = planeName;
            this.scene.add(planeMesh);
        }
        
        return planeMesh;
    }

    updatePlaneMesh(planeMesh, plane) {
        if (plane.pose && plane.polygon) {
            // Update plane position and orientation
            const matrix = new THREE.Matrix4().fromArray(plane.pose.transform.matrix);
            planeMesh.position.setFromMatrixPosition(matrix);
            planeMesh.quaternion.setFromRotationMatrix(matrix);
            
            // Update plane geometry based on polygon
            const vertices = [];
            plane.polygon.forEach(point => {
                vertices.push(point.x, point.y, 0);
            });
            
            planeMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            planeMesh.geometry.computeBoundingBox();
        }
    }

    // Virtual Object Management
    addVirtualObject(id, objectData) {
        const obj = this.createVirtualObject(objectData);
        obj.userData = { id, ...objectData };
        
        this.virtualObjects.set(id, obj);
        this.scene.add(obj.mesh);
        
        console.log(`🎯 Added virtual object: ${id}`);
        
        this.dispatchEvent(new CustomEvent('objectAdded', {
            detail: { id, object: obj }
        }));
    }

    createVirtualObject(objectData) {
        let geometry, material;
        
        switch (objectData.type) {
            case 'cube':
                geometry = new THREE.BoxGeometry(
                    objectData.size || 0.2,
                    objectData.size || 0.2,
                    objectData.size || 0.2
                );
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(objectData.radius || 0.1, 16, 16);
                break;
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(
                    objectData.radius || 0.1,
                    objectData.radius || 0.1,
                    objectData.height || 0.2,
                    16
                );
                break;
            case 'text':
                return this.createTextObject(objectData);
            default:
                geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        }
        
        material = new THREE.MeshLambertMaterial({
            color: objectData.color || 0x6366f1,
            transparent: objectData.opacity !== undefined,
            opacity: objectData.opacity || 1
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Set position
        if (objectData.position) {
            mesh.position.copy(objectData.position);
        }
        
        // Set rotation
        if (objectData.rotation) {
            mesh.rotation.copy(objectData.rotation);
        }
        
        return {
            mesh,
            animation: objectData.animation || null
        };
    }

    createTextObject(objectData) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        const fontSize = objectData.fontSize || 32;
        const text = objectData.text || 'Text';
        
        context.font = `${fontSize}px Arial`;
        const textWidth = context.measureText(text).width;
        
        canvas.width = Math.max(textWidth + 20, 256);
        canvas.height = fontSize + 20;
        
        // Background
        context.fillStyle = objectData.backgroundColor || 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Text
        context.fillStyle = objectData.textColor || 'white';
        context.font = `${fontSize}px Arial`;
        context.textAlign = 'center';
        context.fillText(text, canvas.width / 2, fontSize + 5);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true
        });
        
        const geometry = new THREE.PlaneGeometry(
            canvas.width / 200,
            canvas.height / 200
        );
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Set position
        if (objectData.position) {
            mesh.position.copy(objectData.position);
        }
        
        return {
            mesh,
            animation: objectData.animation || null
        };
    }

    updateVirtualObjectPosition(id, position, rotation) {
        const obj = this.virtualObjects.get(id);
        if (obj) {
            obj.mesh.position.copy(position);
            if (rotation) {
                obj.mesh.quaternion.copy(rotation);
            }
        }
    }

    removeVirtualObject(id) {
        const obj = this.virtualObjects.get(id);
        if (obj) {
            this.scene.remove(obj.mesh);
            this.virtualObjects.delete(id);
            console.log(`🎯 Removed virtual object: ${id}`);
        }
    }

    // Session Management
    async endSession() {
        if (this.xrSession) {
            await this.xrSession.end();
        } else {
            // Handle fallback session end
            this.onXRSessionEnd();
            
            // Stop camera stream if active
            const video = document.querySelector('video');
            if (video && video.srcObject) {
                const tracks = video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                video.remove();
            }
            
            // Exit fullscreen
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }
        
        console.log('🛑 Session ended');
    }

    // Utility Methods
    getSessionInfo() {
        return {
            type: this.sessionType,
            isActive: !!this.xrSession || this.sessionType?.includes('fallback'),
            capabilities: this.capabilities,
            userPosition: this.userPosition.clone(),
            userRotation: this.userRotation.clone(),
            avatarCount: this.avatars.size,
            deviceCount: this.devices.size,
            objectCount: this.virtualObjects.size
        };
    }

    toggleDebugMode(enabled) {
        const axes = this.scene.getObjectByName('axes');
        if (axes) axes.visible = enabled;
        
        console.log(`🔍 Debug mode: ${enabled ? 'ON' : 'OFF'}`);
    }

    captureScreenshot() {
        return new Promise((resolve) => {
            this.renderer.domElement.toBlob((blob) => {
                resolve(blob);
            });
        });
    }

    // Cleanup
    dispose() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        if (this.xrSession) {
            this.xrSession.end();
        }
        
        // Clean up Three.js objects
        this.scene?.clear();
        this.renderer?.dispose();
        
        // Clear maps
        this.avatars.clear();
        this.devices.clear();
        this.virtualObjects.clear();
        
        console.log('🧹 AR/VR Engine disposed');
    }
}
