# Setup Guide - AR/VR Communication Platform

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Configuration](#configuration)
- [Device Setup](#device-setup)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

---

## Prerequisites

### System Requirements

#### Minimum Requirements
- **Operating System**: Windows 10, macOS 10.14, or Linux (Ubuntu 18.04+)
- **Node.js**: Version 16.0 or higher
- **NPM**: Version 8.0 or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space
- **Network**: Broadband internet connection

#### Recommended Requirements
- **Node.js**: Version 18.0 or higher
- **RAM**: 16GB for development
- **GPU**: Dedicated graphics card for AR/VR development
- **Network**: Gigabit ethernet or Wi-Fi 6

#### Browser Requirements
- **Chrome**: Version 90+ (recommended for WebXR)
- **Edge**: Version 90+
- **Firefox**: Version 98+ (limited WebXR support)
- **Safari**: Version 15+ (limited support)

#### Device Requirements for Full Features
- **Android**: Version 8.0+ with ARCore support
- **iOS**: Version 12.0+ with ARKit support
- **VR Headsets**: Oculus Quest/Quest 2, HTC Vive, Windows Mixed Reality
- **AR Glasses**: HoloLens 2, Magic Leap 2

### Software Dependencies

#### Required Tools
```bash
# Node.js and NPM
node --version  # Should be 16.0+
npm --version   # Should be 8.0+

# Git
git --version

# Python (for some native modules)
python --version  # 3.7+ or 2.7+
```

#### Optional Tools
```bash
# For HTTPS development
npm install -g local-ssl-proxy

# For process management
npm install -g pm2

# For code quality
npm install -g eslint

# For documentation
npm install -g jsdoc
```

---

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/ar-vr-com-platform.git
cd ar-vr-com-platform

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
```

### 2. Start Development Server

```bash
# Terminal 1 - Start the Node.js server
npm start

# Terminal 2 - Start the client server (in a new terminal)
npm run client

# Terminal 3 - Start HTTPS proxy for device APIs (in a new terminal)
npm run https
```

### 3. Access the Application

- **HTTP**: http://localhost:8080
- **HTTPS**: https://localhost:8443 (required for device APIs)
- **Server API**: http://localhost:3000

### 4. Test Basic Functionality

1. Open https://localhost:8443 in Chrome
2. Grant camera and microphone permissions when prompted
3. Click "Create Room" to start a new AR/VR session
4. Share the room link with others to test multi-user functionality

---

## Development Setup

### Project Structure Setup

```bash
ar-vr-com-platform/
├── .env                    # Environment configuration
├── .env.example           # Example environment file
├── .gitignore            # Git ignore rules
├── package.json          # Node.js dependencies
├── README.md             # Project overview
├── server/               # Backend server code
├── client/               # Frontend application
├── docs/                 # Documentation
├── tests/                # Test files
└── scripts/              # Build and deployment scripts
```

### Environment Configuration

Create a `.env` file in the root directory:

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# SSL Configuration (for HTTPS)
SSL_KEY_PATH=./certs/key.pem
SSL_CERT_PATH=./certs/cert.pem

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:8080,https://localhost:8443

# WebRTC Configuration
STUN_SERVER=stun:stun.l.google.com:19302
TURN_SERVER=
TURN_USERNAME=
TURN_PASSWORD=

# Device Discovery
BLUETOOTH_ENABLED=true
WIFI_DIRECT_ENABLED=true
NFC_ENABLED=true
WEBUSB_ENABLED=true

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/app.log

# Performance
MAX_CONNECTIONS=1000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### SSL Certificate Setup

For HTTPS development (required for device APIs):

```bash
# Create certificates directory
mkdir certs

# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes

# Or use mkcert for trusted local certificates
brew install mkcert  # macOS
mkcert -install
mkcert localhost 127.0.0.1 ::1
```

### Development Scripts

Add these scripts to your development workflow:

```bash
# Development with auto-restart
npm run dev

# Run with debugging
npm run dev:debug

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Build for production
npm run build

# Generate documentation
npm run docs
```

### Package.json Scripts

```json
{
  "scripts": {
    "start": "node server/index.js",
    "dev": "nodemon server/index.js",
    "dev:debug": "nodemon --inspect server/index.js",
    "client": "cd client && python3 -m http.server 8080",
    "https": "local-ssl-proxy --source 8443 --target 8080",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "lint": "eslint . --ext .js",
    "lint:fix": "eslint . --ext .js --fix",
    "build": "npm run build:client && npm run build:server",
    "build:client": "rollup -c rollup.config.js",
    "build:server": "echo 'Server build not needed'",
    "docs": "jsdoc -d docs/generated -r server/ client/js/",
    "clean": "rm -rf node_modules package-lock.json",
    "reset": "npm run clean && npm install"
  }
}
```

### IDE Configuration

#### VS Code Setup

Create `.vscode/settings.json`:

```json
{
  "eslint.enable": true,
  "eslint.format.enable": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  },
  "files.associations": {
    "*.js": "javascript"
  }
}
```

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "christian-kohler.path-intellisense"
  ]
}
```

#### ESLint Configuration

Create `.eslintrc.js`:

```javascript
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['warn'],
    'no-console': ['warn']
  }
};
```

---

## Production Deployment

### Docker Deployment

#### Dockerfile

```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership and switch to non-root user
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose ports
EXPOSE 3000 8443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start application
CMD ["npm", "start"]
```

#### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "8443:8443"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - ./logs:/app/logs
      - ./certs:/app/certs
    restart: unless-stopped
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - app
    restart: unless-stopped

volumes:
  redis_data:
```

#### Deployment Commands

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Scale the application
docker-compose up -d --scale app=3

# Update deployment
docker-compose pull
docker-compose up -d

# Stop services
docker-compose down
```

### Cloud Deployment

#### AWS Deployment

**Using AWS ECS:**

```bash
# Install AWS CLI
aws configure

# Create ECR repository
aws ecr create-repository --repository-name ar-vr-platform

# Build and push image
docker build -t ar-vr-platform .
docker tag ar-vr-platform:latest 123456789012.dkr.ecr.us-west-2.amazonaws.com/ar-vr-platform:latest
docker push 123456789012.dkr.ecr.us-west-2.amazonaws.com/ar-vr-platform:latest

# Deploy to ECS (using task definition)
aws ecs update-service --cluster ar-vr-cluster --service ar-vr-service --force-new-deployment
```

#### Google Cloud Deployment

**Using Google Cloud Run:**

```bash
# Install gcloud CLI
gcloud auth login

# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/ar-vr-platform
gcloud run deploy --image gcr.io/PROJECT_ID/ar-vr-platform --platform managed
```

#### Heroku Deployment

```bash
# Install Heroku CLI
heroku login

# Create app
heroku create ar-vr-platform

# Configure environment variables
heroku config:set NODE_ENV=production
heroku config:set PORT=3000

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Load Balancer Configuration

#### Nginx Configuration

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream app_servers {
        server app:3000;
        # Add more servers for load balancing
        # server app2:3000;
        # server app3:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    server {
        listen 80;
        server_name localhost;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name localhost;

        # SSL Configuration
        ssl_certificate /etc/nginx/certs/cert.pem;
        ssl_certificate_key /etc/nginx/certs/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # WebSocket upgrade
        location /socket.io/ {
            proxy_pass http://app_servers;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app_servers;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files
        location / {
            proxy_pass http://app_servers;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Caching for static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }
    }
}
```

---

## Configuration

### Environment Variables

#### Core Configuration

```bash
# Application
NODE_ENV=production|development|test
PORT=3000
HOST=0.0.0.0

# Security
SESSION_SECRET=your-secret-key
JWT_SECRET=your-jwt-secret
ALLOWED_ORIGINS=https://yourdomain.com

# Database (future)
DATABASE_URL=postgresql://user:pass@localhost/db
REDIS_URL=redis://localhost:6379

# External Services
STUN_SERVER=stun:stun.l.google.com:19302
TURN_SERVER=turn:your-turn-server.com:3478
TURN_USERNAME=username
TURN_PASSWORD=password

# Feature Flags
ENABLE_DEVICE_DISCOVERY=true
ENABLE_WEBRTC=true
ENABLE_SPATIAL_AUDIO=true
ENABLE_DEBUG_MODE=false

# Monitoring
LOG_LEVEL=info|debug|warn|error
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
```

#### Advanced Configuration

```bash
# Performance Tuning
MAX_CONNECTIONS=1000
CONNECTION_TIMEOUT=30000
KEEPALIVE_TIMEOUT=5000
BUFFER_SIZE=64KB

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# WebRTC Configuration
ICE_GATHERING_TIMEOUT=10000
PEER_CONNECTION_TIMEOUT=30000
DATA_CHANNEL_MAX_MESSAGE_SIZE=16384

# Device Discovery
BLUETOOTH_SCAN_DURATION=30000
WIFI_SCAN_INTERVAL=60000
DEVICE_CONNECTION_TIMEOUT=15000

# Spatial Audio
AUDIO_SAMPLE_RATE=48000
AUDIO_BUFFER_SIZE=256
SPATIAL_AUDIO_MAX_DISTANCE=50
```

### Feature Configuration

#### Client Configuration

Create `client/config.js`:

```javascript
export const config = {
  // Server endpoints
  serverUrl: window.location.origin,
  websocketUrl: window.location.protocol === 'https:' 
    ? `wss://${window.location.host}` 
    : `ws://${window.location.host}`,

  // WebRTC configuration
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],

  // Media constraints
  mediaConstraints: {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000
    },
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 }
    }
  },

  // Feature flags
  features: {
    webxr: true,
    spatialAudio: true,
    handTracking: true,
    deviceDiscovery: true,
    screenShare: true
  },

  // UI configuration
  ui: {
    autoHideDelay: 10000,
    notificationTimeout: 5000,
    maxNotifications: 5,
    debugMode: false
  }
};
```

---

## Device Setup

### Mobile Device Setup

#### Android Setup

1. **Enable Developer Options:**
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
   - Enable "USB Debugging"

2. **Install Chrome Dev/Canary:**
   ```bash
   # Download from Play Store or
   adb install chrome-dev.apk
   ```

3. **Enable WebXR Flags:**
   - Open Chrome and go to `chrome://flags`
   - Enable "WebXR Device API"
   - Enable "WebXR Incubations"

