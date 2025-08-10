/**
 * Device Connector for AR/VR Communication Platform
 * Client-side device connection and management
 */
export class DeviceConnector {
  constructor() {
    // Device state
    this.discoveredDevices = new Map();
    this.connectedDevices = new Map();
    this.deviceSessions = new Map();
    
    // Protocol handlers
    this.protocolHandlers = {
      bluetooth: null,
      wifi: null,
      nfc: null,
      webusb: null,
      network: null
    };
    
    // Scanning state
    this.isScanning = false;
    this.scanTimeouts = new Map();
    
    // Configuration
    this.config = {
      scanTimeout: 30000, // 30 seconds
      connectionTimeout: 15000, // 15 seconds
      maxDevices: 20,
      supportedProtocols: ['bluetooth', 'wifi', 'nfc', 'webusb', 'network'],
      autoReconnect: true,
      reconnectDelay: 5000,
      
      // Device filters
      deviceFilters: {
        bluetooth: {
          acceptAllDevices: false,
          optionalServices: ['battery_service', 'device_information']
        },
        usb: {
          filters: [
            { vendorId: 0x2833 }, // Meta/Oculus
            { vendorId: 0x28de }, // Valve
            { vendorId: 0x0bb4 }  // HTC
          ]
        }
      }
    };
    
    // Event handlers
    this.eventHandlers = new Map();
    
    // Statistics
    this.stats = {
      totalScans: 0,
      devicesFound: 0,
      connectionsAttempted: 0,
      connectionsSuccessful: 0,
      connectionsFailed: 0
    };
    
    this.init();
  }

  async init() {
    try {
      console.log('📱 Initializing Device Connector...');
      
      // Check browser capabilities
      await this.checkBrowserCapabilities();
      
      // Initialize protocol handlers
      await this.initializeProtocolHandlers();
      
      // Setup event listeners
      this.setupEventListeners();
      
      console.log('✅ Device Connector initialized');
      
    } catch (error) {
      console.error('❌ Device Connector initialization failed:', error);
      throw error;
    }
  }

  async checkBrowserCapabilities() {
    const capabilities = {
      bluetooth: 'bluetooth' in navigator,
      usb: 'usb' in navigator,
      nfc: 'nfc' in navigator,
      wifi: 'wifi' in navigator,
      geolocation: 'geolocation' in navigator,
      mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    };
    
    console.log('📱 Browser capabilities:', capabilities);
    
    this.browserCapabilities = capabilities;
    return capabilities;
  }

  async initializeProtocolHandlers() {
    // Initialize Bluetooth handler
    if (this.browserCapabilities.bluetooth) {
      await this.initializeBluetoothHandler();
    }
    
    // Initialize WebUSB handler
    if (this.browserCapabilities.usb) {
      await this.initializeWebUSBHandler();
    }
    
    // Initialize NFC handler
    if (this.browserCapabilities.nfc) {
      await this.initializeNFCHandler();
    }
    
    // Initialize WiFi handler
    await this.initializeWiFiHandler();
    
    // Initialize Network handler
    await this.initializeNetworkHandler();
    
    console.log('📱 Protocol handlers initialized');
  }

