@echo off
chcp 65001 >nul
echo ===== 三国江湖 RPG 一键部署 =====
echo.

cd /d "%~dp0"

:: 检查文件
if not exist "index.html" (
    echo [错误] index.html 不存在！
    pause
    exit
)

:: 只提交 index.html
git add index.html
git status

:: 提交
echo.
set /p msg="输入更新说明（直接回车跳过）: "
if "%msg%"=="" set msg=更新游戏内容

git commit -m "%msg%"
git push -u origin main

echo.
echo ===== 部署完成！=====
echo 游戏地址: https://kegaiisyou.github.io/sanguo-rpg/
echo.
echo 手机测试：手机浏览器打开上述网址
pause