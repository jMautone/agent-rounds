import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MockAgent, type MockBehavior } from "../src/agents/mock.js";
import type { AgentAdapter, AgentTask } from "../src/agents/types.js";
import { readRunLog, runTeam, slugify } from "../src/core/runner.js";
import { loadTeam } from "../src/core/team.js";
import { EXAMPLE } from "./example.js";
import { copyExampleTeam, read } from "./helpers.js";

async function run(roles: Record<string, MockBehavior> = {}, agent?: AgentAdapter) {
  const { teamFile, runsDir } = copyExampleTeam();
  const record = await runTeam({
    team: loadTeam(teamFile),
    request: EXAMPLE.request,
    agent: agent ?? new MockAgent({ roles }),
    runsDir,
    runName: "r",
  });
  return { record, log: readRunLog(record.runDir), dir: record.runDir };
}

const summary = (steps: { role: string; round: number; status: string; verdict: unknown }[]) =>
  steps.map((s) => `${s.role}#${s.round}:${s.status}${s.verdict ? `:${s.verdict}` : ""}`);

describe("runTeam with the mock agent", () => {
  it("runs every role in order, with one CHANGES round per critic", async () => {
    const { record, dir } = await run();
    expect(record.status).toBe("completed");
    expect(summary(record.steps)).toEqual([
      "research#1:ok",
      "spec#1:ok",
      "ux-critic-spec#1:ok:CHANGES",
      "spec#2:ok",
      "ux-critic-spec#2:ok:APPROVED",
      "prototype#1:ok",
      "ux-critic-prototype#1:ok:CHANGES",
      "prototype#2:ok",
      "ux-critic-prototype#2:ok:APPROVED",
      "design-system#1:ok",
    ]);
    expect(read(dir, "00-request.md")).toBe(`${EXAMPLE.request}\n`);
    expect(read(dir, "20-spec.md")).toContain("Addressed the critique in [30-spec-critique-1.md]");
    expect(read(dir, "90-delivery.md")).toContain("**Status:** ✅ Completed");
  });

  it("skips the extra round when the critic approves at once", async () => {
    const { record } = await run({ "ux-critic-spec": { verdicts: ["APPROVED"] } });
    expect(summary(record.steps).slice(1, 4)).toEqual([
      "spec#1:ok",
      "ux-critic-spec#1:ok:APPROVED",
      "prototype#1:ok",
    ]);
  });

  it("moves on with observations when the rounds run out", async () => {
    const { record, log, dir } = await run({ "ux-critic-spec": { verdicts: ["CHANGES"] } });
    expect(record.status).toBe("completed_with_observations");
    expect(log.reviews[0]).toEqual({
      author: "spec",
      critic: "ux-critic-spec",
      maxRounds: 2,
      rounds: 2,
      finalVerdict: "CHANGES",
      withObservations: true,
    });
    expect(record.steps.at(-1)?.role).toBe("design-system");
    const delivery = read(dir, "90-delivery.md");
    expect(delivery).toContain("CHANGES (with observations)");
    expect(delivery).toContain("ux-critic-spec still asked for changes after 2 rounds");
  });

  it("contract 1: stops when a role does not write its file", async () => {
    const { record, dir } = await run({ spec: { skip: ["20-spec.md"] } });
    expect(record.status).toBe("failed");
    expect(record.steps.at(-1)).toMatchObject({
      role: "spec",
      status: "failed",
      violations: [{ contract: "writes-exist", message: "20-spec.md was not written" }],
    });
    expect(record.steps).toHaveLength(2);
    expect(read(dir, "90-delivery.md")).toContain("`writes-exist`: 20-spec.md was not written");
  });

  it("contract 1: stops when a role writes an empty file", async () => {
    const { record } = await run({ research: { empty: ["10-research.md"] } });
    expect(record.steps[0]?.violations[0]?.message).toBe("10-research.md is empty");
  });

  it("contract 2: stops when a role writes another role's file", async () => {
    const { record } = await run({ prototype: { extra: { "20-spec.md": "rewritten" } } });
    expect(record.status).toBe("failed");
    expect(record.steps.at(-1)).toMatchObject({
      role: "prototype",
      violations: [
        {
          contract: "writes-only-own-files",
          message: "modified 20-spec.md, which is not in its writes",
        },
      ],
    });
  });

  it("contract 2: a role may write anything inside a folder it owns", async () => {
    const { record } = await run({ prototype: { extra: { "40-prototype/css/site.css": "a{}" } } });
    expect(record.status).toBe("completed");
  });

  it("contract 3: stops when a critique has no verdict line", async () => {
    const { record } = await run({ "ux-critic-spec": { verdicts: ["Looks good to me!"] } });
    expect(record.status).toBe("failed");
    expect(record.steps.at(-1)?.violations[0]).toEqual({
      contract: "verdict-line",
      message:
        'last line of 30-spec-critique-1.md must be APPROVED or CHANGES, got "Looks good to me!"',
    });
  });

  it("stops when the agent process fails", async () => {
    const { record, dir } = await run({ research: { fail: "rate limited" } });
    expect(record.status).toBe("failed");
    expect(record.steps[0]).toMatchObject({ status: "failed", error: "rate limited" });
    expect(read(dir, "90-delivery.md")).toContain("agent failed: rate limited");
  });

  it("records an adapter that throws as a failed step", async () => {
    const agent: AgentAdapter = {
      name: "boom",
      run: async () => {
        throw new Error("spawn claude ENOENT");
      },
    };
    const { record } = await run({}, agent);
    expect(record.steps[0]?.error).toBe("spawn claude ENOENT");
  });

  it("hands each step the right inputs", async () => {
    const tasks: AgentTask[] = [];
    const mock = new MockAgent();
    const spy: AgentAdapter = {
      name: "spy",
      run: (t) => {
        tasks.push(t);
        return mock.run(t);
      },
    };
    await run({}, spy);
    const [critic1, redo] = [tasks[2], tasks[3]];
    expect(critic1).toMatchObject({ kind: "critic", round: 1, reviews: ["20-spec.md"] });
    expect(critic1?.writes).toEqual(["30-spec-critique-1.md"]);
    expect(critic1?.prompt).toContain("APPROVED if the work can move on");
    expect(redo).toMatchObject({ roleId: "spec", round: 2, critique: "30-spec-critique-1.md" });
    expect(redo?.prompt).toContain("A critic asked for changes in 30-spec-critique-1.md");
    expect(tasks.every((t) => t.cwd === tasks[0]?.cwd)).toBe(true);
    expect(path.basename(tasks[0]?.systemPromptPath ?? "")).toBe("research.md");
  });

  it("writes cost and durations to run.json", async () => {
    const agent: AgentAdapter = {
      name: "paid",
      run: async (t) => ({ ...(await new MockAgent().run(t)), costUsd: 0.0125 }),
    };
    const { log } = await run({}, agent);
    expect(log.totalCostUsd).toBeCloseTo(0.125);
    expect(log.steps.every((s) => typeof s.durationMs === "number")).toBe(true);
  });

  it("never reuses a run folder", async () => {
    const { teamFile, runsDir } = copyExampleTeam();
    const opts = {
      team: loadTeam(teamFile),
      request: "x",
      agent: new MockAgent(),
      runsDir,
      runName: "same",
    };
    const a = await runTeam(opts);
    const b = await runTeam(opts);
    expect(path.basename(a.runDir)).toBe("same");
    expect(path.basename(b.runDir)).toBe("same-2");
  });

  it("rejects an empty request", async () => {
    const { teamFile, runsDir } = copyExampleTeam();
    await expect(
      runTeam({ team: loadTeam(teamFile), request: "  ", agent: new MockAgent(), runsDir }),
    ).rejects.toThrow("the request is empty");
  });
});

