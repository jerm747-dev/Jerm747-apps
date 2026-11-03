/* Akeem defaults dictated by Jeremy. Each entry: source clip, speed. */
window.FighterDefaults={
 Akeem:{idle:['Idle_10',1],walk:['Walking',1],run:['Running',1],crouch:['CrouchLookAroundBow',2],jump:['Backflip',2],up:['Regular_Jump',2],hk:['Roundhouse_Kick',2],mk:['Double_kick_forward',2],hp:['Right_Uppercut_from_Guard',1.5],mp:['Left_Jab_from_Guard',1.5],lp:['Left_Hook_from_Guard',1.5],block:['Block2',1.5],hit:['Face_Punch_Reaction_1',1.5],fall:['Knock_Down',1.5],recover:['Stand_Up1',1.5]},
 /* Nika v0.14: speeds from Jeremy's Nika-workshop-timings.csv (Nika Motion Workshop 1.0). */
 Nika:{idle:['Idle_5',2],walk:['Walking',1],run:['Running',1],crouch:['CrouchLookAroundBow',2],jump:['Backflip_Jump',2],up:['Regular_Jump',1.5],
  hk:['High_Kick',2],mk:['Double_kick_forward',1.5],lk:['Boxing_Guard_Step_Knee_Strike',1.5],
  hp:['Boxing_Guard_Prep_Straight_Punch',1.5],mp:['Left_Jab_from_Guard',2],lp:['Right_Jab_from_Guard',2],
  block:['Block5',1.5],hit:['Face_Punch_Reaction',1.5],fall:['Knock_Down_1',1.5],recover:['Stand_Up1',1.5],
  jumpkick:['Rising_Flying_Kick',1.5],airpunch:['Jumping_Punch',1.5],sweep:['Kung_Fu_Punch',1.5],
  stepback:['Step_Back',1.5],back:['Walk_Backward',1],backrun:['Walk_Backward',1]}
};

// v0.8 workshop: all Akeem actions at 2x; locomotion and idle stay 1x.
for(const [id,preset] of Object.entries(window.FighterDefaults.Akeem))preset[1]=["idle","walk","run"].includes(id)?1:2;

// v0.9: slower jumps and temporary low-kick assignment.
FighterDefaults.Akeem.jump[1]=1.5;
FighterDefaults.Akeem.up[1]=1.5;
FighterDefaults.Akeem.lk=['High_Kick',2];

// v0.12: new Akeem clips (akeem-extra-clips.js) and air time.
Object.assign(FighterDefaults.Akeem,{
 jumpkick:['Rising_Flying_Kick',1.5], // ↑ then any kick in the air, or ↑ + kick together from the ground
 sweep:['Kung_Fu_Punch',1.5],         // crouch + low kick: only the low spin-kick section of the sequence is used
 stepback:['Step_Back',1.5],          // tap ←
 back:['Walk_Backward',1],            // hold ←
 backrun:['Walk_Backward',1]          // double-tap ← and hold (stride matching raises the rate)
});
/* Air time: between the clip's own takeoff and landing frames, the hips get an extra arc of `height` metres
 * and the airborne part of the clip is stretched to last `time` seconds. */
FighterDefaults.Akeem.airpunch=['Jumping_Punch',1.5]; // punch in the air: only the airborne section is used
/* drift: sideways speed (m/s) while airborne, taken from the direction held at takeoff.
 * ↑ + → jumps forward, ↑ + ← jumps back; Space + ← backflips backward. */
FighterDefaults.Akeem.air={up:{height:.5,time:.8,drift:{fwd:1.5,back:1.2}},jumpkick:{height:.35,time:.7},jump:{height:.25,time:.6,drift:{fwd:0,back:2.2}}};
/* Input timing (seconds). bufferMax: a press waiting for a cancel point is dropped after this long. */
FighterDefaults.Akeem.input={bufferMax:.3,kickThenUp:.15};
/* Arena speeds in m/s. */
FighterDefaults.Akeem.speeds={walk:1,run:2.6,back:.9,backrun:1.4};

