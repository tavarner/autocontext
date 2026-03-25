import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import type { RunManager, RunManagerState } from "../server/run-manager.js";
import type { EventCallback } from "../loop/events.js";
import {
  formatCommandHelp,
  handleInteractiveTuiCommand,
  type PendingLoginState,
} from "./commands.js";
import { resolveConfigDir } from "../config/index.js";

interface InteractiveTuiProps {
  manager: RunManager;
  serverUrl: string;
}

const MAX_LOG_LINES = 18;

function summarizeEvent(event: string, payload: Record<string, unknown>): string | null {
  switch (event) {
    case "run_started":
      return `run ${payload.run_id as string} started for ${payload.scenario as string}`;
    case "generation_started":
      return `generation ${String(payload.generation)} started`;
    case "role_completed":
      return `${String(payload.role)} finished in ${String(payload.latency_ms)}ms`;
    case "tournament_completed":
      return `tournament mean=${Number(payload.mean_score ?? 0).toFixed(3)} best=${Number(payload.best_score ?? 0).toFixed(3)}`;
    case "gate_decided":
      return `gate ${String(payload.decision)} (delta=${String(payload.delta ?? "?")})`;
    case "generation_completed":
      return `generation ${String(payload.generation)} stored`;
    case "run_completed":
      return `run completed after ${String(payload.completed_generations)} generations`;
    case "run_failed":
      return `run failed: ${String(payload.error ?? "unknown error")}`;
    default:
      return null;
  }
}

export function InteractiveTui({ manager, serverUrl }: InteractiveTuiProps) {
  const { exit } = useApp();
  const [state, setState] = useState<RunManagerState>(manager.getState());
  const [input, setInput] = useState("");
  const [pendingLogin, setPendingLogin] = useState<PendingLoginState | null>(null);
  const [logs, setLogs] = useState<string[]>([
    `interactive server: ${serverUrl}`,
    `available scenarios: ${manager.listScenarios().join(", ")}`,
    ...formatCommandHelp(),
  ]);

  useEffect(() => {
    const handleState = (next: RunManagerState) => {
      setState(next);
    };
    const handleEvent: EventCallback = (event, payload) => {
      const line = summarizeEvent(event, payload);
      if (line) {
        setLogs((prev) => [...prev, line].slice(-MAX_LOG_LINES));
      }
    };

    manager.subscribeState(handleState);
    manager.subscribeEvents(handleEvent);
    return () => {
      manager.unsubscribeState(handleState);
      manager.unsubscribeEvents(handleEvent);
    };
  }, [manager]);

  useInput((value, key) => {
    if (value === "c" && key.ctrl) {
      exit();
    }
  });

  const statusText = useMemo(() => {
    if (!state.active) {
      return state.paused ? "idle (paused)" : "idle";
    }
    const generation = state.generation ? `gen ${state.generation}` : "waiting";
    const phase = state.phase ?? "running";
    return `${generation} • ${phase}${state.paused ? " • paused" : ""}`;
  }, [state]);

  const submit = async (raw: string) => {
    setInput("");
    const result = await handleInteractiveTuiCommand({
      manager,
      configDir: resolveConfigDir(),
      raw,
      pendingLogin,
    });
    setPendingLogin(result.pendingLogin);
    if (result.logLines.length > 0) {
      setLogs((prev) => [...prev, ...result.logLines].slice(-MAX_LOG_LINES));
    }
    if (result.shouldExit) {
      exit();
    }
  };

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" paddingX={1} flexDirection="column">
        <Text bold>autocontext Interactive TUI</Text>
        <Text>server: {serverUrl}</Text>
        <Text>
          run: {state.runId ?? "none"} • scenario: {state.scenario ?? "none"} • status: {statusText}
        </Text>
        <Text dimColor>Ctrl+C exits. Use /help for commands.</Text>
      </Box>

      <Box marginTop={1} borderStyle="round" paddingX={1} flexDirection="column">
        <Text bold>Recent Activity</Text>
        {logs.map((line, idx) => (
          <Text key={`${idx}-${line}`}>{line}</Text>
        ))}
      </Box>

      <Box marginTop={1} borderStyle="round" paddingX={1}>
        <Text color="cyan">{">"} </Text>
        <TextInput value={input} onChange={setInput} onSubmit={(value) => { void submit(value); }} />
      </Box>
    </Box>
  );
}
