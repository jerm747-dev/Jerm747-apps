/**
 * Artwork for songs that don't have their own cover (most of them): a rounded marble color panel in a
 * dark frame, in a color from the palette (src/data/cover-colors.json, 128 neon colors), with a soft 45° shade, a radial
 * fade and the 747 mark in the middle.
 *
 *   Stems blue · Instrumentals lime · Vocals pink · Extended orange · Collabs teal
 *
 * A song with more than one type uses the first of: Vocals, Collabs, Extended, Stems, Instrumentals.
 * A song that hasn't been sorted yet (not measured) gets one of the five, picked from its id, so it
 * always looks the same. Songs with real artwork (e.g. Letters In Purple) keep it.
 * Turn this off in site.js: neonCovers: false.
 */
import tracks from "./data/tracks.js";
import { site } from "./data/site.js";
import { albumForTrack } from "./albums.js";
import palette from "./data/cover-colors.json";
import seasonal from "./data/palettes.json";
import { useSyncExternalStore } from "react";

// ---------- Preferences → Look → Colorful covers (on by default, saved on this device) ----------
// Off: songs without artwork go back to the plain 747 cover, and the covers don't glow, bounce or
// show bars — calmer to scroll, and a little easier on a phone's battery.
const LOOK_KEY = "jerm747.covers.colorful";
// On for everyone until they turn it off themselves. (A new key, so choices saved while testing the
// earlier version — which started devices set to reduce motion on the plain covers — start over on colors.)
let colorful = (() => { try { return localStorage.getItem(LOOK_KEY) !== "0"; } catch { return true; } })();
const lookListeners = new Set();
const applyLook = () => { if (typeof document !== "undefined") document.documentElement.classList.toggle("plain-covers", !colorful); };
applyLook();
/** Where the page was when the switch flipped, so the redraw can put it back */
export const lookScroll = { y: null };
export function setColorfulCovers(on) {
  lookScroll.y = typeof window !== "undefined" ? window.scrollY : null;
  colorful = on;
  try { localStorage.setItem(LOOK_KEY, on ? "1" : "0"); } catch {}
  applyLook();
  lookListeners.forEach((l) => l());
}
const lookSubscribe = (cb) => { lookListeners.add(cb); return () => lookListeners.delete(cb); };
const lookSnapshot = () => colorful;
export const useColorfulCovers = () => useSyncExternalStore(lookSubscribe, lookSnapshot, lookSnapshot);

// ---------- Preferences → Look → Cover colors (saved on this device) ----------
//   neon      the site's own palette (src/data/cover-colors.json) — the default
//   seasonal  follows the calendar: Spring Bloom (Mar–May), Summer Sunset (Jun–Aug),
//             Fall Sunset (Sep–Nov), Winter Holiday (Dec–Feb)
//   fall / summer / winter / spring   one season all year (src/data/palettes.json)
const SCHEME_KEY = "jerm747.covers.scheme";
export const SEASONS = Object.entries(seasonal).map(([id, p]) => ({ id, name: p.name, colors: p.colors }));
// cover-colors.json is either a plain list of colors, or { "order": "spectrum" | "scattered", "colors": [...] }
const paletteList = Array.isArray(palette) ? palette : palette?.colors;
export const NEON = Array.isArray(paletteList) && paletteList.length ? paletteList.filter(Boolean) : ["#49c6f3", "#ff4fd8", "#9be22d", "#ff8a1f", "#1fd1b4"];
/**
 * How songs get their colors (set on the color page, saved in cover-colors.json):
 *   scattered (default)  each song gets a color from its id: a random-looking mix, and a song keeps
 *                        its color when songs are added
 *   spectrum             the A–Z song list flows through the colors in order, so the first colors
 *                        sit near the top of the list and the last ones near the bottom (adding
 *                        songs shifts colors a little)
 */
export const ORDER = !Array.isArray(palette) && palette?.order === "spectrum" ? "spectrum" : "scattered";
/**
 * The 747 mark in the middle of each cover (set on the color page, saved in cover-colors.json as "mark"):
 *   "dark" (default) · "light" · "auto" (dark or light, whichever reads better on that cover's color)
 *   · or any color like "#ffd400"
 */
