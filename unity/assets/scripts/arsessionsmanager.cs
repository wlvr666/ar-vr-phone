using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using Unity.Netcode;
using TMPro;
using UnityEngine.UI;

namespace ARVRPhone
{
    public class ARSessionManager : NetworkBehaviour
    {
        [Header("AR Components")]
        public ARSession arSession;
        public ARSessionOrigin arSessionOrigin;
        public ARCamera arCamera;
        public ARPlaneManager arPlaneManager;
        public ARRaycastManager arRaycastManager;
        
        [Header("VR Components")]
        public Camera vrCamera;
        public Transform vrRig;
        
        [Header("UI Components")]
        public Canvas mainUICanvas;
        public TextMeshProUGUI statusText;
        public TextMeshProUGUI userCountText;
        public Button arModeButton;
        public Button vrModeButton;
        public Button callButton;
        public Button endCallButton;
        public Button chatButton;
        public GameObject chatPanel;
        public TMP_InputField chatInput;
        public ScrollRect chatScrollView;
        public Transform chatContent;
        public GameObject chatMessagePrefab;
        
        [Header("Communication")]
        public CommunicationManager communicationManager;
        public AvatarManager avatarManager;
        
        [Header("Settings")]
        public LayerMask placementLayerMask = 1;
        public GameObject objectToPlace;
        
        // Private variables
        private bool isARMode = false;
        private bool isVRMode = false;
        private bool isInCall = false;
        private List<ARRaycastHit> raycastHits = new List<ARRaycastHit>();
        private Dictionary<string, GameObject> placedObjects = new Dictionary<string, GameObject>();
        
        // Events
        public System.Action<bool> OnARModeChanged;
        public System.Action<bool> OnVRModeChanged;
        public System.Action<bool> OnCallStateChanged;
        
        private void Start()
        {
            InitializeSession();
            SetupUI();
            
            // Start in AR mode by default on mobile
            if (Application.isMobilePlatform)
            {
                StartCoroutine(DelayedARStart());
            }
            else
            {
                EnableVRMode();
            }
        }
        
        private IEnumerator DelayedARStart()
        {
            yield return new WaitForSeconds(1f);
            EnableARMode();
        }
        
        private void InitializeSession()
        {
            // Initialize AR components
            if (arSession == null)
                arSession = FindObjectOfType<ARSession>();
            
            if (arSessionOrigin == null)
                arSessionOrigin = FindObjectOfType<ARSessionOrigin>();
                
            if (arCamera == null)
                arCamera = FindObjectOfType<ARCamera>();
                
            if (arPlaneManager == null)
                arPlaneManager = FindObjectOfType<ARPlaneManager>();
                
            if (arRaycastManager == null)
                arRaycastManager = FindObjectOfType<ARRaycastManager>();
            
            // Initialize communication
            if (communicationManager == null)
                communicationManager = FindObjectOfType<CommunicationManager>();
                
            if (avatarManager == null)
                avatarManager = FindObjectOfType<AvatarManager>();
            
            UpdateStatusText("AR-VR Phone Initialized");
        }
        
        private void SetupUI()
        {
            // Set up button listeners
            if (arModeButton != null)
                arModeButton.onClick.AddListener(() => ToggleARMode());
                
            if (vrModeButton != null)
                vrModeButton.onClick.AddListener(() => ToggleVRMode());
                
            if (callButton != null)
                callButton.onClick.AddListener(() => StartCall());
                
            if (endCallButton != null)
                endCallButton.onClick.AddListener(() => EndCall());
                
            if (chatButton != null)
                chatButton.onClick.AddListener(() => ToggleChat());
            
            // Set up chat input
            if (chatInput != null)
                chatInput.onEndEdit.AddListener(SendChatMessage);
            
            // Initially hide end call button
            if (endCallButton != null)
                endCallButton.gameObject.SetActive(false);
        }
        
        private void Update()
        {
            HandleInput();
            UpdateUI();
        }
        
        private void HandleInput()
        {
            // Handle touch input for AR object placement
            if (isARMode && Input.touchCount > 0)
            {
                Touch touch = Input.GetTouch(0);
                
                if (touch.phase == TouchPhase.Began)
                {
                    HandleARTouch(touch.position);
                }
            }
            
            // Handle mouse input for desktop testing
            if (!Application.isMobilePlatform && Input.GetMouseButtonDown(0))
            {
                HandleARTouch(Input.mousePosition);
            }
        }
        
        private void HandleARTouch(Vector2 screenPosition)
        {
            if (arRaycastManager != null && arRaycastManager.Raycast(screenPosition, raycastHits, TrackableType.PlaneWithinPolygon))
            {
                if (raycastHits.Count > 0)
                {
                    ARRaycastHit hit = raycastHits[0];
                    PlaceObject(hit.pose);
                }
            }
        }
        
        private void PlaceObject(Pose pose)
        {
            if (objectToPlace != null)
            {
                GameObject placedObject = Instantiate(objectToPlace, pose.position, pose.rotation);
                string objectId = System.Guid.NewGuid().ToString();
                placedObjects.Add(objectId, placedObject);
                
                // Network the placed object
                if (IsServer)
                {
                    PlaceObjectServerRpc(pose.position, pose.rotation, objectId);
                }
            }
        }
        
        [ServerRpc]
        private void PlaceObjectServerRpc(Vector3 position, Quaternion rotation, string objectId)
        {
            PlaceObjectClientRpc(position, rotation, objectId);
        }
        
        [ClientRpc]
        private void PlaceObjectClientRpc(Vector3 position, Quaternion rotation, string objectId)
        {
            if (!placedObjects.ContainsKey(objectId))
            {
                GameObject placedObject = Instantiate(objectToPlace, position, rotation);
                placedObjects.Add(objectId, placedObject);
            }
        }
        
