JERM747.DEV SANDBOX PROJECTS
============================

Every folder in here that has an index.html shows up on jerm747.dev/sandbox/ automatically.
Folder names: letters, numbers, dashes, dots or underscores (e.g. my-new-game).

Optional files in a project folder:
  cover.png / cover.jpg / cover.webp   tile art (16:9 works best, about 1280x720)
  project.json                         details shown in the sandbox:

{
  "title": "My Game",
  "tagline": "One line under the title",
  "description": "A few sentences.",
  "kind": "game",            game | app | site | tool | music | experiment
  "status": "in_progress",   prototype | in_progress | playable | stable | client
  "version": "v3",
  "controls": ["gamepad", "keyboard", "mouse", "touch"],
  "credit": "Built for Example Co. All rights reserved.",
  "accent": "#8FA7BF",       tile color when there is no cover
  "order": 30,               lower numbers come first
  "hidden": true,            leave it on the server but off the shelf

  "gamepad": { "A": " ", "X": "j" },        controller bridge for keyboard-only projects:
  "gamepadLabels": { "A": "Jump", "X": "Punch" }   button -> key the sandbox presses for you
}

Bridge buttons: A B X Y LB RB LT RT SELECT START UP DOWN LEFT RIGHT
Keys are what the game checks: " " for Space, "j", "ArrowUp", "Enter", etc.
Don't map SELECT+START together; holding both returns to the shelf.
