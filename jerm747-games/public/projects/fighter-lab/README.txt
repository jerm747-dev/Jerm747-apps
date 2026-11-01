GS Fighter III Lab v0.36 — Brush Fighters
Built for Jeremy / Jerm747 — October 31, 2026

Extract the complete ZIP and open fighter-lab/index.html.
Includes the complete v0.35 stage, V-Wave, finish slow motion and impact reactions.

NEW FIGHTER SELECT ART
Akeem and Nika now have separate headshots and full-body brush paintings,
shaped by their actual 3D models and original fighting guard poses. Broad
painted spirals sit behind them: cyan/teal for Akeem and gold/amber for Nika.
The transparent poses fit fully, including hands, hair and feet. All six new
PNGs and the retained original sheets are in fighter-artwork/.
Selecting P1 sets the matching cyan/solar V-Wave aura. The Azure core keeps its
original blue texture; Settings can still override the surrounding aura color.

SIMPLER SELECTION
Tap a tile: assign P1. Hold about 0.32 seconds: tiny P1/P2 circles appear just
above that tile. Slide a little right and release to assign P2; release in place
for P1. The chooser has no large dialog or dark backdrop.
Keyboard: arrows/WASD browse, Enter/Space opens choices, Left/Right picks a side,
Enter/Space assigns. Escape cancels. Existing controller selection is retained.

NEW MESH INTAKE
Ten unique new models inspected: nine FBX and one OBJ (Major/green suit).
Static is present once; Rayburn and Tye are missing from this batch.
All ten need skeletons and skin weights before they can reuse combat motions.
Fixed varied starter move sets are prepared but not loaded into gameplay.
Akeem and Nika remain the two playable fighters in this build.
See NEW-FIGHTER-IMPORTS.txt for names, export needs and the move-plan details.

CHECKED
Selection/controller state and gesture tests passed. Browser checks cover
full-body desktop/mobile framing, inline choices, keyboard and mirror launch.
V-Wave tests passed for aura presets, overrides, damage and reaction recovery.
Physical Android touch feel and hardware gamepads still need device testing;
the preview browser used the compatibility renderer rather than WebGL.
See FIGHTER-SELECT.txt for all controls and validation details.

Previous release notes:
========================================
GS Fighter III Lab v0.35 — Fighter Portraits
Built for Jeremy / Jerm747 — October 31, 2026

Extract the complete ZIP and open fighter-lab/index.html.
Includes the complete v0.34 Impact Reactions build.

FIGHTER SELECT
Original Akeem and Nika artwork now appears as static, full-standing portraits.
Both fighters face inward with a soft background fade toward the center.
Their whole bodies fit the available space; nameplates sit below their feet.
Selection no longer needs live 3D rig previews or moves the arena canvas.

Touch: hold a roster fighter briefly, release, then tap the P1 or P2 circle.
Short taps only highlight. You can also highlight a fighter and use P1 / P2.
Keyboard: arrows or WASD browse; Enter or Space opens the player circles;
Left/Right chooses P1/P2; Enter or Space assigns. Escape cancels the chooser.
Repeat for the other side, then activate Enter Fighter Lab.
Existing independent gamepad sticks, LB/RB and second-controller support remain.
Mirror matches remain available. These circles select fighter slots; they do
not add new human P2 combat controls or change gameplay controller mappings.

Browser checks passed at desktop, 390x844 portrait, 844x390 landscape and
320x568 compact sizes, including hold, short tap, Space/Enter, cancellation,
mirror assignment, hidden touch controls and launching the chosen matchup.
Automated selection/controller state checks passed. Physical controller and
Android touch feel still need testing on your device.
See FIGHTER-SELECT.txt for controls, artwork sources and roster additions.

Previous release notes:
========================================
GS Fighter III Lab v0.34 — Impact Reactions
Built for Jeremy / Jerm747 — October 31, 2026

Extract the complete ZIP and open fighter-lab/index.html.
Includes the v0.33 Azure V-Wave, glow effects, fighter selection and stage.

APPLIED TO NIKA AND AKEEM
The supplied Golden Valkyrie (6) animation pack contains eight clips. Running
and Walking duplicate motions already in the lab; those assignments stay as
before. The six supplied reactions are available on both characters. Nika's
existing Face_Punch_Reaction is retained, and both existing Face_Punch_Reaction_1
clips also participate. Full original motions remain in the Move workshop.
No character mesh, skin weights or limb lengths were replaced.
Hand contact now includes a 4 cm fist allowance beyond the wrist joint, so
Nika's close straight punch registers instead of falling just short. The
training lane now permits a 0.85 m close gap for Akeem's shorter uppercut;
Set up final hit uses that distance. Starting positions remain the same.

HOW HITS CHOOSE A REACTION
- Mid punches: short Hit_Reaction_1 / Hit_Reaction body flinches.
- Mid kicks: Hit_Reaction_to_Waist / Hit_Reaction with a heavier recoil.
- Low hits: short body/waist responses; this pack has no dedicated shin hit.
- Straight head hits: alternate Face_Punch_Reaction and Face_Punch_Reaction_1.
- Sideways head blows: Slap_Reaction or a matching face recoil.
- V-Wave knockdowns and Akeem uppercut KOs: BeHit_FlyUp, followed by the existing
  get-up when the defender is still alive. Sweeps and other KOs retain their fall.

Choice is logical first, then cycles within the eligible family. Each defender
has independent history, including mirror matches. Variants do not randomly
mix face and body reactions. Strike hand/foot motion determines recoil side;
mirrored poses swap limbs and reflect rotations. Source root travel stays
anchored for reactions, preventing cumulative drift from repeated hits.

Akeem's low-punch slot uses a head hook and his low-kick slot still uses the
existing High_Kick placeholder. Those receive head reactions to match their
visible animations. This update does not invent a true shin kick for him.

