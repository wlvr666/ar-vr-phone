// device-connector.js - Universal Device Connection Manager

export class DeviceConnector extends EventTarget {
    constructor() {
        super();
        this.connectedDevices = new Map();
        this.discoveredDevices = new Map();
        this.scanningActive = false;
        this.supportedProtocols = new Set();
        
        // Protocol managers
        this.bluetooth = null;
        this.wifi = null;
        this.nfc = null;
        this.webusb = null;
        this.upnp = null;
        
        // Scanning intervals
        this.scanIntervals = new Map();
        
        // Device capabilities
        this.capabilities = {
            bluetooth: false,
            wifi: false,
            nfc: false,
            webusb: false,
            upnp: false
        };
        
        this.isInitialized = false;
    }

    async init() {
        console.log('🔧 Initializing Device Connector...');
        
        try {
            // Check available protocols
            await this.checkCapabilities();
            
            // Initialize available protocols
            await this.initializeProtocols();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('✅ Device Connector initialized');
            console.log('Supported protocols:', Array.from(this.supportedProtocols));
            
        } catch (error) {
            console.error('❌ Device Connector initialization failed:', error);
            throw error;
        }
    }

    async checkCapabilities() {
        // Check Bluetooth support
        if (navigator.bluetooth) {
            this.capabilities.bluetooth = true;
            this.supportedProtocols.add('bluetooth');
            console.log('📶 Bluetooth support detected');
        }

        // Check WebUSB support
        if (navigator.usb) {
            this.capabilities.webusb = true;
            this.supportedProtocols.add('webusb');
            console.log('🔌 WebUSB support detected');
        }

        // Check NFC support (experimental)
        if ('NDEFReader' in window) {
            this.capabilities.nfc = true;
            this.supportedProtocols.add('nfc');
            console.log('📡 NFC support detected');
        }

        // Check WiFi Direct support (limited browser support)
        if (navigator.wifi || navigator.networkInformation) {
            this.capabilities.wifi = true;
            this.supportedProtocols.add('wifi');
            console.log('📶 WiFi capabilities detected');
        }

        // UPnP/mDNS support (always available through network APIs)
        this.capabilities.upnp = true;
        this.supportedProtocols.add('upnp');
        console.log('🌐 Network discovery support available');

        if (this.supportedProtocols.size === 0) {
            throw new Error('No supported device protocols available');
        }
    }

    async initializeProtocols() {
        // Initialize Bluetooth
        if (this.capabilities.bluetooth) {
            this.bluetooth = new BluetoothManager();
            await this.bluetooth.init();
        }

        // Initialize WebUSB
        if (this.capabilities.webusb) {
            this.webusb = new WebUSBManager();
            await this.webusb.init();
        }

        // Initialize NFC
        if (this.capabilities.nfc) {
            this.nfc = new NFCManager();
            await this.nfc.init();
        }

        // Initialize WiFi
        if (this.capabilities.wifi) {
            this.wifi = new WiFiManager();
            await this.wifi.init();
        }

        // Initialize UPnP/Network Discovery
        if (this.capabilities.upnp) {
            this.upnp = new UPnPManager();
            await this.upnp.init();
        }
    }

    setupEventListeners() {
        // Listen for protocol-specific events
        if (this.bluetooth) {
            this.bluetooth.addEventListener('deviceFound', (e) => this.onDeviceFound(e.detail));
            this.bluetooth.addEventListener('deviceConnected', (e) => this.onDeviceConnected(e.detail));
            this.bluetooth.addEventListener('deviceDisconnected', (e) => this.onDeviceDisconnected(e.detail));
        }

        if (this.webusb) {
            this.webusb.addEventListener('deviceFound', (e) => this.onDeviceFound(e.detail));
            this.webusb.addEventListener('deviceConnected', (e) => this.onDeviceConnected(e.detail));
        }

        if (this.nfc) {
            this.nfc.addEventListener('tagDetected', (e) => this.onNFCTagDetected(e.detail));
        }

        if (this.wifi) {
            this.wifi.addEventListener('deviceFound', (e) => this.onDeviceFound(e.detail));
            this.wifi.addEventListener('networkConnected', (e) => this.onNetworkConnected(e.detail));
        }

        if (this.upnp) {
            this.upnp.addEventListener('deviceFound', (e) => this.onDeviceFound(e.detail));
            this.upnp.addEventListener('serviceDiscovered', (e) => this.onServiceDiscovered(e.detail));
        }
    }

