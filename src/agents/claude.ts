import { lastLine, runProcess } from "./process.js";
import type { AgentAdapter, AgentResult, AgentTask } from "./types.js";

export interface CliAgentOptions {
  /** Binary to run. Defaults to the env override, then the CLI's usual name on PATH. */
  command?: string;
  /** Environment for the child process. Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Tools the role may use. File tools only: no Bash, no web, and with
 * --strict-mcp-config and no --mcp-config, no MCP servers either.
 */
export const CLAUDE_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"];

/**
 * Claude Code in headless mode (`claude -p`).
 *
 * - The role prompt is appended to Claude Code's own system prompt.
 * - `acceptEdits` approves file edits inside the working directory (the run
 *   folder). Anything else that would ask for permission is denied, because a
 *   `-p` run has nobody to answer.
 * - `--output-format json` gives a final object with `is_error`, `result` and
 *   `total_cost_usd`, which the runner records per step.
 */
export class ClaudeAgent implements AgentAdapter {
  readonly name = "claude";

  constructor(private readonly options: CliAgentOptions = {}) {}

  args(task: AgentTask): string[] {
    return [
      "-p",
      task.prompt,
      "--output-format",
      "json",
      "--append-system-prompt-file",
      task.systemPromptPath,
      "--permission-mode",
      "acceptEdits",
      "--tools",
      CLAUDE_TOOLS.join(","),
      "--strict-mcp-config",
      "--no-session-persistence",
    ];
  }

  async run(task: AgentTask): Promise<AgentResult> {
    const env = this.options.env ?? process.env;
    const command = this.options.command ?? env.AGENT_ROUNDS_CLAUDE_BIN ?? "claude";
    const p = await runProcess(command, this.args(task), {
      cwd: task.cwd,
      timeoutMs: task.timeoutMs,
      env,
    });
    const out = parseClaudeJson(p.stdout);
    const costUsd = typeof out?.total_cost_usd === "number" ? out.total_cost_usd : undefined;
    const cost = costUsd === undefined ? {} : { costUsd };

    if (p.error) return { exitCode: p.exitCode === 0 ? 1 : p.exitCode, error: p.error, ...cost };
    if (p.exitCode !== 0 || out?.is_error === true) {
      const reason =
        (typeof out?.result === "string" && lastLine(out.result)) ||
        (typeof out?.subtype === "string" && out.subtype !== "success" && out.subtype) ||
        lastLine(p.stderr) ||
        lastLine(p.stdout) ||
        `claude exited with code ${p.exitCode}`;
      return { exitCode: p.exitCode === 0 ? 1 : p.exitCode, error: reason, ...cost };
    }
    if (!out) {
      return { exitCode: 1, error: "claude did not print the JSON result (--output-format json)" };
    }
    return { exitCode: 0, ...cost };
  }
}

interface ClaudeJson {
  is_error?: unknown;
  result?: unknown;
  subtype?: unknown;
  total_cost_usd?: unknown;
}

/** The JSON result is the whole of stdout; fall back to its last JSON-looking line. */
export function parseClaudeJson(stdout: string): ClaudeJson | undefined {
  const candidates = [
    stdout.trim(),
    ...stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("{"))
      .reverse(),
  ];
  for (const text of candidates) {
    if (!text) continue;
    try {
      const value: unknown = JSON.parse(text);
      if (value && typeof value === "object" && !Array.isArray(value)) return value as ClaudeJson;
    } catch {
      // not JSON, try the next candidate
    }
  }
  return undefined;
}