        public void EnableARMode()
        {
            if (isARMode) return;
            
            isARMode = true;
            isVRMode = false;
            
            // Enable AR components
            if (arSession != null) arSession.enabled = true;
            if (arSessionOrigin != null) arSessionOrigin.gameObject.SetActive(true);
            if (arCamera != null) arCamera.gameObject.SetActive(true);
            if (arPlaneManager != null) arPlaneManager.enabled = true;
            
            // Disable VR components
            if (vrCamera != null) vrCamera.gameObject.SetActive(false);
            if (vrRig != null) vrRig.gameObject.SetActive(false);
            
            UpdateStatusText("AR Mode Enabled");
            OnARModeChanged?.Invoke(true);
            
            Debug.Log("AR Mode Enabled");
        }
        
        public void EnableVRMode()
        {
            if (isVRMode) return;
            
            isVRMode = true;
            isARMode = false;
            
            // Enable VR components
            if (vrCamera != null) vrCamera.gameObject.SetActive(true);
            if (vrRig != null) vrRig.gameObject.SetActive(true);
            
            // Disable AR components
            if (arSession != null) arSession.enabled = false;
            if (arSessionOrigin != null) arSessionOrigin.gameObject.SetActive(false);
            if (arCamera != null) arCamera.gameObject.SetActive(false);
            
            UpdateStatusText("VR Mode Enabled");
            OnVRModeChanged?.Invoke(true);
            
            Debug.Log("VR Mode Enabled");
        }
        
        public void ToggleARMode()
        {
            if (isARMode)
            {
                DisableXRMode();
            }
            else
            {
                EnableARMode();
            }
        }
        
        public void ToggleVRMode()
        {
            if (isVRMode)
            {
                DisableXRMode();
            }
            else
            {
                EnableVRMode();
            }
        }
        
        public void DisableXRMode()
        {
            isARMode = false;
            isVRMode = false;
            
            // Disable all XR components
            if (arSession != null) arSession.enabled = false;
            if (arSessionOrigin != null) arSessionOrigin.gameObject.SetActive(false);
            if (arCamera != null) arCamera.gameObject.SetActive(false);
            if (vrCamera != null) vrCamera.gameObject.SetActive(false);
            if (vrRig != null) vrRig.gameObject.SetActive(false);
            
            UpdateStatusText("Desktop Mode");
            OnARModeChanged?.Invoke(false);
            OnVRModeChanged?.Invoke(false);
        }
        
        public void StartCall()
        {
            if (isInCall) return;
            
            isInCall = true;
            
            // Start communication
            if (communicationManager != null)
            {
                communicationManager.StartCall();
            }
            
            // Update UI
            if (callButton != null) callButton.gameObject.SetActive(false);
            if (endCallButton != null) endCallButton.gameObject.SetActive(true);
            
            UpdateStatusText("Call Started");
            OnCallStateChanged?.Invoke(true);
            
            Debug.Log("Call Started");
        }
        
        public void EndCall()
        {
            if (!isInCall) return;
            
            isInCall = false;
            
            // End communication
            if (communicationManager != null)
            {
                communicationManager.EndCall();
            }
            
            // Update UI
            if (callButton != null) callButton.gameObject.SetActive(true);
            if (endCallButton != null) endCallButton.gameObject.SetActive(false);
            
            UpdateStatusText("Call Ended");
            OnCallStateChanged?.Invoke(false);
            
            Debug.Log("Call Ended");
        }
        
        public void ToggleChat()
        {
            if (chatPanel != null)
            {
                bool isActive = chatPanel.activeSelf;
                chatPanel.SetActive(!isActive);
            }
        }
        
        public void SendChatMessage(string message)
        {
            if (string.IsNullOrEmpty(message)) return;
            
            // Send message through communication manager
            if (communicationManager != null)
            {
                communicationManager.SendChatMessage(message);
            }
            
            // Add to local chat
            AddChatMessage("You", message);
            
            // Clear input
            if (chatInput != null)
            {
                chatInput.text = "";
            }
        }
        
        public void AddChatMessage(string sender, string message)
        {
            if (chatMessagePrefab != null && chatContent != null)
            {
                GameObject messageObj = Instantiate(chatMessagePrefab, chatContent);
                TextMeshProUGUI messageText = messageObj.GetComponent<TextMeshProUGUI>();
                
                if (messageText != null)
                {
                    messageText.text = $"<b>{sender}:</b> {message}";
                }
                
                // Scroll to bottom
                if (chatScrollView != null)
                {
                    Canvas.ForceUpdateCanvases();
                    chatScrollView.verticalNormalizedPosition = 0f;
                }
            }
        }
        
        private void UpdateUI()
        {
            // Update user count
            if (userCountText != null && communicationManager != null)
            {
                userCountText.text = $"Users: {communicationManager.ConnectedUserCount}";
            }
        }
        
        private void UpdateStatusText(string status)
        {
            if (statusText != null)
            {
                statusText.text = status;
            }
        }
        
        public bool IsARMode => isARMode;
        public bool IsVRMode => isVRMode;
        public bool IsInCall => isInCall;
        
        private void OnDestroy()
        {
            // Clean up event listeners
            if (arModeButton != null) arModeButton.onClick.RemoveAllListeners();
            if (vrModeButton != null) vrModeButton.onClick.RemoveAllListeners();
            if (callButton != null) callButton.onClick.RemoveAllListeners();
            if (endCallButton != null) endCallButton.onClick.RemoveAllListeners();
            if (chatButton != null) chatButton.onClick.RemoveAllListeners();
            if (chatInput != null) chatInput.onEndEdit.RemoveAllListeners();
        }
    }
}
