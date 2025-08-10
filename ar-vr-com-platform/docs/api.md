
# API Documentation - AR/VR Communication Platform

## Overview

The AR/VR Communication Platform provides both REST API endpoints and WebSocket events for real-time communication, device management, and spatial collaboration.

## Base URL

```
http://localhost:3000/api
https://localhost:8443/api (HTTPS for device APIs)
```

## Authentication

Currently, the platform uses IP-based identification and session management. Future versions will include JWT-based authentication.

---

## REST API Endpoints

### Health & Status

#### GET /health
Get server health status and basic statistics.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "connectedDevices": 5,
  "activeRooms": 3
}
```

---

### Room Management

#### GET /rooms
Get list of public rooms.

**Response:**
```json
{
  "rooms": [
    {
      "id": "room_abc123_1705312200000",
      "name": "AR Meeting Room",
      "description": "Professional meeting space",
      "userCount": 3,
      "maxUsers": 20,
      "capabilities": {
        "ar": true,
        "vr": true,
        "webrtc": true,
        "spatialAudio": true
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "lastActivity": "2024-01-15T10:35:00.000Z",
      "template": "conference"
    }
  ]
}
```

#### POST /rooms
Create a new room.

**Request Body:**
```json
{
  "name": "My AR Room",
  "description": "A space for collaboration",
  "isPrivate": false,
  "maxUsers": 10,
  "template": "conference",
  "settings": {
    "spatialAudio": true,
    "handTracking": true,
    "recordingSessions": false
  }
}
```

**Response:**
```json
{
  "id": "room_def456_1705312800000",
  "name": "My AR Room",
  "description": "A space for collaboration",
  "isPrivate": false,
  "maxUsers": 10,
  "users": [],
  "objects": [],
  "createdAt": "2024-01-15T10:40:00.000Z",
  "createdBy": "192.168.1.100"
}
```

---

### Device Management

#### GET /devices
Get discovered and connected devices.

**Response:**
```json
{
  "discoveredDevices": [
    {
      "id": "bt_speaker_001",
      "name": "Sony WH-1000XM4",
      "type": "smart-speaker",
      "protocol": "bluetooth",
      "capabilities": ["audio", "control"],
      "manufacturer": "Sony",
      "model": "WH-1000XM4",
      "discoveredAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "connectedDevices": [
    {
      "id": "wifi_tv_001",
      "name": "Samsung Smart TV",
      "type": "smart-tv",
      "protocol": "wifi",
      "status": "connected",
      "connectedAt": "2024-01-15T10:25:00.000Z"
    }
  ]
}
```

#### POST /devices/:deviceId/command
Send command to a connected device.

**Request Body:**
```json
{
  "command": "volume_up",
  "params": {
    "current": 50,
    "step": 10
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "status": "volume_changed",
    "level": 60
  }
}
```

---

### WebRTC Signaling

#### POST /webrtc/offer
Send WebRTC offer for peer connection.

**Request Body:**
```json
{
  "roomId": "room_abc123_1705312200000",
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\no=- 123456789 1 IN IP4 192.168.1.100\r\n..."
  },
  "fromUserId": "user_123",
  "toUserId": "user_456"
}
```

**Response:**
```json
{
  "success": true
}
```

#### POST /webrtc/answer
Send WebRTC answer for peer connection.

**Request Body:**
```json
{
  "roomId": "room_abc123_1705312200000",
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\no=- 987654321 1 IN IP4 192.168.1.101\r\n..."
  },
  "fromUserId": "user_456",
  "toUserId": "user_123"
}
```

**Response:**
```json
{
  "success": true
}
```

#### POST /webrtc/ice-candidate
Send ICE candidate for peer connection.

**Request Body:**
```json
{
  "roomId": "room_abc123_1705312200000",
  "candidate": {
    "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
  },
  "fromUserId": "user_123",
  "toUserId": "user_456"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## WebSocket Events

### Connection Events

#### Client → Server

##### join-room
Join a virtual room.

```json
{
  "roomId": "room_abc123_1705312200000",
  "user": {
    "id": "user_123",
    "name": "John Doe",
    "avatar": {
      "color": "ff6b35",
      "shape": "capsule"
    },
    "position": [0, 0, 0],
    "rotation": [0, 0, 0]
  }
}
```

##### leave-room
Leave the current room.

```json
{
  "roomId": "room_abc123_1705312200000",
  "userId": "user_123"
}
```

##### scan-devices
Start scanning for nearby devices.

```json
{}
```

##### connect-device
Connect to a discovered device.

```json
{
  "deviceId": "bt_speaker_001",
  "protocol": "bluetooth"
}
```

##### update-position
Update user position in AR/VR space.

```json
{
  "position": [1.5, 0, -2.0],
  "rotation": [0, 0.5, 0],
  "roomId": "room_abc123_1705312200000"
}
```

##### spawn-object
Create a new object in the room.

```json
{
  "roomId": "room_abc123_1705312200000",
  "object": {
    "id": "obj_cube_1705312800000",
    "type": "cube",
    "position": [0, 1, -1],
    "rotation": [0, 0, 0],
    "scale": [1, 1, 1],
    "properties": {
      "color": "#0099ff",
      "interactive": true
    }
  }
}
```

##### interact-object
Interact with an object in the room.

```json
{
  "roomId": "room_abc123_1705312200000",
  "objectId": "obj_cube_1705312800000",
  "interaction": {
    "type": "grab",
    "point": [0.5, 0.5, 0.5],
    "force": 1.0
  }
}
```

##### webrtc-signal
Send WebRTC signaling data.

```json
{
  "type": "offer",
  "target": "user_456",
  "signal": {
    "type": "offer",
    "sdp": "v=0\r\no=- 123456789 1 IN IP4 192.168.1.100\r\n..."
  }
}
```

##### spatial-audio-update
Update spatial audio settings.

```json
{
  "audioSettings": {
    "position": [1.5, 0, -2.0],
    "orientation": [0, 0, -1],
    "volume": 0.8,
    "spatialEnabled": true
  },
  "roomId": "room_abc123_1705312200000"
}
```

##### device-command
Send command to connected device.

```json
{
  "deviceId": "smart_tv_001",
  "command": "play",
  "params": {
    "media": "shared_screen",
    "volume": 0.7
  }
}
```

#### Server → Client

##### room-joined
Confirmation of successful room join.

```json
{
  "room": {
    "id": "room_abc123_1705312200000",
    "name": "AR Meeting Room",
    "users": [
      {
        "id": "user_456",
        "name": "Jane Smith",
        "position": [2, 0, 0],
        "joinedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "objects": [
      {
        "id": "obj_table_1705312600000",
        "type": "plane",
        "position": [0, 0.75, 0],
        "scale": [3, 0.1, 1.5]
      }
    ],
    "environment": {
      "lighting": "office",
      "background": "modern_office"
    }
  }
}
```

##### user-joined
Notification when another user joins the room.

```json
{
  "user": {
    "id": "user_789",
    "name": "Bob Wilson",
    "avatar": {
      "color": "35a853",
      "shape": "capsule"
    },
    "position": [-1, 0, 1],
    "joinedAt": "2024-01-15T10:35:00.000Z"
  },
  "roomId": "room_abc123_1705312200000"
}
```

##### user-left
Notification when a user leaves the room.

```json
{
  "user": {
    "id": "user_789",
    "name": "Bob Wilson"
  },
  "roomId": "room_abc123_1705312200000"
}
```

##### user-position-update
Real-time position update from another user.

```json
{
  "userId": "user_456",
  "position": [2.5, 0, -0.5],
  "rotation": [0, 0.2, 0],
  "timestamp": "2024-01-15T10:35:30.000Z"
}
```

##### object-spawned
Notification when a new object is created.

```json
{
  "object": {
    "id": "obj_sphere_1705312900000",
    "type": "sphere",
    "position": [1, 2, 0],
    "rotation": [0, 0, 0],
    "scale": [0.5, 0.5, 0.5],
    "createdBy": "user_456",
    "createdAt": "2024-01-15T10:35:00.000Z"
  },
  "roomId": "room_abc123_1705312200000"
}
```

##### object-interaction
Notification of object interaction.

```json
{
  "objectId": "obj_sphere_1705312900000",
  "interaction": {
    "type": "grab",
    "point": [0, 0.5, 0],
    "force": 0.8
  },
  "userId": "user_456",
  "timestamp": "2024-01-15T10:36:00.000Z"
}
```

##### devices-discovered
List of discovered devices.

```json
{
  "devices": [
    {
      "id": "bt_headphones_001",
      "name": "AirPods Pro",
      "type": "smart-speaker",
      "protocol": "bluetooth",
      "capabilities": ["audio", "noise-cancellation"],
      "rssi": -45
    },
    {
      "id": "wifi_display_001",
      "name": "Apple TV",
      "type": "smart-tv",
      "protocol": "wifi",
      "capabilities": ["display", "audio", "airplay"],
      "ipAddress": "192.168.1.150"
    }
  ]
}
```

##### device-connected
Confirmation of device connection.

```json
{
  "device": {
    "id": "bt_headphones_001",
    "name": "AirPods Pro",
    "type": "smart-speaker",
    "protocol": "bluetooth",
    "status": "connected",
    "connectedAt": "2024-01-15T10:37:00.000Z"
  }
}
```

##### device-command-result
Result of device command execution.

```json
{
  "deviceId": "smart_tv_001",
  "command": "volume_up",
  "result": {
    "status": "volume_changed",
    "level": 75
  },
  "timestamp": "2024-01-15T10:38:00.000Z"
}
```

##### webrtc-signal
WebRTC signaling data from another peer.

```json
{
  "type": "answer",
  "from": "user_456",
  "signal": {
    "type": "answer",
    "sdp": "v=0\r\no=- 987654321 1 IN IP4 192.168.1.101\r\n..."
  },
  "timestamp": "2024-01-15T10:35:15.000Z"
}
```

##### spatial-audio-update
Spatial audio update from another user.

```json
{
  "userId": "user_456",
  "audioSettings": {
    "position": [2.5, 0, -0.5],
    "volume": 0.9,
    "spatialEnabled": true
  },
  "timestamp": "2024-01-15T10:35:30.000Z"
}
```

---

## Error Handling

### HTTP Error Responses

All API endpoints return standard HTTP status codes:

- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized  
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

**Error Response Format:**
```json
{
  "error": "Room not found",
  "code": "ROOM_NOT_FOUND",
  "details": {
    "roomId": "invalid_room_id"
  },
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### WebSocket Error Events

##### error
General error notification.

```json
{
  "type": "error",
  "message": "Failed to join room",
  "code": "ROOM_FULL",
  "details": {
    "roomId": "room_abc123_1705312200000",
    "currentUsers": 20,
    "maxUsers": 20
  }
}
```

##### join-room-error
Room join failure.

```json
{
  "error": "Room is full",
  "roomId": "room_abc123_1705312200000"
}
```

##### device-connect-error
Device connection failure.

```json
{
  "error": "Device not found",
  "deviceId": "invalid_device_id"
}
```

##### device-command-error
Device command execution failure.

```json
{
  "error": "Command not supported",
  "deviceId": "bt_speaker_001",
  "command": "unsupported_command"
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **REST API**: 100 requests per minute per IP
- **WebSocket Events**: 1000 events per minute per connection
- **Device Commands**: 60 commands per minute per device

Rate limit headers are included in HTTP responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705312800
```

---

## Data Types

### Position
3D coordinates in meters.
```json
[x, y, z]  // Example: [1.5, 0.0, -2.3]
```

### Rotation
Euler angles in radians.
```json
[x, y, z]  // Example: [0.0, 1.57, 0.0]
```

### Color
Hex color string.
```json
"#ff6b35"  // Orange color
```

### Timestamp
ISO 8601 formatted date string.
```json
"2024-01-15T10:35:00.000Z"
```

---

## SDK Examples

### JavaScript SDK

```javascript
// Initialize the platform
const platform = new ARVRComPlatform();

// Join a room
await platform.joinRoom('room_abc123', {
  name: 'John Doe',
  avatar: { color: '#ff6b35' }
});

// Spawn an object
platform.spawnObject('cube', {
  position: [0, 1, -2],
  color: '#0099ff'
});

// Connect to a device
const devices = await platform.scanDevices();
await platform.connectDevice(devices[0].id);

// Send device command
await platform.sendDeviceCommand(deviceId, 'play', {
  media: 'shared_content.mp4'
});
```

### WebSocket Direct Usage

```javascript
const socket = io('wss://localhost:8443');

// Join room
socket.emit('join-room', {
  roomId: 'room_abc123',
  user: { id: 'user_123', name: 'John' }
});

// Listen for events
socket.on('user-joined', (data) => {
  console.log('User joined:', data.user);
});

// Update position
socket.emit('update-position', {
  position: [1, 0, -1],
  rotation: [0, 0.5, 0]
});
```

---

## Webhooks (Future)

The platform will support webhooks for external integrations:

- Room events (created, joined, left)
- Object interactions
- Device state changes
- System alerts

**Webhook Payload Example:**
```json
{
  "event": "room.user_joined",
  "timestamp": "2024-01-15T10:35:00.000Z",
  "data": {
    "roomId": "room_abc123_1705312200000",
    "userId": "user_456",
    "userName": "Jane Smith"
  }
}
```

---

## Versioning

The API uses semantic versioning:
- Current version: `v1`
- Breaking changes will increment major version
- New features increment minor version
- Bug fixes increment patch version

Version is specified in the URL path:
```
/api/v1/rooms
```

---

For more examples and advanced usage, see the [Setup Guide](SETUP.md) and [Architecture Documentation](ARCHITECTURE.md).
