import { useMemo } from 'react';

// A drawn circuit board for the hero. Deterministic, so it looks the same on every load.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const W = 1440;
const H = 760;

const CHIPS = [
  { id: 'U1', x: 930, y: 250, w: 230, h: 230, pins: 12, label: 'J747-DEV' },
  { id: 'U2', x: 1230, y: 120, w: 120, h: 90, pins: 5, label: 'SRV' },
  { id: 'U3', x: 1240, y: 560, w: 120, h: 90, pins: 5, label: 'DB' },
  { id: 'U4', x: 700, y: 560, w: 130, h: 80, pins: 5, label: 'UI' },
];

function buildTraces() {
  const rand = seeded(747);
  const traces = [];
  const vias = [];
  for (const c of CHIPS) {
    const sides = c.id === 'U1' ? ['left', 'right', 'top', 'bottom'] : ['left', 'top', 'bottom'];
    for (const side of sides) {
      for (let i = 0; i < c.pins; i++) {
        if (rand() < 0.35) continue;
        const t = (i + 1) / (c.pins + 1);
        let x, y, dx, dy;
        if (side === 'left') { x = c.x; y = c.y + c.h * t; dx = -1; dy = 0; }
        if (side === 'right') { x = c.x + c.w; y = c.y + c.h * t; dx = 1; dy = 0; }
        if (side === 'top') { x = c.x + c.w * t; y = c.y; dx = 0; dy = -1; }
        if (side === 'bottom') { x = c.x + c.w * t; y = c.y + c.h; dx = 0; dy = 1; }
        const run1 = 30 + rand() * 120;
        const diag = 20 + rand() * 60;
        const turn = rand() < 0.5 ? -1 : 1;
        const pts = [[x, y]];
        let px = x + dx * run1;
        let py = y + dy * run1;
        pts.push([px, py]);
        // 45° jog
        if (dx !== 0) { px += dx * diag; py += turn * diag; }
        else { px += turn * diag; py += dy * diag; }
        pts.push([px, py]);
        const run2 = 60 + rand() * 380;
        px += dx * run2;
        py += dy * run2;
        px = Math.max(-20, Math.min(W + 20, px));
        py = Math.max(-20, Math.min(H + 20, py));
        pts.push([px, py]);
        traces.push(pts);
        if (px > 0 && px < W && py > 0 && py < H) vias.push([px, py]);
      }
    }
  }
  return { traces, vias };
}

export default function CircuitBoard() {
  const { traces, vias } = useMemo(buildTraces, []);
  return (
    <svg className="board" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={W} height={H} fill="var(--mask)" />
      <g className="board-pour">
        {Array.from({ length: 40 }, (_, i) => (
          <line key={i} x1={i * 40 - 400} y1={H} x2={i * 40 + 360} y2={0} />
        ))}
      </g>
      <g className="traces">
        {traces.map((pts, i) => (
          <polyline key={i} points={pts.map((p) => p.join(',')).join(' ')} style={{ animationDelay: `${(i % 24) * 40}ms` }} />
        ))}
      </g>
      <g className="vias">
        {vias.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="7" className="via-ring" />
            <circle cx={x} cy={y} r="3" className="via-hole" />
          </g>
        ))}
      </g>
      {CHIPS.map((c) => (
        <g key={c.id}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="4" className="chip" />
          <circle cx={c.x + 14} cy={c.y + 14} r="4" className="chip-dot" />
          <text x={c.x + c.w / 2} y={c.y + c.h / 2 + 6} className="chip-label">{c.label}</text>
          <text x={c.x} y={c.y - 12} className="silk">{c.id}</text>
        </g>
      ))}
      {[[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="16" className="mount" />
          <circle cx={x} cy={y} r="9" className="via-hole" />
        </g>
      ))}
      <text x={W - 70} y={H - 32} className="silk" textAnchor="end">jerm747.dev  rev A  2026</text>
      <g className="silk-parts">
        <rect x="860" y="600" width="36" height="16" /><text x="860" y="594" className="silk">R12</text>
        <rect x="1190" y="300" width="16" height="36" /><text x="1212" y="312" className="silk">C4</text>
        <rect x="1190" y="380" width="16" height="36" /><text x="1212" y="392" className="silk">C5</text>
      </g>
    </svg>
  );
}
