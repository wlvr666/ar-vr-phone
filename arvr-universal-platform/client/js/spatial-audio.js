// spatial-audio.js - 3D Positional Audio System

export class SpatialAudio extends EventTarget {
    constructor() {
        super();
        this.audioContext = null;
        this.masterGainNode = null;
        this.analyserNode = null;
        this.compressorNode = null;
        
        // Listener (local user) properties
        this.listenerPosition = { x: 0, y: 0, z: 0 };
        this.listenerOrientation = { x: 0, y: 0, z: -1, upX: 0, upY: 1, upZ: 0 };
        
        // Audio sources management
        this.audioSources = new Map();
        this.microphoneStream = null;
        this.localMicGain = null;
        
        // 3D audio processing
        this.pannerNodes = new Map();
        this.gainNodes = new Map();
        this.analyserNodes = new Map();
        
        // Audio settings
        this.settings = {
            masterVolume: 1.0,
            spatialBlend: 1.0, // 0 = 2D, 1 = full 3D
            rolloffFactor: 1.0,
            maxDistance: 10.0,
            refDistance: 1.0,
            panningModel: 'HRTF',
            distanceModel: 'inverse',
            dopplerFactor: 1.0,
            speedOfSound: 343.3
        };
        
        // Voice activity detection
        this.voiceDetection = {
            enabled: true,
            threshold: -45, // dB
            smoothingTimeConstant: 0.8,
            minSpeakingTime: 100, // ms
            minSilenceTime: 200   // ms
        };
        
        // Audio effects
        this.effects = {
            reverb: null,
            echo: null,
            noise: null
        };
        
        // Frequency analysis
        this.frequencyData = new Map();
        this.timeDomainData = new Map();
        
        this.isInitialized = false;
        this.isMuted = false;
    }

    async init() {
        console.log('🔧 Initializing Spatial Audio System...');
        
        try {
            // Create audio context
            await this.createAudioContext();
            
            // Setup audio graph
            this.setupAudioGraph();
            
            // Initialize microphone
            await this.initializeMicrophone();
            
            // Setup audio effects
            this.setupAudioEffects();
            
            // Start audio processing loop
            this.startAudioProcessing();
            
            this.isInitialized = true;
            console.log('✅ Spatial Audio System initialized');
            console.log(`🎵 Sample rate: ${this.audioContext.sampleRate}Hz`);
            console.log(`🎧 Audio latency: ${Math.round(this.audioContext.baseLatency * 1000)}ms`);
            
        } catch (error) {
            console.error('❌ Spatial Audio initialization failed:', error);
            throw error;
        }
    }

    async createAudioContext() {
        // Try different audio context types for browser compatibility
        const AudioContextClass = window.AudioContext || 
                                 window.webkitAudioContext || 
                                 window.mozAudioContext;
        
        if (!AudioContextClass) {
            throw new Error('Web Audio API not supported');
        }
        
        this.audioContext = new AudioContextClass({
            latencyHint: 'interactive',
            sampleRate: 48000
        });
        
        // Resume context if needed (Chrome autoplay policy)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        console.log('🎵 Audio context created');
    }

    setupAudioGraph() {
        // Create master gain node
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.gain.value = this.settings.masterVolume;
        
        // Create compressor for dynamic range control
        this.compressorNode = this.audioContext.createDynamicsCompressor();
        this.compressorNode.threshold.value = -24;
        this.compressorNode.knee.value = 30;
        this.compressorNode.ratio.value = 12;
        this.compressorNode.attack.value = 0.003;
        this.compressorNode.release.value = 0.25;
        
        // Create analyser for volume monitoring
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 1024;
        this.analyserNode.minDecibels = -90;
        this.analyserNode.maxDecibels = -10;
        this.analyserNode.smoothingTimeConstant = 0.85;
        
        // Connect audio graph
        this.masterGainNode.connect(this.compressorNode);
        this.compressorNode.connect(this.analyserNode);
        this.analyserNode.connect(this.audioContext.destination);
        
        // Setup 3D listener
        this.setupSpatialListener();
        
        console.log('🎛️ Audio graph configured');
    }

