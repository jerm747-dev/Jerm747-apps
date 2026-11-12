// Level 10 owns the story. Get Down owns both fighters and the round result.
function createStoryMatch() {
  const run = createArcadeRun('og-jerm', 'medium', Date.now(), {opponent: 'jimmy'});
  run.assists = {jado: false, eli: false};
  prepareStoryRound(run);
  return run;
}

function prepareStoryRound(run) {
  const battle = run.battle;
  Object.assign(battle, {
    phase: run.round === 1 ? 1 : 2,
    assists: run.assists,
    assist: null,
    managerHp: 90,
    manager: {x: 826, action: 'idle', cooldown: 3, anim: 0},
    message: '',
    charge: 0
  });
  return battle;
}

function stepCorner(run, input, dt) {
  const b = run.battle;
  if (run.mode !== 'fight' || b.readyTime > 0) return;
  const id = input.assist;
  if ((id === 'jado' || id === 'eli') && !b.assists[id] && !b.assist) {
    b.assists[id] = true;
    b.assist = {id, t: 0, hits: 0};
  }
  const helper = b.assist;
  if (helper) {
    helper.t += dt;
    if (helper.hits < 4 && helper.t >= .18 + helper.hits * .16) {
      helper.hits++;
      arcadeImpact(run, 'boss', 8);
    }
    if (helper.t >= 1.05) b.assist = null;
  }
  if (b.phase !== 2 || b.managerHp <= 0) return;
  const manager = b.manager;
  const player = b.player;
  const direction = Math.sign(player.x - manager.x) || -1;
  manager.cooldown -= dt;
  manager.anim = Math.max(0, manager.anim - dt);
  if (manager.anim === 0) manager.action = 'idle';
  if (Math.abs(player.x - manager.x) > 160) manager.x += direction * 65 * dt;
  if (manager.cooldown <= 0) {
    manager.action = 'wave';
    manager.anim = .45;
    manager.cooldown = 3;
    b.projectiles.push({owner:'boss', source:'manager', x:manager.x + direction * 36, y:270,
      vx:direction * 280, damage:7, life:3, color:'#e3bb65'});
  }
  const attack = player.attack;
  if (attack && !attack.hitManager) {
    const move = CATALOG_MOVES[attack.move];
    const distance = manager.x - player.x;
    if (move.kind !== 'wave' && attack.elapsed >= move.duration * .32 &&
        attack.elapsed < move.duration * .56 && Math.abs(distance) < move.range &&
        distance * attack.facing >= -20 && Math.abs(player.y) < 90) {
      attack.hitManager = true;
      b.managerHp = Math.max(0, b.managerHp - move.damage);
    }
  }
  for (const wave of b.projectiles) {
    if (wave.owner === 'player' && wave.life > 0 && Math.abs(wave.x - manager.x) < 35 &&
        Math.abs(wave.y - 270) < 64) {
      b.managerHp = Math.max(0, b.managerHp - wave.damage);
      wave.life = 0;
    }
  }
  b.projectiles = b.projectiles.filter(wave => wave.life > 0);
}

function beginCoatFinish(b) {
  b.phase = 3;
  b.mode = 'finisher';
  b.t = 0;
  b.finisherTime = 0;
  b.finisherHits = 0;
  b.bossHp = 100;
  b.boss.x = 690;
  b.player.x = 240;
  b.player.y = b.boss.y = 0;
  b.player.action = b.boss.action = 'idle';
  b.player.attack = b.boss.attack = null;
  b.player.guard = b.boss.guard = false;
  b.player.facing = 1;
  b.boss.facing = -1;
  b.assist = null;
  b.projectiles = [];
  b.effects = [];
  b.fightBanner = 0;
  b.message = 'Your whole catalog. Your own voice.';
}

function stepCoatFinish(b, dt) {
  b.t += dt;
  b.finisherTime += dt;
  b.effects = b.effects.filter(effect => (effect.life -= dt) > 0);
  const beats = [.25, .55, .85, 1.15, 1.7];
  while (b.finisherHits < beats.length && b.finisherTime >= beats[b.finisherHits]) {
    const n = ++b.finisherHits;
    b.player.x = b.boss.x - 90;
    b.player.action = n === 5 ? 'pHigh' : n % 2 ? 'pMid' : 'kMid';
    b.boss.action = n === 5 ? 'down' : 'hit';
    b.bossHp = 100 - n * 20;
    b.effects.push({kind:n === 5 ? 'final' : 'hit', x:b.boss.x, y:255,
      life:n === 5 ? .75 : .25, color:'#ffe6a0'});
    window.Jerm747GameSound?.play(n === 5 ? 'ground-impact' : 'punch');
    if (n === 5) b.boss.x = Math.min(835, b.boss.x + 100);
  }
  if (b.finisherTime >= 2.8) b.mode = 'won';
}

function drawMatchFighter(ctx, id, actor, time, baseSheet, height) {
  const pose = arcadePose(actor, time);
  const extra = pose.sheet !== 'base' && window.Jerm747ArcadeArt.get(id, pose.sheet);
  const sheet = extra || baseSheet;
  if (!sheet) return;
  const n = extra || pose.sheet === 'base' ? pose.frame : CATALOG_MOVES[actor.action]?.frame || 0;
  const frame = sheet.frames[n] || sheet.frames[0];
  const scale = height / sheet.maxH;
  const root = window.Jerm747FighterRoot?.x(sheet, n) ?? frame.anchorX ?? frame.w / 2;
  ctx.save();
  ctx.translate(actor.x, 360 + actor.y);
  ctx.scale(actor.facing, 1);
  const x = -root * scale, y = -(frame.anchorY ?? frame.h) * scale;
  const image = extra && window.Jerm747ArcadeArt.isolated(sheet, n);
  if (image) ctx.drawImage(image, x, y, frame.w * scale, frame.h * scale);
  else ctx.drawImage(sheet.image, frame.x, frame.y, frame.w, frame.h, x, y, frame.w * scale, frame.h * scale);
  ctx.restore();
}
