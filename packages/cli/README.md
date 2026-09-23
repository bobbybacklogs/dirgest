# @dirgest/cli

**Reads your codebase. Tells you what to build next — and hands you the prompt to build it.**

[![npm](https://img.shields.io/npm/v/%40dirgest%2Fcli?logo=npm&color=cb3837)](https://www.npmjs.com/package/@dirgest/cli)
[![node](https://img.shields.io/node/v/%40dirgest%2Fcli?logo=node.js&logoColor=white&color=5fa04e)](https://nodejs.org)

```sh
npx @dirgest/cli --suggest
```

```sh
dirgest --suggest                      # 4-6 balanced ideas
dirgest --suggest growth               # or: ux · technical · wild · ai · ai-wild
dirgest --recommend                    # crawl, then top 10 ideas across every category
dirgest --recommend --count 15         # 5-20 recommendations (default 10)
dirgest --ask "add a dark mode toggle" # does this idea fit? save it if you want to remember
dirgest --review roadmap.md            # score a whole feature list
dirgest --inspect                      # report stack, configs, scripts, and tests
dirgest --suggest --crawl              # widen the context first
dirgest --mock                         # offline, no API key needed
```

When run in an interactive terminal, dirgest checks npm for a newer CLI release. If one is available, it asks before installing the latest version globally and restarting the original command. Use `--no-update`, or set `DIRGEST_SKIP_UPDATE_CHECK=1`, to skip the check.

Set any supported provider key (`OPENAI_API_KEY`, `GROQ_API_KEY`, …) and dirgest works out the rest.

Full documentation: **[github.com/bobbybacklogs/dirgest](https://github.com/bobbybacklogs/dirgest)**

MIT © Bobby Backlogs
