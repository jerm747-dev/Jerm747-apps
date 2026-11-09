/**
 * Albums from site.albums, with their songs (in track-number order).
 *   albums                 → [{ id, title, project, artist, cover, color, tracks: [...] }]
 *   albumById(id), albumForTrack(track), albumPath(id)
 */
import tracks from "./data/tracks.js";
import { site } from "./data/site.js";

/** Track number on the album: saved by the parser, or read from the file name ("LIP 04 …") */
export function trackNumber(t) {
  if (Number.isFinite(t.trackNo)) return t.trackNo;
  for (const v of t.versions || []) {
    const m = String(v.file || "").match(/^[A-Z]{2,5}[\s_-]?(\d{1,3})[\s_-]/i) || String(v.label || "").match(/#(\d{1,3})\b/);
    if (m) return Number(m[1]);
  }
  return null;
}

export const albums = (site.albums || []).map((a) => ({
  ...a,
  tracks: tracks
    .filter((t) => t.project === a.project)
    .sort((x, y) => (trackNumber(x) ?? 999) - (trackNumber(y) ?? 999) || (x.sortTitle || x.title).localeCompare(y.sortTitle || y.title)),
}));

export const albumPath = (id) => `/album/${id}`;
export const albumById = (id) => albums.find((a) => a.id === id) || null;
export const albumForTrack = (t) => (t?.project ? albums.find((a) => a.project === t.project) || null : null);
