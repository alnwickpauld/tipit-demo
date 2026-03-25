@echo off
setlocal
cd /d "%~dp0.."
set "PATH=%CD%\.tools\node;%PATH%"
del /f /q ".next-dev.out.log" ".next-dev.err.log" 2>nul
start "" /b cmd /c ".tools\node\npm.cmd run dev 1> .next-dev.out.log 2> .next-dev.err.log"
