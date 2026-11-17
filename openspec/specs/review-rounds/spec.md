# review-rounds Specification

## Purpose
The order roles run in and the author and critic loop. The process is code, so no model can skip a role or a review round.

## Requirements

### Requirement: Roles run in file order
The runner SHALL run roles one at a time, in the order they appear in `team.yaml`. A role and the critic right below it form one segment; the next segment starts only when the current one has finished. No model SHALL decide the order, skip a role or add a step.

#### Scenario: Example team
- **WHEN** the example design team runs with the mock agent
- **THEN** the steps are research, spec, ux-critic-spec round 1, spec round 2, ux-critic-spec round 2, prototype, ux-critic-prototype round 1, prototype round 2, ux-critic-prototype round 2, design-system

### Requirement: Every step is told what to read and write
Every step SHALL receive the role's prompt file as its system prompt and a task that quotes the request, lists the role's `reads`, and lists the exact paths it must write in this round, with `{round}` replaced by the round number. The task SHALL say that any other file must not be created, changed or deleted.

#### Scenario: Round placeholder filled in
- **WHEN** `ux-critic-spec` runs in round 1
- **THEN** its task says it must write `30-spec-critique-1.md`

### Requirement: Critics and second-round authors get extra instructions
A critic's task SHALL also list the author's files under review and ask for a last line of exactly `APPROVED` or `CHANGES`. An author's task in round 2 or later SHALL name the critique to address.

#### Scenario: Critic inputs
- **WHEN** `ux-critic-spec` runs in round 1
- **THEN** it is asked to review `20-spec.md` and to end with `APPROVED` or `CHANGES`

#### Scenario: Author redo inputs
- **WHEN** `spec` runs in round 2
- **THEN** its task names `30-spec-critique-1.md` as the critique to address

### Requirement: Review loop until approved or out of rounds
After an author step, its critic SHALL review. On `APPROVED` the segment ends. On `CHANGES` the author SHALL run again with the critique, and the critic SHALL review again, until the critic approves or has reviewed `max_rounds` times.

#### Scenario: Approved at once
- **WHEN** a critic answers `APPROVED` in round 1
- **THEN** the author does not run again and the review is recorded with 1 round

#### Scenario: One round of changes
- **WHEN** a critic with `max_rounds: 2` answers `CHANGES` and then `APPROVED`
- **THEN** the author runs twice, the critic runs twice, and the final verdict is `APPROVED`

### Requirement: Out of rounds means continue with observations
When a critic still answers `CHANGES` in its last allowed round, the runner SHALL NOT run the author again, SHALL mark that review "with observations", and SHALL continue with the next segment. A run with at least one such review and no failure SHALL finish as completed with observations.

#### Scenario: Rounds run out
- **WHEN** a critic answers `CHANGES` in every round up to `max_rounds`
- **THEN** the next role still runs, the review is marked with observations, and the run status is `completed_with_observations`

### Requirement: Stop at the first failed step
A step SHALL fail when the agent reports a non-zero exit, when the agent cannot be run at all, or when any file contract is broken. The runner SHALL stop at the first failed step and run nothing after it, because later roles would build on wrong inputs. The run status SHALL be `failed`.

#### Scenario: Agent process fails
- **WHEN** the agent for `spec` exits with an error
- **THEN** no later step runs and the run status is `failed`, with the agent's error recorded on that step

#### Scenario: Broken contract
- **WHEN** a step breaks a file contract
- **THEN** no later step runs and the run status is `failed`

### Requirement: Each step has a time limit
Every step SHALL be given a timeout, 15 minutes by default, which the agent adapter enforces.

#### Scenario: Default timeout
- **WHEN** a run starts without a timeout option
- **THEN** each step is handed a 15-minute limit
