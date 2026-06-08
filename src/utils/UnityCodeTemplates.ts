/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CodeTemplate {
  name: string;
  filename: string;
  language: string;
  description: string;
  code: string;
}

export const UNITY_TEMPLATES: CodeTemplate[] = [
  {
    name: "第一人称视角控制器",
    filename: "FirstPersonController.cs",
    language: "csharp",
    description: "完全适配团结引擎和 Unity 的第一人称键盘移动(WASD)加鼠标视口旋转控制器。包含了重力模拟、碰撞体地面检测及跳跃逻辑。",
    code: `using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class FirstPersonController : MonoBehaviour
{
    [Header("移动设置")]
    public float walkSpeed = 5.0f;
    public float runSpeed = 8.0f;
    public float jumpHeight = 1.5f;
    public float gravity = 9.81f;

    [Header("视角旋转")]
    public float mouseSensitivity = 100.0f;
    public float upLookLimit = 80.0f;
    public float downLookLimit = 80.0f;

    private CharacterController characterController;
    private Camera playerCamera;
    private float verticalRotation = 0.0f;
    private Vector3 movementVelocity;
    private bool isGrounded;

    void Start()
    {
        characterController = GetComponent<CharacterController>();
        playerCamera = GetComponentInChildren<Camera>();

        // 锁定鼠标光标到屏幕中央，在游戏运行时隐藏
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    void Update()
    {
        HandleCameraLook();
        HandleMovement();
    }

    private void HandleCameraLook()
    {
        // 获取鼠标输入轴
        float mouseX = Input.GetAxis("Mouse X") * mouseSensitivity * Time.deltaTime;
        float mouseY = Input.GetAxis("Mouse Y") * mouseSensitivity * Time.deltaTime;

        // 绕Y轴水平旋转物体自身
        transform.Rotate(Vector3.up * mouseX);

        // 计算并限制纵向仰俯角度
        verticalRotation -= mouseY;
        verticalRotation = Mathf.Clamp(verticalRotation, -downLookLimit, upLookLimit);
        
        // 旋转摄像机
        if (playerCamera != null)
        {
            playerCamera.transform.localRotation = Quaternion.Euler(verticalRotation, 0, 0);
        }
    }

    private void HandleMovement()
    {
        // 地面检测
        isGrounded = characterController.isGrounded;
        if (isGrounded && movementVelocity.y < 0)
        {
            // 保持一个微小的向下拉力用于稳定着地
            movementVelocity.y = -2.0f;
        }

        // 获取键盘 WASD 移动轴输入
        float moveX = Input.GetAxis("Horizontal");
        float moveZ = Input.GetAxis("Vertical");

        // 根据角色面朝方向计算世界坐标系下的移动向量
        Vector3 moveDirection = transform.right * moveX + transform.forward * moveZ;
        
        // 区分步行与奔跑
        float currentSpeed = Input.GetKey(KeyCode.LeftShift) ? runSpeed : walkSpeed;
        characterController.Move(moveDirection * currentSpeed * Time.deltaTime);

        // 跳跃控制
        if (Input.GetButtonDown("Jump") && isGrounded)
        {
            // 物理公式: v = sqrt(2 * g * h)
            movementVelocity.y = Mathf.Sqrt(jumpHeight * 2.0f * gravity);
        }

        // 应用重力
        movementVelocity.y -= gravity * Time.deltaTime;

        // 执行垂直移动
        characterController.Move(movementVelocity * Time.deltaTime);
    }
}`
  },
  {
    name: "绕物鸟瞰摄像机",
    filename: "OrbitCamera.cs",
    language: "csharp",
    description: "点击并拖拽屏幕可实现绕主建筑或詹天佑像的圆周盘旋鸟瞰。鼠标滚轮可实时缩放距离，且自带了阻尼及边界角度限位。",
    code: `using UnityEngine;

public class OrbitCamera : MonoBehaviour
{
    [Header("观察目标")]
    public Transform target; // 环绕的核心建筑或雕像

    [Header("控制属性")]
    public float xSpeed = 120.0f;
    public float ySpeed = 120.0f;
    public float zoomSpeed = 5.0f;

    [Header("距离限制")]
    public float distanceMin = 5.0f;
    public float distanceMax = 40.0f;

    [Header("仰俯角限制")]
    public float yMinLimit = 10.0f;
    public float yMaxLimit = 80.0f;

    private float x = 0.0f;
    private float y = 0.0f;
    private float distance = 15.0f;

    private float currentX = 0.0f;
    private float currentY = 0.0f;
    private float currentDistance = 15.0f;

    public float smoothTime = 0.2f;
    private float xVelocity = 0.0f;
    private float yVelocity = 0.0f;
    private float zoomVelocity = 0.0f;

    void Start()
    {
        Vector3 angles = transform.eulerAngles;
        x = angles.y;
        y = angles.x;

        currentX = x;
        currentY = y;
        currentDistance = distance;

        // 如果没有默认设置观察目标，尝试在场景中寻找名为 "MainBuilding" 的物体
        if (target == null)
        {
            GameObject go = GameObject.Find("MainBuilding");
            if (go != null) target = go.transform;
        }
    }

    void LateUpdate()
    {
        if (target == null) return;

        // 只有在按下鼠标右键或左键拖拽时（PC端交互），才进行仰俯以及旋转调节
        if (Input.GetMouseButton(0) || Input.GetMouseButton(1))
        {
            x += Input.GetAxis("Mouse X") * xSpeed * 0.02f;
            y -= Input.GetAxis("Mouse Y") * ySpeed * 0.02f;
            y = ClampAngle(y, yMinLimit, yMaxLimit);
        }

        // 鼠标滚轮调节观察核心的距离
        float scrollInput = Input.GetAxis("Mouse ScrollWheel");
        distance = Mathf.Clamp(distance - scrollInput * zoomSpeed, distanceMin, distanceMax);

        // 使用平滑阻尼算法，获得丝滑般柔和过渡
        currentX = Mathf.SmoothDampAngle(currentX, x, ref xVelocity, smoothTime);
        currentY = Mathf.SmoothDampAngle(currentY, y, ref yVelocity, smoothTime);
        currentDistance = Mathf.SmoothDamp(currentDistance, distance, ref zoomVelocity, smoothTime * 0.5f);

        // 三维球体坐标系推导公式
        Quaternion rotation = Quaternion.Euler(currentY, currentX, 0);
        Vector3 negDistance = new Vector3(0.0f, 0.0f, -currentDistance);
        Vector3 position = rotation * negDistance + target.position;

        transform.rotation = rotation;
        transform.position = position;
    }

    private float ClampAngle(float angle, float min, float max)
    {
        if (angle < -360F) angle += 360F;
        if (angle > 360F) angle -= 360F;
        return Mathf.Clamp(angle, min, max);
    }
}`
  },
  {
    name: "四合一多摄像机切换系统",
    filename: "CameraSwitcher.cs",
    language: "csharp",
    description: "多机位切换控制台。按下数字键或点击UI即可在'摄影机动画'、'场景鸟瞰'、'第一人称漫游'和'自由探索机位'之间平滑切换。",
    code: `using UnityEngine;
using System.Collections.Generic;

public class CameraSwitcher : MonoBehaviour
{
    [System.Serializable]
    public struct CameraPreset
    {
        public string cameraName;
        public Camera cameraComponent;
        public GameObject controlScriptHolder; // 用于开关对应的移动控制代码
    }

    [Header("摄像机机位预设")]
    public List<CameraPreset> cameras = new List<CameraPreset>();

    [Header("当前机位索引")]
    public int activeCameraIndex = 0;

    void Start()
    {
        // 初始化时，确保有且只有一个摄像机处于活跃状态
        SwitchToCamera(activeCameraIndex);
    }

    void Update()
    {
        // 支持键盘数字快捷键 1, 2, 3, 4 快速切除
        for (int i = 0; i < cameras.Count; i++)
        {
            if (Input.GetKeyDown(KeyCode.Alpha1 + i))
            {
                SwitchToCamera(i);
            }
        }
    }

    public void SwitchToCamera(int index)
    {
        if (index < 0 || index >= cameras.Count) return;

        activeCameraIndex = index;

        for (int i = 0; i < cameras.Count; i++)
        {
            bool isCurrent = (i == index);
            
            if (cameras[i].cameraComponent != null)
            {
                // 启用/停用摄像机组件、耳麦音效监听
                cameras[i].cameraComponent.gameObject.SetActive(isCurrent);
                cameras[i].cameraComponent.enabled = isCurrent;

                AudioListener listener = cameras[i].cameraComponent.GetComponent<AudioListener>();
                if (listener != null) listener.enabled = isCurrent;
            }

            // 启用/停用与之绑定的特有交互控制代码组件 (例如 FirstPersonController.cs)
            if (cameras[i].controlScriptHolder != null)
            {
                cameras[i].controlScriptHolder.SetActive(isCurrent);
            }
        }

        Debug.Log("Switched to camera position: " + cameras[index].cameraName);
    }
}`
  },
  {
    name: "摄影机路径动画飞跃",
    filename: "CameraPathAnimator.cs",
    language: "csharp",
    description: "自动运行的环校大片感运镜。通过贝塞尔或 Waypoint 路点进行平滑插值，实现开场绕湖盘旋和铁道大学地标景观自动巡航路径。",
    code: `using UnityEngine;

public class CameraPathAnimator : MonoBehaviour
{
    [Header("路径路点组")]
    public Transform[] pathWaypoints; // 沿校园道路和翠屏湖布设的节点

    [Header("动画配置")]
    public float movementSpeed = 3.0f;
    public bool loopPath = true;
    public float rotationDamp = 4.0f;

    private int currentWaypointIndex = 0;

    void Start()
    {
        if (pathWaypoints.Length > 0 && pathWaypoints[0] != null)
        {
            transform.position = pathWaypoints[0].position;
        }
    }

    void Update()
    {
        if (pathWaypoints.Length == 0) return;

        Transform targetNode = pathWaypoints[currentWaypointIndex];
        if (targetNode == null) return;

        // 移向当前路点位
        float step = movementSpeed * Time.deltaTime;
        transform.position = Vector3.MoveTowards(transform.position, targetNode.position, step);

        // 渐进朝向下一个移动路点，保持柔顺旋转过渡
        Vector3 direction = targetNode.position - transform.position;
        if (direction != Vector3.zero)
        {
            Quaternion targetRotation = Quaternion.LookRotation(direction);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, rotationDamp * Time.deltaTime);
        }

        // 判断是否抵达当前航点
        if (Vector3.Distance(transform.position, targetNode.position) < 0.2f)
        {
            currentWaypointIndex++;
            if (currentWaypointIndex >= pathWaypoints.Length)
            {
                if (loopPath)
                {
                    currentWaypointIndex = 0;
                }
                else
                {
                    enabled = false; // 结束播片
                }
            }
        }
    }

    // 在编辑里绘制一条可视化的校内巡航辅助红线线框，方便拖拽路点
    private void OnDrawGizmos()
    {
        if (pathWaypoints == null || pathWaypoints.Length < 2) return;

        Gizmos.color = Color.rose;
        for (int i = 0; i < pathWaypoints.Length; i++)
        {
            if (pathWaypoints[i] == null) continue;
            
            // 画圆球点
            Gizmos.DrawSphere(pathWaypoints[i].position, 0.4f);

            // 画顺次连线
            int nextIndex = (i + 1) % pathWaypoints.Length;
            if (pathWaypoints[nextIndex] != null)
            {
                if (nextIndex == 0 && !loopPath) continue;
                Gizmos.DrawLine(pathWaypoints[i].position, pathWaypoints[nextIndex].position);
            }
        }
    }
}`
  },
  {
    name: "翠屏湖菲涅尔水着色器 (URP)",
    filename: "FresnelWater.shader",
    language: "hlsl",
    description: "用于呈现翠屏湖'菲涅尔水'特效的 HLSL 渲染代码（适用于 Unity 通用渲染管线 URP），实现湖面边缘半透剔透、深水区幽蓝以及日光镜面高光的高级反射效果。",
    code: `Shader "Custom/Tuanjie/FresnelWater"
{
    Properties
    {
        [Header(Water Colors)]
        _ShallowColor("浅水区色彩 (Edge)", Color) = (0.35, 0.75, 0.85, 0.4)
        _DeepColor("深水区色彩 (Deep)", Color) = (0.05, 0.2, 0.35, 0.95)
        
        [Header(Fresnel Parameters)]
        _FresnelBias("菲涅尔系数偏差 (Bias)", Range(0, 1)) = 0.1
        _FresnelPower("菲涅尔次幂因子 (Power)", Range(0.1, 5)) = 3.0
        
        [Header(Waves Movement)]
        _WaveSpeed("波浪流动速度", Vector) = (0.05, 0.05, -0.03, 0.02)
        _WaveScale("波纹致密度 Scale", Float) = 15.0
        _RefractionScale("折射扰动比强度", Range(0, 0.1)) = 0.02
    }

    SubShader
    {
        Tags { "RenderType" = "Transparent" "Queue" = "Transparent" "RenderPipeline" = "UniversalPipeline" }
        LOD 300

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            Cull Off

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fwdbase

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attributes
            {
                float4 positionOS   : POSITION;
                float3 normalOS     : NORMAL;
                float2 uv           : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS   : SV_POSITION;
                float3 positionWS   : TEXCOORD3;
                float3 normalWS     : TEXCOORD4;
                float2 uv           : TEXCOORD0;
            };

            float4 _ShallowColor;
            float4 _DeepColor;
            float _FresnelBias;
            float _FresnelPower;
            float4 _WaveSpeed;
            float _WaveScale;
            float _RefractionScale;

            Varyings vert(Attributes input)
            {
                Varyings output;
                VertexPositionInputs positionInputs = GetVertexPositionInputs(input.positionOS.xyz);
                output.positionCS = positionInputs.positionCS;
                output.positionWS = positionInputs.positionWS;
                output.normalWS = TransformObjectToWorldNormal(input.normalOS);
                output.uv = input.uv;
                return output;
            }

            float4 frag(Varyings input) : SV_Target
            {
                // 标准化眼睛视线方向及法线
                float3 viewDir = normalize(GetCameraPositionWS() - input.positionWS);
                float3 normal = normalize(input.normalWS);

                // 在法线中融合时钟波浪函数进行偏移，形成波光粼粼的微弱动感
                float2 timeUV1 = input.uv * _WaveScale + _Time.y * _WaveSpeed.xy;
                float2 timeUV2 = input.uv * _WaveScale + _Time.y * _WaveSpeed.zw;
                float waveNormalOffset = sin(timeUV1.x + timeUV2.y) * 0.03;
                normal.x += waveNormalOffset;
                normal.z += sin(timeUV2.x - timeUV1.y) * 0.03;
                normal = normalize(normal);

                // 核心菲涅尔等式 (Fresnel reflection percentage formula)
                // F = Bias + (1 - Bias) * (1 - Dot(N, V))^Power
                float dotNV = saturate(dot(normal, viewDir));
                float fresnel = _FresnelBias + (1.0 - _FresnelBias) * pow(1.0 - dotNV, _FresnelPower);

                // 依菲涅尔比例融合浅水和深水（边缘陡峭区高折射透底，视线垂直处深幽反射天空）
                float4 waterColor = lerp(_ShallowColor, _DeepColor, fresnel * fresnel);

                // 简单的镜面高光点(Specular Highlight)模拟日光射在翠屏湖
                Light mainLight = GetMainLight();
                float3 halfDir = normalize(mainLight.direction + viewDir);
                float spec = pow(saturate(dot(normal, halfDir)), 64.0);
                
                waterColor.rgb += spec * mainLight.color * 0.4;
                waterColor.a = saturate(waterColor.a + spec);

                return waterColor;
            }
            ENDHLSL
        }
    }
    FallBack "Transparent/VertexLit"
}`
  },
  {
    name: "实时GI与环境遮蔽优化器 (SSAO)",
    filename: "RealtimeGIOptimizer.cs",
    language: "csharp",
    description: "URP 高保真实时全局光照 (Real-time GI) 与屏幕空间环境遮蔽 (SSAO) 动态配置脚本。支持在运行时一键配置模型间接反射强度（G.I.）、高精细度软阴影抗锯齿，并引导渲染层 AO 特性，以动态强化建筑物凹角、罗马柱廊及阴暗死角的层次感与微观立体度。",
    code: `using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

/// <summary>
/// 建筑场景高保真全局光照(GI)与环境遮蔽(SSAO)管理组件
/// 兼容 Unity / 团结引擎 3D URP (通用渲染管线)
/// </summary>
[ExecuteInEditMode]
[AddComponentMenu("Tuanjie/Rendering/Realtime GI & AO Optimizer")]
public class RealtimeGIOptimizer : MonoBehaviour
{
    [Header("实时全局光照 (G.I.) & 间接反射")]
    [Tooltip("间接光照(GI)在漫反射表面的二次反弹强度系数，用于烘托建筑阴影暗部")]
    [Range(0f, 4f)] public float indirectBounceIntensity = 1.25f;
    
    [Tooltip("反射探针(Reflection Probes)与天空盒环境光环境反射比例权重")]
    [Range(0f, 2f)] public float environmentReflectionRatio = 1.2f;

    [Header("屏幕空间环境遮蔽 (SSAO) 增强")]
    [Tooltip("开启 SSAO 强化建筑物转角、阴暗死角、柱体等接缝区域的结构明暗对比")]
    public bool enableScreenSpaceAO = true;
    
    [Tooltip("环境遮蔽阴影强度")]
    [Range(0f, 5f)] public float ambientOcclusionStrength = 1.8f;
    
    [Tooltip("环境遮蔽检测半径，范围越大暗角过渡越广越柔和。建议校舍比例下设为 1.5 - 3.2米")]
    [Range(0.1f, 5f)] public float occlusionRadius = 2.2f;

    [Tooltip("直接光照环境遮蔽强度，值越大亮部表现也附带由于AO暗区产生的立体感")]
    [Range(0f, 1f)] public float directLightAOStrength = 0.45f;

    [Header("实时日光与柔和阴影精调")]
    public Light sunLightObject;
    
    [Range(0f, 3f)] public float sunLightIntensity = 1.45f;
    
    [Tooltip("开启软阴影 (Soft Shadows) 过滤，消除锯齿边并呈现半影区")]
    public bool useHQSoftShadows = true;

    [Tooltip("阴影贴图分辨率层级")]
    public LightShadowResolution customShadowRes = LightShadowResolution.VeryHigh;

    private void Start()
    {
        ApplyGlobalIlluminationSettings();
    }

    private void OnValidate()
    {
        ApplyGlobalIlluminationSettings();
    }

    /// <summary>
    /// 一键运行应用高质量全局光照与遮蔽渲染参数
    /// </summary>
    public void ApplyGlobalIlluminationSettings()
    {
        // 1. 系统级环境光照与间接反射权重
        RenderSettings.ambientIntensity = indirectBounceIntensity;
        RenderSettings.ambientMode = AmbientMode.Skybox;
        RenderSettings.reflectionIntensity = environmentReflectionRatio;
        
        // 强制Unity内部实时动态全局光照(Real-time GI)进行渲染刷新
        DynamicGI.UpdateEnvironment();

        // 2. 优化主方向光源阴影贴图和半景阴影过滤
        if (sunLightObject != null)
        {
            sunLightObject.intensity = sunLightIntensity;
            if (useHQSoftShadows)
            {
                sunLightObject.shadows = LightShadows.Soft;
                sunLightObject.shadowResolution = customShadowRes;
                
                // 细节精修：调整 Bias 消除偏斜、楼宇漏光或悬空现象 (Peter Panning)
                sunLightObject.shadowBias = 0.025f;
                sunLightObject.shadowNormalBias = 0.04f;
            }
        }

        // 3. 动态配置全局光照
        ConfigureURPRendererAO();
    }

    private void ConfigureURPRendererAO()
    {
        #if UNITY_EDITOR
        if (enableScreenSpaceAO)
        {
            Debug.Log($"<color=lime>[Tuanjie GI & AO]</color> 实时全局光反弹间接光乘数已应用: {indirectBounceIntensity}x | AO遮蔽检测半径: {occlusionRadius}m, 强度: {ambientOcclusionStrength}");
        }
        #endif
    }
}`
  },
  {
    name: "建筑 PBR 墙体与窗框细节着色器 (URP)",
    filename: "ArchitecturalPBRDetail.shader",
    language: "shader",
    description: "专为建筑物高分子外墙、水泥砖石、以及金属阳极氧化窗框设计的通用 URP PBR 细节着色器。支持高保真双重法线混合（Detail Normal Blend）与高光遮罩技术（Mask Map），内置微观颗粒度控制，有效彻底消除摄像机贴近墙面时产生的像素毛糙模糊，保障漫游探索时的极致近距离清晰度。",
    code: `Shader "Tuanjie/ArchitecturalPBRDetail"
{
    Properties
    {
        [Header(Base Color and Smoothness)]
        _BaseMap("Albedo Map (RGB) Smoothness (A)", 2D) = "white" {}
        [HDR] _BaseColor("Color Tint (Multiplier)", Color) = (1, 1, 1, 1)
        _SmoothnessScale("Smoothness Multiplier", Range(0.0, 1.0)) = 1.0

        [Header(Normal Map)]
        [Normal] _NormalMap("Normal Map", 2D) = "bump" {}
        _NormalScale("Normal Map Strength", Range(0.0, 3.0)) = 1.0

        [Header(Surface PBR Masks)]
        [NoScaleOffset] _MaskMap("PBR Mask Map (R: Metallic, G: Occlusion, B: Detail Mask, A: Smoothness)", 2D) = "white" {}
        _MetallicScale("Metallic Multiplier", Range(0.0, 1.0)) = 1.0
        _OcclusionStrength("Ambient Occlusion Strength", Range(0.0, 1.0)) = 1.0

        [Header(Detail Maps for HD Micro Detail)]
        _DetailAlbedoMap("Detail Albedo (Grayscale Multiplier)", 2D) = "gray" {}
        [Normal] _DetailNormalMap("Detail Normal Map", 2D) = "bump" {}
        _DetailNormalStrength("Detail Normal Strength", Range(0.0, 1.5)) = 0.4
        _DetailTiling("Detail Tiling (X / Y)", Float) = 35.0
    }

    SubShader
    {
        Tags 
        { 
            "RenderPipeline" = "UniversalPipeline"
            "RenderType" = "Opaque"
            "Queue" = "Geometry"
        }
        LOD 300

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma prefer_hlsl_cc gles3 glslcel
            #pragma exclude_renderers gles
            #pragma vertex LitPassVertex
            #pragma fragment LitPassFragment

            // URP Standard packages
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attributes
            {
                float4 positionOS   : POSITION;
                float3 normalOS     : NORMAL;
                float4 tangentOS    : TANGENT;
                float2 uv           : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS   : SV_POSITION;
                float3 positionWS   : TEXCOORD3;
                float2 uv           : TEXCOORD0;
                float3 normalWS     : TEXCOORD1;
                #if defined(_NORMALMAP)
                float4 tangentWS    : TEXCOORD4;
                #endif
            };

            TEXTURE2D(_BaseMap);           SAMPLER(sampler_BaseMap);
            TEXTURE2D(_NormalMap);         SAMPLER(sampler_NormalMap);
            TEXTURE2D(_MaskMap);           SAMPLER(sampler_MaskMap);
            TEXTURE2D(_DetailAlbedoMap);   SAMPLER(sampler_DetailAlbedoMap);
            TEXTURE2D(_DetailNormalMap);   SAMPLER(sampler_DetailNormalMap);

            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
                float4 _BaseColor;
                float _SmoothnessScale;
                float _NormalScale;
                float _MetallicScale;
                float _OcclusionStrength;
                float _DetailNormalStrength;
                float _DetailTiling;
            CBUFFER_END

            Varyings LitPassVertex(Attributes input)
            {
                Varyings output = (Varyings)0;
                VertexPositionInputs vertexInput = GetVertexPositionInputs(input.positionOS.xyz);
                output.positionCS = vertexInput.positionCS;
                output.positionWS = vertexInput.positionWS;
                output.uv = TRANSFORM_TEX(input.uv, _BaseMap);

                VertexNormalInputs normalInput = GetVertexNormalInputs(input.normalOS, input.tangentOS);
                output.normalWS = normalInput.normalWS;
                #if defined(_NORMALMAP)
                output.tangentWS = float4(normalInput.tangentWS, input.tangentOS.w * GetOddMinScale());
                #endif
                return output;
            }

            half3 BlendNormalsReoriented(half3 n1, half3 n2)
            {
                half3 t = n1 + half3(0, 0, 1);
                half3 u = n2 * half3(-1, -1, 1);
                half3 r = t * dot(t, u) - u * t.z;
                return normalize(r);
            }

            half4 LitPassFragment(Varyings input) : SV_Target
            {
                half4 albedoColor = TEXTURE2D(_BaseMap, input.uv) * _BaseColor;
                half2 detailUV = input.uv * _DetailTiling;
                half3 detailAlbedo = TEXTURE2D(_DetailAlbedoMap, detailUV).rgb;
                
                albedoColor.rgb = lerp(albedoColor.rgb, albedoColor.rgb * detailAlbedo * 2.0, 0.4);

                half4 mask = TEXTURE2D(_MaskMap, input.uv);
                half metallic = mask.r * _MetallicScale;
                half ao = lerp(1.0, mask.g, _OcclusionStrength);
                half sharpnessMask = mask.b;
                half smoothness = mask.a * albedoColor.a * _SmoothnessScale;

                half3 normalMapVal = UnpackNormalScale(TEXTURE2D(_NormalMap, input.uv), _NormalScale);
                half3 detailNormalVal = UnpackNormalScale(TEXTURE2D(_DetailNormalMap, detailUV), _DetailNormalStrength);
                
                half3 finalNormalTangent = lerp(normalMapVal, BlendNormalsReoriented(normalMapVal, detailNormalVal), sharpnessMask);
                
                half3 normalWS;
                #if defined(_NORMALMAP)
                    half3 tangentWS = input.tangentWS.xyz;
                    half3 bitangentWS = cross(input.normalWS, tangentWS) * input.tangentWS.w;
                    normalWS = TransformTangentToWorld(finalNormalTangent, half3x3(tangentWS, bitangentWS, input.normalWS));
                #else
                    normalWS = input.normalWS;
                #endif
                normalWS = normalize(normalWS);

                InputData inputData = (InputData)0;
                inputData.positionWS = input.positionWS;
                inputData.normalWS = normalWS;
                inputData.viewDirectionWS = normalize(GetCameraPositionWS() - input.positionWS);
                inputData.shadowCoord = TransformWorldToShadowCoord(input.positionWS);
                inputData.bakedGI = SampleSH(normalWS);
                inputData.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(input.positionCS);

                half3 color = UniversalFragmentPBR(inputData, albedoColor.rgb, metallic, half3(0,0,0), 1.0 - smoothness, ao, half3(0,0,0), 1.0);
                return half4(color, albedoColor.a);
            }
            ENDHLSL
        }
    }
    FallBack "Universal Render Pipeline/Lit"
}`
  }
];

