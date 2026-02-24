function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function setHint(text, kind = "muted") {
  const hint = $("photoHint");
  hint.className = `photoHint ${kind}`;
  hint.textContent = text || "";
}

function pulseButton(btn) {
  btn.classList.remove("is-pulsing");
  // force reflow
  void btn.offsetWidth;
  btn.classList.add("is-pulsing");
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

// ---------------- Spotify ----------------
function parseSpotify(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;

  // spotify:track:ID
  const uriMatch = trimmed.match(/^spotify:(track|album|playlist|episode|show):([A-Za-z0-9]+)$/i);
  if (uriMatch) {
    return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] };
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const hostOk =
    url.hostname === "open.spotify.com" ||
    url.hostname === "spotify.com" ||
    url.hostname.endsWith(".spotify.com");
  if (!hostOk) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  // /track/:id, /album/:id, /playlist/:id, /episode/:id, /show/:id
  if (parts.length >= 2) {
    const type = parts[0].toLowerCase();
    const id = parts[1];
    const okType = ["track", "album", "playlist", "episode", "show"].includes(type);
    const okId = /^[A-Za-z0-9]+$/.test(id);
    if (okType && okId) return { type, id };
  }

  return null;
}

function spotifyEmbedUrl(type, id) {
  return `https://open.spotify.com/embed/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
}

async function renderSpotify() {
  const list = $("spotifyList");
  list.innerHTML = "";

  let items = [];
  try {
    const data = await fetchJson("/api/songs");
    items = data.songs || [];
  } catch (e) {
    const err = document.createElement("div");
    err.className = "muted";
    err.textContent = `Could not load songs: ${e.message}`;
    list.appendChild(err);
    return;
  }

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No songs yet. Add a Spotify link above.";
    list.appendChild(empty);
    return;
  }

  for (const item of items) {
    const wrap = document.createElement("div");
    wrap.className = "spotifyItem";

    const top = document.createElement("div");
    top.className = "spotifyItem__top";

    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = `Spotify ${item.spotify_type}`;

    const actions = document.createElement("div");
    actions.className = "row";

    const openBtn = document.createElement("a");
    openBtn.className = "btn btn--ghost";
    openBtn.textContent = "Open";
    openBtn.href = item.spotify_url;
    openBtn.target = "_blank";
    openBtn.rel = "noreferrer";

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn--ghost";
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      try {
        await fetchJson(`/api/songs/${item.id}`, { method: "DELETE" });
        await renderSpotify();
      } catch (e) {
        alert(e.message);
      }
    });

    actions.append(openBtn, removeBtn);
    top.append(pill, actions);

    const frame = document.createElement("iframe");
    frame.className = "spotifyFrame";
    frame.loading = "lazy";
    frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    frame.src = spotifyEmbedUrl(item.spotify_type, item.spotify_id);
    frame.title = `Spotify ${item.spotify_type}`;

    wrap.append(top, frame);
    list.appendChild(wrap);
  }
}

async function addSpotifyFromInput(urlText) {
  const parsed = parseSpotify(urlText);
  if (!parsed) {
    alert("Paste a valid Spotify link (track/album/playlist/show/episode).");
    return;
  }
  try {
    await fetchJson("/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlText }),
    });
    await renderSpotify();
  } catch (e) {
    alert(e.message);
  }
}

// ---------------- Note ----------------
function renderNotePreview(note) {
  const box = $("notePreview");
  if (!note || (!note.title && !note.body)) {
    box.hidden = true;
    return;
  }
  $("notePreviewTitle").textContent = note.title || "(Untitled)";
  $("notePreviewBody").textContent = note.body || "";
  box.hidden = false;
}

async function loadNoteIntoFields() {
  try {
    const data = await fetchJson("/api/note");
    const note = data.note || { title: "", body: "" };
    $("noteTitle").value = note.title || "";
    $("noteBody").value = note.body || "";
    renderNotePreview(note);
  } catch (e) {
    renderNotePreview({ title: "", body: "" });
  }
}

async function saveNoteFromFields() {
  const title = String($("noteTitle").value || "").trim();
  const body = String($("noteBody").value || "");
  try {
    const data = await fetchJson("/api/note", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    renderNotePreview(data.note || { title, body });
  } catch (e) {
    alert(e.message);
  }
}

// ---------------- Photos ----------------
async function renderPhotos() {
  const gallery = $("photoGallery");
  gallery.innerHTML = "";

  let photos = [];
  try {
    const data = await fetchJson("/api/photos");
    photos = data.photos || [];
  } catch (e) {
    const err = document.createElement("div");
    err.className = "muted";
    err.textContent = `Could not load photos: ${e.message}`;
    gallery.appendChild(err);
    return;
  }

  if (!photos.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No photos saved yet.";
    gallery.appendChild(empty);
    return;
  }

  for (const p of photos) {
    const card = document.createElement("div");
    card.className = "photoCard";

    const img = document.createElement("img");
    img.src = p.data_url;
    img.alt = p.caption ? `Photo: ${p.caption}` : "Uploaded photo";
    img.loading = "lazy";

    const body = document.createElement("div");
    body.className = "photoCard__body";

    const caption = document.createElement("div");
    caption.className = "photoCard__caption";
    caption.textContent = p.caption || "(no caption)";

    const actions = document.createElement("div");
    actions.className = "photoCard__actions row";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn--ghost";
    editBtn.type = "button";
    editBtn.textContent = "Edit text";
    editBtn.addEventListener("click", async () => {
      const nextCaption = prompt("Edit caption:", p.caption || "");
      if (nextCaption === null) return;
      try {
        await fetchJson(`/api/photos/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption: String(nextCaption) }),
        });
        await renderPhotos();
      } catch (e) {
        alert(e.message);
      }
    });

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn--ghost";
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      const ok = confirm("Delete this photo?");
      if (!ok) return;
      try {
        await fetchJson(`/api/photos/${p.id}`, { method: "DELETE" });
        await renderPhotos();
      } catch (e) {
        alert(e.message);
      }
    });

    actions.append(editBtn, delBtn);
    body.append(caption, actions);
    card.append(img, body);
    gallery.appendChild(card);
  }
}

