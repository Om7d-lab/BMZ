# Deploying BMZ Trade Lab

This guide takes the app from the repository to a live, working deployment: a
real backend with a real database, and the web app served over HTTPS.

## The shape of the deployment

BMZ Trade Lab is a full-stack app, not a static site:

- **`apps/web`** — the Next.js app. Server components, a `proxy.ts` middleware
  and dynamic routes, so it needs a Node runtime. Vercel runs this natively.
- **`apps/api`** — the NestJS REST API. A long-running server that holds a
  PostgreSQL connection pool (Prisma) and issues auth cookies.
- **PostgreSQL** — the database. (No Redis is required; the rate limiter runs
  in-process.)

### Why the API is not on Vercel, and why one origin

Two decisions make the deployment reliable:

1. **The API runs on a long-running host, not serverless.** NestJS is a
   persistent server with a database connection pool; a managed Node host
   (Render, Railway, Fly.io) runs it unchanged with `node dist/main.js`. Vercel
   is serverless and would need an adapter plus an externally-pooled database,
   for no benefit here.

2. **The browser only ever talks to the web app's own origin.** The auth
   cookies are set with `SameSite=Lax`, which a browser refuses to send on a
   cross-site request. So the web app proxies `/api/*` to the API through a
   Next.js rewrite (`apps/web/next.config.ts`). The cookie therefore stays
   first-party and login works in every browser. Server components call the API
   directly using `API_ORIGIN`; the browser uses the relative `/api` path.

```
  Browser ──/api/*──▶ Vercel (web) ──rewrite──▶ Render (API) ──▶ PostgreSQL
     ▲   pages, first-party cookie                 ▲
     └───────────────────────────────────────────┘  server components fetch API_ORIGIN directly
```

You can host the API anywhere that runs a Node server. Two ready paths ship in
this repo: **Northflank** (everything on one platform — recommended) and
**Vercel + Render**. Pick one.

---

## Option A — Northflank (one platform for all three)

Northflank runs the database, the API and the web app as long-running services
in a single project. The repo ships Dockerfiles for both apps
(`apps/api/Dockerfile`, `apps/web/Dockerfile`), built from the repository root.

1. **Create a project.** Add **Addon → PostgreSQL** and copy its connection
   string.
