// Regenerates the versioned example run with the mock agent.
// Usage: npm run example
import { rmSync } from "node:fs";
import path from "node:path";
import { MockAgent } from "../src/agents/mock.js";
import { runTeam } from "../src/core/runner.js";
import { loadTeam } from "../src/core/team.js";
import { EXAMPLE } from "../tests/example.js";

const runsDir = path.resolve(EXAMPLE.dir, "runs");
rmSync(path.join(runsDir, EXAMPLE.runName), { recursive: true, force: true });
const record = await runTeam({
  team: loadTeam(path.join(EXAMPLE.dir, "team.yaml")),
  request: EXAMPLE.request,
  agent: new MockAgent(),
  runsDir,
  runName: EXAMPLE.runName,
  now: () => EXAMPLE.fixedDate,
});
console.log(`${record.status}: ${path.relative(process.cwd(), record.runDir)}`);
