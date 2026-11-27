# Jerm747 Games · Patch Launcher (Windows)
# Double-click Apply-Patch.bat, or drag a .patch file onto it.
# Applies the patch on a new branch, commits it, builds a GoDaddy upload zip of the changed site files,
# then (if you say yes) pushes the branch and opens a pull request.
param([string]$PatchPath)
$ErrorActionPreference = 'Stop'

function Say($t)  { Write-Host "▌ $t" -ForegroundColor Red }
function Fail($t) { Write-Host "✖ $t" -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }
function Git { & git @args; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed" } }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail 'Git is not installed. Get it from git-scm.com, then run this again.' }
$root = (& git -C $PSScriptRoot rev-parse --show-toplevel 2>$null)
if (-not $root) { Fail 'This folder is not inside the Jerm747-apps repo.' }
Set-Location $root

if (-not $PatchPath) {
  Add-Type -AssemblyName System.Windows.Forms
  $dlg = New-Object System.Windows.Forms.OpenFileDialog
  $dlg.Title = 'Choose a patch for jerm747.games'
  $dlg.Filter = 'Patch files (*.patch;*.diff)|*.patch;*.diff|All files (*.*)|*.*'
  $dlg.InitialDirectory = Join-Path $env:USERPROFILE 'Downloads'
  if ($dlg.ShowDialog() -ne 'OK') { exit 0 }
  $PatchPath = $dlg.FileName
}
if (-not (Test-Path $PatchPath)) { Fail "Patch not found: $PatchPath" }
$PatchPath = (Resolve-Path $PatchPath).Path

if (& git status --porcelain) {
  & git status --short | Select-Object -First 20
  Fail 'You have uncommitted changes. Commit or stash them first, then run this again.'
}

$base = ((& git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>$null) -replace '^origin/','')
if (-not $base) { $base = 'main' }
Say "Updating $base from GitHub…"
& git fetch --quiet origin 2>$null; if ($LASTEXITCODE -ne 0) { Say "Could not reach GitHub; using the local copy of $base." }
Git switch --quiet $base
& git merge --quiet --ff-only "origin/$base" 2>$null | Out-Null

$name = ([IO.Path]::GetFileNameWithoutExtension($PatchPath) -replace '[^A-Za-z0-9._-]+','-').Trim('-')
$branch = "patch/$name-$(Get-Date -Format 'yyyyMMdd-HHmm')"

Say 'Checking the patch…'
$check = & git apply --check --whitespace=nowarn $PatchPath 2>&1
if ($LASTEXITCODE -ne 0) { $check | Out-Host; Fail "The patch doesn't fit this copy of the repo (it may already be applied, or it was made for a different version)." }

Git switch --quiet -c $branch
Git apply --whitespace=nowarn $PatchPath
Git add -A
Git commit --quiet -m "Apply $name"
Say "Applied on branch $branch"

# GoDaddy upload zip: the changed files under jerm747-games/public, laid out like the site root.
$changed = & git diff --name-only --diff-filter=ACMR $base HEAD -- jerm747-games/public | ForEach-Object { $_ -replace '^jerm747-games/public/','' }
if ($changed) {
  $out = [Environment]::GetFolderPath('Desktop')
  $zip = Join-Path $out "jerm747-games-upload-$name.zip"
  if (Test-Path $zip) { Remove-Item -LiteralPath $zip }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::Open($zip, 'Create')
  try {
    foreach ($f in $changed) {
      $full = Join-Path $root "jerm747-games/public/$f"
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $full, $f, 'Optimal') | Out-Null
    }
  } finally { $archive.Dispose() }
  Say "Upload zip ready ($(@($changed).Count) files): $zip"
  Say 'Extract it into the jerm747.games site root on GoDaddy.'
} else { Say 'No site files changed (nothing to upload).' }

$go = Read-Host 'Push the branch and open a pull request? [Y/n]'
if ($go -match '^[Nn]') { Say "Done. The branch stays local: $branch"; Read-Host 'Press Enter to close'; exit 0 }

Git push --quiet -u origin $branch
$gh = Get-Command gh -ErrorAction SilentlyContinue
if ($gh) { & gh auth status *> $null }
if ($gh -and $LASTEXITCODE -eq 0) {
  & gh pr create --base $base --head $branch --title "Apply $name" --body "Applied with the Jerm747 Games patch launcher from ``$([IO.Path]::GetFileName($PatchPath))``." | Out-Null
  & gh pr view $branch --web 2>$null | Out-Null
  Say 'Pull request opened.'
} else {
  $url = ((& git remote get-url origin) -replace '^git@github.com:','https://github.com/' -replace '\.git$','') + "/compare/$base...$branch`?expand=1"
  Say "Opening GitHub to create the pull request: $url"
  Start-Process $url
}
Read-Host 'Press Enter to close'
