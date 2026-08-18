# Dirgest Roadmap

Dirgest is a context-aware project suggestion engine. The core engine inspects a software project, builds a bounded representation, and uses an LLM to generate actionable feature ideas. The engine is the product. CLI, API, web, and IDE are consumers of the SDK.

**Architectural rule: No client implements Dirgest intelligence. Every client consumes `@dirgest/sdk`.**

---

## Gate 1 — Engine Maturity

> Stabilize the existing engine into a clean, testable internal surface. Most of this is done from the current CLI work.

### Done
- [x] Bounded project scanning (24 files, 48KB/file, 12K chars total)
- [x] Weighted sampling — entry points, configs, schemas, routes, core modules prioritized over tests/utils
- [x] Project analysis summary — language, framework, project type, entry points, key deps
- [x] Dependency-aware context — runtime vs dev dep counts, Firebase/AWS/AI highlights
- [x] LLM grounding — system prompt enforces accurate project identity, not dependency-level misclassification
- [x] Suggestion generation — 4-6 project-aware ideas with 3-4 word titles and actionable prompts
- [x] Ask mode — binary fit/no-fit evaluation with reasoning and alternative suggestions
- [x] Feedback loop — selection history stored in `.dirgest/history.json`, injected into future prompts
- [x] Model fallback — retryable error detection, candidate model rotation, bridge + direct provider support
- [x] Mock mode — deterministic offline suggestions for testing and CI

### Remaining
- [x] **Define `ProjectContext` type** — the stable internal representation that flows through the entire engine. Currently `inspectProject` returns a loose object; formalize it:
  ```
  ProjectContext {
    directory: string
    name: string
    summary: string | null
    metadata: { packageName, description, scripts, fileCount }
    sample: string
    files: Array<{ path: string, priority: number }>
    dependencies: { runtime: string[], dev: string[], firebase: string[], aws: string[], ai: string[] }
    entryPoints: string[]
    detectedLanguage: string | null
    detectedFramework: string | null
    detectedProjectType: string | null
  }
  ```
- [x] **Separate `ProjectContext` construction from file I/O** — `collectFiles` + `readTextFile` are I/O; `detectProjectSummary`, `sortByPriority`, etc. are pure transforms. Make `ProjectContext` buildable from either live I/O or pre-loaded data (needed for SDK/API later where the client sends pre-scanned data).
- [x] **Export all engine functions cleanly** — scanner, suggestions, history, selection parsing. No implicit globals or process.env leaks in the core logic.
- [x] **Stabilize the prompt contract** — `systemPrompt()`, `askSystemPrompt()`, `makePrompt()`, `formatHistoryForPrompt()` are the engine's prompt surface. Document their inputs/outputs.
- [x] **CLI is the reference consumer** — ensure every engine capability is exercised through the CLI, not bypassed. The CLI should be a thin wrapper, not a second implementation.

### Exit Criteria
- [x] `ProjectContext` is a defined type with clear construction and consumption boundaries
- [x] All engine functions are exported and testable without CLI
- [x] CLI uses only public engine exports — no internal imports
- [x] 55+ tests passing (currently 58)

---

## Gate 2 — `@dirgest/sdk`

> Extract the platform-independent core into a standalone, publishable package. The CLI must prove the boundary by operating entirely through it.

### Work
- [x] **Monorepo structure** — establish the workspace layout:
  ```
  dirgest/
    packages/
      sdk/          ← @dirgest/sdk (the engine)
      cli/          ← dirgest CLI (consumer of sdk)
  ```
- [x] **Extract to `packages/sdk/`** — move `lib/scanner.js`, `lib/suggestions.js`, `lib/history.js` into the SDK package. These become the public API surface:
  - `inspectProject(directory)` → `ProjectContext`
  - `getSuggestions(context, options)` → `Suggestion[]`
  - `getAskResponse(context, question, options)` → `AskResponse`
  - `readHistory(directory)` / `writeHistory(directory, entry)` / `clearHistory(directory)`
  - `formatHistoryForPrompt(history)` → `string`
  - All type definitions: `ProjectContext`, `Suggestion`, `AskResponse`, `SuggestionMode`
