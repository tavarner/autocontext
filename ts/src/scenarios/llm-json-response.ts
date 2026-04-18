export function parseJsonObjectFromResponse(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // continue
  }

  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
    } catch {
      // continue
    }
  }

  return null;
}

export function parseDelimitedJsonObject(opts: {
  text: string;
  startDelimiter: string;
  endDelimiter: string;
  missingDelimiterLabel: string;
}): Record<string, unknown> {
  const { text, startDelimiter, endDelimiter, missingDelimiterLabel } = opts;
  const startIdx = text.indexOf(startDelimiter);
  const endIdx = text.indexOf(endDelimiter);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const raw = text.slice(startIdx + startDelimiter.length, endIdx).trim();
    return JSON.parse(raw) as Record<string, unknown>;
  }

  const parsed = parseJsonObjectFromResponse(text);
  if (parsed) {
    return parsed;
  }

  throw new Error(`response does not contain ${missingDelimiterLabel} delimiters`);
}
