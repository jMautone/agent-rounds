import { realpathSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLAUDE_TOOLS, ClaudeAgent, parseClaudeJson } from "../src/agents/claude.js";
import { CopilotAgent, copilotPrompt } from "../src/agents/copilot.js";
import type { AgentAdapter, AgentTask } from "../src/agents/types.js";
import { renderDelivery } from "../src/core/delivery.js";
import { runTeam } from "../src/core/runner.js";
import { loadTeam } from "../src/core/team.js";
import { formatSummary } from "../src/output.js";
import { EXAMPLE } from "./example.js";
import { copyExampleTeam, fakeAgentBin, fakeAgentCalls, read, tempDir } from "./helpers.js";

const unix = process.platform !== "win32";

function task(over: Partial<AgentTask> = {}): AgentTask {
  const cwd = tempDir();
  return {
    team: "design",
    roleId: "research",
    kind: "author",
    round: 1,
    cwd,
    systemPromptPath: path.join(EXAMPLE.dir, "roles", "research.md"),
    prompt:
      "Write exactly these paths (a path ending in / is a folder you own):\n- 10-research.md\n",
    request: "x",
    reads: [],
    writes: ["10-research.md"],
    timeoutMs: 30_000,
    ...over,
  };
}

async function runWith(agent: AgentAdapter) {
  const { teamFile, runsDir } = copyExampleTeam();
  return runTeam({
    team: loadTeam(teamFile),
    request: EXAMPLE.request,
    agent,
    runsDir,
    runName: "r",
  });
}

describe("claude adapter arguments", () => {
  it("runs headless with JSON output, the role prompt appended and file tools only", () => {
    const t = task();
    const args = new ClaudeAgent().args(t);
    expect(args.slice(0, 2)).toEqual(["-p", t.prompt]);
    expect(args).toContain("--strict-mcp-config");
    expect(args).toContain("--no-session-persistence");
    const flag = (name: string) => args[args.indexOf(name) + 1];
    expect(flag("--output-format")).toBe("json");
    expect(flag("--append-system-prompt-file")).toBe(t.systemPromptPath);
    expect(flag("--permission-mode")).toBe("acceptEdits");
    expect(flag("--tools")).toBe(CLAUDE_TOOLS.join(","));
    expect(CLAUDE_TOOLS).not.toContain("Bash");
    expect(args).not.toContain("--dangerously-skip-permissions");
  });

  it("parses the JSON result, even after stray lines", () => {
    expect(parseClaudeJson('{"is_error":false,"total_cost_usd":0.5}')?.total_cost_usd).toBe(0.5);
    expect(parseClaudeJson('warning: x\n{"is_error":true}\n')?.is_error).toBe(true);
    expect(parseClaudeJson("not json")).toBeUndefined();
  });
});

describe("copilot adapter arguments", () => {
  it("runs programmatically with only read and write allowed, and shell and url denied", () => {
    const args = new CopilotAgent().args("PROMPT");
    expect(args.slice(0, 2)).toEqual(["-p", "PROMPT"]);
    expect(args).toEqual(
      expect.arrayContaining([
        "--silent",
        "--no-ask-user",
        "--allow-tool=read,write",
        "--deny-tool=shell,url",
      ]),
    );
    expect(args.join(" ")).not.toMatch(/allow-all|--yolo/);
  });

  it("puts the role prompt before the task", () => {
    expect(copilotPrompt("# Role\n\n", "Task\n")).toBe("# Role\n\n---\n\nTask\n");
  });
});

describe.skipIf(!unix)("adapters against a fake binary on PATH", () => {
  it("claude: runs the whole example team and records the reported cost", async () => {
    const { env, log } = fakeAgentBin();
    const record = await runWith(new ClaudeAgent({ env }));
    expect(record.status).toBe("completed");
    expect(record.steps).toHaveLength(6); // the fake critic approves on round 1
    expect(record.steps.every((s) => s.costUsd === 0.0125)).toBe(true);
    expect(record.totalCostUsd).toBe(0.075);
    expect(read(record.runDir, "90-delivery.md")).toContain("**Cost:** US$ 0.07");

    const calls = fakeAgentCalls(log);
    expect(calls).toHaveLength(6);
    expect(calls.every((c) => c.flavor === "claude")).toBe(true);
    expect(realpathSync(calls[0]?.cwd ?? "")).toBe(realpathSync(record.runDir));
    const first = calls[0]?.args ?? [];
    expect(first[first.indexOf("--append-system-prompt-file") + 1]).toMatch(/research\.md$/);
  });

  it("copilot: runs the whole example team with the role prompt inlined and no cost", async () => {
    const { env, log } = fakeAgentBin();
    const record = await runWith(new CopilotAgent({ env }));
    expect(record.status).toBe("completed");
    expect(record.steps.every((s) => s.costUsd === null)).toBe(true);
    expect(read(record.runDir, "90-delivery.md")).toContain("**Cost:** not reported by the agent");
    expect(formatSummary(record)).toContain("cost not reported (copilot)");

    const calls = fakeAgentCalls(log);
    expect(calls.every((c) => c.flavor === "copilot")).toBe(true);
    const prompt = calls[0]?.args[1] ?? "";
    expect(prompt.startsWith(read(EXAMPLE.dir, "roles/research.md").trimEnd())).toBe(true);
    expect(prompt).toContain('You are the "research" role');
  });

  it("claude: a non-zero exit fails the step with the last stderr line", async () => {
    const { env } = fakeAgentBin("fail");
    const r = await new ClaudeAgent({ env }).run(task());
    expect(r).toMatchObject({ exitCode: 3, error: "Error: fake failure" });
  });

  it("claude: is_error in the JSON fails the step even with exit code 0", async () => {
    const { env } = fakeAgentBin("is_error");
    const r = await new ClaudeAgent({ env }).run(task());
    expect(r.exitCode).not.toBe(0);
    expect(r.error).toBe("Not logged in. Please run /login");
    expect(r.costUsd).toBe(0.0125);
  });

  it("copilot: a non-zero exit fails the step", async () => {
    const { env } = fakeAgentBin("fail");
    const r = await new CopilotAgent({ env }).run(task());
    expect(r).toMatchObject({ exitCode: 3, error: "Error: fake failure" });
  });

  it("kills an agent that runs past the timeout", async () => {
    const { env } = fakeAgentBin("hang");
    const r = await new CopilotAgent({ env }).run(task({ timeoutMs: 300 }));
    expect(r.exitCode).toBe(124);
    expect(r.error).toBe("timed out after 0 min");
  });

  it("a file written outside the role's writes still breaks the contract", async () => {
    const { env } = fakeAgentBin("outside");
    const record = await runWith(new ClaudeAgent({ env }));
    expect(record.status).toBe("failed");
    expect(record.steps[0]?.violations[0]?.contract).toBe("writes-only-own-files");
  });

  it("reports a missing binary clearly", async () => {
    const env = { ...process.env, PATH: tempDir() };
    const r = await new ClaudeAgent({ env, command: "claude-not-installed" }).run(task());
    expect(r).toMatchObject({
      exitCode: 127,
      error: '"claude-not-installed" was not found on PATH',
    });
  });
});

describe("delivery cost line", () => {
  it("keeps the US$ line when the agent reports cost", async () => {
    const { MockAgent } = await import("../src/agents/mock.js");
    const record = await runWith(new MockAgent());
    expect(renderDelivery(record)).toContain("**Cost:** US$ 0.00");
  });
});
