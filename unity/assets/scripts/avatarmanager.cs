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
        public float bobbingSpeed = 2.0