- [x] **SDK has zero CLI dependencies** — no `readline`, no `process.stdin`, no ANSI rendering. The SDK is a pure library.
- [x] **CLI consumes SDK** — `packages/cli/` imports from `@dirgest/sdk`. The CLI adds only: argument parsing, terminal rendering, interactive selection. If the CLI can do everything through the SDK public API, the boundary is proven.
- [x] **SDK package.json** — name `@dirgest/sdk`, version `0.1.0`, exports map, `"type": "module"`, Node 18+.
- [x] **SDK has its own test suite** — the existing scanner/suggestions/history tests move to the SDK package. CLI tests cover only CLI-specific behavior (arg parsing, rendering).
- [x] **Internal vs public exports** — `package.json` exports map exposes only the intended public surface. Internal helpers (e.g., `isBinary`, `isSourceFile`, `parseContent`) stay internal.

### Exit Criteria
- [x] `npm install @dirgest/sdk` works as a standalone dependency
- [x] CLI runs with `packages/cli/` importing only from `@dirgest/sdk`
- [x] SDK has no terminal/process/readline dependencies
- [x] All existing tests pass in the new structure
- [x] SDK test suite is self-contained

---

## Gate 3 — Service/API

> Put HTTP transport around the SDK. The API does not reimplement any engine logic — it calls SDK functions and returns results.

### Work
- [x] **API package** — `packages/api/` (or `services/api/`):
  - Hono server (ESM + Node 18+)
  - Routes map 1:1 to SDK functions:
    - `POST /projects/inspect` → `inspectProject()` (accepts directory path)
    - `POST /projects/inspect/upload` → `buildProjectContext()` (accepts pre-loaded file data)
    - `GET /projects/:id` → returns cached `ProjectContext`
    - `POST /projects/:id/suggestions` → `getSuggestions()`
    - `POST /projects/:id/ask` → `getAskResponse()`
    - `GET /projects/:id/history` → `readHistory()`
    - `POST /projects/:id/history` → `writeHistory()`
    - `DELETE /projects/:id/history` → `clearHistory()`
    - `POST /projects/:id/inspect/async` → async job creation
    - `GET /jobs/:id` → job status polling
  - Response envelope: `{ ok: boolean, data?: T, error?: { code, message }, meta: { version, timestamp } }`
- [x] **Project ingestion** — two modes:
  - **Local path**: client sends a directory path, server scans it (self-hosted / single-tenant)
  - **Uploaded files**: client sends file contents, server builds `ProjectContext` from them (hosted / multi-tenant / remote repos). Gate 1 separation of I/O from `ProjectContext` construction enabled this.
- [x] **Project identity** — `POST /projects/inspect` returns a project ID (SHA-256 content fingerprint, 16 char prefix). Subsequent calls reference this ID. `ProjectCache` caches the `ProjectContext`.
- [x] **Error handling** — map SDK errors to HTTP status codes. Validation errors → 400, not found → 404, provider errors → 502, rate limits → 429.
- [x] **Auth boundary** — API key auth layer via `X-API-Key` header. `DIRGEST_API_KEYS` env for comma-separated keys. Open by default when no keys configured. The SDK receives a `ProjectContext` and returns results — it doesn't know about users.
- [x] **Quotas/limits** — per-key rate limiting via `DIRGEST_RATE_LIMIT_WINDOW` and `DIRGEST_RATE_LIMIT_MAX`. Returns `429` with `Retry-After` and `X-RateLimit-*` headers.
- [x] **Async support** — for large repositories, `POST /projects/:id/inspect/async` creates a job and returns 202 with job ID. `GET /jobs/:id` polls status. `JobStore` tracks pending/completed/failed.
- [x] **Versioning** — API version prefix: `/api/v1/...`. Health endpoint at `/healthz`.
- [x] **ModelHitch as provider abstraction** — the SDK's model configuration stays inside the SDK. The API does not configure models; it passes through env vars or SDK config options.

### Exit Criteria
- [x] API serves all SDK capabilities over HTTP
- [ ] CLI can optionally point at a remote API instead of running locally (prove the transport is swappable)
- [x] Auth and rate limiting work
- [x] Async job flow works for large projects
- [x] API test suite covers all routes + error cases (27 tests)

---

## Gate 4 — Web Reference Client

> Build the primary interactive interface. This is the showcase — it demonstrates what Dirgest can do.

### Stack
- React + TypeScript + Vite
- Independently deployable SPA (`packages/web/`)
- Consumes `@dirgest/api` over HTTP. Zero recommendation intelligence client-side.
- Dark-first developer-tool aesthetic. No terminal cosplay. Dense, restrained, high-contrast, strong typography.

### Core UX principle
**Source → Project Understanding → Grounded Recommendation.** The user sees what Dirgest believes the project is, why it believes that, and then sees recommendations grounded against that representation. Not a chat box.

