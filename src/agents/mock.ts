import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AgentAdapter, AgentResult, AgentTask } from "./types.js";

/**
 * Per-role overrides, mostly for tests: they let a mock role break a contract
 * on purpose so the runner's checks can be exercised without a real agent.
 */
export interface MockBehavior {
  /** Last line per round (index 0 = round 1). Any string, so tests can send garbage. */
  verdicts?: string[];
  /** Declared writes the mock "forgets" to create. */
  skip?: string[];
  /** Declared writes the mock creates empty. */
  empty?: string[];
  /** Extra files the mock writes, even outside its writes. */
  extra?: Record<string, string>;
  /** Makes the process "fail" with this message. */
  fail?: string;
}

export interface MockOptions {
  roles?: Record<string, MockBehavior>;
}

/**
 * Deterministic stand-in for a coding agent. Same task in, same bytes out:
 * it never reads the clock, the run folder name or anything random.
 * By default every critic asks for CHANGES in round 1 and APPROVES in round 2,
 * so a default run shows a full review loop.
 */
export class MockAgent implements AgentAdapter {
  readonly name = "mock";

  constructor(private readonly options: MockOptions = {}) {}

  async run(task: AgentTask): Promise<AgentResult> {
    const behavior = this.options.roles?.[task.roleId] ?? {};
    if (behavior.fail) return { exitCode: 1, error: behavior.fail, costUsd: 0 };

    for (const target of task.writes) {
      if (behavior.skip?.includes(target)) continue;
      const file = target.endsWith("/") ? `${target}index.html` : target;
      const content = behavior.empty?.includes(target)
        ? ""
        : task.kind === "critic"
          ? critique(task, behavior)
          : authored(task, file);
      write(task.cwd, file, content);
    }
    for (const [file, content] of Object.entries(behavior.extra ?? {})) {
      write(task.cwd, file, content);
    }
    return { exitCode: 0, costUsd: 0 };
  }
}

function write(cwd: string, rel: string, content: string): void {
  const abs = path.join(cwd, ...rel.split("/"));
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function authored(task: AgentTask, file: string): string {
  if (file.endsWith(".html")) return html(task);
  const lines = [
    `# ${titleFrom(file)}`,
    "",
    `_Written by the mock agent as role \`${task.roleId}\`, round ${task.round}._`,
    "",
    "## Request",
    "",
    ...task.request.split("\n").map((l) => `> ${l}`),
    "",
  ];
  if (task.reads.length > 0) {
    lines.push("## Inputs", "", ...task.reads.map((r) => `- [${r}](${relLink(file, r)})`), "");
  }
  lines.push(
    "## Content",
    "",
    "- Placeholder point one. A real agent writes the actual work here.",
    "- Placeholder point two.",
  );
  if (task.critique) {
    lines.push(
      `- Addressed the critique in [${task.critique}](${relLink(file, task.critique)}): added an empty state and an error message.`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function critique(task: AgentTask, behavior: MockBehavior): string {
  const verdict =
    behavior.verdicts?.[task.round - 1] ??
    behavior.verdicts?.at(-1) ??
    (task.round === 1 ? "CHANGES" : "APPROVED");
  const reviewed = (task.reviews ?? []).map((r) => `- ${r}`);
  const notes =
    verdict === "APPROVED"
      ? ["- The points from the previous round are addressed.", "- Nothing blocking left."]
      : verdict === "CHANGES"
        ? [
            "- There is no empty state for a first-time user.",
            "- It does not say what the user sees when something fails.",
          ]
        : ["- (mock critique with a custom last line)"];
  return [
    `# Critique by ${task.roleId}, round ${task.round}`,
    "",
    "Reviewed:",
    "",
    ...reviewed,
    "",
    "## Notes",
    "",
    ...notes,
    "",
    verdict,
    "",
  ].join("\n");
}

function html(task: AgentTask): string {
  const title = escapeHtml(task.request.split("\n")[0] ?? "");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8">',
    `  <title>${title}</title>`,
    "</head>",
    "<body>",
    `  <h1>${title}</h1>`,
    `  <p>Mock prototype written by role <code>${escapeHtml(task.roleId)}</code>, round ${task.round}.</p>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function titleFrom(file: string): string {
  const base = path.posix
    .basename(file)
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+-/, "");
  const words = base.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Markdown link from one run file to another, both relative to the run folder. */
function relLink(from: string, to: string): string {
  return path.posix.relative(path.posix.dirname(from), to) || to;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
