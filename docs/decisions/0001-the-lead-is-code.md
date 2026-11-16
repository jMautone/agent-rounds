# 1. The team lead is code, not an LLM

Date: 2026-11-14 · Status: accepted

## Context

Agent teams such as Claude Code agent teams or designpowers let a model coordinate the other roles. That model can skip a review round, accept a critique that asked for changes, or let a role overwrite another role's file, and nothing records it.

## Decision

The order of roles, the review loop and the file contracts are implemented in TypeScript. Agents only produce content. In v0.1 every role gets the full request; no model splits or routes work.

## Consequences

- The process is enforced every time, and a broken rule stops the run with exit code 1.
- The process is less flexible: a team cannot improvise new steps. That is the point.
- A "planner" role can still be added later as a normal role that writes a file other roles read.
