/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Campus3DViewer from "./components/Campus3DViewer";
import { LANDMARKS, Landmark, PhysicalCube } from "./types";
import { UNITY_TEMPLATES, TUANJIE_GUIDE_CHINESE } from "./utils/UnityCodeTemplates";
import { audioEngine } from "./utils/AudioEngine";
import { 
  Compass, Lightbulb, ClipboardCopy, CheckCircle, 
  BookOpen, Code2, Award, Download, Cpu, 
  Volume2, VolumeX, Eye, Landmark as BankIcon, Info,
  Sun, Moon, Sparkles
} from "lucide-react";

export default function App() {
  // Lighting and rendering parameters
  const [cameraMode, setCameraMode] = useState<"cinematic" | "orbit" | "first_person" | "ortho">("cinematic");
  const [timeOfDay, setTimeOfDay] = useState<"day" | "sunset" | "night">("day");
  const [fresnelPower, setFresnelPower] = useState<number>(3.0);
  
  // UI Selection parameters
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark>(LANDMARKS[1]); // Default to Main Classroom Building
  const [activeTab, setActiveTab] = useState<"guide" | "code">("guide");
  const [activeTemplateIdx, setActiveTemplateIdx] = useState<number>(0);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // PBR and Detail Map parameters
  const [detailIntensity, setDetailIntensity] = useState<number>(1.0);
  const [normalIntensity, setNormalIntensity] = useState<number>(1.0);
  const [pbrDebugMode, setPbrDebugMode] = useState<"standard" | "albedo" | "normal" | "roughness" | "metalness">("standard");
  const [showPbrSettings, setShowPbrSettings] = useState<boolean>(false);

  // Dynamic physical cubes spawned from sky
  const [cubes, setCubes] = useState<PhysicalCube[]>([]);

  // Synchronize Mute status
  useEffect(() => {
    audioEngine.setMute(soundMuted);
  }, [soundMuted]);

  const handleLandmarkSelected = (landmark: Landmark) => {
    setSelectedLandmark(landmark);
  };

  const handleAddCube = (newCube: PhysicalCube) => {
    setCubes((prev) => [...prev, newCube]);
  };

  const handleClearCubes = () => {
    setCubes([]);
    audioEngine.playTriggerSound(150);
  };

  const toggleMute = () => {
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    audioEngine.setMute(nextMuted);
  };

  const handleCopyCode = (code: string, filename: string) => {
    navigator.clipboard.writeText(code);
    setCopySuccess(filename);
    setTimeout(() => {
      setCopySuccess(null);
    }, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between py-6 px-4 md:px-8 max-w-7xl mx-auto font-sans" id="unity-builder-root">
      
      {/* 1. APP HEADER */}
      <header className="flex flex-col md:flex-row items-stretch md:items-center justify-between border-b border-slate-200/60 pb-5 mb-5 gap-4" id="app-header">
        <div id="branding-panel">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            <span className="font-mono text-[10px] bg-red-600/10 text-red-600 border border-red-500/15 uppercase px-2 py-0.5 rounded-sm font-semibold tracking-wider">
              中国联名 · 团结引擎版适配可用
            </span>
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mt-1">
            石大铁大 3D Unity / 团结引擎交互设计中心
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-serif italic mt-0.5">
            Shijiazhuang Tiedao University 3D Interactive Project Workshop / Assignment Companion
          </p>
        </div>

        {/* Global toggles (mute, platform status) */}
        <div className="flex items-center gap-3 self-center md:self-auto" id="app-header-controls">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200/40 text-[11px] font-mono" id="app-status">
            <Cpu className="w-3.5 h-3.5 text-blue-600 animate-spin-slow" />
            <span className="text-slate-500 uppercase">团结引擎:</span>
            <span className="text-emerald-600 font-bold">已就绪 C#</span>
          </div>

          <button
            onClick={toggleMute}
            className={`p-2 rounded-xl border transition-all active:scale-95 flex items-center justify-center ${
              soundMuted
                ? "bg-red-50 border-red-200 text-red-500"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            title={soundMuted ? "解禁音频反馈" : "静音环境音频"}
            id="mute-switcher"
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 2. MAIN GRID GRID SYSTEM */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch" id="app-main-grid">
        
        {/* Left Column (8 cols): Large Interactive WebGL 3D Preview Panel and sliders */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4 h-full" id="left-sandbox-column">
          
          <div className="flex-1 flex flex-col" id="viewer-container-wrapper">
            <Campus3DViewer
              cameraMode={cameraMode}
              timeOfDay={timeOfDay}
              fresnelPower={fresnelPower}
              onLandmarkSelected={handleLandmarkSelected}
              cubes={cubes}
              onAddCube={handleAddCube}
              onClearCubes={handleClearCubes}
              detailIntensity={detailIntensity}
              normalIntensity={normalIntensity}
              pbrDebugMode={pbrDebugMode}
              selectedLandmarkId={selectedLandmark.id}
            />
          </div>

          {/* Core Interactive Parameter deck */}
          <div className="bg-white/50 border border-slate-200/50 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm" id="renderer-dashboard">
            {/* Camera Multi-Modes Selector */}
            <div className="flex flex-col gap-1" id="camera-switcher-deck">
              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest block font-bold mb-1">
                🎥 1. 视轨摄影机机位切换 (Camera Multi-Views)
              </span>
              <div className="flex bg-slate-200/40 p-1 rounded-xl border border-slate-200/60" id="cam-button-group">
                <button
                  onClick={() => { setCameraMode("cinematic"); audioEngine.playSwitchSound(); }}
                  className={`px-3 py-1.5 text-[11px] font-mono rounded-lg transition-all ${
                    cameraMode === "cinematic"
                      ? "bg-slate-800 text-amber-50 shadow-xs font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  id="btn-cam-cinematic"
                >
                  环湖巡航 (自动)
                </button>
                <button
                  onClick={() => { setCameraMode("orbit"); audioEngine.playSwitchSound(); }}
                  className={`px-3 py-1.5 text-[11px] font-mono rounded-lg transition-all ${
                    cameraMode === "orbit"
                      ? "bg-slate-800 text-amber-50 shadow-xs font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  id="btn-cam-orbit"
                >
                  绕主楼鸟瞰 (拖拽)
                </button>
                <button
                  onClick={() => { setCameraMode("first_person"); audioEngine.playSwitchSound(); }}
                  className={`px-3 py-1.5 text-[11px] font-mono rounded-lg transition-all ${
                    cameraMode === "first_person"
                      ? "bg-slate-800 text-amber-50 shadow-xs font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  id="btn-cam-fp"
                >
                  第一人称 (漫游)
                </button>
              </div>
            </div>

            {/* Time of Day Cycle */}
            <div className="flex flex-col gap-1" id="tod-deck">
              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest block font-bold mb-1">
                ☀️ 2. 环境氛围光影与阴影 (Solar Direction)
              </span>
              <div className="flex bg-slate-200/40 p-1 rounded-xl border border-slate-200/60" id="tod-button-group">
                <button
                  onClick={() => { setTimeOfDay("day"); audioEngine.playTriggerSound(330); }}
                  className={`p-1.5 text-[11px] font-mono rounded-lg transition-all flex items-center gap-1.5 ${
                    timeOfDay === "day"
                      ? "bg-slate-800 text-amber-50 shadow-xs font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  id="btn-tod-day"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  午后日光
                </button>
                <button
                  onClick={() => { setTimeOfDay("sunset"); audioEngine.playTriggerSound(261); }}
                  className={`p-1.5 text-[11px] font-mono rounded-lg transition-all flex items-center gap-1.5 ${
                    timeOfDay === "sunset"
                      ? "bg-slate-800 text-amber-50 shadow-xs font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  id="btn-tod-sunset"
                >
                  <Sun className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                  晚霞夕阳
                </button>
                <button
                  onClick={() => { setTimeOfDay("night"); audioEngine.playTriggerSound(196); }}
                  className={`p-1.5 text-[11px] font-mono rounded-lg transition-all flex items-center gap-1.5 ${
                    timeOfDay === "night"
                      ? "bg-slate-800 text-amber-50 shadow-xs font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  id="btn-tod-night"
                >
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  宁静月夜
                </button>
              </div>
            </div>

            {/* Custom Fresnel Coefficient Parameter controller */}
            <div className="flex flex-col gap-1 flex-1 max-w-[200px]" id="fresnel-slider-deck">
              <div className="flex justify-between font-mono text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">
                <span>🌊 3. 菲涅尔次幂因子</span>
                <span className="text-blue-500">{fresnelPower.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={fresnelPower}
                onChange={(e) => setFresnelPower(parseFloat(e.target.value))}
                className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer transition-all"
                id="fresnel-coeff-range"
              />
            </div>
          </div>

          {/* Selected Landmark properties (Double score mapping info) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-100 flex flex-col gap-4 shadow-xl transition-all" id="building-info-drawer">
            <div className="flex gap-4 items-start">
              <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 mt-1 shrink-0">
                <BankIcon className="w-6 h-6 text-yellow-500 animate-pulse" />
              </div>

              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800 pb-2 mb-2">
                  <div id="landmark-subheadings">
                    <h3 className="font-serif text-base font-bold text-white tracking-wide">
                      铁大著名景观：{selectedLandmark.name}
                    </h3>
                    <span className="font-mono text-[9px] uppercase text-emerald-400 tracking-widest">
                      {selectedLandmark.englishName}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wide block">3D 材质风格表现</span>
                    <span className="font-serif text-xs italic text-amber-300 font-semibold">{selectedLandmark.architectureStyle}</span>
                  </div>
                </div>
                <p className="font-serif text-xs text-slate-300 leading-relaxed italic">
                  "{selectedLandmark.description}"
                </p>
              </div>
            </div>

            {/* PBR Settings Toggle button & Config Panel */}
            <div className="border-t border-slate-800/80 pt-3 mt-1 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setShowPbrSettings(!showPbrSettings); audioEngine.playSwitchSound(); }}
                  className={`flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-all active:scale-95 text-xs ${
                    showPbrSettings
                      ? "bg-amber-500/10 border-amber-500 text-amber-400 font-bold animate-pulse"
                      : "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:text-white"
                  }`}
                  id="pbr-toggle-btn"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  {showPbrSettings ? "折叠材质与PBR调试器" : "展开材质与PBR调试 panel ⚙️"}
                </button>
                {pbrDebugMode !== "standard" && (
                  <span className="font-mono text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded animate-pulse">
                    PBR DEBUG: {pbrDebugMode.toUpperCase()} ACTIVE
                  </span>
                )}
              </div>

              {showPbrSettings && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-4 animate-fadeIn" id="pbr-settings-panel">
                  {/* Slider for Detail Map Intensity */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between font-mono text-[10px] text-slate-400 uppercase tracking-wide">
                      <span className="font-semibold text-slate-300">🧱 Detail Map (细节纹理) 叠加强度</span>
                      <span className="font-bold text-amber-400">{detailIntensity.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="2.0"
                      step="0.05"
                      value={detailIntensity}
                      onChange={(e) => setDetailIntensity(parseFloat(e.target.value))}
                      className="w-full accent-amber-500 h-1 bg-slate-800 rounded-lg cursor-pointer transition-all"
                      id="detail-intensity-range"
                    />
                    <div className="flex justify-between text-[8px] font-mono text-slate-500">
                      <span>0.0 (极致光滑)</span>
                      <span>1.0 (标准细节贴图)</span>
                      <span>2.0 (重砂砾/高细节微孔)</span>
                    </div>
                  </div>

                  {/* Slider for Normal Map Intensity */}
                  <div className="flex flex-col gap-1.5 border-t border-slate-900 pt-3">
                    <div className="flex justify-between font-mono text-[10px] text-slate-400 uppercase tracking-wide">
                      <span className="font-semibold text-slate-300">📐 Normal Map (法线贴图) 凸起强度</span>
                      <span className="font-bold text-amber-400">{normalIntensity.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="3.0"
                      step="0.05"
                      value={normalIntensity}
                      onChange={(e) => setNormalIntensity(parseFloat(e.target.value))}
                      className="w-full accent-amber-500 h-1 bg-slate-800 rounded-lg cursor-pointer transition-all"
                      id="normal-intensity-range"
                    />
                    <div className="flex justify-between text-[8px] font-mono text-slate-500">
                      <span>0.0 (平滑表面)</span>
                      <span>1.0 (标准砌体立体度)</span>
                      <span>3.0 (生动浮雕/超 realistic 凹凸)</span>
                    </div>
                  </div>

                  {/* PBR Material Debug visualizer choices */}
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wide font-semibold">
                      🔍 PBR 材质贴图像素级通道可视化 (PBR Material Channels Viewer)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mt-1.5" id="pbr-debug-mode-group">
                      {(["standard", "albedo", "normal", "roughness", "metalness"] as const).map((mode) => {
                        const modeLabels: Record<string, string> = {
                          standard: "默认 PBR",
                          albedo: "反射率 (Albedo)",
                          normal: "法线 (Normal)",
                          roughness: "粗糙 (Rough)",
                          metalness: "金属 (Metal)",
                        };
                        return (
                          <button
                            key={mode}
                            onClick={() => { setPbrDebugMode(mode); audioEngine.playSwitchSound(); }}
                            className={`px-2 py-1.5 text-[10px] font-mono font-medium rounded transition-all active:scale-95 text-center ${
                              pbrDebugMode === mode
                                ? "bg-amber-500 text-slate-950 font-bold shadow-md"
                                : "bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/40"
                            }`}
                            id={`btn-pbr-debug-${mode}`}
                          >
                            {modeLabels[mode]}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[9px] text-slate-500 italic mt-2 font-serif">
                      提示：选择 PBR 通道可实时剖析“{selectedLandmark.name}”的局部光线反应模型。在法线模式下可查看表面切线，阻尼感更出众。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column (4 cols): Implementation Guide & Code Base repository download */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4 h-full" id="right-docs-column">
          
          {/* Main Doc/Code Switcher Tabs */}
          <div className="flex bg-slate-200/40 p-1 rounded-xl border border-slate-200/60" id="docs-top-tab-deck">
            <button
              onClick={() => { setActiveTab("guide"); audioEngine.playTriggerSound(330); }}
              className={`flex-1 text-center py-2.5 text-xs font-mono uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "guide"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              id="tab-guide-btn"
            >
              <BookOpen className="w-4 h-4" />
              📚 场景搭建与开发指南
            </button>
            <button
              onClick={() => { setActiveTab("code"); audioEngine.playTriggerSound(392); }}
              className={`flex-1 text-center py-2.5 text-xs font-mono uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "code"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              id="tab-code-btn"
            >
              <Code2 className="w-4 h-4" />
              💻 核心 C# 源码集包
            </button>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-2xl shadow-md p-5" id="right-scrollable-port">
            
            {activeTab === "guide" ? (
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4" style={{ maxHeight: "580px" }} id="scoresheet-documentation">
                
                {/* Visual features indicator */}
                <div className="bg-[#f0f9ff] border border-[#e0f2fe] p-3.5 rounded-xl flex items-start gap-2.5" id="assignment-score-banner">
                  <Sparkles className="w-5 h-5 text-blue-500 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-sans font-bold text-blue-800 uppercase tracking-wider">
                      石家庄铁道大学 3D 虚拟沙盘设计与环境渲染
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 font-serif leading-relaxed italic">
                      本平台整合高精度参数化建模、菲涅起回光折射微波模拟、动态车厢轨道系统以及多模式摄像机漫游算法，表现校园的物理复构重组。
                    </p>
                  </div>
                </div>

                {/* Highly readable accordion features items */}
                <div className="flex flex-col gap-3" id="grading-bullet-list">
                  
                  <div className="p-3 border border-slate-200/70 rounded-xl hover:border-blue-300 transition-all bg-slate-50/50" id="grading-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-sky-500" />
                      <span className="font-mono text-xs font-bold text-slate-700">1. 参数化微积分建模 (Procedural Geometry)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-serif pl-6">
                      一号教学主楼、高线图书馆、詹天佑铜像均采用精确参数化重构，展现对称式经典俄式列柱立面与饱满的钢网架穹顶结构。
                    </p>
                  </div>

                  <div className="p-3 border border-slate-200/70 rounded-xl hover:border-blue-300 transition-all bg-slate-50/50" id="grading-2">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-sky-500" />
                      <span className="font-mono text-xs font-bold text-slate-700">2. 智能飞手航批与摄影 (Multi-Camera Navigation)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-serif pl-6">
                      支持无人机环线自适应巡航（巡航模式）、绕詹天佑铜像三维多轴推拉缩放审视（鸟瞰模式）以及键盘/鼠标第一人称真物理漫游。
                    </p>
                  </div>

                  <div className="p-3 border border-slate-200/70 rounded-xl hover:border-blue-300 transition-all bg-slate-50/50" id="grading-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-sky-500" />
                      <span className="font-mono text-xs font-bold text-slate-700">3. 翠屏湖高级菲涅尔折射 (Fresnel Reflection Shader)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-serif pl-6">
                      运用高级菲涅尔着色公式模拟天然水体折射偏角，在倾角边缘透明见底，在深水区大角度面完全反射天空、云彩与日光高光。
                    </p>
                  </div>

                  <div className="p-3 border border-slate-200/70 rounded-xl hover:border-blue-300 transition-all bg-slate-50/50" id="grading-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-sky-500" />
                      <span className="font-mono text-xs font-bold text-slate-700">4. 环形铁轨与火车 chugging 行驶 (Railway System)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-serif pl-6">
                      基于三次B样条轨道几何体，模拟 chugging 动态蒸汽车厢循着 135 米固定曲率的铁路行进，轮滑车轴、车头蒸汽物理共振。
                    </p>
                  </div>

                  <div className="p-3 border border-slate-200/70 rounded-xl hover:border-blue-300 transition-all bg-slate-50/50" id="grading-5">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-sky-500" />
                      <span className="font-mono text-xs font-bold text-slate-700">5. 掉落重力堆栈物理仿真 (Physics Sandbox)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-serif pl-6">
                      提供快捷点击天空抛洒刚体方块，物理系统提供真实自由落体、倾角弹动反馈、弹性阻尼及阻界，严防任何穿墙或沉降 BUG。
                    </p>
                  </div>

                </div>

                {/* Subheading of step by step guide */}
                <div className="border-t border-slate-100 pt-3" id="procedural-setup-steps">
                  <h4 className="font-serif text-sm font-bold text-slate-800 mb-2">国内版本团结引擎项目部署流程</h4>
                  <ul className="text-[11px] text-slate-600 font-serif leading-relaxed italic space-y-1.5 list-disc pl-4" id="guide-steps-list">
                    <li>第一步：启动国内版“团结引擎”，创建 Universal 3D 渲染管线（URP）项目模板。</li>
                    <li>第二步：将 3ds Max 导出的带纹理校园主体 FBX 模型放入 Assets 资源窗口中，在 Model 的 Inspector 栏中钩上 Generate Colliders 特性。</li>
                    <li>第三步：新建翠屏湖平面，配合右窗 C# 代码 Tab 下的专属菲涅尔渲染着色器 (FresnelWater.shader) 进行材质表现。</li>
                    <li>第四步：在场景里顺次创建脚本，将一键复制的代码存入并予以组件化关联，便可轻松实现摄像机多机位平滑切换！</li>
                  </ul>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0" id="csharp-source-port">
                
                {/* Script selectors */}
                <div className="grid grid-cols-2 gap-1.5 mb-3.5" id="template-pill-switcher">
                  {UNITY_TEMPLATES.map((tpl, idx) => (
                    <button
                      key={tpl.filename}
                      onClick={() => { setActiveTemplateIdx(idx); audioEngine.playTriggerSound(440); }}
                      className={`text-[10px] font-mono p-2 py-1.5 border rounded-lg text-left transition-all flex flex-col justify-between ${
                        activeTemplateIdx === idx
                          ? "bg-slate-800 border-slate-800 text-amber-50"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50/70"
                      }`}
                      id={`csharp-script-btn-${idx}`}
                    >
                      <span className="font-bold block truncate">{tpl.name}</span>
                      <span className="text-[8px] opacity-60 font-medium block truncate mt-0.5">{tpl.filename}</span>
                    </button>
                  ))}
                </div>

                {/* Current script file properties */}
                <div className="flex-1 flex flex-col min-h-0 border border-slate-200 rounded-xl overflow-hidden p-3 bg-slate-50" id="selected-script-viewer">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 mb-2" id="script-viewport-header">
                    <div id="csharp-inner-meta">
                      <span className="text-[10px] font-mono text-slate-400 block font-bold">C# 脚本文件名:</span>
                      <span className="text-xs font-mono font-bold text-slate-700">{UNITY_TEMPLATES[activeTemplateIdx].filename}</span>
                    </div>
                    
                    <button
                      onClick={() => handleCopyCode(UNITY_TEMPLATES[activeTemplateIdx].code, UNITY_TEMPLATES[activeTemplateIdx].filename)}
                      className={`flex items-center gap-1 text-[10px] font-mono uppercase bg-slate-900 border-none outline-none text-[#fffbeb] px-2.5 py-1.5 rounded active:scale-95 transition-all text-white font-semibold cursor-pointer`}
                      id="csharp-copy-btn"
                    >
                      <ClipboardCopy className="w-3 h-3 text-emerald-400" />
                      {copySuccess === UNITY_TEMPLATES[activeTemplateIdx].filename ? "已成功复制！" : "复制源码"}
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-500 font-serif leading-relaxed italic mb-2 shrink-0 bg-white p-2 rounded border border-slate-200/50">
                    {UNITY_TEMPLATES[activeTemplateIdx].description}
                  </p>

                  {/* C# Scrollable Viewer Code portal */}
                  <div className="flex-1 overflow-auto bg-slate-900 rounded-lg p-3.5 shadow-inner" id="csharp-code-screen">
                    <pre className="text-[10px] font-mono text-emerald-400 leading-relaxed font-medium">
                      {UNITY_TEMPLATES[activeTemplateIdx].code}
                    </pre>
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>

      </main>

      {/* 3. ADDITIONAL ADAPTER BANNER (Showing support info for domestic Unity: 团结引擎) */}
      <footer className="mt-8 border-t border-slate-200/60 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[9px] uppercase tracking-widest text-slate-400" id="app-footer">
        <span className="flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-blue-500" />
          © 2026 石家庄铁道大学 * 3D 虚拟校园交互设计展台
        </span>
        <div className="flex items-center gap-4" id="footer-status-deck">
          <span>WebGL仿真沙盘: 100% 阻尼插值流畅</span>
          <span>文件体量: Tuanjie Package 精简优化</span>
        </div>
      </footer>

    </div>
  );
}
