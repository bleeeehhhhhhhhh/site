## Sityy website

### Run

This version uses a real database (shared for everyone). For local running you need a Postgres connection string:

```bash
# PowerShell example
$env:DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/DBNAME"
```

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

### Deploy to Render (so people can see it)

1) Put this project on GitHub:

```bash
git init
git add .
git commit -m "Initial site"
```

Create a new GitHub repo, then:

```bash
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

2) Deploy on Render:
- Go to Render → **New** → **Blueprint**
- Select your GitHub repo
- Render will detect `render.yaml` and create the web service
- When it finishes, you’ll get a public URL like `https://xxxx.onrender.com`

### Important note about “sharing”

- After deploy, **everyone sees the same songs/text/photos** (stored in Postgres + Cloudinary).
- After deploy, **everyone sees the same songs/text/photos** (stored in Postgres).
- If you want logins / private posts / only-you-can-delete, tell me and I’ll add auth.

### Features

- Add Spotify links (track/album/playlist/show/episode) and view embeds
- Write/edit shared text note
- Upload photos with captions (stored directly in the database; small personal use recommended)

