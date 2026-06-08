/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { LANDMARKS, Landmark, PhysicalCube } from "../types";
import { audioEngine } from "../utils/AudioEngine";
import { 
  Play, Pause, RefreshCw, Layers, Compass, 
  Sun, Moon, ShieldAlert, Sparkles, Plus, 
  Trash2, Move, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Download, HelpCircle
} from "lucide-react";

interface Campus3DViewerProps {
  cameraMode: "cinematic" | "orbit" | "first_person" | "ortho";
  timeOfDay: "day" | "sunset" | "night";
  fresnelPower: number;
  onLandmarkSelected: (landmark: Landmark) => void;
  cubes: PhysicalCube[];
  onAddCube: (cube: PhysicalCube) => void;
  onClearCubes: () => void;
  detailIntensity: number;
  normalIntensity: number;
  pbrDebugMode: "standard" | "albedo" | "normal" | "roughness" | "metalness";
  selectedLandmarkId: string;
}

export default function Campus3DViewer({
  cameraMode,
  timeOfDay,
  fresnelPower,
  onLandmarkSelected,
  cubes,
  onAddCube,
  onClearCubes,
  detailIntensity,
  normalIntensity,
  pbrDebugMode,
  selectedLandmarkId,
}: Campus3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  // Keyboard controls status for First Person walking
  const keysPressed = useRef<Record<string, boolean>>({});
  const [activeLandmarkName, setActiveLandmarkName] = useState<string>("一号教学楼 (主楼)");

  // Unity export and guidance states
  const [showUnityGuide, setShowUnityGuide] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportToUnityGLB = () => {
    if (!sceneRef.current) return;
    setIsExporting(true);
    audioEngine.playSwitchSound();

    import("three/examples/jsm/exporters/GLTFExporter.js")
      .then(({ GLTFExporter }) => {
        const exporter = new GLTFExporter();
        exporter.parse(
          sceneRef.current!,
          (gltf) => {
            const output = gltf as ArrayBuffer;
            const blob = new Blob([output], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "Tiedao_University_Campus_3D_Scene.glb";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            setIsExporting(false);
            setShowUnityGuide(true);
            audioEngine.playTriggerSound(523);
          },
          (error) => {
            console.error("GLTF exporter failed:", error);
            setIsExporting(false);
          },
          {
            binary: true,
            onlyVisible: true,
            animations: []
          }
        );
      })
      .catch((err) => {
        console.error("Failed to load GLTFExporter:", err);
        setIsExporting(false);
      });
  };

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemisphereLightRef = useRef<THREE.HemisphereLight | null>(null);
  const landmarkMeshesRef = useRef<Record<string, THREE.Object3D>>({});
  const waterMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

  // Floating cube meshes
  const cubeMeshesRef = useRef<Record<string, THREE.Mesh>>({});

  // High realism materials refs
  const windowMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const lampHeadMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const floodlightMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  // Dynamic rail train refs for Tiedao University heritage
  const trainWheelsRef = useRef<THREE.Mesh[]>([]);
  const steamPuffsRef = useRef<THREE.Mesh[]>([]);
  const carriageMeshesRef = useRef<THREE.Object3D[]>([]);

  // Sky dome, stars, and cloud assets refs
  const skyDomeMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const starFieldRef = useRef<THREE.Points | null>(null);
  const cloudsRef = useRef<THREE.Group[]>([]);
  const cloudMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Cam parameters and kinematics
  const camAngleRef = useRef<number>(0); // for cinematic flyover
  const firstPersonRef = useRef({
    x: 0,
    y: 4, // eyes height
    z: 110,
    lookAngleHorizontal: Math.PI, // look towards campus (north)
    lookAngleVertical: 0,
  });

  // Smooth drag rotation for Orbit
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const orbitAngleRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3, radius: 140 });

  // Handle keys hooks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        keysPressed.current[k] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        keysPressed.current[k] = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Update Fresnel Power in custom shader material
  useEffect(() => {
    if (waterMaterialRef.current) {
      waterMaterialRef.current.uniforms.u_fresnelPower.value = fresnelPower;
    }
  }, [fresnelPower]);

  // Main Three.js Scene Setup
  useEffect(() => {
    if (!mountRef.current) return;

    // 1. SCENE & RENDERER Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Background fog based on time of day
    scene.background = new THREE.Color("#0F172A"); // Default dark slate
    scene.fog = new THREE.FogExp2("#0F172A", 0.002);

    const width = mountRef.current.clientWidth || 600;
    const height = mountRef.current.clientHeight || 450;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Clear previous canvas
    mountRef.current.innerHTML = "";
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. LIGHTING (Supports assignment shadow/real-time lighting grading)
    const ambientLight = new THREE.AmbientLight("#475569", 0.35); // Lowered flat ambient slightly to let dynamic reflections shine
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // High quality real-time GI simulation using a hemisphere bounce light
    const hemisphereLight = new THREE.HemisphereLight("#bae6fd", "#1f4115", 0.45);
    hemisphereLight.position.set(0, 150, 0);
    scene.add(hemisphereLight);
    hemisphereLightRef.current = hemisphereLight;

    const dirLight = new THREE.DirectionalLight("#FEF3C7", 1.4);
    dirLight.position.set(120, 150, 80);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 400;
    
    const d = 160;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0002;

    scene.add(dirLight);
    directionalLightRef.current = dirLight;

    // Direct light helper target
    const lightTarget = new THREE.Object3D();
    lightTarget.position.set(0, 0, 0);
    scene.add(lightTarget);
    dirLight.target = lightTarget;

    // 3. TERRAIN & ENVIRONMENT LAYOUT
    // High standard grassy terrain board representing the Shijiazhuang campus grounds
    const terrainGeo = new THREE.PlaneGeometry(350, 350, 32, 32);
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      pos.setZ(i, Math.sin(vx * 0.05) * Math.cos(vy * 0.05) * 1.5);
    }
    terrainGeo.computeVertexNormals();

    // Procedural texture generators for ultra-high realism
    const createGrassTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Base grass color gradient
        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        grad.addColorStop(0, "#193512");     // deep rich forest green
        grad.addColorStop(0.5, "#1f4115");   // classic rich grass green
        grad.addColorStop(1, "#12280d");     // dark shady lawn green
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        // Procedural noise and thousands of individual micro-grass leaf fibers
        for (let idx = 0; idx < 30000; idx++) {
          const x = Math.random() * 512;
          const y = Math.random() * 512;
          const h = Math.random() * 6 + 3;
          const w = Math.random() * 1.6 + 0.4;
          
          const rand = Math.random();
          if (rand > 0.85) {
            ctx.fillStyle = "#336925"; // bright vibrant green blades
          } else if (rand > 0.6) {
            ctx.fillStyle = "#224c1a"; // mid-ground green blades
          } else if (rand > 0.3) {
            ctx.fillStyle = "#163310"; // dark shadow blades
          } else {
            ctx.fillStyle = "#1b3d13"; // standard blades
          }

          // Draw a tiny curved blade of grass
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 3, y - h / 2, x + (Math.random() - 0.5) * 5, y - h);
          ctx.lineWidth = w;
          ctx.strokeStyle = ctx.fillStyle;
          ctx.stroke();
        }

        // Draw randomly distributed white and yellow field daisy flowers
        for (let fl = 0; fl < 120; fl++) {
          const fx = Math.random() * 512;
          const fy = Math.random() * 512;
          ctx.fillStyle = "#eab308"; // yellow daisy center core
          ctx.beginPath();
          ctx.arc(fx, fy, 1.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#ffffff"; // elegant white petals around the core
          for (let pPos = 0; pPos < 5; pPos++) {
            const pAngle = (pPos * Math.PI * 2) / 5;
            ctx.beginPath();
            ctx.arc(fx + Math.cos(pAngle) * 1.5, fy + Math.sin(pAngle) * 1.5, 0.9, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(50, 50); // dense repetition to represent large landscape
      tex.anisotropy = 16;
      return tex;
    };

    const createPavementTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#94a3b8"; 
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = "#475569"; 
        ctx.lineWidth = 1.5;
        const size = 16;
        for (let x = 0; x <= 128; x += size) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(128, x); ctx.stroke();
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(8, 8);
      tex.anisotropy = 16;
      return tex;
    };

    const createAsphaltTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#334155"; 
        ctx.fillRect(0, 0, 128, 128);
        for (let idx = 0; idx < 600; idx++) {
          ctx.fillStyle = Math.random() > 0.5 ? "#1e293b" : "#475569";
          ctx.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 16;
      return tex;
    };

    const createMarbleTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Base off-white marble color
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, 512, 512);

        // Blended noise clouds
        for (let i = 0; i < 30; i++) {
          ctx.fillStyle = "rgba(226, 232, 240, 0.4)";
          ctx.beginPath();
          ctx.arc(Math.random() * 512, Math.random() * 512, 50 + Math.random() * 70, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw marble veins
        ctx.strokeStyle = "rgba(148, 163, 184, 0.28)";
        ctx.lineWidth = 1.0;
        for (let v = 0; v < 15; v++) {
          ctx.beginPath();
          let x = Math.random() * 512;
          let y = 0;
          ctx.moveTo(x, y);
          while (y < 512) {
            y += Math.random() * 40 + 10;
            x += (Math.random() - 0.5) * 60;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        // Draw fine joints of marble tile slabs
        ctx.strokeStyle = "rgba(100, 116, 139, 0.18)";
        ctx.lineWidth = 1.2;
        for (let y = 0; y <= 512; y += 64) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
        }
        for (let row = 0; row < 8; row++) {
          const yStart = row * 64;
          const shift = (row % 2) * 32;
          for (let x = shift; x <= 512; x += 128) {
            ctx.beginPath(); ctx.moveTo(x, yStart); ctx.lineTo(x, yStart + 64); ctx.stroke();
          }
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 16;
      return tex;
    };

    const createTileRoofTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Terracotta red-orange
        ctx.fillStyle = "#a24438";
        ctx.fillRect(0, 0, 256, 256);

        // Weathered dust patches (moss/soot)
        for (let i = 0; i < 500; i++) {
          const size = Math.random() * 10 + 5;
          const rx = Math.random() * 256;
          const ry = Math.random() * 256;
          ctx.fillStyle = Math.random() > 0.65 ? "rgba(43, 14, 11, 0.5)" : "rgba(220, 110, 85, 0.35)";
          ctx.fillRect(rx, ry, size, size);
        }

        // Scallop-style tiled roof curves
        ctx.strokeStyle = "rgba(43, 14, 11, 0.65)";
        ctx.lineWidth = 1.5;
        const tileW = 16;
        const tileH = 20;
        for (let y = -tileH; y < 256 + tileH; y += tileH) {
          for (let x = -tileW; x < 256 + tileW; x += tileW) {
            ctx.beginPath();
            // Underlap arc representing curved overlapping scale tiles
            ctx.arc(x + tileW / 2, y, tileW / 2, 0, Math.PI);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x + tileW / 2, y);
            ctx.lineTo(x + tileW / 2, y + tileH);
            ctx.stroke();
          }
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 16;
      return tex;
    };

    const grassTex = createGrassTexture();
    const terrainMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: false
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = 0;
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Realistic ground overlays, roads and walkways
    const floorsGroup = new THREE.Group();

    const roadTex = createAsphaltTexture();
    roadTex.repeat.set(1, 15);
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.85,
    });

    // Central roadway from Southern Gate
    const mainAvenue = new THREE.Mesh(new THREE.PlaneGeometry(16, 125), roadMat);
    mainAvenue.rotation.x = -Math.PI / 2;
    mainAvenue.position.set(5, 0.06, -70);
    mainAvenue.receiveShadow = true;
    floorsGroup.add(mainAvenue);

    // Center divider lines
    const dividerGeo = new THREE.PlaneGeometry(0.15, 125);
    const dividerMat = new THREE.MeshBasicMaterial({ color: "#eab308" });
    const lineWest = new THREE.Mesh(dividerGeo, dividerMat);
    lineWest.rotation.x = -Math.PI / 2;
    lineWest.position.set(4.75, 0.08, -70);
    floorsGroup.add(lineWest);

    const lineEast = new THREE.Mesh(dividerGeo, dividerMat);
    lineEast.rotation.x = -Math.PI / 2;
    lineEast.position.set(5.25, 0.08, -70);
    floorsGroup.add(lineEast);

    // Zhan Tianyou central ring plaza
    const paveTex = createPavementTexture();
    const plazaSquareMat = new THREE.MeshStandardMaterial({
      map: paveTex,
      roughness: 0.75,
    });
    const circlePlaza = new THREE.Mesh(new THREE.CircleGeometry(25, 32), plazaSquareMat);
    circlePlaza.rotation.x = -Math.PI / 2;
    circlePlaza.position.set(10, 0.06, -85);
    circlePlaza.receiveShadow = true;
    floorsGroup.add(circlePlaza);

    const ringBorder = new THREE.Mesh(
      new THREE.RingGeometry(24.4, 25.4, 32),
      new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.8 })
    );
    ringBorder.rotation.x = -Math.PI / 2;
    ringBorder.position.set(10, 0.08, -85);
    floorsGroup.add(ringBorder);

    // Main Academic complex brick patio courtyard
    const courtyardPlaza = new THREE.Mesh(new THREE.PlaneGeometry(95, 45), plazaSquareMat);
    courtyardPlaza.rotation.x = -Math.PI / 2;
    courtyardPlaza.position.set(0, 0.06, -30);
    courtyardPlaza.receiveShadow = true;
    floorsGroup.add(courtyardPlaza);

    // Angled walkways to Library
    const libraryPath = new THREE.Mesh(new THREE.PlaneGeometry(50, 10), plazaSquareMat);
    libraryPath.rotation.x = -Math.PI / 2;
    libraryPath.rotation.z = Math.PI / 6.5;
    libraryPath.position.set(-36, 0.06, -20);
    libraryPath.receiveShadow = true;
    floorsGroup.add(libraryPath);

    const libraryCircleZone = new THREE.Mesh(new THREE.CircleGeometry(20, 16), plazaSquareMat);
    libraryCircleZone.rotation.x = -Math.PI / 2;
    libraryCircleZone.position.set(-80, 0.06, 40);
    libraryCircleZone.receiveShadow = true;
    floorsGroup.add(libraryCircleZone);

    // Sports Arena Tracks Ground (at x: -90, z: -70)
    const createArenaTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#991b1b"; 
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = 3;
        for (let ly = 12; ly < 256; ly += 42) {
          ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(256, ly); ctx.stroke();
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    };
    const trackRubberMat = new THREE.MeshStandardMaterial({
      map: createArenaTexture(),
      roughness: 0.9,
    });
    
    const raceTrackGround = new THREE.Mesh(new THREE.PlaneGeometry(65, 40), trackRubberMat);
    raceTrackGround.rotation.x = -Math.PI / 2;
    raceTrackGround.position.set(-90, 0.06, -70);
    raceTrackGround.receiveShadow = true;
    floorsGroup.add(raceTrackGround);

    const innerSoccerGreen = new THREE.Mesh(
      new THREE.PlaneGeometry(51, 26),
      new THREE.MeshStandardMaterial({ color: "#15803d", roughness: 0.95 })
    );
    innerSoccerGreen.rotation.x = -Math.PI / 2;
    innerSoccerGreen.position.set(-90, 0.07, -70);
    innerSoccerGreen.receiveShadow = true;
    floorsGroup.add(innerSoccerGreen);

    // Real concrete perimeter borders for Cuiping Lake to anchor water beautifully
    // Lake is located around x: 80, z: -10, size: 65x45
    const curbMat = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.85 });
    const curbThick = 1.0;
    const curbHt = 0.5;

    const northCurb = new THREE.Mesh(new THREE.BoxGeometry(67, curbHt, curbThick), curbMat);
    northCurb.position.set(80, curbHt/2, -33);
    northCurb.castShadow = true;
    northCurb.receiveShadow = true;
    floorsGroup.add(northCurb);

    const southCurb = new THREE.Mesh(new THREE.BoxGeometry(67, curbHt, curbThick), curbMat);
    southCurb.position.set(80, curbHt/2, 13);
    southCurb.castShadow = true;
    southCurb.receiveShadow = true;
    floorsGroup.add(southCurb);

    const westCurb = new THREE.Mesh(new THREE.BoxGeometry(curbThick, curbHt, 47), curbMat);
    westCurb.position.set(47, curbHt/2, -10);
    westCurb.castShadow = true;
    westCurb.receiveShadow = true;
    floorsGroup.add(westCurb);

    const eastCurb = new THREE.Mesh(new THREE.BoxGeometry(curbThick, curbHt, 47), curbMat);
    eastCurb.position.set(113, curbHt/2, -10);
    eastCurb.castShadow = true;
    eastCurb.receiveShadow = true;
    floorsGroup.add(eastCurb);

    scene.add(floorsGroup);

    // 3.5. COGNITIVE SKY DOME & Stars & Clouds
    const skyGeo = new THREE.SphereGeometry(320, 32, 24);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        u_topColor: { value: new THREE.Color("#0284c7") },
        u_bottomColor: { value: new THREE.Color("#bae6fd") }
      },
      vertexShader: `
        varying vec3 v_pw;
        void main() {
          v_pw = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 u_topColor;
        uniform vec3 u_bottomColor;
        varying vec3 v_pw;
        void main() {
          float normY = normalize(v_pw).y;
          float vFactor = clamp(normY * 0.5 + 0.5, 0.0, 1.0);
          gl_FragColor = vec4(mix(u_bottomColor, u_topColor, vFactor), 1.0);
        }
      `
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);
    skyDomeMaterialRef.current = skyMat;

    // Star Dust Particles
    const starCount = 300;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let sc = 0; sc < starCount; sc++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2 * Math.PI;
      const phi = Math.acos(2 * v - 1);
      const r = 270 + Math.random() * 20;
      starPositions[sc * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[sc * 3 + 1] = Math.abs(r * Math.sin(phi) * Math.sin(theta));
      starPositions[sc * 3 + 2] = r * Math.cos(phi);
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: "#ffffff",
      size: 1.6,
      transparent: true,
      opacity: 0.0,
      sizeAttenuation: true,
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    starField.visible = false;
    scene.add(starField);
    starFieldRef.current = starField;

    // Drifting 3D Cumulus Clouds
    // To make them look soft, fluffy, and with real volumetric scattering, we use a smooth MeshStandardMaterial
    // with some subtle emissive (self-glow) that reduces heavy harsh black shadows on the back, mimicking sub-surface light scattering!
    const cloudMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      emissive: "#dddddd",
      emissiveIntensity: 0.15,
      roughness: 0.98,
      metalness: 0.02,
      flatShading: false, // smooth shading for pillowy volume
      transparent: true,
      opacity: 0.95
    });
    cloudMaterialRef.current = cloudMat;

    const cloudsGroup = new THREE.Group();
    const cloudsList: THREE.Group[] = [];
    for (let cCl = 0; cCl < 8; cCl++) { // slightly more clouds for majestic sky dome cover
      const cluster = new THREE.Group();
      cluster.position.set(-160 + Math.random() * 320, 52 + Math.random() * 12, -160 + Math.random() * 320);
      
      // We procedurally compose a flat-bottomed cumulus cloud consisting of soft spheres
      // 1. Central core of the cloud (flushed and thick)
      const coreSize = 7.5 + Math.random() * 3.5;
      const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(coreSize, 20, 16), cloudMat);
      coreMesh.scale.set(1.9, 0.9, 1.3); // squash vertically for flat bottom!
      cluster.add(coreMesh);

      // 2. Surrounding overlapping puffs
      const puffsCount = 5 + Math.floor(Math.random() * 4);
      for (let pP = 0; pP < puffsCount; pP++) {
        const puffSize = 3.5 + Math.random() * 3.5;
        const puffMesh = new THREE.Mesh(new THREE.SphereGeometry(puffSize, 16, 12), cloudMat);
        
        // Distribute around the central core horizontally to keep the base flat
        const angle = (pP / puffsCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const dist = 6.0 + Math.random() * 5.5;
        const px = Math.cos(angle) * dist;
        const pz = Math.sin(angle) * dist;
        const py = (Math.random() - 0.2) * 2.0; 
        
        puffMesh.position.set(px, py, pz);
        puffMesh.scale.set(1.5, 0.7, 1.2); // flatter base
        cluster.add(puffMesh);
      }
      
      // 3. Tiny wisps trailing at the edges of each cluster
      for (let w = 0; w < 3; w++) {
        const wispSize = 1.5 + Math.random() * 1.5;
        const wispMesh = new THREE.Mesh(new THREE.SphereGeometry(wispSize, 12, 10), cloudMat);
        const wAngle = Math.random() * Math.PI * 2;
        const wDist = 12.0 + Math.random() * 5.0;
        wispMesh.position.set(Math.cos(wAngle) * wDist, -1.0 + Math.random(), Math.sin(wAngle) * wDist);
        wispMesh.scale.set(1.8, 0.5, 1.2);
        cluster.add(wispMesh);
      }

      cloudsGroup.add(cluster);
      cloudsList.push(cluster);
    }
    scene.add(cloudsGroup);
    cloudsRef.current = cloudsList;

    // Dynamic Surrounding Mountain Ring (Mountain perimeter bounds representing hills/peaks)
    const mtGroup = new THREE.Group();
    const mtMaterial = new THREE.MeshStandardMaterial({
      color: "#1e291b", // dark mossy mountain
      roughness: 1.0,
      metalness: 0.1,
      flatShading: true
    });
    for (let j = 0; j < 16; j++) {
      const angle = (j * Math.PI * 2) / 16;
      const r = 180 + Math.random() * 25;
      const h = 25 + Math.random() * 45;
      const coneGeo = new THREE.ConeGeometry(35 + Math.random() * 15, h, 4);
      const cone = new THREE.Mesh(coneGeo, mtMaterial);
      
      cone.position.set(Math.cos(angle) * r, h/2 - 5, Math.sin(angle) * r);
      cone.castShadow = true;
      cone.receiveShadow = true;
      mtGroup.add(cone);
    }
    scene.add(mtGroup);

    // 4. BUILT-IN FRESNEL WATER SIMULATION (Liquid material with angle of incidence reflection)
    // custom GLSL ShaderMaterial replicating Unity's Fresnel formula in real-time WebGL
    const waterGeometry = new THREE.PlaneGeometry(65, 45);
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0.0 },
        u_fresnelPower: { value: fresnelPower },
        u_shallowColor: { value: new THREE.Color("#0ea5e9") }, // Light blue
        u_deepColor: { value: new THREE.Color("#134e4a") }, // deep teal
        u_lightDir: { value: new THREE.Vector3(1, 1.2, 0.5).normalize() }
      },
      vertexShader: `
        varying vec3 v_normalWS;
        varying vec3 v_positionWS;
        varying vec2 v_uv;
        void main() {
          v_normalWS = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          v_positionWS = worldPos.xyz;
          v_uv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float u_time;
        uniform float u_fresnelPower;
        uniform vec3 u_shallowColor;
        uniform vec3 u_deepColor;
        uniform vec3 u_lightDir;
        varying vec3 v_normalWS;
        varying vec3 v_positionWS;
        varying vec2 v_uv;
        void main() {
          vec3 viewDir = normalize(cameraPosition - v_positionWS);
          
          // Replicate waves ripple deformation
          vec3 normal = normalize(v_normalWS);
          float waveOffset = sin(v_uv.x * 25.0 + u_time * 2.2) * cos(v_uv.y * 25.0 + u_time * 1.8) * 0.04;
          normal.x += waveOffset;
          normal.z += waveOffset;
          normal = normalize(normal);

          // Fresnel percentage: F = (1 - Dot(N, V))^Power
          float dotNV = clamp(dot(normal, viewDir), 0.0, 1.0);
          float fresnel = pow(1.0 - dotNV, u_fresnelPower);

          // Blend shallow trans and deep sky reflection color
          vec3 baseWaterColor = mix(u_shallowColor, u_deepColor, fresnel);

          // Specular highlights
          vec3 halfVector = normalize(u_lightDir + viewDir);
          float spec = pow(clamp(dot(normal, halfVector), 0.0, 1.0), 45.0);

          vec3 finalColor = baseWaterColor + spec * vec3(1.0, 0.95, 0.8) * 0.5;
          gl_FragColor = vec4(finalColor, 0.85);
        }
      `,
      transparent: true,
      depthWrite: false
    });
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(80, 0.4, -10); // Lake position
    scene.add(waterMesh);
    waterMaterialRef.current = waterMaterial;

    // Clear dynamic train references to prevent leakage
    trainWheelsRef.current = [];
    steamPuffsRef.current = [];
    carriageMeshesRef.current = [];

    // Initialize high fidelity shared materials
    const windowMat = new THREE.MeshStandardMaterial({
      color: "#bae6fd",
      emissive: "#0ea5e9",
      emissiveIntensity: 0.15,
      roughness: 0.1,
      metalness: 0.85,
    });
    windowMaterialRef.current = windowMat;

    const lampHeadMat = new THREE.MeshBasicMaterial({ color: "#eab308" });
    lampHeadMatRef.current = lampHeadMat;

    const floodlightMat = new THREE.MeshBasicMaterial({ color: "#fef08a" });
    floodlightMatRef.current = floodlightMat;

    const brightRedMat = new THREE.MeshStandardMaterial({ color: "#dc2626", metalness: 0.6, roughness: 0.3 });

    // 5. LANDMARKS MODEL GENERATOR (Realistic Architectural Procedural Design)
    const landmarksGroup = new THREE.Group();

    // Symmetrical Campus Walkways Pathway grid linking all landmarks
    const pathwaysGroup = new THREE.Group();
    const pathwayMat = new THREE.MeshStandardMaterial({
      color: "#475569", // elegant paving slate-gray
      roughness: 0.9,
      metalness: 0.1,
    });

    const pathwaysPaths = [
      { x: 0, z: -85, w: 6, d: 110, y: 0.1 },  // Main Gate to Main Building corridor
      { x: -40, z: -30, w: 80, d: 5, y: 0.1 }, // Lateral path Main Building to Library & track
      { x: 40, z: -55, w: 80, d: 4, y: 0.1 },  // Plaza paths
      { x: 50, z: -40, w: 4, d: 70, y: 0.1 },  // Pathway down to Cuiping Lake shore
    ];

    pathwaysPaths.forEach((p) => {
      const pm = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.1, p.d), pathwayMat);
      pm.position.set(p.x, p.y, p.z);
      pm.receiveShadow = true;
      pathwaysGroup.add(pm);
    });
    scene.add(pathwaysGroup);

    const createDetailMicroTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#808080";
        ctx.fillRect(0, 0, 128, 128);
        const imgData = ctx.createImageData(128, 128);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * 45;
          const val = Math.min(255, Math.max(0, 128 + noise));
          data[i] = val;
          data[i+1] = val;
          data[i+2] = val;
          data[i+3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(40, 40); // high frequency repetition
      tex.anisotropy = 16;
      return tex;
    };

    const microDetailTex = createDetailMicroTexture();

    const createMasonryNormalMap = (isRoof: boolean = false) => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "rgb(128, 128, 255)";
        ctx.fillRect(0, 0, 256, 256);
        const imgData = ctx.getImageData(0, 0, 256, 256);
        const data = imgData.data;
        const getHeight = (x: number, y: number): number => {
          let h = 128;
          if (isRoof) {
            const wave = Math.sin((x / 16) * Math.PI * 2) * 50;
            const overlap = (y % 20 < 2) ? -60 : 0;
            h += wave + overlap;
          } else {
            const rx = x % 64;
            const ry = y % 32;
            const isJoint = rx < 2 || ry < 2;
            if (isJoint) {
              h -= 80;
            }
          }
          h += (Math.random() - 0.5) * 12;
          return Math.max(0, Math.min(255, h));
        };
        for (let y = 0; y < 256; y++) {
          for (let x = 0; x < 256; x++) {
            const hL = getHeight((x - 1 + 256) % 256, y);
            const hR = getHeight((x + 1) % 256, y);
            const hD = getHeight(x, (y - 1 + 256) % 256);
            const hU = getHeight(x, (y + 1) % 256);
            const dx = (hL - hR) * 0.15;
            const dy = (hD - hU) * 0.15;
            const nx = -dx;
            const ny = -dy;
            const nz = 1.0;
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            const r = Math.floor(((nx / len) * 0.5 + 0.5) * 255);
            const g = Math.floor(((ny / len) * 0.5 + 0.5) * 255);
            const b = Math.floor(((nz / len) * 0.5 + 0.5) * 255);
            const idx = (y * 256 + x) * 4;
            data[idx] = r;
            data[idx+1] = g;
            data[idx+2] = b;
            data[idx+3] = 255;
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 16;
      return tex;
    };

    const masonryNormalTex = createMasonryNormalMap(false);
    masonryNormalTex.repeat.set(3, 6);

    const roofNormalTex = createMasonryNormalMap(true);
    roofNormalTex.repeat.set(4, 2);

    LANDMARKS.forEach((lm) => {
      const g = new THREE.Group();
      g.position.set(lm.x, 0, lm.z);

      if (lm.id === "main_building") {
        // --- 1号教学楼 (主楼) --- High Detail Architectural Reconstruction
        // We initialize standard PBR materials for high realism
        const marbleTex = createMarbleTexture();
        marbleTex.repeat.set(3, 6);
        const marbleMat = new THREE.MeshStandardMaterial({
          map: marbleTex,
          bumpMap: microDetailTex,
          bumpScale: 0.05 * detailIntensity,
          normalMap: masonryNormalTex,
          roughness: 0.28,
          metalness: 0.08,
        });
        marbleMat.userData.baseNormalScaleX = 0.5;
        marbleMat.userData.baseNormalScaleY = 0.5;
        marbleMat.normalScale.set(0.5 * normalIntensity, 0.5 * normalIntensity);

        // Tiled roof material, using the aged/weathered tiles texture
        const roofTex = createTileRoofTexture();
        roofTex.repeat.set(4, 2);
        const roofMat = new THREE.MeshStandardMaterial({
          map: roofTex,
          bumpMap: microDetailTex,
          bumpScale: 0.05 * detailIntensity,
          normalMap: roofNormalTex,
          roughness: 0.72,
          metalness: 0.1,
        });
        roofMat.userData.baseNormalScaleX = 0.8;
        roofMat.userData.baseNormalScaleY = 0.8;
        roofMat.normalScale.set(0.8 * normalIntensity, 0.8 * normalIntensity);

        // 1. Plinth / Platform steps
        const plazaBase = new THREE.Mesh(
          new THREE.BoxGeometry(86, 1.4, 34),
          new THREE.MeshStandardMaterial({ color: "#bbbfca", roughness: 0.85 })
        );
        plazaBase.position.y = 0.7;
        plazaBase.receiveShadow = true;
        plazaBase.castShadow = true;
        g.add(plazaBase);

        // Stairs leading up center
        for (let stairIdx = 0; stairIdx < 5; stairIdx++) {
          const stepGeo = new THREE.BoxGeometry(24 - stairIdx * 1.5, 0.25, 4 + stairIdx * 0.8);
          const stepMesh = new THREE.Mesh(stepGeo, new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.8 }));
          stepMesh.position.set(0, 1.4 + stairIdx * 0.25, 17 - stairIdx * 0.4);
          stepMesh.castShadow = true;
          stepMesh.receiveShadow = true;
          g.add(stepMesh);
        }

        // Entrance Lobby Doors on Plinth
        const doorFrame = new THREE.Mesh(
          new THREE.BoxGeometry(6.4, 4.4, 0.6),
          new THREE.MeshStandardMaterial({ color: "#1e293b", metalness: 0.7, roughness: 0.2 })
        );
        doorFrame.position.set(0, 2.2 + 1.4, 10.1);
        g.add(doorFrame);

        const doorGlassL = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 3.8, 0.3),
          new THREE.MeshStandardMaterial({ color: "#60a5fa", transparent: true, opacity: 0.7, metalness: 0.95, roughness: 0.05 })
        );
        doorGlassL.position.set(-1.4, 2.2 + 1.4, 10.2);
        g.add(doorGlassL);

        const doorGlassR = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 3.8, 0.3),
          new THREE.MeshStandardMaterial({ color: "#60a5fa", transparent: true, opacity: 0.7, metalness: 0.95, roughness: 0.05 })
        );
        doorGlassR.position.set(1.4, 2.2 + 1.4, 10.2);
        g.add(doorGlassR);

        const doorHandleL = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 1.3),
          new THREE.MeshStandardMaterial({ color: "#fbbf24", metalness: 0.95 })
        );
        doorHandleL.position.set(-0.25, 2.2 + 1.4, 10.4);
        g.add(doorHandleL);

        const doorHandleR = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 1.3),
          new THREE.MeshStandardMaterial({ color: "#fbbf24", metalness: 0.95 })
        );
        doorHandleR.position.set(0.25, 2.2 + 1.4, 10.4);
        g.add(doorHandleR);

        // 2. Central Primary Classroom Tower block
        const centerBlock = new THREE.Mesh(
          new THREE.BoxGeometry(20, lm.height, 20),
          marbleMat
        );
        centerBlock.position.set(0, lm.height / 2, 0);
        centerBlock.castShadow = true;
        centerBlock.receiveShadow = true;
        g.add(centerBlock);

        // Corner coigns/buttress pillars on Central Tower to represent architectural joints
        [-10.1, 10.1].forEach((cx) => {
          [-10.1, 10.1].forEach((cz) => {
            const cornerCol = new THREE.Mesh(
              new THREE.BoxGeometry(1.2, lm.height, 1.2),
              new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.4 })
            );
            cornerCol.position.set(cx, lm.height / 2, cz);
            cornerCol.castShadow = true;
            cornerCol.receiveShadow = true;
            g.add(cornerCol);
          });
        });

        // Elegant Pyramid Tiled Roof on the Central Tower (inspired by the reference medieval/aged tiled roof)
        const towerRoofHeight = 8.0;

        // Elegant stepped cornices to support the central pyramid roof realistically
        const towerCornice1 = new THREE.Mesh(
          new THREE.BoxGeometry(21.2, 0.6, 21.2),
          new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.4 })
        );
        towerCornice1.position.set(0, lm.height + 0.3, 0);
        towerCornice1.castShadow = true;
        towerCornice1.receiveShadow = true;
        g.add(towerCornice1);

        const towerCornice2 = new THREE.Mesh(
          new THREE.BoxGeometry(22.2, 0.4, 22.2),
          new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.35 })
        );
        towerCornice2.position.set(0, lm.height + 0.7, 0);
        towerCornice2.castShadow = true;
        towerCornice2.receiveShadow = true;
        g.add(towerCornice2);

        const towerRoofGeo = new THREE.ConeGeometry(15.8, towerRoofHeight, 4);
        const towerRoof = new THREE.Mesh(towerRoofGeo, roofMat);
        towerRoof.position.set(0, lm.height + 0.9 + towerRoofHeight / 2, 0);
        towerRoof.rotation.y = Math.PI / 4; // Align with the square tower
        towerRoof.castShadow = true;
        towerRoof.receiveShadow = true;
        g.add(towerRoof);

        // Giant Classical Clock on Central Facade Front
        const clockBrim = new THREE.Mesh(
          new THREE.CylinderGeometry(2.6, 2.6, 0.4, 24),
          new THREE.MeshStandardMaterial({ color: "#334155", metalness: 0.8, roughness: 0.2 })
        );
        clockBrim.rotation.x = Math.PI / 2;
        clockBrim.position.set(0, lm.height - 4, 10.1);
        g.add(clockBrim);

        const clockFace = new THREE.Mesh(
          new THREE.CylinderGeometry(2.2, 2.2, 0.45, 24),
          new THREE.MeshBasicMaterial({ color: "#f8fafc" })
        );
        clockFace.rotation.x = Math.PI / 2;
        clockFace.position.set(0, lm.height - 4, 10.1);
        g.add(clockFace);

        const hourHand = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 1.0, 0.1),
          new THREE.MeshBasicMaterial({ color: "#0f172a" })
        );
        hourHand.position.set(0.35, lm.height - 4 + 0.35, 10.4);
        hourHand.rotation.z = -Math.PI / 6;
        g.add(hourHand);

        const minuteHand = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 1.5, 0.1),
          new THREE.MeshBasicMaterial({ color: "#0f172a" })
        );
        minuteHand.position.set(-0.45, lm.height - 4 + 0.6, 10.4);
        minuteHand.rotation.z = Math.PI / 3;
        g.add(minuteHand);

        // Tower spire ornament on central crown (高线避雷针 placed atop the tile pyramid roof)
        const spireBase = new THREE.Mesh(
          new THREE.CylinderGeometry(1.5, 1.5, 2, 8),
          new THREE.MeshStandardMaterial({ color: "#64748b", metalness: 0.8 })
        );
        spireBase.position.set(0, lm.height + towerRoofHeight + 0.9, 0);
        g.add(spireBase);

        const spirePole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.2, 8, 5),
          new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.9, roughness: 0.1 })
        );
        spirePole.position.set(0, lm.height + towerRoofHeight + 4.9, 0);
        spirePole.castShadow = true;
        g.add(spirePole);

        // 3. Symmetric Flank Wing blocks
        [-26, 26].forEach((offset) => {
          const wingHeight = lm.height * 0.75; // 28.5
          const wingBlock = new THREE.Mesh(
            new THREE.BoxGeometry(22, wingHeight, 16),
            marbleMat
          );
          wingBlock.position.set(offset, wingHeight / 2 + 1.2, 0);
          wingBlock.castShadow = true;
          wingBlock.receiveShadow = true;
          g.add(wingBlock);

          // Sloped clay tiled roofs for side wings - high realism architectural construction with gables & cornices
          const wingRoofHeight = 5.2;

          // 1. Triangular Gable Walls in Marble to seal the roof ends
          // This closes the open hollow ends with beautiful building masonry
          const gableShape = new THREE.Shape();
          gableShape.moveTo(-8.0, 0);
          gableShape.lineTo(8.0, 0);
          gableShape.lineTo(0, wingRoofHeight);
          gableShape.closePath();

          const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 21.8, bevelEnabled: false });
          const gableVolume = new THREE.Mesh(gableGeo, marbleMat);
          gableVolume.rotation.y = Math.PI / 2;
          gableVolume.position.set(offset - 10.9, wingHeight + 1.2, 0); // Spans X from offset - 10.9 to offset + 10.9
          gableVolume.castShadow = true;
          gableVolume.receiveShadow = true;
          g.add(gableVolume);

          // 2. Beautiful Eaves fascia board (soffit base)
          const eavesBase = new THREE.Mesh(
            new THREE.BoxGeometry(22.6, 0.4, 16.6),
            new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.4 })
          );
          eavesBase.position.set(offset, wingHeight + 1.2 + 0.2, 0);
          eavesBase.castShadow = true;
          eavesBase.receiveShadow = true;
          g.add(eavesBase);

          // 3. Tiled Sloped Roof volume with eaves overhang
          const roofShape = new THREE.Shape();
          roofShape.moveTo(-8.4, 0);
          roofShape.lineTo(8.4, 0);
          roofShape.lineTo(0, wingRoofHeight + 0.35); // slightly taller to account for tile thickness
          roofShape.closePath();

          const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 22.4, bevelEnabled: false });
          const roofVolume = new THREE.Mesh(roofGeo, roofMat);
          roofVolume.rotation.y = Math.PI / 2;
          roofVolume.position.set(offset - 11.2, wingHeight + 1.2 + 0.2, 0); // Spans X from offset - 11.2 to offset + 11.2 (overhangs the wall)
          roofVolume.castShadow = true;
          roofVolume.receiveShadow = true;
          g.add(roofVolume);

          // Dormer Windows on the Sloped Tiled Roof (老虎窗)! High-grade realism details
          [-6.0, 6.0].forEach((dormX) => {
            const dormerGroup = new THREE.Group();
            dormerGroup.position.set(offset + dormX, wingHeight + 1.8, 6.2);

            // Dormer body with marble walls
            const dormerBody = new THREE.Mesh(
              new THREE.BoxGeometry(2.0, 2.2, 2.5),
              marbleMat
            );
            dormerBody.castShadow = true;
            dormerBody.receiveShadow = true;
            dormerGroup.add(dormerBody);

            // Realistic triangular dormer roof (extruding along X)
            const dormedRoofShape = new THREE.Shape();
            dormedRoofShape.moveTo(-1.4, 0);
            dormedRoofShape.lineTo(1.4, 0);
            dormedRoofShape.lineTo(0, 0.9);
            dormedRoofShape.closePath();

            const dormedRoofGeo = new THREE.ExtrudeGeometry(dormedRoofShape, { depth: 2.3, bevelEnabled: false });
            const dormedRoofVal = new THREE.Mesh(dormedRoofGeo, roofMat);
            dormedRoofVal.rotation.y = Math.PI / 2;
            dormedRoofVal.position.set(-1.15, 1.1, -0.6); // Spans X from -1.15 to 1.15 (width 2.3)
            dormedRoofVal.castShadow = true;
            dormerGroup.add(dormedRoofVal);

            // Little glass pane window in the dormer
            const dormerPane = new THREE.Mesh(
              new THREE.BoxGeometry(1.2, 1.2, 0.2),
              windowMat
            );
            dormerPane.position.set(0, 0.1, 1.26);
            dormerGroup.add(dormerPane);

            g.add(dormerGroup);
          });

          // Horizontal Stringcourses / Wall Trim cornices at floor levels (分层腰线)
          for (let floorH = 6.0; floorH < wingHeight; floorH += 5.6) {
            const floorTrim = new THREE.Mesh(
              new THREE.BoxGeometry(22.8, 0.35, 16.8),
              new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.4 })
            );
            floorTrim.position.set(offset, floorH + 1.2, 0);
            floorTrim.receiveShadow = true;
            g.add(floorTrim);
          }

          // Corner Pilasters / Coigns at outer wing corners
          [-11.1, 11.1].forEach((edgeX) => {
            const pillar = new THREE.Mesh(
              new THREE.BoxGeometry(1.0, wingHeight, 1.0),
              new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.35 })
            );
            pillar.position.set(offset + edgeX, wingHeight / 2 + 1.2, 8.1);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            g.add(pillar);
          });
        });

        // 4. Massive Columned Porch Colonnade (立面经典列柱)
        const colMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.3, metalness: 0.1 });
        for (let col = -3; col <= 3; col++) {
          if (col === 0) continue;
          const colX = col * 7.5;
          const colMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, lm.height * 0.7, 12), colMat);
          colMesh.position.set(colX, (lm.height * 0.7) / 2 + 1.4, 9.2);
          colMesh.castShadow = true;
          g.add(colMesh);

          // Detailed Capitols and Bases for columns
          const capital = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 1.7), colMat);
          capital.position.set(colX, lm.height * 0.7 + 1.6, 9.2);
          g.add(capital);

          const colBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 1.8), colMat);
          colBase.position.set(colX, 1.6, 9.2);
          g.add(colBase);
        }

        // Classic Triangular Pediment above columns (古希腊/俄式三角山墙门头，完美融合铁大经典苏式主楼风格)
        // Let's make a beautiful twin layer pediment for greater depth
        const pedShape = new THREE.Shape();
        pedShape.moveTo(-24, 0);
        pedShape.lineTo(24, 0);
        pedShape.lineTo(0, 6.5);
        pedShape.closePath();
        const pedExtrudeGeo = new THREE.ExtrudeGeometry(pedShape, { depth: 2.2, bevelEnabled: false });
        const pedMesh = new THREE.Mesh(pedExtrudeGeo, new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.35 }));
        pedMesh.position.set(0, lm.height * 0.7 + 1.8, 8.1); // sits on columns
        pedMesh.castShadow = true;
        pedMesh.receiveShadow = true;
        g.add(pedMesh);

        // Protruding border outline around the triangular pediment (山墙起筋)
        const borderMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.2 });
        const pedBorderL = new THREE.Mesh(new THREE.BoxGeometry(25.5, 0.6, 2.4), borderMat);
        pedBorderL.position.set(-12, lm.height * 0.7 + 1.8 + 3.25, 10.3);
        pedBorderL.rotation.z = Math.atan2(6.5, 24);
        g.add(pedBorderL);

        const pedBorderR = new THREE.Mesh(new THREE.BoxGeometry(25.5, 0.6, 2.4), borderMat);
        pedBorderR.position.set(12, lm.height * 0.7 + 1.8 + 3.25, 10.3);
        pedBorderR.rotation.z = -Math.atan2(6.5, 24);
        g.add(pedBorderR);

        // 5. Symmetric Classroom Windows Generating Matrix (玻璃窗阵格，带有精细白色格档、四周对齐、全方位渲染)
        // Standard high quality colMat used for window decors
        const winBorderMat = new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.3 });
        for (let f = 1; f <= 5; f++) {
          [-30, -22, -14, 14, 22, 30].forEach((wx) => {
            // Front Wings Windows
            const wY = 1.4 + f * 4.8;
            const frameFront = new THREE.Mesh(
              new THREE.BoxGeometry(2.4, 3.4, 0.3),
              new THREE.MeshStandardMaterial({ color: "#334155" })
            );
            frameFront.position.set(wx, wY, 8.1);
            g.add(frameFront);

            const paneFront = new THREE.Mesh(
              new THREE.BoxGeometry(2.0, 3.0, 0.4),
              windowMat
            );
            paneFront.position.set(wx, wY, 8.1);
            g.add(paneFront);

            // WINDOW SILLS (窗台) and WINDOW PEDIMENT ARCHE HEADS (窗楣) for marvelous 3D depth and shadows!
            const sillFront = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.15, 0.8), winBorderMat);
            sillFront.position.set(wx, wY - 1.7, 8.4);
            sillFront.castShadow = true;
            g.add(sillFront);

            const archFront = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 0.7), winBorderMat);
            archFront.position.set(wx, wY + 1.8, 8.35);
            archFront.castShadow = true;
            g.add(archFront);

            // Window divider lines
            const divV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.0, 0.1), new THREE.MeshStandardMaterial({ color: "#475569" }));
            divV.position.set(wx, wY, 8.26);
            g.add(divV);
            const divH = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.1), new THREE.MeshStandardMaterial({ color: "#475569" }));
            divH.position.set(wx, wY, 8.26);
            g.add(divH);

            // Rear Wings Windows with corresponding luxury sills
            const frameBack = new THREE.Mesh(
              new THREE.BoxGeometry(2.4, 3.4, 0.3),
              new THREE.MeshStandardMaterial({ color: "#334155" })
            );
            frameBack.position.set(wx, wY, -8.1);
            g.add(frameBack);

            const paneBack = new THREE.Mesh(
              new THREE.BoxGeometry(2.0, 3.0, 0.4),
              windowMat
            );
            paneBack.position.set(wx, wY, -8.1);
            g.add(paneBack);

            const sillBack = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.15, 0.8), winBorderMat);
            sillBack.position.set(wx, wY - 1.7, -8.4);
            g.add(sillBack);

            const divVBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.0, 0.1), new THREE.MeshStandardMaterial({ color: "#475569" }));
            divVBack.position.set(wx, wY, -8.26);
            g.add(divVBack);
          });
        }

        // Central Tower Block Windows
        for (let f = 1; f <= 7; f++) {
          [-4, 4].forEach((wx) => {
            const wY = 1.4 + f * 5.0;
            // Front facing
            const frame = new THREE.Mesh(
              new THREE.BoxGeometry(2.2, 3.2, 0.3),
              new THREE.MeshStandardMaterial({ color: "#1e293b" })
            );
            frame.position.set(wx, wY, 10.1);
            g.add(frame);

            const pane = new THREE.Mesh(
              new THREE.BoxGeometry(1.8, 2.8, 0.4),
              windowMat
            );
            pane.position.set(wx, wY, 10.1);
            g.add(pane);

            // Sills for Tower Windows
            const sillTowerF = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 0.8), winBorderMat);
            sillTowerF.position.set(wx, wY - 1.6, 10.3);
            sillTowerF.castShadow = true;
            g.add(sillTowerF);

            // Back facing
            const frameB = new THREE.Mesh(
              new THREE.BoxGeometry(2.2, 3.2, 0.3),
              new THREE.MeshStandardMaterial({ color: "#1e293b" })
            );
            frameB.position.set(wx, wY, -10.1);
            g.add(frameB);

            const paneB = new THREE.Mesh(
              new THREE.BoxGeometry(1.8, 2.8, 0.4),
              windowMat
            );
            paneB.position.set(wx, wY, -10.1);
            g.add(paneB);

            // Sills for Tower Back Windows
            const sillTowerB = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 0.8), winBorderMat);
            sillTowerB.position.set(wx, wY - 1.6, -10.3);
            sillTowerB.castShadow = true;
            g.add(sillTowerB);
          });
        }

      } else if (lm.id === "library") {
        // --- 高线穹顶图书馆 --- Modern Geodesic Grid Atrium
        // 1. Tiered Octagonal Base Podium
        const basePodium1Mat = new THREE.MeshStandardMaterial({
          color: "#cbd5e1",
          bumpMap: microDetailTex,
          bumpScale: 0.05 * detailIntensity,
          normalMap: masonryNormalTex,
          roughness: 0.8
        });
        basePodium1Mat.userData.baseNormalScaleX = 0.4;
        basePodium1Mat.userData.baseNormalScaleY = 0.4;
        basePodium1Mat.normalScale.set(0.4 * normalIntensity, 0.4 * normalIntensity);

        const basePodium1 = new THREE.Mesh(
          new THREE.CylinderGeometry(24, 26, 3.5, 8),
          basePodium1Mat
        );
        basePodium1.position.y = 1.75;
        basePodium1.castShadow = true;
        basePodium1.receiveShadow = true;
        g.add(basePodium1);

        const basePodium2Mat = new THREE.MeshStandardMaterial({
          color: "#e2e8f0",
          bumpMap: microDetailTex,
          bumpScale: 0.05 * detailIntensity,
          normalMap: masonryNormalTex,
          roughness: 0.7
        });
        basePodium2Mat.userData.baseNormalScaleX = 0.4;
        basePodium2Mat.userData.baseNormalScaleY = 0.4;
        basePodium2Mat.normalScale.set(0.4 * normalIntensity, 0.4 * normalIntensity);

        const basePodium2 = new THREE.Mesh(
          new THREE.CylinderGeometry(21, 23, 2.5, 8),
          basePodium2Mat
        );
        basePodium2.position.y = 4.75;
        basePodium2.castShadow = true;
        g.add(basePodium2);

        // Sweeping Entrance Steps leading up the octagonal base of the library
        for (let sIdx = 0; sIdx < 6; sIdx++) {
          const libStepGeo = new THREE.BoxGeometry(16 - sIdx * 1.5, 0.3, 3 + sIdx * 0.6);
          const libStepMesh = new THREE.Mesh(libStepGeo, new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.75 }));
          libStepMesh.position.set(0, 0.15 + sIdx * 0.3, 25.5 - sIdx * 0.3);
          libStepMesh.castShadow = true;
          libStepMesh.receiveShadow = true;
          g.add(libStepMesh);
        }

        // 2. Primary Cylinder Core study library (高透玻璃墙体)
        const coreGeo = new THREE.CylinderGeometry(17, 17, 18, 24);
        const coreMat = new THREE.MeshStandardMaterial({
          color: "#93c5fd",
          transparent: true,
          opacity: 0.45,
          roughness: 0.05,
          metalness: 0.95,
        });
        const glassCore = new THREE.Mesh(coreGeo, coreMat);
        glassCore.position.y = 15;
        g.add(glassCore);

        // Structural Geometrical Facade Mullions supporting the glass cylinder outer envelope
        const mullionMat = new THREE.MeshStandardMaterial({ color: "#475569", metalness: 0.6, roughness: 0.25 });
        const outerMullionCount = 16;
        for (let m = 0; m < outerMullionCount; m++) {
          const mAngle = (m * Math.PI * 2) / outerMullionCount;
          const mullion = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 18, 0.3),
            mullionMat
          );
          mullion.position.set(Math.cos(mAngle) * 17.1, 15, Math.sin(mAngle) * 17.1);
          mullion.rotation.y = -mAngle;
          g.add(mullion);
        }

        // 3. Glowing Internal reading platforms visible through trans-glass (内部阅读环)
        const floorMat = new THREE.MeshStandardMaterial({ color: "#ea580c", roughness: 0.4 });
        for (let lvl = 0; lvl < 3; lvl++) {
          const platform = new THREE.Mesh(new THREE.CylinderGeometry(14, 15, 0.8, 24), floorMat);
          platform.position.y = 6.5 + lvl * 5.5;
          platform.receiveShadow = true;
          g.add(platform);

          const innerCore = new THREE.Mesh(
            new THREE.CylinderGeometry(5, 5, 4.5, 12),
            new THREE.MeshBasicMaterial({ color: "#fef08a" })
          );
          innerCore.position.y = 8 + lvl * 5.5;
          g.add(innerCore);

          // Miniature study desks, chairs and bankers desk lamps visible inside the glass cylinder model!
          const h = 6.5 + lvl * 5.5 + 0.4; // table level above current platform
          for (let rad = 0; rad < 6; rad++) {
            const deskAngle = (rad * Math.PI * 2) / 6;
            const deskRadius = 10;

            const desk = new THREE.Mesh(
              new THREE.BoxGeometry(2.4, 0.15, 1.4),
              new THREE.MeshStandardMaterial({ color: "#7c2d12", roughness: 0.6 })
            );
            desk.position.set(Math.cos(deskAngle) * deskRadius, h, Math.sin(deskAngle) * deskRadius);
            desk.rotation.y = -deskAngle;
            g.add(desk);

            const seat = new THREE.Mesh(
              new THREE.BoxGeometry(1.0, 0.4, 1.0),
              new THREE.MeshStandardMaterial({ color: "#334155" })
            );
            seat.position.set(Math.cos(deskAngle) * (deskRadius - 1.8), h - 0.2, Math.sin(deskAngle) * (deskRadius - 1.8));
            seat.rotation.y = -deskAngle;
            g.add(seat);

            // Banker Green Desk lamp
            const lStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 4), new THREE.MeshStandardMaterial({ color: "#1e293b", metalness: 0.8 }));
            lStem.position.set(Math.cos(deskAngle)*deskRadius, h + 0.2, Math.sin(deskAngle)*deskRadius);
            g.add(lStem);

            const lShade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.2, 8), new THREE.MeshStandardMaterial({ color: "#10b981", roughness: 0.3 }));
            lShade.position.set(Math.cos(deskAngle)*deskRadius, h + 0.4, Math.sin(deskAngle)*deskRadius);
            g.add(lShade);

            const lBulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 4, 4), new THREE.MeshBasicMaterial({ color: "#fbbf24" }));
            lBulb.position.set(Math.cos(deskAngle)*deskRadius, h + 0.34, Math.sin(deskAngle)*deskRadius);
            g.add(lBulb);
          }
        }

        // 4. Geodeses hemisphere Glass Dome representation
        const glassDome = new THREE.Mesh(
          new THREE.SphereGeometry(17, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({
            color: "#60a5fa",
            transparent: true,
            opacity: 0.6,
            roughness: 0.05,
            metalness: 0.95,
          })
        );
        glassDome.position.y = 24;
        g.add(glassDome);

        // 5. Advanced Structural Steel Ribbon/Arc Cage spanning over Dome (几何立体钢性护肋)
        const steelMat = new THREE.MeshStandardMaterial({ color: "#f97316", metalness: 0.9, roughness: 0.1 });
        const ribSlices = 12;
        for (let i = 0; i < ribSlices; i++) {
          const ribAngle = (i * Math.PI * 2) / ribSlices;
          const pGeo = new THREE.CylinderGeometry(0.35, 0.35, 17.5, 6);
          const rib = new THREE.Mesh(pGeo, steelMat);
          rib.position.set(
            Math.cos(ribAngle) * 8.5,
            24 + 6.0,
            Math.sin(ribAngle) * 8.5
          );
          rib.rotation.z = ribAngle;
          rib.rotation.x = Math.PI / 4;
          g.add(rib);
        }

        const ringTorus = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.7, 8, 24), steelMat);
        ringTorus.rotation.x = Math.PI / 2;
        ringTorus.position.y = 41;
        g.add(ringTorus);

      } else if (lm.id === "memorial") {
        // --- 詹天佑纪念馆与铜像 (特制老铁路机车文化地标) ---
        // 1. Two-Tiered contrasting marble pedestal (厚重大理石基座)
        const basePed1 = new THREE.Mesh(
          new THREE.BoxGeometry(10, 1.2, 10),
          new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.3 }) // Black polished marble
        );
        basePed1.position.y = 0.6;
        basePed1.receiveShadow = true;
        g.add(basePed1);

        const basePed2 = new THREE.Mesh(
          new THREE.BoxGeometry(7, 2.5, 7),
          new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.7 }) // White carved stone
        );
        basePed2.position.y = 2.45;
        basePed2.castShadow = true;
        g.add(basePed2);

        const goldPlate = new THREE.Mesh(
          new THREE.BoxGeometry(4.2, 1.5, 0.2),
          new THREE.MeshStandardMaterial({ color: "#d97706", metalness: 0.8, roughness: 0.2 })
        );
        goldPlate.position.set(0, 2.45, 3.51);
        g.add(goldPlate);

        // 2. The Bronze Statue of Zhan Tianyou (中国铁路之父青铜像)
        const bronzeMat = new THREE.MeshStandardMaterial({ color: "#451a03", metalness: 0.8, roughness: 0.45 });
        
        const statueCoat = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.3, 4.5, 10), bronzeMat);
        statueCoat.position.y = 3.7 + 2.25;
        statueCoat.castShadow = true;
        g.add(statueCoat);

        const statueTorso = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 0.9), bronzeMat);
        statueTorso.position.y = 3.7 + 4.5 + 0.75;
        statueTorso.castShadow = true;
        g.add(statueTorso);

        const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 1.8), bronzeMat);
        leftArm.position.set(-1.0, 3.7 + 4.5 + 0.6, 0.3);
        leftArm.rotation.x = -Math.PI / 3;
        leftArm.rotation.z = Math.PI / 4;
        g.add(leftArm);

        const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 1.8), bronzeMat);
        rightArm.position.set(1.0, 3.7 + 4.5 + 0.6, 0.3);
        rightArm.rotation.x = -Math.PI / 4;
        rightArm.rotation.z = -Math.PI / 4;
        g.add(rightArm);

        const scrollMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3), bronzeMat);
        scrollMesh.position.set(-1.25, 3.7 + 4.5 + 1.25, 1.15);
        scrollMesh.rotation.y = Math.PI / 4;
        g.add(scrollMesh);

        const statueHead = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), bronzeMat);
        statueHead.position.y = 3.7 + 4.5 + 1.5 + 0.4;
        statueHead.castShadow = true;
        g.add(statueHead);

        const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 10), bronzeMat);
        hatBrim.position.y = 3.7 + 4.5 + 1.5 + 0.9;
        g.add(hatBrim);
        const hatDome = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10), bronzeMat);
        hatDome.position.y = 3.7 + 4.5 + 1.5 + 1.1;
        g.add(hatDome);

        // 3. Fencing garden guardrails with beautiful flower bushes!
        const fenceGeo = new THREE.TorusGeometry(12, 0.2, 8, 48);
        const fenceMat = new THREE.MeshStandardMaterial({ color: "#78350f", roughness: 0.6 });
        const circularFence = new THREE.Mesh(fenceGeo, fenceMat);
        circularFence.rotation.x = Math.PI / 2;
        circularFence.position.y = 0.4;
        g.add(circularFence);

        const leafGreenMat = new THREE.MeshStandardMaterial({ color: "#16a34a", roughness: 0.9 });
        const flowerPinkMat = new THREE.MeshStandardMaterial({ color: "#ec4899", roughness: 0.5 });
        const flowerYellowMat = new THREE.MeshStandardMaterial({ color: "#eab308", roughness: 0.5 });
        
        for (let fIdx = 0; fIdx < 24; fIdx++) {
          const fAngle = (fIdx * Math.PI * 2) / 24;
          const fRad = 8.8 + Math.random() * 1.4;
          const bushSize = 0.4 + Math.random() * 0.25;
          
          const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(bushSize), leafGreenMat);
          bush.position.set(Math.cos(fAngle) * fRad, 0.2 + Math.random() * 0.1, Math.sin(fAngle) * fRad);
          bush.castShadow = true;
          g.add(bush);

          const petalColor = Math.random() > 0.5 ? flowerPinkMat : flowerYellowMat;
          const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), petalColor);
          bloom.position.set(
            Math.cos(fAngle) * fRad + (Math.random() - 0.5) * 0.1,
            0.35 + bushSize * 0.6,
            Math.sin(fAngle) * fRad + (Math.random() - 0.5) * 0.1
          );
          g.add(bloom);
        }

        [-4.5, 4.5].forEach((lx) => {
          const lpg = new THREE.Group();
          lpg.position.set(lx, 0, 4.5);
          
          const lpole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3), new THREE.MeshStandardMaterial({ color: "#475569" }));
          lpole.position.y = 1.5;
          lpg.add(lpole);

          const lhead = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lampHeadMat);
          lhead.position.y = 3.0;
          lpg.add(lhead);
          g.add(lpg);
        });

        // 4. HISTORIC STEAM LOCOMOTIVE MONUMENT (校园中放置一辆真实老火车纪念物，铁大核心文化标志！逼真极了)
        const locParkGroup = new THREE.Group();
        locParkGroup.position.set(-4, 0.1, -12); // behind Zhan Tianyou base
        locParkGroup.rotation.y = -Math.PI / 6;

        for (let s = -5; s <= 5; s++) {
          const sleeper = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.15, 0.6), new THREE.MeshStandardMaterial({ color: "#78350f" }));
          sleeper.position.set(0, 0.08, s * 1.5);
          locParkGroup.add(sleeper);
        }
        [-1.3, 1.3].forEach((rx) => {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 17), new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.9, roughness: 0.1 }));
          rail.position.set(rx, 0.22, 0);
          locParkGroup.add(rail);
        });

        const darkTrainMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.8 });
        const brightRedMat = new THREE.MeshStandardMaterial({ color: "#dc2626", metalness: 0.6, roughness: 0.3 });

        const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 7.5, 12), darkTrainMat);
        boiler.rotation.x = Math.PI / 2;
        boiler.position.set(0, 1.25, 1.0);
        boiler.castShadow = true;
        locParkGroup.add(boiler);

        const boilerHead = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.4, 12), new THREE.MeshStandardMaterial({ color: "#94a3b8" }));
        boilerHead.rotation.x = Math.PI / 2;
        boilerHead.position.set(0, 1.25, 4.8);
        locParkGroup.add(boilerHead);

        const goldLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.5, 8), new THREE.MeshStandardMaterial({ color: "#eab308", metalness: 0.9 }));
        goldLamp.rotation.x = Math.PI / 2;
        goldLamp.position.set(0, 1.25, 5.15);
        locParkGroup.add(goldLamp);

        const goldenBulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), lampHeadMat);
        goldenBulb.position.set(0, 1.25, 5.4);
        locParkGroup.add(goldenBulb);

        // Boiler handrails
        [-1.05, 1.05].forEach((rx) => {
          const pRail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 6.5), new THREE.MeshStandardMaterial({ color: "#cbd5e1" }));
          pRail.position.set(rx, 2.1, 1.25);
          locParkGroup.add(pRail);

          [4.0, 1.0, -1.8].forEach((pz) => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8), new THREE.MeshStandardMaterial({ color: "#475569" }));
            post.position.set(rx, 1.7, pz);
            locParkGroup.add(post);
          });
        });

        // Golden bell details on boiler top
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.4, 8), new THREE.MeshStandardMaterial({ color: "#fbbf24", metalness: 0.9, roughness: 0.2 }));
        bell.position.set(0, 2.45, 2.0);
        locParkGroup.add(bell);

        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.8, 3.2), darkTrainMat);
        cab.position.set(0, 1.7, -3.2);
        cab.castShadow = true;
        locParkGroup.add(cab);

        [-1.16, 1.16].forEach((cx) => {
          const wFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 1.3), new THREE.MeshStandardMaterial({ color: "#ca8a04" }));
          wFrame.position.set(cx, 1.9, -3.2);
          locParkGroup.add(wFrame);
          
          const wPane = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 1.1), lampHeadMat);
          wPane.position.set(cx, 1.9, -3.2);
          locParkGroup.add(wPane);
        });

        // Coal Tender Box behind cab with piled dark coal blocks!
        const tenderGroup = new THREE.Group();
        tenderGroup.position.set(0, 0, -6.8);

        const coupling = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 1.2), new THREE.MeshStandardMaterial({ color: "#475569", metalness: 0.9 }));
        coupling.position.set(0, 0.4, 2.0);
        tenderGroup.add(coupling);

        const tenderCart = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.8, 4.0), darkTrainMat);
        tenderCart.position.set(0, 1.2, 0);
        tenderCart.castShadow = true;
        tenderGroup.add(tenderCart);

        // Dark coal rocks piled inside tender
        const coalMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.98 });
        for (let coalIdx = 0; coalIdx < 8; coalIdx++) {
          const coalPiece = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 + Math.random() * 0.2), coalMat);
          coalPiece.position.set(
            -0.5 + Math.random() * 1.0,
            2.05 + Math.random() * 0.15,
            -1.5 + Math.random() * 3.0
          );
          tenderGroup.add(coalPiece);
        }

        // Tender Wheels
        [-1.15, 1.15].forEach((wx) => {
          [1.1, -1.1].forEach((wz) => {
            const twheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.2, 10), brightRedMat);
            twheel.rotation.z = Math.PI / 2;
            twheel.position.set(wx, 0.55, wz);
            twheel.castShadow = true;
            tenderGroup.add(twheel);

            const thub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8), new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.9 }));
            thub.rotation.z = Math.PI / 2;
            thub.position.set(wx, 0.55, wz);
            tenderGroup.add(thub);
          });
        });

        locParkGroup.add(tenderGroup);

        const cowcatcher = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.2, 4), brightRedMat);
        cowcatcher.rotation.x = Math.PI;
        cowcatcher.rotation.y = Math.PI / 4;
        cowcatcher.position.set(0, 0.6, 5.2);
        locParkGroup.add(cowcatcher);

        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 1.2, 8), darkTrainMat);
        stack.position.set(0, 2.5, 3.8);
        locParkGroup.add(stack);

        [-1.12, 1.12].forEach((sideX) => {
          const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.8, 10), darkTrainMat);
          cylinder.position.set(sideX, 0.8, 4.0);
          cylinder.rotation.x = Math.PI / 2;
          locParkGroup.add(cylinder);

          const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 6), new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.9 }));
          pistonRod.position.set(sideX, 0.8, 3.2);
          pistonRod.rotation.x = Math.PI / 2;
          locParkGroup.add(pistonRod);
        });

        [-1.15, 1.15].forEach((wx) => {
          [1.5, -0.5, -2.5].forEach((wz) => {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.25, 12), brightRedMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(wx, 0.7, wz);
            wheel.castShadow = true;
            locParkGroup.add(wheel);

            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.35, 8), new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.9 }));
            hub.rotation.z = Math.PI / 2;
            hub.position.set(wx, 0.7, wz);
            locParkGroup.add(hub);
          });
        });

        [-1.23, 1.23].forEach((wx) => {
          const rod = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.4), new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.9 }));
          rod.position.set(wx, 0.7, -0.5);
          locParkGroup.add(rod);
        });

        g.add(locParkGroup);

      } else if (lm.id === "main_gate") {
        // --- 校门主轴线 --- Symmetrical Colonnade Triple-Arch
        const plBase = new THREE.Mesh(
          new THREE.BoxGeometry(60, 0.5, 14),
          new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.9 })
        );
        plBase.position.y = 0.25;
        plBase.receiveShadow = true;
        g.add(plBase);

        [-16, 16].forEach((blockX) => {
          const blockBase = new THREE.Mesh(
            new THREE.BoxGeometry(9, 1.4, 6),
            new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.7 })
          );
          blockBase.position.set(blockX, 0.7 + 0.4, 0);
          blockBase.castShadow = true;
          g.add(blockBase);
        });

        // Guardhouses/Ticket Reception cabins on the outer left and right margins of the colonnade!
        [-26, 26].forEach((officeX) => {
          // Brick reception cabin
          const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(6.5, 4.2, 5.0),
            new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.6 })
          );
          cabin.position.set(officeX, 2.1 + 0.4, 0);
          cabin.castShadow = true;
          cabin.receiveShadow = true;
          g.add(cabin);

          // Dark flat roof overhang lip
          const cabinRoof = new THREE.Mesh(
            new THREE.BoxGeometry(7.5, 0.4, 6.0),
            new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.5 })
          );
          cabinRoof.position.set(officeX, 4.3 + 0.4, 0);
          cabinRoof.castShadow = true;
          g.add(cabinRoof);

          // Front-facing window pane
          const glassPane = new THREE.Mesh(
            new THREE.BoxGeometry(2.5, 1.8, 0.1),
            new THREE.MeshStandardMaterial({ color: "#bae6fd", transparent: true, opacity: 0.7, metalness: 0.95, roughness: 0.05 })
          );
          glassPane.position.set(officeX, 2.8 + 0.4, 2.51);
          g.add(glassPane);
          
          // Side window matching inner driveway view
          const sideGlassPane = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 1.8, 2.0),
            new THREE.MeshStandardMaterial({ color: "#bae6fd", transparent: true, opacity: 0.7, metalness: 0.95, roughness: 0.05 })
          );
          sideGlassPane.position.set(officeX + (officeX < 0 ? 3.26 : -3.26), 2.8 + 0.4, 0);
          g.add(sideGlassPane);

          // Solid wood access doors
          const cabinDoor = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 3.2, 0.1),
            new THREE.MeshStandardMaterial({ color: "#78350f" })
          );
          cabinDoor.position.set(officeX, 1.6 + 0.4, -2.51); // facing rear landscape
          g.add(cabinDoor);
        });

        // Security automatic ticketing cabinets & red-white striped drive boom barriers!
        [-6.5, 6.5].forEach((termX) => {
          const cabinet = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 1.8, 0.7),
            new THREE.MeshStandardMaterial({ color: "#334155", metalness: 0.7, roughness: 0.3 })
          );
          cabinet.position.set(termX, 0.9 + 0.4, 3.0);
          cabinet.castShadow = true;
          g.add(cabinet);

          // Glowing LED status indicator on ticketing terminal
          const greenLed = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.4, 0.1),
            new THREE.MeshBasicMaterial({ color: "#22c55e" })
          );
          greenLed.position.set(termX, 1.5 + 0.4, 3.36);
          g.add(greenLed);

          // boom barrier group
          const barrier = new THREE.Group();
          barrier.position.set(termX, 1.35, 3.0);
          
          // stripe bar
          const barArm = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.16, 0.16), new THREE.MeshStandardMaterial({ color: "#dc2626" }));
          barArm.position.set(termX < 0 ? 2.0 : -2.0, 0, 0.1);
          barrier.add(barArm);

          // white striped overlays for realistic barricading
          for (let st = 1; st < 4; st++) {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.18), new THREE.MeshStandardMaterial({ color: "#ffffff" }));
            stripe.position.set((termX < 0 ? 2.0 : -2.0) - 1.5 + st * 1.0, 0, 0.11);
            barrier.add(stripe);
          }
          g.add(barrier);
        });

        const colPillarMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.4 });
        [-18.5, -13.5, 13.5, 18.5].forEach((offset) => {
          const colPBlock = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 15, 12), colPillarMat);
          colPBlock.position.set(offset, 1.4 + 7.5, 0);
          colPBlock.castShadow = true;
          colPBlock.receiveShadow = true;
          g.add(colPBlock);

          const ring = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.25, 8, 16), colPillarMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(offset, 1.4 + 15, 0);
          g.add(ring);
        });

        const beamBox = new THREE.Mesh(
          new THREE.BoxGeometry(46, 2.5, 4.5),
          new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.5 })
        );
        beamBox.position.set(0, 1.4 + 15 + 1.25, 0);
        beamBox.castShadow = true;
        g.add(beamBox);

        for (let pIdx = 0; pIdx < 3; pIdx++) {
          const pedStep = new THREE.Mesh(
            new THREE.BoxGeometry(45 - pIdx * 4, 0.6, 4.0 - pIdx * 0.4),
            new THREE.MeshStandardMaterial({ color: "#cbd5e1" })
          );
          pedStep.position.set(0, 1.4 + 17.5 + pIdx * 0.6 + 0.3, 0);
          pedStep.castShadow = true;
          g.add(pedStep);
        }

        const shieldBadge = new THREE.Mesh(
          new THREE.BoxGeometry(10, 1.8, 0.4),
          new THREE.MeshStandardMaterial({ color: "#b91c1c", roughness: 0.1 })
        );
        shieldBadge.position.set(0, 1.4 + 14 + 1.5, 2.3);
        g.add(shieldBadge);

        const goldShield = new THREE.Mesh(
          new THREE.CylinderGeometry(0.7, 0.7, 0.08, 12),
          new THREE.MeshStandardMaterial({ color: "#fbbf24", metalness: 0.9, roughness: 0.1 })
        );
        goldShield.rotation.x = Math.PI / 2;
        goldShield.position.set(0, 1.4 + 14 + 1.5, 2.51);
        g.add(goldShield);

        const gateGroup = new THREE.Group();
        gateGroup.position.set(0, 1.4, 0);
        
        const gateIronMat = new THREE.MeshStandardMaterial({ color: "#1e293b", metalness: 0.8, roughness: 0.2 });
        [-4.5, 4.5].forEach((flX) => {
          const leafFrame = new THREE.Mesh(new THREE.BoxGeometry(6.5, 10, 0.25), gateIronMat);
          leafFrame.position.set(flX, 5.0, 0);
          gateGroup.add(leafFrame);

          const leafCore = new THREE.Mesh(new THREE.BoxGeometry(5.8, 9.3, 0.35), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0 }));
          leafCore.position.set(flX, 5.0, 0);
          gateGroup.add(leafCore);

          for (let bar = -5; bar <= 5; bar++) {
            const barMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 9.2), new THREE.MeshStandardMaterial({ color: "#fbbf24", metalness: 0.9 })); // Gold rails
            barMesh.position.set(flX + bar * 0.5, 5.0, 0);
            gateGroup.add(barMesh);
          }
        });
        g.add(gateGroup);

      } else if (lm.id === "track_field") {
        // --- 高标准综合运动场 (标准体育设施还原) ---
        const trackBase = new THREE.Mesh(
          new THREE.BoxGeometry(54, 0.2, 84),
          new THREE.MeshStandardMaterial({ color: "#ea580c", roughness: 0.95 }) // Red rubber track texture
        );
        trackBase.position.y = 0.1;
        trackBase.receiveShadow = true;
        g.add(trackBase);

        // High-fidelity alternating soccer field grass turf stripes
        const stripeWidth = 6.8; // 68 meters total / 10 stripes
        for (let str = 0; str < 10; str++) {
          const stripeColor = str % 2 === 0 ? "#15803d" : "#166534"; // Alternating emerald/forest green
          const grassStripe = new THREE.Mesh(
            new THREE.BoxGeometry(38, 0.3, stripeWidth),
            new THREE.MeshStandardMaterial({ color: stripeColor, roughness: 0.9, flatShading: true })
          );
          // Distribute along Z from -34 to 34
          grassStripe.position.set(0, 0.15, -34 + (str + 0.5) * stripeWidth);
          grassStripe.receiveShadow = true;
          g.add(grassStripe);
        }

        const lineMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
        const ctrCircle = new THREE.Mesh(new THREE.TorusGeometry(6, 0.12, 4, 30), lineMat);
        ctrCircle.rotation.x = Math.PI / 2;
        ctrCircle.position.set(0, 0.301, 0);
        g.add(ctrCircle);

        const ctrLine = new THREE.Mesh(new THREE.BoxGeometry(37.8, 0.12, 0.12), lineMat);
        ctrLine.position.set(0, 0.301, 0);
        g.add(ctrLine);

        [-24, 24].forEach((sideZ) => {
          const pen = new THREE.Mesh(new THREE.BoxGeometry(20, 0.12, 10), lineMat);
          pen.position.set(0, 0.301, sideZ);
          g.add(pen);
        });

        const goalMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.1, metalness: 0.6 });
        [-31, 31].forEach((gz) => {
          const goalGroup = new THREE.Group();
          goalGroup.position.set(0, 0.25, gz);
          goalGroup.rotation.y = gz > 0 ? 0 : Math.PI;

          const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 8), goalMat);
          crossBar.rotation.z = Math.PI / 2;
          crossBar.position.y = 2.4;
          goalGroup.add(crossBar);

          const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4), goalMat);
          leftPost.position.set(-4, 1.2, 0);
          goalGroup.add(leftPost);

          const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4), goalMat);
          rightPost.position.set(4, 1.2, 0);
          goalGroup.add(rightPost);

          [-4, 4].forEach((postX) => {
            const slNode = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6), goalMat);
            slNode.rotation.x = Math.PI / 4;
            slNode.position.set(postX, 1.2, -0.9);
            goalGroup.add(slNode);
          });

          const netGrid = new THREE.Mesh(
            new THREE.BoxGeometry(7.8, 2.2, 1.8),
            new THREE.MeshStandardMaterial({ color: "#e2e8f0", transparent: true, opacity: 0.25, wireframe: true })
          );
          netGrid.position.set(0, 1.1, -0.9);
          goalGroup.add(netGrid);

          g.add(goalGroup);
        });

        [-25, 25].forEach((px) => {
          [-40, 40].forEach((pz) => {
            const tower = new THREE.Group();
            tower.position.set(px, 0.15, pz);

            const pylon = new THREE.Mesh(
              new THREE.CylinderGeometry(0.18, 0.38, 22, 6),
              new THREE.MeshStandardMaterial({ color: "#64748b", metalness: 0.8, roughness: 0.1 })
            );
            pylon.position.y = 11;
            pylon.castShadow = true;
            tower.add(pylon);

            const headFrame = new THREE.Mesh(
              new THREE.BoxGeometry(4.2, 2.2, 0.5),
              new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.2 })
            );
            headFrame.position.set(0, 22.1, 0);
            headFrame.rotation.x = Math.PI / 6;
            tower.add(headFrame);

            const bulbLight = new THREE.Mesh(
              new THREE.BoxGeometry(3.8, 1.8, 0.3),
              floodlightMat
            );
            bulbLight.position.set(0, 22.1, 0.35);
            bulbLight.rotation.x = Math.PI / 6;
            tower.add(bulbLight);

            g.add(tower);
          });
        });
      }

      landmarksGroup.add(g);
      landmarkMeshesRef.current[lm.id] = g;
    });
    scene.add(landmarksGroup);

    const lakesideRocks = new THREE.Group();
    const rockGeo = new THREE.SphereGeometry(1, 8, 8);
    const rockMatList = [
      new THREE.MeshStandardMaterial({ color: "#57534e", roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: "#78716c", roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: "#a8a29e", roughness: 0.95 }),
    ];

    const rocksCount = 35;
    for (let rIdx = 0; rIdx < rocksCount; rIdx++) {
      const rockAngle = (rIdx * Math.PI * 2) / rocksCount;
      const rockRadX = 32 + Math.sin(rIdx * 7) * 1.5;
      const rockRadZ = 22 + Math.cos(rIdx * 5) * 1.5;
      const rx = 80 + Math.cos(rockAngle) * rockRadX;
      const rz = -10 + Math.sin(rockAngle) * rockRadZ;

      const rock = new THREE.Mesh(rockGeo, rockMatList[rIdx % 3]);
      const sx = 1.3 + Math.sin(rIdx) * 1.0;
      const sy = 0.5 + Math.cos(rIdx * 2) * 0.4;
      const sz = 1.3 + Math.sin(rIdx * 3) * 1.0;
      rock.scale.set(sx, sy, sz);

      rock.position.set(rx, 0.3 + sy / 2 - 0.2, rz);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      lakesideRocks.add(rock);
    }
    scene.add(lakesideRocks);

    const archBridge = new THREE.Group();
    archBridge.position.set(54, 0.2, 5); 
    archBridge.rotation.y = -Math.PI / 4;

    const woodMat = new THREE.MeshStandardMaterial({ color: "#78350f", roughness: 0.8 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: "#ca8a04", roughness: 0.9 });

    const plankCount = 10;
    for (let pLoc = 0; pLoc < plankCount; pLoc++) {
      const pRatio = pLoc / (plankCount - 1);
      const bx = -6 + pRatio * 12;
      const by = Math.sin((pRatio) * Math.PI) * 1.8 + 0.2;
      const bz = 0;

      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 5.0), woodMat);
      plank.position.set(bx, by, bz);
      plank.rotation.z = Math.cos(pRatio * Math.PI) * 0.35;
      plank.castShadow = true;
      plank.receiveShadow = true;
      archBridge.add(plank);

      [-2.4, 2.4].forEach((handZ) => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4), woodMat);
        pillar.position.set(bx, by + 0.7, handZ);
        pillar.rotation.z = plank.rotation.z;
        pillar.castShadow = true;
        archBridge.add(pillar);

        const rope = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), ropeMat);
        rope.position.set(bx, by + 1.4, handZ);
        archBridge.add(rope);
      });
    }

    [-2.4, 2.4].forEach((handZ) => {
      for (let segment = 0; segment < plankCount - 1; segment++) {
        const pR1 = segment / (plankCount - 1);
        const pR2 = (segment + 1) / (plankCount - 1);

        const x1 = -6 + pR1 * 12;
        const y1 = Math.sin(pR1 * Math.PI) * 1.8 + 0.2 + 1.4;
        const x2 = -6 + pR2 * 12;
        const y2 = Math.sin(pR2 * Math.PI) * 1.8 + 0.2 + 1.4;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const railSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, dist), woodMat);
        
        railSeg.position.set((x1 + x2)/2, (y1 + y2)/2, handZ);
        railSeg.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
        archBridge.add(railSeg);
      }
    });
    scene.add(archBridge);

    const lilypadsGroup = new THREE.Group();
    const lpadMat = new THREE.MeshStandardMaterial({ color: "#166534", roughness: 0.9, flatShading: true });
    const padCoords = [
      {x: 65, z: -15}, {x: 75, z: -5}, {x: 85, z: -25},
      {x: 95, z: -12}, {x: 78, z: 8}, {x: 68, z: -2}
    ];
    padCoords.forEach((p, idx) => {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.08, 12, 1, false, 0, Math.PI * 1.8), lpadMat);
      pad.rotation.x = Math.PI / 2;
      pad.rotation.z = idx * 1.4;
      pad.position.set(p.x, 0.42, p.z);
      lilypadsGroup.add(pad);
    });
    scene.add(lilypadsGroup);

    // --- TIEDAO UNIVERSITY ACTIVE LOOP RAILWAY LINE & MOUNTED CHUGGING TRAIN ---
    const railGroup = new THREE.Group();

    const sleepersCount = 140;
    const woodSleeperMat = new THREE.MeshStandardMaterial({ color: "#451a03", roughness: 0.95 });
    for (let sl = 0; sl < sleepersCount; sl++) {
      const angle = (sl * Math.PI * 2) / sleepersCount;
      const sx = Math.cos(angle) * 135;
      const sz = Math.sin(angle) * 135;

      const sleeper = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.16, 1.4), woodSleeperMat);
      sleeper.position.set(sx, 0.1, sz);
      sleeper.rotation.y = -angle;
      railGroup.add(sleeper);
    }

    const steelBaseMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.9, roughness: 0.2 });
    const polySegments = 140;
    for (let i = 0; i < polySegments; i++) {
      const a1 = (i * Math.PI * 2) / polySegments;
      const a2 = ((i + 1) * Math.PI * 2) / polySegments;

      const ix1 = Math.cos(a1) * 133.0, iz1 = Math.sin(a1) * 133.0;
      const ix2 = Math.cos(a2) * 133.0, iz2 = Math.sin(a2) * 133.0;
      const idx = ix2 - ix1, idz = iz2 - iz1;
      const distI = Math.sqrt(idx * idx + idz * idz);
      const innerRail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, distI), steelBaseMat);
      innerRail.position.set((ix1 + ix2)/2, 0.24, (iz1 + iz2)/2);
      innerRail.rotation.y = -Math.atan2(idz, idx) + Math.PI / 2;
      innerRail.rotation.x = Math.PI / 2;
      railGroup.add(innerRail);

      const ox1 = Math.cos(a1) * 137.0, oz1 = Math.sin(a1) * 137.0;
      const ox2 = Math.cos(a2) * 137.0, oz2 = Math.sin(a2) * 137.0;
      const odx = ox2 - ox1, odz = oz2 - oz1;
      const distO = Math.sqrt(odx * odx + odz * odz);
      const outerRail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, distO), steelBaseMat);
      outerRail.position.set((ox1 + ox2)/2, 0.24, (oz1 + oz2)/2);
      outerRail.rotation.y = -Math.atan2(odz, odx) + Math.PI / 2;
      outerRail.rotation.x = Math.PI / 2;
      railGroup.add(outerRail);
    }
    scene.add(railGroup);

    // Active Train Carriages
    const activeLocoGroup = new THREE.Group();
    const activeLocoMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.7 });
    const goldTrimMat = new THREE.MeshStandardMaterial({ color: "#ca8a04", metalness: 0.95, roughness: 0.1 });

    const aBoiler = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 5.0, 10), activeLocoMat);
    aBoiler.rotation.x = Math.PI / 2;
    aBoiler.position.set(0, 1.1, -0.2);
    aBoiler.castShadow = true;
    activeLocoGroup.add(aBoiler);

    const locomotionLight = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.4, 8), goldTrimMat);
    locomotionLight.rotation.x = Math.PI / 2;
    locomotionLight.position.set(0, 1.15, 2.4);
    activeLocoGroup.add(locomotionLight);
    const activeLightBulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), lampHeadMat);
    activeLightBulb.position.set(0, 1.15, 2.62);
    activeLocoGroup.add(activeLightBulb);

    const aChimney = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 1.1, 8), activeLocoMat);
    aChimney.position.set(0, 2.3, 1.8);
    activeLocoGroup.add(aChimney);

    for (let pc = 0; pc < 3; pc++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.4 + pc * 0.35, 8, 8),
        new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.45 })
      );
      puff.position.set(0, 2.5 + pc * 1.1, 1.8 - pc * 0.9);
      activeLocoGroup.add(puff);
      steamPuffsRef.current.push(puff);
    }

    const aCab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 2.4), activeLocoMat);
    aCab.position.set(0, 1.5, -2.4);
    aCab.castShadow = true;
    activeLocoGroup.add(aCab);

    [-1.11, 1.11].forEach((cx) => {
      const windFr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 1.0), goldTrimMat);
      windFr.position.set(cx, 1.7, -2.4);
      activeLocoGroup.add(windFr);
      
      const windPn = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.88), lampHeadMat);
      windPn.position.set(cx, 1.7, -2.4);
      activeLocoGroup.add(windPn);
    });

    [-1.05, 1.05].forEach((wx) => {
      [1.1, -0.3, -1.7, -3.0].forEach((wz) => {
        const aWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.22, 10), brightRedMat);
        aWheel.rotation.z = Math.PI / 2;
        aWheel.position.set(wx, 0.65, wz);
        aWheel.castShadow = true;
        activeLocoGroup.add(aWheel);
        trainWheelsRef.current.push(aWheel);
      });
    });

    scene.add(activeLocoGroup);
    carriageMeshesRef.current.push(activeLocoGroup);

    const activeTenderGroup = new THREE.Group();
    const ironGreyMat = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.85 });

    const tCart = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 3.8), ironGreyMat);
    tCart.position.y = 1.1;
    tCart.castShadow = true;
    activeTenderGroup.add(tCart);

    for (let coal = 0; coal < 16; coal++) {
      const cMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.4),
        new THREE.MeshStandardMaterial({ color: "#020617", roughness: 0.95 })
      );
      cMesh.rotation.set(Math.random(), Math.random(), 0);
      cMesh.position.set(
        -0.6 + Math.random() * 1.2,
        1.85,
        -1.4 + Math.random() * 2.8
      );
      activeTenderGroup.add(cMesh);
    }

    [-1.05, 1.05].forEach((wx) => {
      [1.3, -1.3].forEach((wz) => {
        const aWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 10), brightRedMat);
        aWheel.rotation.z = Math.PI / 2;
        aWheel.position.set(wx, 0.5, wz);
        activeTenderGroup.add(aWheel);
        trainWheelsRef.current.push(aWheel);
      });
    });

    scene.add(activeTenderGroup);
    carriageMeshesRef.current.push(activeTenderGroup);

    const activePassGroup = new THREE.Group();
    const classicGreenMat = new THREE.MeshStandardMaterial({ color: "#064e3b", roughness: 0.5 });

    const coachBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 5.8), classicGreenMat);
    coachBody.position.y = 1.3;
    coachBody.castShadow = true;
    activePassGroup.add(coachBody);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.14, 5.82), goldTrimMat);
    strip.position.y = 0.85;
    activePassGroup.add(strip);

    for (let pw = -2; pw <= 2; pw++) {
      [-1.04, 1.04].forEach((cx) => {
        const fr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.7), goldTrimMat);
        fr.position.set(cx, 1.5, pw * 1.15);
        activePassGroup.add(fr);

        const pn = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.68, 0.58), windowMat);
        pn.position.set(cx, 1.5, pw * 1.15);
        activePassGroup.add(pn);
      });
    }

    [-1.05, 1.05].forEach((wx) => {
      [2.1, -2.1].forEach((wz) => {
        const aWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 10), brightRedMat);
        aWheel.rotation.z = Math.PI / 2;
        aWheel.position.set(wx, 0.5, wz);
        activePassGroup.add(aWheel);
        trainWheelsRef.current.push(aWheel);
      });
    });

    scene.add(activePassGroup);
    carriageMeshesRef.current.push(activePassGroup);

    // 6. SCATTERED VEGETATION
    const veggieGroup = new THREE.Group();

    // Elegant tree coordinates mapping beautiful campus tree groves and natural areas
    const treeCoordinates = [
      // Avenue cypress flanking the main entrance walk
      { x: -25, z: -110, type: "cypress" }, { x: 25, z: -110, type: "cypress" },
      { x: -18, z: -115, type: "cypress" }, { x: 18, z: -115, type: "cypress" },
      { x: -23, z: -125, type: "cypress" }, { x: 23, z: -125, type: "cypress" },
      { x: -16, z: -132, type: "cypress" }, { x: 16, z: -132, type: "cypress" },
      
      // Maple groves
      { x: -45, z: -30, type: "maple" }, { x: -45, z: -15, type: "maple" },
      { x: -48, z: 0, type: "maple" }, { x: -52, z: -22, type: "maple" },
      
      // Library area maples & birches
      { x: -44, z: 34, type: "maple" }, { x: -46, z: 20, type: "birch" },
      { x: -112, z: 40, type: "birch" }, { x: -114, z: 26, type: "maple" },
      { x: -110, z: 48, type: "cypress" },
      
      // Zhan Tianyou central plaza borders
      { x: -15, z: -85, type: "maple" }, { x: 34, z: -85, type: "cypress" },
      { x: -14, z: -98, type: "birch" }, { x: 32, z: -100, type: "maple" },
      
      // Sports Field perimeter trees
      { x: -122, z: -45, type: "birch" }, { x: -122, z: -25, type: "birch" },
      { x: -60, z: -115, type: "cypress" }, { x: -122, z: -95, type: "cypress" },
      { x: -124, z: -70, type: "birch" },
      
      // Cuiping Lake scenic banks (Weeping Willows & Maples!)
      { x: 42, z: -10, type: "willow" }, { x: 45, z: 2, type: "willow" },
      { x: 40, z: -24, type: "willow" },
      { x: 116, z: -35, type: "maple" }, { x: 114, z: -16, type: "willow" },
      { x: 118, z: 6, type: "willow" },
      
      // Symmetrical scenic gates and bounds
      { x: 50, z: -110, type: "maple" }, { x: -65, z: -102, type: "maple" },
      { x: -135, z: 120, type: "cypress" }, { x: 135, z: 120, type: "cypress" },
      { x: -110, z: 130, type: "maple" }, { x: 110, z: 130, type: "maple" }
    ];

    treeCoordinates.forEach((coord) => {
      const tree = new THREE.Group();
      tree.position.set(coord.x, 0, coord.z);

      // Create a tapering, organic crooked trunk using multiple overlapping cylinder sections
      const tSegments = 3;
      let currentY = 0;
      let currentRadius = 0.48 * (0.85 + Math.random() * 0.3);
      let currentX = 0;
      let currentZ = 0;
      
      const trunkColor = coord.type === "birch" ? "#f1f5f9" : "#451a03"; // Birch is elegant white-silver, others dark organic brown
      const trunkMatLocal = new THREE.MeshStandardMaterial({ 
        color: trunkColor, 
        roughness: coord.type === "birch" ? 0.75 : 0.9 
      });
      
      const trunkGroup = new THREE.Group();
      
      for (let s = 0; s < tSegments; s++) {
        const segHeight = 1.7 + Math.random() * 0.5;
        const topRadius = currentRadius * 0.78;
        const segGeo = new THREE.CylinderGeometry(topRadius, currentRadius, segHeight, 8);
        segGeo.translate(0, segHeight / 2, 0);
        const segMesh = new THREE.Mesh(segGeo, trunkMatLocal);
        
        segMesh.position.set(currentX, currentY, currentZ);
        
        // Add random natural crooked bends
        const bendAngleX = (Math.random() - 0.5) * 0.16;
        const bendAngleZ = (Math.random() - 0.5) * 0.16;
        segMesh.rotation.x = bendAngleX;
        segMesh.rotation.z = bendAngleZ;
        
        segMesh.castShadow = true;
        segMesh.receiveShadow = true;
        trunkGroup.add(segMesh);
        
        // Birch decorative dark spots
        if (coord.type === "birch") {
          const spotCount = 2 + Math.floor(Math.random() * 2);
          for (let sp = 0; sp < spotCount; sp++) {
            const spotGeo = new THREE.BoxGeometry(currentRadius * 2.1, 0.12, 0.08);
            const spotMesh = new THREE.Mesh(spotGeo, new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.95 }));
            spotMesh.position.set(0, Math.random() * segHeight, 0);
            spotMesh.rotation.y = Math.random() * Math.PI * 2;
            segMesh.add(spotMesh);
          }
        }
        
        currentY += segHeight - 0.08;
        currentRadius = topRadius;
        currentX += Math.sin(bendAngleZ) * segHeight;
        currentZ -= Math.sin(bendAngleX) * segHeight;
      }
      tree.add(trunkGroup);

      // Branch forks splitting off near crown
      const branchCount = 2 + Math.floor(Math.random() * 2);
      for (let b = 0; b < branchCount; b++) {
        const bLength = 1.5 + Math.random() * 1.0;
        const bRadius = currentRadius * 0.65;
        const branchGeo = new THREE.CylinderGeometry(bRadius * 0.5, bRadius, bLength, 5);
        branchGeo.translate(0, bLength / 2, 0);
        const branch = new THREE.Mesh(branchGeo, trunkMatLocal);
        
        branch.position.set(currentX, currentY - 0.4, currentZ);
        
        const bAngleY = (b * Math.PI * 2 / branchCount) + (Math.random() - 0.5) * 0.4;
        branch.rotation.y = bAngleY;
        branch.rotation.z = 0.45 + Math.random() * 0.45; // points upwards and outwards
        branch.castShadow = true;
        tree.add(branch);
      }

      // Foliage modeling
      if (coord.type === "cypress") {
        // Evergreens with layered pointed dynamic cones
        const pineColors = ["#064e3b", "#0f533f", "#115e59", "#134e4a"];
        const pColor = pineColors[Math.floor(Math.random() * pineColors.length)];
        const pineMat = new THREE.MeshStandardMaterial({ color: pColor, roughness: 0.9, flatShading: true });
        
        const startHeight = currentY * 0.7;
        const tiers = 3 + Math.floor(Math.random() * 2);
        for (let tier = 0; tier < tiers; tier++) {
          const tRadius = 2.9 - tier * 0.7;
          const tHeight = 4.0 - tier * 0.5;
          
          const mainCone = new THREE.Mesh(
            new THREE.ConeGeometry(tRadius, tHeight, 8),
            pineMat
          );
          mainCone.position.set(currentX, startHeight + tier * 1.9, currentZ);
          mainCone.castShadow = true;
          tree.add(mainCone);
          
          // Side bushy tuft cone growths
          const clusterCount = 3 + Math.floor(Math.random() * 2);
          for (let cl = 0; cl < clusterCount; cl++) {
            const clAngle = (cl * Math.PI * 2) / clusterCount + Math.random() * 0.3;
            const clRad = tRadius * 0.38;
            const clSide = new THREE.Mesh(
              new THREE.ConeGeometry(clRad, tHeight * 0.55, 6),
              pineMat
            );
            const dist = tRadius * 0.55;
            clSide.position.set(
              currentX + Math.cos(clAngle) * dist,
              startHeight + tier * 1.9 - tHeight * 0.2 + (Math.random() - 0.5) * 0.3,
              currentZ + Math.sin(clAngle) * dist
            );
            clSide.rotation.z = Math.cos(clAngle) * 0.22;
            clSide.rotation.x = -Math.sin(clAngle) * 0.22;
            clSide.castShadow = true;
            tree.add(clSide);
          }
        }
      } else if (coord.type === "maple") {
        // Red, orange and golden organic maple clumps
        const mapleColors = ["#b91c1c", "#dc2626", "#ea580c", "#f97316", "#eab308", "#991b1b"];
        const baseColor = mapleColors[Math.floor(Math.random() * mapleColors.length)];
        const leavesMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.85, flatShading: true });
        
        const canopyCenter = { x: currentX, y: currentY + 0.8, z: currentZ };
        const leavesCount = 8 + Math.floor(Math.random() * 4);
        
        for (let l = 0; l < leavesCount; l++) {
          const lScale = 1.3 + Math.random() * 1.8;
          const leafSphere = new THREE.Mesh(
            new THREE.DodecahedronGeometry(lScale),
            Math.random() > 0.5
              ? new THREE.MeshStandardMaterial({ color: mapleColors[Math.floor(Math.random() * mapleColors.length)], roughness: 0.85, flatShading: true })
              : leavesMat
          );
          
          const angle = Math.random() * Math.PI * 2;
          const radius = 1.0 + Math.random() * 1.3;
          leafSphere.position.set(
            canopyCenter.x + Math.cos(angle) * radius * 1.1,
            canopyCenter.y + (Math.random() - 0.2) * 2.8,
            canopyCenter.z + Math.sin(angle) * radius * 1.1
          );
          leafSphere.scale.set(1.0, 0.9 + Math.random() * 0.2, 1.0);
          leafSphere.castShadow = true;
          tree.add(leafSphere);
        }
      } else if (coord.type === "willow") {
        // Graceful weeping willow with long, emerald hanging branch tendrils
        const willowColors = ["#15803d", "#166534", "#15803d", "#22c55e", "#4ade80"];
        const baseWColor = willowColors[Math.floor(Math.random() * willowColors.length)];
        const leavesMat = new THREE.MeshStandardMaterial({ color: baseWColor, roughness: 0.88, flatShading: true });
        
        const canopyCenter = { x: currentX, y: currentY + 0.6, z: currentZ };
        const crownCount = 6 + Math.floor(Math.random() * 3);
        
        for (let w = 0; w < crownCount; w++) {
          const wScale = 1.4 + Math.random() * 1.3;
          const leafCrown = new THREE.Mesh(new THREE.DodecahedronGeometry(wScale), leavesMat);
          const wAngle = (w * Math.PI * 2) / crownCount;
          const wRadius = 1.3;
          leafCrown.position.set(
            canopyCenter.x + Math.cos(wAngle) * wRadius,
            canopyCenter.y + Math.random() * 1.3,
            canopyCenter.z + Math.sin(wAngle) * wRadius
          );
          leafCrown.castShadow = true;
          tree.add(leafCrown);
          
          // Hanging cascade leaves
          const tendrilCount = 3 + Math.floor(Math.random() * 2);
          for (let t = 0; t < tendrilCount; t++) {
            const tHeight = 1.5 + Math.random() * 1.3;
            const tendril = new THREE.Mesh(
              new THREE.CylinderGeometry(0.12, 0.04, tHeight, 4),
              new THREE.MeshStandardMaterial({ 
                color: willowColors[Math.floor(Math.random() * willowColors.length)], 
                roughness: 0.9,
                flatShading: true
              })
            );
            tendril.position.set(
              leafCrown.position.x + (Math.random() - 0.5) * wScale * 0.75,
              leafCrown.position.y - wScale * 0.4 - tHeight/2 + 0.2 * Math.random(),
              leafCrown.position.z + (Math.random() - 0.5) * wScale * 0.75
            );
            tendril.rotation.z = (Math.random() - 0.5) * 0.2;
            tendril.rotation.x = (Math.random() - 0.5) * 0.2;
            tendril.castShadow = true;
            tree.add(tendril);
          }
        }
      } else {
        // Silver leafy birch tree canopy (Lime & Forest greens)
        const greenShades = ["#047857", "#065f46", "#059669", "#10b981", "#15803d", "#22c55e"];
        const leavesMat = new THREE.MeshStandardMaterial({ color: "#047857", roughness: 0.9, flatShading: true });
        
        const canopyCenter = { x: currentX, y: currentY + 0.8, z: currentZ };
        const leavesCount = 7 + Math.floor(Math.random() * 3);
        for (let l = 0; l < leavesCount; l++) {
          const lScale = 1.3 + Math.random() * 1.4;
          const leafSphere = new THREE.Mesh(
            new THREE.DodecahedronGeometry(lScale),
            new THREE.MeshStandardMaterial({ 
              color: greenShades[Math.floor(Math.random() * greenShades.length)], 
              roughness: 0.9, 
              flatShading: true 
            })
          );
          
          const angle = Math.random() * Math.PI * 2;
          const radius = 0.9 + Math.random() * 1.2;
          leafSphere.position.set(
            canopyCenter.x + Math.cos(angle) * radius * 1.15,
            canopyCenter.y + (Math.random() - 0.2) * 2.4,
            canopyCenter.z + Math.sin(angle) * radius * 1.15
          );
          leafSphere.castShadow = true;
          tree.add(leafSphere);
        }
      }

      veggieGroup.add(tree);
    });

    // 6c. SCATTERED 3D WILD GRASS CLUMPS, FIELD FERNS AND SCENIC FLOWERS
    const isCoordinateValidForGrass = (gx: number, gz: number) => {
      // Avoid Cuiping Lake water body (X: [45, 115], Z: [-32.5, 12.5])
      if (gx > 44 && gx < 116 && gz > -35 && gz < 15) return false;
      
      // Avoid central main avenue roadway (X: [-6, 16], Z: [-135, -5])
      if (gx > -6 && gx < 16 && gz > -135 && gz < -5) return false;
      
      // Avoid Zhan Tianyou plaza circle area (radius 28 from x=10, z=-85)
      const distPlazaCheck = Math.sqrt((gx - 10)*(gx - 10) + (gz + 85)*(gz + 85));
      if (distPlazaCheck < 28) return false;
      
      // Avoid Main Gate: X: [-30, 30], Z: [-155, -125]
      if (gx > -30 && gx < 30 && gz > -155 && gz < -125) return false;

      // Avoid Main Teacher Building: X: [-50, 50], Z: [-52, -8]
      if (gx > -50 && gx < 50 && gz > -52 && gz < -8) return false;

      // Avoid Football Stadium arena: X: [-122, -58], Z: [-120, -20]
      if (gx > -122 && gx < -58 && gz > -120 && gz < -20) return false;

      // Avoid Highline Library circle: X: [-105, -55], Z: [15, 65]
      if (gx > -105 && gx < -55 && gz > 15 && gz < 65) return false;
      
      // Out of map boundary checks
      if (Math.abs(gx) > 160 || Math.abs(gz) > 160) return false;
      
      return true;
    };

    const gColors = ["#16a34a", "#15803d", "#166534", "#22c55e", "#4ade80", "#84cc16", "#a3e635"];
    const flowerHexes = ["#ef4444", "#f43f5e", "#ec4899", "#d946ef", "#a855f7", "#6366f1", "#eab308", "#ffffff"];
    
    // Instantiate 160 highly organic 3D grass & flower mesh groupings on the field terrain
    const totalClumps = 160;
    for (let clIdx = 0; clIdx < totalClumps; clIdx++) {
      const gx = (Math.random() - 0.5) * 310;
      const gz = (Math.random() - 0.5) * 310;
      
      if (isCoordinateValidForGrass(gx, gz)) {
        const clump = new THREE.Group();
        clump.position.set(gx, 0.1, gz);
        
        const cColor = gColors[Math.floor(Math.random() * gColors.length)];
        const bladeGeo = new THREE.ConeGeometry(0.12, 1.3, 4);
        bladeGeo.translate(0, 0.65, 0); // shift base pivot
        const bladeMat = new THREE.MeshStandardMaterial({ color: cColor, roughness: 0.95 });
        
        const bladesCount = 4 + Math.floor(Math.random() * 4);
        for (let b = 0; b < bladesCount; b++) {
          const blade = new THREE.Mesh(bladeGeo, bladeMat);
          const bAngle = (b * Math.PI * 2) / bladesCount + Math.random() * 0.4;
          const tilt = 0.12 + Math.random() * 0.28;
          
          blade.rotation.z = Math.sin(bAngle) * tilt;
          blade.rotation.x = Math.cos(bAngle) * tilt;
          blade.rotation.y = Math.random() * Math.PI;
          
          const bScale = 0.5 + Math.random() * 0.7;
          blade.scale.set(bScale, bScale, bScale);
          clump.add(blade);
        }
        
        // Randomly bloom wild tulips, poppies, or dandelions on 40% of the grass clumps!
        if (Math.random() > 0.6) {
          const stalkHeight = 1.3 + Math.random() * 0.6;
          const stalk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, stalkHeight, 4),
            new THREE.MeshStandardMaterial({ color: "#166534", roughness: 0.9 })
          );
          stalk.position.y = stalkHeight / 2;
          const sTilt = (Math.random() - 0.5) * 0.18;
          stalk.rotation.z = sTilt;
          clump.add(stalk);
          
          const fHex = flowerHexes[Math.floor(Math.random() * flowerHexes.length)];
          const fBloom = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 5, 5),
            new THREE.MeshStandardMaterial({ color: fHex, roughness: 0.5 })
          );
          fBloom.position.set(
            Math.sin(sTilt) * (stalkHeight / 2),
            stalkHeight,
            0
          );
          clump.add(fBloom);
        }
        
        clump.scale.set(1.1, 1.1, 1.1);
        veggieGroup.add(clump);
      }
    }

    scene.add(veggieGroup);

    // 7. LIGHT POLES
    const lampGroup = new THREE.Group();
    const lampPoleGeo = new THREE.CylinderGeometry(0.12, 0.18, 9, 8);
    const lampPoleMat = new THREE.MeshStandardMaterial({ color: "#475569", metalness: 0.7 });

    const lampPositions = [
      { x: -14, z: -80 },
      { x: 14, z: -80 },
      { x: -14, z: -40 },
      { x: 14, z: -40 },
      { x: -14, z: 10 },
      { x: 14, z: 10 },
    ];

    lampPositions.forEach((pos) => {
      const lamp = new THREE.Group();
      lamp.position.set(pos.x, 0, pos.z);

      const pole = new THREE.Mesh(lampPoleGeo, lampPoleMat);
      pole.position.y = 4.5;
      pole.castShadow = true;
      lamp.add(pole);

      const bracket = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.25), lampPoleMat);
      bracket.position.set(0.6, 9.0, 0);
      lamp.add(bracket);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), lampHeadMat);
      head.position.set(1.1, 8.8, 0);
      lamp.add(head);

      lampGroup.add(lamp);
    });
    scene.add(lampGroup);

    // 8. CAMERA INITIALIZATION
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 80, 160);
    camera.lookAt(0, 15, 0);

    // 9. ANIMATION & PHYSICS loop
    const clock = new THREE.Clock();
    let animId: number;

    const tick = () => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Update liquid u_time
      if (waterMaterialRef.current) {
        waterMaterialRef.current.uniforms.u_time.value = elapsed;
      }

      // Drift the 3D clouds lazily across the sky canopy
      if (cloudsRef.current) {
        cloudsRef.current.forEach((cloud) => {
          cloud.position.x += delta * 2.0;
          if (cloud.position.x > 230) {
            cloud.position.x = -230;
          }
        });
      }

      // Physics integration of gravity dropped boxes (如果投掷了方块刚体)
      updateDroppedCubes(delta);

      // 1. Rotate active dynamic train wheels
      const wheelRotateSpeed = 6.0 * delta;
      trainWheelsRef.current.forEach((wheel) => {
        wheel.rotateX(wheelRotateSpeed);
      });

      // 2. Fluffy steam clouds scaling / breathing animation
      steamPuffsRef.current.forEach((puff, idx) => {
        puff.position.y = 2.4 + idx * 1.0 + Math.sin(elapsed * 4.0 + idx) * 0.08;
        const scale = 0.95 + Math.sin(elapsed * 5.0 + idx) * 0.15;
        puff.scale.set(scale, scale, scale);
      });

      // 3. Mathematical spline movement of the 3-car training railway along circular loop (Radius 135)
      const R_track = 135;
      const trainSpeedVal = 0.06; // continuous cruise speed
      const baseAng = -elapsed * trainSpeedVal;
      const carriageGap = 0.046; // base coupling gap in radians

      if (carriageMeshesRef.current.length >= 3) {
        // Locomotive
        const loco = carriageMeshesRef.current[0];
        const a0 = baseAng;
        loco.position.set(Math.cos(a0) * R_track, 0.38, Math.sin(a0) * R_track);
        loco.rotation.y = -a0 + Math.PI / 2;

        // Coal Tender
        const tender = carriageMeshesRef.current[1];
        const a1 = baseAng + carriageGap;
        tender.position.set(Math.cos(a1) * R_track, 0.38, Math.sin(a1) * R_track);
        tender.rotation.y = -a1 + Math.PI / 2;

        // Green passenger carriage
        const passCar = carriageMeshesRef.current[2];
        const a2 = baseAng + 2 * carriageGap;
        passCar.position.set(Math.cos(a2) * R_track, 0.38, Math.sin(a2) * R_track);
        passCar.rotation.y = -a2 + Math.PI / 2;
      }

      // Handle locomotion camera constraints depending on Mode
      if (cameraMode === "cinematic") {
        // Automatic cinematic orbit track camera flyover
        camAngleRef.current += 0.18 * delta;
        const radius = 130 + Math.sin(elapsed * 0.5) * 30;
        const cx = Math.cos(camAngleRef.current) * radius;
        const cz = Math.sin(camAngleRef.current) * radius;
        const cy = 25 + Math.cos(elapsed * 0.4) * 15;

        camera.position.set(cx, cy, cz);
        
        // Smoothly point at Main Building
        const targetPos = new THREE.Vector3(0, 15, -30);
        camera.lookAt(targetPos);

        // Highlight selected building dynamically based on timer
        const currentPeriodIdx = Math.floor(elapsed / 6) % LANDMARKS.length;
        onNotifySelectedPeriod(LANDMARKS[currentPeriodIdx]);

      } else if (cameraMode === "orbit") {
        // Orbital camera using angles mouse drag
        const targetPos = new THREE.Vector3(0, 10, -30); // Focus: Classroom Main Building
        const theta = orbitAngleRef.current.theta;
        const phi = orbitAngleRef.current.phi;
        const r = orbitAngleRef.current.radius;

        const ox = targetPos.x + r * Math.sin(phi) * Math.sin(theta);
        const oy = targetPos.y + r * Math.cos(phi);
        const oz = targetPos.z + r * Math.sin(phi) * Math.cos(theta);

        camera.position.set(ox, oy, oz);
        camera.lookAt(targetPos);

      } else if (cameraMode === "first_person") {
        // First person controller move (WASD) with boundary detection
        let forward = 0;
        let right = 0;

        if (keysPressed.current["w"] || keysPressed.current["arrowup"]) forward = 1;
        if (keysPressed.current["s"] || keysPressed.current["arrowdown"]) forward = -1;
        if (keysPressed.current["a"] || keysPressed.current["arrowleft"]) right = -1;
        if (keysPressed.current["d"] || keysPressed.current["arrowright"]) right = 1;

        const speed = 25.0 * delta; // speed M/s
        
        // Horizontal forward vector derived from camera look heading
        const yaw = firstPersonRef.current.lookAngleHorizontal;
        const pitch = firstPersonRef.current.lookAngleVertical;

        const fwdX = Math.sin(yaw);
        const fwdZ = Math.cos(yaw);

        // Move calculation (fwdX, fwdZ is forward; -fwdZ, fwdX is the mathematically correct right-vector)
        let nextX = firstPersonRef.current.x + (fwdX * forward - fwdZ * right) * speed;
        let nextZ = firstPersonRef.current.z + (fwdZ * forward + fwdX * right) * speed;

        // Bounding Box Collision constraints: cannot pass through buildings or off landscape boundaries!
        const boundary = 160;
        nextX = Math.max(-boundary, Math.min(boundary, nextX));
        nextZ = Math.max(-boundary, Math.min(boundary, nextZ));

        // Landmark wall collision detections: if close to any building's boundary box, block progression!
        let collision = false;
        LANDMARKS.forEach((lm) => {
          if (lm.id === "lake_pond") return; // can pass close or submerge with water plane
          const dx = nextX - lm.x;
          const dz = nextZ - lm.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          // Standard bounding radius depending on landmarks height/dimension
          const safetyRadius = lm.id === "main_building" ? 42 : 22;
          if (dist < safetyRadius) {
            collision = true;
          }
        });

        if (!collision) {
          firstPersonRef.current.x = nextX;
          firstPersonRef.current.z = nextZ;
        }

        camera.position.set(firstPersonRef.current.x, firstPersonRef.current.y, firstPersonRef.current.z);

        // Look Target matching both pitch & yaw rotation values
        const lookTarget = new THREE.Vector3(
          firstPersonRef.current.x + Math.sin(yaw) * Math.cos(pitch),
          firstPersonRef.current.y + Math.sin(pitch),
          firstPersonRef.current.z + Math.cos(yaw) * Math.cos(pitch)
        );
        camera.lookAt(lookTarget);

      } else if (cameraMode === "ortho") {
        // Blueprint bird's eye Ortho camera
        camera.position.set(0, 180, 0.1); // extreme top-down
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(tick);
    };

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    tick();

    // 10. CLEANUPS on unmount
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      scene.clear();
      renderer.dispose();
    };
  }, [cameraMode]);

  // Handle Dynamic changes in Day/Sunset/Night lighting state
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (timeOfDay === "day") {
      scene.background = new THREE.Color("#bae6fd"); 
      scene.fog = new THREE.FogExp2("#bae6fd", 0.0012);
      
      if (ambientLightRef.current) ambientLightRef.current.color.set("#cbd5e1");
      if (hemisphereLightRef.current) {
        hemisphereLightRef.current.color.set("#bae6fd");      // Bright blue sky bounce
        hemisphereLightRef.current.groundColor.set("#1f4115"); // Rich emerald grass bounce
        hemisphereLightRef.current.intensity = 0.55;
      }
      if (directionalLightRef.current) {
        directionalLightRef.current.color.set("#ffedd5");
        directionalLightRef.current.intensity = 1.45;
      }

      if (skyDomeMaterialRef.current) {
        skyDomeMaterialRef.current.uniforms.u_topColor.value.set("#0284c7");
        skyDomeMaterialRef.current.uniforms.u_bottomColor.value.set("#bae6fd");
      }

      if (starFieldRef.current) {
        starFieldRef.current.visible = false;
      }

      if (cloudMaterialRef.current) {
        cloudMaterialRef.current.color.set("#ffffff");
        cloudMaterialRef.current.emissive.set("#dddddd");
        cloudMaterialRef.current.emissiveIntensity = 0.15;
        cloudMaterialRef.current.opacity = 0.95;
      }

      if (windowMaterialRef.current) {
        windowMaterialRef.current.color.set("#bae6fd");
        windowMaterialRef.current.emissive.set("#0ea5e9");
        windowMaterialRef.current.emissiveIntensity = 0.15;
      }
      if (lampHeadMatRef.current) lampHeadMatRef.current.color.set("#94a3b8");
      if (floodlightMatRef.current) floodlightMatRef.current.color.set("#475569");

    } else if (timeOfDay === "sunset") {
      scene.background = new THREE.Color("#fda4af"); 
      scene.fog = new THREE.FogExp2("#fda4af", 0.002);

      if (ambientLightRef.current) ambientLightRef.current.color.set("#7c2d12");
      if (hemisphereLightRef.current) {
        hemisphereLightRef.current.color.set("#fda4af");      // Soft rose/orange sunset sky bounce
        hemisphereLightRef.current.groundColor.set("#2c1510"); // Warm dark soil bounce
        hemisphereLightRef.current.intensity = 0.45;
      }
      if (directionalLightRef.current) {
        directionalLightRef.current.color.set("#f97316"); 
        directionalLightRef.current.intensity = 1.25;
      }

      if (skyDomeMaterialRef.current) {
        skyDomeMaterialRef.current.uniforms.u_topColor.value.set("#311042");
        skyDomeMaterialRef.current.uniforms.u_bottomColor.value.set("#f97316");
      }

      if (starFieldRef.current) {
        starFieldRef.current.visible = true;
        const starMat = starFieldRef.current.material as THREE.PointsMaterial;
        starMat.opacity = 0.25;
      }

      if (cloudMaterialRef.current) {
        cloudMaterialRef.current.color.set("#fed7aa"); 
        cloudMaterialRef.current.emissive.set("#b45309");
        cloudMaterialRef.current.emissiveIntensity = 0.3;
        cloudMaterialRef.current.opacity = 0.85;
      }

      if (windowMaterialRef.current) {
        windowMaterialRef.current.color.set("#fdba74");
        windowMaterialRef.current.emissive.set("#f97316");
        windowMaterialRef.current.emissiveIntensity = 0.6;
      }
      if (lampHeadMatRef.current) lampHeadMatRef.current.color.set("#ca8a04");
      if (floodlightMatRef.current) floodlightMatRef.current.color.set("#ca8a04");

    } else if (timeOfDay === "night") {
      scene.background = new THREE.Color("#050b14"); 
      scene.fog = new THREE.FogExp2("#050b14", 0.0035);

      if (ambientLightRef.current) ambientLightRef.current.color.set("#0f172a");
      if (hemisphereLightRef.current) {
        hemisphereLightRef.current.color.set("#0f172a");      // Dim dark navy sky bounce
        hemisphereLightRef.current.groundColor.set("#020617"); // Dark midnight soil ground bounce
        hemisphereLightRef.current.intensity = 0.15;
      }
      if (directionalLightRef.current) {
        directionalLightRef.current.color.set("#38bdf8"); 
        directionalLightRef.current.intensity = 0.35;
      }

      if (skyDomeMaterialRef.current) {
        skyDomeMaterialRef.current.uniforms.u_topColor.value.set("#020617");
        skyDomeMaterialRef.current.uniforms.u_bottomColor.value.set("#0f172a");
      }

      if (starFieldRef.current) {
        starFieldRef.current.visible = true;
        const starMat = starFieldRef.current.material as THREE.PointsMaterial;
        starMat.opacity = 1.0;
      }

      if (cloudMaterialRef.current) {
        cloudMaterialRef.current.color.set("#0f172a"); 
        cloudMaterialRef.current.emissive.set("#090d16");
        cloudMaterialRef.current.emissiveIntensity = 0.05;
        cloudMaterialRef.current.opacity = 0.5;
      }

      if (windowMaterialRef.current) {
        windowMaterialRef.current.color.set("#fef08a");
        windowMaterialRef.current.emissive.set("#eab308");
        windowMaterialRef.current.emissiveIntensity = 1.6;
      }
      if (lampHeadMatRef.current) lampHeadMatRef.current.color.set("#fef08a");
      if (floodlightMatRef.current) floodlightMatRef.current.color.set("#ffffff");
    }
  }, [timeOfDay]);

  // Synchronize new physical cubes from prop to Three.js representation
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Check meshes to delete or add
    const currentKeys = new Set(cubes.map(c => c.id));
    
    // Remove stale ones
    Object.keys(cubeMeshesRef.current).forEach((key) => {
      if (!currentKeys.has(key)) {
        scene.remove(cubeMeshesRef.current[key]);
        delete cubeMeshesRef.current[key];
      }
    });

    // Spawn new ones
    cubes.forEach((cube) => {
      if (!cubeMeshesRef.current[cube.id]) {
        let geom: THREE.BufferGeometry;
        // 50% cubes, 50% spheres to show diverse rigid body geometry
        if (Math.random() < 0.5) {
          geom = new THREE.BoxGeometry(cube.size, cube.size, cube.size);
        } else {
          geom = new THREE.SphereGeometry(cube.size * 0.6, 12, 12);
        }

        const mat = new THREE.MeshStandardMaterial({
          color: cube.color,
          roughness: 0.2,
          metalness: 0.6,
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(cube.x, cube.y, cube.z);
        scene.add(mesh);
        cubeMeshesRef.current[cube.id] = mesh;
      }
    });

  }, [cubes]);

  // Synchronize Detail Map Intensity and PBR Material Debug mode
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // To restore original materials for any previously modified meshes across the whole scene
    const restoreAllMaterials = () => {
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.userData && mesh.userData.originalMaterial) {
            mesh.material = mesh.userData.originalMaterial;
          }
        }
      });
    };

    // Restore first
    restoreAllMaterials();

    // Adjust detail intensities (bump scaling) and normal scale for all standard materials
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material;
        const applyPbrScaling = (m: THREE.Material) => {
          if (m instanceof THREE.MeshStandardMaterial) {
            if (m.bumpMap) {
              m.bumpScale = 0.05 * detailIntensity;
            }
            if (m.normalMap) {
              const baseScaleX = m.userData.baseNormalScaleX ?? 1.0;
              const baseScaleY = m.userData.baseNormalScaleY ?? 1.0;
              m.normalScale.set(baseScaleX * normalIntensity, baseScaleY * normalIntensity);
            }
            m.needsUpdate = true;
          }
        };
        if (Array.isArray(mat)) {
          mat.forEach(applyPbrScaling);
        } else {
          applyPbrScaling(mat);
        }
      }
    });

    if (pbrDebugMode === "standard") return;

    // Apply specific PBR Debug mode for the currently selected building
    const selectedGroup = landmarkMeshesRef.current[selectedLandmarkId];
    if (!selectedGroup) return;

    selectedGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        
        // Save original material if not already saved
        if (!mesh.userData.originalMaterial) {
          mesh.userData.originalMaterial = mesh.material;
        }

        const origMat = mesh.userData.originalMaterial;
        let debugMat: THREE.Material | null = null;

        if (origMat instanceof THREE.MeshStandardMaterial) {
          if (pbrDebugMode === "albedo") {
            debugMat = new THREE.MeshStandardMaterial({
              color: origMat.color,
              map: origMat.map,
              roughness: 1.0,
              metalness: 0.0,
              bumpMap: null,
              normalMap: null,
            });
          } else if (pbrDebugMode === "normal") {
            debugMat = new THREE.MeshNormalMaterial({
              flatShading: origMat.flatShading
            });
          } else if (pbrDebugMode === "roughness") {
            const rValue = origMat.roughness ?? 0.5;
            debugMat = new THREE.MeshBasicMaterial({
              color: new THREE.Color(rValue, rValue, rValue)
            });
          } else if (pbrDebugMode === "metalness") {
            const mValue = origMat.metalness ?? 0.0;
            debugMat = new THREE.MeshBasicMaterial({
              color: new THREE.Color(mValue, mValue, mValue)
            });
          }
        } else if (origMat instanceof THREE.MeshPhongMaterial || origMat instanceof THREE.MeshLambertMaterial || origMat instanceof THREE.MeshBasicMaterial) {
          if (pbrDebugMode === "albedo") {
            debugMat = new THREE.MeshBasicMaterial({
              color: (origMat as any).color,
              map: (origMat as any).map,
            });
          } else if (pbrDebugMode === "normal") {
            debugMat = new THREE.MeshNormalMaterial();
          } else if (pbrDebugMode === "roughness") {
            const rValue = (origMat as any).roughness ?? 0.8;
            debugMat = new THREE.MeshBasicMaterial({
              color: new THREE.Color(rValue, rValue, rValue)
            });
          } else if (pbrDebugMode === "metalness") {
            const mValue = (origMat as any).metalness ?? 0.0;
            debugMat = new THREE.MeshBasicMaterial({
              color: new THREE.Color(mValue, mValue, mValue)
            });
          }
        }

        if (debugMat) {
          mesh.material = debugMat;
        }
      }
    });

  }, [detailIntensity, normalIntensity, pbrDebugMode, selectedLandmarkId]);

  // Physics animation handler loop
  const updateDroppedCubes = (delta: number) => {
    const floorY = 0.5; // Grass height level
    const gravityForce = 32.0; // gravity acceleration
    const speedScale = 1.0;

    cubes.forEach((c) => {
      if (c.grounded) return;

      // Accelerate vy under gravity
      c.vy -= gravityForce * delta * speedScale;

      // Apply speeds
      c.x += c.vx * delta * speedScale;
      c.y += c.vy * delta * speedScale;
      c.z += c.vz * delta * speedScale;

      // Sub-collision mesh bounds mapping
      let buildingSurfaceY = floorY;
      LANDMARKS.forEach((lm) => {
        if (lm.id === "lake_pond") return;
        // Simple cylinder hit checking
        const dist = Math.sqrt((c.x - lm.x) ** 2 + (c.z - lm.z) ** 2);
        const radiusLimit = lm.id === "main_building" ? 38 : 12;
        
        if (dist < radiusLimit) {
          // It crashed on building roof deck!
          buildingSurfaceY = lm.height;
        }
      });

      // Ground/Surface crash check
      if (c.y <= buildingSurfaceY + c.size / 2) {
        c.y = buildingSurfaceY + c.size / 2;
        onAddCubeTriggerGround(c.id, buildingSurfaceY);
      }

      // Sync position of Three mesh
      const m = cubeMeshesRef.current[c.id];
      if (m) {
        m.position.set(c.x, c.y, c.z);
        // Slowly roll elements on land
        c.angleX += c.vx * 0.1;
        c.angleY += c.vy * 0.1;
        m.rotation.set(c.angleX, c.angleY, c.angleZ);
      }
    });
  };

  const onAddCubeTriggerGround = (id: string, surfaceY: number) => {
    const target = cubes.find(c => c.id === id);
    if (target && !target.grounded) {
      target.grounded = true;
      target.vy = 0; // stop vertical fall
      target.vx *= 0.15; // heavy friction dampening
      target.vz *= 0.15;
      audioEngine.playDropSound();
    }
  };

  const onNotifySelectedPeriod = (landmark: Landmark) => {
    setActiveLandmarkName(landmark.name);
    onLandmarkSelected(landmark);
  };

  // Drag listeners for Orbit and First-Person mouse panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (cameraMode === "cinematic" || cameraMode === "ortho") return;
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (cameraMode === "orbit") {
      // Rotate spherical coordinates
      orbitAngleRef.current.theta -= dx * 0.007;
      orbitAngleRef.current.phi = Math.max(
        0.1,
        Math.min(Math.PI / 2 - 0.05, orbitAngleRef.current.phi - dy * 0.007)
      );
    } else if (cameraMode === "first_person") {
      // Pan camera lookup direction (first person look, subtraction for natural drag-to-look drag alignment)
      firstPersonRef.current.lookAngleHorizontal -= dx * 0.0035;
      firstPersonRef.current.lookAngleVertical = Math.max(
        -Math.PI / 2.3,
        Math.min(Math.PI / 2.3, firstPersonRef.current.lookAngleVertical - dy * 0.003)
      );
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Keyboard emulation for easier mobile or touch inputs (on-screen directional pad)
  const pressVirtualJoy = (key: string, pressed: boolean) => {
    keysPressed.current[key] = pressed;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden relative shadow-2xl" id="campus-3D-wrapper">
      
      {/* 3D Render Port */}
      <div 
        ref={mountRef} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full flex-1 min-h-[380px] xl:min-h-[460px] relative cursor-pointer block"
        id="three-webgl-mount"
      />

      {/* Dynamic Watermark instructions overlay */}
      <div className="absolute top-4 left-4 pointer-events-none flex flex-col gap-1.5 p-3 rounded-xl bg-slate-950/70 backdrop-blur-md border border-slate-700/40" id="gl-watermark">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#94a3b8] flex items-center gap-1">
          <Layers className="w-3 h-3 text-[#38bdf8] animate-spin-slow" />
          WebGL 校园沙盘：石家庄铁道大学校区
        </span>
        <div className="flex items-center gap-2">
          <span className="font-serif text-xs italic text-amber-300 font-medium">{activeLandmarkName}</span>
          <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
            {cameraMode === "cinematic" ? "Cinematic巡航" : cameraMode === "first_person" ? "第一人称移动" : "三维阻尼轨"}
          </span>
        </div>
      </div>

      {/* Heavy On Screen Instructions overlay helper */}
      <div className="absolute top-4 right-4 pointer-events-none flex flex-col gap-1 text-[10px] text-right bg-slate-950/60 backdrop-blur-sm p-2 rounded-lg border border-slate-800" id="gl-hud">
        {cameraMode === "first_person" ? (
          <>
            <span className="text-yellow-400 font-semibold uppercase font-mono">操作指令</span>
            <span className="text-slate-300">W A S D / 方向键 移动</span>
            <span className="text-slate-300">鼠标点击并拖拽屏幕 环视视角</span>
          </>
        ) : cameraMode === "orbit" ? (
          <>
            <span className="text-yellow-400 font-semibold uppercase font-mono">绕轴鸟瞰</span>
            <span className="text-slate-300">按住鼠标拖拽 螺旋圆盘漫游</span>
          </>
        ) : (
          <>
            <span className="text-emerald-400 font-semibold uppercase font-mono">开场大片播案中</span>
            <span className="text-slate-300">自动环游。随时点击切换下方操作机位</span>
          </>
        )}
      </div>

      {/* Mobile-Friendly Virtual Keyboard Directional Controller Overlay (Only in First-Person Mode) */}
      {cameraMode === "first_person" && (
        <div className="absolute bottom-4 left-4 bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col items-center gap-1.5 shadow-2xl z-20" id="virtual-joy">
          <button 
            onMouseDown={() => pressVirtualJoy("w", true)} 
            onMouseUp={() => pressVirtualJoy("w", false)}
            onTouchStart={() => pressVirtualJoy("w", true)} 
            onTouchEnd={() => pressVirtualJoy("w", false)}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white flex items-center justify-center cursor-pointer"
            id="joy-w"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <div className="flex gap-1.5">
            <button 
              onMouseDown={() => pressVirtualJoy("a", true)} 
              onMouseUp={() => pressVirtualJoy("a", false)}
              onTouchStart={() => pressVirtualJoy("a", true)} 
              onTouchEnd={() => pressVirtualJoy("a", false)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white flex items-center justify-center cursor-pointer"
              id="joy-a"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button 
              onMouseDown={() => pressVirtualJoy("s", true)} 
              onMouseUp={() => pressVirtualJoy("s", false)}
              onTouchStart={() => pressVirtualJoy("s", true)} 
              onTouchEnd={() => pressVirtualJoy("s", false)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white flex items-center justify-center cursor-pointer"
              id="joy-s"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button 
              onMouseDown={() => pressVirtualJoy("d", true)} 
              onMouseUp={() => pressVirtualJoy("d", false)}
              onTouchStart={() => pressVirtualJoy("d", true)} 
              onTouchEnd={() => pressVirtualJoy("d", false)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white flex items-center justify-center cursor-pointer"
              id="joy-d"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <span className="font-mono text-[8px] text-slate-500 uppercase mt-0.5 tracking-wider">移动触轮</span>
        </div>
      )}

      {/* Dynamic Physical Sandbox Rigidity Controllers */}
      <div className="bg-slate-950/80 border-t border-slate-800 px-5 py-3.5 flex flex-col xl:flex-row items-center justify-between gap-4 z-10" id="gl-sandbox-control">
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto" id="sandbox-actions">
          <span className="text-[10px] font-mono uppercase text-[#e2e8f0] tracking-wider shrink-0 bg-amber-500/15 text-amber-300 px-2.5 py-1 rounded-sm flex items-center gap-1.5 border border-amber-500/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            重力与刚体测试 (物理碰撞)
          </span>

          <button
            onClick={() => {
              // Create randomized physical dropped cube
              const colors = ["#f43f5e", "#0ea5e9", "#eab308", "#a855f7", "#ec4899", "#10b981"];
              const randomColor = colors[Math.floor(Math.random() * colors.length)];
              const size = 3.5 + Math.random() * 5.0;
              const newCube: PhysicalCube = {
                id: "cube_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                x: -30 + Math.random() * 60, // random drop region
                y: 110 + Math.random() * 20, // high air
                z: -40 + Math.random() * 50,
                vx: -6.0 + Math.random() * 12.0,
                vy: 0,
                vz: -6.0 + Math.random() * 12.0,
                size,
                color: randomColor,
                grounded: false,
                angleX: Math.random() * Math.PI,
                angleY: Math.random() * Math.PI,
                angleZ: Math.random() * Math.PI,
              };
              onAddCube(newCube);
              audioEngine.playTriggerSound(220);
            }}
            className="flex items-center gap-1 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-mono text-[11px] font-semibold uppercase px-3 py-1.5 rounded-lg active:scale-95 transition-all outline-none border-none cursor-pointer"
            title="空中落下带有真实重力和碰撞检测的刚体箱"
            id="physics-drop-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            天空投掷刚体物件
          </button>

          {cubes.length > 0 && (
            <button
              onClick={onClearCubes}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] px-3 py-1.5 rounded-lg transition-all border border-slate-700 cursor-pointer"
              id="physics-clear-btn"
            >
              <Trash2 className="w-3.5 h-3.5" />
              重置
            </button>
          )}

          {/* Unity compatible GLB model exporter */}
          <button
            onClick={exportToUnityGLB}
            disabled={isExporting}
            className={`flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase px-3 py-1.5 rounded-lg active:scale-95 transition-all outline-none border-none cursor-pointer ${
              isExporting 
                ? "bg-slate-700 text-slate-400 cursor-not-allowed animate-pulse" 
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
            title="将整个铁道大学 3D 校园场景打包并下载为 Unity 和团结引擎原生支持的标准的 3D GLB 格式文件"
            id="unity-export-btn"
          >
            <Download className="w-3.5 h-3.5 animate-bounce" />
            {isExporting ? "正在生成 Unity GLB 文件..." : "导出 Unity 3D 资源 (.GLB)"}
          </button>

          <button
            onClick={() => { setShowUnityGuide(!showUnityGuide); audioEngine.playSwitchSound(); }}
            className={`flex items-center gap-1.5 font-mono text-[11px] border px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              showUnityGuide
                ? "bg-amber-500/10 border-amber-500 text-amber-400 font-semibold"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
            }`}
            title="查看如何在 Unity / 团结引擎中打开并配置导出的 3D 模型的保姆级教程"
            id="unity-help-btn"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Unity 导入说明
          </button>
        </div>

        {/* Counter of landed entities */}
        <div className="text-[10px] font-mono text-slate-400 text-right w-full xl:w-auto" id="sandbox-counters">
          活跃刚体数: <span className="text-white font-semibold">{cubes.length}</span> / 落地阻尼吸收率: <span className="text-emerald-400">85%</span>
        </div>
      </div>

      {/* Unity & Tuanjie Engine Integration Guide Modal */}
      {showUnityGuide && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-fadeIn" id="unity-guide-overlay">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative flex flex-col gap-4 max-h-[90%] overflow-y-auto">
            {/* Close button */}
            <button
              onClick={() => { setShowUnityGuide(false); audioEngine.playSwitchSound(); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-all active:scale-90 border-none"
              id="close-guide-btn"
            >
              &times;
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-1">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div className="text-left">
                <h3 className="font-serif text-lg font-bold text-white tracking-wide">
                  Unity / 团结引擎 导入使用指南 🚀
                </h3>
                <p className="font-mono text-[9px] uppercase text-slate-400 tracking-wider">
                  Universal 3D Asset Import Guide
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 text-xs leading-relaxed text-slate-300 text-left">
              <p className="font-serif italic text-[#38bdf8]">
                “我们已经将校园里所有高精度的 PBR 建筑物（主楼、穹顶图书馆、詹天佑纪念馆、列车、铁轨等）以及您扔下的任意刚体打包为了通用的 3D .GLB (GLTF) 文件，您可以直接带入任何现代游戏引擎中！”
              </p>

              <div className="flex flex-col gap-2.5 mt-2 bg-slate-950 p-4 rounded-xl border border-slate-800/80 font-serif">
                <div className="flex gap-2.5 items-start">
                  <span className="font-mono text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded shrink-0">1</span>
                  <span><strong>拖入项目：</strong> 将下载完的 <code className="text-amber-300 font-mono text-[11px] bg-slate-900 px-1 py-0.5 rounded">Tiedao_University_Campus_3D_Scene.glb</code> 文件直接拖入 Unity/团结引擎的 <code className="text-slate-300 font-mono">Assets</code> 资源面板中。</span>
                </div>
                
                <div className="flex gap-2.5 items-start border-t border-slate-800/50 pt-2.5">
                  <span className="font-mono text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded shrink-0">2</span>
                  <span className="text-left"><strong>启用 GLTF 支持 （推荐）：</strong> Unity 默认支持部分 FBX，若要完全展示精致的法线 (Normal)、散射/漫反射和金属度着色，推荐在 Unity Package Manager 中通过 Git URL 给项目安装官方支持的包：
                  <code className="block mt-1 font-mono text-[10px] bg-slate-900 text-emerald-400 p-2 rounded break-all select-all">https://github.com/atteneder/glTFast.git</code>
                  </span>
                </div>

                <div className="flex gap-2.5 items-start border-t border-slate-800/50 pt-2.5">
                  <span className="font-mono text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded shrink-0">3</span>
                  <span><strong>拖入场景：</strong> 在 Assets 中将该模型直接拖拽至您的场景 Hierarchy 树图中。即可立即作为原生 GameObject 运行！</span>
                </div>

                <div className="flex gap-2.5 items-start border-t border-slate-800/50 pt-2.5">
                  <span className="font-mono text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded shrink-0">4</span>
                  <span><strong>调整光照材质：</strong> 导入后，双击模型即可查看层级。如果要修改特定物体的砖面或瓦面反光，直接右键对应 Unity Material 选择属性，修改其 Metallic / Roughness、以及对应的 Tiling 即可获得与本页 100% 同比例的 PBR 光影效果！</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-1">
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                ⭐ 铁大 3D 景观 · 精确网格导出完成
              </span>
              <button
                onClick={() => { setShowUnityGuide(false); audioEngine.playSwitchSound(); }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] font-bold px-4 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer border-none outline-none"
                id="ack-guide-btn"
              >
                好的，我知道了
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
