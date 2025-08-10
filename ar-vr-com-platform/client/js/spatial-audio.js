/**
 * Spatial Audio System for AR/VR Communication Platform
 * Handles 3D positional audio and real-time audio processing
 */
export class SpatialAudio {
  constructor() {
    // Audio context
    this.audioContext = null;
    this.masterGain = null;
    
    // Spatial audio components
    this.listener = null;
    this.audioSources = new Map();
    this.audioStreams = new Map();
    
    // Audio processing nodes
    this.processingNodes = new Map();
    this.effectsChain = new Map();
    
    // Room acoustics
    this.roomImpulseResponse = null;
    this.convolver = null;
    this.environmentSettings = {
      roomSize: 'medium',
      reverbLevel: 0.3,
      dampening: 0.5,
      reflections: true,
      occlusion: true
    };
    
    // User settings
    this.userSettings = {
      masterVolume: 1.0,
      spatialEnabled: true,
      hrtfEnabled: true,
      roomEffectsEnabled: true,
      voiceEnhancement: true,
      noiseReduction: true,
      echoSuppression: true
    };
    
    // Listener position and orientation
    this.listenerPosition = { x: 0, y: 0, z: 0 };
    this.listenerOrientation = {
      forward: { x: 0, y: 0, z: -1 },
      up: { x: 0, y: 1, z: 0 }
    };
    
    // Audio streams management
    this.localStream = null;
    this.remoteStreams = new Map();
    
    // Configuration
    this.config = {
      sampleRate: 48000,
      bufferSize: 256,
      maxDistance: 50,
      rolloffFactor: 1,
      dopplerFactor: 1,
      speedOfSound: 343.3,
      panningModel: 'HRTF',
      distanceModel: 'inverse',
      
      // Audio quality settings
      audioConstraints: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2
      }
    };
    
    // Event handlers
    this.eventHandlers = new Map();
    
    // Performance monitoring
    this.stats = {
      activeSources: 0,
      processingLatency: 0,
      bufferUnderruns: 0,
      totalAudioTime: 0
    };
    
