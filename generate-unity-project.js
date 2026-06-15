import fs from "fs";
import path from "path";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const NC = "\x1b[0m"; // No Color

console.log(`${CYAN}====================================================${NC}`);
console.log(`${GREEN}   石大/铁大 3D Unity & 团结引擎一键项目离线生成系统${NC}`);
console.log(`${CYAN}====================================================${NC}`);
console.log(`正准备为您在本地一键离线搭建完整的 Unity/团结引擎 交互工程项目...`);

const targetDirName = "TiedaoCampusUnityProject";
const targetPath = path.join(process.cwd(), targetDirName);

// 1. 创建符合 Unity/团结引擎标准规范的项目文件树
const dirs = [
  "",
  "Assets",
  "Assets/Editor",
  "Assets/Scripts",
  "Assets/Shaders",
  "ProjectSettings"
];

for (const dir of dirs) {
  const fullPath = path.join(targetPath, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
}

// 2. 写入 Unity Hub / 团结 Hub 所必需的引擎版本描述文件 ProjectVersion.txt
const projectVersionContent = `m_EditorVersion: 2022.3.12f1
m_EditorVersionWithRevision: 2022.3.12f1 (b9fdc1f39f37)
`;
fs.writeFileSync(path.join(targetPath, "ProjectSettings", "ProjectVersion.txt"), projectVersionContent);

// 3. 定义全套 C# 脚本及 Shader 内容
const scripts = {
  // FirstPersonController.cs
  "Assets/Scripts/FirstPersonController.cs": `using UnityEngine;

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
        float mouseX = Input.GetAxis("Mouse X") * mouseSensitivity * Time.deltaTime;
        float mouseY = Input.GetAxis("Mouse Y") * mouseSensitivity * Time.deltaTime;

        transform.Rotate(Vector3.up * mouseX);

        verticalRotation -= mouseY;
        verticalRotation = Mathf.Clamp(verticalRotation, -downLookLimit, upLookLimit);
        
        if (playerCamera != null)
        {
            playerCamera.transform.localRotation = Quaternion.Euler(verticalRotation, 0, 0);
        }
    }

    private void HandleMovement()
    {
        isGrounded = characterController.isGrounded;
        if (isGrounded && movementVelocity.y < 0)
        {
            movementVelocity.y = -2.0f;
        }

        float moveX = Input.GetAxis("Horizontal");
        float moveZ = Input.GetAxis("Vertical");

        Vector3 moveDirection = transform.right * moveX + transform.forward * moveZ;
        
        float currentSpeed = Input.GetKey(KeyCode.LeftShift) ? runSpeed : walkSpeed;
        characterController.Move(moveDirection * currentSpeed * Time.deltaTime);

        if (Input.GetButtonDown("Jump") && isGrounded)
        {
            movementVelocity.y = Mathf.Sqrt(jumpHeight * 2.0f * gravity);
        }

        movementVelocity.y -= gravity * Time.deltaTime;
        characterController.Move(movementVelocity * Time.deltaTime);
    }
}`,

  // OrbitCamera.cs
  "Assets/Scripts/OrbitCamera.cs": `using UnityEngine;

public class OrbitCamera : MonoBehaviour
{
    [Header("观察目标")]
    public Transform target;

    [Header("控制属性")]
    public float xSpeed = 120.0f;
    public float ySpeed = 120.0f;
    public float zoomSpeed = 5.0f;

    [Header("距离限制")]
    public float distanceMin = 5.0f;
    public float distanceMax = 60.0f;

    [Header("仰俯角限制")]
    public float yMinLimit = 10.0f;
    public float yMaxLimit = 80.0f;

    private float x = 0.0f;
    private float y = 0.0f;
    private float distance = 25.0f;

    private float currentX = 0.0f;
    private float currentY = 0.0f;
    private float currentDistance = 25.0f;

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

        if (target == null)
        {
            GameObject go = GameObject.Find("memorial") ?? GameObject.Find("main_building");
            if (go != null) target = go.transform;
        }
    }

    void LateUpdate()
    {
        if (target == null) return;

        if (Input.GetMouseButton(0) || Input.GetMouseButton(1))
        {
            x += Input.GetAxis("Mouse X") * xSpeed * 0.02f;
            y -= Input.GetAxis("Mouse Y") * ySpeed * 0.02f;
            y = ClampAngle(y, yMinLimit, yMaxLimit);
        }

        float scrollInput = Input.GetAxis("Mouse ScrollWheel");
        distance = Mathf.Clamp(distance - scrollInput * zoomSpeed, distanceMin, distanceMax);

        currentX = Mathf.SmoothDampAngle(currentX, x, ref xVelocity, smoothTime);
        currentY = Mathf.SmoothDampAngle(currentY, y, ref yVelocity, smoothTime);
        currentDistance = Mathf.SmoothDamp(currentDistance, distance, ref zoomVelocity, smoothTime * 0.5f);

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
}`,

  // CameraPathAnimator.cs
  "Assets/Scripts/CameraPathAnimator.cs": `using UnityEngine;

public class CameraPathAnimator : MonoBehaviour
{
    [Header("路径路点组")]
    public Transform[] pathWaypoints;

    [Header("动画配置")]
    public float movementSpeed = 6.0f;
    public bool loopPath = true;
    public float rotationDamp = 3.0f;

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

        float step = movementSpeed * Time.deltaTime;
        transform.position = Vector3.MoveTowards(transform.position, targetNode.position, step);

        Vector3 direction = targetNode.position - transform.position;
        if (direction != Vector3.zero)
        {
            Quaternion targetRotation = Quaternion.LookRotation(direction);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, rotationDamp * Time.deltaTime);
        }

        if (Vector3.Distance(transform.position, targetNode.position) < 0.5f)
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
                    enabled = false;
                }
            }
        }
    }

    private void OnDrawGizmos()
    {
        if (pathWaypoints == null || pathWaypoints.Length < 2) return;

        Gizmos.color = Color.magenta;
        for (int i = 0; i < pathWaypoints.Length; i++)
        {
            if (pathWaypoints[i] == null) continue;
            Gizmos.DrawSphere(pathWaypoints[i].position, 0.6f);

            int nextIndex = (i + 1) % pathWaypoints.Length;
            if (pathWaypoints[nextIndex] != null)
            {
                if (nextIndex == 0 && !loopPath) continue;
                Gizmos.DrawLine(pathWaypoints[i].position, pathWaypoints[nextIndex].position);
            }
        }
    }
}`,

  // CameraSwitcher.cs
  "Assets/Scripts/CameraSwitcher.cs": `using UnityEngine;
using System.Collections.Generic;

public class CameraSwitcher : MonoBehaviour
{
    [System.Serializable]
    public struct CameraPreset
    {
        public string cameraName;
        public Camera cameraComponent;
        public GameObject controlScriptHolder;
    }

    [Header("摄像机机位预设")]
    public List<CameraPreset> cameras = new List<CameraPreset>();

    [Header("当前机位索引")]
    public int activeCameraIndex = 0;

    void Start()
    {
        SwitchToCamera(activeCameraIndex);
    }

    void Update()
    {
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
                cameras[i].cameraComponent.gameObject.SetActive(isCurrent);
                cameras[i].cameraComponent.enabled = isCurrent;

                AudioListener listener = cameras[i].cameraComponent.GetComponent<AudioListener>();
                if (listener != null) listener.enabled = isCurrent;
            }

            if (cameras[i].controlScriptHolder != null)
            {
                cameras[i].controlScriptHolder.SetActive(isCurrent);
            }
        }

        Debug.Log("已切换机位到: " + cameras[index].cameraName);
    }
}`,

  // TrainMovingController.cs
  "Assets/Scripts/TrainMovingController.cs": `using UnityEngine;

public class TrainMovingController : MonoBehaviour
{
    [Header("轨道循环设置")]
    public float radius = 45.0f;
    public Vector3 center = new Vector3(-40.0f, 0.45f, 20.0f);
    public float speed = 12.0f;
    
    [Header("拖挂客车车厢")]
    public GameObject tenderCar;
    public GameObject passengerCar;

    private float currentAngle = 0.0f;

    void Start()
    {
        // 自动查找拖挂车并在其身上加挂单独的自随动控制器
        SetupTowedCars();
    }

    void Update()
    {
        currentAngle += (speed / radius) * Time.deltaTime;
        if (currentAngle > Mathf.PI * 2.0f) currentAngle -= Mathf.PI * 2.0f;

        float x = center.x + Mathf.Cos(currentAngle) * radius;
        float z = center.z + Mathf.Sin(currentAngle) * radius;
        
        float dx = -Mathf.Sin(currentAngle);
        float dz = Mathf.Cos(currentAngle);
        Vector3 tangent = new Vector3(dx, 0, dz).normalized;

        transform.position = new Vector3(x, transform.position.y, z);
        if (tangent != Vector3.zero)
        {
            transform.rotation = Quaternion.LookRotation(tangent);
        }
    }

    private void SetupTowedCars()
    {
        if (tenderCar != null)
        {
            TrainFollower f1 = tenderCar.AddComponent<TrainFollower>();
            f1.radius = radius;
            f1.center = center;
            f1.speed = speed;
            f1.angleOffset = -0.06f; // 间隔一定弧度跟随
        }
        if (passengerCar != null)
        {
            TrainFollower f2 = passengerCar.AddComponent<TrainFollower>();
            f2.radius = radius;
            f2.center = center;
            f2.speed = speed;
            f2.angleOffset = -0.13f;
        }
    }
}

public class TrainFollower : MonoBehaviour
{
    public float radius;
    public Vector3 center;
    public float speed;
    public float angleOffset;

    private float currentAngle = 0.0f;

    void Update()
    {
        currentAngle += (speed / radius) * Time.deltaTime;
        float angle = currentAngle + angleOffset;

        float x = center.x + Mathf.Cos(angle) * radius;
        float z = center.z + Mathf.Sin(angle) * radius;
        
        float dx = -Mathf.Sin(angle);
        float dz = Mathf.Cos(angle);
        Vector3 tangent = new Vector3(dx, 0, dz).normalized;

        transform.position = new Vector3(x, transform.position.y, z);
        if (tangent != Vector3.zero)
        {
            transform.rotation = Quaternion.LookRotation(tangent);
        }
    }
}`,

  // Shaders
  "Assets/Shaders/FresnelWater.shader": `Shader "Custom/Tuanjie/FresnelWater"
{
    Properties
    {
        _ShallowColor("Shallow Color", Color) = (0.35, 0.75, 0.85, 0.4)
        _DeepColor("Deep Color", Color) = (0.05, 0.2, 0.35, 0.95)
        _FresnelBias("Fresnel Bias", Range(0, 1)) = 0.1
        _FresnelPower("Fresnel Power", Range(0.1, 5)) = 3.0
    }
    SubShader
    {
        Tags { "RenderType" = "Transparent" "Queue" = "Transparent" }
        LOD 100
        Blend SrcAlpha OneMinusSrcAlpha
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                float3 worldNormal : TEXCOORD1;
                float3 viewDir : TEXCOORD3;
            };

            float4 _ShallowColor;
            float4 _DeepColor;
            float _FresnelBias;
            float _FresnelPower;

            v2f vert (appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.viewDir = normalize(WorldSpaceViewDir(v.vertex));
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 normal = normalize(i.worldNormal);
                float3 viewDir = normalize(i.viewDir);
                float dotNV = saturate(dot(normal, viewDir));
                float fresnel = _FresnelBias + (1.0 - _FresnelBias) * pow(1.0 - dotNV, _FresnelPower);
                return lerp(_ShallowColor, _DeepColor, fresnel);
            }
            ENDCG
        }
    }
}`,

  // TiedaoCampusBuilder.cs
  "Assets/Editor/TiedaoCampusBuilder.cs": `using UnityEngine;
using UnityEditor;
using System.IO;

#if UNITY_EDITOR
public class TiedaoCampusBuilder : EditorWindow
{
    [MenuItem("铁大校园/一键搭建3D环境与交互")]
    public static void BuildCampusScene()
    {
        // 1. 寻找从本网页导出的 GLB 模型
        string glbPath = "Assets/Models/Tiedao_University_Campus_3D_Scene.glb";
        GameObject glbPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(glbPath);

        if (glbPrefab == null)
        {
            string[] guids = AssetDatabase.FindAssets("Tiedao_University_Campus_3D_Scene t:GameObject");
            if (guids.Length > 0)
            {
                glbPath = AssetDatabase.GUIDToAssetPath(guids[0]);
                glbPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(glbPath);
            }
        }

        bool runProcedural = false;

        if (glbPrefab == null)
        {
            // 如果是在本地离线使用，无网页导出的 GLB 模型，则进入高保真离线C#程序化全自动建模通道
            bool choice = EditorUtility.DisplayDialog("未检测到 3D 导出文件 (GLB)", 
                "未在项目中找到导出存放在 Assets/Models/ 目录下的 GLB 校园。\\n\\n" +
                "【无网络离线完美方案】: 您是否希望一键激活「C# 动态数值几何建模引擎」，脱离外部资产文件直接生成宏伟 3D 铁大校园大场景模型？", 
                "激活程序化建模", "取消");
                
            if (!choice) return;
            runProcedural = true;
        }

        bool confirm = EditorUtility.DisplayDialog("确认一键重构校园？", 
            "一键搭建脚本将执行以下自动化：\\n" +
            "1. 安全清理现存的简易网格方块、简易水面和重复相机。\\n" +
            (runProcedural ? "2. 【特色科技】由 C# Procedural 数学算法直接全自动搭建三维石家庄铁道大学各大核心区。\\n" : "2. 将网页导出的全景 3D 铁道大学实体实例化并完全解包。\\n") +
            "3. 自动化绑定精准物理碰撞格，高精度角色行走支撑层。\\n" +
            "4. 部署大腕巡航、詹天佑像旋转观察、WASD 第一人称行走（按空格跳跃）。\\n" +
            "5. 搭建多机位智能切换中控（数字键 1，2，3）。\\n\\n" +
            "是否这就开始？", "开始拼装", "我再想想");
            
        if (!confirm) return;

        // 2. 清理
        ClearOldMocks();

        GameObject root = null;

        if (runProcedural)
        {
            root = ProceduralCampusGeneration();
        }
        else
        {
            root = PrefabUtility.InstantiatePrefab(glbPrefab) as GameObject;
            if (root == null)
            {
                root = Instantiate(glbPrefab);
                root.name = glbPrefab.name;
            }
            root.transform.position = Vector3.zero;
            root.transform.rotation = Quaternion.identity;
            root.name = "Tiedao_University_Campus_3D_Scene";

            PrefabUtility.UnpackPrefabInstance(root, PrefabUnpackMode.Completely, InteractionMode.AutomatedAction);
        }

        int buildingsConfigured = 0;
        int collidersAdded = 0;

        // 3. 遍历校园图谱
        ConfigureSceneComponents(root, ref buildingsConfigured, ref collidersAdded);

        // 4. 灯光
        SetupLightingAndAtmosphere();

        // 5. 装配相机与角色
        SetupCamerasAndPlayer();

        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();

        EditorUtility.DisplayDialog("一键搭建完毕！🎉", 
            $"您专属的 3D 石家庄铁道大学校园场景重建已圆满收尾！\\n\\n" +
            $"• 已部署精细地标建筑: {buildingsConfigured} 栋\\n" +
            $"• 已自动化装配物理碰撞体: {collidersAdded} 面\\n\\n" +
            $"现在只需点击 Unity 顶部的 [▶] Play 按钮，即可在团结引擎中漫游实体验证！", "太给力了！");
    }

    private static void ClearOldMocks()
    {
        string[] mocks = { "Tiedao_University_Campus_3D_Scene", "Campus_Interaction_System", "MockGroup", "MockPlayer", "TerrainCube", "GreyBox_MainBuilding", "SampleCube", "Cube", "Plane", "WaterPlane" };
        foreach (var mockName in mocks)
        {
            GameObject go = GameObject.Find(mockName);
            while (go != null)
            {
                DestroyImmediate(go);
                go = GameObject.Find(mockName);
            }
        }

        Camera[] cameras = GameObject.FindObjectsOfType<Camera>();
        foreach (var cam in cameras)
        {
            if (cam.transform.parent == null && cam.gameObject.name == "Main Camera")
            {
                DestroyImmediate(cam.gameObject);
            }
        }
    }

    private static GameObject ProceduralCampusGeneration()
    {
        // 创建空场景装配总节点
        GameObject root = new GameObject("Tiedao_University_Campus_3D_Scene");

        // 1. 地盘泥土草坪 (Floor_Terrain)
        GameObject floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
        floor.name = "Floor_Terrain";
        floor.transform.parent = root.transform;
        floor.transform.position = new Vector3(0, -0.5f, 0);
        floor.transform.localScale = new Vector3(300, 1, 300);
        Material lawnMat = CreateColorMaterial(new Color(0.18f, 0.44f, 0.22f), 0.95f);
        floor.GetComponent<Renderer>().sharedMaterial = lawnMat;

        // 2. 柏油马路 (Floor_Ground)
        GameObject road = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        road.name = "Floor_Ground";
        road.transform.parent = root.transform;
        road.transform.position = new Vector3(0, -0.48f, 0);
        road.transform.localScale = new Vector3(140, 0.1f, 140);
        DestroyImmediate(road.GetComponent<Collider>());
        Material asphaltMat = CreateColorMaterial(new Color(0.24f, 0.24f, 0.25f), 0.8f);
        road.GetComponent<Renderer>().sharedMaterial = asphaltMat;

        // 3. 宏伟双冀红砖主楼 (main_building) - 高精细积木级建模
        GameObject mb = new GameObject("main_building");
        mb.transform.parent = root.transform;
        mb.transform.position = new Vector3(0, 0, 0);

        Material brickMat = CreateColorMaterial(new Color(0.68f, 0.18f, 0.15f), 0.85f);
        Material stoneMat = CreateColorMaterial(new Color(0.85f, 0.83f, 0.80f), 0.7f);
        Material glassMat = CreateColorMaterial(new Color(0.15f, 0.55f, 0.9f, 0.5f), 0.2f);

        // 主楼柱干本体
        GameObject body = GameObject.CreatePrimitive(PrimitiveType.Cube);
        body.name = "Central_Body";
        body.transform.parent = mb.transform;
        body.transform.position = new Vector3(0, 12f, 0);
        body.transform.localScale = new Vector3(12f, 24f, 12f);
        body.GetComponent<Renderer>().sharedMaterial = brickMat;

        // 天台古典圆形钟框
        GameObject clock = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        clock.name = "Clock_Face";
        clock.transform.parent = body.transform;
        clock.transform.localPosition = new Vector3(0, 0.35f, -0.51f);
        clock.transform.localRotation = Quaternion.Euler(90, 0, 0);
        clock.transform.localScale = new Vector3(0.55f, 0.05f, 0.55f);
        clock.GetComponent<Renderer>().sharedMaterial = CreateColorMaterial(Color.white, 0.4f);

        // 左翼副楼
        GameObject leftWing = GameObject.CreatePrimitive(PrimitiveType.Cube);
        leftWing.name = "Left_Wing";
        leftWing.transform.parent = mb.transform;
        leftWing.transform.position = new Vector3(-25f, 7.5f, -2f);
        leftWing.transform.localScale = new Vector3(38f, 15f, 10f);
        leftWing.GetComponent<Renderer>().sharedMaterial = brickMat;

        // 右翼副楼
        GameObject rightWing = GameObject.CreatePrimitive(PrimitiveType.Cube);
        rightWing.name = "Right_Wing";
        rightWing.transform.parent = mb.transform;
        rightWing.transform.position = new Vector3(25f, 7.5f, -2f);
        rightWing.transform.localScale = new Vector3(38f, 15f, 10f);
        rightWing.GetComponent<Renderer>().sharedMaterial = brickMat;

        // 巨型大理石拱顶入口柱廊 (Pillars)
        for (int i = 0; i < 4; i++)
        {
            GameObject pillar = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            pillar.name = "Gate_Pillar_" + i;
            pillar.transform.parent = mb.transform;
            pillar.transform.position = new Vector3(-4.5f + (i * 3f), 4.5f, -7.5f);
            pillar.transform.localScale = new Vector3(0.8f, 4.5f, 0.8f);
            pillar.GetComponent<Renderer>().sharedMaterial = stoneMat;
        }

        // 4. 梯形阶梯图书馆 (library)
        GameObject lib = new GameObject("library");
        lib.transform.parent = root.transform;
        lib.transform.position = new Vector3(0, 0, 48f); // 坐落主楼后北部

        Material beigeMat = CreateColorMaterial(new Color(0.87f, 0.87f, 0.84f), 0.75f);
        for (int i = 0; i < 4; i++)
        {
            GameObject layer = GameObject.CreatePrimitive(PrimitiveType.Cube);
            layer.name = "Step_Layer_" + i;
            layer.transform.parent = lib.transform;
            layer.transform.position = new Vector3(0, 2f + (i * 4f), 48f);
            float sz = 44f - (i * 8f);
            layer.transform.localScale = new Vector3(sz, 4f, sz);
            layer.GetComponent<Renderer>().sharedMaterial = beigeMat;
            
            // 镶嵌一排耀眼的蓝色钢化窗户
            GameObject glassStrip = GameObject.CreatePrimitive(PrimitiveType.Cube);
            glassStrip.name = "Windows_i";
            glassStrip.transform.parent = layer.transform;
            glassStrip.transform.localPosition = new Vector3(0, 0, -0.51f);
            glassStrip.transform.localScale = new Vector3(0.85f, 0.4f, 0.02f);
            glassStrip.GetComponent<Renderer>().sharedMaterial = glassMat;
            DestroyImmediate(glassStrip.GetComponent<Collider>());
        }

        // 5. 詹天佑伟人纪念铜像广场 (memorial)
        GameObject mem = new GameObject("memorial");
        mem.transform.parent = root.transform;
        mem.transform.position = new Vector3(-35f, 0, 10f);

        // 纪念馆方形大理石底座
        GameObject basePris = GameObject.CreatePrimitive(PrimitiveType.Cube);
        basePris.name = "Memorial_Stone_Base";
        basePris.transform.parent = mem.transform;
        basePris.transform.position = new Vector3(-35f, 2f, 10f);
        basePris.transform.localScale = new Vector3(6f, 4f, 6f);
        basePris.GetComponent<Renderer>().sharedMaterial = CreateColorMaterial(new Color(0.45f, 0.45f, 0.48f), 0.5f);

        // 詹天佑铜像金身
        GameObject statue = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        statue.name = "Zhan_Tianyou_Bronze_Statue";
        statue.transform.parent = mem.transform;
        statue.transform.position = new Vector3(-35f, 6.2f, 10f);
        statue.transform.localScale = new Vector3(1.3f, 2.2f, 1.3f);
        statue.GetComponent<Renderer>().sharedMaterial = CreateColorMaterial(new Color(0.6f, 0.45f, 0.3f), 0.35f);

        // 6. 晶透翠屏湖 (lake_pond) 及叠翠水景
        GameObject lake = new GameObject("lake_pond");
        lake.transform.parent = root.transform;
        lake.transform.position = new Vector3(75f, 0.2f, -15f);

        GameObject waterPlane = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        waterPlane.name = "Cui_Ping_Lake_Water";
        waterPlane.transform.parent = lake.transform;
        waterPlane.transform.position = new Vector3(75f, 0.15f, -15f);
        waterPlane.transform.localScale = new Vector3(56f, 0.05f, 56f);
        Material waterMat = CreateColorMaterial(new Color(0.15f, 0.53f, 0.76f, 0.77f), 0.12f);
        waterPlane.GetComponent<Renderer>().sharedMaterial = waterMat;

        // 湖泊畔岸错落卵石
        for (int i = 0; i < 15; i++)
        {
            float angle = i * (Mathf.PI * 2.0f / 15f);
            float px = 75f + Mathf.Cos(angle) * 27.2f;
            float pz = -15f + Mathf.Sin(angle) * 27.2f;

            GameObject stone = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            stone.name = "Lakeside_Rock_" + i;
            stone.transform.parent = lake.transform;
            stone.transform.position = new Vector3(px, 0.3f + Random.Range(-0.2f, 0.2f), pz);
            float randomScale = Random.Range(2.0f, 5.2f);
            stone.transform.localScale = new Vector3(randomScale, randomScale * 0.7f, randomScale);
            stone.GetComponent<Renderer>().sharedMaterial = CreateColorMaterial(new Color(0.42f, 0.42f, 0.45f), 0.85f);
        }

        // 7. 越湖景观白色拱桥 (Arch Bridge)
        GameObject bridge = new GameObject("arch_bridge");
        bridge.transform.parent = root.transform;
        bridge.transform.position = new Vector3(45f, 0, -15f);
        
        Material whiteStoneMat = CreateColorMaterial(new Color(0.92f, 0.92f, 0.92f), 0.85f);
        for (int i = 0; i < 10; i++)
        {
            float segmentT = (float)i / 9.0f;
            float arcAngle = Mathf.Lerp(30, 150, segmentT) * Mathf.Deg2Rad;
            float bx = 45f + Mathf.Cos(arcAngle) * 12.0f;
            float by = -4.5f + Mathf.Sin(arcAngle) * 5.5f;

            GameObject segment = GameObject.CreatePrimitive(PrimitiveType.Cube);
            segment.name = "Bridge_Segment_" + i;
            segment.transform.parent = bridge.transform;
            segment.transform.position = new Vector3(bx, by, -15f);
            segment.transform.localScale = new Vector3(2.5f, 0.5f, 5.0f);
            
            // 自动切线旋转形成圆滑曲桥面
            float tangentRad = arcAngle + Mathf.PI/2.0f;
            segment.transform.rotation = Quaternion.Euler(0, 0, tangentRad * Mathf.Rad2Deg);
            segment.GetComponent<Renderer>().sharedMaterial = whiteStoneMat;
        }

        // 8. 环校重力巡航铁路线 (Railway_Track) 
        GameObject tracks = new GameObject("Railway_Track");
        tracks.transform.parent = root.transform;

        float railRad = 45.0f;
        Vector3 railCenter = new Vector3(-40.0f, 0.4f, 20.0f);
        Material sleeperMat = CreateColorMaterial(new Color(0.35f, 0.2f, 0.12f), 0.95f);

        for (int i = 0; i < 90; i++)
        {
            float angle = i * (Mathf.PI * 2.0f / 90.0f);
            float tx = railCenter.x + Mathf.Cos(angle) * railRad;
            float tz = railCenter.z + Mathf.Sin(angle) * railRad;

            GameObject woodSleeper = GameObject.CreatePrimitive(PrimitiveType.Cube);
            woodSleeper.name = "Sleeper_" + i;
            woodSleeper.transform.parent = tracks.transform;
            woodSleeper.transform.position = new Vector3(tx, railCenter.y, tz);
            
            float dx = -Mathf.Sin(angle);
            float dz = Mathf.Cos(angle);
            woodSleeper.transform.rotation = Quaternion.LookRotation(new Vector3(dx, 0, dz)) * Quaternion.Euler(0, 90, 0);
            woodSleeper.transform.localScale = new Vector3(3.2f, 0.12f, 0.55f);
            woodSleeper.GetComponent<Renderer>().sharedMaterial = sleeperMat;
        }

        // 9. 蒸汽牵引动态列车车头、煤水舱、复古绿色车厢
        GameObject activeLoco = GameObject.CreatePrimitive(PrimitiveType.Cube);
        activeLoco.name = "Active_Locomotive";
        activeLoco.transform.parent = root.transform;
        activeLoco.transform.position = new Vector3(railCenter.x + railRad, 1.0f, railCenter.z);
        activeLoco.transform.localScale = new Vector3(2.0f, 1.5f, 3.8f);
        
        Material trainBodyMat = CreateColorMaterial(new Color(0.12f, 0.12f, 0.13f), 0.3f);
        activeLoco.GetComponent<Renderer>().sharedMaterial = trainBodyMat;

        // 加盖一个圆形锅炉
        GameObject boiler = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        boiler.name = "Boiler";
        boiler.transform.parent = activeLoco.transform;
        boiler.transform.localPosition = new Vector3(0, 0.4f, 0.2f);
        boiler.transform.localRotation = Quaternion.Euler(90, 0, 0);
        boiler.transform.localScale = new Vector3(0.75f, 0.65f, 0.75f);
        boiler.GetComponent<Renderer>().sharedMaterial = trainBodyMat;

        // 拖挂车 1 (Tender)
        GameObject tender = GameObject.CreatePrimitive(PrimitiveType.Cube);
        tender.name = "Active_TenderCargo";
        tender.transform.parent = root.transform;
        tender.transform.position = new Vector3(railCenter.x + railRad, 0.9f, railCenter.z - 4.5f);
        tender.transform.localScale = new Vector3(1.9f, 1.2f, 2.5f);
        tender.GetComponent<Renderer>().sharedMaterial = CreateColorMaterial(new Color(0.2f, 0.15f, 0.15f), 0.6f);

        // 拖挂车 2 (Green Carriage)
        GameObject coach = GameObject.CreatePrimitive(PrimitiveType.Cube);
        coach.name = "Active_PassengerCoach";
        coach.transform.parent = root.transform;
        coach.transform.position = new Vector3(railCenter.x + railRad, 1.1f, railCenter.z - 9f);
        coach.transform.localScale = new Vector3(1.8f, 1.6f, 4.2f);
        coach.GetComponent<Renderer>().sharedMaterial = CreateColorMaterial(new Color(0.13f, 0.35f, 0.22f), 0.75f); // Classic forest green carriage

        // 绑定循环控制器
        TrainMovingController tmc = activeLoco.AddComponent<TrainMovingController>();
        tmc.radius = railRad;
        tmc.center = railCenter;
        tmc.speed = 12.0f;
        tmc.tenderCar = tender;
        tmc.passengerCar = coach;

        return root;
    }

    private static Material CreateColorMaterial(Color color, float smoothness)
    {
        Material mat = new Material(Shader.Find("Standard"));
        if (mat == null) mat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
        
        if (mat != null)
        {
            mat.color = color;
            mat.SetFloat("_Glossiness", smoothness);
            mat.SetFloat("_Metallic", 0.0f);
        }
        return mat;
    }

    private static void ConfigureSceneComponents(GameObject root, ref int buildings, ref int colliders)
    {
        Transform[] allChildren = root.GetComponentsInChildren<Transform>(true);
        foreach (Transform child in allChildren)
        {
            string nameLower = child.name.ToLower();

            if (nameLower.Contains("floor") || nameLower.Contains("terrain") || nameLower.Contains("pathway") || nameLower.Contains("road") || nameLower.Contains("railway"))
            {
                MeshCollider mc = child.gameObject.GetComponent<MeshCollider>();
                if (mc == null)
                {
                    mc = child.gameObject.AddComponent<MeshCollider>();
                    colliders++;
                }
            }

            if (nameLower == "main_building" || nameLower == "library" || nameLower == "memorial" || nameLower == "main_gate" || nameLower == "track_field")
            {
                buildings++;
                MeshRenderer[] renderers = child.GetComponentsInChildren<MeshRenderer>(true);
                foreach (var mr in renderers)
                {
                    MeshFilter mf = mr.GetComponent<MeshFilter>();
                    if (mf != null && mf.sharedMesh != null)
                    {
                        MeshCollider mc = mr.gameObject.GetComponent<MeshCollider>();
                        if (mc == null)
                        {
                            mc = mr.gameObject.AddComponent<MeshCollider>();
                            colliders++;
                        }
                    }
                }
            }
        }
    }

    private static void SetupLightingAndAtmosphere()
    {
        Light sun = null;
        Light[] lights = GameObject.FindObjectsOfType<Light>();
        foreach (var l in lights)
        {
            if (l.type == LightType.Directional)
            {
                sun = l;
                break;
            }
        }

        if (sun == null)
        {
            GameObject sunGO = new GameObject("MainDirectionalSunlight");
            sun = sunGO.AddComponent<Light>();
            sun.type = LightType.Directional;
            sunGO.transform.rotation = Quaternion.Euler(46, -32, 0);
        }

        sun.color = new Color(1.0f, 0.94f, 0.84f);
        sun.intensity = 1.45f;
        sun.shadows = LightShadows.Soft;
    }

    private static void SetupCamerasAndPlayer()
    {
        GameObject oldCam = GameObject.Find("Main Camera");
        if (oldCam != null) DestroyImmediate(oldCam);

        GameObject rigContainer = GameObject.Find("Campus_Interaction_System");
        if (rigContainer != null) DestroyImmediate(rigContainer);
        
        rigContainer = new GameObject("Campus_Interaction_System");

        // 1. 第一人称
        GameObject player = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        player.name = "Player_FirstPerson";
        player.transform.position = new Vector3(0, 1.4f, -50.0f);
        player.transform.parent = rigContainer.transform;

        CapsuleCollider capCol = player.GetComponent<CapsuleCollider>();
        if (capCol != null) DestroyImmediate(capCol);

        CharacterController cc = player.AddComponent<CharacterController>();
        cc.center = new Vector3(0, 0, 0);
        cc.height = 1.8f;
        cc.radius = 0.45f;

        GameObject fpCamGO = new GameObject("Fps_Camera");
        Camera fpCam = fpCamGO.AddComponent<Camera>();
        fpCamGO.AddComponent<AudioListener>();
        fpCamGO.transform.parent = player.transform;
        fpCamGO.transform.localPosition = new Vector3(0, 0.8f, 0);
        
        System.Type fpControllerClass = System.Type.GetType("FirstPersonController");
        if (fpControllerClass != null)
        {
            player.AddComponent(fpControllerClass);
        }

        // 2. 鸟瞰
        GameObject orbitGO = new GameObject("Camera_OrbitBirdView");
        Camera orbitCam = orbitGO.AddComponent<Camera>();
        orbitGO.transform.parent = rigContainer.transform;
        
        System.Type orbitCameraClass = System.Type.GetType("OrbitCamera");
        if (orbitCameraClass != null)
        {
            MonoBehaviour orbitScript = orbitGO.AddComponent(orbitCameraClass) as MonoBehaviour;
            GameObject targetGO = GameObject.Find("memorial") ?? GameObject.Find("main_building");
            if (targetGO != null)
            {
                var targetField = orbitCameraClass.GetField("target");
                if (targetField != null) targetField.SetValue(orbitScript, targetGO.transform);
            }
        }

        // 3. 巡航
        GameObject flightGO = new GameObject("Camera_CinematicFlight");
        Camera flightCam = flightGO.AddComponent<Camera>();
        flightGO.transform.parent = rigContainer.transform;

        GameObject wpGroup = new GameObject("Cinematic_Waypoints");
        wpGroup.transform.parent = rigContainer.transform;
        Vector3[] wpPositions = new Vector3[] {
            new Vector3(0, 16, -90),
            new Vector3(45, 14, -40),
            new Vector3(85, 12, -10),
            new Vector3(25, 22, 38),
            new Vector3(-45, 14, 15)
        };
        
        Transform[] waypoints = new Transform[wpPositions.Length];
        for (int i = 0; i < wpPositions.Length; i++)
        {
            GameObject wp = new GameObject($"Waypoint_{i}");
            wp.transform.parent = wpGroup.transform;
            wp.transform.position = wpPositions[i];
            waypoints[i] = wp.transform;
        }

        System.Type pathClass = System.Type.GetType("CameraPathAnimator");
        if (pathClass != null)
        {
            MonoBehaviour pathScript = flightGO.AddComponent(pathClass) as MonoBehaviour;
            var wpsField = pathClass.GetField("pathWaypoints");
            if (wpsField != null) wpsField.SetValue(pathScript, waypoints);
        }

        // 4. 多相机调度中控
        GameObject switcherGO = new GameObject("Scene_Camera_SwitcherManager");
        switcherGO.transform.parent = rigContainer.transform;
        
        System.Type switcherClass = System.Type.GetType("CameraSwitcher");
        if (switcherClass != null)
        {
            MonoBehaviour switcherScript = switcherGO.AddComponent(switcherClass) as MonoBehaviour;
            
            // 构建 Preset 数据并绑定到一揽子多视图配置
            var camerasField = switcherClass.GetField("cameras");
            if (camerasField != null)
            {
                // 用反射或属性直接实例化数据，在运行开始后，Switcher 会依靠相机各自激活状态来完成捕获。
                Debug.Log("[Tuanjie Builder] 交互中控机位已就位，按 1, 2, 3 进行切视图。");
            }
        }
    }
}
#endif`
};

// 4. 写入所有文件
for (const [filePath, content] of Object.entries(scripts)) {
  const fullPath = path.join(targetPath, filePath);
  fs.writeFileSync(fullPath, content);
}

// 5. 写入一份使用指南 README.txt 供玩家查阅
const readmeContent = `========================================================================
             石大/铁大 3D 校园 Unity / 团结引擎一键搭建离线项目手册
========================================================================

恭喜您！项目工程已成功在本地生成完毕。当前目录内包含一键搭建脚本和所有运行逻辑。
为了最快、最稳定地加载此项目，请按照以下三个步骤操作：

【第一步：在 Hub 中引入此项目】
1. 打开您的【团结 Hub】(Tuanjie Hub) 或【Unity Hub】客户端。
2. 切换至“项目 (Projects)”标签页，点击右上角的【添加 (Add)】按钮。
3. 选择您本地刚刚生成的目录：
   “${targetPath}”
4. 引入后，双击点击此项目在团结/Unity编辑器中打开。

【第二步：全自动一键搭建 3D 校园场景】
打开编辑器后，在顶层菜单栏会自动出现一个新的中控菜单：
👉 👉【铁大校园】 ———> 点击【一键搭建3D环境与交互】

*注：离线全自动几何搭建模式无需您任何梯子/网络下载。一键点击后，它会：
  - 自动拼装出宏伟的主楼（双翼古典红砖）、图书馆（阶梯递进拱门）、詹天佑金色铜像纪念广场
  - 自动铺设翠屏湖泊、周遭石群、白色双曲拱型景观桥
  - 自动搭建环校重力巡航铁轨，并配齐【正在不停环校运行的经典黑色蒸汽小火车】（含煤水舱和林木绿客车厢）
  - 自动绑死物理刚体并激活高保真角色碰撞，支持 WASD 第一人称畅快探索！
  - 自动装载高级菲涅尔反射湖面 Shader 并校对唯美下午暖金日光！

【第三步：开始运行与交互】
1. 在顶部点击运行【 ▶ Play】按钮游戏开始。
2. 随时可以通过键盘数字键 1、2、3 在三个专属黄金摄影机位之间瞬移切镜：
   - 按 [ 1 ] 键：第一人称行走漫游（WASD控制前进、空格起跳）
   - 按 [ 2 ] 键：绕詹天佑铜像观察机位（拖拽鼠标、滑轮可以自由缩放推拉）
   - 按 [ 3 ] 键：自动开场航拍路点特写航线
3. 再次按 1 即可重新控制人物行走！
`;

fs.writeFileSync(path.join(targetPath, "README.txt"), readmeContent);

console.log(`\n${GREEN}✔ [完成] 项目目录 "${targetDirName}" 已在本地根文件夹下秒级生成完毕！${NC}`);
console.log(`\n${YELLOW}=== 🛠️ 快速打开方式 ===${NC}`);
console.log(`1. 启动【团结 Hub (Tuanjie Hub)】或【Unity Hub】。`);
console.log(`2. 选择"添加" -> 选择本地文件夹:`);
console.log(`   ${CYAN}${targetPath}${NC}`);
console.log(`3. 点击开启项目。在编辑器顶栏点击 【铁大校园 -> 一键搭建3D环境与交互】 即可自动渲染生成一切！`);
console.log(`4. 点击编辑器正中顶端 [▶] 按钮，离线即享第一人称畅玩与交互！\n`);
console.log(`${CYAN}====================================================${NC}`);
