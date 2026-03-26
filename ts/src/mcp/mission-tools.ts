import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MissionManager } from "../mission/manager.js";
import { createCodeMission } from "../mission/verifiers.js";
import {
  buildMissionArtifactsPayload,
  buildMissionResultPayload,
  buildMissionStatusPayload,
  writeMissionCheckpoint,
} from "../mission/control-plane.js";

export interface MissionToolDef {
  name: string;
  description: string;
  schema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export const MISSION_TOOLS: MissionToolDef[] = [
  {
    name: "create_mission",
    description: "Create a new verifier-driven mission",
    schema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Mission type: generic or code" },
        name: { type: "string", description: "Mission name" },
        goal: { type: "string", description: "Mission goal / objective" },
        max_steps: { type: "number", description: "Maximum steps budget (optional)" },
        repo_path: { type: "string", description: "Repo path for code missions" },
        test_command: { type: "string", description: "Test command for code missions" },
        lint_command: { type: "string", description: "Optional lint command for code missions" },
        build_command: { type: "string", description: "Optional build command for code missions" },
      },
      required: ["name", "goal"],
    },
  },
  {
    name: "mission_status",
    description: "Get the current status and summary for a mission",
    schema: {
      type: "object",
      properties: {
        mission_id: { type: "string", description: "Mission ID" },
      },
      required: ["mission_id"],
    },
  },
  {
    name: "mission_result",
    description: "Get the full mission result payload, including steps and verifications",
    schema: {
      type: "object",
      properties: {
        mission_id: { type: "string", description: "Mission ID" },
      },
      required: ["mission_id"],
    },
  },
  {
    name: "mission_artifacts",
    description: "Inspect durable checkpoint artifacts for a mission",
    schema: {
      type: "object",
      properties: {
        mission_id: { type: "string", description: "Mission ID" },
      },
      required: ["mission_id"],
    },
  },
  {
    name: "pause_mission",
    description: "Pause an active mission",
    schema: {
      type: "object",
      properties: {
        mission_id: { type: "string", description: "Mission ID to pause" },
      },
      required: ["mission_id"],
    },
  },
  {
    name: "resume_mission",
    description: "Resume a paused mission",
    schema: {
      type: "object",
      properties: {
        mission_id: { type: "string", description: "Mission ID to resume" },
      },
      required: ["mission_id"],
    },
  },
  {
    name: "cancel_mission",
    description: "Cancel a mission",
    schema: {
      type: "object",
      properties: {
        mission_id: { type: "string", description: "Mission ID to cancel" },
      },
      required: ["mission_id"],
    },
  },
];

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

export function registerMissionTools(
  server: McpServer,
  opts: { dbPath: string; runsRoot: string },
): void {
  const withManager = async <T>(fn: (manager: MissionManager) => Promise<T> | T): Promise<T> => {
    const manager = new MissionManager(opts.dbPath);
    try {
      return await fn(manager);
    } finally {
      manager.close();
    }
  };

  server.tool(
    "create_mission",
    "Create a new verifier-driven mission",
    {
      type: z.enum(["generic", "code"]).default("generic"),
      name: z.string(),
      goal: z.string(),
      max_steps: z.number().int().positive().optional(),
      repo_path: z.string().optional(),
      test_command: z.string().optional(),
      lint_command: z.string().optional(),
      build_command: z.string().optional(),
    },
    async (args) => withManager((manager) => {
      const budget = args.max_steps ? { maxSteps: args.max_steps } : undefined;
      let missionId: string;
      if (args.type === "code" || args.repo_path || args.test_command || args.lint_command || args.build_command) {
        if (!args.repo_path || !args.test_command) {
          return jsonContent({ error: "Code missions require repo_path and test_command" });
        }
        missionId = createCodeMission(manager, {
          name: args.name,
          goal: args.goal,
          repoPath: args.repo_path,
          testCommand: args.test_command,
          lintCommand: args.lint_command,
          buildCommand: args.build_command,
          budget,
          metadata: {},
        });
      } else {
        missionId = manager.create({
          name: args.name,
          goal: args.goal,
          budget,
        });
      }
      const checkpointPath = writeMissionCheckpoint(manager, missionId, opts.runsRoot);
      return jsonContent({
        ...buildMissionStatusPayload(manager, missionId),
        checkpointPath,
      });
    }),
  );

  server.tool(
    "mission_status",
    "Get the current status and summary for a mission",
    { mission_id: z.string() },
    async (args) => withManager((manager) => {
      if (!manager.get(args.mission_id)) {
        return jsonContent({ error: `Mission not found: ${args.mission_id}` });
      }
      return jsonContent(buildMissionStatusPayload(manager, args.mission_id));
    }),
  );

  server.tool(
    "mission_result",
    "Get the full mission result payload, including steps and verifications",
    { mission_id: z.string() },
    async (args) => withManager((manager) => {
      if (!manager.get(args.mission_id)) {
        return jsonContent({ error: `Mission not found: ${args.mission_id}` });
      }
      return jsonContent(buildMissionResultPayload(manager, args.mission_id));
    }),
  );

  server.tool(
    "mission_artifacts",
    "Inspect durable checkpoint artifacts for a mission",
    { mission_id: z.string() },
    async (args) => withManager((manager) => {
      if (!manager.get(args.mission_id)) {
        return jsonContent({ error: `Mission not found: ${args.mission_id}` });
      }
      return jsonContent(buildMissionArtifactsPayload(manager, args.mission_id, opts.runsRoot));
    }),
  );

  server.tool(
    "pause_mission",
    "Pause an active mission",
    { mission_id: z.string() },
    async (args) => withManager((manager) => {
      if (!manager.get(args.mission_id)) {
        return jsonContent({ error: `Mission not found: ${args.mission_id}` });
      }
      manager.pause(args.mission_id);
      const checkpointPath = writeMissionCheckpoint(manager, args.mission_id, opts.runsRoot);
      return jsonContent({
        ...buildMissionStatusPayload(manager, args.mission_id),
        checkpointPath,
      });
    }),
  );

  server.tool(
    "resume_mission",
    "Resume a paused mission",
    { mission_id: z.string() },
    async (args) => withManager((manager) => {
      if (!manager.get(args.mission_id)) {
        return jsonContent({ error: `Mission not found: ${args.mission_id}` });
      }
      manager.resume(args.mission_id);
      const checkpointPath = writeMissionCheckpoint(manager, args.mission_id, opts.runsRoot);
      return jsonContent({
        ...buildMissionStatusPayload(manager, args.mission_id),
        checkpointPath,
      });
    }),
  );

  server.tool(
    "cancel_mission",
    "Cancel a mission",
    { mission_id: z.string() },
    async (args) => withManager((manager) => {
      if (!manager.get(args.mission_id)) {
        return jsonContent({ error: `Mission not found: ${args.mission_id}` });
      }
      manager.cancel(args.mission_id);
      const checkpointPath = writeMissionCheckpoint(manager, args.mission_id, opts.runsRoot);
      return jsonContent({
        ...buildMissionStatusPayload(manager, args.mission_id),
        checkpointPath,
      });
    }),
  );
}
