# Proposal

## Why

agent-rounds only ships the deterministic `mock` agent, so a team cannot produce real work: `--agent claude` stops with "not in this build yet". Claude Code and GitHub Copilot CLI both have a non-interactive mode with permission controls good enough to run a role unattended, which is what the runner needs.

## What Changes

- `--agent claude` runs each step with Claude Code in headless mode (`claude -p`), reads the step's cost from its JSON result, and limits it to file tools.
- `--agent copilot` runs each step with GitHub Copilot CLI in programmatic mode (`copilot -p`), allowing only file reads and writes and denying shell and URL access.
- Both run in the run folder, never through a shell, with the per-step timeout, and fail the step with a readable reason when the CLI fails, times out or is not installed.
- `AGENT_ROUNDS_CLAUDE_BIN` and `AGENT_ROUNDS_COPILOT_BIN` select a binary that is not on `PATH` under its usual name.
- When no step reports a cost, the summary line and `90-delivery.md` say the cost was not reported instead of printing `US$ 0.00`.
- The verdict stays on the last line of the critique file (ADR 0002), so both agents follow the same contracts as the mock.

Out of scope:

- A Codex adapter, and a different agent per role. Both stay on the roadmap.
- Per-role tool lists in `team.yaml` (letting a role run shell commands or tests).
- Turning off each CLI's own project instructions (`CLAUDE.md`, `AGENTS.md`) for fully isolated roles.
- Running agent CLIs installed as npm `.cmd` shims on Windows; a native `.exe` is required there.

ADR: yes, ADR 0006 "Real agents run headless, with file tools only". The flags and the refusal to use "skip all permissions" modes are a choice someone could reasonably question later, and they outlive this change.

## Capabilities

### New Capabilities

- `agent-adapters`: which agents `--agent` can run, how each real agent CLI is started for a step, what it is allowed to do, how it receives the role prompt, and how failures, timeouts and cost are reported.

### Modified Capabilities

- `cli`: `run --agent` accepts `claude` and `copilot`, and the summary line says when the cost was not reported.
- `run-record`: `90-delivery.md` says the cost was not reported when no step reported one.

## Impact

- New code in `src/agents/` (one adapter per CLI and a shared process helper); `src/cli.ts` registers them; `src/output.ts` and `src/core/delivery.ts` handle an unreported cost.
- Tests use a fake binary on `PATH` and spend no tokens; they are skipped on Windows.
- No new dependencies. Mock output and the versioned example run do not change.
- README (Agents section, roadmap), CHANGELOG, AGENTS.md layout and ADR 0006.
