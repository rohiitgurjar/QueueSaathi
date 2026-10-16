# QueueSaathi — Smart Queue Management System

QueueSaathi is a beginner-friendly full-stack portfolio project for clinics and service centres that want patients to see a queue estimate before visiting. Patients can browse clinics, create a patient account, join one queue per clinic session, track/cancel tokens, and review history. Assigned staff can run their clinic queue. Administrators can manage clinics, categories, and staff assignments.

> **Demo data is intentionally synthetic.** Seeded clinics and sample queue tokens are labelled in the UI. Estimates are calculations, not live measurements. The project is a learning/demo application—not a production healthcare system.

## Features

### Public directory
- Search clinics by name, category, description, or address.
- Filter by category and sort by estimated wait or name.
- Clinic details, opening hours, average service duration, and current queue summary.
- Clear loading, empty, and API error states.

### Patient
- Public registration creates **patient accounts only**; role input is rejected.
- Cookie-authenticated login/logout.
- Join a clinic’s current daily session, see token number, status, position, and estimated wait.
- Cancel a waiting token and view recent token history.

### Staff
- Staff dashboard shows only assigned clinics.
- View waiting/called/served/skipped/cancelled tokens and basic counts.
- Call the next eligible waiting token, mark a called token served, skip with a reason, or staff-cancel with a reason.

### Administrator
- Create/edit/deactivate/reactivate clinics (deactivation preserves token history).
- Create/manage categories.
- Create staff accounts, assign active clinics, and deactivate staff.
- View platform and daily queue counts.

## Technology

- **Frontend:** React 19, Vite 8, JavaScript, React Router 7, regular CSS.
- **Backend:** Node.js 20.19+, Express 5, Mongoose 9, Zod validation.
- **Security:** bcryptjs password hashing, JWT in an HttpOnly cookie, double-submit CSRF protection, role/clinic authorization, Helmet, exact-origin credentialed CORS, login/registration rate limits.
- **Tests:** Vitest, React Testing Library, Supertest, and MongoDB Memory Server for isolated backend integration tests.
- **Deployment:** Standard Node.js web service; no Docker is required.
- **Database:** MongoDB (local or managed). No Redis, WebSockets, or third-party UI library.

## Architecture

```text
┌──────────────────────────────────┐
│ Browser: React + React Router    │
│ directory / patient / staff /    │
│ admin                            │
└────────────────┬─────────────────┘
                 │ HTML/assets + JSON API over HTTPS
┌────────────────▼─────────────────┐
│ Express app                       │
│ serves React + REST API           │
│ routes → validation/auth →        │
│ controllers → queue/services      │
└────────────────┬─────────────────┘
                 │ Mongoose
┌────────────────▼─────────────────┐
│ MongoDB                           │
│ unique indexes + atomic updates   │
└──────────────────────────────────┘
```

### Request flow

A screen calls `frontend/src/services/api.js`. It sends JSON to the API and includes browser cookies. For a state-changing request, the client first obtains a CSRF token and sends it as `X-CSRF-Token`. Express applies CORS/security middleware, validates the request with Zod, verifies the user and role, and checks clinic assignment where relevant. A controller delegates queue rules to a service; Mongoose reads or updates MongoDB. The API returns `{ "data": ... }` on success or a consistent `{ "error": { "code", "message" } }` body on failure. React displays the returned data or a useful error.

In local hot-reload development Vite proxies `/api` to `http://127.0.0.1:4000`. For deployment, Express serves the built site and API on one origin. A split deployment can set `VITE_API_URL` to the API base.

## Project structure

```text
QueueSaathi/
  frontend/
    src/
      components/       reusable navigation, cards, alerts, status/loading UI
      context/          cookie-backed authentication state
      pages/            directory, details, patient, staff, admin, auth
      services/         fetch API client and CSRF handling
      styles/           minimal responsive CSS
      test/             Testing Library setup
    vitest.config.js
  backend/
    src/
      config/           environment and Mongo connection/index creation
      controllers/      HTTP request/response handling
      middleware/       auth, role/CSRF checks, validation, errors
      models/           User, Clinic, ClinicCategory, QueueSession, QueueToken
      routes/           REST routes
      services/         clinic, auth, and queue rules
      validators/       Zod schemas
    scripts/createAdmin.js
    scripts/seedDemo.js
    tests/api.test.js
  .env.example
  README.md
```

