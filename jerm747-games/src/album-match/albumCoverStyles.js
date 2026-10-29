// Original Jerm747 music-site marble cover renderer, adapted to six stable game types.
import originalTiles from './albumMatchTiles.js';
export const ALBUM_COLORS=['#ff4fd8','#19c3ff','#9be22d','#a56bff','#ff8a1f','#1fd1b4'];
const colorFor=t=>t.color;
const markFor=()=>({ink:'#0b0c10',text:.72,ring:.26});
function hash(s) { // FNV-1a
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function coverSvg(track) {
  const c = colorFor(track);
  const mk = markFor(c);
  const h = hash(String(track.id));
  const seed = h % 997; // each song's marble has its own veins
  const turn = -40 + ((h >>> 5) % 50); // and its own angle
  const gap = 110 + ((h >>> 9) % 70); // how far apart the veins run
  // Layers, bottom to top:
  //   dark frame → color panel → marble (soft clouds, then thin light veins and faint dark veins that
  //   wander, only on the panel)
  //   → 45° shade → radial fade (bright center, softer edges) → thin edge highlight → 747 mark
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>
<clipPath id="p"><rect x="40" y="40" width="432" height="432" rx="44"/></clipPath>
<pattern id="vl" width="512" height="${gap}" patternUnits="userSpaceOnUse"><rect y="0" width="512" height="2.2" fill="#fff"/><rect y="${Math.round(gap * 0.42)}" width="512" height="1" fill="#fff" opacity=".7"/></pattern>
<pattern id="vd" width="512" height="${gap + 23}" patternUnits="userSpaceOnUse"><rect y="${Math.round(gap / 2)}" width="512" height="1.4" fill="#000"/></pattern>
<filter id="w" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.0065" numOctaves="5" seed="${seed}" result="t"/>
<feDisplacementMap in="SourceGraphic" in2="t" scale="150" xChannelSelector="R" yChannelSelector="G"/>
<feGaussianBlur stdDeviation=".7"/>
</filter>
<filter id="c" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="3" seed="${seed + 7}"/>
<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1.6 0 -.62"/>
</filter>
<linearGradient id="s" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
<stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/>
</linearGradient>
<radialGradient id="r" cx="256" cy="246" r="330" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/>
<stop offset=".6" stop-color="#0b0c10" stop-opacity=".12"/><stop offset="1" stop-color="#0b0c10" stop-opacity=".62"/>
</radialGradient>
<radialGradient id="f" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="${c}" stop-opacity=".16"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="512" height="512" fill="#15171e"/>
<rect width="512" height="512" fill="url(#f)"/>
<rect x="40" y="40" width="432" height="432" rx="44" fill="${c}"/>
<g clip-path="url(#p)">
<g transform="rotate(${turn} 256 256)">
<rect x="-140" y="-140" width="792" height="792" filter="url(#c)" opacity=".22"/>
<rect x="-140" y="-140" width="792" height="792" fill="url(#vl)" filter="url(#w)" opacity=".55"/>
<rect x="-140" y="-140" width="792" height="792" fill="url(#vd)" filter="url(#w)" opacity=".18"/>
</g>
<rect x="40" y="40" width="432" height="432" fill="url(#s)"/>
<rect x="40" y="40" width="432" height="432" fill="url(#r)"/>
</g>
<rect x="41.5" y="41.5" width="429" height="429" rx="42.5" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3"/>
<circle cx="256" cy="256" r="104" fill="none" stroke="${mk.ink}" stroke-width="5" opacity="${mk.ring}"/>
<text x="256" y="276" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="58" font-weight="800" fill="${mk.ink}" opacity="${mk.text}" letter-spacing="1">747</text>
</svg>`;
}


export default originalTiles.map((tile,i)=>({...tile,src:'data:image/svg+xml,'+encodeURIComponent(coverSvg({id:'arcade-album-'+i,color:ALBUM_COLORS[i]}).replace(/<text[^>]*>747<\/text>/,''))}));