describe("reproducibility", () => {
  it("a mock run matches the versioned example byte for byte, except timings", async () => {
    const { teamFile, runsDir } = copyExampleTeam();
    const record = await runTeam({
      team: loadTeam(teamFile),
      request: EXAMPLE.request,
      agent: new MockAgent(),
      runsDir,
      runName: EXAMPLE.runName,
    });
    const expectedDir = path.join(EXAMPLE.dir, "runs", EXAMPLE.runName);
    const files = listFiles(expectedDir);
    expect(listFiles(record.runDir)).toEqual(files);
    for (const f of files) {
      const actual = readFileSync(path.join(record.runDir, f), "utf8");
      const expected = readFileSync(path.join(expectedDir, f), "utf8");
      if (f === "run.json") {
        expect(withoutTimings(actual)).toEqual(withoutTimings(expected));
      } else {
        expect(actual, f).toBe(expected);
      }
    }
  });
});

describe("slugify", () => {
  it.each([
    ["Diseñá dos pantallas de onboarding", "disena-dos-pantallas-de-onboarding"],
    ["  ¡Hola!  ", "hola"],
    ["???", "run"],
    [
      "Design two onboarding screens for the Mate & Co. mobile app.",
      "design-two-onboarding-screens-for-the",
    ],
  ])("%j → %j", (input, slug) => {
    expect(slugify(input)).toBe(slug);
  });
});

function listFiles(dir: string, prefix = ""): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const rel = prefix ? `${prefix}/${name}` : name;
      return statSync(path.join(dir, name)).isDirectory()
        ? listFiles(path.join(dir, name), rel)
        : [rel];
    })
    .sort();
}

function withoutTimings(json: string): unknown {
  return JSON.parse(json, (key, value) =>
    ["startedAt", "finishedAt", "durationMs"].includes(key) ? undefined : value,
  );
}
