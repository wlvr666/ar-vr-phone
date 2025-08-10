using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using TMPro;
using Unity.Netcode;

namespace ARVRPhone
{
    [System.Serializable]
    public class AvatarComponents
    {
        public GameObject avatarRoot;
        public Transform avatarBody;
        public Renderer avatarRenderer;
        public TextMeshPro nameTag;
        public GameObject callIndicator;
        public GameObject muteIndicator;
        public Animator animator;
        public AudioSource voiceSource;
        public ParticleSystem talkingEffect;
    }
    
    public class AvatarManager : MonoBehaviour
    {
        [Header("Avatar Prefabs")]
        public GameObject avatarPrefab;
        public GameObject nameTagPrefab;
        public GameObject callIndicatorPrefab;
        public GameObject muteIndicatorPrefab;
        
        [Header("Avatar Settings")]
        public float avatarScale = 1.0f;
        public float nameTagHeight = 2.5f;
        public float indicatorHeight = 3.0f;
        public Material[] avatarMaterials;
        public Color[] avatarColors = {
            Color.red, Color.blue, Color.green, Color.yellow, 
            Color.magenta, Color.cyan, Color.white
        };
        
        [Header("Animation Settings")]
        public float bobbingSpeed = 2.0f;
        public float bobbingAmount = 0.1f;
        public float rotationSpeed = 30.0f;
        
        [Header("Audio Settings")]
        public AudioClip[] voiceSamples;
        public float maxHearingDistance = 10.0f;
        
        // Private variables
        private Dictionary<string, AvatarComponents> avatars = new Dictionary<string, AvatarComponents>();
        private Transform playerCamera;
        private CommunicationManager communicationManager;
        
        private void Start()
        {
            // Get references
            communicationManager = FindObjectOfType<CommunicationManager>();
            
            // Find player camera
            Camera cam = Camera.main;
            if (cam == null) cam = FindObjectOfType<Camera>();
            if (cam != null) playerCamera = cam.transform;
            
            // Subscribe to communication events
            if (communicationManager != null)
            {
                communicationManager.OnUserJoined += CreateUserAvatar;
                communicationManager.OnUserLeft += RemoveUserAvatar;
            }
        }
        
        public void CreateUserAvatar(UserData userData)
        {
            if (avatars.ContainsKey(userData.userId)) return;
            
            // Create avatar root object
            GameObject avatarRoot = new GameObject($"Avatar_{userData.userName}");
            avatarRoot.transform.position = userData.position;
            avatarRoot.transform.rotation = userData.rotation;
            
            // Create avatar components
            AvatarComponents components = new AvatarComponents();
            components.avatarRoot = avatarRoot;
            
            // Create avatar body
            if (avatarPrefab != null)
            {
                components.avatarBody = Instantiate(avatarPrefab, avatarRoot.transform).transform;
            }
            else
            {
                // Create basic sphere avatar
                GameObject sphere = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                sphere.transform.parent = avatarRoot.transform;
                sphere.transform.localPosition = Vector3.up * 1.6f;
                sphere.transform.localScale = Vector3.one * 0.3f;
                components.avatarBody = sphere.transform;
                components.avatarRenderer = sphere.GetComponent<Renderer>();
            }
            
            // Set avatar color
            SetAvatarColor(components, userData.avatarColor);
            
            // Create name tag
            CreateNameTag(components, userData.userName, avatarRoot.transform);
            
            // Create call indicator
            CreateCallIndicator(components, avatarRoot.transform);
            
            // Create mute indicator
            CreateMuteIndicator(components, avatarRoot.transform);
            
            // Add voice source
            components.voiceSource = avatarRoot.AddComponent<AudioSource>();
            components.voiceSource.spatialBlend = 1.0f; // 3D audio
            components.voiceSource.maxDistance = maxHearingDistance;
            components.voiceSource.rolloffMode = AudioRolloffMode.Linear;
            
            // Add talking effect
            CreateTalkingEffect(components, avatarRoot.transform);
            
            // Add to dictionary
            avatars.Add(userData.userId, components);
            
            Debug.Log($"Created avatar for {userData.userName}");
        }
        