    // Main scanning function
    async scanAllDevices() {
        if (this.scanningActive) {
            console.log('⚠️ Scanning already in progress');
            return;
        }

        console.log('🔍 Starting universal device scan...');
        this.scanningActive = true;
        
        const scanPromises = [];

        try {
            // Scan with all available protocols
            if (this.bluetooth) {
                scanPromises.push(this.scanBluetooth());
            }

            if (this.webusb) {
                scanPromises.push(this.scanWebUSB());
            }

            if (this.nfc) {
                scanPromises.push(this.scanNFC());
            }

            if (this.wifi) {
                scanPromises.push(this.scanWiFi());
            }

            if (this.upnp) {
                scanPromises.push(this.scanUPnP());
            }

            // Wait for all scans to complete
            const results = await Promise.allSettled(scanPromises);
            
            // Process results
            let totalFound = 0;
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    totalFound += result.value || 0;
                } else {
                    console.error('Scan failed:', result.reason);
                }
            });

            console.log(`✅ Device scan completed. Found ${totalFound} devices.`);
            return Array.from(this.discoveredDevices.values());

        } catch (error) {
            console.error('❌ Device scan failed:', error);
            throw error;
        } finally {
            this.scanningActive = false;
        }
    }

    // Protocol-specific scanning methods
    async scanBluetooth() {
        if (!this.bluetooth) return 0;
        
        try {
            console.log('📶 Scanning Bluetooth devices...');
            return await this.bluetooth.scan();
        } catch (error) {
            console.error('Bluetooth scan failed:', error);
            return 0;
        }
    }

    async scanWebUSB() {
        if (!this.webusb) return 0;
        
        try {
            console.log('🔌 Scanning USB devices...');
            return await this.webusb.scan();
        } catch (error) {
            console.error('WebUSB scan failed:', error);
            return 0;
        }
    }

    async scanNFC() {
        if (!this.nfc) return 0;
        
        try {
            console.log('📡 Starting NFC scan...');
            return await this.nfc.startScanning();
        } catch (error) {
            console.error('NFC scan failed:', error);
            return 0;
        }
    }

    async scanWiFi() {
        if (!this.wifi) return 0;
        
        try {
            console.log('📶 Scanning WiFi networks...');
            return await this.wifi.scan();
        } catch (error) {
            console.error('WiFi scan failed:', error);
            return 0;
        }
    }

    async scanUPnP() {
        if (!this.upnp) return 0;
        
        try {
            console.log('🌐 Scanning network devices...');
            return await this.upnp.scan();
        } catch (error) {
            console.error('UPnP scan failed:', error);
            return 0;
        }
    }

    // Device connection methods
    async connectToDevice(deviceId, protocol) {
        const device = this.discoveredDevices.get(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        console.log(`🔗 Connecting to ${device.name} via ${protocol}...`);

        try {
            let connectionResult;

            switch (protocol) {
                case 'bluetooth':
                    connectionResult = await this.bluetooth.connect(device);
                    break;
                case 'webusb':
                    connectionResult = await this.webusb.connect(device);
                    break;
                case 'wifi':
                    connectionResult = await this.wifi.connect(device);
                    break;
                case 'upnp':
                    connectionResult = await this.upnp.connect(device);
                    break;
                default:
                    throw new Error(`Unsupported protocol: ${protocol}`);
            }

            if (connectionResult) {
                this.connectedDevices.set(deviceId, {
                    ...device,
                    protocol,
                    connection: connectionResult,
                    connectedAt: Date.now()
                });

                this.dispatchEvent(new CustomEvent('deviceConnected', {
                    detail: device
                }));

                console.log(`✅ Connected to ${device.name}`);
                return connectionResult;
            }

        } catch (error) {
            console.error(`❌ Failed to connect to ${device.name}:`, error);
            throw error;
        }
    }

    async disconnectDevice(deviceId) {
        const device = this.connectedDevices.get(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not connected`);
        }

        try {
            switch (device.protocol) {
                case 'bluetooth':
                    await this.bluetooth.disconnect(device);
                    break;
                case 'webusb':
                    await this.webusb.disconnect(device);
                    break;
                case 'wifi':
                    await this.wifi.disconnect(device);
                    break;
                case 'upnp':
                    await this.upnp.disconnect(device);
                    break;
            }

            this.connectedDevices.delete(deviceId);
            
            this.dispatchEvent(new CustomEvent('deviceDisconnected', {
                detail: device
            }));

            console.log(`🔌 Disconnected from ${device.name}`);

        } catch (error) {
            console.error(`❌ Failed to disconnect from ${device.name}:`, error);
            throw error;
        }
    }

    // Device communication
    async sendCommand(deviceId, command, data = {}) {
        const device = this.connectedDevices.get(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not connected`);
        }

        try {
            let result;

            switch (device.protocol) {
                case 'bluetooth':
                    result = await this.bluetooth.sendCommand(device, command, data);
                    break;
                case 'webusb':
                    result = await this.webusb.sendCommand(device, command, data);
                    break;
                case 'wifi':
                    result = await this.wifi.sendCommand(device, command, data);
                    break;
                case 'upnp':
                    result = await this.upnp.sendCommand(device, command, data);
                    break;
                default:
                    throw new Error(`Protocol ${device.protocol} doesn't support commands`);
            }

            console.log(`📤 Sent command '${command}' to ${device.name}`);
            return result;

        } catch (error) {
            console.error(`❌ Failed to send command to ${device.name}:`, error);
            throw error;
        }
    }

    // Event handlers
    onDeviceFound(deviceData) {
        const device = {
            id: this.generateDeviceId(deviceData),
            name: deviceData.name || 'Unknown Device',
            type: this.detectDeviceType(deviceData),
            protocol: deviceData.protocol,
            capabilities: deviceData.capabilities || [],
            rssi: deviceData.rssi || null,
            discoveredAt: Date.now(),
            ...deviceData
        };

        this.discoveredDevices.set(device.id, device);
        
        console.log(`📱 Found device: ${device.name} (${device.protocol})`);
        
        this.dispatchEvent(new CustomEvent('deviceFound', {
            detail: device
        }));
    }

    onDeviceConnected(deviceData) {
        console.log(`🔗 Device connected: ${deviceData.name}`);
        
        this.dispatchEvent(new CustomEvent('deviceConnected', {
            detail: deviceData
        }));
    }

    onDeviceDisconnected(deviceData) {
        console.log(`🔌 Device disconnected: ${deviceData.name}`);
        
        this.dispatchEvent(new CustomEvent('deviceDisconnected', {
            detail: deviceData
        }));
    }

    onNFCTagDetected(tagData) {
        console.log('📡 NFC tag detected:', tagData);
        
        this.dispatchEvent(new CustomEvent('nfcTagDetected', {
            detail: tagData
        }));
    }

    onNetworkConnected(networkData) {
        console.log('📶 Network connected:', networkData);
        
        this.dispatchEvent(new CustomEvent('networkConnected', {
            detail: networkData
        }));
    }

    onServiceDiscovered(serviceData) {
        console.log('🌐 Service discovered:', serviceData);
        
        this.dispatchEvent(new CustomEvent('serviceDiscovered', {
            detail: serviceData
        }));
    }

    // Utility methods
    generateDeviceId(deviceData) {
        // Generate unique ID based on device properties
        const identifier = deviceData.address || 
                          deviceData.serialNumber || 
                          deviceData.uuid || 
                          deviceData.name + deviceData.protocol;
        
        return btoa(identifier).replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
    }

    detectDeviceType(deviceData) {
        const name = (deviceData.name || '').toLowerCase();
        const serviceUUIDs = deviceData.serviceUUIDs || [];
        
        // TV detection
        if (name.includes('tv') || name.includes('samsung') || name.includes('lg') || 
            serviceUUIDs.includes('0000110E-0000-1000-8000-00805F9B34FB')) {
            return 'tv';
        }
        
        // Speaker detection
        if (name.includes('speaker') || name.includes('audio') || name.includes('sound') ||
            serviceUUIDs.includes('0000110B-0000-1000-8000-00805F9B34FB')) {
            return 'speaker';
        }
        
        // Smartphone detection
        if (name.includes('phone') || name.includes('iphone') || name.includes('android')) {
            return 'smartphone';
        }
        
        // Game console detection
        if (name.includes('playstation') || name.includes('xbox') || name.includes('nintendo')) {
            return 'console';
        }
        
        // IoT device detection
        if (name.includes('light') || name.includes('bulb') || name.includes('switch')) {
            return 'iot';
        }
        
        // Computer detection
        if (name.includes('pc') || name.includes('laptop') || name.includes('computer')) {
            return 'computer';
        }
        
        return 'unknown';
    }

    // Status methods
    getConnectedDevices() {
        return Array.from(this.connectedDevices.values());
    }

    getDiscoveredDevices() {
        return Array.from(this.discoveredDevices.values());
    }

    isDeviceConnected(deviceId) {
        return this.connectedDevices.has(deviceId);
    }

    getSupportedProtocols() {
        return Array.from(this.supportedProtocols);
    }

    // Cleanup
    async destroy() {
        console.log('🧹 Cleaning up Device Connector...');
        
        // Stop all scanning
        this.scanningActive = false;
        this.scanIntervals.forEach(interval => clearInterval(interval));
        this.scanIntervals.clear();
        
        // Disconnect all devices
        const disconnectPromises = Array.from(this.connectedDevices.keys()).map(
            deviceId => this.disconnectDevice(deviceId).catch(console.error)
        );
        await Promise.allSettled(disconnectPromises);
        
        // Cleanup protocol managers
        if (this.bluetooth) this.bluetooth.destroy();
        if (this.webusb) this.webusb.destroy();
        if (this.nfc) this.nfc.destroy();
        if (this.wifi) this.wifi.destroy();
        if (this.upnp) this.upnp.destroy();
        
        this.connectedDevices.clear();
        this.discoveredDevices.clear();
        
        console.log('✅ Device Connector cleaned up');
    }
}

