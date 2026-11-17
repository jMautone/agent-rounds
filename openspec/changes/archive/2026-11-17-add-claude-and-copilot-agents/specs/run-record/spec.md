## MODIFIED Requirements

### Requirement: 90-delivery.md from a fixed template
When the run ends, the runner SHALL write `90-delivery.md` from a fixed template with no LLM: the request, the status, the agent, the cost, a table of steps, a table of reviews, open observations (when any review ran out of rounds), what broke (when any step failed), and links to every file. It SHALL NOT contain dates, durations or absolute paths, so the same run renders the same bytes. When no step reported a cost, the cost line SHALL read `**Cost:** not reported by the agent`.

#### Scenario: Delivery after observations
- **WHEN** a review ends with observations
- **THEN** the delivery shows the status "Completed with observations" and lists that review under "Open observations" with a link to the last critique

#### Scenario: Cost not reported
- **WHEN** a run with `--agent copilot` finishes
- **THEN** `90-delivery.md` contains `**Cost:** not reported by the agent`

#### Scenario: Reported cost
- **WHEN** a run with the mock agent finishes
- **THEN** `90-delivery.md` contains `**Cost:** US$ 0.00`
