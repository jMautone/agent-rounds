# team-definition Specification

## Purpose
The team.yaml format a team author writes, and how it is validated so mistakes are caught before any agent runs.

## Requirements

### Requirement: Team file shape
A team file SHALL be YAML with a `name` and a non-empty list of `roles`. `name` and each role `id` SHALL be lowercase letters, digits and dashes, starting with a letter or digit. Each role SHALL have a `prompt` and at least one `writes` entry, and MAY have `reads`, `critic_of` and `max_rounds`. Any other key, at the top level or in a role, SHALL be rejected so that typos do not pass silently.

#### Scenario: Valid team
- **WHEN** the user validates `examples/design-team/team.yaml`
- **THEN** the team loads with its 6 roles in file order, 2 of them critics

#### Scenario: Defaults
- **WHEN** a role omits `reads`, and a critic omits `max_rounds`
- **THEN** `reads` is empty and `max_rounds` is 2

#### Scenario: Unknown key
- **WHEN** a role has a misspelled key such as `raeds`
- **THEN** validation fails with an error that names `raeds`

#### Scenario: Invalid name
- **WHEN** the team `name` is `Bad Name`
- **THEN** validation fails with `name: must be lowercase letters, digits and dashes`

#### Scenario: Duplicate role id
- **WHEN** two roles share the id `a`
- **THEN** validation fails at the second one with `duplicate role id "a"`

### Requirement: Paths stay relative and portable
Every path in `prompt`, `reads` and `writes` SHALL be relative, SHALL use `/` as separator, and SHALL NOT contain `.` or `..` segments. `prompt` is relative to the folder of `team.yaml` and SHALL point to an existing file. `reads` and `writes` are relative to the run folder. A `writes` entry ending in `/` SHALL mean the role owns that whole folder.

#### Scenario: Absolute path
- **WHEN** a role writes `/etc/passwd` or `C:/x.md`
- **THEN** validation fails with `must be a relative path`

#### Scenario: Escaping the base folder
- **WHEN** a role writes `../outside.md`
- **THEN** validation fails with `must not contain '.' or '..' segments`

#### Scenario: Backslash
- **WHEN** a path contains `\`
- **THEN** validation fails with `use forward slashes (/) in paths`

#### Scenario: Missing prompt
- **WHEN** `prompt: roles/missing.md` does not exist next to `team.yaml`
- **THEN** validation fails at that line with `prompt file not found: roles/missing.md`

### Requirement: Every written file has one owner
No two roles SHALL list the same `writes` entry. No role SHALL write a file the runner owns: `00-request.md`, `90-delivery.md` or `run.json`.

#### Scenario: Shared file
- **WHEN** roles `a` and `b` both write `10-a.md`
- **THEN** validation fails at `b` with `"10-a.md" is already written by role "a"`

#### Scenario: Runner-owned file
- **WHEN** a role writes `run.json` or `00-request.md`
- **THEN** validation fails with `"run.json" is owned by the runner` (or the matching name)

### Requirement: Critics review the role right above them
A role with `critic_of` is a critic. It SHALL come immediately after the role it reviews, that role SHALL exist, and it SHALL NOT be a critic itself. A critic SHALL write exactly one file, not a folder, whose name contains `{round}`. `max_rounds` SHALL be an integer from 1 to 5. `{round}` and `max_rounds` SHALL only appear on critics.

#### Scenario: Critic out of place
- **WHEN** a critic of `a` is separated from `a` by another role
- **THEN** validation fails at its `critic_of` with a message saying a critic must come right after the role it reviews

#### Scenario: Unknown reviewed role
- **WHEN** `critic_of: zzz` names no role
- **THEN** validation fails with `unknown role "zzz"`

#### Scenario: Critique without round
- **WHEN** a critic writes `20-a-critique.md`
- **THEN** validation fails at its `writes` asking for exactly one file whose name contains `{round}`

#### Scenario: Round fields on an author
- **WHEN** a role without `critic_of` has `max_rounds: 3` or writes `10-a-{round}.md`
- **THEN** validation fails with `max_rounds only applies to critics (roles with critic_of)` and `{round} is only allowed in a critic's writes`

### Requirement: Errors point at the line
Every validation error SHALL be reported as `<file>:<line>:<column>  <path>: <message>`, all errors at once, where `<path>` is the YAML path such as `roles[2].critic_of`. A missing team file SHALL be reported at line 1 as `file not found`. A YAML syntax error on a line with an unquoted `{round}` SHALL add a hint to quote the path.

#### Scenario: Line and column
- **WHEN** role 1 has the id `A`
- **THEN** the error reads `team.yaml:6:9  roles[1].id: must be lowercase letters, digits and dashes`

#### Scenario: Unquoted round placeholder
- **WHEN** a critic writes `[20-a-critique-{round}.md]` without quotes
- **THEN** the error points at that line and says to quote paths that contain `{round}`
