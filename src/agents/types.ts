/**
 * What the runner hands an agent for one step. Every path is relative to `cwd`
 * (the run folder) and uses forward slashes, except `systemPromptPath`.
 */
export interface AgentTask {
  team: string;
  roleId: string;
  kind: "author" | "critic";
  round: number;
  /** The run folder. The agent process uses it as its working directory. */
  cwd: string;
  /** Absolute path to the role prompt; adapters pass it as the system prompt. */
  systemPromptPath: string;
  /** The task text built by the runner (see core/task.ts). */
  prompt: string;
  /** The original request, as written in 00-request.md. */
  request: string;
  reads: string[];
  /** Files (or "folder/" entries) the agent is allowed and required to write. */
  writes: string[];
  /** Critic only: the author's files under review. */
  reviews?: string[];
  /** Author on round > 1: the critique to address. */
  critique?: string;
  timeoutMs: number;
}

export interface AgentResult {
  /** 0 means the agent finished; contracts are still checked afterwards. */
  exitCode: number;
  /** Reported by the agent CLI when it knows it (Claude: total_cost_usd; Copilot: none). */
  costUsd?: number;
  /** Short human-readable reason when exitCode is not 0. */
  error?: string;
}

/**
 * One agent CLI: `mock` (deterministic), `claude` (claude -p) and
 * `copilot` (copilot -p). Other CLIs fit the same shape.
 */
export interface AgentAdapter {
  readonly name: string;
  run(task: AgentTask): Promise<AgentResult>;
}
