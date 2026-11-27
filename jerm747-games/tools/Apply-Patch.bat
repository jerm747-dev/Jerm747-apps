@echo off
rem Jerm747 Games · Patch Launcher. Double-click to pick a patch, or drag a .patch file onto this file.
title Jerm747 Games - Patch Launcher
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Apply-Patch.ps1" "%~1"
