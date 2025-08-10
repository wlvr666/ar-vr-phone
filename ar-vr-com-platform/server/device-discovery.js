import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Device Discovery Service for AR/VR Communication Platform
 * Handles multi-protocol device scanning and connection management
 */
export class DeviceDiscovery extends EventEmitter {
  constructor() {
    super();
    
    // Device tracking
    this.discoveredDevices = new Map();
    this.connectedDevices = new Map();
    this.deviceSessions = new Map();
    
    // Protocol handlers
    this.protocolHandlers = {
      bluetooth: null,
      wifi: null,
      nfc: null,
      webusb: null,
      mdns: null,
      upnp: null
    };
    
    // Discovery state
    this.isScanning = false;
    this.scanResults = new Map();
    this.lastScanTime = null;
    
    // Configuration
    this.config = {
      scanTimeout: 30000, // 30 seconds
      scanInterval: 60000, // 1 minute for automatic scanning
      deviceTimeout: 5 * 60 * 1000, // 5 minutes device timeout
      maxDevicesPerProtocol: 50,
      maxConnectedDevices: 20,
      supportedProtocols: ['bluetooth', 'wifi', 'nfc', 'webusb', 'mdns', 'upnp'],
      
      // Device type capabilities
      deviceCapabilities: {
        'smart-tv': ['display', 'audio', 'input', 'control'],
        'smart-speaker': ['audio', 'voice', 'control'],
        'smartphone': ['display', 'audio', 'camera', 'sensors', 'input'],
        'tablet': ['display', 'audio', 'camera', 'sensors', 'input'],
        'laptop': ['display', 'audio', 'camera', 'input', 'compute'],
        'iot-sensor': ['sensors', 'data'],
        'smart-light': ['lighting', 'control'],
        'game-console': ['display', 'audio', 'input', 'compute'],
        'ar-glasses': ['display', 'sensors', 'camera', 'audio'],
        'vr-headset': ['display', 'sensors', 'camera', 'audio', 'haptic']
      }
    };
    
    // Statistics
    this.stats = {
      totalScans: 0,
      devicesDiscovered: 0,
      successfulConnections: 0,
      failedConnections: 0,
      protocolStats: {}
    };
    
    this.initializeProtocolHandlers();
    this.startMaintenanceTasks();
    
    console.log('📡 Device Discovery Service initialized');
  }

  // Initialization
  async initializeProtocolHandlers() {
    try {
      // Initialize Bluetooth LE handler
      await this.initializeBluetoothHandler();
      
      // Initialize WiFi Direct handler
      await this.initializeWiFiHandler();
      
      // Initialize NFC handler
      await this.initializeNFCHandler();
      
      // Initialize WebUSB handler
      await this.initializeWebUSBHandler();
      
      // Initialize mDNS handler
      await this.initializeMDNSHandler();
      
      // Initialize UPnP handler
      await this.initializeUPnPHandler();
      
      console.log('📡 All protocol handlers initialized');
      
    } catch (error) {
      console.error('Error initializing protocol handlers:', error);
    }
  }

  async initializeBluetoothHandler() {
    try {
      this.protocolHandlers.bluetooth = {
        isAvailable: false,
        isScanning: false,
        discoveredDevices: new Map(),
        
        async startScan() {
          console.log('🔵 Starting Bluetooth LE scan...');
          this.isScanning = true;
          
          // Mock Bluetooth devices for development
          setTimeout(() => {
            this.mockBluetoothDevices();
          }, 2000);
          
          return true;
        },
        
        async stopScan() {
          console.log('🔵 Stopping Bluetooth LE scan...');
          this.isScanning = false;
          return true;
        },
        
        async connect(deviceId) {
          console.log(`🔵 Connecting to Bluetooth device: ${deviceId}`);
          // Mock connection
          return { status: 'connected', protocol: 'bluetooth' };
        },
        
        async disconnect(deviceId) {
          console.log(`🔵 Disconnecting Bluetooth device: ${deviceId}`);
          return { status: 'disconnected' };
        }
      };
      
      // Check if Bluetooth is available
      // In a real implementation, this would check for noble or other BLE libraries
      this.protocolHandlers.bluetooth.isAvailable = true;
      
      console.log('🔵 Bluetooth LE handler initialized');
      
    } catch (error) {
      console.warn('🔵 Bluetooth LE not available:', error.message);
      this.protocolHandlers.bluetooth = { isAvailable: false };
    }
  }

