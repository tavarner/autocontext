import { z } from "zod";

interface ToolServer {
  tool(
    name: string,
    description: string,
    schema: Record<string, unknown>,
    handler: (args: Record<string, unknown>) => Promise<{
      content: Array<{ type: "text"; text: string }>;
    }>,
  ): void;
}

interface SolveManagerLike {
  submit(description: string, generations: number): string;
  getStatus(jobId: string): Record<string, unknown>;
  getResult(jobId: string): Record<string, unknown> | null;
}

function jsonContent(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function buildSolveResultNotFoundPayload(jobId: string): Record<string, unknown> {
  return { error: "Job not completed or not found", jobId };
}

export function registerSolveTools(
  server: ToolServer,
  opts: { solveManager: SolveManagerLike },
): void {
  server.tool(
    "solve_scenario",
    "Submit a problem for on-demand solving. Returns a job_id for polling.",
    { description: z.string(), generations: z.number().int().default(5) },
    async (args) => {
      const jobId = opts.solveManager.submit(
        String(args.description),
        Number(args.generations ?? 5),
      );
      return jsonContent({ jobId, status: "pending" });
    },
  );

  server.tool(
    "solve_status",
    "Check status of a solve-on-demand job",
    { jobId: z.string() },
    async (args) => jsonContent(opts.solveManager.getStatus(String(args.jobId))),
  );

  server.tool(
    "solve_result",
    "Get the exported skill package result of a completed solve-on-demand job",
    { jobId: z.string() },
    async (args) => {
      const jobId = String(args.jobId);
      return jsonContent(
        opts.solveManager.getResult(jobId) ?? buildSolveResultNotFoundPayload(jobId),
      );
    },
  );
}
