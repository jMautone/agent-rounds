import { execFile } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { copyExampleTeam } from "./helpers.js";

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "src", "cli.ts");
// Absolute, because the CLI runs from a temp dir that has no node_modules.
const tsx = import.meta.resolve("tsx");

async function agentRounds(args: string[], cwd: string) {
  try {
    const { stdout, stderr } = await exec(process.execPath, ["--import", tsx, cli, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: "1" },
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

describe("cli", () => {
  it("runs a team with the mock agent and prints one line per step", async () => {
    const { dir } = copyExampleTeam();
    const r = await agentRounds(["run", "Design a sign-up screen for Mate & Co."], dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("✓ ux-critic-spec round 1 → CHANGES");
    expect(r.stdout).toContain("✓ ux-critic-spec round 2 → APPROVED");
    expect(r.stdout).toMatch(
      /✓ done: 6 roles · 10 steps · 4 review rounds · 0 broken contracts · US\$ 0\.00 \(mock\)/,
    );
    const runs = readdirSync(path.join(dir, "runs"));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}-design-a-sign-up-screen-for-mate-co$/);
  });

  it("validates a team", async () => {
    const { dir } = copyExampleTeam();
    const r = await agentRounds(["validate"], dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("team design, 6 roles, 2 critics");
  });

  it("exits 2 with file:line on an invalid team", async () => {
    const { dir, teamFile } = copyExampleTeam();
    writeFileSync(teamFile, "name: Bad Name\nroles: []\n");
    const r = await agentRounds(["validate"], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("team.yaml:1:7  name: must be lowercase letters, digits and dashes");
  });

  it("exits 2 for an agent that is not available yet", async () => {
    const { dir } = copyExampleTeam();
    const r = await agentRounds(["run", "x", "--agent", "claude"], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("the claude adapter is not in this build yet");
  });
});
