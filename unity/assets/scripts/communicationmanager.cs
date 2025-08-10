using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Unity.Netcode;
using System;
using UnityEngine.Android;

namespace ARVRPhone
{
    [System.Serializable]
    public class UserData
    {
        public string userId;
        public string userName;
        public Vector3 position;
        public Quaternion rotation;
        public bool isInCall;
        public bool isMuted;
        public string avatarColor;
    }
    
    [System.Serializable]
    public class ChatMessage
    {
        public string senderId;
        public string senderName;
        public string message;
        public float timestamp;
    }
    
    public class CommunicationManager : NetworkBehaviour
    {
        [Header("Network Settings")]
        public string serverAddress = "localhost";
        public int serverPort = 7777;
        public string roomId = "room-001";
        
        [Header("WebRTC Settings")]
        public bool useWebRTC = true;
        public string stunServer = "stun:stun.l.google.com:19302";
        
        [Header("Audio Settings")]
        public AudioSource microphoneSource;
        public AudioClip microphoneClip;
        public string microphoneDevice;
        public int sampleRate = 44100;
        
        [Header("Components")]
        public ARSessionManager sessionManager;
        public AvatarManager avatarManager;
        
        // Private variables
        private Dictionary<string, UserData> connectedUsers = new Dictionary<string, UserData>();
        private List<ChatMessage> chatHistory = new List<ChatMessage>();
        private bool isConnected = false;
        private bool isInCall = false;
        private bool isMicrophoneMuted = false;
        private string localUserId;
        private string localUserName;
        
        // Network variables
        private NetworkVariable<int> userCount = new NetworkVariable<int>(0);
        
        // Events
        public System.Action<UserData> OnUserJoined;
        public System.Action<string> OnUserLeft;
        public System.Action<ChatMessage> OnChatMessageReceived;
        public System.Action<bool> OnCallStateChanged;
        public System.Action<bool> OnConnectionChanged;
        
        private void Start()
        {
            InitializeCommunication();
            RequestPermissions();
        }
        
        private void InitializeCommunication()
        {
            // Generate local user data
            localUserId = SystemInfo.deviceUniqueIdentifier;
            localUserName = $"User_{UnityEngine.Random.Range(1000, 9999)}";
            
            // Initialize microphone
            InitializeMicrophone();
            
            Debug.Log($"Communication Manager Initialized - User: {localUserName}");
        }
        
        private void RequestPermissions()
        {
            // Request microphone permission on Android
            if (!Permission.HasUserAuthorizedPermission(Permission.Microphone))
            {
                Permission.RequestUserPermission(Permission.Microphone);
            }
            
            // Request camera permission on Android
            if (!Permission.HasUserAuthorizedPermission(Permission.Camera))
            {
                Permission.RequestUserPermission(Permission.Camera);
            }
        }
        
        private void InitializeMicrophone()
        {
            if (Microphone.devices.Length > 0)
            {
                microphoneDevice = Microphone.devices[0];
                
                if (microphoneSource == null)
                {
                    GameObject micObj = new GameObject("MicrophoneSource");
                    micObj.transform.parent = transform;
                    microphoneSource = micObj.AddComponent<AudioSource>();
                }
                
                Debug.Log($"Microphone initialized: {microphoneDevice}");
            }
            else
            {
                Debug.LogWarning("No microphone devices found!");
            }
        }
        
        public void StartNetworking()
        {
            if (NetworkManager.Singleton != null)
            {
                // Try to start as host first, fallback to client
                if (NetworkManager.Singleton.StartHost())
                {
                    Debug.Log("Started as Host");
                }
                else if (NetworkManager.Singleton.StartClient())
                {
                    Debug.Log("Started as Client");
                }
                else
                {
                    Debug.LogError("Failed to start networking");
                }
            }
        }
        
        public void StopNetworking()
        {
            if (NetworkManager.Singleton != null)
            {
                NetworkManager.Singleton.Shutdown();
            }
        }
        
        public override void OnNetworkSpawn()
        {
            isConnected = true;
            OnConnectionChanged?.Invoke(true);
            
            if (IsServer)
            {
                userCount.Value = 1;
            }
            
            // Register this user
            RegisterUserServerRpc(localUserId, localUserName);
            
            Debug.Log("Network spawned - Connected to session");
        }
        
        public override void OnNetworkDespawn()
        {
            isConnected = false;
            OnConnectionChanged?.Invoke(false);
            
            Debug.Log("Network despawned - Disconnected from session");
        }
        
