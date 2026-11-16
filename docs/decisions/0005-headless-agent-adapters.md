# 5. Real agents run headless, with file tools only

Date: 2026-11-16 · Status: accepted

## Context

v0.1 shipped only the `mock` agent. The `claude` and `copilot` adapters run real agent CLIs for every step, unattended, inside a run folder that usually sits in the user's repository. Each CLI has its own non-interactive mode and permission model, and both change often. Flags below were checked on 16 November 2026 against:

- Claude Code: [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) and the [CLI reference](https://code.claude.com/docs/en/cli-reference).
- GitHub Copilot CLI: [CLI programmatic reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-programmatic-reference) and the [command reference](https://docs.github.com/en/copilot/reference/cli-command-reference).

## Decision

Both adapters give the agent file tools and nothing else, and never use a "skip all permissions" flag (`--dangerously-skip-permissions`, `--allow-all`, `--yolo`).

- **claude**: `claude -p <task> --output-format json --append-system-prompt-file <role> --permission-mode acceptEdits --tools Read,Write,Edit,Glob,Grep --strict-mcp-config --no-session-persistence`. `acceptEdits` approves edits inside the working directory; anything else that would prompt is denied, because a `-p` run has nobody to answer. The role prompt is appended, not a replacement, so Claude keeps its own tool guidance. The JSON result gives `is_error` and `total_cost_usd`.
- **copilot**: `copilot -p <role + task> --silent --no-ask-user --no-color --allow-tool=read,write --deny-tool=shell,url`. Deny rules win over allow rules, and path checks stay on (no `--allow-all-paths`). Copilot CLI has no system prompt flag, so the role prompt goes first in the prompt text. It reports no cost, so steps record `costUsd: null` and the delivery says "not reported".
- Agents are spawned with an argument array and stdin closed, never through a shell, and are killed at the step timeout.
- The verdict stays on the last line of the critique file ([ADR 2](0002-verdict-on-the-last-line.md)), not in `--json-schema`, so both agents follow the same contract.

## Consequences

- A role cannot run commands, tests or package installs. Teams that need that would need a per-role tool list in `team.yaml`, which is a later, explicit choice.
- Project instructions (`CLAUDE.md`, `AGENTS.md`) found from the run folder are still loaded by each CLI, as in a normal session. Turning that off (`--bare`, `--no-custom-instructions`) is left for when a team needs fully isolated roles.
- On Windows the binary must be an `.exe`: an npm `.cmd` shim cannot be spawned without a shell. `AGENT_ROUNDS_CLAUDE_BIN` and `AGENT_ROUNDS_COPILOT_BIN` point at another binary.
- Tests use a fake binary on `PATH` (`tests/fixtures/fake-agent.mjs`), so they spend no tokens and do not run on Windows.