  async initializeBluetoothHandler() {
    try {
      this.protocolHandlers.bluetooth = {
        isAvailable: true,
        connectedDevices: new Map(),
        
        async scan(options = {}) {
          console.log('🔵 Starting Bluetooth scan...');
          
          try {
            const device = await navigator.bluetooth.requestDevice({
              acceptAllDevices: options.acceptAllDevices || false,
              filters: options.filters || [
                { services: ['battery_service'] },
                { services: ['device_information'] },
                { namePrefix: 'AR' },
                { namePrefix: 'VR' },
                { namePrefix: 'Smart' }
              ],
              optionalServices: options.optionalServices || [
                'battery_service',
                'device_information'
              ]
            });
            
            return this.handleBluetoothDevice(device);
            
          } catch (error) {
            if (error.name === 'NotFoundError') {
              console.log('🔵 No Bluetooth device selected');
              return null;
            }
            throw error;
          }
        },
        
        async connect(deviceId) {
          const deviceData = this.discoveredDevices.get(deviceId);
          if (!deviceData || !deviceData.bluetoothDevice) {
            throw new Error('Bluetooth device not found');
          }
          
          const device = deviceData.bluetoothDevice;
          
          try {
            console.log(`🔵 Connecting to Bluetooth device: ${device.name}`);
            
            const server = await device.gatt.connect();
            
            // Get device information
            const deviceInfo = await this.getBluetoothDeviceInfo(server);
            
            const session = {
              deviceId,
              device: deviceData,
              bluetoothDevice: device,
              server,
              services: new Map(),
              characteristics: new Map(),
              connectedAt: new Date().toISOString(),
              protocol: 'bluetooth',
              info: deviceInfo
            };
            
            this.connectedDevices.set(deviceId, deviceData);
            this.deviceSessions.set(deviceId, session);
            
            // Setup disconnect handler
            device.addEventListener('gattserverdisconnected', () => {
              this.handleDeviceDisconnected(deviceId, 'bluetooth');
            });
            
            return session;
            
          } catch (error) {
            console.error('🔵 Bluetooth connection failed:', error);
            throw error;
          }
        },
        
        async disconnect(deviceId) {
          const session = this.deviceSessions.get(deviceId);
          if (session && session.bluetoothDevice) {
            session.bluetoothDevice.gatt.disconnect();
            return true;
          }
          return false;
        },
        
        async sendCommand(deviceId, command, params) {
          const session = this.deviceSessions.get(deviceId);
          if (!session) {
            throw new Error('Device not connected');
          }
          
          // Implement command sending via Bluetooth characteristics
          console.log(`🔵 Sending command to ${deviceId}:`, command, params);
          
          return { status: 'sent', command, params };
        }
      };
      
      console.log('🔵 Bluetooth handler initialized');
      
    } catch (error) {
      console.warn('🔵 Bluetooth not available:', error);
      this.protocolHandlers.bluetooth = { isAvailable: false };
    }
  }

  async initializeWebUSBHandler() {
    try {
      this.protocolHandlers.webusb = {
        isAvailable: true,
        connectedDevices: new Map(),
        
        async scan(options = {}) {
          console.log('🔌 Starting WebUSB scan...');
          
          try {
            const device = await navigator.usb.requestDevice({
              filters: options.filters || this.config.deviceFilters.usb.filters
            });
            
            return this.handleUSBDevice(device);
            
          } catch (error) {
            if (error.name === 'NotFoundError') {
              console.log('🔌 No USB device selected');
              return null;
            }
            throw error;
          }
        },
        
        async connect(deviceId) {
          const deviceData = this.discoveredDevices.get(deviceId);
          if (!deviceData || !deviceData.usbDevice) {
            throw new Error('USB device not found');
          }
          
          const device = deviceData.usbDevice;
          
          try {
            console.log(`🔌 Connecting to USB device: ${device.productName}`);
            
            await device.open();
            
            if (device.configuration === null) {
              await device.selectConfiguration(1);
            }
            
            // Claim interface
            await device.claimInterface(0);
            
            const session = {
              deviceId,
              device: deviceData,
              usbDevice: device,
              connectedAt: new Date().toISOString(),
              protocol: 'webusb',
              interface: 0
            };
            
            this.connectedDevices.set(deviceId, deviceData);
            this.deviceSessions.set(deviceId, session);
            
            return session;
            
          } catch (error) {
            console.error('🔌 USB connection failed:', error);
            throw error;
          }
        },
        
        async disconnect(deviceId) {
          const session = this.deviceSessions.get(deviceId);
          if (session && session.usbDevice) {
            try {
              await session.usbDevice.releaseInterface(session.interface || 0);
              await session.usbDevice.close();
              return true;
            } catch (error) {
              console.error('Error disconnecting USB device:', error);
            }
          }
          return false;
        },
        
        async sendCommand(deviceId, command, params) {
          const session = this.deviceSessions.get(deviceId);
          if (!session) {
            throw new Error('Device not connected');
          }
          
          // Implement USB command sending
          console.log(`🔌 Sending USB command to ${deviceId}:`, command, params);
          
          return { status: 'sent', command, params };
        }
      };
      
      // Listen for USB device connections
      navigator.usb.addEventListener('connect', (event) => {
        console.log('🔌 USB device connected:', event.device);
        this.handleUSBDevice(event.device);
      });
      
      navigator.usb.addEventListener('disconnect', (event) => {
        console.log('🔌 USB device disconnected:', event.device);
        this.handleUSBDeviceDisconnected(event.device);
      });
      
      console.log('🔌 WebUSB handler initialized');
      
    } catch (error) {
      console.warn('🔌 WebUSB not available:', error);
      this.protocolHandlers.webusb = { isAvailable: false };
    }
  }

