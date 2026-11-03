/* Public player adapter. The catalog is filtered before any queue is built. */
(() => {
  "use strict";
  const key = "site-admin-listening:" + location.pathname;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  let data = {
      tracks: [],
      playlists: [],
      policy: {
        explicit: "opt-in",
        defaultTypes: ["instrumental", "vocal", "spoken"],
      },
    },
    player,
    error = "";
  const watched = new WeakSet();
  function preferences() {
    try {
      const p = JSON.parse(localStorage.getItem(key));
      return p && typeof p === "object" ? p : {};
    } catch {
      return {};
    }
  }
  async function load() {
    const p = preferences(),
      params = new URLSearchParams({
        action: "catalog",
        explicit: p.explicit ? "1" : "0",
      });
    if (Array.isArray(p.types))
      params.set(
        "types",
        p.types
          .filter((t) => ["instrumental", "vocal", "spoken"].includes(t))
          .join(","),
      );
    try {
      const response = await fetch("admin/api.php?" + params, {
        cache: "no-store",
        credentials: "omit",
      });
      if (!response.ok)
        throw Error(
          "The music settings could not be loaded. Please reload to try again.",
        );
      const result = await response.json();
      if (
        !Array.isArray(result.tracks) ||
        !result.config ||
        !Array.isArray(result.playlists)
      )
        throw Error("The music settings are unavailable.");
      data = result;
      // Preserve IDs and metadata; make the explicit label visible in every existing song surface.
      return {
        config: data.config,
        tracks: data.tracks.map((t) => ({
          ...t,
          title: t.title + (t.explicit ? " [E]" : ""),
          versions: t.versions || [],
        })),
      };
    } catch (e) {
      error = e.message;
      // Keep the tour available but fail closed for music if the filtering service is unavailable.
      const response = await fetch("site.config.json", {
        cache: "no-store",
      }).catch(() => null);
      return { config: response?.ok ? await response.json() : {}, tracks: [] };
    }
  }
  function watchAudio(audio) {
    if (!audio || watched.has(audio)) return;
    watched.add(audio);
    let source = "",
      last = 0,
      elapsed = 0,
      counted = false;
    audio.addEventListener("timeupdate", () => {
      const now = audio.currentTime;
      if (source !== audio.src) {
        source = audio.src;
        elapsed = 0;
        counted = false;
        last = now;
      }
      const delta = now - last;
      last = now;
      if (audio.paused || audio.seeking || delta <= 0 || delta > 2) return;
      elapsed += delta;
      if (counted || elapsed < 5) return;
      counted = true;
      const track = data.tracks.find((t) =>
        [t.url, ...(t.versions || []).map((v) => v.url)].some(
          (url) => new URL(url, location.href).href === source,
        ),
      );
      if (!track) return;
      fetch("admin/api.php?action=play", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: track.id }),
        keepalive: true,
      }).catch(() => {});
    });
    audio.addEventListener("ended", () => {
      counted = false;
      elapsed = 0;
      last = 0;
    });
  }
  function bindPlayer(value, audio) {
    player = value;
    watchAudio(audio);
  }
  function open() {
    let dialog = document.getElementById("sa-listening");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "sa-listening";
      document.body.append(dialog);
    }
    const prefs = preferences(),
      types = prefs.types || data.policy.defaultTypes;
    dialog.innerHTML = `<div class="sa-listener-head"><h2>Listening controls</h2><button id="sa-close" aria-label="Close listening controls">×</button></div>${error ? `<p role="alert">${esc(error)}</p>` : ""}<form id="sa-listen-form"><fieldset><legend>Song types</legend>${[
      ["instrumental", "Instrumentals"],
      ["vocal", "Vocals"],
      ["spoken", "Spoken word"],
    ]
      .map(
        ([id, label]) =>
          `<label><input type="checkbox" name="type" value="${id}" ${types.includes(id) ? "checked" : ""}>${label}</label>`,
      )
      .join(
        "",
      )}</fieldset>${data.policy.explicit === "opt-in" ? `<label><input type="checkbox" name="explicit" ${prefs.explicit ? "checked" : ""}>Allow explicit lyrics</label>` : "<p>Explicit songs are hidden on this site.</p>"}<p class="sa-listener-hint">These choices apply to song lists, albums, playlists and playback on this device.</p><button type="submit" class="sa-listener-primary">Apply listening choices</button></form><hr><h3>Playlists</h3><div id="sa-playlists">${data.playlists.map((p, i) => `<button data-playlist="${i}" ${!p.trackIds.length ? "disabled" : ""}>▶ ${esc(p.title)} <small>· ${p.trackIds.length} ${p.trackIds.length === 1 ? "song" : "songs"}</small></button>`).join("") || "<p>No playlists have been published yet.</p>"}</div>`;
    dialog.querySelector("#sa-close").onclick = () => dialog.close();
    dialog.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            types: f.getAll("type"),
            explicit: f.has("explicit"),
          }),
        );
        location.reload();
      } catch {
        dialog.querySelector(".sa-listener-hint").textContent =
          "Your browser cannot save these choices. Enable site storage and try again.";
      }
    };
    dialog.querySelectorAll("[data-playlist]").forEach(
      (b) =>
        (b.onclick = () => {
          const p = data.playlists[Number(b.dataset.playlist)],
            list = p.trackIds
              .map((id) => data.tracks.find((t) => t.id === id))
              .filter(Boolean)
              .map((t) => ({
                ...t,
                title: t.title + (t.explicit ? " [E]" : ""),
                versions: t.versions || [],
              }));
          if (list.length && player) {
            player.playAt(list, 0);
            dialog.close();
          }
        }),
    );
    dialog.showModal();
  }
  window.SiteAdminBridge = { load, bindPlayer, open };
})();