4. **Test AR Functionality:**
   - Visit https://your-domain.com
   - Grant camera permissions
   - Test AR session creation

#### iOS Setup

1. **Update to iOS 12+:**
   - Ensure device supports ARKit

2. **Install Safari Technology Preview:**
   - Or use regular Safari 15+

3. **Enable WebXR (Limited):**
   - iOS has limited WebXR support
   - Consider using native AR app wrapper

### Desktop Setup

#### Windows Setup

1. **Install Windows Mixed Reality:**
   - For VR headset support
   - Configure WMR Portal

2. **Browser Setup:**
   ```bash
   # Chrome with VR flags
   chrome.exe --enable-features=WebXR
   ```

3. **Graphics Drivers:**
   - Update to latest NVIDIA/AMD drivers
   - Ensure DirectX 12 support

#### macOS Setup

1. **Browser Configuration:**
   ```bash
   # Chrome with experimental features
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --enable-features=WebXR
   ```

2. **Development Tools:**
   ```bash
   # Install Xcode for iOS development
   xcode-select --install
   ```

### VR Headset Setup

#### Oculus Quest Setup

1. **Enable Developer Mode:**
   - Create Oculus Developer account
   - Enable Developer Mode in Oculus app

2. **Install Oculus Browser:**
   - Or use Quest's built-in browser

