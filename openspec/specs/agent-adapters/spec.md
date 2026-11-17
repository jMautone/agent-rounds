# agent-adapters Specification

## Purpose
Defines the agents a team can run with, how agent-rounds starts a real agent CLI for each step, what that agent may do, and how its failures, timeouts and cost reach the run record.

## Requirements

### Requirement: Available agents
`agent-rounds run --agent <name>` SHALL accept `mock`, `claude` and `copilot`, with `mock` as the default. Every step of a run SHALL use the agent chosen for that run.

#### Scenario: Claude chosen
- **WHEN** the user runs `agent-rounds run "<request>" --agent claude`
- **THEN** every step of the run is executed by Claude Code and `run.json` records `"agent": "claude"`

#### Scenario: Copilot chosen
- **WHEN** the user runs `agent-rounds run "<request>" --agent copilot`
- **THEN** every step of the run is executed by GitHub Copilot CLI and `run.json` records `"agent": "copilot"`

### Requirement: Non-interactive step in the run folder
For each step, a real agent SHALL run its CLI in non-interactive mode (`claude -p` or `copilot -p`) with the run folder as the working directory, its standard input closed, and its arguments passed as a list, never through a shell.

#### Scenario: Working directory
- **WHEN** a step runs with `--agent claude` or `--agent copilot`
- **THEN** the agent CLI starts in the run folder with the runner's task as its prompt

### Requirement: File tools only
A real agent SHALL be limited to reading and writing files. Claude Code SHALL run with `--permission-mode acceptEdits`, only the `Read`, `Write`, `Edit`, `Glob` and `Grep` tools, and no MCP servers. Copilot CLI SHALL run with `--allow-tool=read,write`, `--deny-tool=shell,url` and `--no-ask-user`. Neither SHALL be started with a flag that skips all permission checks.

#### Scenario: Claude flags
- **WHEN** a step runs with `--agent claude`
- **THEN** the command includes `--permission-mode acceptEdits`, `--tools Read,Write,Edit,Glob,Grep` and `--strict-mcp-config`, and does not include `--dangerously-skip-permissions`

#### Scenario: Copilot flags
- **WHEN** a step runs with `--agent copilot`
- **THEN** the command includes `--allow-tool=read,write`, `--deny-tool=shell,url` and `--no-ask-user`, and does not include `--allow-all`, `--allow-all-tools` or `--yolo`

#### Scenario: Writes are still checked
- **WHEN** a real agent writes a file outside the role's `writes`
- **THEN** the step breaks the `writes-only-own-files` contract and the run fails, as with any agent

### Requirement: Role prompt delivery
A real agent SHALL receive the role's prompt file together with the runner's task. Claude Code SHALL get the role prompt appended to its system prompt. Copilot CLI, which has no system prompt option, SHALL get the role prompt first in its prompt, followed by a `---` separator and the runner's task.

#### Scenario: Claude role prompt
- **WHEN** the `research` role runs with `--agent claude`
- **THEN** the command passes the role's prompt file with `--append-system-prompt-file`

#### Scenario: Copilot role prompt
- **WHEN** the `research` role runs with `--agent copilot`
- **THEN** the prompt starts with the content of the role's prompt file and contains the runner's task after it

### Requirement: Agent failures fail the step
A step SHALL fail with a short reason when the agent CLI exits with a non-zero code, when Claude Code reports `is_error` in its JSON result, or when Claude Code prints no JSON result. The reason SHALL be the error text the CLI reported, or else the last non-blank line of its error output.

#### Scenario: Non-zero exit
- **WHEN** the agent CLI exits with code 3 and its last line on stderr is `Error: fake failure`
- **THEN** the step fails with the error `Error: fake failure` and the CLI exits 1

#### Scenario: Claude reports an error
- **WHEN** Claude Code exits 0 but its JSON result has `is_error: true` and `result` `Not logged in. Please run /login`
- **THEN** the step fails with the error `Not logged in. Please run /login`

### Requirement: Step timeout
A real agent SHALL be stopped when a step runs longer than the `--timeout` given to `run`, and the step SHALL fail with the error `timed out after <minutes> min`.

#### Scenario: Agent hangs
- **WHEN** the agent CLI is still running when the step timeout is reached
- **THEN** the process is stopped and the step fails with `timed out after <minutes> min`

### Requirement: Missing agent CLI
When the agent CLI cannot be found, the step SHALL fail with the error `"<binary>" was not found on PATH` and the run SHALL exit 1. `AGENT_ROUNDS_CLAUDE_BIN` and `AGENT_ROUNDS_COPILOT_BIN` SHALL, when set, replace the binary name `claude` or `copilot`.

#### Scenario: Binary not installed
- **WHEN** the user runs `--agent claude` with `AGENT_ROUNDS_CLAUDE_BIN=claude-not-installed`
- **THEN** the output contains `agent failed: "claude-not-installed" was not found on PATH` and the command exits 1

### Requirement: Cost per step
Each step run with Claude Code SHALL record the `total_cost_usd` from its JSON result as the step's cost, also when the step fails. Steps run with Copilot CLI SHALL record no cost (`null`), because the CLI does not report one.

#### Scenario: Claude cost
- **WHEN** every step of a six-step run reports `total_cost_usd` 0.0125
- **THEN** each step in `run.json` has `costUsd` 0.0125 and the run's total cost is 0.075

#### Scenario: Copilot cost
- **WHEN** a run with `--agent copilot` finishes
- **THEN** every step in `run.json` has `costUsd` `null`