// Protocol-specific manager classes
class BluetoothManager extends EventTarget {
    constructor() {
        super();
        this.devices = new Map();
        this.characteristics = new Map();
    }

    async init() {
        if (!navigator.bluetooth) {
            throw new Error('Bluetooth not supported');
        }
        console.log('📶 Bluetooth manager initialized');
    }

    async scan() {
        try {
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [
                    'device_information',
                    'battery_service',
                    'human_interface_device',
                    'audio_sink'
                ]
            });

            if (device) {
                const deviceData = {
                    name: device.name,
                    address: device.id,
                    protocol: 'bluetooth',
                    serviceUUIDs: device.uuids,
                    capabilities: ['audio', 'data']
                };

                this.dispatchEvent(new CustomEvent('deviceFound', {
                    detail: deviceData
                }));

                return 1;
            }
            return 0;
        } catch (error) {
            if (error.name !== 'NotFoundError') {
                throw error;
            }
            return 0;
        }
    }

    async connect(device) {
        try {
            const btDevice = await navigator.bluetooth.requestDevice({
                filters: [{ name: device.name }]
            });

            const server = await btDevice.gatt.connect();
            
            this.devices.set(device.id, {
                device: btDevice,
                server: server
            });

            this.dispatchEvent(new CustomEvent('deviceConnected', {
                detail: device
            }));

            return server;
        } catch (error) {
            throw new Error(`Bluetooth connection failed: ${error.message}`);
        }
    }

    async disconnect(device) {
        const btConnection = this.devices.get(device.id);
        if (btConnection && btConnection.server.connected) {
            btConnection.server.disconnect();
            this.devices.delete(device.id);
        }
    }

    async sendCommand(device, command, data) {
        const btConnection = this.devices.get(device.id);
        if (!btConnection) {
            throw new Error('Device not connected');
        }

        // Implementation depends on device-specific protocols
        console.log(`Sending Bluetooth command: ${command}`, data);
        return { success: true, command, data };
    }

    destroy() {
        this.devices.forEach((connection) => {
            if (connection.server.connected) {
                connection.server.disconnect();
            }
        });
        this.devices.clear();
    }
}

