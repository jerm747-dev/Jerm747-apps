// Android Back button: the app asks window.BeatRoom.back() first. It closes the top pop-up,
// then leaves a full-screen section; only when there's nothing to close does the app offer to exit.
export function installBackKey() {
  if (typeof window === 'undefined') return;
  window.BeatRoom = {
    back() {
      if (document.querySelector('.pop-scrim, .countdown')) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return true;
      }
      const full = document.querySelector('.section.is-full .fs-btn');
      if (full) { full.click(); return true; }
      return false;
    },
  };
}
