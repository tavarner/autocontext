import type { SkillPackageData } from "./skill-package-contracts.js";

function buildFrontmatter(data: SkillPackageData): string {
  return (
    `---\nname: ${data.scenarioName.replace(/_/g, "-")}-knowledge\n` +
    `description: ${data.description.slice(0, 200)}\n---\n\n`
  );
}

export function buildSkillLessonsBlock(lessons: string[]): string {
  return lessons.length > 0
    ? lessons.map((lesson) => `- ${lesson}`).join("\n")
    : "No lessons yet.";
}

export function buildHarnessMarkdownSection(harness: Record<string, string>): string {
  const harnessEntries = Object.entries(harness).sort(([left], [right]) => left.localeCompare(right));
  if (harnessEntries.length === 0) {
    return "";
  }

  const parts = ["\n## Harness Validators\n"];
  for (const [name, source] of harnessEntries) {
    parts.push(`\n### ${name}\n\n\`\`\`python\n${source}\n\`\`\`\n`);
  }
  return parts.join("");
}

export function buildGenericSkillMarkdown(data: SkillPackageData): string {
  let strategyBlock = "";
  if (data.bestStrategy) {
    strategyBlock =
      `\n## Best Known Strategy\n\n` +
      `\`\`\`json\n${JSON.stringify(data.bestStrategy, null, 2)}\n\`\`\`\n` +
      `\nBest score: ${data.bestScore.toFixed(4)} | Best Elo: ${data.bestElo.toFixed(1)}\n`;
  }

  return (
    buildFrontmatter(data) +
    `# ${data.displayName}\n\n` +
    `${data.description}\n\n` +
    `## Operational Lessons\n\n` +
    `${buildSkillLessonsBlock(data.lessons)}\n` +
    `${strategyBlock}\n` +
    `## Playbook\n\n` +
    `${data.playbook}\n` +
    buildHarnessMarkdownSection(data.harness ?? {})
  );
}

export function buildAgentTaskSkillMarkdown(data: SkillPackageData): string {
  const parts: string[] = [
    buildFrontmatter(data) +
      `# ${data.displayName}\n\n` +
      `${data.description}\n\n` +
      `## Task\n\n` +
      `${data.taskPrompt ?? ""}\n`,
  ];

  if (data.judgeRubric) {
    parts.push(`\n## Evaluation Criteria\n\n${data.judgeRubric}\n`);
  }

  if (data.contextPreparation) {
    parts.push(`\n## Context Preparation\n\n${data.contextPreparation}\n`);
  }

  if (data.referenceContext) {
    parts.push(`\n## Reference Context\n\n${data.referenceContext}\n`);
  }

  if (data.exampleOutputs && data.exampleOutputs.length > 0) {
    parts.push("\n## Example Outputs\n");
    for (const [index, example] of data.exampleOutputs.slice(0, 3).entries()) {
      parts.push(
        `\n<details>\n<summary>Example ${index + 1} (score: ${example.score.toFixed(2)})</summary>\n\n` +
          `**Output:**\n\n${example.output}\n\n` +
          `**Reasoning:** ${example.reasoning}\n\n` +
          `</details>\n`,
      );
    }
  }

  parts.push(`\n## Operational Lessons\n\n${buildSkillLessonsBlock(data.lessons)}\n`);

  if (data.bestStrategy) {
    parts.push(
      `\n## Best Known Strategy\n\n` +
        `\`\`\`\n${JSON.stringify(data.bestStrategy, null, 2)}\n\`\`\`\n` +
        `\nBest score: ${data.bestScore.toFixed(4)} | Best Elo: ${data.bestElo.toFixed(1)}\n`,
    );
  }

  parts.push(`\n## Playbook\n\n${data.playbook}\n`);
  return parts.join("");
}

export function buildSkillPackageMarkdown(data: SkillPackageData): string {
  if (data.taskPrompt != null) {
    return buildAgentTaskSkillMarkdown(data);
  }
  return buildGenericSkillMarkdown(data);
}
