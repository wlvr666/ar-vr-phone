import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

class AREngine {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.xrSession = null;
    this.xrReferenceSpace = null;
    this.frameRequestId = null;
    
    // AR/VR state
    this.isXRActive = false;
    this.currentMode = null; // 'ar' or 'vr'
    this.controllers = [];
    this.trackedObjects = new Map();
    this.spatialMeshes = new Map();
    
    // Room and collaboration
    this.roomId = null;
    this.userObjects = new Map();
    this.sharedObjects = new Map();
    this.environmentMesh = null;
    
    // Event system
    this.eventHandlers = new Map();
    
    this.init();
  }

  async init() {
    console.log('Initializing AR/VR Engine...');
    
    // Create Three.js scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Create renderer with XR support
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      preserveDrawingBuffer: true 
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.xr.enabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add renderer to DOM
    const container = document.getElementById('ar-container') || document.body;
    container.appendChild(this.renderer.domElement);
    
    // Setup lighting
    this.setupLighting();
    
    // Setup input handlers
    this.setupInputHandlers();
    
    // Check XR support
    await this.checkXRSupport();
    
    // Start render loop
    this.startRenderLoop();
    
    console.log('AR/VR Engine initialized');
  }

  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
    
    // Point light for AR
    const pointLight = new THREE.PointLight(0xffffff, 0.4, 100);
    pointLight.position.set(0, 2, 0);
    this.scene.add(pointLight);
  }

  setupInputHandlers() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Touch/mouse handlers for non-XR interaction
    this.renderer.domElement.addEventListener('click', (event) => {
      this.handleClick(event);
    });
    
    // Gesture recognition
    this.setupGestureRecognition();
  }

  async checkXRSupport() {
    if ('xr' in navigator) {
      try {
        const arSupported = await navigator.xr.isSessionSupported('immersive-ar');
        const vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
        
        console.log('XR Support:', { ar: arSupported, vr: vrSupported });
        
        this.emit('xr-support-checked', { ar: arSupported, vr: vrSupported });
        return { ar: arSupported, vr: vrSupported };
      } catch (error) {
        console.error('XR support check failed:', error);
        return { ar: false, vr: false };
      }
    } else {
      console.log('WebXR not supported');
      return { ar: false, vr: false };
    }
  }

  async startSession(mode = 'immersive-ar') {
    try {
      console.log(`Starting ${mode} session...`);
      
      const sessionInit = {};
      
      if (mode === 'immersive-ar') {
        sessionInit.requiredFeatures = ['local'];
        sessionInit.optionalFeatures = [
          'dom-overlay', 
          'hit-test', 
          'hand-tracking', 
          'plane-detection',
          'mesh-detection',
          'light-estimation'
        ];
        sessionInit.domOverlay = { root: document.body };
        this.currentMode = 'ar';
      } else if (mode === 'immersive-vr') {
        sessionInit.optionalFeatures = [
          'local-floor', 
          'bounded-floor',
          'hand-tracking',
          'eye-tracking'
        ];
        this.currentMode = 'vr';
      }
      
      this.xrSession = await navigator.xr.requestSession(mode, sessionInit);
      this.isXRActive = true;
      
      // Setup reference space
      this.xrReferenceSpace = await this.xrSession.requestReferenceSpace('local');
      
      // Setup session event handlers
      this.xrSession.addEventListener('end', () => {
        this.handleSessionEnd();
      });
      
      // Enable XR rendering
      await this.renderer.xr.setSession(this.xrSession);
      
      // Setup controllers if VR
      if (mode === 'immersive-vr') {
        this.setupControllers();
      }
      
      // Setup hand tracking
      this.setupHandTracking();
      
      console.log(`${mode} session started successfully`);
      this.emit('session-started', { mode });
      
      return this.xrSession;
    } catch (error) {
      console.error(`Failed to start ${mode} session:`, error);
      throw error;
    }
  }

  setupControllers() {
    // Setup VR controllers
    const controller1 = this.renderer.xr.getController(0);
    const controller2 = this.renderer.xr.getController(1);
    
    controller1.addEventListener('selectstart', (event) => this.handleControllerSelect(event, 0));
    controller2.addEventListener('selectstart', (event) => this.handleControllerSelect(event, 1));
    
    // Add controller models
    const controllerModelFactory = new THREE.XRControllerModelFactory();
    
    const controllerGrip1 = this.renderer.xr.getControllerGrip(0);
    controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
    
    const controllerGrip2 = this.renderer.xr.getControllerGrip(1);
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
    
    this.scene.add(controller1);
    this.scene.add(controller2);
    this.scene.add(controllerGrip1);
    this.scene.add(controllerGrip2);
    
    this.controllers = [controller1, controller2];
  }

  setupHandTracking() {
    // Hand tracking implementation
    if (this.xrSession?.inputSources) {
      for (const inputSource of this.xrSession.inputSources) {
        if (inputSource.hand) {
          console.log('Hand tracking available');
          this.emit('hand-tracking-available');
        }
      }
    }
  }

  setupGestureRecognition() {
    // Basic gesture recognition for AR
    let gestureStart = null;
    let gestureEnd = null;
    
    this.renderer.domElement.addEventListener('touchstart', (event) => {
      if (event.touches.length === 1) {
        gestureStart = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
          time: Date.now()
        };
      }
    });
    
    this.renderer.domElement.addEventListener('touchend', (event) => {
      if (gestureStart && event.changedTouches.length === 1) {
        gestureEnd = {
          x: event.changedTouches[0].clientX,
          y: event.changedTouches[0].clientY,
          time: Date.now()
        };
        
        this.processGesture(gestureStart, gestureEnd);
        gestureStart = null;
        gestureEnd = null;
      }
    });
  }

  processGesture(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dt = end.time - start.time;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (dt < 500 && distance < 30) {
      // Tap gesture
      this.emit('gesture-tap', { x: end.x, y: end.y });
    } else if (distance > 50) {
      // Swipe gesture
      const angle = Math.atan2(dy, dx);
      this.emit('gesture-swipe', { angle, distance, duration: dt });
    }
  }

  handleClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    
    const intersects = raycaster.intersectObjects(this.scene.children, true);
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      this.handleObjectInteraction(intersect.object, intersect.point);
    }
  }

  handleControllerSelect(event, controllerIndex) {
    const controller = this.controllers[controllerIndex];
    
    // Raycast from controller
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    
    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    
    const intersects = raycaster.intersectObjects(this.scene.children, true);
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      this.handleObjectInteraction(intersect.object, intersect.point, controllerIndex);
    }
  }

  handleObjectInteraction(object, point, controllerIndex = null) {
    console.log('Object interaction:', object, point);
    
    // Check if it's a shared object
    const objectId = object.userData?.id;
    if (objectId && this.sharedObjects.has(objectId)) {
      this.emit('object-interaction', {
        objectId,
        point,
        controllerIndex,
        userId: this.getCurrentUserId()
      });
    }
  }

  // Room management
  async setupRoom(roomId, roomData = {}) {
    this.roomId = roomId;
    console.log(`Setting up room: ${roomId}`);
    
    // Load room environment
    if (roomData.environment) {
      await this.loadEnvironment(roomData.environment);
    }
    
    // Setup collaboration
    this.setupCollaboration();
    
    this.emit('room-setup-complete', { roomId });
  }

  async loadEnvironment(environmentData) {
    // Load 3D environment from data
    if (environmentData.meshes) {
      for (const meshData of environmentData.meshes) {
        const mesh = await this.createMeshFromData(meshData);
        this.scene.add(mesh);
        this.spatialMeshes.set(meshData.id, mesh);
      }
    }
  }

  setupCollaboration() {
    // Setup real-time collaboration features
    this.emit('collaboration-ready');
  }

  // Object management
  addUserAvatar(userId, position = [0, 0, 0], rotation = [0, 0, 0]) {
    // Create avatar representation
    const avatarGeometry = new THREE.CapsuleGeometry(0.3, 1.6, 4, 8);
    const avatarMaterial = new THREE.MeshLambertMaterial({ 
      color: this.getUserColor(userId),
      transparent: true,
      opacity: 0.8
    });
    
    const avatar = new THREE.Mesh(avatarGeometry, avatarMaterial);
    avatar.position.set(...position);
    avatar.rotation.set(...rotation);
    avatar.castShadow = true;
    avatar.userData = { type: 'avatar', userId };
    
    this.scene.add(avatar);
    this.userObjects.set(userId, avatar);
    
    return avatar;
  }

  updateUserPosition(userId, position, rotation) {
    const userObject = this.userObjects.get(userId);
    if (userObject) {
      userObject.position.set(...position);
      userObject.rotation.set(...rotation);
    }
  }

  spawnObject(objectData) {
    const { id, type, position, rotation, scale, properties } = objectData;
    
    let geometry, material, mesh;
    
    switch (type) {
      case 'cube':
        geometry = new THREE.BoxGeometry(1, 1, 1);
        material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(0.5, 32, 32);
        material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        break;
      case 'plane':
        geometry = new THREE.PlaneGeometry(2, 2);
        material = new THREE.MeshLambertMaterial({ color: 0x0000ff });
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
        material = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    }
    
    mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { id, type, properties };
    
    this.scene.add(mesh);
    this.sharedObjects.set(id, mesh);
    
    return mesh;
  }

  removeObject(objectId) {
    const object = this.sharedObjects.get(objectId);
    if (object) {
      this.scene.remove(object);
      this.sharedObjects.delete(objectId);
    }
  }

  // Utility methods
  getUserColor(userId) {
    // Generate consistent color from user ID
    const hash = this.hashCode(userId);
    return new THREE.Color().setHSL((hash % 360) / 360, 0.7, 0.6);
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  getCurrentUserId() {
    // This would be set by the main application
    return window.currentUserId || 'anonymous';
  }

  startRenderLoop() {
    const render = () => {
      this.frameRequestId = requestAnimationFrame(render);
      
      // Update tracked objects
      this.updateTrackedObjects();
      
      // Render scene
      this.renderer.render(this.scene, this.camera);
      
      // Emit render event for external systems
      this.emit('render', { timestamp: Date.now() });
    };
    
    this.renderer.setAnimationLoop(render);
  }

  updateTrackedObjects() {
    // Update any tracked objects, animations, etc.
    for (const [id, object] of this.trackedObjects) {
      // Update object based on tracking data
      if (object.userData.trackingCallback) {
        object.userData.trackingCallback(object);
      }
    }
  }

  handleSessionEnd() {
    console.log('XR session ended');
    this.isXRActive = false;
    this.xrSession = null;
    this.currentMode = null;
    
    this.emit('session-ended');
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
      handlers.forEach(handler => handler(data));
    }
