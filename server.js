const path = require("path");
const express = require("express");
const multer = require("multer");

const { pool, initDb } = require("./db");
const { parseSpotify, spotifyCanonicalUrl } = require("./spotify");
const { getCloudinary } = require("./cloudinaryClient");

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ----- API -----
app.get("/api/songs", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, spotify_type, spotify_id, spotify_url, created_at FROM songs ORDER BY created_at DESC, id DESC"
  );
  res.json({ songs: rows });
});

app.post("/api/songs", async (req, res) => {
  const url = req.body && req.body.url;
  const parsed = parseSpotify(url);
  if (!parsed) return res.status(400).json({ error: "Invalid Spotify URL" });

  const canonical = spotifyCanonicalUrl(parsed.type, parsed.id);

  try {
    const { rows } = await pool.query(
      `INSERT INTO songs (spotify_type, spotify_id, spotify_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (spotify_type, spotify_id) DO UPDATE SET spotify_url = EXCLUDED.spotify_url
       RETURNING id, spotify_type, spotify_id, spotify_url, created_at`,
      [parsed.type, parsed.id, canonical]
    );
    res.json({ song: rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Failed to save song" });
  }
});

app.delete("/api/songs/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  await pool.query("DELETE FROM songs WHERE id = $1", [id]);
  res.json({ ok: true });
});

app.get("/api/note", async (_req, res) => {
  const { rows } = await pool.query("SELECT id, title, body, updated_at FROM note WHERE id = 1");
  res.json({ note: rows[0] || { id: 1, title: "", body: "", updated_at: null } });
});

app.put("/api/note", async (req, res) => {
  const title = String((req.body && req.body.title) || "").slice(0, 140);
  const body = String((req.body && req.body.body) || "").slice(0, 10000);

  const { rows } = await pool.query(
    `INSERT INTO note (id, title, body, updated_at)
     VALUES (1, $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, updated_at = NOW()
     RETURNING id, title, body, updated_at`,
    [title, body]
  );

  res.json({ note: rows[0] });
});

app.get("/api/photos", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, image_url, caption, created_at FROM photos ORDER BY created_at DESC, id DESC LIMIT 60"
  );
  res.json({ photos: rows });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB
});

app.post("/api/photos", upload.single("photo"), async (req, res) => {
  const cloudinary = getCloudinary();
  if (!cloudinary) {
    return res.status(500).json({
      error:
        "Cloudinary is not configured. Set CLOUDINARY_URL (or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET).",
    });
  }

  const file = req.file;
  if (!file) return res.status(400).json({ error: "Missing photo" });

  const caption = String((req.body && req.body.caption) || "").slice(0, 240);

  try {
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "sityy",
          resource_type: "image",
        },
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
      stream.end(file.buffer);
    });

    const imageUrl = uploadResult.secure_url;
    const publicId = uploadResult.public_id;

    const { rows } = await pool.query(
      `INSERT INTO photos (image_url, cloudinary_public_id, caption)
       VALUES ($1, $2, $3)
       RETURNING id, image_url, caption, created_at`,
      [imageUrl, publicId, caption]
    );

    res.json({ photo: rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

app.delete("/api/photos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });

  const { rows } = await pool.query("SELECT cloudinary_public_id FROM photos WHERE id = $1", [id]);
  const row = rows[0];
  if (!row) return res.json({ ok: true });

  await pool.query("DELETE FROM photos WHERE id = $1", [id]);

  const cloudinary = getCloudinary();
  if (cloudinary) {
    try {
      await cloudinary.uploader.destroy(row.cloudinary_public_id, { resource_type: "image" });
    } catch {
      // ignore cleanup failure
    }
  }

  res.json({ ok: true });
});

app.patch("/api/photos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  const caption = String((req.body && req.body.caption) || "").slice(0, 240);

  const { rows } = await pool.query(
    `UPDATE photos
     SET caption = $2
     WHERE id = $1
     RETURNING id, image_url, caption, created_at`,
    [id, caption]
  );

  res.json({ photo: rows[0] || null });
});

async function start() {
  await initDb();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});

