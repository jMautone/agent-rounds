# Tasks

## 1. Write the baseline specs

- [x] 1.1 Write `team-definition` from `src/core/team.ts` and verify every scenario matches a case in `tests/team.test.ts` or `tests/cli.test.ts`
- [x] 1.2 Write `review-rounds` from `src/core/runner.ts`, `src/core/plan.ts`, `src/core/task.ts` and ADR 0001, and verify each scenario against `tests/runner.test.ts` and `tests/plan.test.ts`
- [x] 1.3 Write `file-contracts` from `src/core/contracts.ts` and ADRs 0002 and 0003, and verify each scenario against `tests/contracts.test.ts` and the contract cases in `tests/runner.test.ts`
- [x] 1.4 Write `run-record` from `src/core/runner.ts`, `src/core/delivery.ts` and `src/agents/mock.ts`, and verify the reproducibility scenario with the `reproducibility` test in `tests/runner.test.ts`
- [x] 1.5 Write `cli` from `src/cli.ts` and `src/output.ts`, and verify the timeout and unknown-agent scenarios by running `npm run dev -- run x --timeout 0` and `--agent nope` (both exit 2)

## 2. Check

- [x] 2.1 Run `openspec validate document-v0-1-behavior --strict` and verify it passes
- [x] 2.2 Run `npm run check` and verify it passes with no source changes

## Workflow follow-up

- Archive in the same PR with `openspec archive document-v0-1-behavior`, so `openspec/specs/` holds the baseline when this merges.
