from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parent
source=root/'source'
html=(source/'template.html').read_text().replace('/*WORKSHOP_CSS*/',(source/'workshop.css').read_text()).replace('/*WORKSHOP_JS*/',(source/'workshop.js').read_text()).replace('/*ROSTER_JSON*/',json.dumps(json.loads((source/'roster.json').read_text()),separators=(',',':')))
(root/'Fighter-Select.html').write_text(html)
if (source/'game-entry.js').exists() and (root/'game').exists():
    shutil.copyfile(source/'game-entry.js',root/'game/crest-entry.js')
print('Rebuilt Fighter-Select.html and game entry')
