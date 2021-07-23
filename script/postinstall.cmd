@echo off
setlocal EnableDelayedExpansion
setlocal EnableExtensions

echo.
for /f "delims=" %%i in ('.\bin\node.exe -p "process.version + ' ' + process.arch"') do set bundledVersion=%%i
echo ^>^> Rebuilding apm dependencies with bundled Node !bundledVersion!

:: parallel node-gyp
setx JOBS 16

call .\bin\npm.cmd rebuild
