@echo off
echo ===== 三国江湖 RPG 自动部署脚本 =====
echo.

REM 设置 Git 路径
set PATH=%PATH%;C:\Program Files\Git\cmd

REM 进入项目目录
cd /d "%~dp0"

echo 正在添加文件...
git add .

echo 正在提交更改...
set /p msg="输入更新说明: "
if "%msg%"=="" set msg=更新游戏内容

git commit -m "%msg%"

echo 正在推送到 GitHub...
git push origin main

echo.
echo ===== 部署完成！=====
echo 访问地址: https://kegallyou.github.io/sanguo-rpg/
pause