        private void CreateNameTag(AvatarComponents components, string userName, Transform parent)
        {
            GameObject nameTagObj = new GameObject("NameTag");
            nameTagObj.transform.parent = parent;
            nameTagObj.transform.localPosition = Vector3.up * nameTagHeight;
            
            // Create canvas for name tag
            Canvas canvas = nameTagObj.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            canvas.worldCamera = playerCamera?.GetComponent<Camera>();
            
            // Scale canvas
            RectTransform canvasRect = canvas.GetComponent<RectTransform>();
            canvasRect.sizeDelta = new Vector2(2, 0.5f);
            canvasRect.localScale = Vector3.one * 0.01f;
            
            // Create text
            GameObject textObj = new GameObject("Text");
            textObj.transform.parent = nameTagObj.transform;
            
            components.nameTag = textObj.AddComponent<TextMeshPro>();
            components.nameTag.text = userName;
            components.nameTag.fontSize = 36;
            components.nameTag.color = Color.white;
            components.nameTag.alignment = TextAlignmentOptions.Center;
            components.nameTag.autoSizeTextContainer = true;
            
            // Position text
            RectTransform textRect = textObj.GetComponent<RectTransform>();
            textRect.anchorMin = Vector2.zero;
            textRect.anchorMax = Vector2.one;
            textRect.sizeDelta = Vector2.zero;
            textRect.anchoredPosition = Vector2.zero;
            
            // Add background
            GameObject bgObj = new GameObject("Background");
            bgObj.transform.parent = nameTagObj.transform;
            bgObj.transform.SetSiblingIndex(0);
            
            RectTransform bgRect = bgObj.AddComponent<RectTransform>();
            bgRect.anchorMin = Vector2.zero;
            bgRect.anchorMax = Vector2.one;
            bgRect.sizeDelta = new Vector2(20, 10);
            bgRect.anchoredPosition = Vector2.zero;
            
            UnityEngine.UI.Image bgImage = bgObj.AddComponent<UnityEngine.UI.Image>();
            bgImage.color = new Color(0, 0, 0, 0.7f);
        }
        
        private void CreateCallIndicator(AvatarComponents components, Transform parent)
        {
            GameObject indicatorObj = new GameObject("CallIndicator");
            indicatorObj.transform.parent = parent;
            indicatorObj.transform.localPosition = Vector3.up * indicatorHeight;
            
            // Create phone icon (simple cube for now)
            GameObject phoneIcon = GameObject.CreatePrimitive(PrimitiveType.Cube);
            phoneIcon.transform.parent = indicatorObj.transform;
            phoneIcon.transform.localScale = Vector3.one * 0.1f;
            phoneIcon.transform.localPosition = Vector3.zero;
            
            Renderer iconRenderer = phoneIcon.GetComponent<Renderer>();
            iconRenderer.material.color = Color.green;
            
            components.callIndicator = indicatorObj;
            components.callIndicator.SetActive(false);
        }
        
        private void CreateMuteIndicator(AvatarComponents components, Transform parent)
        {
            GameObject indicatorObj = new GameObject("MuteIndicator");
            indicatorObj.transform.parent = parent;
            indicatorObj.transform.localPosition = Vector3.up * (indicatorHeight + 0.3f);
            
            // Create mute icon (simple sphere with X)
            GameObject muteIcon = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            muteIcon.transform.parent = indicatorObj.transform;
            muteIcon.transform.localScale = Vector3.one * 0.08f;
            muteIcon.transform.localPosition = Vector3.zero;
            
            Renderer iconRenderer = muteIcon.GetComponent<Renderer>();
            iconRenderer.material.color = Color.red;
            
            components.muteIndicator = indicatorObj;
            components.muteIndicator.SetActive(false);
        }
        
        private void CreateTalkingEffect(AvatarComponents components, Transform parent)
        {
            GameObject effectObj = new GameObject("TalkingEffect");
            effectObj.transform.parent = parent;
            effectObj.transform.localPosition = Vector3.up * 1.8f;
            
            ParticleSystem particles = effectObj.AddComponent<ParticleSystem>();
            var main = particles.main;
            main.startLifetime = 1.0f;
            main.startSpeed = 0.5f;
            main.startSize = 0.05f;
            main.startColor = Color.cyan;
            main.maxParticles = 20;
            
            var emission = particles.emission;
            emission.rateOverTime = 10;
            
            var shape = particles.shape;
            shape.shapeType = ParticleSystemShapeType.Circle;
            shape.radius = 0.2f;
            
            components.talkingEffect = particles;
            components.talkingEffect.Stop();
        }
        
