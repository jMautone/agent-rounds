## ADDED Requirements

### Requirement: Contracts are checked by diffing the run folder
Before and after every step, the runner SHALL take a snapshot of every file in the run folder by content hash and compare the two. Symlinks SHALL be recorded by their target and never followed. OS litter (`.DS_Store`, `Thumbs.db`, `desktop.ini`) SHALL be ignored. Files outside the run folder are not watched. The check SHALL work the same for every agent, including the mock.

#### Scenario: Changes are seen in subfolders
- **WHEN** a step adds, changes and deletes files, some inside subfolders
- **THEN** the diff lists each one as added, modified or removed, with `/`-separated paths relative to the run folder

#### Scenario: OS litter
- **WHEN** a `.DS_Store` file appears in the run folder during a step
- **THEN** no contract is broken because of it

### Requirement: writes-exist
After a step whose agent finished without error, every path the role had to write in that round SHALL exist and not be empty. A folder entry (ending in `/`) SHALL contain at least one non-empty file.

#### Scenario: File not written
- **WHEN** the role does not create `10-research.md`
- **THEN** `writes-exist` is broken with `10-research.md was not written`

#### Scenario: Empty file
- **WHEN** the role writes `10-research.md` with no content
- **THEN** `writes-exist` is broken with `10-research.md is empty`

#### Scenario: Empty folder
- **WHEN** a role that owns `40-prototype/` leaves it missing or with only empty files
- **THEN** `writes-exist` is broken with `folder 40-prototype/ is missing or empty`

### Requirement: writes-only-own-files
After every step, including one whose agent failed, every file created, modified or deleted in the run folder SHALL be one of the role's writes for that round or sit inside a folder it owns. Each file outside SHALL be reported on its own.

#### Scenario: Writing another role's file
- **WHEN** the `spec` role also changes `10-research.md`
- **THEN** `writes-only-own-files` is broken with `modified 10-research.md, which is not in its writes`

#### Scenario: Files inside an owned folder
- **WHEN** a role that owns `40-prototype/` writes `40-prototype/index.html` and `40-prototype/app.css`
- **THEN** no contract is broken

### Requirement: verdict-line
After a critic step that broke no other contract, the last non-blank line of its critique SHALL be exactly `APPROVED` or `CHANGES`. Surrounding spaces and trailing blank lines SHALL be tolerated. Anything else, including lowercase or markdown emphasis such as `**APPROVED**`, SHALL break the contract. The verdict words are not configurable.

#### Scenario: Valid verdict with trailing blank lines
- **WHEN** a critique ends in `  CHANGES  ` followed by two blank lines
- **THEN** the verdict is `CHANGES`

#### Scenario: Decorated verdict
- **WHEN** a critique ends in `**APPROVED**`
- **THEN** `verdict-line` is broken with a message that quotes the line it got

#### Scenario: Critique cannot be read
- **WHEN** a critique is unreadable
- **THEN** `verdict-line` is broken with `<file> could not be read`
