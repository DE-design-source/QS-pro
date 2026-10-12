# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

QS Pro (Dezon Pro): a multi-tenant web app for construction quantity take-off ("bóc tách"), costing, cover-sheet estimates ("tờ bìa / khái toán"), quotation export and purchasing. Node.js + Express backend, plain-JS SPA frontend with no build step, data in Supabase (accessed through PostgREST over `fetch`, no SDK). Code, comments, identifiers and UI strings are Vietnamese — keep that when editing.

[README.md](README.md) has the per-file map of `public/` and `server/`; read it before looking for where something lives.

Project rules in `.claude/rules/` are mandatory: file placement and naming (`code/`), where documentation goes — everything under `docs/<group>/`, business-flow specs in `docs/03-san-pham/flows/` — and roadmap upkeep (`docs/`), plus agent/token discipline (`agent/`).

## Commands

```bash
npm install
npm start            # node server/index.js -> http://localhost:3000
npm run dev          # same with node --watch; Swagger UI at /api-docs (dev only, or SWAGGER=1)
npm test             # all four scripts below, in order
node scripts/test-core.js    # pure functions: VN number parsing, escaping, catalog price -> line, cover-sheet totals
node scripts/check-load.js   # frontend script load-order check (see "Frontend")
npm run test:vs              # sanitary-ware / paint import regression (in-memory fake DB)
npm run test:auth            # session / auth
node --check public/app.js   # syntax check a frontend file (there is no linter or bundler)
node scripts/gen-template.js # regenerate public/mau-nhap-hang-loat.xlsx
```

Tests are plain Node scripts using `assert` — no test framework, so run a single one by invoking its file. Tests that touch the server swap `server/libraries/supa` for a fake through `require.cache` before requiring any component; they never hit Supabase.

**Running locally talks to the production Supabase project.** The URL and publishable key are hardcoded in [server/libraries/supa.js](server/libraries/supa.js) on purpose; `SUPABASE_URL` / `SUPABASE_KEY` are ignored — only `SUPABASE_URL_OVERRIDE` / `SUPABASE_KEY_OVERRIDE` redirect it. Treat anything you do through a running local server as a write to real customer data.

`.env.example` is stale (it dates from when data lived in Lark Base). The env vars actually read are in [server/config/index.js](server/config/index.js), `supa.js`, and `AUTH_SECRET` in `server/components/auth/session.js`.

Deploy: Render ([render.yaml](render.yaml)) auto-deploys on push to `main`.

## Database migrations

`db/*.sql` are run **by hand** in the Supabase SQL Editor — there is no migration runner and no DB connection from the dev machine. Consequences:

- When a change needs a new column/table, write a new `db/<name>.sql` (idempotent: `add column if not exists`, disable RLS + grant, `notify pgrst,'reload schema'`) and tell the user explicitly that they must run it.
- The live DB may lag the code. Register new columns in `COL_SQL` in [server/libraries/db-errors.js](server/libraries/db-errors.js) so a "column missing" error is turned into "run file X"; wrap table access with `tblErr_` for the same reason. Some features (e.g. `phien_dang_nhap` sessions) deliberately degrade when their table is absent.
- RLS is disabled on all tables; tenant isolation is enforced in the server only (below).

`export/` holds production data dumps and is gitignored — never commit it.

## Backend architecture

**RPC, not REST.** Nearly every client call is `POST /api/<fn>` with body `{args:[...]}`, a holdover from a Google Apps Script origin (`google.script.run`). [server/libraries/rpc.js](server/libraries/rpc.js) builds one whitelist from every domain's `<domain>.routes.js`, which exports:

```js
{ fns: {name: handler}, public: [...], actor: [...], admin: [...], super: [...], router? }
```

- `fns` — the callable functions; names must be globally unique (startup throws on a duplicate).
- `public` — callable without login. Everything else requires a session.
- `actor` — the handler receives the logged-in actor `{uid, u, r, ct, sid}` as an extra **first** argument, ahead of the client's args.
- `admin` / `super` — role gates (`super` passes `admin` gates).
- `router` — optional Express router for non-RPC routes (file export/download, upload, `/media`). These bypass `rpc.mount`, so they must call `actorOf_(req)` and `tenant.run(...)` themselves — see `xuat-file.routes.js`.

