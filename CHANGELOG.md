# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- `team.yaml` schema with roles, `reads`, `writes`, `critic_of` and `max_rounds`, validated with line numbers.
- Runner that executes roles in order, loops author and critic until `APPROVED` or `max_rounds`, and continues "with observations" when rounds run out.
- Three contracts checked after every step: declared writes exist and are not empty, a role touches only its own writes, and a critique ends in `APPROVED` or `CHANGES`.
- `run.json` with steps, verdicts, durations and cost, and `90-delivery.md` from a fixed template.
- Deterministic `mock` agent and a versioned example run.
- `agent-rounds run` and `agent-rounds validate` commands.
- `--agent claude` runs each step with Claude Code in headless mode (`claude -p --output-format json`), with the role prompt appended to the system prompt, file tools only, and the cost of each step recorded.
- `--agent copilot` runs each step with GitHub Copilot CLI (`copilot -p --silent --no-ask-user`), allowing only file reads and writes. Copilot does not report cost, so the summary and `90-delivery.md` say "not reported".
- `AGENT_ROUNDS_CLAUDE_BIN` and `AGENT_ROUNDS_COPILOT_BIN` point at a binary that is not on `PATH` under its usual name.
