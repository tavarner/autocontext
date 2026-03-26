/**
 * Code mission verifiers and factory (AC-415).
 *
 * Hard external verifiers that run shell commands (test, lint, build)
 * and determine mission success from exit codes.
 */

import { execFileSync } from "node:child_process";
import { z } from "zod";
import type { MissionManager } from "./manager.js";
import type { VerifierResult } from "./types.js";
import { MissionBudgetSchema } from "./types.js";

// ---------------------------------------------------------------------------
// Verifier interface
// ---------------------------------------------------------------------------

export interface Verifier {
  label: string;
  verify(missionId: string): Promise<VerifierResult>;
}

// ---------------------------------------------------------------------------
// CommandVerifier — runs a shell command, passes on exit 0
// ---------------------------------------------------------------------------

export class CommandVerifier implements Verifier {
  readonly label: string;
  private readonly command: string;
  private readonly cwd: string;

  constructor(command: string, cwd: string) {
    this.command = command;
    this.label = command;
    this.cwd = cwd;
  }

  async verify(_missionId: string): Promise<VerifierResult> {
    try {
      const stdout = execFileSync("/bin/sh", ["-c", this.command], {
        cwd: this.cwd,
        encoding: "utf-8",
        timeout: 120_000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return {
        passed: true,
        reason: `Command '${this.command}' passed (exit 0)`,
        suggestions: [],
        metadata: { stdout: stdout.trim(), command: this.command },
      };
    } catch (err) {
      const exitCode = (err as { status?: number }).status ?? 1;
      const stderr = (err as { stderr?: string }).stderr ?? "";
      const stdout = (err as { stdout?: string }).stdout ?? "";
      return {
        passed: false,
        reason: `Command '${this.command}' failed (exit ${exitCode})`,
        suggestions: stderr ? [`stderr: ${stderr.trim().slice(0, 500)}`] : [],
        metadata: {
          command: this.command,
          exitCode,
          stdout: stdout.trim().slice(0, 2000),
          stderr: stderr.trim().slice(0, 2000),
        },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// CompositeVerifier — all verifiers must pass (short-circuit)
// ---------------------------------------------------------------------------

export class CompositeVerifier implements Verifier {
  readonly label: string;
  private readonly verifiers: Verifier[];

  constructor(verifiers: Verifier[]) {
    this.verifiers = verifiers;
    this.label = verifiers.map((v) => v.label).join(" && ");
  }

  async verify(missionId: string): Promise<VerifierResult> {
    for (const verifier of this.verifiers) {
      const result = await verifier.verify(missionId);
      if (!result.passed) {
        return {
          passed: false,
          reason: result.reason,
          suggestions: result.suggestions ?? [],
          metadata: { ...result.metadata, failedVerifier: verifier.label },
        };
      }
    }
    return {
      passed: true,
      reason: `All ${this.verifiers.length} verifier(s) passed`,
      suggestions: [],
      metadata: { verifierCount: this.verifiers.length },
    };
  }
}

// ---------------------------------------------------------------------------
// CodeMissionSpec
// ---------------------------------------------------------------------------

export const CodeMissionSpecSchema = z.object({
  name: z.string(),
  goal: z.string(),
  repoPath: z.string(),
  testCommand: z.string(),
  lintCommand: z.string().optional(),
  buildCommand: z.string().optional(),
  budget: MissionBudgetSchema.optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type CodeMissionSpec = z.infer<typeof CodeMissionSpecSchema>;

// ---------------------------------------------------------------------------
// createCodeMission — factory
// ---------------------------------------------------------------------------

export function createCodeMission(
  manager: MissionManager,
  spec: CodeMissionSpec,
): string {
  const parsed = CodeMissionSpecSchema.parse(spec);

  const id = manager.create({
    name: parsed.name,
    goal: parsed.goal,
    budget: parsed.budget,
    metadata: { ...parsed.metadata, missionType: "code", repoPath: parsed.repoPath },
  });

  // Build verifier chain
  const verifiers: Verifier[] = [
    new CommandVerifier(parsed.testCommand, parsed.repoPath),
  ];
  if (parsed.lintCommand) {
    verifiers.push(new CommandVerifier(parsed.lintCommand, parsed.repoPath));
  }
  if (parsed.buildCommand) {
    verifiers.push(new CommandVerifier(parsed.buildCommand, parsed.repoPath));
  }

  const verifier = verifiers.length === 1 ? verifiers[0] : new CompositeVerifier(verifiers);

  manager.setVerifier(id, async (missionId) => verifier.verify(missionId));

  return id;
}