Adding an endpoint = add the function to `fns` (plus the permission lists) in the domain's routes file; a new domain must also be added to `ROUTES` in [server/app.js](server/app.js). Swagger docs are generated from the same registry.

**Layering inside `server/components/<domain>/`:** `*.routes.js` (API surface + permissions) → `*.service.js` (business rules, finer permission checks; the `...Gated` functions are the entry points that enforce per-user rights) → `*.repository.js` (Supabase reads/writes, DB row ↔ camelCase object mapping). `server/libraries/` is shared and holds no business logic.

**Multi-tenancy is automatic.** `rpc.js` runs each handler inside an `AsyncLocalStorage` context ([server/libraries/tenant.js](server/libraries/tenant.js)); `supa.select/insert/update/remove` then append `cong_ty_id=eq.<tenant>` (and stamp it on inserts) for every table listed in `TENANT_TABLES` in `supa.js`. So:

- A new per-company table must be added to `TENANT_TABLES`, or its rows leak across companies.
- Pass `{noScope: true}` only for genuinely cross-tenant access (login, session lookup).
- `super` users have no company and see everything unless the `x-view-company` header selects one.
- `supa.select` pages past PostgREST's 1000-row cap only when you pass a `limit` above 1000.

**Auth:** a self-signed HMAC token in an HttpOnly cookie (`qs_sess`); every request re-checks the session row, the user and the company (active, not expired) against the DB with a 30s cache. A handler logs in/out by returning `_sessionToken` in its result, which `rpc.js` converts into the cookie and strips.

## Frontend

`public/index.html` (markup + all CSS) loads plain scripts sharing globals, in this order: `vs-spec.js`, `son-spec.js`, vendored Jspreadsheet, `app.js` (shared core), one file per tab, then `main.js` last.

- **Load order matters.** Code that runs at load time may only reference files loaded earlier; `scripts/check-load.js` enforces it. Functions invoked later by user actions can live anywhere. A function used by one tab goes in that tab's file; used by two or more, in `app.js`. A new script file must be added to `index.html`.
- Global state is `S` (`app.js`); server calls go through `api(fn)`.
- **Switch projects only through `openProject_()`** — it assigns `S.cur` + `S.lines` after the load completes and discards stale responses.
- **Parse user-typed numbers with `tkNum_()`** (understands `1.234.567` and `12,5`); the server twin is `toNumber_` in `libraries/vn-number.js` and `test-core.js` asserts they agree.
- HTML is built by string concatenation: use `esc()` for text, `escJs_()` for values inside `onclick`, `safeUrl_()` for `href`.
- `test-core.js` extracts some client functions from `app.js` by regex on top-level `function name(` declarations — keep those as plain top-level function declarations.

## Cross-cutting invariants

- **Pricing formula is duplicated.** Server `calc_()` in `server/components/du-an/dong-boc-tach.repository.js` ↔ client `recalcLine_()` / `giaDaiLy_()` / `donGiaCK_()` in `app.js`. Change both together — no test compares the two.
- **Cover-sheet codes are the Bóc tách category tree codes** (`TREE` in `app.js`). A line with `nhom='3.2.6.1'` rolls up into item `3.2.6`.
- **Per-industry product specs have a single source of truth**: `public/vs-spec.js` (sanitary ware, tree node `3.2.5`) and `public/son-spec.js` (paint, `3.2.2`) are UMD modules used by both browser and server, driving the entry form, import templates, import validation, filters and detail panels. Lighting is the original/default industry (`3.2.6.1`). Labels shared by two specs must map to the same DB column. For any change here, use the `thiet-bi-ve-sinh` skill ([.claude/skills/thiet-bi-ve-sinh/SKILL.md](.claude/skills/thiet-bi-ve-sinh/SKILL.md)) — it has the consumer list and add-a-metric checklist.
