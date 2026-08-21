<div align="center">

# dirgest

**Reads your codebase. Tells you what to build next — and hands you the prompt to build it.**

[![@dirgest/cli](https://img.shields.io/npm/v/%40dirgest%2Fcli?logo=npm&label=%40dirgest%2Fcli&color=cb3837)](https://www.npmjs.com/package/@dirgest/cli) [![@dirgest/sdk](https://img.shields.io/npm/v/%40dirgest%2Fsdk?logo=npm&label=%40dirgest%2Fsdk&color=cb3837)](https://www.npmjs.com/package/@dirgest/sdk) [![@dirgest/api](https://img.shields.io/npm/v/%40dirgest%2Fapi?logo=npm&label=%40dirgest%2Fapi&color=cb3837)](https://www.npmjs.com/package/@dirgest/api) [![node](https://img.shields.io/node/v/%40dirgest%2Fcli?logo=node.js&logoColor=white&color=5fa04e)](https://nodejs.org) [![license](https://img.shields.io/npm/l/%40dirgest%2Fcli?color=6e8cff)](LICENSE)

</div>

---

```sh
npx @dirgest/cli --suggest
```

That's it. Dirgest samples your project, works out what it actually is, and returns 4–6 feature ideas. Pick one and it prints a complete coding prompt you can paste straight into your agent.

<br>

## Why

| | |
|---|---|
| **Grounded** | Reads entry points, configs, schemas, and routes first — not a random file dump. |
| **Honest** | Ask it anything and it will tell you when your idea doesn't fit, and what does. |
| **Private** | Bounded sample only. No `.git`, no `node_modules`, no `.env`, no lockfiles, no binaries. |
| **Portable** | One engine (`@dirgest/sdk`) behind a CLI, an HTTP API, and a web UI. |

<br>

## Commands

```sh
dirgest --suggest                      # 4-6 balanced ideas
dirgest --suggest growth               # or: ux · technical · wild
dirgest --ask "add a dark mode toggle" # does this idea fit?
dirgest --review roadmap.md            # score a whole feature list
dirgest --suggest --crawl              # widen the context first
dirgest --history                      # what you've picked before
```

| Flag | Does |
|---|---|
| `-s, --suggest [mode]` | `growth` · `ux` · `technical` · `wild`, or omit for balanced |
| `-a, --ask <question>` | Fit / no-fit verdict, with reasoning and a prompt or an alternative |
| `-r, --review <file>` | Review a `.md` / `.txt` feature list against the codebase |
| `-d, --dir <path>` | Target a different project (defaults to cwd) |
| `--crawl` | Map up to 2,000 files and sample 96 across directories |
| `--mock` | Deterministic offline output — no API key needed |
| `--history` / `--clear-history` | Read or wipe `.dirgest/history.json` |

In a real terminal, suggestions open in an interactive browser — `↑`/`↓` or `j`/`k` to preview, `Enter` or `1`–`6` to pick, `a` for all, `q` to quit. Needs Node 26.4+; older versions fall back to a plain picker automatically.

Selections are remembered in `.dirgest/history.json` and fed back into later prompts, so dirgest stops repeating ground you've already covered.

<br>

## Review a feature list

Got a roadmap doc full of ideas? Point dirgest at it.

```sh
dirgest --review roadmap.md
```

It reads one feature per line or list item, checks each against the whole crawled codebase, and splits the result:

```
Feature review: roadmap.md
4 reviewed  3 good fit  1 not a fit

✗ Not a fit (1)
   1  Ship a physical hardware dongle for offline use
      Dirgest is a Node monorepo with no hardware or firmware surface.
      Better fit: Add an offline cache so previously scanned projects…

✓ Good fits (3)

1. Export Prompts To File
Add an --export flag that writes prompts to a file
Implement an --export flag for @dirgest/cli that writes the selected prompt…
```

Misfits come with the specific reason and a better-fitting alternative. Good fits come as full coding prompts, same style as `--suggest`.

> `.txt` and `.md` only · max 64 KB · max 40 features · headings and list items are read as features, surrounding prose is ignored

<br>

## Web UI

```sh
npx @dirgest/api
```

Opens on [localhost:3940](http://localhost:3940). Drop in a project, then use the same five capabilities from the browser — inspect, suggest, ask, review a list, and history.

<br>

## Configuration

`--mock` needs nothing. For real output, set any supported provider key and dirgest works out the rest.

```sh
export OPENAI_API_KEY=sk-...
dirgest --suggest
```

| Variable | Purpose |
|---|---|
| `DIRGEST_PROVIDER` | Force a ModelHitch provider |
| `DIRGEST_MODEL` | Force a model (tried first) |
| `DIRGEST_BRIDGE_URL` | Local ModelHitch bridge (default `http://127.0.0.1:3939`) |
| `DIRGEST_BRIDGE_MODEL` | Force the bridge model |

<details>
<summary><b>How model selection actually works</b></summary>

<br>

Dirgest pins `modelhitch@0.14.0` and calls it directly via `new ModelHitch().chat()`.

1. **Configured provider first.** Dirgest scans ModelHitch's providers for a configured API-key env var (including fallbacks) and uses the first one it finds.
2. **Avoids the free-tier default.** ModelHitch's demo default `big-pickle` is heavily rate-limited, so an auto-detected `opencode-zen` provider gets `deepseek-v4-flash` instead. Other providers keep their native default (`openai` → `gpt-4o-mini`, `groq` → `llama-3.3-70b-versatile`).
3. **Local bridge fallback.** With no direct credential, dirgest probes `http://127.0.0.1:3939` and, if healthy, picks the first advertised model from `deepseek-v4-flash` → `gpt-5.6-luna` → `gpt-5.4-mini` → `gpt-5.4-nano` → `claude-haiku-4-5` → `gemini-3.5-flash-lite`.
4. **Retry on failure.** Any retryable error (`rate-limited`, upstream `provider-error`, HTTP 429/5xx) rotates to the next candidate model. Explicit overrides stay first in line.

Dirgest never prints env values or API keys.

</details>

<details>
<summary><b>What dirgest reads</b></summary>

<br>

| | Default | `--crawl` |
|---|---|---|
| Files sampled | 24 | 96 |
| Files discovered | — | 2,000 |
| Sample budget | 12,000 chars | 36,000 chars |
| Project tree included | no | yes |

Max 48 KB per file. Always ignored: `.git`, `node_modules`, build and cache output, lockfiles, `.env*`, and binaries.

Files are ranked by architectural importance before sampling, so the model spends its budget on what matters:

```
0  entry points     index.js · main.ts · app.py · server.go
1  config & docs    package.json · tsconfig.json · README.md
2  schemas          schema.* · model.* · migration.*
3  routes           routes/ · handlers/ · controllers/
4  source
5  utilities        lib/ · utils/ · helpers/
6  tests
```

Dirgest also derives a project analysis — language, framework, project type, entry points, and notable dependencies — and sends that alongside the sample so the model understands the project before it reads code. Nothing is persisted except the selections you make.

</details>

<br>

## Development

```sh
git clone https://github.com/bobbybacklogs/dirgest.git
cd dirgest && npm install && npm test
npm run dev        # API on :3940, Vite on :5173
```

| Package | |
|---|---|
| [`@dirgest/sdk`](packages/sdk) | The engine. Scanning, prompting, model fallback. |
| [`@dirgest/cli`](packages/cli) | Terminal client. |
| [`@dirgest/api`](packages/api) | Hono HTTP API, serves the web UI. |
| `@dirgest/web` | React SPA, bundled into the API package. |

> **No client implements dirgest intelligence.** Every client consumes `@dirgest/sdk`. See [ROADMAP.md](ROADMAP.md).

<br>

## License

MIT © [Bobby Backlogs](https://github.com/bobbybacklogs)
