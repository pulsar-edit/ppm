@echo off
setlocal enabledelayedexpansion

set script_name=%~f0
if "%script_name%" == 'ppm-next.cmd' (
  set ATOM_BASE_NAME=pulsar-next
) else (
  set ATOM_BASE_NAME=pulsar
)

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

:: Force npm to use its builtin node-gyp
set npm_config_node_gyp=

if exist "%~dp0\node.exe" (
  "%~dp0\node.exe" "%~dp0/../src/cli.js" %*
) else (
  node.exe "%~dp0/../src/cli.js" %*
)
