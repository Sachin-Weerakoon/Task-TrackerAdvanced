# TaskFlow

A personal task board for team members, built with Next.js 16.4.5 App Router, React, TypeScript, Tailwind CSS, MongoDB/Mongoose, Zod, bcryptjs, jose and Pino. Each account has its own tasks; shared boards and task assignment are outside this assignment's scope.

## Local setup

Use the official team repository and feature branch:

```bash
cd /Users/maleeshasandeep/Task-TrackerAdvanced
git switch feature/se-taskflow-maleesha
npm ci
cp .env.example .env.local
```

Set the following in `.env.local` (never commit this file):

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | Local MongoDB URI, e.g. `mongodb://127.0.0.1:27017/taskflow`, or your MongoDB Atlas application connection string |
| `JWT_SECRET` | A random secret of at least 32 bytes; generate one with `openssl rand -base64 48` |
| `LOG_LEVEL` | `info` by default; standard Pino levels are supported |

For Atlas, create a database user with access to your application database, permit the application's IP in Network Access, and copy the application connection URI. URL-encode special characters in credentials. Keep the URI on the server. For a local database, start MongoDB before trying registration or login. MongoDB needs permission to create collections and indexes, including the unique email index.

```bash
npm run dev
```

Open http://localhost:3000. `/` redirects to `/dashboard`; the server redirects unauthenticated visitors to `/login`. Create an account at `/register`. Registration signs you in automatically. The board supports task creation, details/editing, search, status changes and confirmed deletion. Layout adapts to mobile screens. The existing `GET /api/health` remains independent of MongoDB and returns status, service and an ISO timestamp.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Vitest covers validation, bcrypt/JWT helpers, cookie flags, database connection caching/retries, authentication routes and task handlers, including unauthorized access and owner-filtered reads/updates/deletes. Route tests invoke the native Web Request/Response handlers directly; an Express/Supertest adapter is unnecessary for these Next.js handlers. Model and request-context dependencies are mocked in unit/route tests.

The live MongoDB integration test is opt-in and is skipped when `MONGODB_TEST_URI` is absent. Supply a dedicated database whose name ends in `_test`:

```bash
MONGODB_TEST_URI='mongodb://127.0.0.1:27017/taskflow_test' npm test
```

This test creates two users, persists tasks, checks unique-email enforcement and cross-user isolation, updates/deletes the task, and removes only records created by that run. Do not use a production database. It does not load `.env.local`; the test variable must be exported or passed explicitly.

Manual acceptance flow with MongoDB configured: register two accounts, create and edit a task, move it through all three statuses, reload and confirm persistence, confirm the other account has a separate board, delete the task, log out, and confirm `/dashboard` and `/api/tasks` require authentication. Also check mobile width, invalid form input and incorrect passwords.

## API contract

Successful responses use `{ user }`, `{ task }`, `{ tasks }`, or `{ message }`. Task objects expose `id`, `title`, `description`, `status`, `createdAt`, and `updatedAt`. User objects expose only `id`, `name`, and `email`. Errors use `{ "error": { "message": "...", "details": [...] } }`; validation details are optional. New APIs send `Cache-Control: no-store` and an `X-Request-Id` for support/log correlation.

| Endpoint | Behavior |
| --- | --- |
| `POST /api/auth/register` | `{ name, email, password }`; creates account and session (201); duplicate email (409) |
| `POST /api/auth/login` | `{ email, password }`; creates session (200); invalid credentials (401) |
| `POST /api/auth/logout` | Clears session cookie (200) |
| `GET /api/auth/me` | Current public user (200), or 401 |
| `GET /api/tasks` | Current user's tasks, newest first |
| `POST /api/tasks` | `{ title, description?, status? }`; creates task (201) |
| `GET /api/tasks/[id]` | An owned task (200) |
| `PATCH /api/tasks/[id]` | Nonempty subset of `{ title, description, status }` |
| `DELETE /api/tasks/[id]` | Deletes an owned task (200) |

All task endpoints require a valid session and an existing user. IDs must be 24 hexadecimal characters; absent and other users' tasks both return 404. Client-supplied owners and unknown JSON fields are rejected. Status values are `todo`, `in_progress`, and `done`. Passwords require at least eight characters and at most 72 UTF-8 bytes, preventing bcrypt truncation.

## Implementation notes

- MongoDB connects lazily at request time and shares concurrent connection attempts. No connection is opened during import or build. Default Node.js runtime is used; no incompatible `dynamic` or segment runtime config is added with Cache Components enabled.
- Dashboard session reads sit inside a Suspense boundary, as required by Cache Components. Authorization also runs in every protected API handler.
- Sessions are signed HS256 JWTs with issuer/audience verification and a 24-hour expiration. Cookies are HttpOnly, SameSite=Lax, path `/`, and Secure in production (serve production over HTTPS). Logout deletes the browser cookie; an already copied JWT remains usable until expiry. Immediate revocation would require a server-side session store.
- Passwords use bcrypt cost 12. Emails are normalized and protected by a unique database index. Mongoose excludes hashes by default, and APIs explicitly serialize safe response fields.
- JSON mutations reject mismatched Origin headers. Pino outputs JSON to stdout and logs request IDs/status codes without raw request bodies, JWTs, passwords, connection URIs, or driver errors.
- System fonts avoid build-time Google Fonts downloads. Turbopack's root is scoped to this repository so an unrelated parent lockfile does not define it.
- Internet-facing deployment should add shared authentication rate limiting at the application gateway or with an appropriate shared store. This implementation does not provide a distributed login throttle.

## Standalone build

`next.config.ts` sets `output: "standalone"`. A production build does not need database credentials. The deployment team can package the generated server with its static assets:

```bash
npm run build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
node .next/standalone/server.js
```

Supply the environment variables at runtime. Production authentication requires HTTPS because its session cookie is Secure. Docker, proxy configuration, CI/CD and backups remain the DevOps team's responsibility; no infrastructure is included here.

## Project Manager review

Show registration/login, creating a task, editing its details, all three board statuses, persistence after refresh, a second account's isolated board, deletion, and logout. Show the test output and standalone build, and explain why every database query is scoped to the authenticated user.

Suggested milestone commits (review and commit on the feature branch; do not push to main):

- `feat: add MongoDB models and secure cookie authentication`
- `feat: implement owner-scoped task APIs and responsive dashboard`
- `test: cover authentication, task authorization and database lifecycle`
- `docs: document local setup and standalone handoff`

Do not commit `.env.local`, push, or merge without explicit approval.

## Dependency audit

The inspection on 2026-11-09 reported eight moderate findings in the development ESLint/typescript-eslint chain, originating in transitive `minimatch`. npm's suggested automatic fix would downgrade `eslint-config-next` to a different major version. No forced fix, framework downgrade or unrelated dependency change was applied. Revisit compatible updates with the team.
