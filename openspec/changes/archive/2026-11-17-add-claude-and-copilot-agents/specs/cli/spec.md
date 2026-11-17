## MODIFIED Requirements

### Requirement: run command
`agent-rounds run "<request>"` SHALL load the team, run it and write the run folder. Options: `--team` (default `team.yaml`), `--agent` (`mock`, `claude` or `copilot`; default `mock`), `--runs-dir` (default `runs`) and `--timeout` in minutes per step (default 15, any positive number).

#### Scenario: Mock run from the example team
- **WHEN** the user runs `agent-rounds run "Design a sign-up screen for Mate & Co."` in a copy of the example team
- **THEN** the command exits 0 and creates one folder under `runs/`

#### Scenario: Invalid timeout
- **WHEN** the user passes `--timeout 0` or `--timeout abc`
- **THEN** the command exits 2 with `must be a positive number.`

#### Scenario: Unknown agent
- **WHEN** the user passes `--agent codex`
- **THEN** the command exits 2 with `unknown agent "codex". Available: mock, claude, copilot.`

#### Scenario: Real agent
- **WHEN** the user passes `--agent claude` or `--agent copilot` and the CLI is installed
- **THEN** the run starts and the first line names the agent, for example `agent-rounds · team design · agent claude`

### Requirement: Progress and summary lines
While running, the CLI SHALL print the run folder, one line per finished step (with the round from round 2 on, the verdict for critics, and indented details for a failure), and a warning when a review runs out of rounds. At the end it SHALL print a summary with the number of roles, steps, review rounds, broken contracts and the total cost, followed by the path of `90-delivery.md`. When no step reported a cost, the cost part SHALL read `cost not reported (<agent>)` instead of an amount.

#### Scenario: Step and summary lines
- **WHEN** the example team runs with the mock agent
- **THEN** the output includes `✓ ux-critic-spec round 1 → CHANGES`, `✓ ux-critic-spec round 2 → APPROVED` and `✓ done: 6 roles · 10 steps · 4 review rounds · 0 broken contracts · US$ 0.00 (mock)`

#### Scenario: Cost not reported
- **WHEN** the example team runs with `--agent copilot`
- **THEN** the summary line contains `cost not reported (copilot)`
