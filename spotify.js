function parseSpotify(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;

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
  if (parts.length >= 2) {
    const type = parts[0].toLowerCase();
    const id = parts[1];
    const okType = ["track", "album", "playlist", "episode", "show"].includes(type);
    const okId = /^[A-Za-z0-9]+$/.test(id);
    if (okType && okId) return { type, id };
  }

  return null;
}

function spotifyCanonicalUrl(type, id) {
  return `https://open.spotify.com/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
}

module.exports = { parseSpotify, spotifyCanonicalUrl };

