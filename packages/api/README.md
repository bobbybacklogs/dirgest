# @dirgest/api

**HTTP API and web UI for [dirgest](https://github.com/bobbybacklogs/dirgest).**

[![npm](https://img.shields.io/npm/v/%40dirgest%2Fapi?logo=npm&color=cb3837)](https://www.npmjs.com/package/@dirgest/api)
[![node](https://img.shields.io/node/v/%40dirgest%2Fapi?logo=node.js&logoColor=white&color=5fa04e)](https://nodejs.org)

```sh
npx @dirgest/api
```

Serves on [localhost:3940](http://localhost:3940) — the browser UI at `/` and the API under `/api/v1`.

## Endpoints

| | |
|---|---|
| `POST /projects/inspect` | Scan a local directory |
| `POST /projects/inspect/upload` | Build a context from uploaded files |
| `GET /projects/:id` | Fetch a cached context |
| `POST /projects/:id/suggestions` | `{ mode?, mock? }` → 4–6 ideas |
| `POST /projects/:id/ask` | `{ question, mock? }` → fit verdict |
| `POST /projects/:id/review` | `{ content, filename }` or `{ features[] }` → fits and misfits |
| `GET · POST · DELETE /projects/:id/history` | Selection history |
| `POST /projects/:id/inspect/async` · `GET /jobs/:id` | Async scan for large repos |

Every response is enveloped as `{ ok, data | error, meta }`.

## Options

| Variable | Purpose |
|---|---|
| `PORT` | Listen port (default `3940`) |
| `DIRGEST_API_KEYS` | Comma-separated keys; requires `X-API-Key` when set |
| `DIRGEST_RATE_LIMIT_MAX` | Requests per window (default `60`) |
| `DIRGEST_RATE_LIMIT_WINDOW` | Window in ms (default `60000`) |

Rate limited to 60 requests per 60s window by default. Provider configuration matches the CLI — set `OPENAI_API_KEY` or any supported provider key.

Full documentation: **[github.com/bobbybacklogs/dirgest](https://github.com/bobbybacklogs/dirgest)**

MIT © Bobby Backlogs
