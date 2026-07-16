@echo off
chcp 65001 >nul
cd /d "C:\Users\Administrator\CodeBuddy\20260402085532"
echo ============================================
echo    三国立绘重新生成 - 剩余7个角色
echo    (zuoci shuijing captain yellow_turban
echo     xiliang_soldier deputy_general boss)
echo ============================================
echo.
echo 每个角色约需 2-5 分钟，全部完成约需 15-30 分钟
echo 请勿关闭此窗口！
echo.

set BUDDY_CLOUD_TOKEN=eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJteWZFenA3ODNLaV9KQ3g4Vm5jM1hfaXg2alpyYjZDZjVPTWtHWk1QSTNzIn0.eyJleHAiOjE4MDY2MzgyNTQsImlhdCI6MTc4NDIxMTE2NCwiYXV0aF90aW1lIjoxNzc1MTAyMjUzLCJqdGkiOiI5Nzg5ZDAwZC1iMzczLTQ4ODUtYWE0Mi05YjAwNjdlOWVmNzUiLCJpc3MiOiJodHRwczovL3d3dy5jb2RlYnVkZHkuY24vYXV0aC9yZWFsbXMvY29waWxvdCIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiIwOTk2MTM3MS0xNzI0LTRhYWUtYWZjZC1iNTMzMWNkMzY2YjEiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJjb25zb2xlIiwic2lkIjoiN2MxMTE1NzQtOTIyNi00ZTFhLWJmN2EtZjA5YjE3OWQwNTNjIiwiYWNyIjoiMCIsImFsbG93ZWQtb3JpZ2lucyI6WyIqIl0sInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJkZWZhdWx0LXJvbGVzIiwib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgb2ZmbGluZV9hY2Nlc3MgZW1haWwiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsIm5pY2tuYW1lIjoi6bi95a2QIiwicHJlZmVycmVkX3VzZXJuYW1lIjoiMTgwNjUxNjU0MzQifQ.pflAgt8j0Dj9kz0f_gQ-qj7Cy0wuDjO2SZyclmK5p0FaxaJb7g4ntHyYdQ_em1Z-63viuhwaOac26aU1vYgojUhjWh99uemmV30UsSsyP6py0wbrIkJATm8PE9MAnFq66m3Pkvvrzg8EI3_gd_b-vQoXREuvzkEC26_26TfmrMUZOTP7jqbBIENXMm4i3ZHaSFIfEvLUz4zT6WEWEbaMxWz3xtqYxypyQ42afpaPXi7gw0_8BKkLyXo28EZvN-tovux24q4_PuHKQSBc1QoLkHmsEo8xTbOjVzpo6izmh2W2yizxxe0-pgqa52YSVkVXB74Fn_iTxz5TQ0dkOK-dGg

python regenerate_portraits.py --start 4 --end 11 --force

echo.
echo ============================================
echo   全部完成！按任意键关闭...
echo ============================================
pause >nul