/* v0.10 move rules: how each move enters, moves the fighter, and accepts the next input.
 *  kind   loop   = idle/walk/run: enter at the phase-matched point of the cycle.
 *         hold   = block/crouch: interrupt anything immediately; enter part-way into the raise if the pose already matches.
 *         strike = punches/kicks: enter part-way into the windup if the pose matches; next strike is buffered
 *                  until the active frame (cancel window).
 *         air    = jumps: always full windup; can be cancelled late (cancel at 80%).
 *         react  = hit/fall/get-up: start after dead lead-in frames.
 *         step   = one-shot footwork (step back): starts after the lead-in, interruptible, returns to idle/walk.
 *  window/end/active = use only part of a clip: entry search range, stop time and hit frame (clip seconds).
 *  root   pinned   = hips locked over the fighter's spot (loops).
 *         anchored = root motion is visual sway only and returns home during recovery. No drift.
 *         travel   = root motion moves the fighter in the arena (knock-down slides back, get-up steps forward).
 *  ik     false = foot planting off for this move (feet follow the animation exactly).
 *  Change one word to change a move, e.g. mk:{kind:'strike',root:'travel'} makes Double Kick Forward actually advance. */
window.FighterMoveRules={
 idle:{kind:'loop',root:'pinned'},walk:{kind:'loop',root:'pinned'},run:{kind:'loop',root:'pinned'},
 block:{kind:'hold',root:'anchored'},crouch:{kind:'hold',root:'anchored'},
 lp:{kind:'strike',root:'anchored'},mp:{kind:'strike',root:'anchored'},hp:{kind:'strike',root:'anchored'},
 lk:{kind:'strike',root:'anchored'},mk:{kind:'strike',root:'anchored'},hk:{kind:'strike',root:'anchored'},
 jump:{kind:'air',root:'anchored',cancel:.8},up:{kind:'air',root:'anchored',cancel:.8},
 hit:{kind:'react',root:'anchored',cancel:.35},
 jumpkick:{kind:'strike',root:'travel',cancel:.85,ik:false},
 sweep:{kind:'strike',root:'anchored',window:[3.25,3.5],end:4,active:3.8},
 // Air punch: rising = right punch on the way up, falling = left punch on the way down. land = the clip's touchdown frame.
 airpunch:{kind:'strike',root:'travel',ik:false,cancel:1,end:1.68,land:1.55,hipY:{base:.9,scale:.52},rising:{window:[.67,.95],active:1.13},falling:{window:[1,1.2],active:1.33}}, // clip segment: enter from the crouch, one full spin, end crouched
 stepback:{kind:'step',root:'travel'},back:{kind:'loop',root:'pinned'},backrun:{kind:'loop',root:'pinned'},fall:{kind:'react',root:'travel',ik:false},recover:{kind:'react',root:'travel',ik:false}
};

/* Nika shares Akeem's air time, speeds and input timing; change any of these to give her her own feel. */
FighterDefaults.Nika.air=JSON.parse(JSON.stringify(FighterDefaults.Akeem.air));
FighterDefaults.Nika.speeds={...FighterDefaults.Akeem.speeds};
FighterDefaults.Nika.input={...FighterDefaults.Akeem.input};
/* Nika's Knock_Down_1 stumbles forward 0.9 m before she lands; her borrowed get-up stays on the spot instead of
 * stepping forward again, so a knock-down never carries her into her opponent. */
FighterDefaults.Nika.rules={recover:{root:'anchored',ik:false}};

/* v0.22: matched pace for both fighters; source clips and trims stay individual. */
for(const name of ['Nika','Akeem']){
 const fighter=FighterDefaults[name];
 for(const [id,preset] of Object.entries(fighter)){
  if(Array.isArray(preset)&&typeof preset[0]==='string')
   preset[1]=['idle','walk','run','back','backrun'].includes(id)?1.5:2;
 }
 for(const id of Object.keys(fighter.speeds))fighter.speeds[id]*=1.5;
 for(const cfg of Object.values(fighter.air))if(cfg.drift)for(const id of Object.keys(cfg.drift))cfg.drift[id]*=1.5;
}

// v0.23: Nika regular jump and backflip use a consistent 1.5x cadence.
FighterDefaults.Nika.up[1]=1.5;
FighterDefaults.Nika.jump[1]=1.5;

