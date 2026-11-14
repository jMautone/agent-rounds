import type { AgentTask } from "../agents/types.js";

type TaskInput = Omit<AgentTask, "prompt" | "timeoutMs">;

/**
 * The instructions every role receives on top of its own prompt. They state
 * the contract the runner will check, so a well-behaved agent never trips it.
 */
export function buildTaskPrompt(t: TaskInput): string {
  const list = (files: string[]) => files.map((f) => `- ${f}`).join("\n");
  const lines: string[] = [
    `You are the "${t.roleId}" role in the "${t.team}" team. This is round ${t.round}.`,
    "",
    "The request is in 00-request.md. Here it is:",
    "",
    ...t.request.split("\n").map((l) => `> ${l}`),
    "",
  ];
  if (t.reads.length > 0) lines.push("Read these files first:", list(t.reads), "");
  if (t.kind === "critic" && t.reviews) {
    lines.push("Review these files written by the previous role:", list(t.reviews), "");
  }
  if (t.critique) {
    lines.push(
      `A critic asked for changes in ${t.critique}. Read it and update your files to address it.`,
      "",
    );
  }
  lines.push(
    "Write exactly these paths (a path ending in / is a folder you own):",
    list(t.writes),
    "",
    "Do not create, change or delete any other file. The runner checks this after you finish.",
  );
  if (t.kind === "critic") {
    lines.push(
      "",
      "End your critique with a last line that is exactly one word:",
      "APPROVED if the work can move on, or CHANGES if it needs another round.",
    );
  }
  return `${lines.join("\n")}\n`;
}
