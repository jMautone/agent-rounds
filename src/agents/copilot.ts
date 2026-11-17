import { readFile } from "node:fs/promises";
import type { CliAgentOptions } from "./claude.js";
import { lastLine, runProcess } from "./process.js";
import type { AgentAdapter, AgentResult, AgentTask } from "./types.js";

/**
 * GitHub Copilot CLI in programmatic mode (`copilot -p`).
 *
 * - Copilot CLI has no system prompt flag, so the role prompt goes first in the
 *   prompt text, followed by the runner's task.
 * - Only the `read` and `write` tool kinds are allowed. `shell` and `url` are
 *   denied, and deny rules win over allow rules. File-path verification stays on
 *   (no --allow-all-paths), so writes are limited to the working directory.
 * - `--no-ask-user` keeps it from pausing for a question nobody will answer.
 * - Copilot does not report a cost, so steps record none.
 */
export class CopilotAgent implements AgentAdapter {
  readonly name = "copilot";

  constructor(private readonly options: CliAgentOptions = {}) {}

  args(prompt: string): string[] {
    return [
      "-p",
      prompt,
      "--silent",
      "--no-ask-user",
      "--no-color",
      "--allow-tool=read,write",
      "--deny-tool=shell,url",
    ];
  }

  async run(task: AgentTask): Promise<AgentResult> {
    const env = this.options.env ?? process.env;
    const command = this.options.command ?? env.AGENT_ROUNDS_COPILOT_BIN ?? "copilot";
    const role = await readFile(task.systemPromptPath, "utf8");
    const p = await runProcess(command, this.args(copilotPrompt(role, task.prompt)), {
      cwd: task.cwd,
      timeoutMs: task.timeoutMs,
      env,
    });
    if (p.error) return { exitCode: p.exitCode === 0 ? 1 : p.exitCode, error: p.error };
    if (p.exitCode !== 0) {
      return {
        exitCode: p.exitCode,
        error: lastLine(p.stderr) ?? lastLine(p.stdout) ?? `copilot exited with code ${p.exitCode}`,
      };
    }
    return { exitCode: 0 };
  }
}

/** Role prompt first, then the task, separated so the model can tell them apart. */
export function copilotPrompt(role: string, task: string): string {
  return `${role.trimEnd()}\n\n---\n\n${task}`;
}
