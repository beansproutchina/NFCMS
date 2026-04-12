# NFCMS

[中文版](README.zh-CN.md)

NFCMS is a dynamic, plugin-friendly, headless CMS built on top of DYAPI, with a decoupled Vue 3 frontend for both public pages and admin operations.

It is designed for teams that want to ship content products quickly while keeping architecture flexible: schema-driven models, dynamic CRUD APIs, template-based rendering, and Docker-first delivery.

## Highlights

- Dynamic model injection at runtime from schema definitions.
- Headless content APIs plus an integrated admin panel.
- First-run setup wizard (`/setup`) to bootstrap site config and super admin.
- Role-aware access (`PUBLIC`, `admin`, `super_admin`) and JWT-based login.
- Markdown-first article workflow.
- Category and article template override system.
- File upload and attachment management.
- Frontend theme swap during Docker build (`pear` / `school` by default).
- Hook/event system for extension points (actions + filters).

## Why NFCMS

- Build fast: startup with built-in article/category/menu/user modules.
- Extend safely: register new content models via schema records instead of rewriting core.
- Stay decoupled: frontend consumes APIs and can evolve independently.
- Ship consistently: same stack works in local dev and Docker deployment.

## Architecture

- Backend: Bun + DYAPI + SQLite (file-based DB)
- Frontend: Vue 3 + TypeScript + Vite + PrimeVue + Tailwind CSS
- Storage:
  - Database: `backend/data/test.db`
  - Uploaded files: `backend/static/uploads`

## Monorepo Layout

```text
backend/           DYAPI-based API server and dynamic model engine
frontend/          Vue 3 app (public site + admin + setup flow)
frontend_themes/   Theme templates injected at frontend build time
bin/               Docker helper scripts (start/stop/rebuild/info)
docker-compose.yml Production-style compose setup
```

## Tech Stack

- Runtime/API framework: Bun + DYAPI
- Frontend: Vue 3 + TypeScript + Vite
- UI: PrimeVue + Tailwind CSS
- Data storage: SQLite (`backend/data/test.db`)
- Static files: local filesystem (`backend/static/uploads`)

## Prerequisites

For local development:

- Bun >= 1.2
- Node.js >= 20 (for frontend toolchain)
- npm >= 9

For containerized usage:

- Docker + Docker Compose

## Quick Start (Docker)

From repository root:

```bash
docker compose up -d --build
```

Then open:

- Frontend: `http://localhost`
- API: `http://localhost/api`
- Backend direct: `http://localhost:3000`

Alternative helper scripts:

```bash
./bin/start
./bin/stop
./bin/rebuild
./bin/info
```

### Switch Frontend Theme

`docker-compose.yml` builds frontend with `THEME=pear` by default.

To use another theme (for example `school`):

1. Change the `THEME` build arg in `docker-compose.yml`, then rebuild.
2. Or rebuild frontend image manually with `--build-arg THEME=school`.

### Single Image Deployment (Ship to Server)

If you want to ship everything as one image (frontend + backend), use:

```bash
docker compose -f docker-compose.single.yml up -d --build
```

This runs one container and exposes:

- Frontend + API entry: `http://localhost:54380`

Build image manually:

```bash
docker build -f Dockerfile.single -t nfcms-allinone:latest --build-arg THEME=pear .
```

Export image and upload to server:

```bash
docker save nfcms-allinone:latest | gzip > nfcms-allinone.tar.gz
```

On the server:

```bash
docker load -i nfcms-allinone.tar.gz
docker run -d --name nfcms-allinone -p 80:80 \
  -v $(pwd)/backend-data:/app/backend/data \
  -v $(pwd)/backend-static:/app/backend/static \
  -v $(pwd)/upload:/app/backend/upload \
  --restart always \
  nfcms-allinone:latest
```

## Quick Start (Local Development)

### 1) Start backend

```bash
cd backend
npm install
bun --hot index.ts
```

