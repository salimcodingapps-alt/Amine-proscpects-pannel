# Claude Build Workflow

Mandatory process rules for building this project with Claude Code. These supplement the master spec's "Analyze → Plan → Build" and block-by-block rules.

---

## Block-by-block rules (from the master spec)

- **Analyze first. Plan second. Build third.** Never receive the full brief and start coding everything.
- Build **one block at a time**. For each block: explain the goal, list files to change, note DB changes, implement only that block, test it, summarize, then **stop and wait for approval**.
- Do not start the next block automatically.
- Do not overbuild, do not touch unrelated/working code, do not prioritize UI polish over the data workflow.
- Never let AI modify many records without confirmation; never auto-delete duplicates; never trust AI output without validation.
- After every stable block, recommend a git checkpoint.

---

## 100k smart-zone reset protocol

Context quality degrades as the window fills. Treat **~100k tokens** as the practical reset point for coding work. Check with `/context`.

| Token range | Allowed behavior |
|---|---|
| **0–60k** | Normal work. |
| **60k–80k** | Continue the current task only; don't start new sub-tasks. |
| **80k–100k** | Prepare handoff soon; wind down. |
| **100k+** | **Stop starting new implementation work.** Finish only what's trivially in-flight, then handoff. |
| **150k+** | **Emergency handoff-only mode.** No coding. Only write/refresh `docs/NEXT_HANDOFF.md`. |

### Rules
- Claude should **avoid implementation work past 100k tokens**.
- Before clearing context, Claude **prepares `docs/NEXT_HANDOFF.md`** capturing full project state.
- **Prefer `/clear` after a written handoff.** The handoff file (on disk) survives `/clear`.
- Use **`/compact` only** if mid-task and unable to safely stop — `/clear` + handoff is preferred.
- **After `/clear`,** Claude must first read: `CLAUDE.md` (+ `AGENTS.md`), `docs/NEXT_HANDOFF.md`, and the current block document.
- After reading, Claude **summarizes the state and waits for confirmation before coding.**

---

## Project-specific environment notes

- **Windows.** Run `node`/`npm`/`npx`/`git` via PowerShell, prepending `$env:ProgramFiles\nodejs` and `$env:ProgramFiles\Git\cmd` (they are not on the Bash tool's PATH).
- **Next.js 16** — read the bundled docs in `node_modules/next/dist/docs/` before relying on framework APIs; APIs differ from older knowledge.
- **shadcn CLI** doesn't detect Next 16 yet → add UI components manually (shadcn-style files).
- Stop any background `next dev` before relaunching (Next 16 refuses a second instance).