    this.init();
  }

  async init() {
    try {
      console.log('🎵 Initializing Spatial Audio System...');
      
      // Initialize Web Audio API
      await this.initializeAudioContext();
      
      // Setup spatial audio components
      await this.setupSpatialAudio();
      
      // Load impulse responses for room effects
      await this.loadImpulseResponses();
      
      // Setup audio processing chain
      this.setupAudioProcessing();
      
      // Initialize microphone access
      await this.initializeMicrophone();
      
      console.log('✅ Spatial Audio System initialized');
      
    } catch (error) {
      console.error('❌ Spatial Audio initialization failed:', error);
      throw error;
    }
  }

  async initializeAudioContext() {
    try {
      // Create audio context with optimal settings
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      
      this.audioContext = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: this.config.sampleRate
      });
      
      // Handle audio context state changes
      this.audioContext.addEventListener('statechange', () => {
        console.log(`🎵 Audio context state: ${this.audioContext.state}`);
        this.emit('context-state-changed', this.audioContext.state);
      });
      
      // Resume audio context if suspended (required by browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Create master gain node
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.userSettings.masterVolume;
      this.masterGain.connect(this.audioContext.destination);
      
      console.log('🎵 Audio context initialized');
      
    } catch (error) {
      console.error('Audio context initialization failed:', error);
      throw error;
    }
  }

  async setupSpatialAudio() {
    try {
      // Get audio listener
      this.listener = this.audioContext.listener;
      
      // Set initial listener position and orientation
      this.updateListenerPosition(
        this.listenerPosition.x,
        this.listenerPosition.y,
        this.listenerPosition.z
      );
      
      this.updateListenerOrientation(
        this.listenerOrientation.forward.x,
        this.listenerOrientation.forward.y,
        this.listenerOrientation.forward.z,
        this.listenerOrientation.up.x,
        this.listenerOrientation.up.y,
        this.listenerOrientation.up.z
      );
      
      console.log('🎵 Spatial audio components setup complete');
      
    } catch (error) {
      console.error('Spatial audio setup failed:', error);
      throw error;
    }
  }

  async loadImpulseResponses() {
    try {
      // Load room impulse responses for convolution reverb
      const impulseResponses = {
        small: '/assets/sounds/ir_small_room.wav',
        medium: '/assets/sounds/ir_medium_room.wav',
        large: '/assets/sounds/ir_large_room.wav',
        hall: '/assets/sounds/ir_concert_hall.wav',
        outdoor: '/assets/sounds/ir_outdoor.wav'
      };
      
      // Create convolver for room effects
      this.convolver = this.audioContext.createConvolver();
      
      // Load default impulse response
      await this.loadImpulseResponse(impulseResponses[this.environmentSettings.roomSize]);
      
      console.log('🎵 Impulse responses loaded');
      
    } catch (error) {
      console.warn('Could not load impulse responses:', error);
      // Continue without room effects
    }
  }

  async loadImpulseResponse(url) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.convolver.buffer = audioBuffer;
      this.roomImpulseResponse = audioBuffer;
      
    } catch (error) {
      console.warn(`Could not load impulse response from ${url}:`, error);
    }
  }

  setupAudioProcessing() {
    // Create processing nodes for audio enhancement
    this.processingNodes.set('compressor', this.createCompressor());
    this.processingNodes.set('limiter', this.createLimiter());
    this.processingNodes.set('equalizer', this.createEqualizer());
    
    console.log('🎵 Audio processing chain setup complete');
  }

  createCompressor() {
    const compressor = this.audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    
    return compressor;
  }

  createLimiter() {
    const limiter = this.audioContext.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.01;
    
    return limiter;
  }

  createEqualizer() {
    // Create multi-band equalizer
    const eq = {
      lowShelf: this.audioContext.createBiquadFilter(),
      midPeaking: this.audioContext.createBiquadFilter(),
      highShelf: this.audioContext.createBiquadFilter()
    };
    
    // Configure EQ bands
    eq.lowShelf.type = 'lowshelf';
    eq.lowShelf.frequency.value = 320;
    eq.lowShelf.gain.value = 0;
    
    eq.midPeaking.type = 'peaking';
    eq.midPeaking.frequency.value = 1000;
    eq.midPeaking.Q.value = 1;
    eq.midPeaking.gain.value = 0;
    
    eq.highShelf.type = 'highshelf';
    eq.highShelf.frequency.value = 3200;
    eq.highShelf.gain.value = 0;
    
    // Chain EQ bands
    eq.lowShelf.connect(eq.midPeaking);
    eq.midPeaking.connect(eq.highShelf);
    
    return eq;
  }

  async initializeMicrophone() {
    try {
      // Request microphone access
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: this.config.audioConstraints,
        video: false
      });
      
      // Create source node from microphone
      const micSource = this.audioContext.createMediaStreamSource(this.localStream);
      
      // Apply processing to microphone input
      const processedMicGain = this.audioContext.createGain();
      processedMicGain.gain.value = 0.8;
      
      // Connect microphone through processing chain
      micSource.connect(this.processingNodes.get('compressor'));
      this.processingNodes.get('compressor').connect(processedMicGain);
      
      // Store processed microphone stream
      this.processingNodes.set('microphoneSource', micSource);
      this.processingNodes.set('microphoneGain', processedMicGain);
      
      console.log('🎤 Microphone initialized');
      
      this.emit('microphone-initialized', { stream: this.localStream });
      
    } catch (error) {
      console.error('Microphone initialization failed:', error);
      this.emit('microphone-error', error);
      throw error;
    }
  }

  // Spatial Audio Source Management
  addAudioSource(sourceId, audioElement, position = { x: 0, y: 0, z: 0 }) {
    try {
      // Create media element source
      const source = this.audioContext.createMediaElementSource(audioElement);
      
      // Create panner for spatial positioning
      const panner = this.audioContext.createPanner();
      this.configurePanner(panner);
      
      // Create gain node for volume control
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 1.0;
      
      // Create audio processing chain for this source
      const sourceChain = this.createSourceProcessingChain();
      
      // Connect audio graph
      source.connect(sourceChain.input);
      sourceChain.output.connect(panner);
      panner.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      // Store source data
      const audioSource = {
        id: sourceId,
        source,
        panner,
        gainNode,
        processingChain: sourceChain,
        position: { ...position },
        audioElement,
        isPlaying: false,
        volume: 1.0,
        createdAt: Date.now()
      };
      
      this.audioSources.set(sourceId, audioSource);
      
      // Set initial position
      this.updateSourcePosition(sourceId, position.x, position.y, position.z);
      
      this.stats.activeSources++;
      
      console.log(`🎵 Audio source added: ${sourceId}`);
      
      this.emit('source-added', { sourceId, position });
      
      return audioSource;
      
    } catch (error) {
      console.error(`Failed to add audio source ${sourceId}:`, error);
      throw error;
    }
  }

  removeAudioSource(sourceId) {
    try {
      const audioSource = this.audioSources.get(sourceId);
      if (!audioSource) {
        console.warn(`Audio source ${sourceId} not found`);
        return false;
      }
      
      // Disconnect all nodes
      audioSource.source.disconnect();
      audioSource.panner.disconnect();
      audioSource.gainNode.disconnect();
      
      // Clean up processing chain
      this.disconnectProcessingChain(audioSource.processingChain);
      
      // Remove from tracking
      this.audioSources.delete(sourceId);
      this.stats.activeSources--;
      
      console.log(`🎵 Audio source removed: ${sourceId}`);
      
      this.emit('source-removed', { sourceId });
      
      return true;
      
    } catch (error) {
      console.error(`Failed to remove audio source ${sourceId}:`, error);
      return false;
    }
  }

  configurePanner(panner) {
    panner.panningModel = this.config.panningModel;
    panner.distanceModel = this.config.distanceModel;
    panner.maxDistance = this.config.maxDistance;
    panner.rolloffFactor = this.config.rolloffFactor;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 0;
    panner.coneOuterGain = 0;
  }

  createSourceProcessingChain() {
    // Create processing chain for individual audio sources
    const inputGain = this.audioContext.createGain();
    const outputGain = this.audioContext.createGain();
    
    // Add optional effects
    const effects = [];
    
    if (this.userSettings.voiceEnhancement) {
      effects.push(this.createVoiceEnhancer());
    }
    
    if (this.userSettings.noiseReduction) {
      effects.push(this.createNoiseGate());
    }
    
    // Connect processing chain
    let currentNode = inputGain;
    
    for (const effect of effects) {
      currentNode.connect(effect);
      currentNode = effect;
    }
    
    currentNode.connect(outputGain);
    
    return {
      input: inputGain,
      output: outputGain,
      effects
    };
  }

  createVoiceEnhancer() {
    // Create voice enhancement filter
    const voiceFilter = this.audioContext.createBiquadFilter();
    voiceFilter.type = 'peaking';
    voiceFilter.frequency.value = 2000; // Enhance speech frequencies
    voiceFilter.Q.value = 1;
    voiceFilter.gain.value = 3; // Boost by 3dB
    
    return voiceFilter;
  }

  createNoiseGate() {
    // Simple noise gate implementation
    const gateGain = this.audioContext.createGain();
    gateGain.gain.value = 1.0;
    
    // This would be enhanced with proper noise gate logic
    return gateGain;
  }

  disconnectProcessingChain(chain) {
    chain.input.disconnect();
    chain.output.disconnect();
    
    for (const effect of chain.effects) {
      effect.disconnect();
    }
  }

  // Position and Orientation Updates
  updateListenerPosition(x, y, z) {
    this.listenerPosition = { x, y, z };
    
    if (this.listener.positionX) {
      // Modern browsers with AudioParam
      this.listener.positionX.value = x;
      this.listener.positionY.value = y;
      this.listener.positionZ.value = z;
    } else {
      // Fallback for older browsers
      this.listener.setPosition(x, y, z);
    }
    
    this.emit('listener-position-updated', { x, y, z });
  }

  updateListenerOrientation(forwardX, forwardY, forwardZ, upX, upY, upZ) {
    this.listenerOrientation = {
      forward: { x: forwardX, y: forwardY, z: forwardZ },
      up: { x: upX, y: upY, z: upZ }
    };
    
    if (this.listener.forwardX) {
      // Modern browsers
      this.listener.forwardX.value = forwardX;
      this.listener.forwardY.value = forwardY;
      this.listener.forwardZ.value = forwardZ;
      this.listener.upX.value = upX;
      this.listener.upY.value = upY;
      this.listener.upZ.value = upZ;
    } else {
      // Fallback
      this.listener.setOrientation(forwardX, forwardY, forwardZ, upX, upY, upZ);
    }
    
    this.emit('listener-orientation-updated', this.listenerOrientation);
  }

  updateSourcePosition(sourceId, x, y, z) {
    const audioSource = this.audioSources.get(sourceId);
    if (!audioSource) {
      console.warn(`Audio source ${sourceId} not found`);
      return;
    }
    
    audioSource.position = { x, y, z };
    
    const panner = audioSource.panner;
    
    if (panner.positionX) {
      // Modern browsers
      panner.positionX.value = x;
      panner.positionY.value = y;
      panner.positionZ.value = z;
    } else {
      // Fallback
      panner.setPosition(x, y, z);
    }
    
    this.emit('source-position-updated', { sourceId, x, y, z });
  }

  updateSourceOrientation(sourceId, x, y, z) {
    const audioSource = this.audioSources.get(sourceId);
    if (!audioSource) {
      console.warn(`Audio source ${sourceId} not found`);
      return;
    }
    
    const panner = audioSource.panner;
    
    if (panner.orientationX) {
      // Modern browsers
      panner.orientationX.value = x;
      panner.orientationY.value = y;
      panner.orientationZ.value = z;
    } else {
      // Fallback
      panner.setOrientation(x, y, z);
    }
    
    this.emit('source-orientation-updated', { sourceId, x, y, z });
  }

  // Volume and Audio Control
  setMasterVolume(volume) {
    this.userSettings.masterVolume = Math.max(0, Math.min(1, volume));
    this.masterGain.gain.setTargetAtTime(
      this.userSettings.masterVolume,
      this.audioContext.currentTime,
      0.1
    );
    
    this.emit('master-volume-changed', this.userSettings.masterVolume);
  }

  setSourceVolume(sourceId, volume) {
    const audioSource = this.audioSources.get(sourceId);
    if (!audioSource) {
      console.warn(`Audio source ${sourceId} not found`);
      return;
    }
    
    audioSource.volume = Math.max(0, Math.min(1, volume));
    audioSource.gainNode.gain.setTargetAtTime(
      audioSource.volume,
      this.audioContext.currentTime,
      0.1
    );
    
    this.emit('source-volume-changed', { sourceId, volume });
  }

  muteSource(sourceId) {
    this.setSourceVolume(sourceId, 0);
  }

  unmuteSource(sourceId) {
    const audioSource = this.audioSources.get(sourceId);
    if (audioSource) {
      this.setSourceVolume(sourceId, audioSource.volume || 1.0);
    }
  }

  // Environment and Effects
  setEnvironmentSettings(settings) {
    this.environmentSettings = { ...this.environmentSettings, ...settings };
    
    // Update room effects
    if (settings.roomSize && this.convolver) {
      this.loadImpulseResponse(`/assets/sounds/ir_${settings.roomSize}_room.wav`);
    }
    
    // Update reverb level
    if (settings.reverbLevel !== undefined && this.convolver) {
      const reverbGain = this.audioContext.createGain();
      reverbGain.gain.value = settings.reverbLevel;
      // Reconnect with new reverb level
    }
    
    this.emit('environment-settings-changed', this.environmentSettings);
  }

  enableSpatialAudio() {
    this.userSettings.spatialEnabled = true;
    
    // Enable spatial processing for all sources
    for (const [sourceId, audioSource] of this.audioSources) {
      audioSource.panner.panningModel = this.config.panningModel;
    }
    
    this.emit('spatial-audio-enabled');
  }

  disableSpatialAudio() {
    this.userSettings.spatialEnabled = false;
    
    // Disable spatial processing
    for (const [sourceId, audioSource] of this.audioSources) {
      audioSource.panner.panningModel = 'equalpower';
    }
    
    this.emit('spatial-audio-disabled');
  }

  // Stream Management
  addRemoteStream(userId, stream) {
    try {
      // Create audio element for remote stream
      const audioElement = document.createElement('audio');
      audioElement.srcObject = stream;
      audioElement.autoplay = true;
      audioElement.muted = false; // We'll handle muting through gain nodes
      
      // Add as spatial audio source
      const audioSource = this.addAudioSource(`user_${userId}`, audioElement);
      
      // Store stream reference
      this.remoteStreams.set(userId, {
        stream,
        audioElement,
        audioSource
      });
      
      console.log(`🎵 Remote audio stream added for user: ${userId}`);
      
      this.emit('remote-stream-added', { userId, stream });
      
    } catch (error) {
      console.error(`Failed to add remote stream for user ${userId}:`, error);
      throw error;
    }
  }

  removeRemoteStream(userId) {
    try {
      const streamData = this.remoteStreams.get(userId);
      if (!streamData) {
        console.warn(`No remote stream found for user ${userId}`);
        return false;
      }
      
      // Remove audio source
      this.removeAudioSource(`user_${userId}`);
      
      // Clean up audio element
      streamData.audioElement.srcObject = null;
      
      // Remove from tracking
      this.remoteStreams.delete(userId);
      
      console.log(`🎵 Remote audio stream removed for user: ${userId}`);
      
      this.emit('remote-stream-removed', { userId });
      
      return true;
      
    } catch (error) {
      console.error(`Failed to remove remote stream for user ${userId}:`, error);
      return false;
    }
  }

  updateUserPosition(userId, position, orientation = null) {
    const sourceId = `user_${userId}`;
    
    // Update audio source position
    this.updateSourcePosition(sourceId, position.x, position.y, position.z);
    
    // Update orientation if provided
    if (orientation) {
      this.updateSourceOrientation(sourceId, orientation.x, orientation.y, orientation.z);
    }
  }

  // Audio Analysis
  createAnalyser(sourceId) {
    const audioSource = this.audioSources.get(sourceId);
    if (!audioSource) {
      throw new Error(`Audio source ${sourceId} not found`);
    }
    
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    
    // Connect analyser to source
    audioSource.gainNode.connect(analyser);
    
    return analyser;
  }

  getAudioLevel(sourceId) {
    try {
      const analyser = this.createAnalyser(sourceId);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      
      const rms = Math.sqrt(sum / dataArray.length);
      return rms / 255; // Normalize to 0-1
      
    } catch (error) {
      console.error(`Failed to get audio level for ${sourceId}:`, error);
      return 0;
    }
  }

  // Utility Methods
  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  calculateVolumeByDistance(distance) {
    if (distance <= 1) return 1.0;
    
    // Inverse square law with rolloff factor
    return Math.max(0.01, 1 / (1 + this.config.rolloffFactor * distance * distance));
  }

  // Performance and Monitoring
  getAudioStats() {
    return {
      ...this.stats,
      audioContextState: this.audioContext?.state,
      sampleRate: this.audioContext?.sampleRate,
      currentTime: this.audioContext?.currentTime,
      activeSources: this.audioSources.size,
      remoteStreams: this.remoteStreams.size
    };
  }

  startPerformanceMonitoring() {
    setInterval(() => {
      this.updatePerformanceStats();
    }, 1000);
  }

  updatePerformanceStats() {
    this.stats.activeSources = this.audioSources.size;
    
    // Monitor buffer health
    if (this.audioContext) {
      this.stats.processingLatency = this.audioContext.baseLatency || 0;
    }
  }

  // Cleanup
  async cleanup() {
    try {
      console.log('🎵 Cleaning up Spatial Audio System...');
      
      // Remove all audio sources
      for (const sourceId of this.audioSources.keys()) {
        this.removeAudioSource(sourceId);
      }
      
      // Stop microphone stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }
      
      // Remove all remote streams
      for (const userId of this.remoteStreams.keys()) {
        this.removeRemoteStream(userId);
      }
      
      // Close audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
      }
      
      console.log('✅ Spatial Audio System cleanup complete');
      
    } catch (error) {
      console.error('Error during spatial audio cleanup:', error);
    }
  }

  // Event System
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
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

  // Public API Methods
  getAudioSources() {
    return Array.from(this.audioSources.keys());
  }

  getRemoteStreams() {
    return Array.from(this.remoteStreams.keys());
  }

  getListenerPosition() {
    return { ...this.listenerPosition };
  }

  getListenerOrientation() {
    return { ...this.listenerOrientation };
  }

  getEnvironmentSettings() {
    return { ...this.environmentSettings };
  }

  getUserSettings() {
    return { ...this.userSettings };
  }

  isSpatialEnabled() {
    return this.userSettings.spatialEnabled;
  }

  isInitialized() {
    return this.audioContext && this.audioContext.state !== 'closed';
  }
}