2. **API service** — Create service → build from this repository:
   - Build type **Dockerfile**, build context `/`, path `apps/api/Dockerfile`.
   - Keep it **private** (internal only): the web app reaches it over the
     project network, the browser never does. Port `4000` (the host injects
     `PORT` and the server binds to it).
   - Environment: `NODE_ENV=production`, `DATABASE_URL` (the addon's string),
     `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (two different random strings,
     ≥ 32 chars), `AUTH_COOKIE_SECURE=true`. Add `WEB_URL` and
     `API_CORS_ORIGINS` once you have the web URL (step 4).
   - The container runs `prisma migrate deploy` on start, so the schema is
     created automatically.
3. **Web service** — Create service → build from this repository:
   - Build type **Dockerfile**, build context `/`, path `apps/web/Dockerfile`,
     with **build argument** `API_ORIGIN` set to the API's internal URL
     (e.g. `http://bmz-api:4000`). Next bakes the `/api/*` proxy target at build
     time, which is why it is a build argument.
   - Set `API_ORIGIN` as a **runtime** environment variable to the same value
     (server components read it at run time).
   - Expose it **publicly** on port `3000`. This public URL is what you share.
4. Set the API service's `WEB_URL` and `API_CORS_ORIGINS` to the web's public
   URL, then redeploy the API. Done — open the web URL and register.

Generate a secret:
`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

> The onboarding survey — for "What would you like to deploy?" answer something
> like _"a Next.js web app and a NestJS API with a PostgreSQL database (a pnpm
> monorepo, Dockerfiles included)"_, and pick the region closest to your users.

---

## Option B — Vercel (web) + Render (API + database)

### Step 1 — Deploy the API and database (Render)

1. Push this repository to GitHub (already done for `main`).
2. In Render: **New → Blueprint**, and select this repository. Render reads
   `render.yaml` and proposes a PostgreSQL database (`bmz-postgres`) and a web
   service (`bmz-api`).
3. Apply it. Render will:
   - install the workspace, generate the Prisma client, build the shared
     packages and the API (`buildCommand`);
   - run `prisma migrate deploy` before the service starts
     (`preDeployCommand`);
   - start it with `node apps/api/dist/main.js` and health-check
     `/api/v1/health/live`.
   - wire `DATABASE_URL` from the database and generate `JWT_ACCESS_SECRET` and
     `JWT_REFRESH_SECRET` automatically.
4. When it is live, copy the service URL, e.g. `https://bmz-api.onrender.com`.
   Leave `WEB_URL` and `API_CORS_ORIGINS` unset for now — you fill them in
   Step 3.

> Free Render services sleep after inactivity, so the first request after idle
> is slow. For always-on, use a paid instance or Railway/Fly.io — the app is the
> same.

### Step 2 — Deploy the web app (Vercel)

1. In Vercel: **Add New → Project**, import this repository.
2. Set **Root Directory** to `apps/web`. Vercel detects Next.js; the install and
   build commands come from `apps/web/vercel.json` (they build the workspace
   packages first, which the app imports).
3. Add an environment variable **before the first build** (rewrites are baked in
   at build time):
   - `API_ORIGIN` = the API URL from Step 1, no trailing slash
     (e.g. `https://bmz-api.onrender.com`).
4. Deploy. Copy the resulting URL, e.g. `https://bmz.vercel.app`.

### Step 3 — Point the API back at the web app

On Render, set these on the `bmz-api` service (Environment tab) to the Vercel
URL from Step 2, then let it redeploy:

- `WEB_URL` = `https://bmz.vercel.app`
- `API_CORS_ORIGINS` = `https://bmz.vercel.app`

### Step 4 — Create an account and verify

1. Open the Vercel URL and go to **Start free / Register**. Registration creates
   your account and first workspace and signs you in.
2. Add an account under **Settings**, then log a trade. The dashboard and
   analytics fill in from there.

Health checks, if you want to confirm the backend directly:

- `GET https://<api>/api/v1/health/live` → process is up.
- `GET https://<api>/api/v1/health/ready` → database is reachable.

---

## Environment variables

### Web (Vercel)

| Variable     | Required | Value                                                                                                             |
| ------------ | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `API_ORIGIN` | yes      | The deployed API origin, no trailing slash. Used at build + run time for the rewrite and for server-side fetches. |

### API (Render / any Node host)

| Variable                  | Required | Notes                                                     |
| ------------------------- | -------- | --------------------------------------------------------- |
| `NODE_ENV`                | yes      | `production`.                                             |
| `DATABASE_URL`            | yes      | PostgreSQL connection string.                             |
| `JWT_ACCESS_SECRET`       | yes      | ≥ 32 chars. Must differ from the refresh secret.          |
| `JWT_REFRESH_SECRET`      | yes      | ≥ 32 chars.                                               |
| `AUTH_COOKIE_SECURE`      | yes      | `true` in production (HTTPS).                             |
| `WEB_URL`                 | yes      | The web app's origin.                                     |
| `API_CORS_ORIGINS`        | yes      | Comma-separated allowed origins; normally just `WEB_URL`. |
| `PORT`                    | auto     | Injected by the host; the server binds to it.             |
| `AUTH_COOKIE_DOMAIN`      | no       | Leave unset so the cookie is scoped to the web origin.    |
| `GOOGLE_CLIENT_ID`        | no       | Enables Google sign-in. See "Google sign-in" below.       |
| `GOOGLE_CLIENT_SECRET`    | no       | Server-side only. Never set it on the web app.            |
| `GOOGLE_REDIRECT_URI`     | no       | Defaults to `${WEB_URL}/api/v1/auth/google/callback`.     |
| S3 / SMTP / feature flags | no       | Optional; off by default. See `.env.example`.             |

Generate a secret locally if you set them by hand:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

---

## Google sign-in

Google sign-in is optional: without credentials the app runs normally and the
"Continue with Google" button explains that it is unavailable.

It uses OpenID Connect's authorization-code flow with PKCE, state and nonce.
The callback lands on the **web** origin — the browser reaches the API through
the web app's `/api` rewrite, which keeps the session cookies first-party — so
the redirect URI is on the web domain, not the API's.

### 1. Create the OAuth client

1. [Google Cloud Console](https://console.cloud.google.com/) → pick or create a
   project.
2. **APIs & Services → OAuth consent screen**: user type _External_, app name,
   support email, and the scopes `openid`, `email` and `profile` (all
   non-sensitive, so no verification review). Add test users while the app is
   in _Testing_, or publish it to let anyone sign in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   application type **Web application**, with:

   | Field                         | Local development                                   | Production                                              |
   | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
   | Authorized JavaScript origins | `http://localhost:3000`                             | `https://<your-web-domain>`                             |
   | Authorized redirect URIs      | `http://localhost:3000/api/v1/auth/google/callback` | `https://<your-web-domain>/api/v1/auth/google/callback` |

   Both can live on the same client, or use one client per environment.

4. Copy the client ID and secret.

### 2. Configure the API

Set on the **API** service (never on the web app):

```bash
GOOGLE_CLIENT_ID=<client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<client secret>
# Only if the callback is not ${WEB_URL}/api/v1/auth/google/callback:
# GOOGLE_REDIRECT_URI=https://<your-web-domain>/api/v1/auth/google/callback
```

`WEB_URL` must be the exact public web origin, since the default redirect URI
and every post-sign-in redirect are built from it. Redeploy the API.

### How accounts are matched

- A Google account is identified by its stable `sub`, stored in
  `user_identities`, so a returning user is found even if their Gmail address
  changes.
- A new, Google-verified address gets a new account (no password; it can set
  one any time through "Forgot password").
- If the address already belongs to a **password** account, nothing is merged
  automatically. The user is sent to the sign-in page and asked for their
  password once; the Google identity is attached only after that succeeds, and
  only if the address matches. This blocks pre-registration account takeover.
- Google accounts whose email Google has not verified are refused.

### Troubleshooting

| Symptom on Google's screen / our sign-in page      | Cause                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `redirect_uri_mismatch`                            | The URI in Console doesn't match `${WEB_URL}/api/v1/auth/google/callback` character for character (scheme, host, port, no trailing slash). |
| "Google sign-in isn't available right now"         | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` not set on the API.                                                                            |
| "…took too long or was started in another browser" | The 10-minute sign-in window expired, or the browser blocks cookies for this site, which drops the short-lived `bmz_oauth_tx` cookie.      |
| `access_blocked` / "app not verified"              | The consent screen is in _Testing_ and the Google account isn't a listed test user.                                                        |

---

## Deploying updates

- **Web:** push to `main`; Vercel rebuilds `apps/web`.
- **API:** push to `main`; Render rebuilds and runs `prisma migrate deploy`
  automatically before the new version takes traffic. New migrations created
  with `pnpm --filter @bmz/api db:migrate` locally are applied on the next
  deploy.

## The GitHub Pages landing page

The static marketing page in `site/` still deploys to
`https://om7d-lab.github.io/BMZ/` via `.github/workflows/deploy-pages.yml`. It is
independent of the app above; keep it, or point a custom domain at the Vercel
app instead once the product is live.

## Running it all locally

```bash
pnpm install
pnpm infra:up          # Postgres via docker compose
cp .env.example .env   # then set the JWT secrets and DATABASE_URL
pnpm db:migrate
pnpm dev               # API on :4000, web on :3000
```
