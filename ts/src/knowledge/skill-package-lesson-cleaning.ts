const ROLLBACK_RE = /^-\s*Generation\s+\d+\s+ROLLBACK\b/i;
const RAW_JSON_RE = /\{"[a-z_]+"\s*:\s*[\d.]+/;
const SCORE_PARENS_RE = /\(score=[0-9.]+,\s*delta=[0-9.+-]+,\s*threshold=[0-9.]+\)/g;

export function cleanLessons(rawBullets: string[]): string[] {
  const cleaned: string[] = [];
  for (const bullet of rawBullets) {
    const text = bullet.trim();
    if (!text) {
      continue;
    }
    let content = text.startsWith("- ") ? text.slice(2) : text;
    if (ROLLBACK_RE.test(text)) {
      continue;
    }
    if (RAW_JSON_RE.test(content) && content.trim().startsWith("{")) {
      continue;
    }
    content = content.replace(SCORE_PARENS_RE, "").trim();
    if (content) {
      cleaned.push(content);
    }
  }
  return cleaned;
}
