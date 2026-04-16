/**
 * Pi RPC runtime — subprocess stdin/stdout JSONL communication with Pi.
 * Mirrors Python's autocontext/runtimes/pi_rpc.py.
 */

import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { AgentOutput } from "./base.js";

export interface PiRPCConfigOpts {
  piCommand?: string;
  model?: string;
  timeout?: number;
  sessionPersistence?: boolean;
  noContextFiles?: boolean;
  extraArgs?: string[];
}

export class PiRPCConfig {
  readonly piCommand: string;
  readonly model: string;
  readonly timeout: number;
  readonly sessionPersistence: boolean;
  readonly noContextFiles: boolean;
  readonly extraArgs: string[];

  constructor(opts: PiRPCConfigOpts = {}) {
    this.piCommand = opts.piCommand ?? "pi";
    this.model = opts.model ?? "";
    this.timeout = opts.timeout ?? 120.0;
    this.sessionPersistence = opts.sessionPersistence ?? true;
    this.noContextFiles = opts.noContextFiles ?? false;
    this.extraArgs = [...(opts.extraArgs ?? [])];
  }
}

export class PiRPCRuntime {
  readonly name = "pi-rpc";
  private config: PiRPCConfig;
  private _currentSessionId: string | null = null;

  constructor(config?: PiRPCConfig) {
    this.config = config ?? new PiRPCConfig();
  }

  get currentSessionId(): string | null {
    return this._currentSessionId;
  }

  async generate(opts: { prompt: string; system?: string }): Promise<AgentOutput> {
    const fullPrompt = opts.system ? `${opts.system}\n\n${opts.prompt}` : opts.prompt;
    const args = this.buildArgs();
    const input = `${JSON.stringify(this.buildPromptCommand(fullPrompt))}\n`;

    try {
      const stdout = execFileSync(this.config.piCommand, args, {
        input,
        timeout: this.config.timeout * 1000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return this.parseOutput(stdout, 0, "");
    } catch (err: unknown) {
      const error = err as {
        code?: string;
        status?: number;
        stdout?: string | Buffer;
        stderr?: string | Buffer;
        message?: string;
      };
      if (error.code === "ETIMEDOUT") {
        return { text: "", metadata: { error: "timeout" } };
      }
      if (error.code === "ENOENT") {
        return { text: "", metadata: { error: "pi_not_found" } };
      }

      const stdout = this.normalizeOutput(error.stdout);
      const stderr = this.normalizeOutput(error.stderr);
      if (stdout.trim()) {
        return this.parseOutput(stdout, error.status ?? 1, stderr);
      }
      return {
        text: "",
        metadata: {
          error: "nonzero_exit",
          exitCode: error.status ?? 1,
          stderr: stderr || error.message || "unknown",
        },
      };
    }
  }

  async revise(opts: {
    prompt: string;
    previousOutput: string;
    feedback: string;
  }): Promise<AgentOutput> {
    return this.generate({
      prompt: [
        `Revise the following output based on the judge's feedback.`,
        `## Original Output\n${opts.previousOutput}`,
        `## Judge Feedback\n${opts.feedback}`,
        `## Original Task\n${opts.prompt}`,
        `Produce an improved version:`,
      ].join("\n\n"),
    });
  }

  private buildArgs(): string[] {
    const args = ["--mode", "rpc"];
    if (this.config.model) {
      args.push("--model", this.config.model);
    }
    if (this.config.noContextFiles) {
      args.push("--no-context-files");
    }
    if (!this.config.sessionPersistence) {
      args.push("--no-session");
    }
    args.push(...this.config.extraArgs);
    return args;
  }

  private buildPromptCommand(prompt: string): { type: string; id: string; message: string } {
    return {
      type: "prompt",
      id: randomUUID().slice(0, 8),
      message: prompt,
    };
  }

  private parseOutput(raw: string, exitCode: number, stderr: string): AgentOutput {
    const trimmed = raw.trim();
    if (!trimmed) {
      return exitCode === 0
        ? { text: "", metadata: { exitCode } }
        : {
            text: "",
            metadata: {
              error: "nonzero_exit",
              exitCode,
              stderr,
            },
          };
    }

    const textParts: string[] = [];

    for (const line of trimmed.split("\n")) {
      const record = line.trim();
      if (!record) continue;

      try {
        const event = JSON.parse(record) as {
          type?: string;
          success?: boolean;
          command?: string;
          error?: unknown;
          data?: { content?: unknown; session_id?: unknown; sessionId?: unknown };
          message?: { content?: unknown };
          messages?: Array<{ role?: string; content?: unknown }>;
          session_id?: unknown;
          sessionId?: unknown;
        };
        this.updateSessionId(event);

        if (event.type === "response") {
          if (event.success === false) {
            return {
              text: "",
              metadata: {
                error: "rpc_response_error",
                rpcCommand: String(event.command ?? ""),
                rpcMessage: String(event.error ?? "unknown"),
                exitCode,
                ...(stderr ? { stderr } : {}),
              },
            };
          }

          if (typeof event.data?.content === "string" && event.data.content) {
            textParts.push(event.data.content);
          }
          continue;
        }

        if (event.type === "message_end") {
          if (typeof event.message?.content === "string" && event.message.content) {
            textParts.push(event.message.content);
          }
          continue;
        }

        if (event.type === "agent_end") {
          for (const message of event.messages ?? []) {
            if (
              message.role === "assistant" &&
              typeof message.content === "string" &&
              message.content
            ) {
              textParts.push(message.content);
            }
          }
        }
      } catch {
        if (textParts.length === 0) {
          return exitCode === 0
            ? { text: trimmed, metadata: { exitCode } }
            : {
                text: "",
                metadata: {
                  error: "nonzero_exit",
                  exitCode,
                  ...(stderr ? { stderr } : {}),
                  stdout: trimmed,
                },
              };
        }
      }
    }

    if (textParts.length > 0) {
      return {
        text: textParts[textParts.length - 1] ?? "",
        metadata: {
          exitCode,
          ...(this._currentSessionId ? { sessionId: this._currentSessionId } : {}),
        },
      };
    }

    return exitCode === 0
      ? { text: trimmed, metadata: { exitCode } }
      : {
          text: "",
          metadata: {
            error: "nonzero_exit",
            exitCode,
            ...(stderr ? { stderr } : {}),
            stdout: trimmed,
          },
        };
  }

  private updateSessionId(event: {
    data?: { session_id?: unknown; sessionId?: unknown };
    session_id?: unknown;
    sessionId?: unknown;
  }): void {
    const candidate =
      event.data?.session_id ?? event.data?.sessionId ?? event.session_id ?? event.sessionId;
    if (typeof candidate === "string" && candidate) {
      this._currentSessionId = candidate;
    }
  }

  private normalizeOutput(value: string | Buffer | undefined): string {
    if (typeof value === "string") {
      return value;
    }
    if (value) {
      return value.toString("utf-8");
    }
    return "";
  }
}
