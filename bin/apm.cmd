@echo off
setlocal enabledelayedexpansion

:: Try to find git.exe in path
for /f "tokens=*" %%G in ('where git 2^>nul') do set "apm_git_path=%%~dpG"
if not defined apm_git_path (
  :: Try to find git.exe in GitHub Desktop, oldest first so we end with newest
  for /f "tokens=*" %%d in ('dir /b /s /a:d /od "%LOCALAPPDATA%\GitHub\PortableGit*" 2^>nul') do (
    if exist "%%d\cmd\git.exe" set "apm_git_path=%%d\cmd"
  )
  :: Found one, add it to the path
  if defined apm_git_path set "Path=!apm_git_path!;!PATH!"
)

:: add the paths to the bundled tools
set npm_config_node_gyp="%~dp0\\..\\node_modules\\node-gyp\\bin\\node-gyp.js"
set "npm_config_node_gyp=%npm_config_node_gyp:\=/%"
set node_gyp_cmd="%~dp0\..\node_modules\.bin\node-gyp.cmd"
set "Path=%node_gyp_cmd%;%Path%"
set "Path=%~dp0;%Path%"

if exist "%~dp0\node.exe" (
  "%~dp0\node.exe" "%~dp0/../lib/cli.js" %*
) else (
  node.exe "%~dp0/../lib/cli.js" %*
)