async function savePhotoFromForm() {
  const file = $("photoFile").files && $("photoFile").files[0];
  const caption = String($("photoCaption").value || "").trim();
  if (!file) {
    setHint("Pick a photo first.", "muted");
    return;
  }

  setHint("Saving photo…", "muted");
  const fd = new FormData();
  fd.append("photo", file);
  fd.append("caption", caption);

  try {
    await fetchJson("/api/photos", { method: "POST", body: fd });
  } catch (e) {
    setHint(e.message, "muted");
    return;
  }

  $("photoFile").value = "";
  $("photoCaption").value = "";
  setHint("Saved.", "muted");
  await renderPhotos();
}

// ---------------- Reset ----------------
function resetAll() {
  const ok = confirm("Clear your input fields? (This does NOT delete the shared online data.)");
  if (!ok) return;
  $("spotifyUrl").value = "";
  $("noteTitle").value = "";
  $("noteBody").value = "";
  $("photoFile").value = "";
  $("photoCaption").value = "";
  setHint("");
  renderNotePreview(null);
}

// ---------------- Wire up ----------------
function wireUp() {
  // reactive button taps
  document.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest && e.target.closest("button.btn, a.btn");
    if (btn) pulseButton(btn);
  });

  $("spotifyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addSpotifyFromInput($("spotifyUrl").value);
    $("spotifyUrl").value = "";
    $("spotifyUrl").focus();
  });

  $("btnDemoSong").addEventListener("click", () => {
    // Rick Astley - Never Gonna Give You Up
    addSpotifyFromInput("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
  });

  $("btnSaveNote").addEventListener("click", saveNoteFromFields);
  $("btnLoadNote").addEventListener("click", loadNoteIntoFields);

  $("photoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await savePhotoFromForm();
    } catch {
      setHint("Could not save that photo. Try again with a smaller image.", "muted");
    }
  });

  $("btnClearPhotoForm").addEventListener("click", () => {
    $("photoFile").value = "";
    $("photoCaption").value = "";
    setHint("");
  });

  $("btnReset").addEventListener("click", resetAll);

  // initial render
  renderSpotify();
  loadNoteIntoFields();
  renderPhotos();
}

wireUp();

