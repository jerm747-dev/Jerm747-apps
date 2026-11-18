# 747 GP hazards and race results

## Try the feel

Open [the hazard test](747GP-Hazard-Test.html) in a browser. Tap Side rub, Rear bump or Barrier hit twice to hear successive impact variations. Compare a barrier scrape with the grass, gravel, curb and tire sounds. Change test strength before tapping a scenario. Haptics uses the first connected controller with rumble support, then falls back to browser-supported phone vibration. Phone pulse length carries the difference in strength.

## In the race

Launch 747 GP and open Settings. Enable **Sound** and adjust the master and FX levels. **Hazard haptics** has its own switch. Choose Arcade with opponents to try vehicle contact. Time Trial supports surface and barrier effects.

## How the contacts feel

| Event | Driving response | Sound and feedback |
| --- | --- | --- |
| Side contact | Overlapping cars separate along the contact normal. Most forward speed carries through a glancing hit. | A short panel knock and a sideways suspension movement. |
| Nose-to-tail bump | Closing speed transfers between the two cars. Both settle back onto their suspension. | A louder knock and a longer pulse as closing speed rises. |
| Barrier | The wall cancels inward motion and rebounds up to 4 m/s. Motion along the rail carries through. | Metallic impact on entry, with sustained scrape when sliding along the rail. |
| Grass, gravel and curb | The surface comes from the same track coordinates used to draw the verge, apron and curb. | Grass rustle, gravel chatter or a repeating curb thump, scaled by speed. |
| Tire slip | The existing slip angle drives the effect on asphalt. | Tire squeal and light vibration under sustained slip. |

The 747 Test Circuit has a visible gravel strip 24.5–29% around the lap, 7.5–16 m from the centre on the negative-normal side. Other road-course verges use grass. The oval's paved apron has asphalt feedback. Additional gravel strips use the same `gravelZones` entries for rendering and detection. Each entry has lap fractions `from` and `to`, and signed lateral limits `min` and `max` in metres.

## The pieces

- **contact.js** calculates oriented car overlap, barrier rebound, and damped suspension motion. The contact gate starts a new impact at 0.85 m/s of closing speed, then rearms after about 110 ms of separation. The player and AI cars share these calculations.
- **feedback.js** synthesizes four body impacts, three barrier impacts and five continuous textures. Contact strength controls the mix. Nearby AI-to-AI collisions can be heard. Vibration belongs to the player's vehicle.
- **classification.js** measures interpolated line crossings, orders entrants and updates race history. AI and player timing share the same simulation step and green flag.
- **wav/** contains the same twelve sounds as 24 kHz, mono, 16-bit PCM. The playable game generates its sounds locally. The WAVs are available for auditioning, editing or swapping into another audio system.

## Race records

**Race Order** shows each finisher's place and elapsed time to the millisecond. Other finishers also get a gap to the leader. The field continues racing while the results sheet is open, and a still-running driver shows a lap number until they finish. An AI can set the first result before the player crosses.

Each race has one local history entry under the existing `gp747results` key. Its `drivers` list contains driver ID, name, position, status, completed lap times, best lap and total race time in seconds. The game updates that entry after each finish. If a session with a recorded finisher ends early through normal navigation or restart, remaining drivers get `dnf` and a null total. An abrupt process kill preserves the last saved checkpoint. Existing player history and the 300-entry limit are supported.
