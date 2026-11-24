// Session activity is a rack indicator, independent of the tools' save behavior.
(() => {
  const key = 'patchbay.activity:' + location.pathname.replace(/\/$/, '/index.html');
  function mark(event) {
    if (!event.isTrusted) return;
    try { sessionStorage.setItem(key, '1'); } catch {}
  }

  document.addEventListener('input', event => {
    if (event.target.matches('select, textarea, input:not([type=search]):not([type=file])')) mark(event);
  }, true);
  document.addEventListener('change', event => {
    if (event.target.matches('select') ||
        (event.target.matches('input[type=file]') && event.target.files.length)) mark(event);
  }, true);
  document.addEventListener('click', event => {
    const edit = event.target.closest(
      '#rec, #recBtn, #clear, #rowAdd, #addKeys, #addDrums, #quant, #mclear, #mreset, ' +
      '#reset, #grid .cell, [data-e], button[aria-label^="Step "]'
    );
    if (edit) mark(event);
  }, true);
})();

(() => {
  if (!window.RackMidi || !window.RackExports) return;

  const access = {inputs: new Map(), outputs: new Map(), sysexEnabled: false};
  function refresh() {
    const active = new Set();
    for (const info of JSON.parse(RackMidi.ports())) {
      const ports = info.type === 'input' ? access.inputs : access.outputs;
      active.add(info.id);
      if (ports.has(info.id)) continue;
      const port = {...info, state: 'connected'};
      if (info.type === 'input') {
        let handler;
        Object.defineProperty(port, 'onmidimessage', {
          get: () => handler,
          set(callback) {
            handler = callback;
            if (callback) RackMidi.listen(port.id);
          }
        });
      } else {
        port.send = (data, at = performance.now()) => {
          const bytes = Array.from(data);
          if (bytes.includes(0xf0) && !access.sysexEnabled) throw new DOMException('SysEx is disabled', 'InvalidAccessError');
          RackMidi.send(port.id, JSON.stringify(bytes), Math.max(0, at - performance.now()));
        };
      }
      ports.set(info.id, port);
    }
    for (const ports of [access.inputs, access.outputs]) {
      for (const id of ports.keys()) if (!active.has(id)) ports.delete(id);
    }
  }

  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    value: async ({sysex = false} = {}) => {
      if (!RackMidi.available()) throw new DOMException('Android MIDI is unavailable', 'NotSupportedError');
      access.sysexEnabled = Boolean(sysex);
      refresh();
      return access;
    }
  });
  window.rackMidiChanged = () => {
    refresh();
    access.onstatechange?.();
  };

  const parsers = new WeakMap();
  const length = status => {
    if (status < 0xf0) return status >= 0xc0 && status < 0xe0 ? 2 : 3;
    return ({241: 2, 242: 3, 243: 2})[status] || 1;
  };
  window.rackMidiBytes = (id, bytes) => {
    const port = access.inputs.get(id);
    if (!port) return;
    if (!parsers.has(port)) parsers.set(port, {message: [], running: 0});
    const state = parsers.get(port);
    const emit = data => port.onmidimessage?.({data: Uint8Array.from(data), timeStamp: performance.now()});
    for (const byte of bytes) {
      if (byte >= 0xf8) { emit([byte]); continue; }
      if (byte === 0xf7 && state.message[0] === 0xf0) {
        if (access.sysexEnabled) emit([...state.message, byte]);
        state.message = [];
        continue;
      }
      if (byte >= 0x80) {
        state.running = byte < 0xf0 ? byte : 0;
        state.message = [byte];
      } else {
        if (!state.message.length && state.running) state.message.push(state.running);
        if (state.message.length) state.message.push(byte);
      }
      if (state.message.length && state.message[0] !== 0xf0 && state.message.length === length(state.message[0])) {
        emit(state.message);
        state.message = [];
      }
      if (state.message.length > 65536) state.message = [];
    }
  };

  window.saveRackExport = async (filename, data) => {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const encoded = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    if (!RackExports.save(filename, blob.type, encoded)) throw new Error('Android could not save the file');
  };
  const normalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!this.download || !this.href.startsWith('blob:')) return normalClick.call(this);
    const {href, download} = this;
    fetch(href).then(data => data.blob()).then(blob => saveRackExport(download, blob))
      .catch(() => alert('Could not save this export.'));
  };
})();
