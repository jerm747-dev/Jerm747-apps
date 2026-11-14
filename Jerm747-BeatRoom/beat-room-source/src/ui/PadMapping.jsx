import { useState, useSyncExternalStore } from 'react';
import * as map from '../engine/padMap.js';
import * as pads from '../engine/pads.js';

export default function PadMapping({ rows, recState }) {
  const state = useSyncExternalStore(map.subscribe, map.get);
  const [open, setOpen] = useState(false);
  function take() {
    if (recState === 'off') { map.performMode(true); pads.toggleRec(); }
    else pads.toggleRec();
  }
  return <div className="pad-mapping" aria-label="Controller pads" role="group">
    <div className="btn-row">
      <button type="button" className="btn" aria-pressed={state.performing} onClick={() => map.performMode(!state.performing)}>
        {state.performing ? 'Exit pad mode' : 'Play mapped pads'}
      </button>
      <button type="button" className="btn" onClick={take}>
        {recState === 'off' ? 'Record mapped pads' : 'Cancel recording'}
      </button>
      <button type="button" className="btn" aria-expanded={open} onClick={() => { setOpen(!open); map.cancelLearn(); }}>Map pads</button>
    </div>
    {open && <div className="pad-bindings">
      {rows.map((row, i) => <button type="button" className="btn" key={row.id} aria-pressed={state.learning === i}
        onClick={() => state.learning === i ? map.cancelLearn() : map.learn(i)}>
        <span>{i + 1} · {row.src ? row.name : 'Empty'}</span><b>{state.learning === i ? 'Press a button…' : map.buttonName(state.buttons[i])}</b>
      </button>)}
      <button type="button" className="mini" onClick={map.reset}>Reset mappings</button>
    </div>}
    <p className="hint" role="status">{state.message || (state.learning != null ? 'Press the controller button to assign. Select cancels. Using an assigned button swaps the two rows.'
      : state.performing ? 'Pad mode · Play the mapped buttons. Select returns to editing.' : 'Select switches between editing and playing your mapped pads.')}</p>
  </div>;
}
