@echo off

SET CUR_DIR=%~dp0
CD /D "%CUR_DIR%"

SET HIDEC_EXE=%CUR_DIR%hidec.exe

taskkill /f /im node.exe 2>nul
"%HIDEC_EXE%" node.exe server.js
