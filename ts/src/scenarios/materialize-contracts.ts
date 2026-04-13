export interface MaterializeOpts {
  /** Scenario name (used as directory name under _custom_scenarios/) */
  name: string;
  /** Scenario family */
  family: string;
  /** The scenario spec (taskPrompt, rubric, description, plus family-specific fields) */
  spec: Record<string, unknown>;
  /** Root knowledge directory (e.g., "./knowledge") */
  knowledgeRoot: string;
}

export interface MaterializeResult {
  /** Whether artifacts were persisted to disk */
  persisted: boolean;
  /** Whether executable JS source was generated (codegen families) */
  generatedSource: boolean;
  /** Absolute path to the scenario directory */
  scenarioDir: string;
  /** The family that was materialized */
  family: string;
  /** The scenario name */
  name: string;
  /** Validation errors, if any (empty = success) */
  errors: string[];
}
