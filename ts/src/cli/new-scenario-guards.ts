export function ensureNewScenarioDescription(opts: {
  description: string | undefined;
  errorMessage: string;
}): string {
  if (!opts.description) {
    throw new Error(opts.errorMessage);
  }
  return opts.description;
}

export function ensureMaterializedScenario(result: {
  persisted: boolean;
  errors: string[];
}): void {
  if (result.persisted && result.errors.length === 0) {
    return;
  }

  const message =
    result.errors.length > 0
      ? result.errors.join("; ")
      : "scenario materialization did not produce a runnable custom artifact";
  throw new Error(`Error: ${message}`);
}