### Work
- [x] **API contracts audit** — existing API routes cover the full web workflow. CORS enabled via `hono/cors`. No new endpoints needed for Gate 4.
- [ ] **Project connection** — file upload (drag-drop or file picker). Client reads files, sends `{ files: [{ path, content }] }` to `POST /api/v1/projects/inspect/upload`. Show async job state for large projects via `POST /projects/:id/inspect/async` + `GET /jobs/:id`.
- [ ] **Project understanding view** — "What Dirgest thinks this is." Display `ProjectContext`: name, summary, detected language/framework/project type, entry points, dependency highlights (runtime, firebase, aws, ai), file list with priority. Show the evidence transparently.
- [ ] **Suggestion engine** — mode selector (balanced/growth/ux/technical/wild). Generate via `POST /projects/:id/suggestions`. Display suggestion cards: title, expandable prompt, copy-to-clipboard. History records selections via `POST /projects/:id/history`.
- [ ] **Ask mode** — text input for feature idea evaluation. `POST /projects/:id/ask`. Show verdict (fit/no-fit), reasoning, and prompt or alternative. Copy-to-clipboard for prompt.
- [ ] **History view** — `GET /projects/:id/history`. Timeline of past selections with dates, modes, titles. Clear history via `DELETE /projects/:id/history`.
- [ ] **Implementation prompts** — formatted, copyable, ready-to-paste prompts. Copy button on all prompt surfaces.
- [ ] **Responsive layout** — desktop-first, works on tablet. No mobile priority.
- [ ] **Error states** — network errors, API errors, empty states, loading states. All wrapped in the response envelope `{ ok, data?, error? }`.

### API contract (no changes needed)
All routes exist and work:
- `POST /projects/inspect/upload` — file upload → `{ id, context }`
- `GET /projects/:id` — cached context
- `POST /projects/:id/suggestions` — `{ mode, mock }` → suggestions
- `POST /projects/:id/ask` — `{ question, mock }` → verdict
- `GET /projects/:id/history` / `POST` / `DELETE` — history CRUD
- `POST /projects/:id/inspect/async` + `GET /jobs/:id` — async analysis

### Exit Criteria
- [x] User can upload a project and see what Dirgest thinks it is
- [x] User can generate suggestions across all 5 modes
- [x] User can ask arbitrary feature questions and get verdicts
- [x] User can view and clear suggestion history
- [x] User can copy implementation prompts
- [ ] Async job state works for larger projects (UI wired, needs real large-project testing)
- [x] No recommendation intelligence in the web client — all from API/SDK
- [ ] UI is polished enough to demo (scaffold complete, needs visual QA and refinement)

---

## Gate 5 — Integrations / Productization

> Expand the surface area. This gate is intentionally fuzzy — it prioritizes what survives real usage from Gates 1-4.

### Candidates
- [ ] **GitHub ingestion** — connect a GitHub repo by URL. Webhook for continuous analysis on push/PR.
- [ ] **IDE/agent adapters** — VS Code extension, JetBrains plugin, AI coding assistant integrations (Cursor, Copilot, etc.). All consume `@dirgest/sdk` or the API.
- [ ] **Webhooks / continuous analysis** — schedule recurring scans, diff-based incremental analysis, notification when new suggestion categories emerge.
- [ ] **Hosted multi-tenancy** — user accounts, project workspaces, team collaboration, shared history.
- [ ] **Billing / packaging** — OSS SDK vs. hosted pro tier. Feature gating, usage-based pricing.
- [ ] **Export formats** — Jira, Linear, GitHub Issues integration for turning suggestions into tracked work.
- [ ] **Custom modes** — user-defined suggestion modes beyond the built-in 5. Domain-specific guidance (e.g., "security audit", "performance review").

### Exit Criteria
- Determined by what actual users need from Gates 1-4

---

## Cross-Cutting Concerns

These apply across all gates:

- **Testing** — every gate adds tests. Unit tests for engine logic, integration tests for API routes, end-to-end tests for the web client. CI runs all suites.
- **Documentation** — SDK API docs (generated from JSDoc/TypeScript), API OpenAPI spec, web client user guide.
- **TypeScript** — consider migrating to TypeScript during Gate 2 (SDK extraction) for type safety across the package boundary. The `ProjectContext` type becomes the contract.
- **Error model** — consistent error types across SDK → API → clients. No raw `Error` objects leaking.
- **Logging** — structured logging in the API layer. SDK stays log-free (consumers decide how to log).
- **Performance** — profile scanning + LLM round-trip times. Cache `ProjectContext` where possible. Optimize the 12K char budget.
