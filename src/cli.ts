#!/usr/bin/env node
import { Command, InvalidArgumentError } from "commander";
import { ClaudeAgent } from "./agents/claude.js";
import { CopilotAgent } from "./agents/copilot.js";
import { MockAgent } from "./agents/mock.js";
import type { AgentAdapter } from "./agents/types.js";
import { runTeam } from "./core/runner.js";
import { loadTeam, TeamError } from "./core/team.js";
import { formatEvent, formatSummary } from "./output.js";
import { VERSION } from "./version.js";

/** Exit codes: 0 ok (observations included), 1 contract broken or agent failed, 2 bad input. */
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;

const AGENTS: Record<string, () => AgentAdapter> = {
  mock: () => new MockAgent(),
  claude: () => new ClaudeAgent(),
  copilot: () => new CopilotAgent(),
};

const program = new Command()
  .name("agent-rounds")
  .description("Run a team of coding agents where the process is code, not another LLM.")
  .version(VERSION)
  // Usage errors exit 2, so scripts can tell them apart from a broken contract (1).
  // Set before adding commands: subcommands copy this setting when created.
  .exitOverride((err) => {
    process.exit(err.exitCode === 0 ? 0 : EXIT_USAGE);
  });

program
  .command("run")
  .description("run the team on a request and write everything to runs/<date>-<slug>/")
  .argument("<request>", "what the team should produce")
  .option("-t, --team <file>", "team definition", "team.yaml")
  .option(
    "-a, --agent <name>",
    `agent adapter (${Object.keys(AGENTS).join(", ")})`,
    parseAgent,
    "mock",
  )
  .option("-o, --runs-dir <dir>", "where run folders are created", "runs")
  .option("--timeout <minutes>", "per-step timeout in minutes", parsePositive, 15)
  .action(
    async (
      request: string,
      o: { team: string; agent: string; runsDir: string; timeout: number },
    ) => {
      const team = loadTeam(o.team);
      const agent = (AGENTS[o.agent] as () => AgentAdapter)();
      const record = await runTeam({
        team,
        request,
        agent,
        runsDir: o.runsDir,
        timeoutMs: o.timeout * 60_000,
        onEvent: (e) => {
          const line = formatEvent(e);
          if (line) console.log(line);
        },
      });
      console.log(formatSummary(record));
      if (record.status === "failed") process.exitCode = EXIT_FAILED;
    },
  );

program
  .command("validate")
  .description("check a team.yaml without running anything")
  .option("-t, --team <file>", "team definition", "team.yaml")
  .action((o: { team: string }) => {
    const team = loadTeam(o.team);
    const critics = team.roles.filter((r) => r.criticOf).length;
    console.log(`✓ ${o.team}: team ${team.name}, ${team.roles.length} roles, ${critics} critics`);
  });

function parseAgent(value: string): string {
  if (!(value in AGENTS)) {
    throw new InvalidArgumentError(
      `unknown agent "${value}". Available: ${Object.keys(AGENTS).join(", ")}.`,
    );
  }
  return value;
}

function parsePositive(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new InvalidArgumentError("must be a positive number.");
  return n;
}

try {
  await program.parseAsync();
} catch (err) {
  if (err instanceof TeamError) {
    console.error(err.message);
    process.exit(EXIT_USAGE);
  }
  console.error(`agent-rounds: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(EXIT_FAILED);
}
