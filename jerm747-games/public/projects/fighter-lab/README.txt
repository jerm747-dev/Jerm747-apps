FIGHTER LAB — AKEEM DETAIL WORKSHOP 0.2
October 29, 2026 · Jerm747

This folder contains Fighter Lab only.

RUN
Extract the whole folder, then open index.html in a modern browser.
Keep the vendor folder, scripts, and reference image beside index.html.
If your device does not open local HTML apps, serve this folder through your
website or any static web server. No npm install or build is required.

INSTALL ON YOUR EXISTING SITE
Replace only public/projects/fighter-lab/ in the source project with this
folder, then run your normal site build. For a direct hosted-file update,
replace only projects/fighter-lab/ in your hosted files.

DETAIL PASS
- Head: 17% wider and 13% taller/deeper; rounded skull and jaw, shaped chin,
  ears and nose; smaller rounded eye forms.
- Hair: tapered sides, a dense crown of individual curls and coil detail.
- Hands: separate tapered palms, thumb joints, and four three-joint fingers
  per hand. Layered wrist and palm tape with a generated woven cotton texture.
- Feet: rounded heels and insteps, five graduated toes per foot, toenails,
  longer ankle wraps and separate overlapping instep ribbons.
- Fabric: wider shorts legs, pinned vest and shorts deformation, and damped
  spring motion on sash and arm ties. Garment trim moves with each panel.

TRY IT
Scroll the bottom controls sideways on small screens.
Choose Fist, Open, Point, or Come here. Both hands show the selected gesture;
fight moves temporarily close the hands, then restore your selection.
Use Head, Hands, or Feet for close inspection; Front or 3/4 resets the view.
Toggle Fabric motion to compare the clothing. Hold pose freezes the model,
finger transitions, and fabric. Slow motion slows all of them together.

EXPORT
GLB includes the current posed articulated hierarchy and the embedded woven
texture. OBJ exports the current geometry. These are pose snapshots; live
JavaScript gestures and spring simulation are not baked animation clips.

WORKSHOP LIMITS
Fabric uses lightweight secondary motion, without full cloth collision or
self-collision. This is a geometric character study for further refinement.
The CPU compatibility renderer shows geometric wrap ridges but does not
sample the woven texture; WebGL displays the woven material.

VERIFICATION
Executed the scene with its bundled Three.js and CPU compatibility renderer;
visually inspected full body and head/hand/foot closeups. Checked all four
hand gestures, eight moves, finite rig transforms, cloth deformation and
freeze behavior, and OBJ/GLB export. Full browser interaction and Android
hardware checks remain for device review.
