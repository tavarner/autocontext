/**
 * Curator output parsing — extract decisions, scores, playbooks, lessons (AC-349 Task 32).
 * Mirrors Python's autocontext/agents/curator.py parsing logic.
 */

export interface CuratorPlaybookDecision {
  decision: "accept" | "reject" | "merge";
  playbook: string;
  score: number;
  reasoning: string;
}

export interface CuratorLessonResult {
  consolidatedLessons: string;
  removedCount: number;
  reasoning: string;
}

const CURATOR_DECISION_REGEX = /<!--\s*CURATOR_DECISION:\s*(accept|reject|merge)\s*-->/;
const CURATOR_SCORE_REGEX = /<!--\s*CURATOR_SCORE:\s*(\d+)\s*-->/;
const LESSONS_REMOVED_REGEX = /<!--\s*LESSONS_REMOVED:\s*(\d+)\s*-->/;
const CONSOLIDATED_LESSONS_BLOCK_REGEX =
  /<!--\s*CONSOLIDATED_LESSONS_START\s*-->[\s\S]*?<!--\s*CONSOLIDATED_LESSONS_END\s*-->/;

export function parseCuratorPlaybookDecision(text: string): CuratorPlaybookDecision {
  const decisionMatch = CURATOR_DECISION_REGEX.exec(text);
  const decision = (decisionMatch?.[1] ?? "reject") as CuratorPlaybookDecision["decision"];

  const scoreMatch = CURATOR_SCORE_REGEX.exec(text);
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;

  let playbook = "";
  const playbookStartMarker = "<!-- CURATOR_PLAYBOOK_START -->";
  const playbookEndMarker = "<!-- CURATOR_PLAYBOOK_END -->";
  const playbookStart = text.indexOf(playbookStartMarker);
  const playbookEnd = text.indexOf(playbookEndMarker);
  if (playbookStart !== -1 && playbookEnd !== -1) {
    playbook = text.slice(playbookStart + playbookStartMarker.length, playbookEnd).trim();
  }

  const firstMarker = Math.min(
    ...[decisionMatch?.index, scoreMatch?.index, playbookStart]
      .filter((i): i is number => i !== undefined && i !== -1),
  );
  const reasoning = Number.isFinite(firstMarker) ? text.slice(0, firstMarker).trim() : text.trim();

  return { decision, playbook, score, reasoning };
}

export function parseCuratorLessonResult(text: string): CuratorLessonResult {
  let consolidatedLessons = "";
  const lessonsStartMarker = "<!-- CONSOLIDATED_LESSONS_START -->";
  const lessonsEndMarker = "<!-- CONSOLIDATED_LESSONS_END -->";
  const lessonsStart = text.indexOf(lessonsStartMarker);
  const lessonsEnd = text.indexOf(lessonsEndMarker);
  if (lessonsStart !== -1 && lessonsEnd !== -1) {
    consolidatedLessons = text
      .slice(lessonsStart + lessonsStartMarker.length, lessonsEnd)
      .trim();
  }

  const removedMatch = LESSONS_REMOVED_REGEX.exec(text);
  const removedCount = removedMatch ? parseInt(removedMatch[1], 10) : 0;

  const reasoning = text
    .replace(CONSOLIDATED_LESSONS_BLOCK_REGEX, "")
    .replace(LESSONS_REMOVED_REGEX, "")
    .trim();

  return { consolidatedLessons, removedCount, reasoning };
}