3. **Test WebXR:**
   - Navigate to your platform URL
   - Enter VR mode

#### HTC Vive Setup

1. **Install SteamVR:**
   - Configure room setup
   - Test tracking

2. **Browser VR:**
   - Use Chrome with WebXR support
   - Or Firefox Reality

---

## Troubleshooting

### Common Issues

#### Server Won't Start

**Problem:** Server fails to start on port 3000

**Solutions:**
```bash
# Check if port is in use
lsof -i :3000
netstat -an | grep 3000

# Kill process using port
kill -9 $(lsof -t -i:3000)

# Use different port
PORT=3001 npm start
```

#### HTTPS Certificate Issues

**Problem:** Browser shows certificate warnings

**Solutions:**
```bash
# Regenerate certificates
rm -rf certs/
mkdir certs
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes

# Or use mkcert for trusted certificates
mkcert localhost 127.0.0.1 ::1
```

#### WebRTC Connection Failures

**Problem:** Peer connections fail to establish

**Solutions:**
1. **Check Network Configuration:**
   ```bash
   # Test STUN server connectivity
   curl -v stun:stun.l.google.com:19302
   ```

2. **Firewall Configuration:**
   ```bash
   # Open required ports
   sudo ufw allow 3000
   sudo ufw allow 8443
   sudo ufw allow 10000:20000/udp  # WebRTC media ports
   ```

3. **NAT/Router Issues:**
   - Configure port forwarding
   - Use TURN server for strict NAT

#### Device Discovery Issues

**Problem:** Devices not discovered or connection fails