## Database overview

- **User:** name, normalized unique email, bcrypt password hash, role (`patient`, `staff`, `admin`), active flag, and staff clinic assignments. Password hash is excluded from normal queries and responses.
- **Clinic:** name, description, category reference, address, opening hours, average service duration, active flag, and a demo marker. Clinics are deactivated rather than hard-deleted so historical tokens keep their references.
- **ClinicCategory:** unique name/slug and active flag. A category in use cannot be deleted; deactivation is blocked while an active clinic uses it.
- **QueueSession:** clinic + UTC date key + last allocated token number. The unique `(clinic, sessionKey)` index gives one sequence counter per clinic/session.
- **QueueToken:** clinic, patient, session key, sequential number, status, timestamps, optional reason, and active flag. Indexes enforce unique numbers per session, one active token per patient/clinic/session, and at most one `CALLED` token per clinic/session.

## Queue correctness and estimate policy

- Queue sessions roll over at **00:00 UTC**. This is easy to explain but should become clinic-time-zone aware before use by real clinics.
- Token allocation increments the session counter with an atomic MongoDB `findOneAndUpdate($inc)` and a unique session index. Queue-token insertion has an additional unique `(clinic, sessionKey, tokenNumber)` index.
- Two joins can never commit the same token number. A failed insert after counter increment can leave a **gap** in numbering; numbers remain unique and gaps are acceptable.
- A partial unique index on `(clinic, sessionKey, patient)` where `isActive: true` prevents duplicate active tokens even when two requests race. Cancellation/serving/skipping flips `isActive` off in the same token-document update.
- Calling next updates the lowest `WAITING` token atomically. A partial unique index permits only one `CALLED` token per clinic session, preventing simultaneous staff requests from calling two patients. Invalid transitions are conditional updates and return `409`.
- MongoDB multi-document transactions are not used: each correctness-critical transition is a single-document atomic update, and token-number allocation is a separate atomic counter update. This keeps the first version straightforward and works on standalone MongoDB. The trade-off is that token-number gaps can occur if a process fails between increment and insert. Use a replica set and a transaction-based workflow only if future requirements need all-or-nothing multi-document operations.
- A skipped token becomes inactive, leaves the eligible line, retains status/reason in history, and is **not automatically requeued**. Staff can ask the patient to join again; the new token receives the next number.
- A waiting patient’s position is the count of earlier waiting tokens plus any currently called token, plus one. Estimated minutes are `peopleAhead × averageServiceDurationMinutes`. For a new join, the current called token and all waiting tokens are included. This is a simple estimate, not a real-time measurement.

## REST API contract

All endpoints use the `/api` prefix. JSON success responses are `{ "data": { ... }, "message"?: "..." }`. Errors use an appropriate HTTP status and `{ "error": { "code": "...", "message": "...", "details"?: [...] } }`. State-changing endpoints require the `qs_csrf` cookie and matching `X-CSRF-Token` header; the frontend API client handles this automatically.

