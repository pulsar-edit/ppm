@echo off
setlocal EnableDelayedExpansion

set "PATH=%~dp0;%PATH%"

:: add the paths to the bundled tools
set npm_config_node_gyp="%~dp0\\..\\node_modules\\node-gyp\\bin\\node-gyp.js"
set "npm_config_node_gyp=%npm_config_node_gyp:\=/%"
set node_gyp_cmd="%~dp0\..\node_modules\.bin\node-gyp.cmd"
set "Path=%node_gyp_cmd%;%Path%"
set "Path=%~dp0;%Path%"

"%~dp0\..\node_modules\.bin\pnpm.cmd" %*
