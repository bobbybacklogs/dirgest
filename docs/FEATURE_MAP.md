# Dirgest Feature Map

Truthful inventory of what the monorepo implements today. Statuses are from source inspection plus the default verify command. They are **not** copied from `ROADMAP.md` or marketing copy.

Last bootstrap: 2026-09-21. Default verify: `npm run verify` (`npm test --workspaces`).

Proof (this environment, no secrets):

| Workspace | Result |
|---|---|
| `@dirgest/api` | 32 pass / 0 fail |
| `@dirgest/cli` | 15 pass / 0 fail |
| `@dirgest/sdk` | 92 pass / 0 fail |
| `@dirgest/web` | `tsc --noEmit` exit 0 |

Live LLM was **not** run (no provider key and no ModelHitch bridge in this environment).

## Status vocabulary

| Status | Means |
|---|---|
| **Proven** | Exercised by a passing default-verify check in this bootstrap (workspace `node --test`, or web `tsc --noEmit` where that is the only check). |
| **Code-inspected** | Implementation exists and was read; not covered by default verify, or only partially covered. |
| **Unverified** | Claimed or reachable in code, but this bootstrap could not exercise it (missing keys, TTY, browser, or long-lived server). |
| **Gap** | Missing, stubbed, hardcoded-off, or contradicted by a README/ROADMAP claim. Leave these visible. |

`ROADMAP.md` checkboxes are not evidence. Several Gate 4 work items are still unchecked while the same file’s exit criteria are checked.

## Surfaces

Workspaces: `packages/sdk`, `packages/cli`, `packages/api`, `packages/web`. Root scripts: `test` / `verify` (workspaces), `dev` (API + Vite), `dev:api`, `dev:web`.

---

### SDK — `@dirgest/sdk`

Public exports: `packages/sdk/lib/index.js`. Types: `packages/sdk/lib/types.js` (JSDoc).

| ID | Behavior | Status | Evidence / notes |
|---|---|---|---|
| sdk-inspect | `inspectProject(dir)` bounded scan (24 files, 48 KB/file, 12k sample); ignores `.git`, `node_modules`, lockfiles, `.env*`, binaries, `.dirgest` | Proven | `packages/sdk/test/scanner.test.js` |
| sdk-crawl | `inspectProject(dir, { crawl: true })` up to 2,000 discovered / 96 sampled / 36k chars + tree | Proven | scanner crawl test |
| sdk-build-context | `buildProjectContext(dir, files, meta)` from pre-loaded files | Proven | scanner `buildProjectContext` tests |
| sdk-analysis | Language / framework / type / entry points / categorized deps + summary | Proven | scanner detect* tests |
| sdk-suggest-mock | `getSuggestions(ctx, { mock: true, mode })` 4–6 titled prompts; modes `balanced\|growth\|ux\|technical\|wild\|ai\|ai-wild`; honors exclusions | Proven | `packages/sdk/test/suggestions.test.js` |
| sdk-recommend-mock | `getRecommendations(ctx, { mock: true, count })` 5–20 cross-category picks with `mode` tags; honors exclusions | Proven | `packages/sdk/test/recommendations.test.js` |
| sdk-ask-mock | `getAskResponse(ctx, q, { mock: true })` fit/no-fit via verb heuristic, not a model | Proven | mock ask tests |
| sdk-review-mock | `readFeatureFile` / `parseFeatureList` / `reviewFeatures(..., { mock: true })` `.md`/`.txt`, 64 KB, 40 features | Proven | `packages/sdk/test/features.test.js` |
| sdk-history | `.dirgest/history.json` read/write/clear; format for prompts; exclude + ask entries; cap 50 | Proven | `packages/sdk/test/history.test.js` |
| sdk-model-routing | ModelHitch bridge vs direct; policy lanes; `DIRGEST_PROVIDER`/`DIRGEST_MODEL`; retryable fallback | Proven | suggestions tests with stubbed hitch/bridge |
| sdk-suggest-live | Same APIs without `mock` — real ModelHitch chat | Unverified | Needs keys or a healthy bridge. Default verify never calls this. Env-gated. |
| sdk-ask-live | Live ask | Unverified | Same gate as `sdk-suggest-live` |
| sdk-review-live | Live feature-list review | Unverified | Same gate |

