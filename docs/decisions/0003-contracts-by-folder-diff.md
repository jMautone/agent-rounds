# 3. Contracts are checked by diffing the run folder

Date: 2026-11-14 · Status: accepted

## Context

A role must write only its own files. Agent CLIs can be sandboxed per path in different ways, or not at all, and the options change often.

## Decision

The runner hashes every file in the run folder before and after each step and compares the two snapshots. Created, modified or deleted files outside the role's `writes` break the `writes-only-own-files` contract. A `writes` entry ending in `/` gives the role a whole folder (for example a prototype with several files). Symlinks are hashed by target and never followed. OS litter (`.DS_Store`, `Thumbs.db`, `desktop.ini`) is ignored.

The run stops at the first broken contract, because later roles would build on wrong inputs.

## Consequences

- It works the same with every agent, including the mock.
- It detects but does not prevent: an agent can still write outside its files, and the run then fails. Restricting tools per path in the Claude adapter is a later, complementary step.
- Files outside the run folder are not watched. Agents run with the run folder as working directory.
