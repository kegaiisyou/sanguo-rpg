@echo off
chcp 65001 >nul
echo ========================================
echo     三国江湖 RPG - 一键部署+备份
echo ========================================
echo.

cd /d "%~dp0"

:: 检查文件
if not exist "index.html" (
    echo [错误] index.html 不存在！
    pause
    exit
)

:: 创建备份目录
if not exist "backup" mkdir backup

:: 显示当前版本
findstr /C:"版本" index.html | findstr /C:"版本 1"
echo.

:: 获取版本号
set /p version="请输入新版本号（如 v1.4.0）: "
if "%version%"=="" set version=v1.4.0

:: 备份文件
echo [备份] 正在备份当前版本...
copy index.html "backup\%version%_index.html"
copy VERSION_MANAGEMENT.md "backup\%version%_VERSION.md" 2>nul

echo [备份] 完成：backup\%version%_index.html
echo.

:: 更新 VERSION_MANAGEMENT.md
echo [更新] 更新版本记录...
echo. >> VERSION_MANAGEMENT.md
echo ## %version% - %date% >> VERSION_MANAGEMENT.md
echo. >> VERSION_MANAGEMENT.md
echo ### 更新内容 >> VERSION_MANAGEMENT.md
set /p content="输入更新内容描述: "
echo - %content% >> VERSION_MANAGEMENT.md
echo. >> VERSION_MANAGEMENT.md
echo ### 备份文件 >> VERSION_MANAGEMENT.md
echo - `backup/%version%_index.html` >> VERSION_MANAGEMENT.md
echo. >> VERSION_MANAGEMENT.md

:: 添加文件到 Git
echo [Git] 添加文件...
git add index.html VERSION_MANAGEMENT.md
git add backup\%version%_index.html 2>nul
git add backup\%version%_VERSION.md 2>nul

:: 提交
echo.
echo [Git] 提交更改...
git commit -m "%version%: %content%"

:: 推送到 GitHub
echo.
echo [Git] 推送到 GitHub...
git push origin main

echo.
echo ========================================
echo     部署完成！
echo ========================================
echo.
echo 游戏地址: https://kegaiisyou.github.io/sanguo-rpg/
echo 备份文件: backup\%version%_index.html
echo 版本记录: VERSION_MANAGEMENT.md
echo.
echo 请等待 1-2 分钟后在手机浏览器刷新测试
pause