FASTER GAMEPLAY TIMING
Long pauses and extended recoveries are excluded from live hit playback.
Standing reactions start at 2.5x; heavier hits add 0.1x. They last roughly
0.25–0.41 seconds before blending back. A fresh hit within 0.46 simulation
seconds uses a shorter recoil section and adds 0.7x speed (maximum 4x): roughly
0.12–0.22 seconds at defaults. Each new impact immediately interrupts the last
reaction and blends from its displayed pose, so reactions never form a queue.
The launch plays at 1.7x for about 0.69 seconds, preserving takeoff and landing.
Camera framing expands for the launched fighter. Finish slow motion still
slows the whole fight together; reaction detection uses simulation time.

SETTINGS > HIT REACTIONS
- Reaction speed: 2x–4x, default 2.5x for standing reactions.
- Shorten rapid-hit reactions: on by default; disable for comparison.
- Test hit: mid kick, low kick, mid punch, high punch, hook or V-Wave launch.
- Test partner reaction: advances the matching family on each press.
- Test 3-hit flurry: three sample hits 0.17 seconds apart, without damage.
- Readout: selected reaction, effective speed, trimmed duration and rapid/side.
The full Move workshop also adds 2.5x, 3x, 3.5x and 4x preview speeds.
Tests stop on reset, fighter selection and matchup changes. A V-Wave test uses
one launch rather than striking an already fallen character three times.

VALIDATION
Both fighter pairings and both mirror matches passed family selection,
variation, rapid-hit timing, physical mid-kick contact, V-Wave launch/get-up,
KO slow finish, reset and fighter-selection cleanup. CPU demo use was checked.
All imported rotation tracks are finite and normalized; mirrored poses preserve
height/depth and reverse lateral recoil. Reaction completion and timing passed
at 15, 30, 60 and 120 FPS, including Smart transitions disabled. Camera framing
was checked during launch. Actual textured meshes were rendered for body,
waist, face, mirrored-side and landed-launch pose inspection.
Android hardware performance and final feel still need your device test.

See REACTION-MOTIONS.txt for source trims. Original source ZIP is unchanged.

Previous release notes:
========================================
GS Fighter III Lab v0.33 — Azure V-Wave + Living Glow
Built for Jeremy / Jerm747 — October 31, 2026

Extract the complete ZIP and open fighter-lab/index.html as before.
The v0.32 fighter-selection screen, mirror matches, stage and slow finish remain.

YOUR MESHY BLAST IS IN THE GAME
The V-WAVE button beside BLOCK (or keyboard V) now launches the supplied Azure
Singularity mesh, with its original blue/violet color, normal and material maps.
The mesh does not need a skeleton or skin weights. Its whole-object flight,
slight axial roll, glow and flame motion are animated by the game.

This first power tuning uses a 0.48 m head radius, 7 m/s flight, 24 damage,
knockdown on a clean hit and 2.4 simulation seconds of recharge. A brief light
builds at the casting hand. The imported mesh stays visible inside a rippling,
translucent flame shell, six rotating wisps, soft glow and traveling sparks.
Brightness pulses locally twice per second. On impact the light blooms into
sparks, lightning and an expanding ring; a final hit keeps the slow finish.

SETTINGS > V-WAVE & FINISH
- Aura color: cyan/violet, solar fire, rose plasma or jade. The original mesh
  artwork stays blue/violet; this control colors the surrounding effects.
- Orb radius and wave speed tune the next shot.
- Glow strength adjusts the live aura, wisps, charge light and impact flare.
- Travel glow pulses toggles the brightness pulse; the moving wisps continue.
- Set up final hit brings the fighters close and gives the target 5 HP.
- The Azure blast GLB link downloads a reusable, textured version of this mesh.

The cast waits for the embedded textures to load. If the color texture cannot
load, the lab reports it and uses the existing animated energy geometry.
No new network dependency or runtime FBX importer is required. The original
textures are embedded inside the browser asset and the GLB for offline use.

ASSET DETAILS
Original upload: Meshy_AI_Azure_Singularity_20261031_texture_remesh_tri_fbx.zip
The source has one static mesh, 64,389 triangles and 2K textures. All triangles,
UV seams and texture bytes were preserved. The FBX transforms were applied,
the bright orb was placed at the projectile origin, and the tip of the tail
points backward. Indexed geometry uses 55,300 render vertices and 16-bit
indices. Color, normal and combined metallic/roughness maps are included.
The original uploaded FBX ZIP has not been modified.

VALIDATION
- Both fighters and both mirror matchups: imported mesh cast, 24 damage,
  knockdown/get-up, recharge, air rejection and slow-motion KO passed.
- Charge and projectile cleanup checked on reset and opening fighter selection.
- Collision/expiry checked at 15, 30, 60 and 120 FPS, including swept hits and
  reverse direction; no duplicate damage on a single projectile.
- All three original 2048 x 2048 textures decoded; geometry indices, normals,
  UV registration, GLB buffers and embedded image bytes checked.
- Actual Three.js mesh, animated shell and effect materials compile and link
  under Mesa GLES; textured geometry/effects rendered front-on and at an angle.
- Browser: title -> fighter selection -> lab -> V-Wave -> target KO verified;
  imported asset-ready status and effect controls verified.
- The preview browser only provides compatibility graphics. Full-scene WebGL
  appearance and performance still need testing on your device.

Previous release notes:
========================================
GS Fighter III Lab v0.32 — Fighter Select
Built for Jeremy / Jerm747 — October 31, 2026

Extract the entire ZIP, then open fighter-lab/index.html.

Press Start now opens a responsive fighter selection screen with Akeem and
Nika. Tap once for P1, then once for P2, then Enter Fighter Lab. Each preview
can be tapped to revise that player. Mirror matches are supported.

Tall live 3D previews face inward. Wide screens place the roster between them;
portrait and compact landscape place it below, between menu touch buttons.
Controller detection hides the menu touch buttons, with a manual override.
Left stick selects P1; right stick selects P2; LB/RB lock them independently.
WASD/arrow-key selection, button hints, keyboard focus and Back are included.

See FIGHTER-SELECT.txt for all controls, extension instructions and validation.
The control and integration checks passed; full UI layout and physical gamepad
verification remain for device testing because the preview browser was blocked.

Includes the latest v0.31 V-Wave attack and slow-motion finish update.

Previous release notes:
========================================
GS Fighter III Lab v0.31 — V-Wave & Slow Finish
Built for Jeremy / Jerm747 — October 31, 2026

