JERM747 GAMES · PATCH LAUNCHER

Applies a .patch file to your Jerm747-apps repo, builds the GoDaddy upload zip, and opens a pull request.

WINDOWS
  Put the .patch file in the same folder as Apply-Patch.bat and double-click Apply-Patch.bat.
  (Or drag any .patch file onto Apply-Patch.bat. If none is found, it asks you to pick one.)
  If anything goes wrong, the window stays open and tells you why.

MAC / LINUX
  In Terminal:  ./apply-patch.sh ~/Downloads/the-update.patch
  With no file named, it uses the newest .patch next to the script, then the newest in Downloads.
  (First time only on Mac: chmod +x apply-patch.sh)

WHAT IT DOES
  1. Stops if tracked files have uncommitted changes, so nothing of yours gets mixed in.
     (Untracked files, like the launcher itself and the patch, are fine.)
  2. Updates main from GitHub.
  3. Checks the patch fits (against Git's stored copy, so Windows line endings don't matter). If it doesn't (already applied, or made for an older copy), it stops and changes nothing.
  4. Applies it on a new branch named patch/<file-name>-<date> and commits it.
  5. Puts jerm747-games-upload-<file-name>.zip on your Desktop: only the changed site files, laid out like
     the site root. Extract it into the jerm747.games folder on GoDaddy.
  6. Asks before pushing. Yes = push the branch and open the pull request on GitHub
     (uses the GitHub CLI "gh" if it's installed and signed in; otherwise it opens the GitHub page to create it).

PATCHES MADE IN ONE SERIES
  Apply them in the order they were made. The "tonight-full" patch already contains all of the smaller ones,
  so use it on its own.

NEEDS
  Git (git-scm.com). Optional: GitHub CLI (cli.github.com) for one-step pull requests.
