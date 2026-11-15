/* Standard gamepads use the physical button positions in every layout. */
(() => {
  const controls = window.Jerm747Pad;
  const faceDirection = {tools:'up', back:'right', accept:'down', alternate:'left'};
  const navigation = {up:'ArrowUp', right:'ArrowRight', down:'ArrowDown', left:'ArrowLeft'};
  controls.listen(action => {
    const dialog = document.querySelector('dialog[open], .match-settings, .am-result');
    if (dialog) {
      controls.menu(controls.controls(dialog), action);
      return;
    }
    const selected = document.querySelector('.match-tile.is-cursor') || document.querySelector('.match-tile');
    if (!selected) return;
    if (controls.isDirection(action)) {
      controls.focus(selected);
      const key = navigation[action];
      for (const type of ['keydown', 'keyup']) {
        selected.dispatchEvent(new KeyboardEvent(type, {key, code:key, bubbles:true, cancelable:true}));
      }
      return;
    }
    const direction = faceDirection[action];
    if (direction) document.querySelector('.am-swap-pad [aria-label="Swap ' + direction + '"]')?.click();
  });
})();
