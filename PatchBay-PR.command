#!/usr/bin/env bash
set -euo pipefail

fail() { printf '\n%s\n' "$*" >&2; exit 1; }
trap 'code=$?; if [[ -t 0 && -z ${PATCHBAY_NO_PAUSE:-} ]]; then read -r -p "Press Enter to close…" _ || true; fi; exit "$code"' EXIT

command -v git >/dev/null || fail "Git is required. Install Git, then run this again."
cd -- "$(dirname -- "$0")"
root=$(git rev-parse --show-toplevel 2>/dev/null) || fail "Put this launcher in your local Jerm747-apps folder and run it there."
[[ -d "$root/PatchBay" ]] || fail "This checkout does not contain the PatchBay folder."

remote=''
while IFS= read -r candidate; do
  push_url=$(git config --get "remote.$candidate.pushurl" || git config --get "remote.$candidate.url")
  case "${push_url%.git}" in
    https://github.com/jerm747-dev/Jerm747-apps|git@github.com:jerm747-dev/Jerm747-apps|ssh://git@github.com/jerm747-dev/Jerm747-apps)
      remote=$candidate
      break
      ;;
  esac
done < <(git remote)
[[ -n "$remote" ]] || fail "This checkout needs a Git remote for jerm747-dev/Jerm747-apps."

if [[ $# -gt 1 ]]; then fail "Run with one Patch Bay .patch file."; fi
if [[ $# -eq 1 ]]; then
  patch=$1
  if command -v cygpath >/dev/null; then patch=$(cygpath -u "$patch"); fi
else
  shopt -s nullglob nocaseglob
  patches=(PatchBay*.patch)
  case ${#patches[@]} in
    0) fail "Put a PatchBay .patch file next to the launcher." ;;
    1) patch=${patches[0]} ;;
    *)
      printf 'Choose the patch to apply.\n'
      select patch in "${patches[@]}"; do
        [[ -n "$patch" ]] && break
        printf 'Enter a number from the list.\n'
      done
      ;;
  esac
fi
[[ -n "${patch:-}" && -f "$patch" ]] || fail "Could not find the selected patch."
patch_dir=$(cd -- "$(dirname -- "$patch")" && pwd)
patch="$patch_dir/$(basename -- "$patch")"
cd -- "$root"

git diff --quiet && git diff --cached --quiet || fail "Save or commit your current changes before running this tool."
for state in rebase-apply rebase-merge MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD; do
  [[ ! -e "$(git rev-parse --git-path "$state")" ]] || fail "Finish your current Git operation before running this tool."
done

patch_id=$(git patch-id --stable < "$patch" | awk 'NR == 1 {print $1}')
[[ -n "$patch_id" ]] || fail "This file does not contain a Git patch."
slug=$(basename -- "$patch" | tr '[:upper:]' '[:lower:]' | sed 's/\.patch$//; s/[^a-z0-9._-]/-/g; s/^[.-]*//; s/[.-]*$//')
branch="patchbay-pr/${slug:-update}-${patch_id:0:10}"
git check-ref-format --branch "$branch" >/dev/null || fail "The patch filename cannot be used for a branch."

printf 'Fetching main from %s…\n' "$remote"
git fetch "$remote" refs/heads/main
base=$(git rev-parse FETCH_HEAD)
if git show-ref --verify --quiet "refs/heads/$branch"; then
  existing_id=$(git show --pretty=format: --no-ext-diff "$branch" | git patch-id --stable | awk 'NR == 1 {print $1}')
  [[ "$existing_id" == "$patch_id" ]] || fail "A local branch already uses this name. Review it before trying again."
  printf 'Reusing the commit from the previous attempt.\n'
else
  previous=$(git symbolic-ref --quiet --short HEAD || git rev-parse HEAD)
  git switch -c "$branch" "$base"
  if ! git am --3way "$patch"; then
    git am --abort 2>/dev/null || true
    git switch "$previous"
    git branch -d "$branch" 2>/dev/null || true
    fail "The patch did not apply to current main. Send the output back so we can refresh the patch."
  fi
fi

git push -u "$remote" "refs/heads/$branch:refs/heads/$branch"
url="https://github.com/jerm747-dev/Jerm747-apps/compare/main...${branch}?expand=1"
printf '\nOn GitHub, review the changes and click Create pull request.\n%s\n' "$url"
if [[ -z ${PATCHBAY_NO_BROWSER:-} ]]; then
  case "$(uname -s)" in
    Darwin) open "$url" || true ;;
    MINGW*|MSYS*|CYGWIN*) cmd.exe /c start "" "$url" || true ;;
    *) if command -v xdg-open >/dev/null; then xdg-open "$url" >/dev/null 2>&1 || true; fi ;;
  esac
fi
