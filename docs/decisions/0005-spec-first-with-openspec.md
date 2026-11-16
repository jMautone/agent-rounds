# 5. Behavior changes are specified first, with OpenSpec

Date: 2026-11-16 · Status: accepted

## Context

agent-rounds is built mostly by coding agents and reviewed by one person. The code and the tests say what the tool does, but not what it promises: a reviewer cannot tell an intended change in behavior from an accident, and an agent starting a task has to rediscover the rules from the code. The process this tool enforces on agent teams (write first, then review, then deliver) is the same one its own development should follow.

[OpenSpec](https://github.com/Fission-AI/OpenSpec) keeps the current behavior in `openspec/specs/` and puts every change in `openspec/changes/<name>/` as a proposal, delta specs, an optional design and a task list. When the change is done it is archived and its deltas are merged into the specs. Version 2.0.0 (released 11 November 2026) installs its workflow as Agent Skills that Claude Code, Copilot and Codex all read.

## Decision

- Every change to behavior a user or a team author can observe starts as an OpenSpec change, with the default `spec-driven` schema. Bug fixes that restore specified behavior, refactors, tests, docs, dependencies and chores do not need one.
- The specs on `main` describe `main`. A change is archived in the same PR as its implementation, as the last step after `npm run check` and `openspec validate --strict` pass, not in a follow-up PR.
- One change, one branch, one PR, as before. The PR title stays a conventional commit.
- ADRs stay. A change's `design.md` explains how that change is built; an ADR records a choice that outlives the change, and the design links it.
- The CLI is run with `npx @fission-ai/openspec@2` and is not a dev dependency, so the lockfile does not change with OpenSpec releases.
- The generated skills are committed in `.agents/skills/`, with links from `.claude/skills/` for Claude Code. Git on Windows checks out links as plain files by default; `openspec update` replaces them with copies.
- Biome skips `openspec/` and `.agents/skills/`. OpenSpec writes and merges those files in its own markdown format, and reformatting them would fight `openspec archive` and `openspec update`.
- The baseline was written from the v0.1 code, tests and ADRs 0001 to 0003 as the change `document-v0-1-behavior`, archived in `openspec/changes/archive/`.

## Consequences

- A reviewer reads the proposal and the delta specs first, and the code second.
- The archive shows how the tool grew, change by change.
- Small behavior changes cost a few minutes of spec writing. Accepted.
- Specs can drift from code if someone skips the flow. The scenarios mirror the tests, so a test that changes without a spec change is the signal to look for in review.
