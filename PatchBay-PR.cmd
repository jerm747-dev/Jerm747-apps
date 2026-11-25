@echo off
setlocal
set "GITBASH=%ProgramFiles%\Git\bin\bash.exe"
if not exist "%GITBASH%" set "GITBASH=%LocalAppData%\Programs\Git\bin\bash.exe"
if not exist "%GITBASH%" (
  echo Install Git for Windows, or run PatchBay-PR.command from Git Bash.
  pause
  exit /b 1
)
set "PATCHBAY_NO_PAUSE=1"
"%GITBASH%" "%~dp0PatchBay-PR.command" %*
set "RESULT=%ERRORLEVEL%"
pause
exit /b %RESULT%