---

### CLI — `@dirgest/cli`

Entry: `packages/cli/bin/dirgest.js`. Thin consumer of the SDK.

| ID | Behavior | Status | Evidence / notes |
|---|---|---|---|
| cli-suggest-mock | `dirgest --suggest [mode] --mock --dir <path>` (also `-s`, `--suggestions`; modes include `ai`, `ai-wild`) | Proven | CLI spawn tests (`--suggest --mock`, exclusion + crawl) |
| cli-recommend-mock | `dirgest --recommend [--count <5-20>] --mock --dir <path>` (implies crawl; save with `a` or choose) | Proven | CLI spawn test (`--recommend --mock`) |
| cli-inspect | `dirgest --inspect --dir <path>` (implies crawl) | Proven | `--inspect` spawn test |
| cli-ask-mock | `dirgest --ask "…" --mock` prints verdict; no history write without TTY confirm | Proven | `--ask --mock` spawn test |
| cli-review-mock | `dirgest --review file.md --mock` (implies crawl); rejects non `.md`/`.txt` | Proven | `--review` spawn tests |
| cli-history-read | `dirgest --history` | Proven | asserted in the ask test (empty history) |
| cli-history-clear | `dirgest --clear-history` | Code-inspected | Wired in `bin/dirgest.js`; no dedicated CLI spawn test (SDK `clearHistory` is Proven) |
| cli-help-errors | `--help`; unknown flags / missing command → exit 2 | Code-inspected | Help string + `parseArguments`; no spawn test |
| cli-update-check | TTY npm latest-version prompt; skip via `--no-update` or `DIRGEST_SKIP_UPDATE_CHECK=1` | Proven | `maybeUpdate` unit tests (stubbed fetch/prompt). Not a real registry install. |
| cli-opentui | Interactive suggestion browser (Node 26.4+, `--experimental-ffi`) | Unverified | `browseSuggestions` in `lib/ui.js`. Needs a TTY. Fallback picker is unit-tested for non-TTY quit. |
| cli-ask-save | Interactive save after `--ask` | Code-inspected | `promptToSaveAskChoice`; non-TTY skip is Proven |
| cli-live-suggest | `--suggest` without `--mock` | Unverified | Env-gated. Do not treat mock output as live. |
| cli-remote-api | Point CLI at `@dirgest/api` instead of in-process SDK | Gap | No client flag or HTTP transport. ROADMAP Gate 3 lists this as remaining. |

Root README Commands table omits `--inspect`. The CLI binary and `packages/cli/README.md` include it.

---

### API — `@dirgest/api`

Hono app: `packages/api/lib/server.js`. Routes under `/api/v1`. Process: `node packages/api/bin/server.js` (default `PORT=3940`). Default verify uses in-process `app.request`, not a bound port.

| ID | Behavior | Status | Evidence / notes |
|---|---|---|---|
| api-healthz | `GET /healthz` → `{ ok, version: "v1" }` | Proven | `packages/api/test/api.test.js` |
| api-envelope | `{ ok, data\|error, meta: { version, timestamp } }` | Proven | success + error envelope tests |
| api-inspect-dir | `POST /projects/inspect` `{ directory }` | Proven | scans a temp dir |
| api-inspect-upload | `POST /projects/inspect/upload` `{ files, name? }` | Proven | upload + cache-hit tests |
| api-get-project | `GET /projects/:id` in-memory cache | Proven | |
| api-suggest-mock | `POST /projects/:id/suggestions` `{ mode, mock: true }` | Proven | |
| api-recommend-mock | `POST /projects/:id/recommendations` `{ count?, mock: true }` | Proven | |
| api-ask-mock | `POST /projects/:id/ask` `{ question, mock: true }` | Proven | |
| api-review-mock | `POST /projects/:id/review` `{ content, filename }` or `{ features[] }` | Proven | |
| api-history | `GET` / `POST` / `DELETE /projects/:id/history` | Proven | writes via SDK to `context.directory` |
| api-auth | `DIRGEST_API_KEYS` → `X-API-Key` or `api_key`; open when unset | Proven | 401 / 403 / pass-through tests |
| api-jobs | `POST /projects/:id/inspect/async` + `GET /jobs/:id` | Proven | 202 + poll; `:id` is unused by the handler |
| api-cors-logger | `hono/cors` + `hono/logger` on `/api/*` | Code-inspected | Wired in `createApp`; no assertion |
| api-static-web | Serves `packages/api/dist` unless `DIRGEST_SERVE_WEB=false` | Code-inspected | `bin/server.js`. Not hit by API tests. Bundle freshness is a publish script, not CI. |
| api-rate-limit | `DIRGEST_RATE_LIMIT_*`; `429` + `Retry-After` + `X-RateLimit-*` | Code-inspected | Middleware exists. Tests raise the limit to 1000 and never assert 429. |
| api-suggest-live | suggestions/ask/review without `mock` | Unverified | Env-gated. Same key/bridge requirement as the SDK. |
| api-cache-scope | `ProjectCache` is process memory only | Gap | Restart loses projects. Content-hash id ignores file bytes (uses path + length). |
| api-upload-history-dir | Upload contexts use `path.resolve(name \|\| id)` as `directory` | Gap | History files land on the API host under that resolved path, not the user’s original tree. |