let MARK = (!Array.isArray(palette) && palette?.mark) || "dark";
const lumOf = (hex) => {
  const n = parseInt(String(hex).slice(1), 16);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
/** { ink, text, ring }: the mark's color and how strong the number and the ring around it are */
function markFor(color, mark = MARK) {
  const m = mark === "auto" ? (lumOf(color) > 0.179 ? "dark" : "light") : mark; // 0.179: where dark and white ink read equally well
  if (m === "dark") return { ink: "#0b0c10", text: 0.72, ring: 0.26 };
  if (m === "light") return { ink: "#ffffff", text: 0.92, ring: 0.34 };
  return /^#[0-9a-f]{6}$/i.test(m) ? { ink: m, text: 0.95, ring: 0.45 } : { ink: "#0b0c10", text: 0.72, ring: 0.26 };
}
const azRank = (() => {
  if (ORDER !== "spectrum") return null;
  const az = [...tracks].sort((a, b) => (a.sortTitle || a.title).localeCompare(b.sortTitle || b.title));
  return { map: new Map(az.map((t, i) => [t.id, i])), total: az.length };
})();
export const seasonNow = (d = new Date()) => {
  const m = d.getMonth(); // 0 = January
  return m >= 2 && m <= 4 ? "spring" : m >= 5 && m <= 7 ? "summer" : m >= 8 && m <= 10 ? "fall" : "winter";
};
const SCHEMES = ["neon", "seasonal", ...SEASONS.map((s) => s.id)];
let scheme = (() => { try { const v = localStorage.getItem(SCHEME_KEY); return SCHEMES.includes(v) ? v : "neon"; } catch { return "neon"; } })();
/** The palette id actually in use ("seasonal" → this season's) */
const paletteId = () => (scheme === "seasonal" ? seasonNow() : scheme);
export const paletteColors = (id) => (id === "neon" ? NEON : (seasonal[id]?.colors || NEON));
export function setCoverScheme(id) {
  if (!SCHEMES.includes(id) || id === scheme) return;
  lookScroll.y = typeof window !== "undefined" ? window.scrollY : null;
  scheme = id;
  try { localStorage.setItem(SCHEME_KEY, id); } catch {}
  lookListeners.forEach((l) => l());
}
const schemeSnapshot = () => scheme;
export const useCoverScheme = () => useSyncExternalStore(lookSubscribe, schemeSnapshot, schemeSnapshot);
/** Changes whenever the covers should be redrawn (Colorful covers or Cover colors changed) */
const keySnapshot = () => `${colorful ? "c" : "p"}-${paletteId()}`;
export const useLookKey = () => useSyncExternalStore(lookSubscribe, keySnapshot, keySnapshot);

const DEFAULT_COVER = "/covers/cover-art.svg";

export const TYPE_COLOR = { stems: "#19c3ff", instrumentals: "#9be22d", vocals: "#ff4fd8", extended: "#ff8a1f", collabs: "#1fd1b4" };

function hash(s) { // FNV-1a
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------- color helpers ----------

/**
 * A song's cover color comes from the palette in src/data/cover-colors.json: 128 neon colors around
 * the whole color wheel (blues, teals, greens, limes, yellows, oranges, reds, pinks, magentas,
 * purples…). The song's id picks one, so a song always keeps the same color and a big library gets
 * an even mix. Edit the palette with tools/cover-colors.html: it shows every color, lets you change,
 * add or remove them, and saves a new cover-colors.json to put in src/data/. Any number of colors works.
 */
export function colorFor(track, id = paletteId()) {
  const colors = paletteColors(id);
  const base = String(track.id).split("~")[0];
  if (azRank && azRank.map.has(base)) return colors[Math.floor((azRank.map.get(base) * colors.length) / azRank.total)];
  return colors[hash(base) % colors.length];
}

export function coverSvg(track) {
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

// Fill in the artwork (each cover is drawn the first time it's needed)
if (site.neonCovers !== false) {
  for (const t of tracks) {
    if (t.cover && t.cover !== DEFAULT_COVER) { t.glow = albumForTrack(t)?.color; continue; } // real artwork stays
    t.neon = true;
    // The song's color, for the glow while it plays (follows Cover colors)
    Object.defineProperty(t, "glow", { configurable: true, enumerable: true, get: () => colorFor(t) });
    // Made the first time something shows it (not all ~1,500 at once when the site opens), then kept
    // — one per palette, so switching Cover colors back and forth is instant
    const made = {};
    Object.defineProperty(t, "cover", {
      configurable: true, enumerable: true,
      get: () => {
        if (!colorful) return DEFAULT_COVER;
        const id = paletteId();
        return (made[id] ||= `data:image/svg+xml;charset=utf-8,${encodeURIComponent(coverSvg(t))}`);
      },
      set: (v) => { made[paletteId()] = v; },
    });
  }
}

/** A song's glow color: its neon, or its album color for real artwork */
export const glowOf = (track) => track?.glow || "#f5a524";

// A little "pop" when you tap a cover (anything marked data-pop): a quick squeeze and a ring of its color
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", (e) => {
    const host = e.target.closest?.("[data-pop]");
    if (!host) return;
    // data-pop="img": pop the cover image inside (it isn't redrawn when the song starts playing)
    const el = host.dataset.pop === "img" ? host.querySelector("img") : host;
    if (!el) return;
    el.classList.remove("is-pop");
    void el.offsetWidth; // restart the animation on quick taps
    el.classList.add("is-pop");
    clearTimeout(el._pop);
    el._pop = setTimeout(() => el.classList.remove("is-pop"), 600);
  }, { passive: true });
}
