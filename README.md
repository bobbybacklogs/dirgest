# dirgest

`dirgest` inspects a small, privacy-conscious sample of a local project and turns it into 4-6 practical feature ideas. Pick an idea to print a complete coding prompt, or print every prompt at once.

## Install

Requires Node.js 18 or later.

```sh
npx @dirgest/cli --suggestions
```

Or install globally:

```sh
npm install -g @dirgest/cli
dirgest --suggestions
```

## Use

```sh
dirgest --suggestions
dirgest --dir "C:\\path\\to\\project" --suggest
dirgest --suggest growth
dirgest --suggest ux
dirgest --suggest technical
dirgest --suggest wild
dirgest --suggest --crawl
dirgest --history
dirgest --clear-history
dirgest -d . -s --mock
dirgest --help
```

The result header shows the detected project name and scanned directory. In an interactive terminal, suggestions open in an OpenTUI browser: use arrow keys or `j`/`k` to preview, Enter or `1` through `6` to choose, `a` to print all prompts, or `q` to leave. The browser requires Node.js 26.4 or later; dirgest automatically enables the required FFI flag and falls back to the basic picker on older Node versions. With redirected/non-interactive input, dirgest prints the suggestion list and exits without waiting for input.

`--suggest` (and the legacy `--suggestions`) produces balanced, product-next ideas. Add `growth` for activation, retention, and monetization ideas; `ux` for friction and experience improvements; `technical` for architecture, debt, and reliability work; or `wild` for novel adjacent capabilities grounded in the current project.

Add `--crawl` to build a broader cross-directory context before generating suggestions. Crawl mode maps up to 2,000 readable source/configuration/documentation files, includes the resulting project layout in the model context, and samples up to 96 representative files across directories. It continues to ignore `.git`, dependencies, generated output, lockfiles, `.env*` files, binaries, and files larger than 48 KB.

`--history` displays previously selected suggestions for the project. `--clear-history` wipes the history. Selections are stored in `.dirgest/history.json` within the project directory and are automatically injected into the prompt so future runs avoid repeating explored areas.

## Model Configuration

`modelhitch` is pinned to `0.14.0` and is used through its direct `new ModelHitch().chat()` API. Before applying dirgest defaults, dirgest checks ModelHitch's built-in providers for their configured API-key environment variables (including provider fallbacks) and uses the first configured provider with a model that avoids modelhitch's frequently rate-limited free demo default `big-pickle`. On the direct path, an auto-detected `opencode-zen` provider with default model `big-pickle` is substituted with `deepseek-v4-flash`; other providers keep their native default (e.g. `openai` → `gpt-4o-mini`, `groq` → `llama-3.3-70b-versatile`). On the bridge path, dirgest prefers the first advertised model from a small reliable list (`deepseek-v4-flash`, `gpt-5.6-luna`, `gpt-5.4-mini`, `gpt-5.4-nano`, `claude-haiku-4-5`, `gemini-3.5-flash-lite`), falling back to `big-pickle` only when none of those are advertised. If no direct credential is present, dirgest also detects a healthy local ModelHitch bridge at `http://127.0.0.1:3939`, selects an advertised model, and routes through it. If neither is available, dirgest falls back to ModelHitch's `openai` provider and `gpt-4o-mini`.

To survive flaky or quota-limited upstream models, dirgest re-attempts each request with the next preferred model when ModelHitch reports a retryable failure (`rate-limited`, upstream `provider-error`, or any HTTP 429/5xx), bounded by the number of candidate models. This fallback applies to the bridge path and to the direct `opencode-zen` path; other providers are never sent an unrelated model id. `DIRGEST_MODEL` / `DIRGEST_BRIDGE_MODEL` remain the first model attempted.

```sh
set OPENAI_API_KEY=your-key
set DIRGEST_MODEL=gpt-4.1-mini
dirgest --suggestions
```

Set `DIRGEST_PROVIDER` to explicitly select a ModelHitch provider and `DIRGEST_MODEL` to explicitly select its model; these overrides take precedence over auto-detection. Set `DIRGEST_BRIDGE_URL` or `DIRGEST_BRIDGE_MODEL` to override the local bridge endpoint or its selected model; `DIRGEST_BRIDGE_MODEL` fully overrides the bridge preference list above. The local bridge uses its documented `sk-bridge-local` placeholder credential; dirgest does not print environment values or API keys. `--mock` bypasses all network and API-key requirements and generates deterministic project-aware suggestions, which is useful for local verification.

## What Is Read

Dirgest sends only a bounded sample: at most 24 recognized source/configuration/README files, each no larger than 48 KB, truncated to 12,000 characters total. It ignores `.git`, `node_modules`, common output/cache folders, lockfiles, `.env*` files, large files, and binary files. No suggestions are persisted.

With `--crawl`, the directory layout is also sent and the representative source sample grows to at most 96 files and 36,000 characters. This gives the model a broader project-level view without sending ignored or sensitive files.

Files are sorted by architectural importance before sampling: entry points (`index.js`, `main.ts`, `app.py`) and config files (`package.json`, `tsconfig.json`) are included first, followed by schema/model files, route handlers, core modules, and finally tests and utilities. This ensures the LLM sees the most contextually important files within its character budget.

Before generating suggestions, dirgest extracts a project analysis summary from the scanned files and `package.json`: detected language, framework, project type (fullstack app, CLI tool, library, etc.), entry points, and key dependencies (including Firebase, AWS, and AI/ML packages). This summary is included in the prompt alongside the source sample, giving the model a structured understanding of the project before it reads the code.

If the supplied path is missing or is not a directory, dirgest reports a clear error. A live provider failure, malformed response, or missing default OpenAI key is also reported without exposing secrets.

## Development

```sh
git clone https://github.com/genoventures-labs/dirgest.git
cd dirgest
npm install
npm test
```

The monorepo contains:

- **`packages/sdk`** — `@dirgest/sdk` — the engine (zero dependencies beyond modelhitch)
- **`packages/cli`** — `@dirgest/cli` — terminal interface
- **`packages/api`** — `@dirgest/api` — HTTP API + web UI
- **`packages/web`** — React SPA (bundled into the API package)

## Local Development (Web UI)

One command starts both the API server and the web dev server (with live reload):

```sh
npm run dev
```

- **API** — `http://localhost:3940` (also serves the built SPA at `/`)
- **Web dev server** — `http://localhost:5173` (hot reload, proxies `/api` to the API)

Or run them separately:

```sh
npm run dev:api   # API on :3940
npm run dev:web   # Vite dev server on :5173
```

Upload files to inspect a project, generate suggestions across 5 modes, ask feature questions, and view history — all through the browser.

## API + Web UI (installed)

```sh
npx @dirgest/api
```

Starts the API server on port 3940. Open `http://localhost:3940` for the web interface.
