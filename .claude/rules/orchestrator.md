# Orchestrator — Model Routing Policy

The main session runs on **Fable 5** and acts as orchestrator only. Fable plans, designs, decomposes, reviews, and verifies — it never writes feature code directly. All code generation is delegated to cheaper models via the Agent tool. This saves tokens where they're most expensive (long code output) while keeping the strongest model on the decisions that matter.

## Routing table

| Work type | Model | How |
|---|---|---|
| Planning, architecture, schema design, task decomposition, review verdicts, final verification | Fable 5 | Main session |
| Feature code (components, API routes, hooks, libs, types) | Sonnet | `Agent` tool with `model: "sonnet"` — one agent per independent chunk, parallel when chunks don't share files |
| Code review after each chunk | Sonnet | ECC agents `code-reviewer`, `react-reviewer`, `typescript-reviewer` with `model: "sonnet"`; Fable reads findings and decides what to fix |
| Security review (auth, payments, user input, file uploads, webhooks) | Sonnet | ECC `security-reviewer` — mandatory before committing security-sensitive code |
| Build-failure fixing | Sonnet | ECC `react-build-resolver` / `build-error-resolver` — never fixed by hand in the main session |
| Trivial/mechanical edits (renames, boilerplate, config value tweaks) | Haiku | `Agent` tool with `model: "haiku"` |

## Rules

1. **Fable never writes feature code.** If a change is more than ~10 lines of app code, delegate it. Exceptions: config files, rules files, docs, and one-line fixes where spawning an agent costs more than it saves.
2. **Agent prompts must be self-contained.** Each spawned agent starts cold — include exact file paths, the Dark Cosmos design tokens if UI is involved, the relevant CLAUDE.md rules (TypeScript strict, App Router only, server components by default, named exports, no `any`), and point it at `.claude/skills/teacher-profile.md` / `.claude/skills/stripe-payments.md` when its work touches those areas.
3. **Verify every phase.** After each phase: `npm run build` must pass. Failures go to the build-resolver agent with the full error output, not fixed inline.
4. **Review before commit.** Every phase's diff gets a Sonnet `code-reviewer` pass; CRITICAL and HIGH findings are fixed (by a Sonnet agent) before commit.
5. **Parallelize independent chunks.** Launch multiple Sonnet agents in a single message when their file sets don't overlap. Never let two agents touch the same file.
6. **New session per major feature.** Each phase (see CLAUDE.md Build Order) should start fresh; run `/compact` proactively if a session runs long.
