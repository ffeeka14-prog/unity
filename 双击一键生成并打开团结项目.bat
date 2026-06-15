@echo off
chcp 65001 >nul
title 3D 铁道大学 3D 团结项目一键后台生成管理器
color 0b

echo ========================================================================
echo         石大/铁大 3D 校园 Unity / 团结引擎项目离线生成系统
echo ========================================================================
echo.
echo 检测到您在本地运行，本脚本将全自动在本地目录下组建一键搭建的团结引擎环境
echo 无需网络，无需科学上网 (梯子)，离线渲染并带有 C# 高级几何建模算法！
echo.
echo 正在执行 Node.js 生成程序，请稍候...
echo.

node generate-unity-project.js

if %errorlevel% neq 0 (
    echo.
    echo [错误] 生成失败。请确保您已在本级系统安装了 Node.js 并且能够正常运行 "node" 指令。
    echo 假如没有安装，可在本地控制台直接查看 "generate-unity-project.js" 手动创建对应文件夹和文件。
) else (
    echo.
    echo ========================================================================
    echo  大功告成！项目已就绪！
    echo ========================================================================
    echo  现在您可以关闭此窗口，并在【团结Hub】中导入 "/TiedaoCampusUnityProject" 文件夹。
    echo  如果有任何不懂的地方，可以阅读生成的 "TiedaoCampusUnityProject/README.txt"。
)
echo.
pause
