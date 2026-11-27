@echo off
rem Jerm747 Games - Patch Launcher. Double-click to use the patch sitting next to this file
rem (or pick one), or drag a .patch file onto this file.
title Jerm747 Games - Patch Launcher
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0Apply-Patch.ps1" %1
if errorlevel 1 pause