| Method and path | Access | Purpose |
|---|---|---|
| `GET /api/health` | Public | API/database readiness |
| `GET /auth/csrf` | Public | Issue CSRF cookie/token |
| `POST /auth/register` | Public, rate-limited | Create patient account only |
| `POST /auth/login` | Public, rate-limited | Sign in; sets HttpOnly session cookie |
| `GET /auth/me` | Signed in | Current user and staff assignments |
| `POST /auth/logout` | Public CSRF check | Clear session cookies |
| `GET /clinics` | Public | Search/filter active clinics; admins can request `includeInactive=true` |
| `GET /clinics/:clinicId` | Public | Clinic details and queue estimate |
| `POST /clinics` | Admin | Create clinic |
| `PATCH /clinics/:clinicId` | Admin | Edit/activate/deactivate clinic |
| `DELETE /clinics/:clinicId` | Admin | Soft-deactivate clinic |
| `GET /clinics/categories` | Public | List active categories |
| `POST /clinics/categories` | Admin | Create category |
| `PATCH /clinics/categories/:categoryId` | Admin | Rename/activate/deactivate category |
| `DELETE /clinics/categories/:categoryId` | Admin | Delete unused category |
| `GET /clinics/:clinicId/queue/status` | Public | Sanitized queue status and estimate |
| `POST /clinics/:clinicId/queue` | Patient | Join current session |
| `GET /queue/my-active` | Patient | List active tokens |
| `GET /queue/my-history` | Patient | Recent token history |
| `GET /queue/:tokenId` | Owner, assigned staff, admin | Read token with authorization check |
| `POST /queue/:tokenId/cancel` | Owner or authorized staff/admin | Patient may cancel only `WAITING`; staff cancellation needs a reason |
| `GET /clinics/:clinicId/queue` | Assigned staff/admin | Today's full staff queue and statistics |
| `POST /clinics/:clinicId/queue/call-next` | Assigned staff/admin | Call the lowest waiting token |
| `POST /queue/:tokenId/serve` | Assigned staff/admin | Serve a `CALLED` token |
| `POST /queue/:tokenId/skip` | Assigned staff/admin | Skip a waiting/called token; requires `{ "reason": "..." }` |
| `GET /admin/stats` | Admin | Platform and current-session counts |
| `GET /admin/staff` | Admin | List staff assignments |
| `POST /admin/staff` | Admin | Create a staff account |
| `PATCH /admin/staff/:staffId/clinics` | Admin | Replace the staff member’s clinic assignments |
| `DELETE /admin/staff/:staffId` | Admin | Deactivate staff account |

Typical error statuses: `400` validation/input error, `401` missing/invalid session, `403` role/ownership/clinic access denied, `404` missing resource, `409` duplicate token or invalid state transition, `429` rate-limited, `500` unexpected server error.

## Local setup

### Requirements

- Node.js 20.19+ and npm.
- MongoDB 7+ running locally **or** a managed MongoDB URI. The app does not bundle a database server.

### 1. Configure backend

```bash
cd backend
cp ../.env.example .env
```

Edit `backend/.env`:

- Keep `MONGODB_URI=mongodb://127.0.0.1:27017/queuesaathi_demo` for local MongoDB, or set your managed URI.
- Set `JWT_SECRET` to a private random value of at least 32 characters. For example, generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` and paste the result locally.
- Set `DEMO_ADMIN_PASSWORD` and `DEMO_STAFF_PASSWORD` to private passwords of **12+ characters**. The seed script intentionally has no built-in credentials.
- Keep `COOKIE_SAME_SITE=lax`. The local Vite proxy uses the same browser origin, so CORS does not need to be enabled.

Install dependencies, seed sample records, then start the API:

```bash
npm install
npm run seed:demo
npm run dev
```

The seed prints the demo account emails (the passwords are the values you set in your local `.env`). It refuses to run in `NODE_ENV=production`, requires both privileged accounts to be explicitly configured, and will not convert an unrelated existing user into a privileged seed account. It creates synthetic clinics, queue tokens, and non-login sample patient records.

### 2. Start the frontend in another terminal

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`. Public browsing works without an account once the database is seeded. Use **Create account** to register a real patient test account; public registration cannot create staff/admin roles.

### Reset sample data

From `backend/`, resetting deletes only seeded demo clinics, their queue sessions/tokens, and seeded accounts/categories that are no longer referenced. It does not wipe the whole database. The explicit confirmation and production guard are intentional:

```bash
CONFIRM_RESET_DEMO_DATA=YES npm run seed:demo -- --reset
```

Then rerun `npm run seed:demo` as needed. In PowerShell, set `$env:CONFIRM_RESET_DEMO_DATA='YES'` before the command.

## Testing and build checks

```bash
cd backend
npm test

cd ../frontend
npm test
npm run build
```