Route note: the web client posts async inspect to `/api/v1/projects/inspect/async`. Hono matches that as `:id = "inspect"`. The handler ignores `:id` and reads `directory` from the body, so it works by accident. The SPA never calls it (see web gaps).

---

### Web — `@dirgest/web`

React + TypeScript + Vite. Dev server `:5173` proxies `/api` and `/healthz` to `:3940`. Published UI is copied into `packages/api/dist`. Default verify is **typecheck only**.

| ID | Behavior | Status | Evidence / notes |
|---|---|---|---|
| web-typecheck | `tsc --noEmit` | Proven | `packages/web` workspace `test` |
| web-upload-ui | Drop zone / file input → `POST /api/v1/projects/inspect/upload` | Code-inspected | `ProjectUpload` + `App.handleUpload`. Input has `multiple` but **no** `webkitdirectory`. Click-to-open is files, not a folder picker. |
| web-project-view | Renders name, language, framework, type, files, deps, summary | Code-inspected | `ProjectView.tsx` |
| web-suggest-ui | Mode buttons; cards; copy; record; exclude | Code-inspected | Always calls `getSuggestions(..., true)` — **mock hardcoded** |
| web-ask-ui | Question → verdict; copy; remember | Code-inspected | Always `askQuestion(..., true)` — mock hardcoded |
| web-review-ui | `.md`/`.txt` upload ≤64 KB | Code-inspected | Always `reviewFeatures(..., true)` — mock hardcoded |
| web-history-ui | List + clear | Code-inspected | `HistoryPanel`; load on tab click |
| web-errors-toast | Upload/generate failures → toast | Code-inspected | No empty/error-state tests |
| web-live-llm | Browser-driven live suggestions/ask/review | Gap | README: “same five capabilities from the browser.” `App.tsx` passes `mock: true` on all three. No UI toggle. |
| web-async-jobs | Large-project async inspect | Gap | `inspectAsync` / `getJob` exist in `api/client.ts` and are unused by `App.tsx`. |
| web-e2e | Browser or component tests | Gap | No Playwright/Cypress/RTL. `test` is tsc. |
| web-folder-ingest | “Drop your project” as a directory | Gap | Click path cannot select a directory. Folder drag depends on the browser filling `FileList`. Files >512 KB are silently skipped. |

---

## Cross-cutting gaps (do not hide)

- **No CI** in this repo (no GitHub Actions / other workflow files).
- **No live-LLM test** in default verify. Mock output is deterministic and is not model quality.
- **Web is a mock client** for suggest / ask / review even when the API has keys.
- **CLI cannot use the HTTP API** (transport is not swappable).
- **Gate 5 candidates are absent**: GitHub ingest, IDE adapters, webhooks, hosted multi-tenancy, billing, export-to-tracker, custom modes.
- **OpenAPI / generated SDK docs** are listed under ROADMAP cross-cutting concerns and are not in the tree.

## How to re-verify

Follow [`.agents/skills/verify-dirgest/SKILL.md`](../.agents/skills/verify-dirgest/SKILL.md). Default: `npm run verify`. Promote a row to Proven only with a fresh transcript. Live LLM stays Unverified unless keys or a bridge were actually used.
