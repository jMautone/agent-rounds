import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPlan, critiqueFile, writesFor } from "../src/core/plan.js";
import { loadTeam, type Team } from "../src/core/team.js";
import { EXAMPLE } from "./example.js";

describe("buildPlan", () => {
  it("pairs each critic with the role right before it", () => {
    const plan = buildPlan(loadTeam(path.join(EXAMPLE.dir, "team.yaml")));
    expect(plan.map((s) => [s.author.id, s.critic?.id])).toEqual([
      ["research", undefined],
      ["spec", "ux-critic-spec"],
      ["prototype", "ux-critic-prototype"],
      ["design-system", undefined],
    ]);
  });

  it("refuses a hand-built team with a misplaced critic", () => {
    const role = { promptPath: "x", reads: [], writes: ["a.md"], maxRounds: 2 };
    const team: Team = {
      name: "t",
      file: "t.yaml",
      roles: [
        { ...role, id: "a" },
        { ...role, id: "b" },
        { ...role, id: "c", criticOf: "a", writes: ["c-{round}.md"] },
      ],
    };
    expect(() => buildPlan(team)).toThrow(/right after/);
  });
});

describe("writesFor", () => {
  it("fills in {round}", () => {
    const critic = {
      id: "c",
      promptPath: "x",
      reads: [],
      writes: ["30-c-{round}.md"],
      maxRounds: 2,
    };
    expect(writesFor(critic, 2)).toEqual(["30-c-2.md"]);
    expect(critiqueFile(critic, 1)).toBe("30-c-1.md");
  });
});
