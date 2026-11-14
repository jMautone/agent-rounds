import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadTeam, TeamError } from "../src/core/team.js";
import { EXAMPLE } from "./example.js";
import { writeTeam } from "./helpers.js";

function issuesOf(yaml: string, prompts?: string[]) {
  try {
    loadTeam(writeTeam(yaml, prompts));
  } catch (err) {
    if (err instanceof TeamError) return err.issues;
    throw err;
  }
  throw new Error("expected the team to be invalid");
}

const ok = `name: t
roles:
  - id: a
    prompt: roles/a.md
    writes: [10-a.md]
  - id: a-critic
    prompt: roles/a.md
    critic_of: a
    writes: ["20-a-critique-{round}.md"]
`;

describe("loadTeam", () => {
  it("loads the example team and resolves prompts next to team.yaml", () => {
    const team = loadTeam(path.join(EXAMPLE.dir, "team.yaml"));
    expect(team.name).toBe("design");
    expect(team.roles.map((r) => r.id)).toEqual([
      "research",
      "spec",
      "ux-critic-spec",
      "prototype",
      "ux-critic-prototype",
      "design-system",
    ]);
    const critic = team.roles[2];
    expect(critic?.criticOf).toBe("spec");
    expect(critic?.maxRounds).toBe(2);
    expect(team.roles[0]?.promptPath).toBe(path.join(EXAMPLE.dir, "roles", "research.md"));
  });

  it("defaults reads to [] and max_rounds to 2", () => {
    const team = loadTeam(writeTeam(ok));
    expect(team.roles[0]?.reads).toEqual([]);
    expect(team.roles[1]?.maxRounds).toBe(2);
  });

  it("reports a missing file", () => {
    expect(() => loadTeam(path.join(EXAMPLE.dir, "nope.yaml"))).toThrow(/file not found/);
  });

  it("points at the line of a duplicate id", () => {
    const issues = issuesOf(ok.replace("id: a-critic", "id: a"));
    expect(issues).toContainEqual(
      expect.objectContaining({ line: 6, path: "roles[1].id", message: 'duplicate role id "a"' }),
    );
  });

  it("requires a critic to come right after the role it reviews", () => {
    const yaml = `${ok.replace(/ {2}- id: a-critic[\s\S]*$/, "")}  - id: b
    prompt: roles/a.md
    writes: [15-b.md]
  - id: a-critic
    prompt: roles/a.md
    critic_of: a
    writes: ["20-a-critique-{round}.md"]
`;
    const issues = issuesOf(yaml);
    expect(issues[0]).toMatchObject({ line: 11, path: "roles[2].critic_of" });
    expect(issues[0]?.message).toMatch(/right after/);
  });

  it("rejects an unknown critic_of", () => {
    expect(issuesOf(ok.replace("critic_of: a", "critic_of: zzz"))[0]?.message).toBe(
      'unknown role "zzz"',
    );
  });

  it("requires a critic to write one file with {round}", () => {
    const issues = issuesOf(ok.replace('"20-a-critique-{round}.md"', "20-a-critique.md"));
    expect(issues[0]).toMatchObject({ line: 9, path: "roles[1].writes" });
  });

  it("rejects {round} and max_rounds on a non-critic", () => {
    const yaml = ok
      .replace("writes: [10-a.md]", 'writes: ["10-a-{round}.md"]\n    max_rounds: 3')
      .replace("id: a-critic", "id: c")
      .replace("    critic_of: a\n", "")
      .replace('"20-a-critique-{round}.md"', "20-c.md");
    const messages = issuesOf(yaml).map((i) => i.message);
    expect(messages).toContain("max_rounds only applies to critics (roles with critic_of)");
    expect(messages).toContain("{round} is only allowed in a critic's writes");
  });

  it.each([
    ["/etc/passwd", "must be a relative path"],
    ["C:/x.md", "must be a relative path"],
    ["../outside.md", "must not contain '.' or '..' segments"],
    ["a\\\\b.md", "use forward slashes (/) in paths"],
    ["run.json", '"run.json" is owned by the runner'],
    ["00-request.md", '"00-request.md" is owned by the runner'],
  ])("rejects the write path %s", (bad, message) => {
    const issues = issuesOf(ok.replace("writes: [10-a.md]", `writes: ["${bad}"]`));
    expect(issues).toContainEqual(expect.objectContaining({ line: 5, message }));
  });

  it("rejects two roles writing the same file", () => {
    const yaml = `${ok}  - id: b
    prompt: roles/a.md
    writes: [10-a.md]
`;
    expect(issuesOf(yaml)[0]?.message).toBe('"10-a.md" is already written by role "a"');
  });

  it("rejects unknown keys, so typos do not pass silently", () => {
    const issues = issuesOf(
      ok.replace("writes: [10-a.md]", "writes: [10-a.md]\n    raeds: [x.md]"),
    );
    expect(issues[0]?.message).toMatch(/raeds/);
  });

  it("reports a missing prompt file with its line", () => {
    const issues = issuesOf(ok.replace("prompt: roles/a.md", "prompt: roles/missing.md"));
    expect(issues[0]).toMatchObject({
      line: 4,
      message: "prompt file not found: roles/missing.md",
    });
  });

  it("explains the YAML gotcha of an unquoted {round}", () => {
    const issues = issuesOf(ok.replace('"20-a-critique-{round}.md"', "20-a-critique-{round}.md"));
    expect(issues[0]?.line).toBe(9);
    expect(issues[0]?.message).toMatch(/quote paths that contain \{round\}/);
  });

  it("formats every issue as file:line:column in the error message", () => {
    const file = writeTeam(ok.replace("id: a-critic", "id: A"));
    expect(() => loadTeam(file)).toThrow(`${file}:6:9`);
  });
});
