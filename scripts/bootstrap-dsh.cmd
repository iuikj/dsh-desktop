@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo [DSH] 未检测到 Node.js，跳过自动安装。请先安装 Node.js（含 npm）。
  exit /b 2
)
node "%~dp0bootstrap-dsh.js" %*
exit /b %errorlevel%
