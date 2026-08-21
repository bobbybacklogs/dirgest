# @dirgest/cli

**Reads your codebase. Tells you what to build next — and hands you the prompt to build it.**

[![npm](https://img.shields.io/npm/v/%40dirgest%2Fcli?logo=npm&color=cb3837)](https://www.npmjs.com/package/@dirgest/cli)
[![node](https://img.shields.io/node/v/%40dirgest%2Fcli?logo=node.js&logoColor=white&color=5fa04e)](https://nodejs.org)

```sh
npx @dirgest/cli --suggest
```

```sh
dirgest --suggest                      # 4-6 balanced ideas
dirgest --suggest growth               # or: ux · technical · wild
dirgest --ask "add a dark mode toggle" # does this idea fit?
dirgest --review roadmap.md            # score a whole feature list
dirgest --suggest --crawl              # widen the context first
dirgest --mock                         # offline, no API key needed
```

Set any supported provider key (`OPENAI_API_KEY`, `GROQ_API_KEY`, …) and dirgest works out the rest.

Full documentation: **[github.com/bobbybacklogs/dirgest](https://github.com/bobbybacklogs/dirgest)**

MIT © Bobby Backlogs
