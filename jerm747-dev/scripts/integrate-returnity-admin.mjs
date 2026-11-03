// The repository contains a built player, not its React source. Keep its original
// bundle intact and generate a small, guarded integration until that source is added.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = fileURLToPath(
  new URL("../public/sites/nige-hood/", import.meta.url),
);
const source = "assets/index-Cr6z48O5.js",
  output = "assets/index-admin-v1.js";
let text = readFileSync(root + source, "utf8");
const hash = createHash("sha256").update(text).digest("hex");
if (hash !== "06d3ce650fabdeb8f3c571fc054f9a63f922aa66301bbc87b059974a6afd0534")
  throw Error(
    "The player bundle changed. Review the integration before rebuilding.",
  );
function replaceOnce(old, next) {
  if (text.split(old).length !== 2)
    throw Error("Player integration no longer matches: " + old.slice(0, 70));
  text = text.replace(old, next);
}
replaceOnce(
  'const s=S=>fetch(S,{cache:"no-cache"}).then(A=>A.ok?A.json():null).catch(()=>null),[r,h]=await Promise.all([s("site.config.json"),s("tracks.json")]);',
  "const {config:r,tracks:h}=await window.SiteAdminBridge.load();",
);
replaceOnce(
  "return c.jsx($h.Provider,{value:H,children:s})",
  "R.useEffect(()=>{window.SiteAdminBridge.bindPlayer(H,r.current)},[H]);return c.jsx($h.Provider,{value:H,children:s})",
);
replaceOnce(
  'c.jsxs("footer",{className:"foot",children:[',
  'c.jsxs("footer",{className:"foot",children:[c.jsx("button",{className:"sa-listener-trigger",onClick:()=>window.SiteAdminBridge.open(),children:"Playlists & listening"}),c.jsx("a",{href:"admin/",children:"Site admin"}),',
);
replaceOnce(
  "No songs yet, so PLAY runs a demo beat. Add music on the setup page and this deck plays the album, side A then side B.",
  "No songs are available with your current listening choices, so PLAY runs a demo beat. Use Playlists & listening below to review your choices.",
);
replaceOnce(
  'c.jsxs("p",{children:["Put your audio files in the ",c.jsx("code",{children:"music"})," folder, then run the setup page\'s ",c.jsx("strong",{children:"Scan music"})," button (or ",c.jsx("code",{children:"npm run tracks"}),") and build again."]})',
  'c.jsx("p",{children:"New music is on the way. Use Playlists & listening below to review which song types are included."})',
);
text = text.replaceAll("sound-arcade.", "returnity.");
writeFileSync(root + output, text);
let html = readFileSync(root + "index.html", "utf8");
if (!html.includes("./" + source) && !html.includes("./" + output))
  throw Error(
    "A different player build is installed. Update the adapter before rebuilding.",
  );
html = html.replace("./" + source, "./" + output);
if (!html.includes("site-admin/listener.js"))
  html = html.replace(
    '    <script type="module"',
    '    <script src="../../site-admin/listener.js"></script>\n    <link rel="stylesheet" href="../../site-admin/listener.css">\n    <script type="module"',
  );
writeFileSync(root + "index.html", html);
console.log("Integrated Returnity admin; original bundle SHA-256 " + hash);
