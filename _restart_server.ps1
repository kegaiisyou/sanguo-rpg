# 启动/重启 serve_nocache.py（系统 python 3.14），用于本地测试
$ErrorActionPreference = 'Stop'
$port = 8124
# 杀占用端口的旧进程
$conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
  try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
}
Start-Sleep -Milliseconds 800
$py = 'C:\Users\Administrator\AppData\Local\Python\pythoncore-3.14-64\python.exe'
$p = Start-Process -FilePath $py -ArgumentList 'C:\Users\Administrator\CodeBuddy\20260402085532\serve_nocache.py' -PassThru -WindowStyle Hidden
Start-Sleep -Milliseconds 1500
Write-Output ("PID=" + $p.Id)
# 验证端口
$chk = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($chk) { Write-Output ("LISTEN ok pid=" + $chk.OwningProcess) } else { Write-Output "LISTEN FAIL" }
