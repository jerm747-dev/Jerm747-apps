#!/bin/sh
cd "$(dirname "$0")"
echo "747 GP running at http://localhost:8747  (Ctrl+C to stop)"
(command -v open >/dev/null && open http://localhost:8747 || xdg-open http://localhost:8747) >/dev/null 2>&1 &
if command -v python3 >/dev/null; then python3 -m http.server 8747; else npx --yes http-server -p 8747 -c-1; fi
