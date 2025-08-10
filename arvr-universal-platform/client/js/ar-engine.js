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
        this.renderer.setAnimationLoop((time, frame) => {
            this.render(time, frame);
        });
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
        if (!this.xrSession) {
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
        
        // Position device in room
        this.positionDeviceInRoom(group, device);
        
        return group;
    }

    positionDeviceInRoom(deviceMesh, device) {
        // Position devices around room perimeter
        const angle = Math.random() * Math.PI * 2;
        const radius = 1.5;
        
        deviceMesh.position.x = Math.cos(angle) * radius;
        deviceMesh.position.z = Math.sin(angle) * radius;
        deviceMesh.position.y = Math.random() * 0.5 + 0.5; // Random height
        
        deviceMesh.lookAt(0, deviceMesh.position.y, 0);
    }

    // Virtual Object Management
    addVirtualObject(id, objectData) {
        const obj = this.createVirtualObject(objectData);
        this.virtualObjects.set(id, obj);
        this.scene.add(obj.mesh);
        
        return obj;
    }

    createVirtualObject(data) {
        const { type, position, color, animation } = data;
        
        let geometry, material;
        
        switch (type) {
            case 'cube':
                geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(0.1, 16, 16);
                break;
            default:
                geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        }
        
        material = new THREE.MeshLambertMaterial({ 
            color: color || 0x6366f1 
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.fromArray(position || [0, 1, 0]);
        mesh.castShadow = true;
        
        return {
            mesh,
            animation: animation || null
        };
    }

    // Space Sharing
    async captureSpaceData() {
        const spaceData = {
            avatars: [],
            devices: [],
            virtualObjects: [],
            userPosition: this.userPosition.toArray(),
            userRotation: this.userRotation.toArray(),
            timestamp: Date.now()
        };
        
        // Capture avatar positions
        this.avatars.forEach((avatar, userId) => {
            spaceData.avatars.push({
                userId,
                position: avatar.group.position.toArray(),
                rotation: avatar.group.quaternion.toArray()
            });
        });
        
        // Capture device positions
        this.devices.forEach((device, deviceId) => {
            spaceData.devices.push({
                deviceId,
                position: device.position.toArray(),
                rotation: device.quaternion.toArray(),
                userData: device.userData
            });
        });
        
        // Capture virtual objects
        this.virtualObjects.forEach((obj, objId) => {
            spaceData.virtualObjects.push({
                objId,
                position: obj.mesh.position.toArray(),
                rotation: obj.mesh.quaternion.toArray(),
                scale: obj.mesh.scale.toArray()
            });
        });
        
        return spaceData;
    }

    loadSharedSpace(spaceData) {
        console.log('🌍 Loading shared space data:', spaceData);
        
        // Update remote avatars
        spaceData.avatars.forEach(avatarData => {
            const avatar = this.avatars.get(avatarData.userId);
            if (avatar) {
                avatar.group.position.fromArray(avatarData.position);
                avatar.group.quaternion.fromArray(avatarData.rotation);
            }
        });
        
        // Update devices
        spaceData.devices.forEach(deviceData => {
            const device = this.devices.get(deviceData.deviceId);
            if (device) {
                device.position.fromArray(deviceData.position);
                device.quaternion.fromArray(deviceData.rotation);
            }
        });
        
        // Update virtual objects
        spaceData.virtualObjects.forEach(objData => {
            const obj = this.virtualObjects.get(objData.objId);
            if (obj) {
                obj.mesh.position.fromArray(objData.position);
                obj.mesh.quaternion.fromArray(objData.rotation);
                obj.mesh.scale.fromArray(objData.scale);
            }
        });
    }

    // Camera Controls
    enableCamera() {
        // Implementation depends on AR/VR session
        console.log('📹 Camera enabled');
    }

    disableCamera() {
        console.log('📷 Camera disabled');
    }

    // Helper methods for plane detection
    getOrCreatePlaneMesh(planeId) {
        let planeMesh = this.scene.getObjectByName(`plane_${planeId}`);
        
        if (!planeMesh) {
            const geometry = new THREE.PlaneGeometry(1, 1);
            const material = new THREE.MeshBasicMaterial({
                color: 0x6366f1,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide
            });
            
            planeMesh = new THREE.Mesh(geometry, material);
            planeMesh.name = `plane_${planeId}`;
            this.scene.add(planeMesh);
        }
        
        return planeMesh;
    }

    updatePlaneMesh(planeMesh, plane) {
        // Update plane mesh based on detected plane data
        if (plane.polygon && plane.polygon.length > 0) {
            planeMesh.visible = true;
            // Update plane geometry and position based on plane data
            // This would need actual plane detection data from WebXR
        }
    }

    // Cleanup
    destroy() {
        if (this.xrSession) {
            this.xrSession.end();
        }
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        // Clean up Three.js objects
        this.scene.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        
        console.log('🧹 AR/VR Engine cleaned up');
    }
}