Extract the entire ZIP, then open fighter-lab/index.html as before.

V-WAVE WORKSHOP
Tap V-WAVE immediately to the right of BLOCK, or press V on the keyboard.
Both Nika and Akeem use an existing forward-punch motion to cast from the hand.
This first 3D prototype has a shaded, animated energy sphere, a pinched flowing
flame tail, orbiting/trailing motes, an aura and a local lightning impact.
It follows the approved Workshop 03 cyan/violet design. No Meshy model is needed
for this prototype; the orb and tail are actual Three.js geometry with animated
materials. A dedicated cast animation and a future Meshy mesh can be refined later.

Ground casts only. Finish an attack before casting; jump, fall and hit reactions
cannot cast. Each projectile does 12 damage, hits once, and has a 1.15-second
cooldown. The button shows the remaining cooldown. Reset, fighter swap and return
to title clear active projectiles and any pending cast. Range hit test also
controls projectile damage. The training partner remains a training dummy.

Settings > V-Wave & finish adjusts color, orb radius (0.22–0.65 m), and travel
speed (3–12 m/s). These settings apply to the next shot. Color options match the
older workshop: original cyan/violet, solar fire, rose plasma, jade energy.

SLOW FINISH
Enabled by default: a short lead-in on the final exchange at low health, then
approximately 1.45 real seconds around the decisive impact and follow-through.
The default impact speed is 0.28x the current simulation speed and eases back
smoothly. Your individual animation speed settings are preserved. Physics,
projectiles, sparks and animation slow together. Camera input remains responsive.

Settings lets you disable it, select Last hit only, or adjust the speed.
Set up final hit resets the fighters within punch range and gives the partner
5 HP. Land a punch or V-Wave to preview the finish. The partner resets normally.

The CPU exhibition also uses the slow finish. Near the timed ending the CPUs
look for a final punch, and the next landed hit receives the slow treatment;
the higher remaining health wins. This is a timed result, not an invented KO.
A short grace period lets an existing fall/recovery or last punch finish.
The winner's final attack follows through before returning to idle.

ARTWORK FOR MESHY
- effects/v-wave-flight-03-original.png: unchanged original transparent six-frame
  atlas recovered from GS-Fighter-V-Wave-Workshop-03.html, 1536 x 1024.
  It was marked approved/integrated in APK 1.0.7 in that workshop's metadata.
- effects/V-Wave-Meshy-Reference.png: a NEW isolated single-projectile PNG made
  from that original using the built-in image generator. It is a clean reference,
  not a pixel-identical frame extraction. Use this single-object image for Meshy.
- effects/v-wave-flight-03-frames.json: original frame registration.
- effects/MESHY-REFERENCE-PROMPT.txt: exact reference-generation prompt.
The PNGs are also linked inside Settings. They are references; the live 3D attack
is procedural, so it works offline without waiting for these image downloads.

VALIDATION
- Full lab logic exercised with the real Nika/Akeem rigs: both casts, single-hit
  damage, cooldown, air rejection, reset cancellation, punch KO and projectile KO.
- Finish clock and swept projectile collision checked at 15, 30, 60 and 120 FPS;
  expiry, both projectile directions and repeated resource cleanup passed.
- Timed exhibition endings exercised with 12 deterministic random sequences.
- Actual Three.js orb and tail shader programs compiled, linked and rendered with
  Mesa GLES. Desktop/390-pixel phone controls and settings inspected in browser.
- Fixed the inherited settings-panel clipping so the workshop opens over the arena.
- This browser only supports the compatibility renderer. The full WebGL scene
  and performance still need a visual test on your Android/desktop device.
- The approved sky, giant-slab inner floor, outer ring and mountain-join assets
  are byte-for-byte unchanged from v0.30.

Previous release notes:
========================================
GS Fighter III Lab v0.30 — Giant Slabs & Mountain Joins
Built for Jeremy / Jerm747 — October 31, 2026

Extract the entire ZIP, then open fighter-lab/index.html.

INNER CIRCLE FLOOR
The approved new warm gray-brown stone artwork covers ONLY the inner circle,
up to the ring's 11.65 m inner radius. Broad irregular slabs, recessed mossy
joints, a few pink petals, and fine mineral/crack detail replace the small
inner-floor tiling. The slab layout is mapped at 3x the original stone size.
A separate height/roughness/cavity map and filtered procedural grain add
light-responsive close-up detail. The surface stays fixed in world space.

Settings > Stone & lighting > Inner slab size adjusts it from 1.5x to 5x.
Changing this control does not resize or retexture the outer ring, surrounding
terrace or walls. Their v0.29 artwork, mapping and geometry remain unchanged.
The new floor receives fighter shadows and the existing foreground vignette.

BACKDROP JOINS
A new asymmetric mountain/forest/river strip covers each of the four seams
between the existing scenic copies. It gives the junction its own uneven
mountain shoulder and differently placed blossoms instead of a mirrored pair.
The strips feather at their side edges, shore and upper sky; alternating
orientation and small image offsets reduce repeated placement. The original
central panorama, sky extension, scenic scale and camera remain intact.
Scenic copies still repeat farther out; this is a local correction at the joins,
not an entirely new 360-degree panorama. Water glints continue in the inserts.

QUALITY
2K / 4K / 8K exports are included. The new slab source returned by the built-in
image generator is 1254 x 1254; the 8192 x 8192 file is a Lanczos enlargement,
not native 8K detail. The scenic insert is used at its native 887 x 1774 size.
The new material uses more GPU memory; 4K and 2K remain available in Settings.
See TEXTURE-LAB.txt for dimensions, controls and memory estimates.

VALIDATION
- Actual embedded 2K asset loader and image decoding passed for both stone
  materials, both surface maps, the panorama and the mountain strip.
- Floor disk stops at the ring's exact inner radius; ring geometry is unchanged.
- Inner size control changes only the inner mapping. Shadow and vignette
  behavior, camera coverage and world-space anchoring are retained.