  async initializeWiFiHandler() {
    try {
      this.protocolHandlers.wifi = {
        isAvailable: true,
        isScanning: false,
        discoveredDevices: new Map(),
        
        async startScan() {
          console.log('📶 Starting WiFi Direct scan...');
          this.isScanning = true;
          
          // Mock WiFi devices
          setTimeout(() => {
            this.mockWiFiDevices();
          }, 1500);
          
          return true;
        },
        
        async stopScan() {
          console.log('📶 Stopping WiFi Direct scan...');
          this.isScanning = false;
          return true;
        },
        
        async connect(deviceId) {
          console.log(`📶 Connecting to WiFi device: ${deviceId}`);
          return { status: 'connected', protocol: 'wifi' };
        },
        
        async disconnect(deviceId) {
          console.log(`📶 Disconnecting WiFi device: ${deviceId}`);
          return { status: 'disconnected' };
        }
      };
      
      console.log('📶 WiFi Direct handler initialized');
      
    } catch (error) {
      console.warn('📶 WiFi Direct not available:', error.message);
      this.protocolHandlers.wifi = { isAvailable: false };
    }
  }

  async initializeNFCHandler() {
    try {
      this.protocolHandlers.nfc = {
        isAvailable: true,
        isScanning: false,
        
        async startScan() {
          console.log('📱 Starting NFC scan...');
          this.isScanning = true;
          return true;
        },
        
        async stopScan() {
          console.log('📱 Stopping NFC scan...');
          this.isScanning = false;
          return true;
        },
        
        async connect(deviceId) {
          console.log(`📱 Connecting via NFC: ${deviceId}`);
          return { status: 'connected', protocol: 'nfc' };
        }
      };
      
      console.log('📱 NFC handler initialized');
      
    } catch (error) {
      console.warn('📱 NFC not available:', error.message);
      this.protocolHandlers.nfc = { isAvailable: false };
    }
  }

  async initializeWebUSBHandler() {
    try {
      this.protocolHandlers.webusb = {
        isAvailable: true,
        isScanning: false,
        
        async startScan() {
          console.log('🔌 Starting WebUSB scan...');
          this.isScanning = true;
          
          // Mock USB devices
          setTimeout(() => {
            this.mockUSBDevices();
          }, 1000);
          
          return true;
        },
        
        async stopScan() {
          console.log('🔌 Stopping WebUSB scan...');
          this.isScanning = false;
          return true;
        },
        
        async connect(deviceId) {
          console.log(`🔌 Connecting to USB device: ${deviceId}`);
          return { status: 'connected', protocol: 'webusb' };
        },
        
        async disconnect(deviceId) {
          console.log(`🔌 Disconnecting USB device: ${deviceId}`);
          return { status: 'disconnected' };
        }
      };
      
      console.log('🔌 WebUSB handler initialized');
      
    } catch (error) {
      console.warn('🔌 WebUSB not available:', error.message);
      this.protocolHandlers.webusb = { isAvailable: false };
    }
  }