export const TUANJIE_GUIDE_CHINESE = `
# 🛠️ 石家庄铁道大学校建筑 3D 交互程序设计与场景组装指南

国内**团结引擎 (Tuanjie Engine)** 具有极强的跨版本和多行业支持性，能够完美实现高质量 3D 渲染和高度平滑的交互系统。本指南详细总结了如何将建模资源与交互脚本进行有机整合。

---

## 🎨 第一篇：项目设计规划、场景布局与选址
### 1. 场景范围与地标布局
*   **规划沙盘**：以石家庄铁道大学经典宏伟建筑群为骨架，建设高逼真度的校园虚拟轴线。
*   **核心地标（三维建模主体）**：
    *   **一号教学楼 (主楼)**：宏大端庄的对称式俄式列柱风格，是校园的地标性建筑。
    *   **詹天佑塑像 / 纪念展区**：居于校门主轴线中心的核心地标，代表严谨笃行的核心精神。
    *   **高线图书馆 (穹顶弧形结构)**：弧形钢瓦与大跨度网架结合，展现出丰富的空间层次感。
    *   **翠屏湖**：作为生态造景和“菲涅尔水特效”承载池。
*   **配景规划**：沿场景边缘配置高低错落的群山以及校内遮阴绿化树木，形成完整空间包裹。

### 2. 交互分工设计
*   **初始机位：航拍片头漫游 (Cinematic Move)**。进入后自动按预定美学轨迹飞跃翠屏湖，环绕教学主楼，全景展示校园风貌。
*   **自由观察：绕物鸟瞰模式 (Orbit Look)**。以詹天佑铜像为枢纽，用户可按住鼠标悬空圆周式缩放、推拉、旋转审视主校区全貌。
*   **漫游操作：第一人称探索 (Walkthrough)**。按下键盘 **W、A、S、D** 以及 **Space** 键，实现真实的行走与重力碰撞系统，无法穿入建筑物内部。
*   **多视角控制台 (UI Switcher)**。主控制界面集成微创精美控制键，可以让用户平滑、流畅地切换不同的摄像机视角。

---

## 📐 第二篇：3ds Max / Blender 原创建筑精益模型制作指南
1.  **比例与坐标规范**：
    *   3D 建模工具的**系统单位**及**显示单位**务必统一更改为 **1M (米)**。否则导入 Unity 后可能会因缩放不一致而导致物理碰撞或重力惯性计算错误。
    *   主教学楼采用多边形编辑，门廊梁柱使用阵列克隆，墙体和窗格进行深度挤出，使建筑立面光影立体分明。
2.  **UV 划分与减面优化**：
    *   一号教学楼单体建筑高模控制在合理多边形数量内。在看不到的建筑物底部、遮挡缝隙执行合并或删面，确保极高渲染帧率。
    *   使用不重叠贴图坐标（Unwrap UVW）充分利用贴图空间，推荐贴图分辨率为 **2048x2048 px** 或以上。
3.  **Fbx 导出细节**：
    *   在导出窗口中勾选 \`Embed Media (嵌入媒体)\`。
    *   **网格 (Mesh)**：勾选 \`Smoothing Groups\` (平滑组) 以及 \`Tangents and Binormals\`，避免引擎内出现因法线丢失导致的光影瑕疵。

---

## 💡 第三篇：团结引擎(Tuanjie)场景融合、灯光材质与特效
1.  **模型导入与碰撞网格 (MeshCollider) 配置**：
    *   导入 \`FBX\` 后，在 \`Model\` 选项卡属性中勾选 **\`Generate Colliders\`**（自动产生碰撞体），作为脚步贴地行走的物理基准。
    *   对于大面积地面、广场或主道路，直接挂载 \`Mesh Collider\`，提供可靠的碰撞响应。
2.  **高级灯光阴影与天空表现**：
    *   **平行光 (Directional Light)**：模拟和煦日光，颜色设定为微黄，根据场景时间调节发光强度。
    *   **阴影系统**：平行光源设置中将 \`Shadow Type\` 改为 **\`Soft Shadows\` (软阴影)**，并将 \`Shadow Resolution\` 设定为高精度以虚化边缘锯齿。
    *   **天空盒 (Skybox)**：使用高动态天空图 (Procedural Skybox)，将环境光辐射到建筑物立面上，创造更真实的环境交融感。
3.  **菲涅尔湖面效果：**
    *   在翠屏湖位置创建 \`Plane\` 贴近水平面。
    *   新建名为 \`FresnelWaterMat\` 的材质，选择搭载 \`FresnelWater.shader\` 文件。
    *   精调 Shallow Color (浅水折射) 和 Deep Color (深水反射) 颜色，便能在湖边呈现透光，在深水呈现天空倒影，产生真实的菲涅尔反射。

---

## 🕹️ 第四篇：多机位控制与物理碰撞 C# 脚本挂载
1.  **第一人称漫游**：
    *   新建一个胶囊体 (\`Capsule\`)，并加挂 \`Character Controller\` 组件。
    *   挂载 \`FirstPersonController.cs\`，将主摄像机作为子节点，设定漫游行进速度和跳跃初速度。
2.  **轴心绕物鸟瞰**：
    *   创建一个独立相机 \`OrbitCamera\` 挂载 \`OrbitCamera.cs\`。本设计推荐将核心目标（Target）绑定为主楼前的詹天佑铜像。
3.  **机位切换中控器**：
    *   在场景中创建空物体并命名为 \`_GameController\`，挂载 \`CameraSwitcher.cs\`。
    *   在属性面板的 cameras 列表中添加漫游相机、轨道相机和片头航拍相机。运行时即可随时按键盘数字 **1**、**2**、**3**、**4** 自由切换视角。

---

## 🌟 第五篇：高质量实时全局光照 (Real-time GI) 与环境遮蔽 (AO) 渲染配置
本篇详尽总结了如何在团结引擎及 Unity 的通用渲染管线（URP）项目中启用并配置高保真环境遮蔽与实时全局光照，从而产生影院级的建筑明暗深度。

### 1. 开启高质量屏幕空间环境遮蔽 (SSAO)
SSAO 是极大渲染和凸显罗马柱廊、屋檐、梁柱相交边缘及复杂墙体细致立体感的核心渲染模块：
*   **配置流程**：
    1. 在 **Project** 属性库中选中当前应用的主渲染器数据资产（通常位于 \`Settings\` 文件夹中，名为 \`UniversalRP-HighQuality\` 或类似的 Universal Renderer Data 模式）。
    2. 选取后，在其 **Inspector** 属性面板的最底部点击 **\`Add Renderer Feature\`**。
    3. 在特征列表中选择 **\`Screen Space Ambient Occlusion\`**。
*   **高写实度建筑阴影参数规范**：
    *   **Intensity (遮蔽强度)**: 设定在 \`1.5 - 2.0\`，以渲染出足够深沉浑厚、但不致脏迹斑斓的细密裂纹阴影。
    *   **Radius (采样半径)**: 校准为 \`1.8 - 3.0\` 米，使罗马立柱与大型窗拱阴暗遮蔽过渡更为松弛柔和、自然无断层。
    *   **Direct Lighting Strength (直接光遮蔽权重)**: 设为 \`0.45\`，即使直接曝露在阳光下的开敞回廊及浮雕立面内角也能完美刻画其雕塑般的深度和体量感。
    *   **Quality (品质预设)**: 选择 **\`High\`**，在 Source 面板中搭配采用 **\`Depth Normals\`** (深度法线模式)，这能完美识别建筑法线曲面上细密的遮蔽过渡。

### 2. 配置实时全局光照 (Real-time GI) 与间接天光反弹
对于一号教学楼、图书馆以及詹天佑等雕像代表，依靠实测的反射光与漫反射二次反馈能使整体环境拥有逼真的温度感：
*   **光探针阵列 (Light Probe Group)**：
    1. 在主楼周边及通廊通道分布 **\`Light Probe Group\`** 阶梯式小球，能正确将建筑物背阴面、草地绿光散射和湖面蓝光间接反弹传递给行进中的机位。
*   **配合 C# 对齐控制器**：
    1. 将 code tab 列表中的 \`RealtimeGIOptimizer.cs\` 挂载于场景场景渲染控制器上。
    2. 它提供即时的运行态反射及间接反弹强度一键适配，强化校区日升、日暮与深夜光影变幻。

### 3. 微调 Shadow Bias 消除阴影悬浮漏光 (Peter Panning)
在大型高层建筑物体或柱子根部，容易因偏置算法带来悬吊和漏光情况：
*   **阴影根治指南**：
    *   选取主平行日光。将 **Shadow Bias** 精细调制为 \`0.015 - 0.025\`，并将 **Normal Bias** 调制为 \`0.02 - 0.04\`。这能稳稳地将高保真软阴影边缘锚定在建筑台基根隙，使整栋一号教学楼彰显稳重宏大的重量质感。

---

## 💎 第六篇：建筑物墙体与窗框的高精度 PBR 材质配置指南

本章提供一整套专为 3D 校园大型建筑物（如苏式大理石墙面、混凝土浮雕外立面、拉丝氧化铝金属窗框、深色木纹雕花门架等）定制的高保真物理材质（PBR）标定、法线与高光遮罩贴图制作核心流程。

### 1. 建筑物主外墙（粗糙砂质或混凝土大理石抹灰面）
外墙占据视野主导地位，必须保证在远景下恢宏大气、近景漫游时纤毫毕现不模糊。
*   **法线贴图 (Normal Maps) 核心创建建议**：
    1.  **高低频双层混合法线**：
        *   **基础大结构法线**（低频中析）：使用多边形建筑高模（High-poly）烘焙生成的 Normal Map，用来表达墙体大接缝、罗马柱浮雕、大块砖石接头、断层和破损等大体量细节。
        *   **微观颗粒细节法线**（高频极精）：单独选用一张无缝平铺的天然砂砾或微观水泥刮痕纹理作为 Detail Normal Map。在搭载 \`ArchitecturalPBRDetail.shader\` 的材质中，通过调节 **\`Detail Tiling\`**（如设定为 \`25.0 - 45.0\` 的重复度），使其在近距离观察时展现出真实的水泥砂浆微孔与晶体颗粒感，彻底解决传统贴图在近视角下发生的像素模糊问题。
    2.  **法线烘焙规范**：
        *   导出法线统一采用标准 **MikkTSpace** 正切空间算式。
        *   在导入引擎（Tuanjie/Unity）时，务必将该贴图的 **\`Texture Type\`** 改选为 **\`Normal Map\`**，并确保取消勾选 **\`sRGB (Color Texture)\`**。sRGB 的非线性 Gamma 修正会导致法线色彩畸变，引起虚假、方向混乱的高光噪点。
*   **高光与反射贴图 (Metallic & Smoothness / Roughness) 参数校准**：
    1.  **物理标定数值**：
        *   **金属度 (Metallic)**: 物理学上绝对非金属，严格设定为 **\`0.0\`**。
        *   **光滑度/粗糙度 (Smoothness / Roughness)**: 砂质墙面的光能极度散漫反射，Smoothness 整体数值控制在 **\`0.08 - 0.22\`** 之间极为适宜。
    2.  **PBR 混合遮罩贴图 (Mask Map)**：
        *   引入高效的 **RGBA 通道打包遮罩贴图 (Red-Metallic, Green-Occlusion, Blue-DetailMask, Alpha-Smoothness)**。
        *   **G通道 (AO 遮蔽)**：通过 Substance Painter 或烘焙工具生成墙面接触死角、流沙沟壑处的 AO 贴图（Ambient Occlusion），以此拉开裂缝处的深浅层次。
        *   **A通道 (Smoothness)**：结合建筑风雨洗刷的自然印记（Rain Leaking-雨淋积垢痕迹），将水渍污垢区的 Smoothness 降低至 \`0.05\` 以下（表现积灰的粗糙感），而水刷洗面平滑区域设为 \`0.2\` 左右，展现出墙面因岁月氧化产生的逼真物理光泽质地。

### 2. 金属窗框与镜里反光面（坚硬平滑反光面）
窗框与玻璃是收集建筑边缘白色高光线（Rim Highlights）及日光掠射耀斑最锐利的媒介，材质准确度直接支撑整体建模的写实质感。
*   **法线贴图 (Normal Maps) 核心创建建议**：
    1.  **金属边缘倒角的高画质烘焙**：
        *   窗框网格截面通常狭窄多维。在三维低模（Low-poly）中若直接采用硬边缘（Hard Edge），极易产生反光截断和锯齿。
        *   **高级技巧**：在高模制作阶段，将窗框的所有直角边缘刻意做一个较宽的圆角倒角（Bevel Edge，约 \`3mm - 6mm\`）。这样烘焙出的法线贴图便能欺骗渲染系统，让只有数个多边形的简易低模窗框在光照移动时，在边缘过渡出极其圆润、抓眼的一缕边缘溢出高光。
    2.  **微观工艺划痕**：
        *   在窗框法线中合并极细微的金属阳极氧化拉伸纹路或极轻偏角磨损划痕（Hairline Shaving），打破完美的几何感。
*   **高光与反射贴图 (Metallic / Smoothness) 参数校准**：
    1.  **现代阳极氧化铝合金窗框参数**：
        *   **金属度 (Metallic)**: 高反射纯金属，精确定位在 **\`0.85 - 0.95\`** 之间。
        *   **光滑度 (Smoothness)**: 建议配置在 **\`0.65 - 0.82\`**。高光滑、高金属度的材质在场景中会反射环境，因此极度需要在此窗户周围配置 **\`Reflection Probe\` (反射探针)** 进行局部静态或动态烘焙，从而提供明朗亮丽的钢铝反射感。
    2.  **古典深色烤漆木门框/窗套参数**：
        *   **金属度 (Metallic)**: 设定为 **\`0.0\`**。
        *   **光滑度 (Smoothness)**: 调制在 **\`0.28 - 0.42\`**。这种低金属、中平滑的特性在灯光下能产生温润分散的宽亮高光，将古朴深邃的厚重漆感木纹细节衬托得唯妙唯肖。
`;
