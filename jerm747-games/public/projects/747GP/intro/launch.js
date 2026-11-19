(() => {
  const byId = id => document.getElementById(id);
  const sections = ['studio', 'title', 'setup'];
  const art = byId('art');
  const start = byId('start');
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  let warmed = false;
  let scene = 'studio';
  let readyToStart = false;
  let titleVisit = 0;

  // Fetch the next screens while the player reads this one.
  function warmShowroom() {
    if (warmed || navigator.connection?.saveData) return;
    warmed = true;
    const car = GPLaunch.car || 'kart';
    for (const href of ['showroom.html', 'tracks.html', 'race.html', 'vendor/three-r128.min.js', 'cars/thumbs/' + car + '.webp']) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.append(link);
    }
  }

  // ---- choice plates (role=radio): the slash mark shows the selection ----
  const choices = group => [...document.querySelectorAll('[data-group="' + group + '"]')];
  const value = group => (choices(group).find(b => b.getAttribute('aria-checked') === 'true') || choices(group)[0]).dataset.value;
  function choose(group, v) {
    for (const b of choices(group)) b.setAttribute('aria-checked', String(b.dataset.value === v));
    if (group === 'transmission') shiftHint();
  }
  function shiftHint() {
    byId('shift-hint').textContent = value('transmission') === 'manual'
      ? 'Shift with Q / E, LB / RB, or the on-screen – / + paddles.'
      : 'The car handles each shift.';
  }
  let advancing = false;
  for (const b of document.querySelectorAll('[role=radio]')) b.addEventListener('click', () => {
    if (advancing) return;
    choose(b.dataset.group, b.dataset.value);
    if (b.dataset.group === 'mode') {
      // next step: the gearbox (keeps the current choice highlighted so a second tap goes straight on)
      const sel = choices('transmission').find(x => x.getAttribute('aria-checked') === 'true');
      setTimeout(() => { nav.focus(order().indexOf(sel)); byId('gearbox').classList.add('nudge'); setTimeout(() => byId('gearbox').classList.remove('nudge'), 700); }, 120);
    } else {
      advancing = true; b.classList.add('is-focused');
      setTimeout(() => byId('continue').click(), 260);   // a beat to see the pick land
    }
  });
  addEventListener('pageshow', () => { advancing = false; });
  choose('mode', GPLaunch.mode);
  choose('transmission', GPLaunch.transmission);

  const order = () => [...choices('mode'), ...choices('transmission'), byId('continue')];
  const nav = GPUI.menu(order, {
    pad: false,
    onBack: () => byId('back').click(),
    onSide: (dir, el) => {
      if (!el || !el.dataset.group) return;
      const list = choices(el.dataset.group), k = list.indexOf(el), n = list[Math.max(0, Math.min(list.length - 1, k + (dir === 'left' ? -1 : 1)))];
      choose(n.dataset.group, n.dataset.value); nav.focus(order().indexOf(n));
    }
  });
  nav.active = false;

  const wallet = GPUI.gpChip({where: 'tr'});
  function show(next) {
    scene = next;
    wallet.show(next === 'setup');
    document.documentElement.dataset.screen = next;
    for (const name of sections) byId(name).hidden = name !== next;
    nav.active = next === 'setup';
    if (next === 'title') {
      const visit = ++titleVisit;
      start.disabled = !readyToStart;
      const unlock = () => {
        if (scene !== 'title' || visit !== titleVisit) return;
        readyToStart = true;
        start.disabled = false;
        start.focus({preventScroll: true});
      };
      if (!readyToStart) delay(1250).then(unlock); else start.focus({preventScroll: true});
      warmShowroom();
    }
    if (next === 'setup') {
      warmShowroom();
      const sel = choices('mode').find(b => b.getAttribute('aria-checked') === 'true');
      nav.focus(order().indexOf(sel));
    }
  }

  function openSetup() {
    if (scene === 'title' && readyToStart) show('setup');
  }
  start.addEventListener('click', openSetup);
  byId('back').addEventListener('click', () => show('title'));
  byId('continue').addEventListener('click', () => {
    GPLaunch.set('mode', value('mode'));
    GPLaunch.set('transmission', value('transmission'));
    location.assign(GPLaunch.link('showroom.html', {mode: value('mode'), transmission: value('transmission')}));
  });

  // title screen: Enter / Space / A / Start
  addEventListener('keydown', e => {
    if (scene !== 'title' || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { e.preventDefault(); openSetup(); }
  });
  watchMenuPad(a => {
    if (scene === 'title') { if (a === 'confirm') openSetup(); return; }
    if (scene === 'setup') nav.act(a);
  });
  // tap / click / any key skips the studio card
  const skipStudio = () => { if (scene === 'studio') { readyToStart = true; show('title'); } };
  byId('studio').addEventListener('pointerdown', skipStudio);

  if (location.hash === '#setup' || location.hash === '#mode') {
    readyToStart = true;
    show('setup');
  } else {
    // Decode the selected orientation while the studio credit is on screen.
    // A stalled image request must not trap the player at the developer logo.
    Promise.all([delay(2050), Promise.race([art.decode().catch(() => {}), delay(6500)])])
      .then(() => { if (scene === 'studio') show('title'); });
  }
})();
