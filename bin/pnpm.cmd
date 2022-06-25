@echo off
setlocal EnableDelayedExpansion

set "PATH=%~dp0;%PATH%"

:: set the path to the node-gyp fallback
set npm_config_node_gyp="%~dp0\\..\\node_modules\\node-gyp\\bin\\node-gyp.js"
set "npm_config_node_gyp=%npm_config_node_gyp:\=/%"

"%~dp0\..\node_modules\.bin\pnpm.cmd" %*
