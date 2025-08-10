import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { WebSocketServer } from './websocket-server.js';
import { DeviceDiscovery } from './device-discovery.js';
import { PeerConnectionManager } from './peer-connection.js';
import { RoomManager } from './room-manager.js';

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

class ARVRComPlatformServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:8080", "https://localhost:8443"],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
    
    this.port = process.env.PORT || 3000;
    
    // Initialize core systems
    this.roomManager = new RoomManager();
    this.deviceDiscovery = new DeviceDiscovery();
    this.peerManager = new PeerConnectionManager();
    this.wsServer = new WebSocketServer(this.io, this.roomManager, this.peerManager);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.startDeviceDiscovery();
  }

  setupMiddleware() {
    // Security and performance middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          mediaSrc: ["'self'", "blob:"],
          workerSrc: ["'self'", "blob:"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
        },
      },
    }));
    
    this.app.use(cors());
    this.app.use(compression());
    this.app.use(morgan('combined'));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Serve static files
    this.app.use(express.static(path.join(__dirname, '../client')));
  }

  setupRoutes() {
    // API routes
    this.app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        connectedDevices: this.deviceDiscovery.getConnectedDevices().length,
        activeRooms: this.roomManager.getActiveRooms().length
      });
    });

    this.app.get('/api/devices', (req, res) => {
      res.json({
        discoveredDevices: this.deviceDiscovery.getDiscoveredDevices(),
        connectedDevices: this.deviceDiscovery.getConnectedDevices()
      });
    });

    this.app.get('/api/rooms', (req, res) => {
      res.json({
        rooms: this.roomManager.getPublicRooms()
      });
    });

    this.app.post('/api/rooms', (req, res) => {
      const { name, isPrivate, maxUsers } = req.body;
      const room = this.roomManager.createRoom({
        name,
        isPrivate: isPrivate || false,
        maxUsers: maxUsers || 50,
        createdBy: req.ip
      });
      res.json(room);
    });

    // WebRTC signaling endpoints
    this.app.post('/api/webrtc/offer', (req, res) => {
      const { roomId, offer, fromUserId, toUserId } = req.body;
      this.peerManager.handleOffer(roomId, offer, fromUserId, toUserId);
      res.json({ success: true });
    });

    this.app.post('/api/webrtc/answer', (req, res) => {
      const { roomId, answer, fromUserId, toUserId } = req.body;
      this.peerManager.handleAnswer(roomId, answer, fromUserId, toUserId);
      res.json({ success: true });
    });

    this.app.post('/api/webrtc/ice-candidate', (req, res) => {
      const { roomId, candidate, fromUserId, toUserId } = req.body;
      this.peerManager.handleIceCandidate(roomId, candidate, fromUserId, toUserId);
      res.json({ success: true });
    });

    // Device control endpoints
    this.app.post('/api/devices/:deviceId/command', async (req, res) => {
      try {
        const { deviceId } = req.params;
        const { command, params } = req.body;
        
        const result = await this.deviceDiscovery.sendCommand(deviceId, command, params);
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Catch-all route for SPA
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../client/index.html'));
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);
      
      // Handle room operations
      socket.on('join-room', (data) => {
        this.wsServer.handleJoinRoom(socket, data);
      });

      socket.on('leave-room', (data) => {
        this.wsServer.handleLeaveRoom(socket, data);
      });

      // Handle device operations
      socket.on('scan-devices', () => {
        this.wsServer.handleScanDevices(socket);
      });

      socket.on('connect-device', (data) => {
        this.wsServer.handleConnectDevice(socket, data);
      });

      socket.on('device-command', (data) => {
        this.wsServer.handleDeviceCommand(socket, data);
      });

      // Handle AR/VR operations
      socket.on('update-position', (data) => {
        this.wsServer.handlePositionUpdate(socket, data);
      });

      socket.on('spawn-object', (data) => {
        this.wsServer.handleSpawnObject(socket, data);
      });

      socket.on('interact-object', (data) => {
        this.wsServer.handleObjectInteraction(socket, data);
      });

      // Handle communication
      socket.on('webrtc-signal', (data) => {
        this.wsServer.handleWebRTCSignal(socket, data);
      });

      socket.on('spatial-audio-update', (data) => {
        this.wsServer.handleSpatialAudioUpdate(socket, data);
      });

      // Cleanup on disconnect
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        this.wsServer.handleDisconnect(socket);
      });
    });
  }

  async startDeviceDiscovery() {
    try {
      console.log('Starting device discovery services...');
      await this.deviceDiscovery.startDiscovery();
      console.log('Device discovery active');
    } catch (error) {
      console.error('Device discovery failed:', error);
    }
  }

  start() {
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`🚀 AR/VR Communication Platform running on port ${this.port}`);
      console.log(`📱 Client interface: http://localhost:${this.port}`);
      console.log(`🔒 HTTPS (required): https://localhost:8443`);
      console.log(`📡 WebSocket server ready for AR/VR connections`);
      console.log(`🔍 Device discovery services starting...`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('Shutting down gracefully...');
      this.deviceDiscovery.stopDiscovery();
      this.server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  }
}

// Start the server
const server = new ARVRComPlatformServer();
server.start();

export default ARVRComPlatformServer;