  async initializeMDNSHandler() {
    try {
      this.protocolHandlers.mdns = {
        isAvailable: true,
        isScanning: false,
        browser: null,
        
        async startScan() {
          console.log('🌐 Starting mDNS scan...');
          this.isScanning = true;
          
          // Mock network devices
          setTimeout(() => {
            this.mockNetworkDevices();
          }, 2500);
          
          return true;
        },
        
        async stopScan() {
          console.log('🌐 Stopping mDNS scan...');
          this.isScanning = false;
          return true;
        },
        
        async connect(deviceId) {
          console.log(`🌐 Connecting to network device: ${deviceId}`);
          return { status: 'connected', protocol: 'mdns' };
        },
        
        async disconnect(deviceId) {
          console.log(`🌐 Disconnecting network device: ${deviceId}`);
          return { status: 'disconnected' };
        }
      };
      
      console.log('🌐 mDNS handler initialized');
      
    } catch (error) {
      console.warn('🌐 mDNS not available:', error.message);
      this.protocolHandlers.mdns = { isAvailable: false };
    }
  }

  async initializeUPnPHandler() {
    try {
      this.protocolHandlers.upnp = {
        isAvailable: true,
        isScanning: false,
        
        async startScan() {
          console.log('🏠 Starting UPnP scan...');
          this.isScanning = true;
          
          // Mock UPnP devices
          setTimeout(() => {
            this.mockUPnPDevices();
          }, 3000);
          
          return true;
        },
        
        async stopScan() {
          console.log('🏠 Stopping UPnP scan...');
          this.isScanning = false;
          return true;
        },
        
        async connect(deviceId) {
          console.log(`🏠 Connecting to UPnP device: ${deviceId}`);
          return { status: 'connected', protocol: 'upnp' };
        },
        
        async disconnect(deviceId) {
          console.log(`🏠 Disconnecting UPnP device: ${deviceId}`);
          return { status: 'disconnected' };
        }
      };
      
      console.log('🏠 UPnP handler initialized');
      
    } catch (error) {
      console.warn('🏠 UPnP not available:', error.message);
      this.protocolHandlers.upnp = { isAvailable: false };
    }
  }

  // Discovery Methods
  async startDiscovery(protocols = null) {
    try {
      if (this.isScanning) {
        console.log('📡 Discovery already in progress');
        return false;
      }
      
      const targetProtocols = protocols || this.config.supportedProtocols;
      this.isScanning = true;
      this.lastScanTime = new Date().toISOString();
      this.stats.totalScans++;
      
      console.log(`📡 Starting device discovery for protocols: ${targetProtocols.join(', ')}`);
      
      // Start scanning with all available protocols
      const scanPromises = targetProtocols.map(async (protocol) => {
        const handler = this.protocolHandlers[protocol];
        if (handler && handler.isAvailable && handler.startScan) {
          try {
            await handler.startScan();
            console.log(`✅ ${protocol} scan started`);
          } catch (error) {
            console.error(`❌ ${protocol} scan failed:`, error);
          }
        }
      });
      
      await Promise.all(scanPromises);
      
      // Set timeout for scan completion
      setTimeout(() => {
        this.stopDiscovery();
      }, this.config.scanTimeout);
      
      this.emit('discovery-started', { protocols: targetProtocols });
      
      return true;
      
    } catch (error) {
      console.error('Error starting discovery:', error);
      this.isScanning = false;
      throw error;
    }
  }

  async stopDiscovery() {
    try {
      if (!this.isScanning) {
        return false;
      }
      
      console.log('📡 Stopping device discovery...');
      this.isScanning = false;
      
      // Stop all protocol scanners
      const stopPromises = Object.entries(this.protocolHandlers).map(async ([protocol, handler]) => {
        if (handler && handler.isAvailable && handler.stopScan && handler.isScanning) {
          try {
            await handler.stopScan();
            console.log(`✅ ${protocol} scan stopped`);
          } catch (error) {
            console.error(`❌ Error stopping ${protocol} scan:`, error);
          }
        }
      });
      
      await Promise.all(stopPromises);
      
      this.emit('discovery-stopped', { 
        devicesFound: this.discoveredDevices.size,
        scanDuration: Date.now() - new Date(this.lastScanTime).getTime()
      });
      
      return true;
      
    } catch (error) {
      console.error('Error stopping discovery:', error);
      return false;
    }
  }

