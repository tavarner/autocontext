export function countImportedScenarioFamilySpecificFields(
  specFields: Record<string, unknown>,
): number {
  return Object.keys(specFields).filter(
    (key) => key !== "taskPrompt" && key !== "rubric" && key !== "description",
  ).length;
}

export function resolveImportedScenarioFamily(opts: {
  spec: Record<string, unknown>;
  description: string;
  taskPrompt: string;
  detectScenarioFamily: (description: string) => string;
  isScenarioFamilyName: (value: string) => boolean;
  validFamilies: string[];
}): {
  family: string;
  specFields: Record<string, unknown>;
} {
  let family = opts.detectScenarioFamily(
    [opts.description, opts.taskPrompt].filter(Boolean).join("\n"),
  );

  const { name: _ignoredName, family: _ignoredFamily, ...specFields } = opts.spec;

  if (typeof opts.spec.family === "string" && opts.spec.family.trim()) {
    const requestedFamily = opts.spec.family.trim();
    if (!opts.isScenarioFamilyName(requestedFamily)) {
      throw new Error(`Error: family must be one of ${opts.validFamilies.join(", ")}`);
    }

    const familySpecificFieldCount = countImportedScenarioFamilySpecificFields(specFields);
    family =
      requestedFamily !== "agent_task" &&
      requestedFamily !== "game" &&
      familySpecificFieldCount === 0
        ? "agent_task"
        : requestedFamily;
  }

  return {
    family,
    specFields,
  };
}