- 945 camera configurations / 5,670 coverage rays checked.
- Ground, inner floor, wall, panorama and join GLSL shaders compile and link
  with Mesa GLES. The actual panorama/join shaders were also rendered to an
  offscreen flat seam preview and visually checked for blending.
- JavaScript syntax, local file references, image dimensions and ZIP integrity
  checked. Full in-game appearance and performance still need your Android test.

Previous release notes:
========================================
GS Fighter III Lab v0.29 — Sky & Depth
Built for Jeremy / Jerm747 — October 31, 2026

Extract the entire ZIP, then open fighter-lab/index.html.

- Removed all 14 large low-poly trees (trunks and crowns). The natural painted
  cherry blossoms, forest and riverside scenery remain in the artwork.
- Added newly generated sky above the river panorama. The scenic surface is
  twice its former height, with the same width and shoreline position.
- Added opaque blue sky behind the painting so distant floor cannot show
  through above its top edge or its outer feathered edges.
- Added a soft oval shade to the foreground stone only. The fighting lane,
  fighters, scenery and interface remain outside this shading pass.
- Full shade through 1.45x zoom, smoothly fading to zero at 3.2x. It follows
  the eased camera zoom in the lab and CPU demo, including manual zoom bias.
- Settings > Stone & lighting > Foreground shade: 0–65%, starting at 42%.
  Zero turns the shade off. The darkest shaded pixels retain at least 58%
  of their original screen brightness at the default setting.

The continuous stone foreground, camera movement, controls, character models,
fighter motions and CPU demo timing from v0.28 are retained.

Art: stage/textures/river-v29-sky-source.png is the built-in generator's
1402 x 1122 source. Included 2K/4K/8K exports are enlarged, not native 8K.
TEXTURE-LAB.txt has the updated sizes/memory estimates; TEXTURE-PROMPTS.txt
includes the generation brief. No new online dependency was added.

Validation completed:
- 945 camera configurations / 5,670 coverage rays across aspect ratios,
  zoom levels, supported orbit angles and fighter midpoint positions.
- Low-angle upper-screen rays reach the sky before the distant floor;
  lower-screen rays retain continuous stone coverage.
- Ground, wall and panorama shaders compiled and linked with Mesa GLES.
- Tree removal, doubled scenic height, ground-only shade, protected fighting
  lane, zero shade at close range, local asset references and JS syntax.
- Browser check: lab controls loaded; shade slider changed from 0% to 65%.
  The preview browser cannot create a WebGL context, so the final 3D appearance
  and Android performance still require a check on your device.

Previous release notes:
========================================
GS Fighter III Lab v0.28 — Continuous stone foreground

Extract the entire ZIP, then open fighter-lab/index.html.
The 2K / 4K / 8K Texture Lab options from v0.27 are retained.

The foreground now extends to the bottom and both side corners of the scene
through the supported camera rotations and zoom range, in live gameplay and
the CPU demo. A grounded fighter's feet sit about two-thirds down the viewport,
leaving the lower third for stone. Jumping retains additional headroom.

The old gray strip came from the floor being clipped at the camera's near
boundary in wide views. The orthographic camera now pulls that boundary back
far enough to cover the foreground. The stone surface expands with the view;
its world-space texture mapping keeps the existing stone size and orientation.
No black cinemascope bars were added.

Foreground fog is disabled so the stone cannot fade into a muddy gray band.
Fog on fighters and walls is compensated for the camera's depth adjustment.
The sky dome follows the camera, and decorative trees behind the former camera
boundary stay out of the open foreground. Backdrop panels and assets, arena
ridge and walls, controls, fighter motions and demo timing remain in place.
Close-up framing includes enough vertical room for standing fighters and stone.

The extension uses only two ground triangles and reuses the same textures.
There are no additional 8K images or extra texture-memory allocations.

Validation: reproduced the v0.27 lower-edge clipping problem; checked 7,290
camera configurations and 182,250 foreground rays against both the ground
plane and its actual triangles, including near/far clipping and screen corners.
Checked standing/jumping headroom, demo/gameplay integration, JS syntax, and
local file references. Actual browser/Android visual QA remains for your device.

Previous release notes:
========================================
GS Fighter III Lab v0.27 — Texture Lab / 8K Extreme

Open fighter-lab/index.html after extracting the entire ZIP.
Settings > Texture quality switches 2K / 4K Ultra / 8K Extreme (reloads the lab).
Extreme is the fresh-install default, subject to the GPU texture-size limit.

Refined artwork, ground relief/roughness/cavity shading, wet-stone environment
highlights, filtered textures, improved shadows, and live FPS readout.
The floor, scenery placement, camera and fighting behavior remain unchanged.

IMPORTANT: The 8192px assets are enlarged exports of newly refined art,
not native 8K generation. Surface shading adds additional procedural detail.
Read TEXTURE-LAB.txt for dimensions, GPU memory estimates and limitations.

Validation: asset/control/geometry/reference checks and GLSL ES shader compile
and link passed. Actual browser appearance and Android performance remain
unverified in this environment. Please compare 8K and 4K on your device.

Previous release notes:
========================================
GS Fighter III Lab v0.26 — fitted panorama and feathered scenic wings

The entire central panorama now fits above the floor in the starting view with
fighters 11m apart. Its size responds to viewport aspect ratio, retaining the
artwork proportions. Zooming in still magnifies the fixed scenery naturally.
Two mirrored scenic wings on each side reuse the same native image textures.
The outer sides and top fade smoothly into the existing sky; no extra image
assets or per-frame texture uploads are needed. These are scenic copies,
so repeated landmarks can be visible when orbiting. The ground, walls and
fighter tuning are unchanged. Native art remains 1983 x 793, not an 8K master.

Validation: projected full central image fits at five viewport aspect ratios;
shared texture references, low-GPU tiling, controls and jump speeds checked.
Phone/browser visual QA remains, especially feathering while orbiting.

Previous release notes:

GS Fighter III Lab v0.25 — native-resolution river panorama