        [ServerRpc]
        private void RegisterUserServerRpc(string userId, string userName)
        {
            // Add user to server list
            UserData newUser = new UserData
            {
                userId = userId,
                userName = userName,
                position = Vector3.zero,
                rotation = Quaternion.identity,
                isInCall = false,
                isMuted = false,
                avatarColor = GetRandomAvatarColor()
            };
            
            if (!connectedUsers.ContainsKey(userId))
            {
                connectedUsers.Add(userId, newUser);
                userCount.Value = connectedUsers.Count;
            }
            
            // Notify all clients
            UserJoinedClientRpc(userId, userName, newUser.avatarColor);
            
            Debug.Log($"User registered: {userName} ({userId})");
        }
        
        [ClientRpc]
        private void UserJoinedClientRpc(string userId, string userName, string avatarColor)
        {
            if (userId != localUserId) // Don't add ourselves
            {
                UserData newUser = new UserData
                {
                    userId = userId,
                    userName = userName,
                    position = Vector3.zero,
                    rotation = Quaternity.identity,
                    isInCall = false,
                    isMuted = false,
                    avatarColor = avatarColor
                };
                
                if (!connectedUsers.ContainsKey(userId))
                {
                    connectedUsers.Add(userId, newUser);
                    OnUserJoined?.Invoke(newUser);
                    
                    // Create avatar
                    if (avatarManager != null)
                    {
                        avatarManager.CreateUserAvatar(newUser);
                    }
                }
            }
        }
        
        [ServerRpc]
        private void UnregisterUserServerRpc(string userId)
        {
            if (connectedUsers.ContainsKey(userId))
            {
                connectedUsers.Remove(userId);
                userCount.Value = connectedUsers.Count;
                UserLeftClientRpc(userId);
            }
        }
        
        [ClientRpc]
        private void UserLeftClientRpc(string userId)
        {
            if (connectedUsers.ContainsKey(userId))
            {
                connectedUsers.Remove(userId);
                OnUserLeft?.Invoke(userId);
                
                // Remove avatar
                if (avatarManager != null)
                {
                    avatarManager.RemoveUserAvatar(userId);
                }
            }
        }
        
        public void StartCall()
        {
            if (isInCall) return;
            
            isInCall = true;
            StartMicrophone();
            
            // Notify other users
            CallStateChangedServerRpc(localUserId, true);
            
            OnCallStateChanged?.Invoke(true);
            Debug.Log("Call started");
        }
        
        public void EndCall()
        {
            if (!isInCall) return;
            
            isInCall = false;
            StopMicrophone();
            
            // Notify other users
            CallStateChangedServerRpc(localUserId, false);
            
            OnCallStateChanged?.Invoke(false);
            Debug.Log("Call ended");
        }
        
        [ServerRpc]
        private void CallStateChangedServerRpc(string userId, bool inCall)
        {
            if (connectedUsers.ContainsKey(userId))
            {
                connectedUsers[userId].isInCall = inCall;
                CallStateChangedClientRpc(userId, inCall);
            }
        }
        
        [ClientRpc]
        private void CallStateChangedClientRpc(string userId, bool inCall)
        {
            if (connectedUsers.ContainsKey(userId))
            {
                connectedUsers[userId].isInCall = inCall;
                
                // Update avatar visual state
                if (avatarManager != null)
                {
                    avatarManager.UpdateUserCallState(userId, inCall);
                }
            }
        }
        
        private void StartMicrophone()
        {
            if (!string.IsNullOrEmpty(microphoneDevice) && microphoneSource != null)
            {
                microphoneClip = Microphone.Start(microphoneDevice, true, 1, sampleRate);
                microphoneSource.clip = microphoneClip;
                microphoneSource.loop = true;
                
                // Wait for microphone to start
                while (!(Microphone.GetPosition(microphoneDevice) > 0)) { }
                
                microphoneSource.Play();
                Debug.Log("Microphone started");
            }
        }
        
        private void StopMicrophone()
        {
            if (!string.IsNullOrEmpty(microphoneDevice))
            {
                Microphone.End(microphoneDevice);
                
                if (microphoneSource != null)
                {
                    microphoneSource.Stop();
                }
                
                Debug.Log("Microphone stopped");
            }
        }
        
        public void ToggleMicrophone()
        {
            isMicrophoneMuted = !isMicrophoneMuted;
            
            if (microphoneSource != null)
            {
                microphoneSource.mute = isMicrophoneMuted;
            }
            
            // Notify other users
            MuteStateChangedServerRpc(localUserId, isMicrophoneMuted);
            
            Debug.Log($"Microphone {(isMicrophoneMuted ? "muted" : "unmuted")}");
        }
        
