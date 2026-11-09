/**
 * The song list, with album artwork filled in from site.projectCovers (e.g. every LIP song gets the
 * Letters In Purple cover). Import songs from here, not from tracks.json directly.
 * A song that already has its own cover in tracks.json keeps it.
 */
import list from "./tracks.json";
import { site } from "./site.js";

const DEFAULT_COVER = "/covers/cover-art.svg";
const covers = site.projectCovers || {};

for (const t of list) {
  const art = t.project && covers[t.project];
  if (art && (!t.cover || t.cover === DEFAULT_COVER)) t.cover = art;
}

export default list;
