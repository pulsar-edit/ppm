@echo off
setlocal EnableDelayedExpansion
setlocal EnableExtensions

echo ^>^> Downloading bundled Node
node.exe .\script\download-node.js

echo.
for /f "delims=" %%i in ('.\bin\node.exe -p "process.version + ' ' + process.arch"') do set bundledVersion=%%i
echo ^>^> Rebuilding apm dependencies with bundled Node !bundledVersion!

:: parallel node-gyp
setx JOBS 16

call .\bin\npm.cmd rebuild

exit /b
