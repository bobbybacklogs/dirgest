# @dirgest/sdk

**The engine behind [dirgest](https://github.com/bobbybacklogs/dirgest).** Scans a project, builds a bounded context, and turns it into actionable feature prompts.

[![npm](https://img.shields.io/npm/v/%40dirgest%2Fsdk?logo=npm&color=cb3837)](https://www.npmjs.com/package/@dirgest/sdk)
[![node](https://img.shields.io/node/v/%40dirgest%2Fsdk?logo=node.js&logoColor=white&color=5fa04e)](https://nodejs.org)

```sh
npm install @dirgest/sdk
```

```js
import { inspectProject, getSuggestions, getAskResponse, reviewFeatures, readFeatureFile } from '@dirgest/sdk';

const project = await inspectProject('./my-app', { crawl: true });

// 4-6 ideas, each with a full coding prompt
const ideas = await getSuggestions(project, { mode: 'growth' });

// fit / no-fit verdict for a single idea
const verdict = await getAskResponse(project, 'add a dark mode toggle');

// score a whole .md / .txt feature list
const { features } = await readFeatureFile('./roadmap.md');
const { fits, misfits } = await reviewFeatures(project, features);
```

Pass `{ mock: true }` to any of these for deterministic offline output — no network, no API key.

## API

| | |
|---|---|
| `inspectProject(dir, opts)` | Build a `ProjectContext` from disk |
| `buildProjectContext(dir, files, meta, opts)` | Build one from pre-loaded files |
| `getSuggestions(project, opts)` | 4–6 titled ideas with coding prompts |
| `getAskResponse(project, question, opts)` | Fit verdict, reasoning, prompt or alternative |
| `reviewFeatures(project, features, opts)` | Split a feature list into fits and misfits |
| `readFeatureFile(path)` | Read and parse a `.md` / `.txt` feature list |
| `readHistory` · `writeHistory` · `clearHistory` | Selection feedback loop |

Types are documented as JSDoc in [`lib/types.js`](lib/types.js).

Full documentation: **[github.com/bobbybacklogs/dirgest](https://github.com/bobbybacklogs/dirgest)**

MIT © Bobby Backlogs
