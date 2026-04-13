export interface ImportedScenarioCoreFields {
  name: string;
  taskPrompt: string;
  rubric: string;
  description: string;
}

export function parseImportedScenarioCoreFields(
  spec: Record<string, unknown>,
): ImportedScenarioCoreFields {
  const name = typeof spec.name === "string" ? spec.name.trim() : "";
  const taskPrompt = typeof spec.taskPrompt === "string" ? spec.taskPrompt.trim() : "";
  const rubric = typeof spec.rubric === "string" ? spec.rubric.trim() : "";
  const description = typeof spec.description === "string" ? spec.description : "";

  if (!name || !taskPrompt || !rubric) {
    throw new Error("Error: spec must contain name, taskPrompt, and rubric fields");
  }

  return {
    name,
    taskPrompt,
    rubric,
    description,
  };
}