**Solutions:**
1. **Browser Permissions:**
   - Ensure Bluetooth permission granted
   - Check if HTTPS is being used

2. **Device Compatibility:**
   ```javascript
   // Check browser support
   if ('bluetooth' in navigator) {
     console.log('Bluetooth supported');
   } else {
     console.log('Bluetooth not supported');
   }
   ```

3. **Platform Limitations:**
   - iOS has limited Bluetooth Web API support
   - Some devices require pairing

#### Performance Issues

**Problem:** Low FPS or high latency

**Solutions:**
1. **Graphics Optimization:**
   ```javascript
   // Reduce rendering quality
   renderer.setPixelRatio(window.devicePixelRatio * 0.5);
   
   // Implement LOD system
   scene.traverse((child) => {
     if (child.isMesh) {
       child.frustumCulled = true;
     }
   });
   ```

2. **Network Optimization:**
   ```javascript
   // Reduce update frequency
   setInterval(() => {
     broadcastPosition();
   }, 100); // 10 FPS instead of 60 FPS
   ```

### Debug Tools

#### Browser Developer Tools

1. **Chrome DevTools:**
   ```javascript
   // Enable WebXR debugging
   chrome://flags/#webxr-runtime
   
   // Check WebRTC internals
   chrome://webrtc-internals/
   ```

2. **Console Debugging:**
   ```javascript
   // Enable debug mode
   localStorage.setItem('debug', 'true');
   
   // View connection stats
   console.log(platform.getConnectionStats());
   ```

#### Server Debugging

```bash
# Enable debug logging
DEBUG=* npm start

# Profile performance
node --prof server/index.js

# Memory usage
node --inspect server/index.js
```

#### Network Debugging

```bash
# Monitor WebSocket connections
wscat -c ws://localhost:3000

# Test API endpoints
curl -X GET http://localhost:3000/api/health

# Monitor network traffic
netstat -an | grep :3000
```

### Logging and Monitoring

#### Application Logs

```javascript
// Client-side logging
const logger = {
  debug: (msg) => console.log(`[DEBUG] ${msg}`),
  info: (msg) => console.info(`[INFO] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};

// Server-side logging
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

---

## Advanced Configuration

### Custom Build Configuration

#### Rollup Configuration

Create `rollup.config.js`:

```javascript
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'client/js/main.js',
  output: {
    file: 'client/dist/bundle.js',
    format: 'iife',
    name: 'ARVRPlatform'
  },
  plugins: [
    nodeResolve(),
    commonjs(),
    process.env.NODE_ENV === 'production' && terser()
  ]
};
```

### Performance Tuning

#### Server Optimization

```javascript
// server/performance.js
import cluster from 'cluster';
import os from 'os';

if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // Worker process
  import('./index.js');
}
```

#### Client Optimization

```javascript
// client/js/performance.js
export class PerformanceMonitor {
  constructor() {
    this.stats = {
      fps: 0,
      memory: 0,
      drawCalls: 0
    };
  }
  
  startMonitoring() {
    setInterval(() => {
      this.updateStats();
    }, 1000);
  }
  
  updateStats() {
    // Monitor FPS
    this.stats.fps = this.calculateFPS();
    
    // Monitor memory usage
    if (performance.memory) {
      this.stats.memory = performance.memory.usedJSHeapSize;
    }
    
    // Monitor render stats
    this.stats.drawCalls = renderer.info.render.calls;
  }
}
```

### Security Hardening

#### Content Security Policy

```javascript
// server/security.js
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "connect-src 'self' ws: wss:; " +
    "media-src 'self' blob:; " +
    "worker-src 'self' blob:;"
  );
  next();
});
```

#### Rate Limiting

```javascript
// server/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many API requests from this IP'
});

export const socketLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // limit each IP to 1000 socket events per minute
  skipSuccessfulRequests: true
});
```

---

## Next Steps

After completing the setup:

1. **Read the [API Documentation](API.md)** for integration details
2. **Review the [Architecture Guide](ARCHITECTURE.md)** for system understanding
3. **Explore the [Examples](../examples/)** for implementation patterns
4. **Join the community** for support and contributions
5. **Configure monitoring** and analytics for production use

For additional help:
- 📧 Email: support@ar-vr-platform.com
- 💬 Discord: https://discord.gg/ar-vr-platform
- 🐛 Issues: https://github.com/yourusername/ar-vr-com-platform/issues
- 📖 Wiki: https://github.com/yourusername/ar-vr-com-platform/wiki