Backdrop only: a new panoramic Japanese riverside scene with small distant
bridges/shrines, layered mountains, cherry blossoms and a detailed riverbank.
Native generated artwork is 1983 x 793 pixels, stored as lossless WebP.
This is the actual delivered resolution, not an 8K or artificially enlarged master.
The previous 1000 x 563 animated canvas bottleneck is removed for this backdrop.
The native image goes directly to the GPU; subtle water shimmer runs separately
in the shader. Larger images are supported through native-resolution GPU tiles
when they exceed the device texture-size limit. No per-frame texture uploads.
The panoramic surface uses the image aspect ratio without the old floor crop.
Ground, walls, control layout and fighter speeds retain the v0.24 tuning.

Asset: stage/river-panorama-v25.webp (also embedded for offline use).
Built-in image generation prompt: new maximum-detail wide panoramic Japanese
riverside backdrop inspired by arena-clean.png; preserve greens, pink blossoms,
red shrines, cyan river, mountains and right waterfall. Small distant gates and
bridges, no oversized foreground architecture, detailed rock bank and water,
continuous scenery across both sides, no people, text, arena or broad floor.
Requested 3840 x 1536; generator returned 1983 x 793, used at native resolution.

Validation: native image decode, GPU tile bounds/aspect ratio, shader injection,
controls and jump-speed regression checks. Browser/phone visual QA remains.

Previous release notes:

GS Fighter III Lab v0.24 — continuous natural stone arena

New generated stone material covers the entire floor, front terrace, arena ridge
and walls at a consistent world scale (about 4.7 m per tile at default scale 5).
The pale block ring is replaced by a 7–9 cm soft uneven ridge, radius ~12 m.
The ground extends 80 m in every direction. Backdrop scale is preserved.
Stone scale, rotation and moisture controls now affect all stone surfaces.
Nika jump/backflip remain 1.5x; other fighter tuning and controls are preserved.

Asset: stage/stone-v24.png, generated with the built-in image generation tool.
Prompt: seamless orthographic Japanese riverside flagstone base-color swatch;
broad irregular weathered brown-gray/taupe slabs, muted mauve and ochre mineral
variation, sparse olive moss in dark thin joints, uniform diffuse lighting,
no perspective, objects, white limestone, directional shadows or text.

Validation: scripted controls, jump timing, surface geometry, texture decoding
and shader injection checks. Phone/browser rendering still needs visual QA.

Previous release notes:

GS Fighter III Lab v0.23 — shared controls and Living River scenery

Play as Akeem / Nika now switches in place and opens the same full controller.
Fighter actions, clip workshop, labels and callbacks rebind with each switch.
The original animated river painting returns on a stationary scenic arc.
Textured stone ground extends to a 60 m radius, with matching texture density.
Short side walls frame the view; other wall layouts remain selectable.
Default camera tilt is lower to show the scenery behind the fighters.
Nika regular jump and backflip are 1.5x, including takeoff, flight and landing.
Her other speeds and Akeem tuning remain; demo waits 20 seconds and runs up to 45.

Validation: repeated fighter switching, both move sets, speed settings, CPU demo,
actual image decode, animated scenery canvas and floor maps passed scripted checks.
Phone/browser visual and touch QA still needed; no browser renderer was available.

Previous release notes:

GS Fighter III Lab v0.22 — matched Akeem / Nika speed

Both fighters now use the same playback targets:
- Attacks, jumps, reactions, falls and get-ups: 2x.
- Idle, walking, running and backward locomotion: 1.5x minimum.
- Arena movement and airborne drift: 1.5x original world speeds.
- Jump flight follows 2x source timing; aerial transitions stay at least 1.5x.
Individual move trims and source clips are preserved, so their attack durations
can still differ even at the same playback multiplier.
Nika retains her v0.21 speed tuning. Manual speed preview controls remain available.
Stage, lighting, wall controls and 20-second idle demo schedule are unchanged.

Validation: JavaScript syntax plus actual-rig checks of Akeem's standing, locomotion,
attack and airborne playback rates, matched defaults, and CPU demo operation.
Visual pacing still needs on-device play-testing.

Previous notes:
========================================
GS Fighter III Lab v0.21 — darker atmosphere, demo continuity, Nika speed

LIGHTING / STAGE
- Reduced wall material brightness to retain the stone relief under the key light.
- Darker grass and trees outside the court.
- Stationary shader sky: soft cloud-gray overhead glow, darker natural horizon.
  No physical ceiling or moving backdrop. Dark distance fog blends the outer area.
- Fighter key lighting and existing floor texture remain; no new artwork was
  attached during this update. Additional artwork can be used in a later texture pass.

DEMO CLEANUP
- Non-loop CPU actions now retain their root travel in arena coordinates through
  attacks, falls and get-ups, instead of easing back to the old starting anchor.
- Looping movement stays pinned, driven by arena locomotion.
- Spacing and arena limits resolve together. Fallen/recovering CPUs cannot take
  new hits until they are ready, avoiding interrupted recovery/KO inconsistencies.
- One demo fight, 20-second idle, up to 45 seconds, with resets hidden by the title.

NIKA
- All actions including attacks, reactions and jumps default to 2x.
- Idle/walk/run/back movement default to 1.5x.
- World locomotion and jump drift increased 1.5x.
- Regular jump flight now follows 2x source timing rather than stretching back
  to the older flight duration. Air attacks retain at least 1.5x playback, with
  flight timing adjusted without changing the current arc phase.
- Speed selector remains available for manual workshop overrides.

Validation: real-rig Node tests with mocked rendering cover the existing combat
and spacing behavior, Nika speed floors and jump timing, and Akeem position
continuity across demo moves. Texture maps decode successfully. Browser visual
verification of the shader and final lighting is still needed on-device.

Previous notes:
========================================
GS Fighter III Lab v0.20 — demo continuity & earth-tone lighting

- Initial and between-demo title wait reduced to 20 seconds.
- One CPU fight, up to 45 seconds, continues to repeat.
- Demo idle/walk/back loops now pin their local root: movement comes from the
  arena controller, preventing a root-motion rewind at each walk-cycle loop.
- The title becomes fully opaque before training positions are restored after
  a demo, so that reset is hidden. Each new demo still sets up behind the title.
- Walls now use earth-tone mineral variation: brown, ochre, deeper umber and
  restrained plum/copper accents. Existing geometry and fade controls remain.
