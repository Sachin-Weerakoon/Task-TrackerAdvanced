# TaskFlow — Ops Runbook

How to run, check, deploy, back up, restore and roll back TaskFlow.

---

## 1. Services

| Service | Image | Purpose | Exposed |
|---|---|---|---|
| `nginx` | `nginx:alpine` | Reverse proxy, the only public entry point | Dev: `localhost:8080` · Prod: port `80` (`HTTP_PORT`) |
| `app` | Built locally (dev) / `ghcr.io/sachin-weerakoon/task-trackeradvanced` (prod) | Next.js app + API (`/api/...`) | Internal only (`app:3000`) |
| `mongo` | `mongo:8` | Database, data in a named volume | Internal only |
| `backup` | `mongo:8` | Runs `mongodump` every 24h, keeps 7 days | Writes to `./backups` |

Compose files:

- `docker-compose.yml` → **development**, builds the image from source.
- `docker-compose.prod.yml` → **production**, pulls a tagged image from GHCR.

---

## 2. First-time setup

1. Install Docker Desktop (Windows: use WSL 2) and make sure **Engine running** is shown.
2. Create `.env` from the example and fill in real values:

   ```
   MONGODB_URI=mongodb://mongo:27017/taskflow
   JWT_SECRET=<long random string, at least 32 chars>
   LOG_LEVEL=info
   ```

   - Never commit `.env`.
   - The app returns **500 on register/login if `JWT_SECRET` is empty**.
3. **Production only:** log in to GHCR so Docker can pull the private image. Use a GitHub Personal Access Token with `read:packages`:

   ```
   docker login ghcr.io -u <github-username>
   ```

---

## 3. Start / stop

| Action | Development | Production |
|---|---|---|
| Start | `docker compose up -d --build` | `docker compose -f docker-compose.prod.yml up -d` |
| Stop (keep data) | `docker compose down` | `docker compose -f docker-compose.prod.yml down` |
| Stop + **delete data** ⚠️ | `docker compose down -v` | Don't do this in production |

---

## 4. Health checks

```
docker compose ps
```

- `app` and `mongo` should show **(healthy)**; `nginx` and `backup` should show **running**.
- The health endpoint is `GET /api/health`, which returns `{"status":"ok","service":"taskflow",...}`:
  - Dev: http://localhost:8080/api/health
  - Prod: http://<server>/api/health
- `app` has a Docker `HEALTHCHECK` every 30s. `nginx` only starts once `app` is healthy, and `app` only starts once `mongo` is healthy.

---

## 5. Logs

The app writes structured JSON logs (Pino) to stdout.

```
docker compose logs app --tail 50
docker compose logs -f app          # follow live
docker compose logs nginx --tail 50
docker compose logs mongo --tail 50
docker compose logs backup --tail 50
```

Each log line has `level` (30 = info, 40 = warn, 50 = error), `path`, `status` and a `requestId`.

---

## 6. Deploy a release (production)

Images are published to GHCR by the **Release** workflow:

| Event | Tags pushed |
|---|---|
| Merge / push to `main` | `sha-<short-commit>`, `latest` |
| Git tag `v1.2.3` | `1.2.3`, `sha-<short-commit>` |

To deploy a specific version:

```
# PowerShell
$env:IMAGE_TAG="1.0.0"
docker compose -f docker-compose.prod.yml pull app
docker compose -f docker-compose.prod.yml up -d app
docker compose -f docker-compose.prod.yml ps
```

```
# bash
IMAGE_TAG=1.0.0 docker compose -f docker-compose.prod.yml pull app
IMAGE_TAG=1.0.0 docker compose -f docker-compose.prod.yml up -d app
```

You can also set `IMAGE_TAG=1.0.0` in `.env` so it sticks.

After deploying, check:
- `/api/health` returns 200
- `app` shows **(healthy)**
- the logs have no errors

**Always deploy a fixed tag (`1.0.0` or `sha-xxxxxxx`) in production, never `latest`.** This is what makes rollback possible.

