# Task Management Backend

Production-ready REST API for an Internal Support & Maintenance Task Management System.

## Bug Fixes (latest changes)

- **`NODE_ENV` now pinned to `production` for the `app` and `email-worker` containers** in `docker-compose.yml`. Previously `env_file: .env` (with `.env.example`'s default of `NODE_ENV=development`) silently overrode the Dockerfile's `ENV NODE_ENV=production`, which meant error responses leaked full stack traces and the auth cookie never got the `Secure` flag — even in the "production" Docker deployment. `.env.example` now documents that this variable only matters for `npm run dev` outside Docker.
- **Fixed duplicate "task reassigned" notifications/emails on every task update.** `services/task.service.js`'s `update()` compared a plain string ID against an array of Mongoose `ObjectId` objects using `Array.includes()`, which always evaluated to "not found" — so every developer already on a task, not just newly-added ones, got re-notified and re-emailed on every edit. Fixed by capturing the pre-update assignee list before it's overwritten and normalizing both sides to strings before comparing.
- **Fixed a null-pointer risk in `PUT /api/profile/change-password`.** It fetched the user and called `.matchPassword()` with no null-check; if the account had been deleted mid-session this threw a raw `TypeError`. It now reuses `services/auth.service.js`'s `changePassword` (which already guards this), removing duplicated logic in the process.
- **Fixed task attachment responses leaking the server's absolute filesystem path** (e.g. `/usr/src/app/uploads/tasks/xxx.png`) instead of a client-usable URL. `POST /api/tasks/:id/attachments` now stores `/uploads/tasks/<filename>`, matching what both `app.js`'s static file server and the Nginx `/uploads/` location actually serve.
- **Added an existence check for `assignedTo`** in `services/task.service.js`'s `assign()` — the route validator only checked that the ID *looked* like a valid Mongo ObjectId, not that a user with that ID actually existed, which could silently create orphaned notifications.
- **Removed dead code:** a leftover `debugger` statement in `loginController`, an unused/never-routed `paymentController` (a stray copy-paste of `getMeController`), and a no-op `logout()` export from `auth.service.js` that was never called.

## Architecture

```text
                         Client
                            │
                            ▼
                    ┌───────────────┐
                    │     Nginx       │  :80 (only public entrypoint)
                    │ load balancer   │
                    └───────┬───────┘
                            │  dynamically resolves "app" via Docker DNS,
                            │  round-robins across every running replica
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  app #1    │  │  app #2    │  │  app #N    │   ← scale with
        │ (Express)  │  │ (Express)  │  │ (Express)  │     --scale app=N
        └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
              │                │                │
     ┌────────┼────────┬───────┴────────┬───────┘
     ▼        ▼         ▼                ▼
┌──────────┐ ┌──────────┐         ┌────────────┐
│  MongoDB   │ │  Redis     │         │  RabbitMQ    │  (email_notifications queue)
└──────────┘ │  cache     │         └──────┬─────┘
              └──────────┘                 │ consumed by
                                     ┌──────▼──────┐
                                     │ email-worker  │  (separate container,
                                     │ (nodemailer)  │   scales independently)
                                     └──────┬──────┘
                                            ▼
                                     ┌──────────────┐
                                     │ SMTP / MailHog │
                                     └──────────────┘
```

**Why email goes through a queue instead of being sent inline:** creating a user
or assigning a task used to be a single synchronous flow. If sending were done
inline, a slow or down SMTP server would make those requests hang or fail.
Now the API just publishes a small JSON job to RabbitMQ and returns — a
separate `email-worker` process does the actual sending, retrying up to 3
times per job before giving up, without ever blocking the API.

**Why Redis sits in front of MongoDB for some reads:** `dashboard.service.js`,
`task.service.js` (single-task reads), and `user.service.js` (`getByRole`
lists) go through `cache/index.js` — a small cache-aside helper — before
hitting MongoDB. Every read there checks Redis first, and every write that
would make a cached entry stale explicitly deletes it (`cache.del` /
`cache.delByPattern`), rather than relying on TTL alone wherever correctness
matters. The one exception is the dashboard, which uses a short 30s TTL
instead of write-time invalidation — deliberately, since a single task write
can affect several different users' cached dashboards at once, and
30 seconds of staleness on a summary view isn't worth precisely tracking
all of them. **A Redis outage never breaks a request**: `cache/index.js`
catches every Redis error and treats it the same as a cache miss (falls
through to MongoDB), so caching is purely a performance layer, never a new
point of failure.

**Why the app is scaled instead of run as a single instance:** the `app`
service in `docker-compose.yml` has no fixed container name and isn't
published directly to the host — only Nginx is public. Nginx re-resolves the
`app` hostname on every request via Docker's embedded DNS, so when you scale
up, new replicas start receiving traffic automatically with no nginx reload
and no manual upstream list to maintain. Since all replicas share the same
Redis and MongoDB, cached data and invalidations are consistent across every
replica — there's no per-instance cache to fall out of sync.

**Why uploads live on a shared Docker volume:** file uploads (`multer`) write
to local disk. With multiple app replicas, a file uploaded to replica #1
wouldn't be visible from replica #2 unless they shared storage — so
`uploads-data` is a named volume mounted into every `app` replica (and served
directly by Nginx under `/uploads/`, bypassing Node entirely for static
files).

## Running with Docker Compose

```bash
cp .env.example .env
# edit .env if you want different credentials

docker compose up --build
```

This starts: Nginx, one `app` replica, `email-worker`, MongoDB, Redis,
RabbitMQ, and MailHog (a local SMTP catcher — no real emails are sent in dev).

- API: `http://localhost/api/...` (through Nginx)
- Health check: `http://localhost/health`
- RabbitMQ management UI: `http://localhost:15672` (guest/guest)
- MailHog UI (view "sent" emails): `http://localhost:8025`

### Scaling the app

```bash
docker compose up --build --scale app=3 -d
```

Nginx starts load-balancing across all 3 replicas within the `resolver`'s
10-second TTL — no other command needed. Scale back down the same way with
`--scale app=1`.

Scale the email worker independently if the queue backs up under load:

```bash
docker compose up --build --scale email-worker=2 -d
```

### Stopping

```bash
docker compose down          # stop containers
docker compose down -v       # also wipe Mongo/Redis/RabbitMQ/uploads volumes
```

## Running locally without Docker

### Prerequisites
- Node.js 18+
- A running MongoDB instance
- A running Redis instance
- A running RabbitMQ broker
- An SMTP server or MailHog for local testing

### Install & configure

```bash
npm install
cp .env.example .env
```

### Run

```bash
npm run dev       # API with nodemon
npm run worker:dev  # in a separate terminal — email worker with nodemon
```

## Environment Variables

See `.env.example` for the full list, including the newly added:

```text
RABBITMQ_URL=amqp://localhost:5672

REDIS_URL=redis://localhost:6379

SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=Task Management <no-reply@taskapp.local>
```

## Project Structure (additions)

```text
cache/
  index.js          # cache-aside helper (get/set/del/delByPattern) — every
                     # service caches through this, never redisClient directly
config/
  rabbitmq.js       # AMQP connection + channel, with startup retry
  redis.js          # Redis client + connection, with startup retry
  email.js          # nodemailer SMTP transporter
queues/
  email.queue.js    # publisher: services call publishEmailJob(job)
services/
  email.service.js  # email templates + send logic (used only by the worker)
workers/
  email.worker.js   # standalone consumer process — its own Docker container
docker/
  nginx/nginx.conf  # reverse proxy + dynamic load balancing config
Dockerfile
docker-compose.yml
.dockerignore
```

## Postman Collection

A ready-to-import Postman collection covering every endpoint (Auth, Users,
Tasks, Dashboard, Profile/Notifications, plus the health check) is in
`postman/`:

- `Task-Management-Backend.postman_collection.json`
- `Task-Management-Local.postman_environment.json`

Import both, select the "Task Management - Local" environment, seed the
database (`npm run seed`), then run **Auth > Login** — its test script
auto-saves the JWT into `{{token}}`, and every other request is already set
up to send it as `Authorization: Bearer {{token}}`. Requests that create
resources (Create User, Create Task, Add Comment) also auto-save the
returned `_id` into collection variables so the rest of the requests can
chain off them without manual copy-pasting. Full setup instructions are in
the collection's own description (visible in Postman after import).

## Redis Caching Strategy

| Cached data | Key shape | TTL | Invalidation |
|---|---|---|---|
| Dashboard summary | `dashboard:<userId>:<role>` | 30s | TTL only (see rationale above) |
| Single task | `task:<id>` | 5 min | Deleted on update/status-change/assign/delete |
| Users by role | `users:byRole:<role>` | 10 min | Deleted (pattern) on any user create/update/delete/status-change |

## API Endpoints

Unchanged from the existing routes (`/api/auth`, `/api/users`, `/api/tasks`,
`/api/dashboard`, `/api/profile`) — no new endpoints were added. The changes
in this update are additive at the service layer (task assignment and user
creation now also queue an email; dashboard/task/role-list reads now go
through Redis first) and at the infrastructure layer (Docker, Nginx,
RabbitMQ, Redis, scaling).