class WebUSBManager extends EventTarget {
    constructor() {
        super();
        this.devices = new Map();
    }

    async init() {
        if (!navigator.usb) {
            throw new Error('WebUSB not supported');
        }
        console.log('🔌 WebUSB manager initialized');
    }

    async scan() {
        try {
            const device = await navigator.usb.requestDevice({
                filters: []
            });

            if (device) {
                const deviceData = {
                    name: device.productName || 'USB Device',
                    serialNumber: device.serialNumber,
                    protocol: 'webusb',
                    vendorId: device.vendorId,
                    productId: device.productId,
                    capabilities: ['data']
                };

                this.dispatchEvent(new CustomEvent('deviceFound', {
                    detail: deviceData
                }));

                return 1;
            }
            return 0;
        } catch (error) {
            if (error.name !== 'NotFoundError') {
                throw error;
            }
            return 0;
        }
    }

    async connect(device) {
        try {
            const usbDevice = await navigator.usb.requestDevice({
                filters: [{ vendorId: device.vendorId }]
            });

            await usbDevice.open();
            
            if (usbDevice.configuration === null) {
                await usbDevice.selectConfiguration(1);
            }

            this.devices.set(device.id, usbDevice);
            return usbDevice;
        } catch (error) {
            throw new Error(`WebUSB connection failed: ${error.message}`);
        }
    }

