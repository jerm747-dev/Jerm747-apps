/* jerm747.games local stand-in for jerm747-account.js.
   No subscriptions on jerm747.games: everyone gets the full Groove Squad (all 40 fighters) and Ranked Run.
   Nothing is synced to or read from jerm747.com. Same API shape as the site script, so the game code is unchanged. */
(function () {
  'use strict';
  var state = { ready: true, loggedIn: true, subscribed: true, canDownload: false, downloadsOpen: false, grooveSquadLocked: false, csrf: '', email: '', local: true };
  var handlers = {};
  function on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); }
  function off(name, fn) { handlers[name] = (handlers[name] || []).filter(function (f) { return f !== fn; }); }
  var none = function () { return Promise.resolve({ ok: false, code: 'not_available' }); };
  var ready = Promise.resolve(state);
  window.Jerm747Account = {
    ready: ready,
    state: function () { return state; },
    on: on, off: off,
    me: function () { return ready; },
    register: none, login: none, logout: none, subscribe: none, manageBilling: none, confirmCheckout: none,
    deleteAccount: none, forgotPassword: none, resetPassword: none,
    syncNow: function () { return Promise.resolve(); },
    allowGrooveSquad: function () { return true; },
    goSubscribe: function () {}
  };
  setTimeout(function () { (handlers.change || []).forEach(function (fn) { try { fn(state); } catch (e) {} }); }, 0);
})();
