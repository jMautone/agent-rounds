# AGENTS.md

Instructions for coding agents working on **agent-rounds**.

## What this repo is

agent-rounds runs a team of coding agents defined in `team.yaml`. The process (order, review rounds, file contracts) is plain TypeScript; the content comes from the agents. See `README.md` for the user view and `docs/decisions/` for why things are the way they are.

## Commands

| Task                                 | Command                                                                |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Install                              | `npm ci`                                                               |
| Build                                | `npm run build`                                                        |
| Test                                 | `npm test`                                                             |
| Lint, format check and types         | `npm run lint`                                                         |
| Fix formatting                       | `npm run format`                                                       |
| Everything before a PR               | `npm run check`                                                        |
| Try the CLI from source              | `npm run dev -- run "<request>" --team examples/design-team/team.yaml` |
| Regenerate the versioned example run | `npm run example`                                                      |

## Layout

```text
src/
├── core/            ← all logic; no process spawning, no console output
│   ├── team.ts      ← team.yaml schema (zod) and validation with line numbers
│   ├── plan.ts      ← segments (author + optional critic) and {round} paths
│   ├── contracts.ts ← folder snapshot, the three contracts, verdict parsing
│   ├── task.ts      ← the instructions every role receives
│   ├── runner.ts    ← runs the plan, writes 00-request.md, run.json, 90-delivery.md
│   └── delivery.ts  ← 90-delivery.md from a fixed template
├── agents/
│   ├── types.ts     ← AgentAdapter interface
│   ├── mock.ts      ← deterministic agent for tests and demos
│   ├── claude.ts    ← claude -p (headless Claude Code)
│   ├── copilot.ts   ← copilot -p (GitHub Copilot CLI)
│   └── process.ts   ← spawn with an argument array, stdin closed, timeout
├── output.ts        ← terminal lines and summary
└── cli.ts           ← argument parsing only
```

## Code rules

- TypeScript strict, ESM, Node 22+. Formatting and lint by Biome.
- `src/core/` never spawns processes or prints. Agents are reached only through `AgentAdapter`.
- `src/cli.ts` only parses arguments and wires things together.
- Paths in `team.yaml` and in the run folder are relative and use `/`. Convert with `node:path` when touching the disk; never hard-code a separator. CI runs on Windows, macOS and Linux.
- Every path from `team.yaml` is validated to stay inside its base folder before it is used.
- Spawn agent CLIs with `execFile` or `spawn` and an argument array, never through a shell string, and always with a timeout.
- The mock agent and `90-delivery.md` must stay deterministic: no clock, no randomness, no absolute paths in their output. The reproducibility test compares a fresh mock run with `examples/design-team/runs/` byte for byte. If you change their output on purpose, run `npm run example` and commit the result.
- Adapter tests never call a real agent: they put `tests/fixtures/fake-agent.mjs` on `PATH` as `claude` or `copilot` (see `fakeAgentBin` in `tests/helpers.ts`).
- Tests live in `tests/` and use vitest. Tests that need a team copy `examples/design-team` into a temp dir; they never write to the original.
- No real company data anywhere. Examples use the fictional store "Mate & Co.".

## Changes

- One change, one branch, one PR. Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Update `CHANGELOG.md` under "Unreleased" for anything a user would notice.
- Add a short ADR to `docs/decisions/` when a change makes a choice someone could reasonably question later.