The backend integration suite runs against MongoDB Memory Server. On the first run it downloads a MongoDB test binary; it does not use or alter your local demo database. Frontend tests use mocked API responses and a jsdom DOM environment.

## Deployment guide

You can deploy this project as a normal Node.js web service; Docker is optional and is not part of the project setup. Express serves the built React site and API from one origin, which keeps login cookies first-party and avoids separate frontend/API CORS setup.

1. **MongoDB:** create a managed production database and a database user with limited permissions. Enable TLS and allow network access from your hosting provider. Keep the connection URI in the provider’s secret settings.
2. **Choose a Node.js web service:** connect the repository and use the repository root as the service root. Set Node.js to version 22 (the app supports Node 20.19+).
3. **Set the build command:**

   ```bash
   npm ci --include=dev --prefix frontend && npm run build --prefix frontend && npm ci --omit=dev --prefix backend
   ```

   This builds `frontend/dist`, which the Express app serves in production.

4. **Set the start command:**

   ```bash
   cd backend && npm start
   ```

5. **Set runtime secrets:** configure `NODE_ENV=production`, `MONGODB_URI`, and a private `JWT_SECRET` containing at least 32 characters. The host supplies `PORT`. Startup connects to MongoDB and verifies/creates indexes before accepting requests; `GET /api/health` returns `200` only while MongoDB is connected.
6. **Create the first administrator:** use the host’s one-off shell/job with `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (12+ characters), and optionally `BOOTSTRAP_ADMIN_NAME`, then run `cd backend && npm run admin:create`. This command only creates the first admin and refuses to run if one already exists. Remove the bootstrap password from the host environment after it succeeds. The production demo seed remains disabled; create categories, clinics, and staff from the admin dashboard.
7. **Use HTTPS:** terminate TLS at the hosting provider. Production cookies are marked `Secure`; `COOKIE_SAME_SITE=lax` works for the same-origin app.

For a separately hosted frontend and API, build `frontend/` with `VITE_API_URL=https://your-api.example.com/api`, set backend `CLIENT_ORIGIN` to the exact frontend origin, and use `COOKIE_SAME_SITE=none` only when the two origins are cross-site. The API keeps credentialed CORS disabled unless `CLIENT_ORIGIN` is set.

Never commit `.env`, database credentials, or JWT secrets. This repository is prepared for a standard Node.js deployment; it has not been deployed to a hosting account.

## Known limitations and production work still needed

- Queue sessions use UTC midnight rather than a clinic’s local timezone; clinic-specific schedules/closures are not modeled.
- The wait estimate uses a configured average and current queue counts. It does not learn from service times or account for breaks, no-shows, appointment priority, or multiple providers.
- Manual refresh is used; no push updates, SMS, email, or reminder delivery.
- The login limiter uses in-memory storage and resets on process restart. Use a managed rate-limit store or gateway before running multiple API instances.
- No password reset, email verification, MFA, account recovery, audit log, or clinic ownership workflow.
- Admin/staff actions are authorized but there is no immutable audit trail.
- No pagination beyond the current bounded directory/history responses; production datasets need pagination and query monitoring.
- Mongo indexes are ensured at startup for this compact app. Larger deployments should use explicit database migrations and review index rollout.
- The test covers key queue/API transitions but is not a full load, security, accessibility, or disaster-recovery assessment.
- No privacy/regulatory review has been done. Do not enter real patient or health data.

## Suggested concepts to study

1. Controlled React forms, context, derived lists with `useMemo`, and React Router protected routes.
2. Express middleware order, Zod validation, and consistent error handling.
3. Cookies vs localStorage: the JWT is HttpOnly and unavailable to JavaScript; the CSRF token is returned to the app and must accompany unsafe methods.
4. MongoDB unique/partial indexes, atomic `$inc`, conditional updates, and why a failed sequence allocation may leave a gap.
5. Role-based and clinic-level authorization: a valid login is not sufficient to manage a clinic.
6. Vitest/Testing Library for UI behavior and Supertest integration tests for API contracts.