---

## 7. Rollback

If a new release is broken:

1. Find the last good version on the GitHub repo page → **Packages** → `task-trackeradvanced`, or from the previous git tag.
2. Redeploy it:

   ```
   $env:IMAGE_TAG="<previous-good-tag>"     # e.g. 1.0.0 or sha-a1b2c3d
   docker compose -f docker-compose.prod.yml pull app
   docker compose -f docker-compose.prod.yml up -d app
   ```

3. Check health and logs as in section 6.
4. If the bad release changed or damaged data, restore the last backup taken **before** the deploy (section 8).
5. Tell the team which version is running, and open an issue for the broken release.

Rollback only replaces the `app` container. MongoDB data is not touched unless you restore a backup.

---

## 8. Backups & restore

### Automatic backups

- The `backup` service runs `mongodump` when it starts, then every 24 hours (`BACKUP_INTERVAL_SECONDS`).
- Files are saved to `./backups/taskflow-YYYYMMDD-HHMMSS.archive.gz`.
- Files older than 7 days are deleted automatically (`BACKUP_RETENTION_DAYS`).
- `./backups` is git-ignored.

Check that backups are happening:

```
docker compose logs backup --tail 20
ls backups
```

### Take a manual backup (e.g. right before a deploy)

```
docker compose exec backup sh -c 'mongodump --uri="$MONGO_URI" --archive=/backups/manual-$(date -u +%Y%m%d-%H%M%S).archive.gz --gzip'
```

### Restore a backup

⚠️ `--drop` **replaces** the current collections with the backup contents.

```
ls backups
docker compose exec backup mongorestore --uri=mongodb://mongo:27017 --archive=/backups/<file-name> --gzip --drop
```

Then check the data:

```
docker compose exec mongo mongosh taskflow --quiet --eval "db.users.countDocuments()"
```

For production, add `-f docker-compose.prod.yml` after `docker compose`.

**Test a restore regularly.** A backup that has never been restored is not proven.

---

## 9. CI/CD overview

| Workflow | File | Runs on | What it does |
|---|---|---|---|
| CI | `.github/workflows/ci.yml` | PRs and pushes to `main` | `npm ci` → lint → typecheck → test → Docker build |
| Release | `.github/workflows/release.yml` | Pushes to `main`, tags `v*.*.*` | Builds and pushes the image to GHCR |

Rules:
- All changes go through a PR; CI must be green before merging.
- Releases are created by pushing a git tag: `git tag v1.0.0 && git push origin v1.0.0`

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `docker` not recognized | Docker Desktop not installed or not running | Install or start Docker Desktop, then open a new terminal |
| Browser shows **"Cross-origin request rejected"** (403) | App's origin check compares against its internal URL behind nginx | Fixed in app code (use `APP_URL`/forwarded host). Confirm nginx sends `Host $http_host` |
| Register/login returns **500** | `JWT_SECRET` empty in `.env` | Set it, then `docker compose up -d` (not `restart`) |
| `app` is **unhealthy** | App crashed or `/api/health` failing | `docker compose logs app --tail 50` |
| `app` never starts | `mongo` not healthy | `docker compose logs mongo` |
| nginx returns **502 Bad Gateway** | `app` down or restarting | `docker compose ps`, then check app logs |
| Port 8080 / 80 already in use | Another program uses the port | Stop it, or change the port (`HTTP_PORT` in prod) |
| `.env` changes not applied | `restart` doesn't reload env files | `docker compose up -d` |
| Prod `pull` fails with *denied* | Not logged in to GHCR | `docker login ghcr.io` with a `read:packages` token |
| No new files in `./backups` | Backup container stopped | `docker compose logs backup`, `docker compose up -d backup` |

---

## 11. Contacts

| Area | Owner |
|---|---|
| App code, API, auth, tests | SE Intern |
| Docker, Compose, CI/CD, backups, runbook | DevOps Intern |
| Repo, releases, approvals | Project Manager (Sachin) |