    async disconnect(device) {
        const usbDevice = this.devices.get(device.id);
        if (usbDevice && usbDevice.opened) {
            await usbDevice.close();
            this.devices.delete(device.id);
        }
    }

    async sendCommand(device, command, data) {
        const usbDevice = this.devices.get(device.id);
        if (!usbDevice) {
            throw new Error('Device not connected');
        }

        // Implementation depends on device-specific protocols
        console.log(`Sending USB command: ${command}`, data);
        return { success: true, command, data };
    }

    destroy() {
        this.devices.forEach(async (device) => {
            if (device.opened) {
                await device.close();
            }
        });
        this.devices.clear();
    }
}

class NFCManager extends EventTarget {
    constructor() {
        super();
        this.reader = null;
        this.scanning = false;
    }

    async init() {
        if (!('NDEFReader' in window)) {
            throw new Error('NFC not supported');
        }
        this.reader = new NDEFReader();
        console.log('📡 NFC manager initialized');
    }

    async startScanning() {
        if (this.scanning) return 0;

        try {
            await this.reader.scan();
            this.scanning = true;

            this.reader.addEventListener('reading', (event) => {
                const tagData = {
                    serialNumber: event.serialNumber,
                    records: event.message.records,
                    protocol: 'nfc',
                    name: 'NFC Tag',
                    capabilities: ['data']
                };

                this.dispatchEvent(new CustomEvent('tagDetected', {
                    detail: tagData
                }));
            });

            console.log('📡 NFC scanning started');
            return 1;
        } catch (error) {
            throw new Error(`NFC scan failed: ${error.message}`);
        }
    }

    destroy() {
        this.scanning = false;
        // NFC scanning stops automatically when page loses focus
    }
}

class WiFiManager extends EventTarget {
    constructor() {
        super();
        this.connections = new Map();
    }

    async init() {
        console.log('📶 WiFi manager initialized');
    }

    async scan() {
        // Note: Direct WiFi scanning is limited in browsers
        // This would typically require a companion app or server
        try {
            // Simulated network device discovery
            const networkDevices = await this.discoverNetworkDevices();
            return networkDevices.length;
        } catch (error) {
            throw new Error(`WiFi scan failed: ${error.message}`);
        }
    }

    async discoverNetworkDevices() {
        // Implementation would use network APIs to discover devices
        // This is a placeholder for actual network discovery
        return [];
    }

    async connect(device) {
        // WiFi connection implementation
        console.log(`Connecting to WiFi device: ${device.name}`);
        return { connected: true };
    }

    async disconnect(device) {
        this.connections.delete(device.id);
    }

    async sendCommand(device, command, data) {
        console.log(`Sending WiFi command: ${command}`, data);
        return { success: true, command, data };
    }

    destroy() {
        this.connections.clear();
    }
}

class UPnPManager extends EventTarget {
    constructor() {
        super();
        this.devices = new Map();
        this.services = new Map();
    }

    async init() {
        console.log('🌐 UPnP manager initialized');
    }

    async scan() {
        try {
            // Discover UPnP devices through network requests
            const devices = await this.discoverUPnPDevices();
            
            devices.forEach(device => {
                this.dispatchEvent(new CustomEvent('deviceFound', {
                    detail: device
                }));
            });

            return devices.length;
        } catch (error) {
            throw new Error(`UPnP scan failed: ${error.message}`);
        }
    }

    async discoverUPnPDevices() {
        // UPnP SSDP discovery implementation
        // This would use multicast UDP requests in a real implementation
        const mockDevices = [
            {
                name: 'Smart TV',
                type: 'tv',
                protocol: 'upnp',
                serviceType: 'urn:schemas-upnp-org:device:MediaRenderer:1',
                capabilities: ['media', 'control']
            },
            {
                name: 'Network Speaker',
                type: 'speaker',
                protocol: 'upnp',
                serviceType: 'urn:schemas-upnp-org:device:MediaRenderer:1',
                capabilities: ['audio']
            }
        ];

        return mockDevices;
    }

    async connect(device) {
        console.log(`Connecting to UPnP device: ${device.name}`);
        this.devices.set(device.id, device);
        return { connected: true };
    }

    async disconnect(device) {
        this.devices.delete(device.id);
    }

    async sendCommand(device, command, data) {
        // UPnP SOAP action implementation
        console.log(`Sending UPnP command: ${command}`, data);
        return { success: true, command, data };
    }

    destroy() {
        this.devices.clear();
        this.services.clear();
    }
}
