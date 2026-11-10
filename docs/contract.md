# TaskFlow — SE ↔ DevOps Contract

Agreed between: **SE Intern** and **DevOps Intern**.
Date: 2026-11-09

Repository: shared repo https://github.com/Sachin-Weerakoon/Task-TrackerAdvanced (Next.js 16, TypeScript, App Router, Tailwind, npm). Work happens on feature branches and is merged to `main` through pull requests.

The goal: if both sides follow this contract, the app runs inside the DevOps containers without changes.

---

## 1. App basics (SE side)

| Item | Agreed value |
|---|---|
| Framework | Next.js (App Router) |
| App location | Repo root (`package.json` at the top level) |
| Node version | 24 (LTS), Docker base image `node:24-alpine` |
| Package manager | npm, with `package-lock.json` committed |
| Port | `3000` (read from `PORT` env var) |
| Build output | `next.config` must contain `output: 'standalone'` |

## 2. Environment variables

| Name | Example | Used by | Notes |
|---|---|---|---|
| `MONGODB_URI` | `mongodb://mongo:27017/taskflow` | SE (Mongoose) | Inside Docker the host is `mongo`, not `localhost` |
| `JWT_SECRET` | `change-me` | SE (auth) | Never commit the real value |
| `PORT` | `3000` | Next.js | |
| `NODE_ENV` | `production` | Both | |
| `LOG_LEVEL` | `info` | SE (Pino) | |

Rules:
- Secrets are read at **runtime**, never hard-coded.
- No `NEXT_PUBLIC_*` variables for anything that changes per environment (they get baked into the image at build time).
- The app must **not** connect to MongoDB during `npm run build`.

## 3. API endpoints DevOps depends on

`GET /api/health`
- Returns HTTP `200` and JSON: `{ "status": "ok" }`
- Optional extra: `{ "status": "ok", "db": "connected" }`
- Must respond quickly and must not require login.

All other routes live under `/api/...`.

## 4. npm scripts (used by CI)

| Script | Purpose |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest or Vitest (CI uses `--passWithNoTests` until tests exist) |
| `npm run build` | `next build` |
| `npm start` | Not used in Docker (container runs `node server.js`) |

## 5. Logging

- Logs go to **stdout** as JSON (Pino). No log files inside the container.

## 6. Who owns what

| SE Intern (`taskflow-app`) | DevOps Intern (`taskflow-devops`) |
|---|---|
| App code, API routes, models, auth | `Dockerfile`, `.dockerignore` |
| Unit tests | `docker-compose.yml` |
| `.env.example` entries for new vars | `nginx/` config |
| | CI workflows, GHCR publishing |
| | Backups, runbook, rollback |

## 7. Hand-offs

1. SE tells DevOps when `/api/health` is working on `main`. DevOps then swaps the placeholder app for the real repo.
2. DevOps tells SE when `docker compose up` runs the app and Mongo. SE can then test inside Compose.
3. SE tells DevOps when the first test file is merged. CI drops `--passWithNoTests`.
4. If anyone needs a **new env var**, they tell the other person and update this file.
