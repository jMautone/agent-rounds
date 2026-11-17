# Tasks

## 1. Process helper

- [x] 1.1 Add `src/agents/process.ts` that spawns with an argument array, stdin closed, a timeout and a readable error for a missing binary, and verify the timeout and missing-binary tests in `tests/agents.test.ts` pass

## 2. Claude adapter

- [x] 2.1 Add `src/agents/claude.ts` with the headless flags from design.md and JSON parsing of `is_error`, `result` and `total_cost_usd`, and verify the argument test and the full fake run in `tests/agents.test.ts` pass
- [x] 2.2 Verify the flags against a real `claude -p` call in a temp folder: it exits 0 and prints a JSON result with `total_cost_usd`

## 3. Copilot adapter

- [x] 3.1 Add `src/agents/copilot.ts` with the programmatic flags from design.md and the role prompt prepended, and verify the argument test and the full fake run in `tests/agents.test.ts` pass

## 4. CLI, summary and delivery

- [x] 4.1 Register `claude` and `copilot` in `src/cli.ts` and drop the "not in this build yet" error, and verify the unknown-agent and fake-binary tests in `tests/cli.test.ts` pass
- [x] 4.2 Show an unreported cost as `cost not reported (<agent>)` in the summary and `**Cost:** not reported by the agent` in `90-delivery.md`, and verify the mock example run is unchanged with the reproducibility test
- [x] 4.3 Document the agents in README (Agents section and roadmap), AGENTS.md (layout, fake-binary rule), CHANGELOG under Unreleased, and ADR 0006, and verify `npm run check` passes

## 5. Check

- [x] 5.1 Run `npx @fission-ai/openspec@2 validate add-claude-and-copilot-agents --strict` and verify it passes

## Workflow follow-up

- Archive in the same PR with `npx @fission-ai/openspec@2 archive add-claude-and-copilot-agents --yes`, then run `npx @fission-ai/openspec@2 validate --all --strict`.
