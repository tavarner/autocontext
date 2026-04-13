export interface NormalizedImportedScenario {
  name: string;
  family: string;
  spec: Record<string, unknown> & {
    taskPrompt: string;
    rubric: string;
    description: string;
  };
}

export interface MaterializedScenarioOutput {
  scenarioDir: string;
  generatedSource: boolean;
  persisted: boolean;
}

export interface TemplateListEntry {
  name: string;
  outputFormat?: string;
  maxRounds?: number;
  description?: string;
}

export interface TemplateLoaderLike {
  getTemplate(name: string): unknown;
  listTemplates(): Array<{ name: string }>;
  scaffold(template: string, targetDir: string, vars: { name: string }): void;
}

export interface TemplateScaffoldPayload {
  name: string;
  template: string;
  family: string;
  path: string;
}

export interface CreatedScenarioOutput {
  name: string;
  family: string;
  spec: {
    taskPrompt: string;
    rubric: string;
    description: string;
    [key: string]: unknown;
  };
}

export interface ImportedScenarioMaterializationResult {
  scenarioDir: string;
  generatedSource: boolean;
  persisted: boolean;
  errors: string[];
}