Backend default URL: `http://localhost:3000`

### 2) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`

Vite is configured to proxy `/api` and `/static` to `http://localhost:3000`.

## First-Time Setup

1. Open `http://localhost:5173/setup` (or `http://localhost/setup` in Docker).
2. Enter site name, admin username, and admin password.
3. Submit setup to initialize:
   - `super_admin` account
   - default site config
   - default category
   - welcome article
   - default menu
4. Log in at `/login` and enter admin area at `/admin`.

Default flow guard in frontend router:

- If system is not initialized, all routes redirect to `/setup`.
- After setup is complete, visiting `/setup` redirects to `/`.

## Usage Guide

### Content Management

- Articles: create/edit Markdown content, visibility, slug, publish time.
- Categories: hierarchical taxonomy, list/detail template binding.
- Menus: nested menu items for frontend navigation.
- Files: upload and manage attachments.

### Dynamic Schemas and CRUD

- Use the admin schema tools to create new content schemas.
- NFCMS reads schema records and injects model classes at runtime.
- Each dynamic model is exposed through CRUD routes (based on route/table config).
- Admin dynamic CRUD view: `/admin/crud/:modelName`

### Frontend Template Resolution

- Home page template is controlled by system config (`home_template`).
- Category page template priority:
  - category `list_template` (if empty, list view is disabled)
- Article page template priority:
  - article `content_template` > category `content_template` > `DefaultArticle`

Templates receive a unified `context` object (`config`, `menus`, `user`, `api`, and page-specific data).

## API Overview

Representative endpoints:

- Auth:
  - `POST /api/user/login`
- System:
  - `GET /api/system/status`
  - `GET /api/system/config`
  - `POST /api/system/config`
  - `POST /api/system/setup`
- Front content:
  - `GET /api/content/category?slug=...`
  - `GET /api/content/article?slug=...`
- Upload:
  - `POST /api/upload`
  - `DELETE /api/upload/:id`
- Schema tools:
  - `GET /api/schematools/all` (`super_admin`)

Built-in CRUD models are exposed via standard DYAPI routes such as:

- `/api/articles`
- `/api/categories`
- `/api/menus`
- `/api/users`
- `/api/attachments`
- `/api/schemas`

## Development Notes

Run backend and frontend in separate terminals:

```bash
# terminal 1
cd backend
npm install
bun --hot index.ts

# terminal 2
cd frontend
npm install
npm run dev
```

Important paths:

- Dynamic model injection: `backend/app/services/ModelInjector.ts`
- Hook manager: `backend/app/services/HookManager.ts`
- Frontend route guards + data prefetch: `frontend/src/router/index.ts`
- Front templates: `frontend/src/views/front/templates`
- Theme source presets: `frontend_themes/`

## Permissions Model

- `PUBLIC`: read-only access for public content where enabled.
- `admin`: content operation permissions for selected modules.
- `super_admin`: full management (users, schemas, system settings, restart).

## Notes for Contributors

- Dynamic model engine lives in `backend/app/services/ModelInjector.ts`.
- Hook system lives in `backend/app/services/HookManager.ts`.
- Frontend route data prefetching is centralized in `frontend/src/router/index.ts`.
- Theme templates are under `frontend/src/views/front/templates` and can be replaced from `frontend_themes/<theme>` during Docker build.

Suggested contribution workflow:

1. Fork and create a feature branch.
2. Keep changes scoped (backend, frontend, or theme).
3. Test both setup flow and admin flow before opening PR.
4. Include migration notes if schema/data behavior changes.

## Current Status

NFCMS is functional and actively structured for extension, but still evolving.

Before production rollout, review and harden:

- auth strategy and password hashing policy,
- operational monitoring and backup process,
- security and permission boundaries for custom extensions.

## License

No license file is included yet.

If you plan to open source this repository, add a `LICENSE` file (for example MIT, Apache-2.0, or GPL-3.0) before publishing.