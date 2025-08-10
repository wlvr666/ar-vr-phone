// service-worker.js - PWA Service Worker for Universal AR/VR Platform

const CACHE_NAME = 'arvr-platform-v1.0.0';
const STATIC_CACHE_NAME = 'arvr-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'arvr-dynamic-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/main.js',
  '/js/ar-engine.js',
  '/js/device-connector.js',
  '/js/webrtc-client.js',
  '/js/spatial-audio.js',
  '/js/ui-manager.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js'
];

// API endpoints that should be cached
const API_CACHE_PATTERNS = [
  '/api/health',
  '/api/ice-servers',
  '/api/rooms',
  '/api/devices'
];

// Runtime cache configuration
const CACHE_CONFIG = {
  maxEntries: 100,
  maxAgeSeconds: 24 * 60 * 60, // 24 hours
  purgeOnQuotaError: true
};

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching static files...');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('✅ Static files cached successfully');
        // Force activation of new service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Failed to cache static files:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      cleanupOldCaches(),
      // Take control of all pages
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated and ready');
    })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Different caching strategies based on request type
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else if (isAPIRequest(url)) {
    event.respondWith(networkFirst(request));
  } else if (isNavigationRequest(request)) {
    event.respondWith(navigationHandler(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'device-scan') {
    event.waitUntil(syncDeviceScan());
  } else if (event.tag === 'room-join') {
    event.waitUntil(syncRoomJoin());
  } else if (event.tag === 'offline-messages') {
    event.waitUntil(syncOfflineMessages());
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received:', event);
  
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New notification from AR/VR Platform',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag || 'arvr-notification',
      data: data.data || {},
      actions: data.actions || [
        {
          action: 'open',
          title: 'Open App',
          icon: '/icons/action-open.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/action-dismiss.png'
        }
      ],
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
      vibrate: data.vibrate || [200, 100, 200]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'AR/VR Platform', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event);
  
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data;
  
  if (action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            return client.focus();
          }
        }
        
        // Open new window if none found
        let targetUrl = '/';
        
        if (data.roomId) {
          targetUrl = `/?room=${data.roomId}`;
        } else if (data.action) {
          targetUrl = `/?action=${data.action}`;
        }
        
        return clients.openWindow(targetUrl);
      })
  );
});

// Handle message events from main thread
self.addEventListener('message', (event) => {
  console.log('💬 Message received in SW:', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_URLS':
      event.waitUntil(cacheUrls(data.urls));
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(clearCache(data.cacheName));
      break;
      
    case 'GET_CACHE_SIZE':
      event.waitUntil(getCacheSize().then(size => {
        event.ports[0].postMessage({ type: 'CACHE_SIZE', size });
      }));
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
});

// Caching Strategies

async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Cache first strategy failed:', error);
    return new Response('Offline - content not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(JSON.stringify({
      error: 'Offline - network and cache unavailable',
      offline: true
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

async function navigationHandler(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Return cached index.html for navigation requests when offline
    const cachedResponse = await caches.match('/index.html');
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Offline - App not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Helper Functions

function isStaticAsset(url) {
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/);
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/') || 
         API_CACHE_PATTERNS.some(pattern => url.pathname.includes(pattern));
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const validCaches = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME];
  
  const deletePromises = cacheNames
    .filter(cacheName => !validCaches.includes(cacheName))
    .map(cacheName => {
      console.log('🗑️ Deleting old cache:', cacheName);
      return caches.delete(cacheName);
    });
  
  return Promise.all(deletePromises);
}

async function cacheUrls(urls) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  
  const cachePromises = urls.map(async (url) => {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
        console.log('📦 Cached:', url);
      }
    } catch (error) {
      console.error('Failed to cache:', url, error);
    }
  });
  
  return Promise.all(cachePromises);
}

async function clearCache(cacheName) {
  if (cacheName) {
    return caches.delete(cacheName);
  } else {
    // Clear all caches
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames.map(name => caches.delete(name));
    return Promise.all(deletePromises);
  }
}

async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }
  
  return totalSize;
}

// Background Sync Functions

async function syncDeviceScan() {
  console.log('🔍 Syncing device scan...');
  
  try {
    // Get stored device scan requests
    const scanRequests = await getStoredData('deviceScanRequests') || [];
    
    for (const scanRequest of scanRequests) {
      try {
        const response = await fetch('/api/devices/scan', {
          method: 'POST',
          body: JSON.stringify(scanRequest),
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          // Remove successful request from storage
          await removeStoredData('deviceScanRequests', scanRequest.id);
          
          // Notify clients of successful sync
          await notifyClients({
            type: 'DEVICE_SCAN_SYNCED',
            data: scanRequest
          });
        }
      } catch (error) {
        console.error('Failed to sync device scan:', error);
      }
    }
  } catch (error) {
    console.error('Device scan sync failed:', error);
  }
}

async function syncRoomJoin() {
  console.log('🏠 Syncing room join...');
  
  try {
    const roomRequests = await getStoredData('roomJoinRequests') || [];
    
    for (const roomRequest of roomRequests) {
      try {
        // This would typically involve WebSocket reconnection
        // For now, just log the attempt
        console.log('Attempting to rejoin room:', roomRequest.roomId);
        
        // Notify clients to attempt reconnection
        await notifyClients({
          type: 'ROOM_REJOIN_REQUESTED',
          data: roomRequest
        });
        
        await removeStoredData('roomJoinRequests', roomRequest.id);
      } catch (error) {
        console.error('Failed to sync room join:', error);
      }
    }
  } catch (error) {
    console.error('Room join sync failed:', error);
  }
}

async function syncOfflineMessages() {
  console.log('💬 Syncing offline messages...');
  
  try {
    const offlineMessages = await getStoredData('offlineMessages') || [];
    
    for (const message of offlineMessages) {
      try {
        // This would send queued messages when back online
        console.log('Syncing offline message:', message);
        
        // In a real implementation, you'd send this via WebSocket
        await notifyClients({
          type: 'OFFLINE_MESSAGE_READY',
          data: message
        });
        
        await removeStoredData('offlineMessages', message.id);
      } catch (error) {
        console.error('Failed to sync offline message:', error);
      }
    }
  } catch (error) {
    console.error('Offline message sync failed:', error);
  }
}

// Storage helpers (using IndexedDB would be better for complex data)
async function getStoredData(key) {
  // Simple localStorage wrapper - in production, use IndexedDB
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get stored data:', error);
    return null;
  }
}

async function setStoredData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to store data:', error);
  }
}

async function removeStoredData(key, id) {
  try {
    const data = await getStoredData(key) || [];
    const filtered = data.filter(item => item.id !== id);
    await setStoredData(key, filtered);
  } catch (error) {
    console.error('Failed to remove stored data:', error);
  }
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll();
  
  clients.forEach(client => {
    client.postMessage(message);
  });
}

// Performance monitoring
self.addEventListener('fetch', (event) => {
  // Track fetch performance
  const startTime = performance.now();
  
  event.respondWith(
    fetch(event.request).then(response => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Log slow requests
      if (duration > 1000) { // 1 second
        console.warn(`Slow request detected: ${event.request.url} took ${duration}ms`);
      }
      
      return response;
    })
  );
});

console.log('🎉 Service Worker loaded successfully!');
