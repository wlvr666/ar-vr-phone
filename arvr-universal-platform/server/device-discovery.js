// server/device-discovery.js - Network Device Discovery

const dgram = require('dgram');
const { EventEmitter } = require('events');

class DeviceDiscovery extends EventEmitter {
    constructor() {
        super();
        this.discoveredDevices = new Map();
        this.scanningActive = false;
        this.ssdpSocket = null;
        this.mdnsSocket = null;
        
        this.stats = {
            totalDevicesFound: 0,
            currentDevices: 0,
            scanCount: 0,
            lastScanTime: null
        };
        
        // Network discovery settings
        this.settings = {
            ssdpPort: 1900,
            ssdpAddress: '239.255.255.250',
            mdnsPort: 5353,
            mdnsAddress: '224.0.0.251',
            scanDuration: 30000, // 30 seconds
            deviceTimeout: 300000 // 5 minutes
        };
        
        // SSDP service types to discover
        this.ssdpServices = [
            'upnp:rootdevice',
            'urn:schemas-upnp-org:device:MediaRenderer:1',
            'urn:schemas-upnp-org:device:MediaServer:1',
            'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
            'urn:dial-multiscreen-org:service:dial:1',
            'urn:schemas-upnp-org:device:Basic:1'
        ];
        
        // Device cleanup interval
        this.cleanupInterval = null;
    }

    async initialize() {
        console.log('🔧 Initializing Device Discovery...');
        
        try {
            // Setup SSDP discovery
            await this.setupSSDPDiscovery();
            
            // Setup mDNS discovery
            await this.setupMDNSDiscovery();
            
            // Start cleanup interval
            this.startCleanupInterval();
            
            console.log('✅ Device Discovery initialized');
            
        } catch (error) {
            console.error('❌ Device Discovery initialization failed:', error);
            throw error;
        }
    }

    async setupSSDPDiscovery() {
        try {
            this.ssdpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
            
            this.ssdpSocket.on('message', (msg, rinfo) => {
                this.handleSSDPMessage(msg, rinfo);
            });
            
            this.ssdpSocket.on('error', (err) => {
                console.error('SSDP socket error:', err);
            });
            
            // Bind to SSDP multicast address
            this.ssdpSocket.bind(this.settings.ssdpPort, () => {
                try {
                    this.ssdpSocket.addMembership(this.settings.ssdpAddress);
                    console.log('📡 SSDP discovery setup complete');
                } catch (error) {
                    console.warn('⚠️ Could not join SSDP multicast group:', error.message);
                }
            });
            
        } catch (error) {
            console.error('SSDP setup failed:', error);
            // Continue without SSDP
        }
    }

    async setupMDNSDiscovery() {
        try {
            this.mdnsSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
            
            this.mdnsSocket.on('message', (msg, rinfo) => {
                this.handleMDNSMessage(msg, rinfo);
            });
            
            this.mdnsSocket.on('error', (err) => {
                console.error('mDNS socket error:', err);
            });
            
            // Bind to mDNS multicast address
            this.mdnsSocket.bind(this.settings.mdnsPort, () => {
                try {
                    this.mdnsSocket.addMembership(this.settings.mdnsAddress);
                    console.log('📡 mDNS discovery setup complete');
                } catch (error) {
                    console.warn('⚠️ Could not join mDNS multicast group:', error.message);
                }
            });
            
        } catch (error) {
            console.error('mDNS setup failed:', error);
            // Continue without mDNS
        }
    }

    startScan() {
        if (this.scanningActive) {
            console.log('⚠️ Device scan already in progress');
            return;
        }

        console.log('🔍 Starting device discovery scan...');
        this.scanningActive = true;
        this.stats.scanCount++;
        this.stats.lastScanTime = new Date();
        
        // Send SSDP discovery messages
        this.sendSSDPDiscovery();
        
        // Send mDNS queries
        this.sendMDNSQueries();
        
        // Stop scanning after configured duration
        setTimeout(() => {
            this.stopScan();
        }, this.settings.scanDuration);
        
        this.emit('scanStarted');
    }

    stopScan() {
        if (!this.scanningActive) return;
        
        this.scanningActive = false;
        console.log(`✅ Device discovery scan completed. Found ${this.discoveredDevices.size} devices.`);
        
        this.emit('scanCompleted', {
            deviceCount: this.discoveredDevices.size,
            devices: Array.from(this.discoveredDevices.values())
        });
    }

    sendSSDPDiscovery() {
        if (!this.ssdpSocket) return;
        
        this.ssdpServices.forEach(serviceType => {
            const message = [
                'M-SEARCH * HTTP/1.1',
                `HOST: ${this.settings.ssdpAddress}:${this.settings.ssdpPort}`,
                'MAN: "ssdp:discover"',
                'MX: 3',
                `ST: ${serviceType}`,
                '', ''
            ].join('\r\n');
            
            this.ssdpSocket.send(
                message,
                this.settings.ssdpPort,
                this.settings.ssdpAddress,
                (err) => {
                    if (err) {
                        console.error('SSDP send error:', err);
                    }
                }
            );
        });
        
        console.log('📡 SSDP discovery messages sent');
    }

    sendMDNSQueries() {
        if (!this.mdnsSocket) return;
        
        // Query for common service types
        const serviceTypes = [
            '_http._tcp.local',
            '_https._tcp.local',
            '_airplay._tcp.local',
            '_googlecast._tcp.local',
            '_chromecast._tcp.local',
            '_spotify-connect._tcp.local',
            '_raop._tcp.local'
        ];
        
        serviceTypes.forEach(serviceType => {
            const query = this.createMDNSQuery(serviceType);
            
            this.mdnsSocket.send(
                query,
                this.settings.mdnsPort,
                this.settings.mdnsAddress,
                (err) => {
                    if (err) {
                        console.error('mDNS send error:', err);
                    }
                }
            );
        });
        
        console.log('📡 mDNS queries sent');
    }

    handleSSDPMessage(message, rinfo) {
        try {
            const messageStr = message.toString();
            
            // Parse SSDP response
            if (messageStr.includes('HTTP/1.1 200 OK') || messageStr.includes('NOTIFY')) {
                const device = this.parseSSDPResponse(messageStr, rinfo);
                if (device) {
                    this.addDiscoveredDevice(device);
                }
            }
            
        } catch (error) {
            console.error('SSDP message parsing error:', error);
        }
    }

    handleMDNSMessage(message, rinfo) {
        try {
            // Basic mDNS response parsing
            const device = this.parseMDNSResponse(message, rinfo);
            if (device) {
                this.addDiscoveredDevice(device);
            }
            
        } catch (error) {
            console.error('mDNS message parsing error:', error);
        }
    }

    parseSSDPResponse(message, rinfo) {
        const lines = message.split('\r\n');
        const headers = {};
        
        // Parse headers
        lines.forEach(line => {
