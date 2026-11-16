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
