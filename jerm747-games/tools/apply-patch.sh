#!/usr/bin/env bash
# Jerm747 Games · Patch Launcher (Mac / Linux)
# Usage:  ./apply-patch.sh path/to/update.patch   (no argument: the newest .patch next to this script, else in Downloads)
# Applies the patch on a new branch, commits it, builds a GoDaddy upload zip of the changed site files,
# then (if you say yes) pushes the branch and opens a pull request.
set -euo pipefail

say()  { printf '\033[1;31m▌\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

command -v git >/dev/null || fail "Git is not installed."
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel 2>/dev/null)" || fail "This folder is not inside the Jerm747-apps repo."
cd "$ROOT"

PATCH="${1:-}"
if [ -z "$PATCH" ]; then
  PATCH="$(ls -t "$HERE"/*.patch "$HERE"/*.diff 2>/dev/null | head -n 1 || true)"
  [ -n "$PATCH" ] && say "Using the patch next to this launcher: $(basename "$PATCH")"
fi
if [ -z "$PATCH" ]; then
  PATCH="$(ls -t "$HOME"/Downloads/*.patch 2>/dev/null | head -n 1 || true)"
  [ -n "$PATCH" ] || fail "No patch given, and no .patch file found in Downloads."
  say "Using the newest patch in Downloads: $(basename "$PATCH")"
fi
[ -f "$PATCH" ] || fail "Patch not found: $PATCH"
PATCH="$(cd "$(dirname "$PATCH")" && pwd)/$(basename "$PATCH")"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short --untracked-files=no | head -n 20
  fail "You have uncommitted changes. Commit or stash them first, then run this again."
fi

BASE="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || echo main)"
say "Updating $BASE from GitHub…"
git fetch --quiet origin || say "Could not reach GitHub; using the local copy of $BASE."
git switch --quiet "$BASE"
git merge --quiet --ff-only "origin/$BASE" 2>/dev/null || true

NAME="$(basename "$PATCH" .patch | tr -cs 'A-Za-z0-9._-' '-' | sed 's/-*$//')"
BRANCH="patch/${NAME}-$(date +%Y%m%d-%H%M)"

say "Checking the patch…"
if ! git apply --cached --check --whitespace=nowarn "$PATCH" 2>/tmp/patch-check.txt; then
  cat /tmp/patch-check.txt
  fail "The patch doesn't fit this copy of the repo (it may already be applied, or it was made for a different version)."
fi

git switch --quiet -c "$BRANCH"
git apply --cached --whitespace=nowarn "$PATCH"
git commit --quiet --no-verify -m "Apply ${NAME}"
git reset --quiet --hard HEAD
say "Applied on branch $BRANCH"

# GoDaddy upload zip: the changed files under jerm747-games/public, laid out like the site root.
CHANGED="$(git diff --name-only --diff-filter=ACMR "$BASE" HEAD -- jerm747-games/public | sed 's#^jerm747-games/public/##')"
if [ -n "$CHANGED" ]; then
  OUT="$HOME/Desktop"; [ -d "$OUT" ] || OUT="$HOME"
  ZIP="$OUT/jerm747-games-upload-${NAME}.zip"
  rm -f -- "$ZIP"
  # shellcheck disable=SC2086
  git -c core.autocrlf=false archive --format=zip -o "$ZIP" "HEAD:jerm747-games/public" -- $CHANGED
  say "Upload zip ready ($(printf '%s\n' "$CHANGED" | wc -l | tr -d ' ') files): $ZIP"
  say "Extract it into the jerm747.games site root on GoDaddy."
else
  say "No site files changed (nothing to upload)."
fi

read -r -p "Push the branch and open a pull request? [Y/n] " GO
case "${GO:-Y}" in [Nn]*) say "Done. The branch stays local: $BRANCH"; exit 0;; esac

git push --quiet -u origin "$BRANCH"
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh pr create --base "$BASE" --head "$BRANCH" --title "Apply ${NAME}" --body "Applied with the Jerm747 Games patch launcher from \`$(basename "$PATCH")\`." >/dev/null
  gh pr view "$BRANCH" --web >/dev/null 2>&1 || true
  say "Pull request opened."
else
  URL="$(git remote get-url origin | sed -E 's#^git@github.com:#https://github.com/#; s#\.git$##')/compare/${BASE}...${BRANCH}?expand=1"
  say "Open this to create the pull request: $URL"
  (command -v open >/dev/null && open "$URL") || (command -v xdg-open >/dev/null && xdg-open "$URL") || true
fi
