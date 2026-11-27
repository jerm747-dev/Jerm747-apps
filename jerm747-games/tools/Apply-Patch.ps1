# Jerm747 Games - Patch Launcher (Windows)
# Double-click Apply-Patch.bat, or drag a .patch file onto it.
# Finds the patch (dragged file, else the newest .patch next to this script, else asks),
# applies it on a new branch, commits it, builds a GoDaddy upload zip of the changed site files,
# then (if you say yes) pushes the branch and opens a pull request.
param([string]$PatchPath)

function Say([string]$t)  { Write-Host "> $t" -ForegroundColor Red }
function Stop-Launcher([string]$t) { Write-Host ""; Write-Host "X  $t" -ForegroundColor Yellow; Write-Host ""; Read-Host 'Press Enter to close' | Out-Null; exit 1 }
# Run real git (git.exe), never a PowerShell function. Returns output; throws on failure.
function Invoke-GitStep {
  $out = & git.exe @args 2>&1
  if ($LASTEXITCODE -ne 0) { throw ("git " + ($args -join ' ') + " failed:`n" + ($out | Out-String)) }
  return $out
}

try {
  if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) { Stop-Launcher 'Git is not installed (or not on PATH). Install it from git-scm.com, then run this again.' }

  $root = (& git.exe -C $PSScriptRoot rev-parse --show-toplevel 2>$null)
  if (-not $root) { Stop-Launcher "This folder is not inside the Jerm747-apps repo:`n   $PSScriptRoot" }
  $root = $root.Trim()
  Set-Location -LiteralPath $root
  Say "Repo: $root"

  # 1. Which patch?
  if (-not $PatchPath) {
    $near = Get-ChildItem -LiteralPath $PSScriptRoot -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Extension -in '.patch', '.diff' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($near) { $PatchPath = $near.FullName; Say "Using the patch next to this launcher: $($near.Name)" }
  }
  if (-not $PatchPath) {
    Add-Type -AssemblyName System.Windows.Forms
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Title = 'Choose a patch for jerm747.games'
    $dlg.Filter = 'Patch files (*.patch;*.diff)|*.patch;*.diff|All files (*.*)|*.*'
    $dlg.InitialDirectory = Join-Path $env:USERPROFILE 'Downloads'
    if ($dlg.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
    $PatchPath = $dlg.FileName
  }
  if (-not (Test-Path -LiteralPath $PatchPath)) { Stop-Launcher "Patch not found: $PatchPath" }
  $PatchPath = (Resolve-Path -LiteralPath $PatchPath).Path

  # 2. Nothing of yours gets mixed in. Untracked files (like this launcher and the patch) are fine.
  $dirty = & git.exe status --porcelain --untracked-files=no | Where-Object { $_ }
  if ($dirty) {
    $dirty | Select-Object -First 20 | ForEach-Object { Write-Host "   $_" }
    Stop-Launcher 'You have uncommitted changes (listed above). Commit or stash them first, then run this again.'
  }

  # 3. Start from the latest main.
  $base = (& git.exe symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>$null)
  if ($base) { $base = $base.Trim() -replace '^origin/', '' } else { $base = 'main' }
  Say "Updating $base from GitHub..."
  & git.exe fetch --quiet origin 2>$null
  if ($LASTEXITCODE -ne 0) { Say "Could not reach GitHub; using the local copy of $base." }
  Invoke-GitStep switch --quiet $base | Out-Null
  & git.exe merge --quiet --ff-only "origin/$base" 2>$null | Out-Null

  $name = ([IO.Path]::GetFileNameWithoutExtension($PatchPath) -replace '[^A-Za-z0-9._-]+', '-').Trim('-')
  $branch = "patch/$name-$(Get-Date -Format 'yyyyMMdd-HHmm')"

  # 4. Does it fit? Checked against Git's stored copy, so Windows line endings don't matter.
  Say 'Checking the patch...'
  $check = & git.exe apply --cached --check --whitespace=nowarn "$PatchPath" 2>&1
  if ($LASTEXITCODE -ne 0) {
    $check | Select-Object -First 25 | ForEach-Object { Write-Host "   $_" }
    Stop-Launcher "The patch doesn't fit this copy of the repo. It may already be applied, or it was made for a different version. Nothing was changed."
  }

  # 5. Apply and commit on a new branch.
  Invoke-GitStep switch --quiet -c $branch | Out-Null
  Invoke-GitStep apply --cached --whitespace=nowarn "$PatchPath" | Out-Null
  Invoke-GitStep commit --quiet --no-verify -m "Apply $name" | Out-Null
  Invoke-GitStep reset --quiet --hard HEAD | Out-Null
  Say "Applied on branch $branch"

  # 6. GoDaddy upload zip: changed files under jerm747-games/public, laid out like the site root.
  #    Built straight from Git, so the files are byte-for-byte what the patch made.
  $changed = @(& git.exe diff --name-only --diff-filter=ACMR $base HEAD -- jerm747-games/public | ForEach-Object { $_ -replace '^jerm747-games/public/', '' } | Where-Object { $_ })
  if ($changed.Count) {
    $zip = Join-Path ([Environment]::GetFolderPath('Desktop')) "jerm747-games-upload-$name.zip"
    if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip }
    Invoke-GitStep -c core.autocrlf=false archive --format=zip -o "$zip" "HEAD:jerm747-games/public" -- @changed | Out-Null
    Say "Upload zip ready ($($changed.Count) files) on your Desktop:"
    Write-Host "   $zip"
    Say 'Extract it into the jerm747.games site root on GoDaddy.'
  } else { Say 'No site files changed (nothing to upload).' }

  # 7. Push and open the pull request.
  $go = Read-Host 'Push the branch and open a pull request? [Y/n]'
  if ($go -match '^[Nn]') { Say "Done. The branch stays local: $branch"; Read-Host 'Press Enter to close' | Out-Null; exit 0 }

  Invoke-GitStep push --quiet -u origin $branch | Out-Null
  $usedGh = $false
  if (Get-Command gh.exe -ErrorAction SilentlyContinue) {
    & gh.exe auth status *> $null
    if ($LASTEXITCODE -eq 0) {
      & gh.exe pr create --base $base --head $branch --title "Apply $name" --body "Applied with the Jerm747 Games patch launcher from $([IO.Path]::GetFileName($PatchPath))." | Out-Null
      & gh.exe pr view $branch --web 2>$null | Out-Null
      $usedGh = $true; Say 'Pull request opened.'
    }
  }
  if (-not $usedGh) {
    $remote = (& git.exe remote get-url origin).Trim() -replace '^git@github\.com:', 'https://github.com/' -replace '\.git$', ''
    $url = "$remote/compare/$base...$branch" + '?expand=1'
    Say 'Opening GitHub so you can click "Create pull request":'
    Write-Host "   $url"
    Start-Process $url
  }
  Read-Host 'Press Enter to close' | Out-Null
}
catch {
  Stop-Launcher ("Something went wrong:`n" + $_.Exception.Message)
}