  async initializeNFCHandler() {
    try {
      this.protocolHandlers.nfc = {
        isAvailable: true,
        
        async scan(options = {}) {
          console.log('📱 Starting NFC scan...');
          
          try {
            const ndef = new NDEFReader();
            
            await ndef.scan();
            
            ndef.addEventListener('readingerror', () => {
              console.log('📱 Cannot read data from the NFC tag. Try another one?');
            });
            
            ndef.addEventListener('reading', ({ message, serialNumber }) => {
              console.log(`📱 Serial Number: ${serialNumber}`);
              console.log(`📱 Records: (${message.records.length})`);
              
              this.handleNFCDevice({
                serialNumber,
                message,
                discoveredAt: new Date().toISOString()
              });
            });
            
            return true;
            
          } catch (error) {
            console.error('📱 NFC scan failed:', error);
            throw error;
          }
        },
        
        async connect(deviceId) {
          // NFC connections are typically read-only
          const deviceData = this.discoveredDevices.get(deviceId);
          if (!deviceData) {
            throw new Error('NFC device not found');
          }
          
          const session = {
            deviceId,
            device: deviceData,
            connectedAt: new Date().toISOString(),
            protocol: 'nfc',
            readonly: true
          };
          
          this.connectedDevices.set(deviceId, deviceData);
          this.deviceSessions.set(deviceId, session);
          
          return session;
        },
        
        async disconnect(deviceId) {
          // NFC doesn't require explicit disconnection
          return true;
        }
      };
      
      console.log('📱 NFC handler initialized');
      
    } catch (error) {
      console.warn('📱 NFC not available:', error);
      this.protocolHandlers.nfc = { isAvailable: false };
    }
  }

  async initializeWiFiHandler() {
    try {
      this.protocolHandlers.wifi = {
        isAvailable: true,
        
        async scan(options = {}) {
          console.log('📶 Starting WiFi scan...');
          
          // WiFi Direct scanning would require native implementation
          // For now, we'll simulate discovery
          setTimeout(() => {
            this.mockWiFiDevices();
          }, 2000);
          
          return true;
        },
        
        async connect(deviceId) {
          const deviceData = this.discoveredDevices.get(deviceId);
          if (!deviceData) {
            throw new Error('WiFi device not found');
          }
          
          // Mock WiFi connection
          const session = {
            deviceId,
            device: deviceData,
            connectedAt: new Date().toISOString(),
            protocol: 'wifi',
            ipAddress: deviceData.ipAddress
          };
          
          this.connectedDevices.set(deviceId, deviceData);
          this.deviceSessions.set(deviceId, session);
          
          return session;
        },
        
        async disconnect(deviceId) {
          return true;
        },
        
        async sendCommand(deviceId, command, params) {
          const session = this.deviceSessions.get(deviceId);
          if (!session) {
            throw new Error('Device not connected');
          }
          
          // Implement WiFi command sending
          console.log(`📶 Sending WiFi command to ${deviceId}:`, command, params);
          
          return { status: 'sent', command, params };
        }
      };
      
      console.log('📶 WiFi handler initialized');
      
    } catch (error) {
      console.warn('📶 WiFi not available:', error);
      this.protocolHandlers.wifi = { isAvailable: false };
    }
  }

