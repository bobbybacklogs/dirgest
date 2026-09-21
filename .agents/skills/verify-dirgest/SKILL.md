---
name: verify-dirgest
description: Verify dirgest (CLI/SDK/API/web) without inventing shipped behavior. Default is workspace tests and web typecheck that need no secrets. Use before claiming a feature works, after a change, or when refreshing docs/FEATURE_MAP.md.
---

# Verify dirgest

Dirgest is a monorepo: `@dirgest/sdk` (engine), `@dirgest/cli`, `@dirgest/api` (Hono), `@dirgest/web` (React SPA bundled into the API `dist`). Clients must not reimplement engine intelligence.

Read [docs/FEATURE_MAP.md](../../../docs/FEATURE_MAP.md) before expanding scope. `ROADMAP.md` is a plan, not proof.

## Rules

- Prefer the default path. Do not start servers, browsers, or live model calls unless the user asked or the claim cannot be checked another way.
- Do not change product behavior to make verification pass. A failing test is a product or test gap — record it.
- Do not mark a surface Proven because the README or ROADMAP says it is done.
- Live LLM (`getSuggestions` / `getAskResponse` / `reviewFeatures` without `mock`) is env-gated. If no provider key and no healthy ModelHitch bridge, skip and record **Unverified**.
- Never print env values or API keys.

## Default path (no secrets)

From the repo root, after `npm install`:

```sh
npm run verify
```

That is `npm test --workspaces`:

| Workspace | What `test` actually runs | Secrets? |
|---|---|---|
| `packages/sdk` | `node --test` (scanner, mock suggestions/ask/review, history, ModelHitch routing with stubs) | No |
| `packages/cli` | `node --test` (spawn `bin/dirgest.js` with `--mock`, update-check unit tests, selection rendering) | No |
| `packages/api` | `node --test` (`app.request` against in-process Hono; mock LLM flags) | No |
| `packages/web` | `tsc --noEmit` only — not a UI or browser test | No |

Doctor: verify Node `>=18`, `node_modules` present, and the command exits 0. Capture stdout/stderr and the exit code.

This default path does **not** prove: live model output, OpenTUI, a listening API, or any web click-path.

## Optional paths (not default)

Run only when the claim needs them. Keep scratch under `/tmp/verify-dirgest-$RUN_ID`. Do not write `.dirgest/` into this repo.

### Live LLM (env-gated)

Requires at least one of: a configured provider key (`OPENAI_API_KEY`, `AI_GATEWAY_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, …), `DIRGEST_PROVIDER`, or a healthy ModelHitch bridge at `DIRGEST_BRIDGE_URL` (default `http://127.0.0.1:3939`).

If none of those are present, **skip**. Do not use `--mock` and call it a live proof.

```sh
# only after the gate above is true
node packages/cli/bin/dirgest.js --suggest --dir "$TMP_PROJECT"
```

Use a disposable temp project, not the monorepo checkout, so history cannot pollute the repo.

### HTTP API process

```sh
node packages/api/bin/server.js   # default :3940
curl -sS http://127.0.0.1:3940/healthz
```

In-process `app.request` tests already cover most routes. A live listen is only for static UI serving or proxy checks.

### Web UI

```sh
npm run dev   # API :3940, Vite :5173 (proxies /api and /healthz)
```

There is no Playwright/Cypress harness. Drive the real UI only if the claim is about the SPA. Note the hard-coded `mock: true` in `packages/web/src/App.tsx` before claiming live suggestions from the browser.

### Interactive CLI / OpenTUI

Needs a real TTY. OpenTUI also needs Node `26.4+` and re-execs with `--experimental-ffi`. Non-TTY runs the plain picker and quit. Do not treat a non-TTY `--suggest --mock` run as proof of the interactive browser.

## Evidence

Default proof is the `npm run verify` transcript (pass/fail counts per workspace, exit code).

For optional drives, keep artifacts in `/tmp/verify-dirgest-$RUN_ID/` (command, stdout/stderr, status, HTTP bodies, screenshots). Cleanup kills only processes this run started. Evidence stays.

## After a run

Update [docs/FEATURE_MAP.md](../../../docs/FEATURE_MAP.md) only when the evidence changed a status. Keep gaps visible. Do not “complete” ROADMAP checkboxes from this skill.
