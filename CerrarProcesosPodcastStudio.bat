@echo off
title Limpiando Procesos de PodcastStudio
echo ========================================================
echo   CERRANDO TODOS LOS PROCESOS HUERFANOS DE PODCASTUDIO
echo ========================================================
echo.
taskkill /F /IM electron.exe /T 2>nul
taskkill /F /IM PodcastStudio.exe /T 2>nul
taskkill /F /IM ffmpeg.exe /T 2>nul
echo.
echo ========================================================
echo   PROCESOS CERRADOS Y MEMORIA LIBERADA CON EXITO
echo ========================================================
echo.
timeout /t 2 >nul