  async initializeNetworkHandler() {
    try {
      this.protocolHandlers.network = {
        isAvailable: true,
        
        async scan(options = {}) {
          console.log('🌐 Starting network scan...');
          
          // Network device discovery would typically use mDNS/Bonjour
          // For now, we'll simulate discovery
          setTimeout(() => {
            this.mockNetworkDevices();
          }, 1500);
          
          return true;
        },
        
        async connect(deviceId) {
          const deviceData = this.discoveredDevices.get(deviceId);
          if (!deviceData) {
            throw new Error('Network device not found');
          }
          
          const session = {
            deviceId,
            device: deviceData,
            connectedAt: new Date().toISOString(),
            protocol: 'network',
            endpoint: deviceData.endpoint
          };
          
          this.connectedDevices.set(deviceId, deviceData);
          this.deviceSessions.set(deviceId, session);
          
          return session;
        },
        
        async disconnect(deviceId) {
          return true;
        },
        
        async sendCommand(deviceId, command, params) {
          const session = this.deviceSessions.get(deviceId);
          if (!session) {
            throw new Error('Device not connected');
          }
          
          // Send HTTP/WebSocket command to network device
          try {
            const response = await fetch(`${session.endpoint}/api/command`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ command, params })
            });
            
            const result = await response.json();
            
            console.log(`🌐 Network command sent to ${deviceId}:`, command);
            
            return result;
            
          } catch (error) {
            console.error('Network command failed:', error);
            throw error;
          }
        }
      };
      
      console.log('🌐 Network handler initialized');
      
    } catch (error) {
      console.warn('🌐 Network handler not available:', error);
      this.protocolHandlers.network = { isAvailable: false };
    }
  }

  // Device Discovery Methods
  async scanAll() {
    try {
      console.log('📡 Starting comprehensive device scan...');
      
      this.isScanning = true;
      this.stats.totalScans++;
      
      const scanPromises = [];
      
      // Scan with each available protocol
      for (const [protocol, handler] of Object.entries(this.protocolHandlers)) {
        if (handler && handler.isAvailable && handler.scan) {
          scanPromises.push(
            handler.scan().catch(error => {
              console.warn(`${protocol} scan failed:`, error);
              return null;
            })
          );
        }
      }
      
      // Wait for all scans to complete or timeout
      const results = await Promise.allSettled(scanPromises);
      
      // Set timeout to stop scanning
      setTimeout(() => {
        this.stopScanning();
      }, this.config.scanTimeout);
      
      this.emit('scan-started', { protocols: Object.keys(this.protocolHandlers) });
      
      return results;
      
    } catch (error) {
      console.error('Device scan failed:', error);
      this.isScanning = false;
      throw error;
    }
  }

  async scanProtocol(protocol) {
    const handler = this.protocolHandlers[protocol];
    if (!handler || !handler.isAvailable) {
      throw new Error(`Protocol ${protocol} not available`);
    }
    
    console.log(`📡 Scanning for ${protocol} devices...`);
    
    try {
      const result = await handler.scan();
      this.emit('protocol-scan-complete', { protocol, result });
      return result;
    } catch (error) {
      console.error(`${protocol} scan failed:`, error);
      this.emit('protocol-scan-error', { protocol, error });
      throw error;
    }
  }

  stopScanning() {
    if (!this.isScanning) {
      return;
    }
    
    console.log('📡 Stopping device scan...');
    this.isScanning = false;
    
    // Clear any scan timeouts
    for (const timeout of this.scanTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.scanTimeouts.clear();
    
    this.emit('scan-stopped', { devicesFound: this.discoveredDevices.size });
  }

  // Device Connection Methods
  async connect(protocol, deviceId) {
    try {
      const handler = this.protocolHandlers[protocol];
      if (!handler || !handler.isAvailable) {
        throw new Error(`Protocol ${protocol} not available`);
      }
      
      // Check if already connected
      if (this.connectedDevices.has(deviceId)) {
        console.warn(`Device ${deviceId} already connected`);
        return this.deviceSessions.get(deviceId);
      }
      
      // Check device limit
      if (this.connectedDevices.size >= this.config.maxDevices) {
        throw new Error('Maximum device limit reached');
      }
      
      console.log(`🔗 Connecting to ${protocol} device: ${deviceId}`);
      
      this.stats.connectionsAttempted++;
      
      const session = await handler.connect(deviceId);
      
      this.stats.connectionsSuccessful++;
      
      this.emit('device-connected', { deviceId, protocol, session });
      
      return session;
      
    } catch (error) {
      console.error(`Connection failed for ${deviceId}:`, error);
      this.stats.connectionsFailed++;
      
      this.emit('device-connection-failed', { deviceId, protocol, error });
      
      throw error;
    }
  }

  async disconnect(deviceId) {
    try {
      const session = this.deviceSessions.get(deviceId);
      if (!session) {
        console.warn(`No session found for device ${deviceId}`);
        return false;
      }
      
      const handler = this.protocolHandlers[session.protocol];
      if (handler && handler.disconnect) {
        await handler.disconnect(deviceId);
      }
      
      // Clean up
      this.connectedDevices.delete(deviceId);
      this.deviceSessions.delete(deviceId);
      
      console.log(`🔌 Disconnected device: ${deviceId}`);
      
      this.emit('device-disconnected', { deviceId, session });
      
      return true;
      
    } catch (error) {
      console.error(`Disconnect failed for ${deviceId}:`, error);
      return false;
    }
  }

  async disconnectAll() {
    const deviceIds = Array.from(this.connectedDevices.keys());
    
    const results = await Promise.allSettled(
      deviceIds.map(deviceId => this.disconnect(deviceId))
    );
    
    console.log(`🔌 Disconnected ${results.length} devices`);
    
    return results;
  }

  // Device Command Methods
  async sendCommand(deviceId, command, params = {}) {
    try {
      const session = this.deviceSessions.get(deviceId);
      if (!session) {
        throw new Error(`Device ${deviceId} not connected`);
      }
      
      const handler = this.protocolHandlers[session.protocol];
      if (!handler || !handler.sendCommand) {
        throw new Error(`Protocol ${session.protocol} does not support commands`);
      }
      
      console.log(`📱 Sending command to ${deviceId}:`, command, params);
      
      const result = await handler.sendCommand(deviceId, command, params);
      
      this.emit('command-sent', { deviceId, command, params, result });
      
      return result;
      
    } catch (error) {
      console.error(`Command failed for ${deviceId}:`, error);
      
      this.emit('command-failed', { deviceId, command, params, error });
      
      throw error;
    }
  }

  // Device Data Handlers
  handleBluetoothDevice(device) {
    const deviceData = {
      id: `bt_${device.id}`,
      name: device.name || 'Unknown Bluetooth Device',
      type: this.inferDeviceType(device.name),
      protocol: 'bluetooth',
      bluetoothDevice: device,
      capabilities: this.getDeviceCapabilities(device),
      discoveredAt: new Date().toISOString(),
      rssi: null // Would need additional API to get RSSI
    };
    
    this.addDiscoveredDevice(deviceData);
    return deviceData;
  }

  handleUSBDevice(device) {
    const deviceData = {
      id: `usb_${device.serialNumber || device.productId}`,
      name: device.productName || 'Unknown USB Device',
      type: this.inferDeviceTypeFromUSB(device),
      protocol: 'webusb',
      usbDevice: device,
      vendorId: device.vendorId,
      productId: device.productId,
      capabilities: this.getUSBDeviceCapabilities(device),
      discoveredAt: new Date().toISOString()
    };
    
    this.addDiscoveredDevice(deviceData);
    return deviceData;
  }

  handleNFCDevice(nfcData) {
    const deviceData = {
      id: `nfc_${nfcData.serialNumber}`,
      name: 'NFC Tag',
      type: 'nfc-tag',
      protocol: 'nfc',
      serialNumber: nfcData.serialNumber,
      message: nfcData.message,
      capabilities: ['data'],
      discoveredAt: nfcData.discoveredAt
    };
    
    this.addDiscoveredDevice(deviceData);
    return deviceData;
  }

  handleUSBDeviceDisconnected(device) {
    const deviceId = `usb_${device.serialNumber || device.productId}`;
    this.handleDeviceDisconnected(deviceId, 'webusb');
  }

  handleDeviceDisconnected(deviceId, protocol) {
    console.log(`🔌 Device disconnected: ${deviceId} (${protocol})`);
    
    this.connectedDevices.delete(deviceId);
    this.deviceSessions.delete(deviceId);
    
    this.emit('device-disconnected', { deviceId, protocol });
    
    // Auto-reconnect if enabled
    if (this.config.autoReconnect) {
      setTimeout(() => {
        this.attemptReconnection(deviceId, protocol);
      }, this.config.reconnectDelay);
    }
  }

  async attemptReconnection(deviceId, protocol) {
    try {
      if (this.discoveredDevices.has(deviceId)) {
        console.log(`🔄 Attempting to reconnect to ${deviceId}...`);
        await this.connect(protocol, deviceId);
      }
    } catch (error) {
      console.warn(`Reconnection failed for ${deviceId}:`, error);
    }
  }

  addDiscoveredDevice(deviceData) {
    this.discoveredDevices.set(deviceData.id, deviceData);
    this.stats.devicesFound++;
    
    console.log(`📱 Device discovered: ${deviceData.name} (${deviceData.protocol})`);
    
    this.emit('device-found', deviceData);
  }

  // Mock Device Generators
  mockWiFiDevices() {
    const devices = [
      {
        id: 'wifi_tv_mock',
        name: 'Samsung Smart TV',
        type: 'smart-tv',
        protocol: 'wifi',
        ipAddress: '192.168.1.100',
        capabilities: ['display', 'audio', 'control'],
        discoveredAt: new Date().toISOString()
      },
      {
        id: 'wifi_speaker_mock',
        name: 'Sonos Speaker',
        type: 'smart-speaker',
        protocol: 'wifi',
        ipAddress: '192.168.1.101',
        capabilities: ['audio', 'control'],
        discoveredAt: new Date().toISOString()
      }
    ];
    
    devices.forEach(device => this.addDiscoveredDevice(device));
  }

  mockNetworkDevices() {
    const devices = [
      {
        id: 'net_light_mock',
        name: 'Philips Hue Lights',
        type: 'smart-light',
        protocol: 'network',
        endpoint: 'http://192.168.1.102',
        capabilities: ['lighting', 'control'],
        discoveredAt: new Date().toISOString()
      }
    ];
    
    devices.forEach(device => this.addDiscoveredDevice(device));
  }

  // Utility Methods
  inferDeviceType(deviceName) {
    if (!deviceName) return 'unknown';
    
    const name = deviceName.toLowerCase();
    
    if (name.includes('headphone') || name.includes('speaker')) return 'smart-speaker';
    if (name.includes('tv') || name.includes('display')) return 'smart-tv';
    if (name.includes('phone')) return 'smartphone';
    if (name.includes('tablet') || name.includes('ipad')) return 'tablet';
    if (name.includes('quest') || name.includes('vr')) return 'vr-headset';
    if (name.includes('hololens') || name.includes('ar')) return 'ar-glasses';
    if (name.includes('console') || name.includes('xbox') || name.includes('playstation')) return 'game-console';
    
    return 'unknown';
  }

  inferDeviceTypeFromUSB(device) {
    // Infer device type from USB vendor/product IDs
    const vendorMap = {
      0x2833: 'vr-headset', // Meta/Oculus
      0x28de: 'game-console', // Valve
      0x0bb4: 'vr-headset', // HTC
      0x045e: 'game-console', // Microsoft
      0x054c: 'game-console'  // Sony
    };
    
    return vendorMap[device.vendorId] || 'unknown';
  }

  getDeviceCapabilities(device) {
    // Determine capabilities based on device services/characteristics
    const capabilities = [];
    
    // This would typically examine Bluetooth services
    capabilities.push('control');
    
    return capabilities;
  }

  getUSBDeviceCapabilities(device) {
    const capabilities = ['control'];
    
    // Add capabilities based on device type
    const deviceType = this.inferDeviceTypeFromUSB(device);
    
    switch (deviceType) {
      case 'vr-headset':
        capabilities.push('display', 'sensors', 'audio', 'haptic');
        break;
      case 'game-console':
        capabilities.push('display', 'audio', 'input', 'compute');
        break;
      default:
        break;
    }
    
    return capabilities;
  }

  async getBluetoothDeviceInfo(server) {
    try {
      // Try to get device information service
      const service = await server.getPrimaryService('device_information');
      const characteristics = await service.getCharacteristics();
      
      const info = {};
      
      for (const characteristic of characteristics) {
        try {
          const value = await characteristic.readValue();
          const text = new TextDecoder().decode(value);
          
          switch (characteristic.uuid) {
            case '00002a29-0000-1000-8000-00805f9b34fb': // Manufacturer Name
              info.manufacturer = text;
              break;
            case '00002a24-0000-1000-8000-00805f9b34fb': // Model Number
              info.model = text;
              break;
            case '00002a25-0000-1000-8000-00805f9b34fb': // Serial Number
              info.serialNumber = text;
              break;
            case '00002a27-0000-1000-8000-00805f9b34fb': // Hardware Revision
              info.hardwareRevision = text;
              break;
            case '00002a26-0000-1000-8000-00805f9b34fb': // Firmware Revision
              info.firmwareRevision = text;
              break;
          }
        } catch (error) {
          // Characteristic might not be readable
        }
      }
      
      return info;
      
    } catch (error) {
      console.warn('Could not read device information:', error);
      return {};
    }
  }

  setupEventListeners() {
    // Handle page visibility changes
    document.addEventListener('visibilitychange