    setupSpatialListener() {
        const listener = this.audioContext.listener;
        
        // Set initial listener position and orientation
        if (listener.positionX) {
            // Use AudioParam interface (newer browsers)
            listener.positionX.value = this.listenerPosition.x;
            listener.positionY.value = this.listenerPosition.y;
            listener.positionZ.value = this.listenerPosition.z;
            
            listener.forwardX.value = this.listenerOrientation.x;
            listener.forwardY.value = this.listenerOrientation.y;
            listener.forwardZ.value = this.listenerOrientation.z;
            
            listener.upX.value = this.listenerOrientation.upX;
            listener.upY.value = this.listenerOrientation.upY;
            listener.upZ.value = this.listenerOrientation.upZ;
        } else {
            // Use deprecated methods (older browsers)
            listener.setPosition(
                this.listenerPosition.x,
                this.listenerPosition.y,
                this.listenerPosition.z
            );
            
            listener.setOrientation(
                this.listenerOrientation.x,
                this.listenerOrientation.y,
                this.listenerOrientation.z,
                this.listenerOrientation.upX,
                this.listenerOrientation.upY,
                this.listenerOrientation.upZ
            );
        }
        
        console.log('👂 3D audio listener configured');
    }

    async initializeMicrophone() {
        try {
            // Get microphone access
            this.microphoneStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                    channelCount: 1
                }
            });
            
            // Create microphone source
            const micSource = this.audioContext.createMediaStreamSource(this.microphoneStream);
            
            // Create microphone gain control
            this.localMicGain = this.audioContext.createGain();
            this.localMicGain.gain.value = 1.0;
            
            // Connect microphone to gain control
            micSource.connect(this.localMicGain);
            
            console.log('🎤 Microphone initialized');
            
        } catch (error) {
            console.warn('⚠️ Could not access microphone:', error.message);
            // Continue without microphone
        }
    }

    setupAudioEffects() {
        // Create reverb effect
        this.effects.reverb = this.createReverbEffect();
        
        // Create echo/delay effect
        this.effects.echo = this.createEchoEffect();
        
        // Create noise gate
        this.effects.noise = this.createNoiseGate();
        
        console.log('🎚️ Audio effects configured');
    }

    createReverbEffect() {
        const convolver = this.audioContext.createConvolver();
        const reverbGain = this.audioContext.createGain();
        reverbGain.gain.value = 0.2; // 20% wet signal
        
        // Create impulse response for reverb
        this.createImpulseResponse(convolver, 2, 2, false);
        
        convolver.connect(reverbGain);
        
        return { convolver, gain: reverbGain };
    }

    createEchoEffect() {
        const delay = this.audioContext.createDelay(1.0);
        const feedback = this.audioContext.createGain();
        const wetGain = this.audioContext.createGain();
        
        delay.delayTime.value = 0.3; // 300ms delay
        feedback.gain.value = 0.3;   // 30% feedback
        wetGain.gain.value = 0.1;    // 10% wet signal
        
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wetGain);
        
        return { delay, feedback, wetGain };
    }

    createNoiseGate() {
        // Simple noise gate using gain automation
        const gateGain = this.audioContext.createGain();
        gateGain.gain.value = 1.0;
        
        return { gain: gateGain };
    }

    createImpulseResponse(convolver, duration, decay, reverse) {
        const length = this.audioContext.sampleRate * duration;
        const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const n = reverse ? length - i : i;
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
            }
        }
        
        convolver.buffer = impulse;
    }

    startAudioProcessing() {
        // Start analysis loop
        this.analysisLoop();
        
        console.log('🔄 Audio processing started');
    }

    analysisLoop() {
        if (!this.isInitialized) return;
        
        // Update frequency analysis for all sources
        this.audioSources.forEach((source, userId) => {
            this.updateFrequencyAnalysis(userId);
            this.detectVoiceActivity(userId);
        });
        
        // Continue analysis loop
        requestAnimationFrame(() => this.analysisLoop());
    }

    // User audio source management
    addUserAudioSource(userId, audioStream) {
        console.log(`🎵 Adding audio source for user: ${userId}`);
        
        try {
            // Create audio source from stream
            const source = this.audioContext.createMediaStreamSource(audioStream);
            
            // Create 3D panner node
            const panner = this.audioContext.createPanner();
            panner.panningModel = this.settings.panningModel;
            panner.distanceModel = this.settings.distanceModel;
            panner.rolloffFactor = this.settings.rolloffFactor;
            panner.maxDistance = this.settings.maxDistance;
            panner.refDistance = this.settings.refDistance;
            
            // Create gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 1.0;
            
            // Create analyser for this user
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = this.voiceDetection.smoothingTimeConstant;
            
            // Connect audio graph
            source.connect(gainNode);
            gainNode.connect(panner);
            gainNode.connect(analyser);
            panner.connect(this.masterGainNode);
            
            // Store references
            this.audioSources.set(userId, source);
            this.pannerNodes.set(userId, panner);
            this.gainNodes.set(userId, gainNode);
            this.analyserNodes.set(userId, analyser);
            this.frequencyData.set(userId, new Uint8Array(analyser.frequencyBinCount));
            this.timeDomainData.set(userId, new Uint8Array(analyser.fftSize));
            
            // Set initial position (center)
            this.updateUserPosition(userId, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
            
            this.dispatchEvent(new CustomEvent('userAudioAdded', {
                detail: { userId }
            }));
            
            console.log(`✅ Audio source added for ${userId}`);
            
        } catch (error) {
            console.error(`❌ Failed to add audio source for ${userId}:`, error);
        }
    }

    removeUserAudioSource(userId) {
        console.log(`🔇 Removing audio source for user: ${userId}`);
        
        // Get nodes
        const source = this.audioSources.get(userId);
        const panner = this.pannerNodes.get(userId);
        const gainNode = this.gainNodes.get(userId);
        const analyser = this.analyserNodes.get(userId);
        
        // Disconnect and cleanup
        if (source) {
            source.disconnect();
            this.audioSources.delete(userId);
        }
        
        if (panner) {
            panner.disconnect();
            this.pannerNodes.delete(userId);
        }
        
        if (gainNode) {
            gainNode.disconnect();
            this.gainNodes.delete(userId);
        }
        
        if (analyser) {
            analyser.disconnect();
            this.analyserNodes.delete(userId);
        }
        
        // Clean up analysis data
        this.frequencyData.delete(userId);
        this.timeDomainData.delete(userId);
        
        this.dispatchEvent(new CustomEvent('userAudioRemoved', {
            detail: { userId }
        }));
    }

    // 3D positioning
    updateUserPosition(userId, position, orientation = null) {
        const panner = this.pannerNodes.get(userId);
        if (!panner) return;
        
        try {
            // Update position
            if (panner.positionX) {
                // Use AudioParam interface (newer browsers)
                panner.positionX.value = position.x;
                panner.positionY.value = position.y;
                panner.positionZ.value = position.z;
                
                if (orientation) {
                    panner.orientationX.value = orientation.x;
                    panner.orientationY.value = orientation.y;
                    panner.orientationZ.value = orientation.z;
                }
            } else {
                // Use deprecated methods (older browsers)
                panner.setPosition(position.x, position.y, position.z);
                
                if (orientation) {
                    panner.setOrientation(orientation.x, orientation.y, orientation.z);
                }
            }
            
            // Calculate distance for volume adjustment
            const distance = this.calculateDistance(this.listenerPosition, position);
            this.adjustVolumeByDistance(userId, distance);
            
            // Emit spatial data for synchronization
            this.dispatchEvent(new CustomEvent('spatialDataUpdated', {
                detail: {
                    userId,
                    position,
                    orientation,
                    distance
                }
            }));
            
        } catch (error) {
            console.error(`❌ Failed to update position for ${userId}:`, error);
        }
    }

    updateListenerPosition(position, orientation) {
        this.listenerPosition = { ...position };
        this.listenerOrientation = { ...orientation };
        
        const listener = this.audioContext.listener;
        
        try {
            if (listener.positionX) {
                // Use AudioParam interface
                listener.positionX.value = position.x;
                listener.positionY.value = position.y;
                listener.positionZ.value = position.z;
                
                listener.forwardX.value = orientation.x;
                listener.forwardY.value = orientation.y;
                listener.forwardZ.value = orientation.z;
                
                listener.upX.value = orientation.upX || 0;
                listener.upY.value = orientation.upY || 1;
                listener.upZ.value = orientation.upZ || 0;
            } else {
                // Use deprecated methods
                listener.setPosition(position.x, position.y, position.z);
                listener.setOrientation(
                    orientation.x, orientation.y, orientation.z,
                    orientation.upX || 0, orientation.upY || 1, orientation.upZ || 0
                );
            }
            
            // Update all user distances
            this.pannerNodes.forEach((panner, userId) => {
                const userPos = {
                    x: panner.positionX ? panner.positionX.value : 0,
                    y: panner.positionY ? panner.positionY.value : 0,
                    z: panner.positionZ ? panner.positionZ.value : 0
                };
                const distance = this.calculateDistance(position, userPos);
                this.adjustVolumeByDistance(userId, distance);
            });
            
        } catch (error) {
            console.error('❌ Failed to update listener position:', error);
        }
    }

    calculateDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    adjustVolumeByDistance(userId, distance) {
        const gainNode = this.gainNodes.get(userId);
        if (!gainNode) return;
        
        // Apply distance-based volume reduction
        const maxAudibleDistance = this.settings.maxDistance;
        const refDistance = this.settings.refDistance;
        
        let volume = 1.0;
        
        if (distance > refDistance) {
            // Apply inverse distance model
            volume = refDistance / (refDistance + this.settings.rolloffFactor * (distance - refDistance));
        }
        
        // Fade out completely at max distance
        if (distance >= maxAudibleDistance) {
            volume = 0;
        }
        
        // Apply smooth volume transition
        gainNode.gain.linearRampToValueAtTime(
            volume,
            this.audioContext.currentTime + 0.1
        );
    }

    // Voice activity detection
    updateFrequencyAnalysis(userId) {
        const analyser = this.analyserNodes.get(userId);
        const freqData = this.frequencyData.get(userId);
        const timeData = this.timeDomainData.get(userId);
        
        if (analyser && freqData && timeData) {
            analyser.getByteFrequencyData(freqData);
            analyser.getByteTimeDomainData(timeData);
        }
    }

    detectVoiceActivity(userId) {
        const analyser = this.analyserNodes.get(userId);
        if (!analyser || !this.voiceDetection.enabled) return;
        
        // Calculate RMS volume
        const timeData = this.timeDomainData.get(userId);
        let rms = 0;
        
        for (let i = 0; i < timeData.length; i++) {
            const sample = (timeData[i] - 128) / 128;
            rms += sample * sample;
        }
        
        rms = Math.sqrt(rms / timeData.length);
        const volume = rms;
        const volumeDb = 20 * Math.log10(rms + 0.0001); // Add small value to avoid -Infinity
        
        // Determine if user is speaking
        const isSpeaking = volumeDb > this.voiceDetection.threshold;
        
        // Emit voice activity events
        this.dispatchEvent(new CustomEvent('voiceActivity', {
            detail: {
                userId,
                isSpeaking,
                volume,
                volumeDb
            }
        }));
        
        // Update visual indicators
        this.updateAudioIndicator(userId, isSpeaking, volume);
    }

    updateAudioIndicator(userId, isSpeaking, volume) {
        this.dispatchEvent(new CustomEvent('audioIndicatorUpdate', {
            detail: {
                userId,
                isPlaying: isSpeaking,
                volume: Math.min(volume * 2, 1) // Normalize and boost for visualization
            }
        }));
    }

    // Audio controls
    setMasterVolume(volume) {
        this.settings.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.masterGainNode) {
            this.masterGainNode.gain.linearRampToValueAtTime(
                this.settings.masterVolume,
                this.audioContext.currentTime + 0.1
            );
        }
        
        console.log(`🔊 Master volume: ${Math.round(volume * 100)}%`);
    }

    setUserVolume(userId, volume) {
        const gainNode = this.gainNodes.get(userId);
        if (gainNode) {
            gainNode.gain.linearRampToValueAtTime(
                Math.max(0, Math.min(1, volume)),
                this.audioContext.currentTime + 0.1
            );
            
            console.log(`🔊 User ${userId} volume: ${Math.round(volume * 100)}%`);
        }
    }

    mute() {
        this.isMuted = true;
        if (this.localMicGain) {
            this.localMicGain.gain.linearRampToValueAtTime(
                0,
                this.audioContext.currentTime + 0.05
            );
        }
        
        console.log('🔇 Microphone muted');
        
        this.dispatchEvent(new CustomEvent('microphoneMuted'));
    }

    unmute() {
        this.isMuted = false;
        if (this.localMicGain) {
            this.localMicGain.gain.linearRampToValueAtTime(
                1.0,
                this.audioContext.currentTime + 0.05
            );
        }
        
        console.log('🎤 Microphone unmuted');
        
        this.dispatchEvent(new CustomEvent('microphoneUnmuted'));
    }

    toggleMute() {
        if (this.isMuted) {
            this.unmute();
        } else {
            this.mute();
        }
        return !this.isMuted;
    }

    // Audio effects controls
    setReverbLevel(level) {
        if (this.effects.reverb) {
            this.effects.reverb.gain.gain.value = Math.max(0, Math.min(1, level));
            console.log(`🏛️ Reverb level: ${Math.round(level * 100)}%`);
        }
    }

    setEchoLevel(level) {
        if (this.effects.echo) {
            this.effects.echo.wetGain.gain.value = Math.max(0, Math.min(1, level));
            console.log(`🔁 Echo level: ${Math.round(level * 100)}%`);
        }
    }

    setSpatialBlend(blend) {
        this.settings.spatialBlend = Math.max(0, Math.min(1, blend));
        
        // Adjust all panners
        this.pannerNodes.forEach((panner, userId) => {
            // Interpolate between 2D and 3D positioning
            if (panner.positionX) {
                const currentX = panner.positionX.value;
                const currentY = panner.positionY.value;
                const currentZ = panner.positionZ.value;
                
                // Blend towards center for 2D mode
                panner.positionX.value = currentX * blend;
                panner.positionY.value = currentY * blend;
                panner.positionZ.value = currentZ * blend;
            }
        });
        
        console.log(`🎯 Spatial blend: ${Math.round(blend * 100)}%`);
    }

    // Audio environment presets
    setEnvironmentPreset(preset) {
        switch (preset) {
            case 'room':
                this.setReverbLevel(0.2);
                this.setEchoLevel(0.1);
                this.settings.rolloffFactor = 1.0;
                break;
                
            case 'hall':
                this.setReverbLevel(0.6);
                this.setEchoLevel(0.2);
                this.settings.rolloffFactor = 0.5;
                break;
                
            case 'outdoor':
                this.setReverbLevel(0.0);
                this.setEchoLevel(0.0);
                this.settings.rolloffFactor = 2.0;
                break;
                
            case 'intimate':
                this.setReverbLevel(0.1);
                this.setEchoLevel(0.0);
                this.settings.rolloffFactor = 3.0;
                this.settings.maxDistance = 5.0;
                break;
                
            default:
                console.warn(`Unknown environment preset: ${preset}`);
        }
        
        console.log(`🏞️ Environment preset: ${preset}`);
    }

    // Utility methods
    getMicrophoneStream() {
        return this.microphoneStream;
    }

    getAudioContext() {
        return this.audioContext;
    }

    getConnectedUsers() {
        return Array.from(this.audioSources.keys());
    }

    getUserVolume(userId) {
        const gainNode = this.gainNodes.get(userId);
        return gainNode ? gainNode.gain.value : 0;
    }

    getVoiceActivityLevel(userId) {
        const timeData = this.timeDomainData.get(userId);
        if (!timeData) return 0;
        
        let rms = 0;
        for (let i = 0; i < timeData.length; i++) {
            const sample = (timeData[i] - 128) / 128;
            rms += sample * sample;
        }
        
        return Math.sqrt(rms / timeData.length);
    }

    // Cleanup
    async destroy() {
        console.log('🧹 Cleaning up Spatial Audio System...');
        
        // Stop microphone stream
        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach(track => track.stop());
            this.microphoneStream = null;
        }
        
        // Remove all user audio sources
        Array.from(this.audioSources.keys()).forEach(userId => {
            this.removeUserAudioSource(userId);
        });
        
        // Disconnect audio nodes
        if (this.masterGainNode) {
            this.masterGainNode.disconnect();
        }
        
        if (this.compressorNode) {
            this.compressorNode.disconnect();
        }
        
        if (this.analyserNode) {
            this.analyserNode.disconnect();
        }
        
        // Close audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            await this.audioContext.close();
        }
        
        // Clear all data structures
        this.audioSources.clear();
        this.pannerNodes.clear();
        this.gainNodes.clear();
        this.analyserNodes.clear();
        this.frequencyData.clear();
        this.timeDomainData.clear();
        
        this.isInitialized = false;
        
        console.log('✅ Spatial Audio System cleaned up');
    }
}
