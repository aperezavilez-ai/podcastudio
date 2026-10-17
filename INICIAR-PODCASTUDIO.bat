@echo off
title PODCASTUDIO Desktop v1.0.0
echo ========================================================
echo       Iniciando PODCASTUDIO Desktop v1.0.0 (GPU)
echo ========================================================
echo.
cd /d "%~dp0"
call npm run electron
if errorlevel 1 (
    echo.
    echo Reintentando en modo desarrollo...
    call npm run electron:dev
)
