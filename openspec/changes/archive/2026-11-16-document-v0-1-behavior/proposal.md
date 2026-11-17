# Proposal

## Why

agent-rounds now builds every behavior change spec-first with OpenSpec (ADR 0005), but the code that already exists has no specs. Without a baseline, the first real change would have nothing to write deltas against, and reviewers could not tell what the tool promises today.

## What Changes

- Document the behavior that is already on `main` as five capabilities, one spec each, written from the code, the tests and ADRs 0001 to 0003.
- No code changes. Every requirement describes what the current build does; where the code and the README disagree, the code wins.

Out of scope:

- Agent adapters other than the mock (`claude`, Copilot, Codex). They are being built in their own changes and will add their own capability.
- The planned v0.1.0 items (`agent-rounds init`, npm release) and anything on the roadmap.
- Internal APIs (`AgentAdapter`, module layout). Specs describe what users and team authors observe.

ADR: no new ADR for this change. The decision to adopt OpenSpec is ADR 0005, added in the same PR.

## Capabilities

### New Capabilities

- `team-definition`: the `team.yaml` format, its defaults and every validation error, with file, line and column.
- `review-rounds`: the order roles run in, the author and critic loop, `max_rounds`, "with observations", and when a run stops.
- `file-contracts`: the three checks after every step (`writes-exist`, `writes-only-own-files`, `verdict-line`) and what they ignore.
- `run-record`: the run folder, `00-request.md`, `run.json`, `90-delivery.md`, and the reproducible mock run.
- `cli`: the `run` and `validate` commands, their options, terminal output and exit codes.

### Modified Capabilities

None. There are no specs yet.

## Impact

- New files under `openspec/specs/` once this change is archived. No source, test or dependency changes.
