# 三国江湖 RPG - 简单部署脚本
# 用法: 右键点击此文件 → 使用 PowerShell 运行

Write-Host "===== 三国江湖 RPG 部署脚本 =====" -ForegroundColor Green
Write-Host ""

# 检查 index.html 是否存在
if (-not (Test-Path "index.html")) {
    Write-Host "错误: index.html 文件不存在!" -ForegroundColor Red
    pause
    exit
}

Write-Host "文件检查通过，准备部署..." -ForegroundColor Yellow
Write-Host ""
Write-Host "请按以下步骤操作:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 打开浏览器访问: https://github.com/kegallyou/sanguo-rpg" -ForegroundColor White
Write-Host "2. 点击 'uploading an existing file'" -ForegroundColor White
Write-Host "3. 拖拽 index.html 到上传区域" -ForegroundColor White
Write-Host "4. 点击 'Commit changes'" -ForegroundColor White
Write-Host "5. 然后点击 Settings → Pages" -ForegroundColor White
Write-Host "6. Source 选择 'Deploy from a branch'" -ForegroundColor White
Write-Host "7. Branch 选择 'main' / 'root'" -ForegroundColor White
Write-Host "8. 点击 Save" -ForegroundColor White
Write-Host ""
Write-Host "等待 2-3 分钟后访问: https://kegallyou.github.io/sanguo-rpg/" -ForegroundColor Green
Write-Host ""

# 打开浏览器
Start-Process "https://github.com/kegallyou/sanguo-rpg"

pause
