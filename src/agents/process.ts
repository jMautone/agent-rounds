import { spawn } from "node:child_process";

export interface ProcessOptions {
  cwd: string;
  timeoutMs: number;
  /** Defaults to process.env. Tests pass a PATH that points at a fake binary. */
  env?: NodeJS.ProcessEnv;
}

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** Set when the process could not start or was killed by the timeout. */
  error?: string;
}

/** Keep at most this much of each stream; agent CLIs can be chatty. */
const MAX_CAPTURE = 1024 * 1024;

/**
 * Run an agent CLI with an argument array (never a shell string), stdin closed
 * so `-p` modes do not wait for piped input, and a hard timeout.
 */
export function runProcess(
  command: string,
  args: string[],
  opts: ProcessOptions,
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const done = (r: ProcessResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };

    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      // Give the CLI a moment to exit cleanly, then make sure it is gone.
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, opts.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (stdout.length < MAX_CAPTURE) stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      if (stderr.length < MAX_CAPTURE) stderr += chunk;
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      const error =
        err.code === "ENOENT"
          ? `"${command}" was not found on PATH`
          : `could not start "${command}": ${err.message}`;
      done({ exitCode: 127, stdout, stderr, error });
    });

    child.on("close", (code, signal) => {
      if (timedOut) {
        const minutes = Math.round((opts.timeoutMs / 60_000) * 10) / 10;
        done({ exitCode: 124, stdout, stderr, error: `timed out after ${minutes} min` });
        return;
      }
      done({
        exitCode: code ?? 1,
        stdout,
        stderr,
        ...(signal ? { error: `killed by ${signal}` } : {}),
      });
    });
  });
}

/** Last non-blank line of a stream, trimmed to a readable length, for error messages. */
export function lastLine(text: string, max = 200): string | undefined {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .at(-1);
  if (!line) return undefined;
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