- Floor retains the original stone image with a subtle 20% multiply earth wash.
- Warm gold key light and softer lavender fill add accents without flashing.
- Player movement, controls, combat timings and wall layouts are unchanged.

Validation: texture/map test and real-rig regression harness with mocked rendering,
including demo-loop root policy and title coverage on returns. On-device visual
confirmation is still needed for the final color balance and transitions.

Previous notes:
========================================
GS Fighter III Lab v0.19 — upright stone wall workshop

The attached Meshy FBX is a stone-block wall mesh without material, UV or image
texture data. This build uses its actual shape with a warm, subtly varied stone
material. It does not claim to reproduce a texture that was absent from the FBX.
The display version is clustered from 636,234 to 11,880 triangles per panel.
The original upload is preserved separately; the game embeds its lighter geometry
in stage/wall-mesh.js and needs no FBX loader or external network request.

SETTINGS > WALL WORKSHOP
- Rear segments (default): five panels in three separated runs, angled side returns.
- Straight rear wall: five panels across the back.
- Circular border: panels around the arena with a rear gateway.
- No walls: restore the open court.
- Height: 1–3.5 metres, default 2.4m.
- Distance: rear-wall setback / circular-wall radius, 5–11m, default 8m.
- Opacity: 10–100%.
- Fade walls in front: smooth automatic fade to 6% of chosen opacity when a
  near-side panel crosses the fighters' viewing corridor. Far-side walls stay solid.
  Walls are decorative scenery; they do not add new combat collision.
- These workshop settings reset on page reload.

Floor moisture/lighting, fighter motion, camera controls, health and the single
25-second-idle demo cycle are unchanged.
Measurements and source/display polygon counts are in scene-dimensions.json.

Validation: parsed and inspected FBX geometry, verified finite indexed mesh data,
tested layout switching, transparency transitions and numeric bounds in Node with
real Three.js geometry and mocked rendering. Existing combat, bone continuity,
sweep, camera and demo-spacing tests passed. Phone visual/performance check needed.

Previous notes:
========================================
GS Fighter III Lab v0.18 — original stone surface & lighting workshop

Stage and demo presentation update. Player movement and combat are unchanged.
One mixed-move CPU fight repeats after each 25-second title interval.
Demo spacing now resolves visible hip/body overlap, including animation sway.
The camera returns to its front view at the start of each demo.
The original river-stage foreground paving is cropped at runtime from its embedded
artwork and mapped onto the 3D circular court. It follows the floor as you orbit.
The default mapping repeats five times, rotated 30 degrees. Mirrored wrapping
softens texture boundaries. The original painted perspective/highlights remain
in the source; this is a reused illustration, not a newly scanned PBR material.
Derived bump and roughness maps add shallow surface relief and damp highlights.
A warm overhead key and restrained cool fill add shape without animated lighting.

WORKSHOP: open Settings > Stone & lighting.
- Stone scale: higher values make the texture's individual stones smaller.
- Rotation: 0–180 degrees.
- Moisture: controls roughness and the clearcoat sheen.
- Key light: warm spotlight intensity.
These values apply live and reset on page reload.
No new external downloads. If texture loading fails, the base stone remains visible.

Validation: JavaScript syntax, stage texture/map setup and slider bounds, plus the
existing real-rig combat regression harness with mocked rendering.
Visual lighting and texture scale need an on-device check.

DIMENSIONS
See scene-dimensions.json for measured mesh bounds and arena dimensions.
Platform radius 12m, diameter 24m, area ~452.4 square metres.
Both fighter meshes are normalized to 1.70m (~5 ft 7 in) in their bind pose.
These are scene-scale measurements, not character biography heights.

Previous notes:
========================================
GS Fighter III Lab v0.17 — courtyard, touch camera, responsive combat

Open fighter-lab/index.html (or serve fighter-lab with a local web server).

CONTROLS
- Drag the arena left/right: orbit 45 degrees either side of the front view.
- Drag vertically: modest camera elevation adjustment.
- Pinch: zoom. Mouse wheel and +/- also zoom. Circular-arrow button resets.
- Gamepad right stick: camera orbit/elevation. LT zooms out; RT zooms in.
- Controller settings now open in a compact Settings panel.
- Controller sizing follows both screen width and height, with safe-area padding.
- Cancel windows OFF by default, per play-test feedback. Smart transitions remain ON.

COMBAT
- Nika and Akeem have shorter strike windups and recoveries, based on sampled clips.
- Nika high-punch preparation trimmed from ~1.9s to ~0.2s at her preset speed.
- A four-input rhythm buffer lets a strike reach contact before a queued strike starts.
  Inputs older than 1.5 seconds expire; excess taps beyond four are ignored.
  This avoids restarting a punch endlessly before it can connect.
- Pose transitions now include the on-screen foot-IK correction, fixing an immediate
  leg snap during rapid kick/punch changes.
- Training hits check animated hand/foot reach during extension.
- Sweep hits cause a knockdown, then get-up. Fallen/recovering opponents are protected.
- Hit reactions skip preparation and blend faster.
- Health bars added. The partner takes damage; the player bar remains full because
  this workshop's partner does not attack. CPU demos still damage both fighters.
- KO restores the training positions/health after three seconds. Reset does this too.
- The existing 25-second title / up-to-45-second demo cycle remains.

STAGE
Open 3D circular flagstone court, low edging, an open walkway and sparse trees.
No moving 2D background, roof or ceiling. Tile geometry is instanced for mobile.
Prior river assets remain in the package but are inactive in this version.

VALIDATION
Real rigs exercised in a headless Node harness with mocked UI/rendering:
jab contact/damage, sweep knockdown/get-up, rapid-input buffer, camera bounds,
and 150 Nika transitions. Max immediate angular discontinuity ~0.06 degrees,
bone-length error under 0.000001m; no inertia safety resets during that sequence.
JavaScript syntax checked. Browser visual and physical-phone/gamepad verification
still needed; a browser binary could not be downloaded in this environment.

Previous build notes:
========================================
GS Fighter III Lab v0.16 — live attract demos
Open fighter-lab/index.html, or serve the folder with a local web server.