        [ServerRpc]
        private void MuteStateChangedServerRpc(string userId, bool muted)
        {
            if (connectedUsers.ContainsKey(userId))
            {
                connectedUsers[userId].isMuted = muted;
                MuteStateChangedClientRpc(userId, muted);
            }
        }
        
        [ClientRpc]
        private void MuteStateChangedClientRpc(string userId, bool muted)
        {
            if (connectedUsers.ContainsKey(userId))
            {
                connectedUsers[userId].isMuted = muted;
                
                // Update avatar visual state
                if (avatarManager != null)
                {
                    avatarManager.UpdateUserMuteState(userId, muted);
                }
            }
        }
        
        public void SendChatMessage(string message)
        {
            if (string.IsNullOrEmpty(message)) return;
            
            ChatMessage chatMessage = new ChatMessage
            {
                senderId = localUserId,
                senderName = localUserName,
                message = message,
                timestamp = Time.time
            };
            
            // Add to local history
            chatHistory.Add(chatMessage);
            
            // Send to other users
            SendChatMessageServerRpc(localUserId, localUserName, message, Time.time);
            
            Debug.Log($"Chat message sent: {message}");
        }
        
        [ServerRpc]
        private void SendChatMessageServerRpc(string senderId, string senderName, string message, float timestamp)
        {
            SendChatMessageClientRpc(senderId, senderName, message, timestamp);
        }
        
        [ClientRpc]
        private void SendChatMessageClientRpc(string senderId, string senderName, string message, float timestamp)
        {
            if (senderId != localUserId) // Don't duplicate our own messages
            {
                ChatMessage chatMessage = new ChatMessage
                {
                    senderId = senderId,
                    senderName = senderName,
                    message = message,
                    timestamp = timestamp
                };
                
                chatHistory.Add(chatMessage);
                OnChatMessageReceived?.Invoke(chatMessage);
                
                // Add to UI
                if (sessionManager != null)
                {
                    sessionManager.AddChatMessage(senderName, message);
                }
            }
        }
        
        public void UpdateUserPosition(Vector3 position, Quaternion rotation)
        {
            UpdateUserPositionServerRpc(localUserId, position, rotation);
        }
        
        [ServerRpc]
        private void UpdateUserPositionServerRpc(string userId, Vector3 position, Quaternion rotation)
        {
            if (connectedUsers.ContainsKey(userId))
            {
                connectedUsers[userId].position = position;
                connectedUsers[userId].rotation = rotation;
                UpdateUserPositionClientRpc(userId, position, rotation);
            }
        }
        
        [ClientRpc]
        private void UpdateUserPositionClientRpc(string userId, Vector3 position, Quaternion rotation)
        {
            if (userId != localUserId && connectedUsers.ContainsKey(userId))
            {
                connectedUsers[userId].position = position;
                connectedUsers[userId].rotation = rotation;
                
                // Update avatar position
                if (avatarManager != null)
                {
                    avatarManager.UpdateUserPosition(userId, position, rotation);
                }
            }
        }
        
        private string GetRandomAvatarColor()
        {
            string[] colors = { "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#feca57", "#ff9ff3", "#54a0ff" };
            return colors[UnityEngine.Random.Range(0, colors.Length)];
        }
        
        // Public properties
        public int ConnectedUserCount => connectedUsers.Count;
        public bool IsConnected => isConnected;
        public bool IsInCall => isInCall;
        public bool IsMicrophoneMuted => isMicrophoneMuted;
        public string LocalUserId => localUserId;
        public string LocalUserName => localUserName;
        public Dictionary<string, UserData> ConnectedUsers => connectedUsers;
        public List<ChatMessage> ChatHistory => chatHistory;
        
        private void Update()
        {
            // Send position updates if in AR/VR mode
            if (isConnected && (sessionManager.IsARMode || sessionManager.IsVRMode))
            {
                Transform cameraTransform = sessionManager.IsARMode ? 
                    sessionManager.arCamera.transform : 
                    sessionManager.vrCamera.transform;
                
                if (cameraTransform != null)
                {
                    UpdateUserPosition(cameraTransform.position, cameraTransform.rotation);
                }
            }
        }
        
        private void OnDestroy()
        {
            EndCall();
            StopNetworking();
        }
    }
}
