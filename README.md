# Smart Project Tracker (Smart PM)

A full-stack, role-based **project & task management** platform built to the
*Smart Project Task PRD*. It supports Admin / Project Manager / Team Member
roles, real-time notifications, file attachments, dashboards with live charts,
and a clean dark/light UI.

> **Stack:** React + Vite + Tailwind + Recharts • NestJS 10 • MongoDB (Atlas or local) • JWT auth • Docker Compose

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick Start (Docker — recommended)](#quick-start-docker--recommended)
5. [Manual Setup (without Docker)](#manual-setup-without-docker)
6. [Environment Variables](#environment-variables)
7. [Database Seeding & Demo Credentials](#database-seeding--demo-credentials)
8. [Project Structure](#project-structure)
9. [API Overview](#api-overview)
10. [Available Scripts](#available-scripts)
11. [Common Tasks](#common-tasks)
12. [Troubleshooting](#troubleshooting)
13. [Production Notes](#production-notes)

---

## Features

### Core (per PRD)
- **Authentication** — email/password + JWT, demo-login button, role decoded from token
- **RBAC** — Admin / Project Manager / Team Member with strict per-route enforcement
- **Projects** — CRUD with unique names, future-deadline validation, cascade delete
- **Tasks** — CRUD with unique titles per project, priority, status, due-date validation
- **Comments** — member-only, author-only edit, admin-or-author delete
- **File Attachments** — upload, list, download, remove (multipart, served as static)
- **Notifications** — bell with unread badge: task assigned, status changed, new comment, due-soon
- **Activity Log** — every project/task/member event tracked, paginated full view
- **Dashboard** — KPI cards, status donut, priority bar, completion-trend line, productivity, deadlines, workload
- **Search / Filter / Sort / Paginate** — across projects and tasks (incl. admin-only "Created by" filter)
- **Dark / Light mode** — persisted in local storage

### Quality of life
- Theme-aware Recharts tooltips
- Toast notifications (success/error)
- Server-side pagination & filtering
- Full TypeScript on both ends

> **Note:** the seed script only creates the four demo **user accounts**. The
> first time you log in, the dashboard, projects, and tasks will be empty —
> create them through the UI to see activity logging, notifications, and
> charts come alive.

---

## Architecture

```
┌─────────────────────┐    HTTP/JSON    ┌──────────────────────┐    Mongoose    ┌──────────────┐
│  React (Vite)       │ ──────────────► │  NestJS 10 (REST)    │ ─────────────► │   MongoDB    │
│  Tailwind + Recharts│                 │  JWT + RBAC guards   │                │  (Atlas/local)│
│  Zustand + RQ       │ ◄────────────── │  Mongoose schemas    │ ◄───────────── │              │
└─────────────────────┘   port 3000      └──────────────────────┘   port 3001    └──────────────┘
                                                  │
                                                  └─► /uploads (static files)
```

The Docker Compose file ships two services (`backend`, `frontend`) on a shared
network. The database is **not** containerised by default — point `MONGO_URI`
at MongoDB Atlas or your own running Mongo instance.

---

## Prerequisites

| Tool                | Version                            | Why                                     |
| ------------------- | ---------------------------------- | --------------------------------------- |
| **Docker Desktop**  | 24+ (with Compose v2)              | Recommended path                        |
| **Node.js**         | 20.x LTS                           | Manual / non-Docker setup               |
| **npm**             | 10+                                | Bundled with Node                       |
| **Git**             | any                                | Clone the repo                          |
| **MongoDB**         | Atlas free cluster *or* local 6.x+ | Database (compose file does not bundle) |

A free **MongoDB Atlas** cluster takes 2 minutes to set up and is the fastest
path: <https://www.mongodb.com/cloud/atlas/register>.

---

## Quick Start (Docker — recommended)

### 1. Clone

```bash
git clone https://github.com/<your-username>/smart-project-tracker.git
cd smart-project-tracker/smart-pm
```

### 2. Create `.env`

```bash
cp .env.example .env
```

Open `.env` and set **`MONGO_URI`** to your Atlas SRV string (or local Mongo).
Example for Atlas:

```
MONGO_URI=mongodb+srv://myuser:mypass@cluster0.abcde.mongodb.net/smartpm?retryWrites=true&w=majority
```

### 3. Start the stack

```bash
docker compose up --build
```

First boot installs npm dependencies inside both containers (~2–4 min). After
that, hot-reload kicks in for both backend and frontend.

You should see logs like:

```
smart-pm-backend   |  Nest application successfully started on port 3001
smart-pm-frontend  |  VITE v5  ready in 850 ms — Local: http://localhost:3000
```

### 4. Seed demo users (one-time)

In a **second terminal**:

```bash
docker exec smart-pm-backend npm run seed
```

This only creates the four demo **user accounts** so you can log in. Projects,
tasks, and activity logs are intentionally left empty — you create those
through the app to exercise the real flows. Output:

```
✅ Connected to MongoDB
🗑️  Cleared users, projects, tasks, activities, notifications
👤 Users seeded

🎉 Seed complete! Demo credentials:
   Admin   → admin@smartpm.dev  / admin123
   PM      → pm@smartpm.dev     / pm123456
   Member  → john@smartpm.dev   / member123
   Member  → jane@smartpm.dev   / member123
```

### 5. Open the app

| URL                                        | What it is                       |
| ------------------------------------------ | -------------------------------- |
| <http://localhost:3000>                    | Frontend (React)                 |
| <http://localhost:3001/api/health>         | Backend health check             |
| <http://localhost:3001/api>                | REST API base                    |

The login page has a **Demo Login** button pre-filled with admin credentials.

---

## Manual Setup (without Docker)

If you prefer running each side natively:

### Backend

```bash
cd backend
cp ../.env ./.env          # or create your own .env in backend/
npm install
npm run seed               # one-time
npm run start:dev          # http://localhost:3001
```

### Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev                # http://localhost:3000
```

Make sure `MONGO_URI` is reachable from the backend host (Atlas ✓, or
`mongodb://localhost:27017/smartpm` if you have Mongo installed locally).

---

## Environment Variables

All variables are documented in [`.env.example`](.env.example). Summary:

| Variable          | Required | Default                    | Used by                    |
| ----------------- | :------: | -------------------------- | -------------------------- |
| `MONGO_URI`       |    ✅    | —                          | Backend (Mongoose)         |
| `MONGO_DB`        |          | `smartpm`                  | Documentation only         |
| `JWT_SECRET`      |    ✅    | dev fallback               | Backend (auth)             |
| `JWT_EXPIRES_IN`  |          | `7d`                       | Backend (auth)             |
| `PORT`            |          | `3001`                     | Backend                    |
| `NODE_ENV`        |          | `development`              | Backend                    |
| `FRONTEND_URL`    |          | `http://localhost:3000`    | Backend (CORS)             |
| `VITE_API_URL`    |    ✅    | `http://localhost:3001/api`| Frontend (axios base URL)  |
| `VITE_APP_NAME`   |          | `SmartPM`                  | Frontend (branding)        |

> **Important:** in production set a long random `JWT_SECRET` and never reuse the dev value.

---

## Database Seeding & Demo Credentials

`backend/src/database/seed.ts` seeds **only the four demo user accounts** so
evaluators can log in immediately. Projects, tasks, and activity logs are
**intentionally not seeded** — you create them through the app, which exercises
the real CRUD flows, validations, and activity logging.

For consistency, the script also wipes `projects`, `tasks`, `activities`, and
`notifications` collections so they never reference user IDs that have been
re-generated.

After seeding, log in with any of:

| Role                | Email                  | Password    |
| ------------------- | ---------------------- | ----------- |
| **Admin**           | `admin@smartpm.dev`    | `admin123`  |
| **Project Manager** | `pm@smartpm.dev`       | `pm123456`  |
| **Member**          | `john@smartpm.dev`     | `member123` |
| **Member**          | `jane@smartpm.dev`     | `member123` |

The login screen has a **Quick demo access** panel that fills these credentials
with one click.

Re-run any time to reset the database to a clean state (4 demo users only):

```bash
# Docker
docker exec smart-pm-backend npm run seed

# Manual
cd backend && npm run seed
```

### First-run walkthrough

After seeding, log in as **Admin** or **Project Manager** and:

1. Create a **project**, set a deadline, add members.
2. Inside the project, create a few **tasks** with different priorities/statuses.
3. As a **Member** (e.g. `john@smartpm.dev`), open the assigned tasks and update
   their status to see notifications and activity log entries appear in real time.
4. Visit the **Dashboard** — KPI cards, charts, the project-progress trend, and
   recent activity all populate from the data you just created.

---

## Project Structure

```
smart-pm/
├── backend/                       # NestJS API
│   ├── src/
│   │   ├── auth/                  # JWT, login, register
│   │   ├── users/                 # user CRUD, role management
│   │   ├── projects/              # project CRUD, member mgmt, cascade delete
│   │   ├── tasks/                 # task CRUD, comments, attachments
│   │   ├── notifications/         # bell notifications + due-soon sync
│   │   ├── activity/              # activity log (per-project & dashboard recent)
│   │   ├── dashboard/             # KPIs, charts, summaries (role-scoped)
│   │   ├── database/seed.ts       # demo data seeder
│   │   ├── health.controller.ts   # /api/health
│   │   ├── app.module.ts
│   │   └── main.ts                # bootstrap, global pipes, /uploads static
│   ├── uploads/                   # served at GET /uploads/<filename>
│   └── package.json
│
├── frontend/                      # React + Vite SPA
│   ├── src/
│   │   ├── pages/                 # Dashboard, Projects, Tasks, TaskDetail, Login, Activity, Members
│   │   ├── components/
│   │   │   ├── layout/            # Header (incl. NotificationBell), Sidebar, PageHeader
│   │   │   └── ui/                # Card, Modal, Button, etc.
│   │   ├── services/api.ts        # axios + endpoint helpers
│   │   ├── store/                 # Zustand stores (auth, theme)
│   │   └── types/                 # shared TS types
│   └── package.json
│
├── docker-compose.yml             # backend + frontend (Mongo external)
├── .env.example                   # template — copy to .env
└── package.json                   # workspace scripts (dev / down / logs)
```

---

## API Overview

Base URL: `http://localhost:3001/api`. All endpoints (except `/auth/login`,
`/auth/register`, `/health`) require `Authorization: Bearer <token>`.

| Group              | Method      | Path                               | Notes                                         |
| ------------------ | ----------- | ---------------------------------- | --------------------------------------------- |
| **Health**         | GET         | `/health`                          | liveness probe                                |
| **Auth**           | POST        | `/auth/register`                   |                                               |
|                    | POST        | `/auth/login`                      | returns `{ user, token }`                     |
|                    | GET         | `/auth/me`                         | current user                                  |
| **Users** (admin)  | GET / PATCH | `/users`, `/users/:id`             | list / update / role / disable                |
|                    | PATCH       | `/users/:id/role`                  | admin-only                                    |
| **Projects**       | GET / POST  | `/projects`                        | scoped by role                                |
|                    | GET         | `/projects/stats`                  | counts per status                             |
|                    | PATCH/DEL   | `/projects/:id`                    | PM only on own; cascade delete                |
|                    | POST/DEL    | `/projects/:id/members/:memberId`  | add / remove member                           |
| **Tasks**          | GET / POST  | `/tasks`                           | filters: project, status, priority, assignee, createdBy (admin) |
|                    | GET         | `/tasks/stats`                     | dashboard counts                              |
|                    | PATCH/DEL   | `/tasks/:id`                       | PM only on own projects                       |
|                    | POST/PATCH/DEL | `/tasks/:id/comments[...]`     | member-only access                            |
|                    | POST        | `/tasks/:id/attachments`           | multipart `file=@...`                         |
|                    | DELETE      | `/tasks/:id/attachments/:idx`      |                                               |
| **Notifications**  | GET         | `/notifications`                   | latest list (syncs due-soon first)            |
|                    | GET         | `/notifications/unread-count`      | badge counter                                 |
|                    | PATCH       | `/notifications/:id/read`          |                                               |
|                    | PATCH       | `/notifications/read-all`          |                                               |
|                    | DELETE      | `/notifications`                   | clear all                                     |
| **Activity**       | GET         | `/activity`                        | paginated; admin all, PM own projects         |
|                    | GET         | `/activity/recent`                 | dashboard widget                              |
| **Dashboard**      | GET         | `/dashboard`                       | role-scoped KPIs + charts                     |
| **Static uploads** | GET         | `/uploads/<filename>`              | served outside `/api` prefix                  |

> A Swagger explorer can easily be enabled via `@nestjs/swagger` (already a
> dependency) by uncommenting a few lines in `main.ts`.

---

## Available Scripts

From the **repo root** (works once Docker is running):

```bash
npm run dev            # docker compose up --build
npm run dev:detach     # docker compose up --build -d
npm run down           # stop containers
npm run down:volumes   # stop + remove volumes
npm run logs           # tail combined logs
npm run logs:backend   # tail backend only
npm run logs:frontend  # tail frontend only
```

Inside `backend/`:

```bash
npm run start:dev      # nest start --watch
npm run build          # compile to dist/
npm run lint           # eslint --fix
npm run test           # jest unit tests
npm run seed           # repopulate demo data
```

Inside `frontend/`:

```bash
npm run dev            # vite dev server
npm run build          # tsc + vite build
npm run preview        # preview built site
npm run lint           # eslint
```

---

## Common Tasks

### View logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

### Restart only one service after code changes

Hot-reload usually handles it, but if you change `package.json`:

```bash
docker compose restart backend
# or rebuild fully:
docker compose up --build backend
```

### Reset the database

```bash
docker exec smart-pm-backend npm run seed
# Wipes users, projects, tasks, activities, notifications.
# Re-creates only the four demo user accounts.
```

### Open a Mongo shell against Atlas

```bash
docker run --rm -it mongo:7 mongosh "$MONGO_URI"
```

### Generate a new JWT secret

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Troubleshooting

| Symptom                                                              | Likely cause / fix                                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Backend exits with `MongoServerError: bad auth`                      | Wrong `MONGO_URI`. Verify user/password and IP allowlist in Atlas (use `0.0.0.0/0` for local dev).                       |
| Frontend stuck on white page, console shows `ERR_CONNECTION_REFUSED` | Backend not up yet. Check `docker compose logs -f backend` for crashes.                                                   |
| `Invalid credentials` on demo login                                  | You haven't seeded yet — run `docker exec smart-pm-backend npm run seed`.                                                |
| Port 3000/3001 already in use                                        | Stop the conflicting process, or change the host port in `docker-compose.yml`.                                            |
| Tasks `Bad Request: priority must be one of ...`                     | Status/priority values are case-sensitive: use `Todo / In Progress / Completed` and `High / Medium / Low`.                |
| Attachment upload fails on Windows Git Bash with `Failed to open`    | Use a relative path (`cd /tmp && curl -F "file=@test.txt" ...`) — Git Bash doesn't translate `/tmp/...` for `@` paths.    |
| `403 Forbidden` when a PM edits a task                               | The PM is not the owner of that project. Per PRD, PMs only have CRUD on tasks in projects they own.                       |

---

## Production Notes

When deploying:

1. Build production images:
   ```bash
   # in backend/Dockerfile and frontend/Dockerfile, target: production
   docker compose -f docker-compose.yml --profile prod up --build
   ```
2. Set a **strong `JWT_SECRET`**.
3. Restrict Atlas IP allowlist to your server's IP.
4. Serve the frontend through a CDN or reverse proxy (Nginx/Caddy) and put HTTPS in front.
5. Mount a persistent volume for `backend/uploads` (or move to S3-compatible storage).
6. Configure CORS — backend currently uses `FRONTEND_URL` for the allowed origin.
7. Disable Mongo Express (none is shipped, just don't expose it).
8. Run `npm audit` periodically and bump pinned versions.

---

## License

MIT — see headers in `package.json`.

## Acknowledgements

Built against the *Smart Project Task PRD*. Charts by [Recharts](https://recharts.org/), icons by [Lucide](https://lucide.dev/), state by [Zustand](https://github.com/pmndrs/zustand) and [TanStack Query](https://tanstack.com/query).
