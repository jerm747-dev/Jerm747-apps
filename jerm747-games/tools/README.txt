JERM747 GAMES · PATCH LAUNCHER

Applies a .patch file to your Jerm747-apps repo, builds the GoDaddy upload zip, and opens a pull request.

WINDOWS
  Double-click Apply-Patch.bat and pick the patch, or drag the .patch file onto Apply-Patch.bat.

MAC / LINUX
  In Terminal:  ./apply-patch.sh ~/Downloads/the-update.patch
  With no file named, it uses the newest .patch in Downloads.
  (First time only on Mac: chmod +x apply-patch.sh)

WHAT IT DOES
  1. Stops if the repo has uncommitted changes, so nothing of yours gets mixed in.
  2. Updates main from GitHub.
  3. Checks the patch fits. If it doesn't (already applied, or made for an older copy), it stops and changes nothing.
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
