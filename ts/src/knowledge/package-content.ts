import { PLAYBOOK_MARKERS } from "./playbook.js";
import { HarnessStore } from "./harness-store.js";
import { cleanLessons } from "./skill-package.js";

export function extractMarkedSection(
  content: string,
  startMarker: string,
  endMarker: string,
): string {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) return "";
  return content.slice(start + startMarker.length, end).trim();
}

export function lessonsFromPlaybook(playbook: string): string[] {
  const lessonsBlock = extractMarkedSection(
    playbook,
    PLAYBOOK_MARKERS.LESSONS_START,
    PLAYBOOK_MARKERS.LESSONS_END,
  );
  if (!lessonsBlock) return [];
  const rawBullets = lessonsBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"));
  return cleanLessons(rawBullets);
}

export function hintsFromPlaybook(playbook: string): string {
  return extractMarkedSection(
    playbook,
    PLAYBOOK_MARKERS.HINTS_START,
    PLAYBOOK_MARKERS.HINTS_END,
  );
}

export function harnessForScenario(
  knowledgeRoot: string,
  scenarioName: string,
): Record<string, string> {
  const store = new HarnessStore(knowledgeRoot, scenarioName);
  const harness: Record<string, string> = {};
  for (const name of store.listHarness()) {
    const source = store.read(name);
    if (source) {
      harness[name] = source;
    }
  }
  return harness;
}