/* Painted Crest v6: consistent, brisk ground strikes across all 14 fighters.
 * Newcomers inherit these rates through their existing move-source mappings. */
for(const fighter of Object.values(FighterDefaults)){
 for(const id of ['lp','mp','hp'])fighter[id][1]=2.2;
 for(const id of ['lk','mk','hk'])fighter[id][1]=2.4;
}

/* Shared calibrated clip windows are ready before a newcomer inherits them. */
window.FighterCombatRules={
 Nika:{hp:{window:[1.55,1.7],active:1.9,end:2.34},mp:{window:[.18,.31],active:.5,end:.98},lp:{window:[.28,.43],active:.63,end:1.13},
 hk:{window:[.48,.62],active:1,end:1.64},mk:{window:[.38,.51],active:.9,contacts:[.9,1.43],end:1.95},lk:{window:[.16,.25],active:.5,end:1.12},
 sweep:{window:[3.25,3.42],active:3.73,end:4.22},hit:{window:[.3,.3],end:1.08}},
 Akeem:{hp:{window:[.08,.16],active:.367,end:.8},mp:{window:[.18,.3],active:.5,end:1.0},lp:{window:[.06,.12],active:.3,end:.78},
 hk:{window:[.73,.9],active:1.4,end:2.0},mk:{window:[.38,.51],active:.9,contacts:[.9,1.4],end:1.95},lk:{window:[.48,.62],active:1,end:1.65},
 sweep:{window:[3.25,3.42],active:3.73,end:4.22},hit:{window:[1.62,1.62],end:2.45}}
};
for(const [name,set] of Object.entries(FighterCombatRules)){
 const fighter=FighterDefaults[name];fighter.rules={...fighter.rules};
 for(const [id,rule] of Object.entries(set))fighter.rules[id]={...fighter.rules[id],...rule};
}

/* 1.3.3 (Jeremy): every fighter at a brisk 2x — idle and all moves including walk, run, back steps, jumps and backflip.
 * Ground speeds and air drift scale with it (feet stay planted); hang time is 15% shorter so jumps keep pace.
 * Newcomers inherit all of this through their Akeem/Nika move sources. */
for(const fighter of Object.values(FighterDefaults)){
 for(const [id,preset] of Object.entries(fighter))if(Array.isArray(preset)&&typeof preset[0]==='string')preset[1]=Math.max(preset[1],2); // idle included
 if(fighter.speeds)for(const id of Object.keys(fighter.speeds))fighter.speeds[id]*=4/3;
 if(fighter.air)for(const cfg of Object.values(fighter.air)){if(typeof cfg.time==='number')cfg.time*=.85;if(cfg.drift)for(const id of Object.keys(cfg.drift))cfg.drift[id]*=4/3;}
}

/* 1.4.1 (Jeremy): "take the front part of the punch". Every ground strike starts close to its hit frame, so a press
 * turns into contact quickly instead of playing the whole wind-up. STARTUP is real seconds from button to contact
 * (at the move's play rate). Entry keeps a short pose-matched range just before that point.
 * Newcomers inherit these through their Akeem/Nika move sources (newcomers.js copies the rules). */
window.FighterStartup={lp:.08,mp:.08,hp:.1,lk:.12,mk:.13,hk:.14,sweep:.16};
for(const name of ['Akeem','Nika']){
 const f=FighterDefaults[name];
 for(const [id,target] of Object.entries(FighterStartup)){
  const r=f.rules?.[id],pre=f[id];if(!r||!r.window||r.active==null||!pre)continue;
  const rate=pre[1]||2,start=Math.max(r.window[0],r.active-target*rate),width=Math.min(.06,Math.max(0,r.active-start-.02));
  r.window=[+start.toFixed(3),+(start+width).toFixed(3)];
 }
}
/* 1.4.1 contact boxes: the same reach for every fighter on each button (metres from the fighter's spot), used as a
 * floor under the real hand/foot position during the hit frames. Long-limbed animations can still reach further;
 * short ones (hooks, uppercuts, knees, the sweep) no longer whiff where an opponent's jab lands. */
window.FighterReach={lp:1.1,mp:1.2,hp:1.15,lk:1.15,mk:1.2,hk:1.35,sweep:1.2};
