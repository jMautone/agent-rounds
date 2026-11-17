# Design

## Context

Agents are reached only through `AgentAdapter` (`run(task) → { exitCode, costUsd?, error? }`), and the runner already checks every contract by diffing the run folder (ADR 0003). An adapter therefore only has to start a CLI in the run folder, wait for it, and translate the result. Flags were checked against the official docs on 16 November 2026; see ADR 0006 for the links.

## Goals / Non-Goals

**Goals:**
- Run unattended: no step may wait on a permission prompt or a question.
- Keep `src/core/` free of process spawning; all of it lives in `src/agents/`.
- Test without tokens or network.

**Non-Goals:**
- Streaming agent output to the terminal while a step runs.
- Sandboxing beyond what each CLI's permission model offers; the folder diff stays the safety net.

## Decisions

- **Headless flags, file tools only** ([ADR 0006](../../../../docs/decisions/0006-headless-agent-adapters.md)). Claude: `-p … --output-format json --append-system-prompt-file --permission-mode acceptEdits --tools Read,Write,Edit,Glob,Grep --strict-mcp-config --no-session-persistence`. Copilot: `-p … --silent --no-ask-user --no-color --allow-tool=read,write --deny-tool=shell,url`. Alternative: `--dangerously-skip-permissions` / `--allow-all`; rejected because a run folder usually sits inside the user's repository.
- **The prompt goes right after `-p`.** `--tools` and `--allow-tool` take lists; a positional prompt at the end could be swallowed by them. Copilot list flags use the `=` form for the same reason.
- **`spawn`, not `execFile`.** `claude -p` waits for piped stdin to close; `spawn` with stdin set to `ignore` avoids a hang. The helper also applies the timeout (SIGTERM, then SIGKILL after 5 s), caps captured output at 1 MB per stream, and maps ENOENT to a readable error.
- **Verdict on the last line** ([ADR 0002](../../../../docs/decisions/0002-verdict-on-the-last-line.md)), not `--json-schema`: it works the same for both CLIs and for the mock.
- **Unreported cost is shown as unreported**, decided by whether any step has a cost, not by agent name. A `0` would read as "free", which Copilot premium requests are not.
- **Tests use a fake binary** (`tests/fixtures/fake-agent.mjs`) copied onto a temp `PATH` as `claude` and `copilot`. It logs its arguments and writes the files the task lists. Adapters take an optional `env` and `command` so tests do not touch the real `PATH`.

## Risks / Trade-offs

- [Copilot CLI flags change, or the comma form of `--allow-tool` behaves differently than documented] → The flags live in one `args()` method with a unit test; ADR 0006 records the doc version. Copilot was not run for real when this was built.
- [On Windows an npm-installed `.cmd` shim cannot be spawned without a shell] → Documented; `AGENT_ROUNDS_*_BIN` points at a native `.exe`. Fake-binary tests are skipped on Windows.
- [Each CLI still loads its own project instructions from the run folder's parents] → Accepted for now and noted in ADR 0006.
