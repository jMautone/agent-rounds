# 2. The verdict is the last line of the critique

Date: 2026-11-14 · Status: accepted

## Context

The runner needs a machine-readable verdict from each critic. Options: a JSON schema enforced by the agent CLI (`claude -p --json-schema`), a separate verdict file, or a convention inside the critique.

## Decision

The last non-blank line of the critique file must be exactly `APPROVED` or `CHANGES` (surrounding spaces and trailing blank lines are ignored). Anything else, including `**APPROVED**` or lowercase, breaks the `verdict-line` contract.

The words are English because all of the tool's interface is English. They are not configurable in v0.1.

## Consequences

- Works with any agent CLI that can write a file, and a human can read the verdict at a glance.
- Being strict means a sloppy critic fails loudly instead of being guessed at.
