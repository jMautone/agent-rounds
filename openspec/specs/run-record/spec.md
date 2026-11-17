# run-record Specification

## Purpose
What a run leaves on disk: a folder anyone can audit and replay, with the request, every role's files, a step log and a delivery summary.

## Requirements

### Requirement: One new folder per run
Every run SHALL get a new folder inside the runs folder, named `<YYYY-MM-DD>-<HHMMSS>-<slug>` in UTC, where the slug comes from the request: accents removed, lowercase, runs of other characters turned into `-`, and cut at a word boundary to at most 40 characters (`run` when nothing is left). An existing folder SHALL never be reused; a numeric suffix (`-2`, `-3`, …) SHALL be added instead. Agents run with this folder as their working directory.

#### Scenario: Folder name
- **WHEN** the request is `Design a sign-up screen for Mate & Co.`
- **THEN** the folder name matches `<date>-<time>-design-a-sign-up-screen-for-mate-co`

#### Scenario: Name taken
- **WHEN** a folder with the same name already exists
- **THEN** the run uses the same name with `-2` appended

### Requirement: The request is recorded first
The runner SHALL reject an empty or blank request before creating anything. Otherwise it SHALL write the trimmed request to `00-request.md` before the first step.

#### Scenario: Empty request
- **WHEN** the request is only spaces
- **THEN** the run fails with `the request is empty` and no run folder is created

### Requirement: run.json summarizes the run
When the run ends, successful or not, the runner SHALL write `run.json` with format version 1, the team, agent, request, status (`completed`, `completed_with_observations` or `failed`), start and finish times, duration, total cost in US dollars, the role ids, one entry per step and one entry per review. The run folder's absolute path SHALL NOT be stored.

#### Scenario: Failed run still logged
- **WHEN** a step breaks a contract
- **THEN** `run.json` is still written, with status `failed` and the violation on that step

### Requirement: run.json records every step
Each step entry SHALL hold its index, role, kind (`author` or `critic`), round, status, verdict, the files it had to write, the files it actually created or changed, its contract violations, the agent error if any, its duration, and its cost when the agent reports one.

#### Scenario: Cost and durations
- **WHEN** a run with the mock agent finishes
- **THEN** every step in `run.json` has a duration and the total cost is 0

### Requirement: 90-delivery.md from a fixed template
When the run ends, the runner SHALL write `90-delivery.md` from a fixed template with no LLM: the request, the status, the agent, the cost, a table of steps, a table of reviews, open observations (when any review ran out of rounds), what broke (when any step failed), and links to every file. It SHALL NOT contain dates, durations or absolute paths, so the same run renders the same bytes.

#### Scenario: Delivery after observations
- **WHEN** a review ends with observations
- **THEN** the delivery shows the status "Completed with observations" and lists that review under "Open observations" with a link to the last critique

### Requirement: Mock runs are reproducible
The `mock` agent SHALL produce the same files for the same task every time, without reading the clock, the run folder name or any randomness. By default each mock critic SHALL answer `CHANGES` in round 1 and `APPROVED` in round 2. A fresh mock run of the example team SHALL match the versioned run in `examples/design-team/runs/` byte for byte, except timings in `run.json`.

#### Scenario: Example run matches
- **WHEN** the example team runs with the mock agent on the example request
- **THEN** every file matches `examples/design-team/runs/2026-11-14-onboarding-mate-and-co/`, ignoring times and durations in `run.json`
