@echo off
setlocal EnableDelayedExpansion

set "PATH=%~dp0;%PATH%"

:: Force npm to use the bundled node-gyp
set npm_config_node_gyp="%~dp0\\..\\node_modules\\node-gyp\\bin\\node-gyp.js"
set "npm_config_node_gyp=%npm_config_node_gyp:\=/%"

"%~dp0\..\node_modules\.bin\pnpm.cmd" %*
