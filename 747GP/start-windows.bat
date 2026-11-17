@echo off
cd /d "%~dp0"
echo 747 GP running at http://localhost:8747  (close this window to stop)
start "" http://localhost:8747
where py >nul 2>nul && (py -m http.server 8747 & goto :eof)
where python >nul 2>nul && (python -m http.server 8747 & goto :eof)
npx --yes http-server -p 8747 -c-1
