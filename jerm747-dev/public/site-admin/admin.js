(() => {
  "use strict";
  const $ = (s) => document.querySelector(s),
    app = $("#app"),
    dialog = $("#dialog");
  const name = document.body.dataset.name || "Site",
    owner = document.body.dataset.owner || "owner",
    ownerName = document.body.dataset.ownerName || "Owner";
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
  let user,
    state,
    tab = "songs",
    dirty = false,
    reportDirty = false,
    busy = false,
    noticeTimer;
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const newId = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  function notice(t) {
    $("#notice").textContent = t;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => ($("#notice").textContent = ""), 6500);
  }
  async function api(action, data) {
    const res = await fetch("api.php?action=" + action, {
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(data
          ? {
              "Content-Type": "application/json",
              "X-Site-Admin-CSRF": user?.csrf || "",
            }
          : {}),
      },
      ...(data ? { method: "POST", body: JSON.stringify(data) } : {}),
    });
    let json;
    try {
      json = await res.json();
    } catch {
      throw Error("The admin API is unavailable. This site needs PHP hosting.");
    }
    if (!res.ok) {
      if (res.status === 401 && !["login", "password"].includes(action)) {
        user = null;
        login();
      }
      throw Error(json.error || "Request failed.");
    }
    return json;
  }
  function when(t) {
    if (!t) return "Not scheduled";
    try {
      return new Date(t * 1000).toLocaleString([], {
        timeZone: state?.reports.timezone || "America/New_York",
      });
    } catch {
      return new Date(t * 1000).toLocaleString();
    }
  }
  function modal(title, body) {
    dialog.innerHTML = `<div class="dialog-head"><h2>${esc(title)}</h2><button type="button" data-close aria-label="Close">×</button></div>${body}<p class="dialog-error" role="alert"></p>`;
    dialog.querySelector("[data-close]").onclick = () => dialog.close();
    dialog.showModal();
  }
  function formModal(title, body, submit) {
    modal(
      title,
      `<form id="edit-form">${body}<div class="actions"><button type="button" data-cancel>Cancel</button><button class="primary" type="submit">Apply changes</button></div></form>`,
    );
    dialog.querySelector("[data-cancel]").onclick = () => dialog.close();
    $("#edit-form").onsubmit = async (e) => {
      e.preventDefault();
      const button = e.submitter;
      button.disabled = true;
      try {
        await submit(new FormData(e.target));
      } catch (err) {
        dialog.querySelector(".dialog-error").textContent = err.message;
      } finally {
        button.disabled = false;
      }
    };
  }
  function login(error = "") {
    const token = new URLSearchParams(location.hash.slice(1)).get("activate");
    app.innerHTML = `<main class="login"><div class="brand">Jerm747 / Site Admin</div><h1>${esc(name)}</h1><p class="muted">${token ? "Choose your own password to activate your site account." : "Your music. Your controls."}</p><form id="login-form">${!token ? `<label>Username<input name="username" autocomplete="username" required value="${esc(owner)}"></label>` : ""}<label>${token ? "New password · at least 12 characters" : "Password"}<input name="password" type="password" minlength="${token ? 12 : 1}" maxlength="72" autocomplete="${token ? "new-password" : "current-password"}" required></label>${token ? '<label>Confirm password<input name="confirm" type="password" autocomplete="new-password" required></label>' : ""}<p class="error" role="alert">${esc(error)}</p><button class="primary" type="submit">${token ? "Activate account" : "Sign in"}</button></form><p class="hint">${token ? "Activation codes expire after 48 hours and can be used once." : `${esc(ownerName)}: use your dev-admin password for the first sign-in. Other administrators: use the account activated with your private link.`}</p><a href="../">← Back to ${esc(name)}</a></main>`;
    $("#login-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      e.submitter.disabled = true;
      try {
        if (token) {
          if (f.get("password") !== f.get("confirm"))
            throw Error("Passwords do not match.");
          const r = await api("activate", {
            token,
            password: f.get("password"),
          });
          history.replaceState(null, "", location.pathname);
          login();
          $("#login-form [name=username]").value = r.username;
          notice("Account activated. Sign in with your new password.");
        } else {
          user = (await api("login", Object.fromEntries(f))).user;
          await load();
        }
      } catch (err) {
        $("#login-form .error").textContent = err.message;
        e.submitter.disabled = false;
      }
    };
  }
  async function load() {
    state = await api("state");
    dirty = reportDirty = false;
    render();
  }
  function mark() {
    dirty = true;
    render();
  }
  function render() {
    app.inert = busy;
    if (!user || !state) return;
    app.innerHTML = `<header class="mast"><div><div class="brand">Jerm747 / Site Admin · Prototype 01</div><h1>${esc(name)}</h1><p class="muted">Music and updates, under your control.</p></div><div><div class="row"><a href="../" target="_blank" rel="noopener">View site ↗</a><button data-account>${esc(user.name)} · ${esc(user.role)}</button><button data-logout>Sign out</button></div></div></header><main class="layout"><nav class="tabs" aria-label="Admin sections">${[
      ["songs", "Songs"],
      ["collections", "Albums & playlists"],
      ["language", "Explicit & language"],
      ["email", "Email reports"],
    ]
      .map(
        ([id, label]) =>
          `<button data-tab="${id}" ${tab === id ? 'aria-current="page"' : ""}>${label}</button>`,
      )
      .join(
        "",
      )}</nav><section id="pane"></section><p class="footer-note">${esc(name)} settings are isolated from other sites. Catalog revision ${state.catalog.revision}.</p></main>`;
    app.querySelectorAll("[data-tab]").forEach(
      (b) =>
        (b.onclick = () => {
          tab = b.dataset.tab;
          render();
        }),
    );
    $("[data-logout]").onclick = async () => {
      if (
        (dirty || reportDirty) &&
        !confirm("Discard unsaved changes and sign out?")
      )
        return;
      await api("logout", {});
      user = null;
      state = null;
      dirty = reportDirty = false;
      login();
    };
    $("[data-account]").onclick = account;
    ({
      songs: renderSongs,
      collections: renderCollections,
      language: renderLanguage,
      email: renderEmail,
    })[tab]();
  }
  function savebar() {
    $("#pane").insertAdjacentHTML(
      "beforeend",
      `<div class="savebar"><span>${dirty ? "Unsaved catalog changes" : "Catalog is up to date"}</span><div class="row"><button data-reload ${busy ? "disabled" : ""}>Reload</button><button class="primary" data-save ${!dirty || busy ? "disabled" : ""}>${busy ? "Saving…" : "Save catalog"}</button></div></div>`,
    );
    $("[data-reload]").onclick = async () => {
      if (
        (dirty || reportDirty) &&
        !confirm("Discard unsaved changes and load the saved settings?")
      )
        return;
      try {
        await load();
      } catch (e) {
        notice(e.message);
      }
    };
    $("[data-save]").onclick = async () => {
      busy = true;
      render();
      try {
        state.catalog = (
          await api("save-catalog", {
            catalog: state.catalog,
            revision: state.catalog.revision,
          })
        ).catalog;
        dirty = false;
        notice("Catalog saved. New page loads use these settings.");
      } catch (e) {
        notice(e.message);
      } finally {
        busy = false;
        render();
      }
    };
  }
  function renderSongs() {
    const c = state.catalog;
    $("#pane").innerHTML =
      `<div class="topline"><div><h2>Your songs</h2><p class="muted">Add music, choose its album, and decide when it appears.</p></div><div class="row"><button data-scan>Scan audio folders</button><button class="primary" data-add>Add song</button></div></div><div class="metrics"><div class="metric"><small>Catalog</small><strong>${c.songs.length}</strong></div><div class="metric"><small>Published</small><strong>${c.songs.filter((s) => s.published !== false).length}</strong></div><div class="metric"><small>Explicit</small><strong>${c.songs.filter((s) => s.explicit).length}</strong></div></div><label class="search">Find a song<input id="search" type="search" placeholder="Title or artist"></label><div id="song-list" class="card"></div>`;
    $("[data-add]").onclick = () => editSong();
    $("[data-scan]").onclick = async (e) => {
      e.target.disabled = true;
      try {
        const r = await api("scan");
        const existing = new Set(c.songs.map((s) => s.url));
        const fresh = r.songs.filter((s) => !existing.has(s.url));
        if (!fresh.length)
          return notice(
            "No new audio files found in this site’s audio or music folders.",
          );
        modal(
          "Audio files found",
          `<p>${fresh.length} new songs can be added as unpublished drafts. Review titles, song types and explicit labels before publishing.</p><ul>${fresh.map((s) => `<li>${esc(s.title)}</li>`).join("")}</ul><button class="primary" id="import-scan">Add drafts</button>`,
        );
        $("#import-scan").onclick = () => {
          c.songs.push(...fresh);
          dialog.close();
          mark();
        };
      } catch (err) {
        notice(err.message);
      } finally {
        e.target.disabled = false;
      }
    };
    $("#search").oninput = (e) => songRows(e.target.value);
    songRows("");
    savebar();
  }
  function songRows(query) {
    const c = state.catalog,
      filtered = c.songs.filter((s) =>
        (s.title + " " + (s.artists || []).join(" "))
          .toLowerCase()
          .includes(query.toLowerCase()),
      );
    $("#song-list").innerHTML = !filtered.length
      ? `<div class="empty"><h3>${c.songs.length ? "No matching songs" : "Ready for the first track"}</h3><p>Add an audio URL or scan files already uploaded to this site. New songs start as drafts so you can review their details.</p></div>`
      : `<div class="table-wrap"><table><thead><tr><th>Song / order</th><th>Album</th><th>Status</th><th>Actions</th></tr></thead><tbody>${filtered.map((s) => `<tr><td><strong>${esc(s.title)}</strong><small>${esc((s.artists || []).join(", "))}</small></td><td>${esc(c.albums.find((a) => a.id === s.album)?.title || "Single / unassigned")}</td><td><span class="pill ${s.published !== false ? "on" : ""}">${s.published !== false ? "Published" : "Draft"}</span>${s.explicit ? '<span class="pill explicit">E</span>' : ""}</td><td><div class="row nowrap"><button data-up="${esc(s.id)}" aria-label="Move ${esc(s.title)} up">↑</button><button data-down="${esc(s.id)}" aria-label="Move ${esc(s.title)} down">↓</button><button data-edit="${esc(s.id)}">Edit</button></div></td></tr>`).join("")}</tbody></table></div>`;
    $("#song-list")
      .querySelectorAll("[data-edit]")
      .forEach((b) => (b.onclick = () => editSong(b.dataset.edit)));
    for (const dir of ["up", "down"])
      $("#song-list")
        .querySelectorAll(`[data-${dir}]`)
        .forEach(
          (b) =>
            (b.onclick = () => {
              const i = c.songs.findIndex((s) => s.id === b.dataset[dir]),
                j = i + (dir === "up" ? -1 : 1);
              if (j < 0 || j >= c.songs.length) return;
              [c.songs[i], c.songs[j]] = [c.songs[j], c.songs[i]];
              mark();
            }),
        );
  }
  function editSong(id) {
    const original = state.catalog.songs.find((s) => s.id === id),
      s = original || {
        id: "song-" + newId(),
        title: "",
        url: "",
        artists: [state.site?.artist || ""],
        album: "",
        kind: "vocal",
        language: "en",
        published: false,
        explicit: false,
        versions: [],
      };
    formModal(
      original ? "Edit song" : "Add song",
      `<div class="grid"><label class="wide">Title<input name="title" required value="${esc(s.title)}"></label><label class="wide">Audio URL or site path<input name="url" placeholder="audio/song.mp3 or https://…" value="${esc(s.url)}"><small>Upload the audio to your host first, or use an HTTPS audio link.</small></label><label>Artists · comma separated<input name="artists" value="${esc((s.artists || []).join(", "))}"></label><label>Album<select name="album"><option value="">Single / unassigned</option>${state.catalog.albums.map((a) => `<option value="${esc(a.id)}" ${s.album === a.id ? "selected" : ""}>${esc(a.title)}</option>`).join("")}</select></label><label>Song type<select name="kind">${["vocal", "instrumental", "spoken"].map((v) => `<option ${s.kind === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>Language code<input name="language" value="${esc(s.language || "en")}" placeholder="en"></label><label>Tempo (optional)<input type="number" name="bpm" min="0" max="400" step="0.1" value="${esc(s.bpm ?? "")}"></label><label>Release date (optional)<input name="date" placeholder="2026-11-03" value="${esc(s.date || "")}"></label></div><label class="check"><input type="checkbox" name="explicit" ${s.explicit ? "checked" : ""}> Contains explicit language</label><label class="check"><input type="checkbox" name="published" ${s.published !== false ? "checked" : ""}> Publish this song on the site</label>${original ? '<button type="button" class="danger" id="remove-song">Remove from catalog</button>' : ""}`,
      (f) => {
        const updated = {
          ...s,
          ...Object.fromEntries(f),
          artists: String(f.get("artists"))
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          explicit: f.has("explicit"),
          published: f.has("published"),
          bpm: f.get("bpm") === "" ? null : Number(f.get("bpm")),
        };
        if (original)
          state.catalog.songs[
            state.catalog.songs.findIndex((x) => x.id === id)
          ] = updated;
        else state.catalog.songs.push(updated);
        dialog.close();
        mark();
      },
    );
    if (original)
      $("#remove-song").onclick = () => {
        if (
          !confirm(
            "Remove this song from the catalog and playlists? Its audio file stays on the host.",
          )
        )
          return;
        state.catalog.songs = state.catalog.songs.filter((x) => x.id !== id);
        state.catalog.playlists.forEach(
          (p) => (p.trackIds = p.trackIds.filter((x) => x !== id)),
        );
        dialog.close();
        mark();
      };
  }
  function renderCollections() {
    $("#pane").innerHTML =
      `<div class="topline"><div><h2>Albums & playlists</h2><p class="muted">Album membership lives on each song. Playlists keep their own order.</p></div><div class="row"><button data-new-album>Add album</button><button class="primary" data-new-playlist>Add playlist</button></div></div><div class="grid"><div class="card"><h3>Albums</h3><ul class="list">${state.catalog.albums.map((a) => `<li><div><strong>${esc(a.title)}</strong><small class="muted"> · ${state.catalog.songs.filter((s) => s.album === a.id).length} songs</small></div><button data-album="${esc(a.id)}">Edit</button></li>`).join("") || '<p class="muted">No albums yet.</p>'}</ul></div><div class="card"><h3>Playlists</h3><ul class="list">${state.catalog.playlists.map((p) => `<li><div><strong>${esc(p.title)}</strong><small class="muted"> · ${p.trackIds.length} songs</small></div><button data-playlist="${esc(p.id)}">Edit</button></li>`).join("") || '<p class="muted">No playlists yet.</p>'}</ul></div></div>`;
    $("[data-new-album]").onclick = () => editAlbum();
    $("[data-new-playlist]").onclick = () => editPlaylist();
    document
      .querySelectorAll("[data-album]")
      .forEach((b) => (b.onclick = () => editAlbum(b.dataset.album)));
    document
      .querySelectorAll("[data-playlist]")
      .forEach((b) => (b.onclick = () => editPlaylist(b.dataset.playlist)));
    savebar();
  }
  function editAlbum(id) {
    const a = state.catalog.albums.find((a) => a.id === id) || {
      id: "album-" + newId(),
      title: "",
      artist: state.site?.artist || "",
      cover: "",
      color: "#e2ad4f",
    };
    formModal(
      id ? "Edit album" : "Add album",
      `<div class="grid"><label class="wide">Album title<input name="title" value="${esc(a.title)}" required></label><label>Artist<input name="artist" value="${esc(a.artist)}"></label><label>Accent color<input name="color" type="color" value="${esc(a.color)}"></label><label class="wide">Cover image URL (optional)<input name="cover" value="${esc(a.cover)}" placeholder="uploads/cover.webp"></label></div><p class="hint">Assign songs on the Songs page. Their catalog order determines the album order.</p>${id ? '<button type="button" class="danger" id="remove-album">Remove album</button>' : ""}`,
      (f) => {
        const next = { ...a, ...Object.fromEntries(f) };
        if (id)
          state.catalog.albums[
            state.catalog.albums.findIndex((x) => x.id === id)
          ] = next;
        else state.catalog.albums.push(next);
        dialog.close();
        mark();
      },
    );
    if (id)
      $("#remove-album").onclick = () => {
        if (!confirm("Remove this album? Its songs will become unassigned."))
          return;
        state.catalog.albums = state.catalog.albums.filter((x) => x.id !== id);
        state.catalog.songs.forEach((s) => {
          if (s.album === id) s.album = "";
        });
        dialog.close();
        mark();
      };
  }
  function editPlaylist(id) {
    const p = copy(
      state.catalog.playlists.find((p) => p.id === id) || {
        id: "playlist-" + newId(),
        title: "",
        trackIds: [],
      },
    );
    formModal(
      id ? "Edit playlist" : "Add playlist",
      `<label>Playlist title<input name="title" value="${esc(p.title)}" required></label><h3>Song order</h3><ul id="playlist-order" class="list"></ul><h3>Add or remove songs</h3><div class="playlist-picker">${state.catalog.songs.map((s) => `<label class="check"><input type="checkbox" data-track="${esc(s.id)}" ${p.trackIds.includes(s.id) ? "checked" : ""}>${esc(s.title)} ${s.published === false ? "· draft" : ""}</label>`).join("") || '<p class="muted">Add songs to the catalog first.</p>'}</div>${id ? '<button type="button" class="danger" id="remove-playlist">Remove playlist</button>' : ""}`,
      (f) => {
        p.title = f.get("title");
        if (id)
          state.catalog.playlists[
            state.catalog.playlists.findIndex((x) => x.id === id)
          ] = p;
        else state.catalog.playlists.push(p);
        dialog.close();
        mark();
      },
    );
    const order = () => {
      $("#playlist-order").innerHTML = p.trackIds
        .map(
          (songId, i) =>
            `<li><span>${esc(state.catalog.songs.find((s) => s.id === songId)?.title || songId)}</span><div class="row"><button type="button" data-position="${i}" data-delta="-1" aria-label="Move up">↑</button><button type="button" data-position="${i}" data-delta="1" aria-label="Move down">↓</button></div></li>`,
        )
        .join("");
      $("#playlist-order")
        .querySelectorAll("button")
        .forEach(
          (b) =>
            (b.onclick = () => {
              const i = Number(b.dataset.position),
                j = i + Number(b.dataset.delta);
              if (j < 0 || j >= p.trackIds.length) return;
              [p.trackIds[i], p.trackIds[j]] = [p.trackIds[j], p.trackIds[i]];
              order();
            }),
        );
    };
    order();
    dialog.querySelectorAll("[data-track]").forEach(
      (b) =>
        (b.onchange = () => {
          p.trackIds = b.checked
            ? [...p.trackIds, b.dataset.track]
            : p.trackIds.filter((x) => x !== b.dataset.track);
          order();
        }),
    );
    if (id)
      $("#remove-playlist").onclick = () => {
        if (confirm("Remove this playlist?")) {
          state.catalog.playlists = state.catalog.playlists.filter(
            (x) => x.id !== id,
          );
          dialog.close();
          mark();
        }
      };
  }
  function renderLanguage() {
    const c = state.catalog;
    $("#pane").innerHTML =
      `<h2>Explicit & language</h2><p class="muted">Labels control which songs appear and enter the player queue. They do not edit or censor audio.</p><div class="grid"><section class="card"><h3>Explicit tracks</h3><label>Site policy<select id="explicit-policy"><option value="opt-in" ${c.policy.explicit === "opt-in" ? "selected" : ""}>Hidden until the listener opts in</option><option value="blocked" ${c.policy.explicit === "blocked" ? "selected" : ""}>Always hide explicit tracks</option></select></label><p class="hint">Explicit tracks that a listener enables display an E marker.</p></section><section class="card"><h3>Default listening choices</h3>${["instrumental", "vocal", "spoken"].map((t) => `<label class="check"><input type="checkbox" data-type="${t}" ${c.policy.defaultTypes.includes(t) ? "checked" : ""}>${t === "spoken" ? "Spoken word" : t[0].toUpperCase() + t.slice(1)}</label>`).join("")}<p class="hint">Listeners can change these choices on their own device.</p></section></div><section class="card"><h3>Review song labels</h3><ul class="list">${c.songs.map((s) => `<li><div><strong>${esc(s.title)}</strong><small> · ${esc(s.kind || "vocal")} · ${esc(s.language || "en")}</small></div><label class="check"><input type="checkbox" data-explicit="${esc(s.id)}" ${s.explicit ? "checked" : ""}>Explicit</label></li>`).join("") || '<p class="muted">Add songs to start reviewing their labels.</p>'}</ul></section>`;
    $("#explicit-policy").onchange = (e) => {
      c.policy.explicit = e.target.value;
      mark();
    };
    document.querySelectorAll("[data-type]").forEach(
      (b) =>
        (b.onchange = () => {
          c.policy.defaultTypes = b.checked
            ? [...c.policy.defaultTypes, b.dataset.type]
            : c.policy.defaultTypes.filter((t) => t !== b.dataset.type);
          mark();
        }),
    );
    document.querySelectorAll("[data-explicit]").forEach(
      (b) =>
        (b.onchange = () => {
          c.songs.find((s) => s.id === b.dataset.explicit).explicit = b.checked;
          mark();
        }),
    );
    savebar();
  }
  function renderEmail() {
    const r = state.reports;
    $("#pane").innerHTML =
      `<div class="topline"><div><h2>Site updates by email</h2><p class="muted">Song activity and catalog changes, on your schedule.</p></div><button id="preview-report">Preview saved report</button></div><div class="metrics"><div class="metric"><small>Schedule</small><strong>${r.enabled ? "On" : "Off"}</strong></div><div class="metric"><small>Next scheduled send</small><p>${esc(when(r.nextAt))}</p></div><div class="metric"><small>Last attempt</small><p>${r.lastAttempt ? esc(when(r.lastAttempt)) : "None yet"}</p></div></div><p class="hint">${esc(r.status)}</p><form id="report-form" class="card"><label class="check"><input name="enabled" type="checkbox" ${r.enabled ? "checked" : ""}>Enable scheduled reports</label><div class="grid"><label class="wide">Send to · one email per line<textarea name="to" rows="2" placeholder="you@example.com">${esc(r.to.join("\n"))}</textarea></label><label>Frequency<select name="frequency"><option value="daily" ${r.frequency === "daily" ? "selected" : ""}>Daily</option><option value="weekly" ${r.frequency === "weekly" ? "selected" : ""}>Weekly</option></select></label><label>Weekly send day<select name="weekday">${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d, i) => `<option value="${i + 1}" ${r.weekday === i + 1 ? "selected" : ""}>${d}</option>`).join("")}</select></label><label>Local time<input name="time" type="time" value="${esc(r.time)}" required></label><label>Timezone<input name="timezone" value="${esc(r.timezone)}" required placeholder="America/New_York"></label><fieldset class="wide"><legend>Report contents</legend><label class="check"><input type="checkbox" name="songs" ${r.sections.includes("songs") ? "checked" : ""}>Song plays and catalog totals</label><label class="check"><input type="checkbox" name="changes" ${r.sections.includes("changes") ? "checked" : ""}>Recent catalog updates</label></fieldset><label class="wide">Opening note (optional)<textarea name="note" rows="3">${esc(r.note)}</textarea></label></div><p class="hint">From ${esc(state.mailFrom)}. Preview and test use your saved settings.</p><div class="actions"><button type="button" id="test-report" ${reportDirty ? "disabled" : ""}>Send saved test</button><button class="primary" type="submit">Save report settings</button></div><p id="report-dirty" class="hint">${reportDirty ? "Unsaved report settings" : ""}</p></form><section class="card"><h3>Run reports while the site is closed</h3><p class="hint">Add this command in cPanel → Cron Jobs, every five minutes. The first run after a scheduled time sends the report. Hosting time and delivery can vary.</p><p><strong>${state.schedulerLastRun ? "Scheduler last checked: " + esc(when(state.schedulerLastRun)) : "Scheduler has not connected yet."}</strong></p><code>${esc(state.cron)}</code><p class="hint">Reports remain off until you enable them. Mail-server acceptance does not confirm inbox delivery.</p></section><section class="card log"><h3>Recent sends</h3>${r.history.map((h) => `<p>${esc(when(h.at))}${h.test ? " · test" : ""}<br>${esc(h.status)}<br>${h.results.map((x) => `${esc(x.to)}: ${x.accepted ? "accepted" : "refused"}`).join("<br>")}</p>`).join("") || '<p class="muted">No report attempts yet.</p>'}</section>`;
    const readDraft = () => {
      const f = new FormData($("#report-form"));
      return {
        ...state.reports,
        ...Object.fromEntries(f),
        enabled: f.has("enabled"),
        to: String(f.get("to"))
          .split(/[\n,;]/)
          .map((x) => x.trim())
          .filter(Boolean),
        weekday: Number(f.get("weekday")),
        sections: ["songs", "changes"].filter((x) => f.has(x)),
      };
    };
    $("#report-form").oninput = () => {
      state.reports = readDraft();
      reportDirty = true;
      $("#report-dirty").textContent = "Unsaved report settings";
      $("#test-report").disabled = true;
    };
    $("#report-form").onsubmit = async (e) => {
      e.preventDefault();
      e.submitter.disabled = true;
      busy = true;
      app.inert = true;
      try {
        state.reports = (
          await api("save-reports", {
            reports: readDraft(),
            revision: state.reports.revision,
          })
        ).reports;
        reportDirty = false;
        notice("Report settings saved.");
      } catch (err) {
        notice(err.message);
      } finally {
        busy = false;
        render();
      }
    };
    $("#preview-report").onclick = async () => {
      try {
        const r = await api("preview");
        modal(
          "Email preview",
          '<iframe id="mail-preview" title="Report email preview" sandbox=""></iframe>',
        );
        $("#mail-preview").srcdoc = r.html;
      } catch (e) {
        notice(e.message);
      }
    };
    $("#test-report").onclick = async (e) => {
      if (!confirm("Send a test report now to the saved recipients?")) return;
      e.target.disabled = true;
      try {
        const r = await api("test-report", {});
        state.reports = (await api("state")).reports;
        render();
        notice(
          r.captured
            ? "Test captured; no email sent."
            : r.ok
              ? "Accepted by the mail server. Check the recipient inbox."
              : "The mail server refused one or more messages.",
        );
      } catch (err) {
        notice(err.message);
        e.target.disabled = false;
      }
    };
  }
  async function account() {
    try {
      const users = user.role === "owner" ? (await api("users")).users : [];
      modal(
        "Your account",
        `<p><strong>${esc(user.name)}</strong> · ${esc(user.role)}</p>${user.usesOwnerPassword ? `<p class="hint">You are using your dev-admin password. Set a password for ${esc(name)} below to make this account independent.</p>` : ""}<button id="change-password">Change my password</button>${user.role === "owner" ? `<section class="card"><h3>Site administrators</h3><ul class="list">${users.map((u) => `<li><div>${esc(u.name)} <small>(${esc(u.username)}) · ${u.pending ? "awaiting activation" : u.enabled ? u.role : "disabled"}</small></div>${u.role !== "owner" ? `<button data-disable="${esc(u.username)}">Disable</button>` : ""}</li>`).join("")}</ul><button class="primary" id="invite" type="button">Create activation link</button><p class="hint">Share the link privately. The recipient sets their own password. No email is sent automatically.</p></section>` : ""}`,
      );
      $("#change-password").onclick = () => {
        dialog.close();
        formModal(
          "Change your password",
          '<label>Current password<input type="password" name="current" autocomplete="current-password" required></label><label>New password · at least 12 characters<input type="password" name="password" autocomplete="new-password" minlength="12" maxlength="72" required></label><label>Confirm new password<input type="password" name="confirm" autocomplete="new-password" required></label>',
          async (f) => {
            if (f.get("password") !== f.get("confirm"))
              throw Error("Passwords do not match.");
            user = (await api("password", Object.fromEntries(f))).user;
            dialog.close();
            notice("Password updated. Other sessions have been signed out.");
            render();
          },
        );
      };
      if (user.role === "owner") {
        $("#invite").onclick = () => {
          dialog.close();
          formModal(
            "Create a site administrator",
            '<label>Name<input name="name" value="' +
              esc(document.body.dataset.adminName || "") +
              '" required maxlength="100"></label><label>Username<input name="username" value="' +
              esc(document.body.dataset.adminUsername || "") +
              '" pattern="[a-z0-9][a-z0-9_-]*" maxlength="40" required></label><p class="hint">Creating a new link for an existing administrator replaces their access until they activate it.</p>',
            async (f) => {
              const r = await api("invite", Object.fromEntries(f));
              dialog.close();
              modal(
                "Activation link ready",
                `<p>For <strong>${esc(r.username)}</strong> · expires in 48 hours.</p><label>Private activation link<textarea readonly rows="4">${esc(r.activationUrl)}</textarea></label><p class="hint">Copy and share privately. They choose their own password. Closing this window hides the link; you can create a new one if needed.</p>`,
              );
            },
          );
        };
        dialog.querySelectorAll("[data-disable]").forEach(
          (b) =>
            (b.onclick = async () => {
              if (
                !confirm(
                  "Disable this administrator and end their active sessions?",
                )
              )
                return;
              try {
                await api("disable-user", { username: b.dataset.disable });
                dialog.close();
                await account();
              } catch (e) {
                notice(e.message);
              }
            }),
        );
      }
    } catch (e) {
      notice(e.message);
    }
  }
  window.addEventListener("beforeunload", (e) => {
    if (dirty || reportDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  if (location.hash.startsWith("#activate=")) login();
  else
    api("session")
      .then(async (r) => {
        user = r.user;
        await load();
      })
      .catch((e) => login(e.message === "Please sign in." ? "" : e.message));
})();
