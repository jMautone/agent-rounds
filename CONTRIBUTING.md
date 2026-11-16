# Contributing

Thanks for helping. agent-rounds is small on purpose, so the process is short.

## Setup

```bash
npm ci
npm run check   # lint, types, tests and build
```

Node 22 or later. [AGENTS.md](AGENTS.md) has the full command list and the code rules; they apply to people too.

## Specs first, with OpenSpec

What the tool promises lives in [`openspec/specs/`](openspec/specs/), one folder per capability: `team-definition`, `review-rounds`, `file-contracts`, `run-record` and `cli`. Any change to behavior a user or a team author can see starts as an [OpenSpec](https://github.com/Fission-AI/OpenSpec) change. Why: [ADR 0005](docs/decisions/0005-spec-first-with-openspec.md).

| Your change                                                                  | OpenSpec change? |
| ---------------------------------------------------------------------------- | ---------------- |
| New or different behavior: CLI, `team.yaml`, contracts, run folder, adapters | Yes              |
| Bug fix that makes the code match the spec                                   | No               |
| Refactor, tests, docs, dependencies, CI                                      | No               |

The flow, with the skills that `openspec init` installed in this repo (Claude Code, Copilot and Codex read them; other tools can follow the same steps with the CLI):

1. **Propose.** `/openspec-propose <what you want>` writes `openspec/changes/<name>/` with `proposal.md`, delta specs, an optional `design.md` and `tasks.md`. Not sure yet? Start with `/openspec-explore`.
2. **Review the plan.** Read the proposal and the delta specs before any code. Fix them with `/openspec-update-change`.
3. **Apply.** `/openspec-apply-change <name>` implements the tasks and ticks them as each one passes its check.
4. **Check.**

   ```bash
   npm run check
   npx @fission-ai/openspec@2 validate <name> --strict
   ```

5. **Archive in the same PR.** `/openspec-archive-change <name>` (or `npx @fission-ai/openspec@2 archive <name> --yes`) merges the deltas into `openspec/specs/` and moves the change to `openspec/changes/archive/`. Then `npx @fission-ai/openspec@2 validate --all --strict` must pass.

One change, one branch, one PR, with a conventional commit title (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Update `CHANGELOG.md` under "Unreleased" for anything a user would notice. Add an ADR in [`docs/decisions/`](docs/decisions/) when the change makes a choice someone could reasonably question later.

On Windows, if `.claude/skills/` shows small files instead of folders, run `npx @fission-ai/openspec@2 update` once: Git checked the links out as plain files and OpenSpec replaces them with copies.

## Data

No real company data anywhere. Examples use the fictional store "Mate & Co.".