  // Device Connection Management
  async connectDevice(deviceId, protocol) {
    try {
      const device = this.discoveredDevices.get(deviceId);
      if (!device) {
        throw new Error(`Device ${deviceId} not found`);
      }
      
      // Check connection limits
      if (this.connectedDevices.size >= this.config.maxConnectedDevices) {
        throw new Error('Maximum connected devices limit reached');
      }
      
      const handler = this.protocolHandlers[protocol];
      if (!handler || !handler.isAvailable) {
        throw new Error(`Protocol ${protocol} not available`);
      }
      
      console.log(`🔗 Connecting to device ${deviceId} via ${protocol}...`);
      
      // Attempt connection
      const connectionResult = await handler.connect(deviceId);
      
      if (connectionResult.status === 'connected') {
        // Create device session
        const session = {
          deviceId,
          device,
          protocol,
          connectedAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          connectionId: uuidv4(),
          status: 'connected',
          commands: [],
          dataTransferred: 0
        };
        
        this.connectedDevices.set(deviceId, device);
        this.deviceSessions.set(deviceId, session);
        
        // Update statistics
        this.stats.successfulConnections++;
        if (!this.stats.protocolStats[protocol]) {
          this.stats.protocolStats[protocol] = { connections: 0, errors: 0 };
        }
        this.stats.protocolStats[protocol].connections++;
        
        console.log(`✅ Connected to device ${deviceId}`);
        
        this.emit('device-connected', { device, session, protocol });
        
        return session;
        
      } else {
        throw new Error(`Connection failed: ${connectionResult.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to connect to device ${deviceId}:`, error);
      
      this.stats.failedConnections++;
      
      this.emit('device-connection-failed', { deviceId, protocol, error: error.message });
      
      throw error;
    }
  }

  async disconnectDevice(deviceId) {
    try {
      const session = this.deviceSessions.get(deviceId);
      if (!session) {
        console.warn(`No active session for device ${deviceId}`);
        return false;
      }
      
      const handler = this.protocolHandlers[session.protocol];
      if (handler && handler.disconnect) {
        await handler.disconnect(deviceId);
      }
      
      // Clean up session
      this.connectedDevices.delete(deviceId);
      this.deviceSessions.delete(deviceId);
      
      console.log(`🔌 Disconnected device ${deviceId}`);
      
      this.emit('device-disconnected', { deviceId, session });
      
      return true;
      
    } catch (error) {
      console.error(`Error disconnecting device ${deviceId}:`, error);
      return false;
    }
  }

  async sendCommand(deviceId, command, params = {}) {
    try {
      const session = this.deviceSessions.get(deviceId);
      if (!session) {
        throw new Error(`Device ${deviceId} not connected`);
      }
      
      const device = session.device;
      
      // Validate command against device capabilities
      if (!this.validateCommand(device, command)) {
        throw new Error(`Command ${command} not supported by device type ${device.type}`);
      }
      
      // Log command
      const commandRecord = {
        command,
        params,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      
      session.commands.push(commandRecord);
      session.lastActivity = new Date().toISOString();
      
      // Execute command based on device type and protocol
      const result = await this.executeDeviceCommand(session, command, params);
      
      commandRecord.status = 'completed';
      commandRecord.result = result;
      
      console.log(`📱 Command executed on ${deviceId}: ${command}`);
      
      this.emit('device-command-executed', { deviceId, command, params, result });
      
      return result;
      
    } catch (error) {
      console.error(`Error sending command to device ${deviceId}:`, error);
      throw error;
    }
  }

  // Mock Device Generators (for development/testing)
  mockBluetoothDevices() {
    const devices = [
      {
        id: 'bt_speaker_001',
        name: 'Sony WH-1000XM4',
        type: 'smart-speaker',
        protocol: 'bluetooth',
        rssi: -45,
        capabilities: this.config.deviceCapabilities['smart-speaker'],
        manufacturer: 'Sony',
        model: 'WH-1000XM4',
        discoveredAt: new Date().toISOString()
      },
      {
        id: 'bt_phone_001',
        name: 'iPhone 14 Pro',
        type: 'smartphone',
        protocol: 'bluetooth',
        rssi: -38,
        capabilities: this.config.deviceCapabilities['smartphone'],
        manufacturer: 'Apple',
        model: 'iPhone 14 Pro',
        discoveredAt: new Date().toISOString()
      }
    ];
    
    devices.forEach(device => {
      this.addDiscoveredDevice(device);
    });
  }

  mockWiFiDevices() {
    const devices = [
      {
        id: 'wifi_tv_001',
        name: 'Samsung Smart TV',
        type: 'smart-tv',
        protocol: 'wifi',
        ipAddress: '192.168.1.100',
        capabilities: this.config.deviceCapabilities['smart-tv'],
        manufacturer: 'Samsung',
        model: 'QN85A',
        discoveredAt: new Date().toISOString()
      },
      {
        id: 'wifi_console_001',
        name: 'PlayStation 5',
        type: 'game-console',
        protocol: 'wifi',
        ipAddress: '192.168.1.101',
        capabilities: this.config.deviceCapabilities['game-console'],
        manufacturer: 'Sony',
        model: 'PlayStation 5',
        discoveredAt: new Date().toISOString()
      }
    ];
    
    devices.forEach(device => {
      this.addDiscoveredDevice(device);
    });
  }

  mockUSBDevices() {
    const devices = [
      {
        id: 'usb_vr_001',
        name: 'Meta Quest 2',
        type: 'vr-headset',
        protocol: 'webusb',
        vendorId: 0x2833,
        productId: 0x0186,
        capabilities: this.config.deviceCapabilities['vr-headset'],
        manufacturer: 'Meta',
        model: 'Quest 2',
        discoveredAt: new Date().toISOString()
      }
    ];
    
    devices.forEach(device => {
      this.addDiscoveredDevice(device);
    });
  }

  mockNetworkDevices() {
    const devices = [
      {
        id: 'mdns_light_001',
        name: 'Philips Hue Bridge',
        type: 'smart-light',
        protocol: 'mdns',
        serviceType: '_hue._tcp',
        hostname: 'philips-hue.local',
        capabilities: this.config.deviceCapabilities['smart-light'],
        manufacturer: 'Philips',
        model: 'Hue Bridge',
        discoveredAt: new Date().toISOString()
      }
    ];
    
    devices.forEach(device => {
      this.addDiscoveredDevice(device);
    });
  }

  mockUPnPDevices() {
    const devices = [
      {
        id: 'upnp_speaker_001',
        name: 'Sonos One',
        type: 'smart-speaker',
        protocol: 'upnp',
        deviceType: 'urn:schemas-upnp-org:device:MediaRenderer:1',
        capabilities: this.config.deviceCapabilities['smart-speaker'],
        manufacturer: 'Sonos',
        model: 'One SL',
        discoveredAt: new Date().toISOString()
      }
    ];
    
    devices.forEach(device => {
      this.addDiscoveredDevice(device);
    });
  }

  // Device Management
  addDiscoveredDevice(device) {
    // Assign unique ID if not provided
    if (!device.id) {
      device.id = `${device.protocol}_${uuidv4().substr(0, 8)}`;
    }
    
    // Add metadata
    device.discoveredAt = device.discoveredAt || new Date().toISOString();
    device.lastSeen = new Date().toISOString();
    
    this.discoveredDevices.set(device.id, device);
    this.stats.devicesDiscovered++;
    
    console.log(`📱 Device discovered: ${device.name} (${device.type}) via ${device.protocol}`);
    
    this.emit('device-discovered', device);
  }

  validateCommand(device, command) {
    const capabilities = device.capabilities || [];
    
    const commandCapabilityMap = {
      'play': ['audio', 'display'],
      'pause': ['audio', 'display'],
      'stop': ['audio', 'display'],
      'volume_up': ['audio'],
      'volume_down': ['audio'],
      'mute': ['audio'],
      'change_channel': ['display'],
      'power_on': ['control'],
      'power_off': ['control'],
      'brightness_up': ['lighting', 'display'],
      'brightness_down': ['lighting', 'display'],
      'take_photo': ['camera'],
      'start_recording': ['camera'],
      'get_sensor_data': ['sensors']
    };
    
    const requiredCapabilities = commandCapabilityMap[command];
    if (!requiredCapabilities) {
      return false; // Unknown command
    }
    
    return requiredCapabilities.some(cap => capabilities.includes(cap));
  }

  async executeDeviceCommand(session, command, params) {
    // Mock command execution
    const device = session.device;
    
    switch (command) {
      case 'play':
        return { status: 'playing', media: params.media || 'default' };
      case 'pause':
        return { status: 'paused' };
      case 'stop':
        return { status: 'stopped' };
      case 'volume_up':
        return { status: 'volume_changed', level: (params.current || 50) + 10 };
      case 'volume_down':
        return { status: 'volume_changed', level: Math.max(0, (params.current || 50) - 10) };
      case 'power_on':
        return { status: 'powered_on' };
      case 'power_off':
        return { status: 'powered_off' };
      default:
        return { status: 'executed', command, params };
    }
  }

  // Maintenance and Cleanup
  startMaintenanceTasks() {
    // Clean up old discovered devices
    setInterval(() => {
      this.cleanupOldDevices();
    }, 300000); // Every 5 minutes
    
    // Update device statistics
    setInterval(() => {
      this.updateDeviceStatistics();
    }, 60000); // Every minute
    
    // Auto-discover devices periodically
    setInterval(() => {
      if (!this.isScanning) {
        this.startDiscovery(['mdns', 'upnp']); // Lightweight protocols
      }
    }, this.config.scanInterval);
    
    console.log('🔧 Device discovery maintenance tasks started');
  }

  cleanupOldDevices() {
    const now = Date.now();
    const devicesToRemove = [];
    
    for (const [deviceId, device] of this.discoveredDevices) {
      const age = now - new Date(device.lastSeen).getTime();
      
      if (age > this.config.deviceTimeout && !this.connectedDevices.has(deviceId)) {
        devicesToRemove.push(deviceId);
      }
    }
    
    devicesToRemove.forEach(deviceId => {
      this.discoveredDevices.delete(deviceId);
    });
    
    if (devicesToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${devicesToRemove.length} old devices`);
    }
  }

  updateDeviceStatistics() {
    console.log(`📊 Device stats: ${this.discoveredDevices.size} discovered, ${this.connectedDevices.size} connected`);
  }

  // Public API Methods
  getDiscoveredDevices() {
    return Array.from(this.discoveredDevices.values());
  }

  getConnectedDevices() {
    return Array.from(this.connectedDevices.values());
  }

  getDeviceStatistics() {
    return {
      ...this.stats,
      currentDiscovered: this.discoveredDevices.size,
      currentConnected: this.connectedDevices.size,
      protocolAvailability: Object.keys(this.protocolHandlers).reduce((acc, protocol) => {
        acc[protocol] = this.protocolHandlers[protocol]?.isAvailable || false;
        return acc;
      }, {})
    };
  }

  getDeviceSession(deviceId) {
    return this.deviceSessions.get(deviceId);
  }

  isDeviceConnected(deviceId) {
    return this.connectedDevices.has(deviceId);
  }

  disconnectAllDevices() {
    const deviceIds = Array.from(this.connectedDevices.keys());
    return Promise.all(deviceIds.map(id => this.disconnectDevice(id)));
  }
}
