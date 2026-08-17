# dirgest

`dirgest` inspects a small, privacy-conscious sample of a local project and turns it into 4-6 practical feature ideas. Pick an idea to print a complete coding prompt, or print every prompt at once.

## Install

Requires Node.js 18 or later.

```sh
npm install
npm link
```

`npm link` exposes the executable as `dirgest` locally. Without linking, run it with `node ./bin/dirgest.js`.

## Use

```sh
dirgest --suggestions
dirgest --dir "C:\\path\\to\\project" --suggest
dirgest --suggest growth
dirgest --suggest ux
dirgest --suggest technical
dirgest --suggest wild
dirgest -d . -s --mock
dirgest --help
```

The result header shows the detected project name and scanned directory. In an interactive terminal, enter `1` through `6` to view one full prompt, `a` to print all prompts, or `q` to leave. With redirected/non-interactive input, dirgest prints the suggestion list and exits without waiting for input.

`--suggest` (and the legacy `--suggestions`) produces balanced, product-next ideas. Add `growth` for activation, retention, and monetization ideas; `ux` for friction and experience improvements; `technical` for architecture, debt, and reliability work; or `wild` for novel adjacent capabilities grounded in the current project.

## Model Configuration

`modelhitch` is pinned to `0.14.0` and is used through its direct `new ModelHitch().chat()` API. Before applying dirgest defaults, dirgest checks ModelHitch's built-in providers for their configured API-key environment variables (including provider fallbacks) and uses the first configured provider with its native default model. This lets an existing ModelHitch BYOK setup work without duplicating it in `DIRGEST_*` variables. If no direct credential is present, dirgest also detects a healthy local ModelHitch bridge at `http://127.0.0.1:3939`, selects an advertised model, and routes through it. If neither is available, dirgest falls back to ModelHitch's `openai` provider and `gpt-4o-mini`.

```sh
set OPENAI_API_KEY=your-key
set DIRGEST_MODEL=gpt-4.1-mini
dirgest --suggestions
```

Set `DIRGEST_PROVIDER` to explicitly select a ModelHitch provider and `DIRGEST_MODEL` to explicitly select its model; these overrides take precedence over auto-detection. Set `DIRGEST_BRIDGE_URL` or `DIRGEST_BRIDGE_MODEL` to override the local bridge endpoint or its selected model. The local bridge uses its documented `sk-bridge-local` placeholder credential; dirgest does not print environment values or API keys. `--mock` bypasses all network and API-key requirements and generates deterministic project-aware suggestions, which is useful for local verification.

## What Is Read

Dirgest sends only a bounded sample: at most 24 recognized source/configuration/README files, each no larger than 48 KB, truncated to 12,000 characters total. It ignores `.git`, `node_modules`, common output/cache folders, lockfiles, `.env*` files, large files, and binary files. No suggestions are persisted.

If the supplied path is missing or is not a directory, dirgest reports a clear error. A live provider failure, malformed response, or missing default OpenAI key is also reported without exposing secrets.

## Development

```sh
npm test
node ./bin/dirgest.js --suggestions --mock --dir .
```