        private void SetAvatarColor(AvatarComponents components, string colorHex)
        {
            if (components.avatarRenderer != null)
            {
                Color avatarColor;
                if (ColorUtility.TryParseHtmlString(colorHex, out avatarColor))
                {
                    components.avatarRenderer.material.color = avatarColor;
                }
                else
                {
                    // Use random color if parsing fails
                    components.avatarRenderer.material.color = avatarColors[Random.Range(0, avatarColors.Length)];
                }
            }
        }
        
        public void RemoveUserAvatar(string userId)
        {
            if (avatars.ContainsKey(userId))
            {
                AvatarComponents components = avatars[userId];
                if (components.avatarRoot != null)
                {
                    Destroy(components.avatarRoot);
                }
                avatars.Remove(userId);
                
                Debug.Log($"Removed avatar for user {userId}");
            }
        }
        
        public void UpdateUserPosition(string userId, Vector3 position, Quaternion rotation)
        {
            if (avatars.ContainsKey(userId))
            {
                AvatarComponents components = avatars[userId];
                if (components.avatarRoot != null)
                {
                    // Smooth movement
                    StartCoroutine(MoveAvatarSmoothly(components.avatarRoot.transform, position, rotation));
                }
            }
        }
        
        private IEnumerator MoveAvatarSmoothly(Transform avatarTransform, Vector3 targetPosition, Quaternion targetRotation)
        {
            Vector3 startPosition = avatarTransform.position;
            Quaternion startRotation = avatarTransform.rotation;
            float moveTime = 0.5f;
            float elapsedTime = 0f;
            
            while (elapsedTime < moveTime)
            {
                elapsedTime += Time.deltaTime;
                float t = elapsedTime / moveTime;
                
                avatarTransform.position = Vector3.Lerp(startPosition, targetPosition, t);
                avatarTransform.rotation = Quaternion.Lerp(startRotation, targetRotation, t);
                
                yield return null;
            }
            
            avatarTransform.position = targetPosition;
            avatarTransform.rotation = targetRotation;
        }
        
        public void UpdateUserCallState(string userId, bool inCall)
        {
            if (avatars.ContainsKey(userId))
            {
                AvatarComponents components = avatars[userId];
                if (components.callIndicator != null)
                {
                    components.callIndicator.SetActive(inCall);
                }
            }
        }
        
        public void UpdateUserMuteState(string userId, bool muted)
        {
            if (avatars.ContainsKey(userId))
            {
                AvatarComponents components = avatars[userId];
                if (components.muteIndicator != null)
                {
                    components.muteIndicator.SetActive(muted);
                }
            }
        }
        
        public void UpdateUserTalkingState(string userId, bool talking)
        {
            if (avatars.ContainsKey(userId))
            {
                AvatarComponents components = avatars[userId];
                if (components.talkingEffect != null)
                {
                    if (talking)
                    {
                        components.talkingEffect.Play();
                    }
                    else
                    {
                        components.talkingEffect.Stop();
                    }
                }
            }
        }
        
        private void Update()
        {
            // Update avatar animations and name tag rotations
            foreach (var kvp in avatars)
            {
                AvatarComponents components = kvp.Value;
                
                // Bobbing animation
                if (components.avatarBody != null)
                {
                    float bobOffset = Mathf.Sin(Time.time * bobbingSpeed + kvp.Key.GetHashCode()) * bobbingAmount;
                    Vector3 pos = components.avatarBody.localPosition;
                    pos.y = 1.6f + bobOffset;
                    components.avatarBody.localPosition = pos;
                    
                    // Slow rotation
                    components.avatarBody.Rotate(Vector3.up * rotationSpeed * Time.deltaTime);
                }
                
                // Make name tags face camera
                if (components.nameTag != null && playerCamera != null)
                {
                    components.nameTag.transform.LookAt(playerCamera);
                    components.nameTag.transform.Rotate(0, 180, 0);
                }
            }
        }
        
        // Public properties
        public Dictionary<string, AvatarComponents> Avatars => avatars;
        public int AvatarCount => avatars.Count;
        
        private void OnDestroy()
        {
            // Clean up event subscriptions
            if (communicationManager != null)
            {
                communicationManager.OnUserJoined -= CreateUserAvatar;
                communicationManager.OnUserLeft -= RemoveUserAvatar;
            }
        }
    }