NEW:
- Leave the title idle for 25 seconds to start CPU vs CPU.
- Three bouts, up to 45 seconds each (a KO ends after a 3-second hold).
- 25-second title intro replay between bouts.
- After bout three: replay the title for 25 seconds, then repeat from bout one.
- Any key, touch/click, or gamepad button/stick exits the demo to a fresh
  title intro. Release and press again to enter the workshop.
- Timers pause in hidden tabs. Workshop play does not trigger demos.
- Live animations, range-based damage, blocking, health bars and close camera.
  Jumping punches, flying kicks and trimmed sweeping kicks are included.
  No prerecorded videos or additional downloads.
- This ZIP contains only Akeem and Nika. All three bouts use those two rigs
  with punch, kick and mixed tactics and different stage lighting.
  Six distinct fighters require four additional compatible rigs/motion sets.
- Timing controls are grouped in demoConfig in lab.js.
- Existing workshop controls and fighter timings are preserved.
Validation: JavaScript syntax and isolated attract-cycle/input state tests.
A full browser visual test was unavailable in the build environment.

Previous build notes follow:
========================================
GS FIGHTER III — FIGHTER LAB v0.14

START
Extract the entire ZIP, then open fighter-lab/index.html in a modern browser.
Keep all files together. Assets and Three.js are included for offline use.
Landscape is recommended for touch. Enable hardware acceleration for best results.

THIS PASS
Akeem is controllable; Nika is a passive training partner. The arena shows a horizontal fighting lane and metre markers. Starting positions are 11 m apart: walking at 1 m/s takes approximately 10 seconds to close to the 1 m stopping distance. Running moves at 2.6 m/s.
Hold Left/Right to walk indefinitely. Double-tap the same direction within 320 ms and keep holding: walk for 0.5 seconds, then run. Holding alone never switches to running.
Both jumps play at 1.5x; other Akeem actions play at 2x; idle, walking and running remain 1x. The included GLBs retain their original clip timing.
MOTION LOGIC (new in v0.10, motion-logic.js — shared by every fighter)
1. Clip analysis: each clip is sampled at 30 Hz and given a pose signature per frame (hip height, then feet, hands and head relative to the hips, plus their velocities). The analysis also finds the lead-in (dead frames), the active frame (furthest reach of a hand or foot) and the net root travel.
2. Pose-matched entry: a new move starts at the frame closest to the current body instead of frame 0. Idle, walk and run search their whole cycle (phase-matched feet). Strikes and guards may skip up to half of their windup when the body is already part-way there. Jumps and reactions skip only dead lead-in frames.
3. Inertialized transitions: the gap between the on-screen pose (and its speed) and the new clip decays through a critically damped spring (the PD-controller form of a control loop). Momentum carries through instead of freezing. Hips settle first, then legs and spine, then head, arms and hands. Large hip turns automatically take longer (up to 2.5x).
4. Root policies (FighterMoveRules in fighter-defaults.js): pinned for loops; anchored for strikes, guards, jumps and hit reactions (lunges show as body sway that returns home during recovery, so repeated or interrupted moves never drift); travel for knock-down and get-up, which cancel out.
5. Cancel windows and buffer: a strike pressed during another strike is buffered. It links after the active frame as soon as the body reaches a pose the next move can start from (or 60% into recovery at the latest). Guard, crouch, hit and fall interrupt immediately. Untick "Cancel windows" to let any button interrupt instantly.
Range hits now fire on each clip's measured active frame and include the visual lunge.
"Smart transitions" off restores v0.9 behaviour for A/B comparison. "Settle" sets the master settle time (default 140 ms).
v0.14 — GS FIGHTER III INTEGRATION
Title screen: your animated intro (intro.html) plays first; Press Start (button, any key or tap) begins. Title in the header returns to it.
Stage: the Living River plate (stage/) is drawn behind the fighters. Its flagstone line is pinned to the 3D floor at every zoom, and it pans at a quarter of camera speed for parallax. The fighters cast soft shadows onto the painted floor. Sky menu: Sunset, Night, Storm, Morning; each preset also tints the fighter lighting. The plate is embedded (stage/arena-clean.js) so the effects work when opened from a folder. Grid shows the old metre markers.
Nika is the player; Akeem is the training partner. "Play as Akeem" swaps them (index.html?player=Akeem).
Nika uses her 23 workshop clips with the speeds from Nika-workshop-timings.csv. Move map: punches L/M/H = Right Jab / Left Jab / Straight Punch, kicks L/M/H = Knee Strike / Double Kick Forward / High Kick, block Block5, hit Face Punch Reaction, fall Knock_Down_1. Same air game, sweep, step back and back walk as Akeem. Roundhouse_Kick, Flirty_Strut and Face_Punch_Reaction_1 are in her library but unassigned; swap any of them in through FighterDefaults.Nika in fighter-defaults.js.
Nika had no get-up clip, so she borrows Akeem's Stand_Up1 (borrowed-clips.js; rotations copied by bone name, hip height scaled). It was the closest match to how she lands. Her knock-down stumbles forward, so her get-up stays on the spot.
Her three new clips (Kung_Fu_Punch, Step_Back, Walk_Backward) were checked against Akeem's versions: same 7–9% limb difference as clips both share. No twisting.
Torso twist fix: root cause found. The three.js mixer only rewrites a bone when its value changes, so the game was reading last frame's blended pose back as the clip pose and blending it again. Every frame now samples the clip data directly, the mixer only keeps time. Also: a blend restarted on top of a blend keeps 35% of its momentum; carried spin is capped and dropped near a half turn; only the hips get position offsets; a safety net snaps to the clean pose if a blend ever exceeds 175°. Back walk and fast back walk share a clip, so a double-tap only changes speed. Measured after a flurry plus 14 back double-taps: extra chest bend 35–37° (normal blending; v0.13: 173°), torso stretch 2.5% (v0.13: unbounded).
↑+← = backflip (the purple Jump button still works). Space during an ↑ jump: the backflip takes over the jump's air section and lands at normal height.
Circular 8-way pad: the whole ring is one touch zone and the thumb angle snaps to 8 directions like an arcade gate. ↗ jumps forward, ↖ backflips, slide around without lifting, back to centre to release.

AIR GAME (v0.13)
Air punches: punch while airborne after ↑. First half of the jump = rising punch (right hand, Jumping_Punch 0.67–0.95 s entry, hit at 1.13 s); second half = falling punch (left hand, entry 1.0–1.2 s, hit at 1.33 s). Like the flying kick, the clip is picked up at the frame closest to the jump pose and timed to land with the jump. Its hip height is scaled to 52% so it matches the regular jump (no more floating above Nika). Punch during the jump's crouch = rising punch at takeoff.
One air attack per jump. Kick before takeoff = flying kick from the ground (whole crouch, not just 150 ms). Extra presses while airborne are dropped, never saved for the landing. After touchdown, a fresh press cancels the landing immediately.
Late presses: a press waiting for a cancel point is dropped after 0.3 s (FighterDefaults.Akeem.input.bufferMax).
Directional jumps: the direction held when the jump is pressed or at takeoff sets air drift. ↑+→ about 1.2 m forward, ↑+← about 1.0 m back, Space (backflip)+← about 1.3 m back with a little extra height. Neutral jumps stay in place. Tune in FighterDefaults.Akeem.air.

NEW MOVES (v0.12)
Four clips from Meshy_AI_Crimson_Teal_Champion_biped_7 (same Akeem skeleton) live in akeem-extra-clips.js: Kung_Fu_Punch, Rising_Flying_Kick, Step_Back, Walk_Backward. They were converted from the merged FBX by the same method as the original clips (verified identical on Walking and High_Kick). The downloadable GLB still holds the original 23.
Jump air time: from the jump clip's own takeoff to its landing, the hips get an extra 0.5 m arc and the airborne frames stretch to 0.8 s (was about 0.3 s). The camera rises with the jump. Tune FighterDefaults.Akeem.air.
Flying kick: ↑ then any kick while airborne enters Rising_Flying_Kick at the frame closest to the jump pose and finishes inside the remaining air time. ↑ and a kick together (within 150 ms) launches the flying kick's own full takeoff. It travels forward about 1.7 m.
Spin sweep: while crouching, low kick (K) plays only the low spin-kick section of Kung_Fu_Punch (3.25–4.0 s). It picks up at the frame closest to the crouch, makes one full spin, and ends crouched again; keep holding ↓ to stay down.
Backward movement: tap ← = Step_Back (about 0.44 m). Hold ← = step, then Walk_Backward at 0.9 m/s. Double-tap and hold ← = faster back walk at 1.4 m/s. No more moonwalk.

FOOT PLANTING (new in v0.11, foot-ik.js — shared by every fighter)
Runs last every frame, after the fighter is placed in the arena. A foot whose ankle or toe is at the floor and barely moving is planted: its spot is locked, and two-bone IK (thigh + shin, law of cosines, knee kept in the animation's bend plane) holds the ankle on that spot while the body settles or travels. The foot keeps the animation's rotation. When the animation lifts or drives the foot (a step, a shuffle, a kick), the lock releases and the foot eases back to the animation over about 0.12 s. Locks also release if the leg would over-stretch, with a short cooldown so a foot never pops between spots.
Stride matching: with Foot IK on, walk and run play at the rate where the clip's feet match the arena speed (Akeem's walk clip moves about 1.25 m/s, so it plays near 0.8x to match 1 m/s). Arena speeds are unchanged.
Foot planting is off for knock-down and get-up (ik:false in FighterMoveRules). Untick "Foot IK" to compare. "Skeleton + plants" shows gold floor rings under planted feet.
Measured: idle foot slide 0.00 m (was 0.67 m over 2 s); slide while the animation wants a foot planted fell from 274 cm to 90 cm over a walk, run and strike-chain test.
Not yet included: hip lowering when a planted foot is out of reach, and uneven-ground or toe IK.
Camera angle stays fixed. Auto zoom eases from wide framing toward 3x at mid-range and 5x toe-to-toe. Short viewports retain a minimum vertical frame to keep standing fighters visible. +/- and the mouse wheel adjust the auto-framing preference. Camera follows the fighters' midpoint horizontally.

CONTROLS
Arrows Left/Right: walk; double-tap then hold: run
Up: regular jump; Down or C: crouch
Space: backflip (purple Jump)
J: mid punch; U: high punch; L: low punch
O: mid kick; P: high kick; B: guard
F: fall then get up; H: hit reaction; R: reset positions
Low kick uses High_Kick at 2x (K on keyboard), as a temporary mapping; the source animation remains a high kick.
Controller styling reuses the original Groove Squad Get Down arcade D-pad and round face-button CSS, with new 3D input bindings. Punches are blue, kicks orange, block gray, and extra Jump/Duck purple.
Vibration uses browser support when available; physical-device haptics and simultaneous touch still need device testing.

WORKSHOP
Move workshop exposes Akeem's 23 clips, timeline, speed, pose inspection, and recovery choices. Stand_Up1 is the default; Stand_Up3 and Stand_Up7 are alternatives, all at 2x. Nika includes 20 clips in her source asset.
Close-range attacks increment Range hits and trigger Nika's reaction. This is a once-per-attack distance check, not final limb hitboxes, health, or damage logic.
The compatibility renderer supports environments without WebGL but has simpler shading and slower performance. Hardware WebGL rendering should be used for gameplay evaluation.

VERIFICATION
v0.10 checks: six chained mid kicks, jabs and roundhouses produce 0.00 m drift (v0.9: +2.18 m, +1.02 m, +1.91 m). Worst per-frame limb jump at a move switch is 0.09 m (v0.9: 0.20 m during its blend). Walk/run/idle transitions are phase-matched. All seven strikes still register at close range, and fall plus get-up returns to the same spot.
Automated checks cover 10-second walking approach, indefinite walking, double-tap running delay, retained world positions after attacks and recovery, range hit/miss behavior, pose bounds, transitions and repeat seeking. Desktop and compact landscape layouts were visually checked. Full combat balance, physical gamepads, foot planting and device performance remain future work.
