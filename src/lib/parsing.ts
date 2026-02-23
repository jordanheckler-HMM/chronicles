import type { Stats } from '../GameContext';

const CHOICE_LINE = /^[1-3]\.\s/;
const STATS_JSON = /\{[^{}]*"health"\s*:\s*-?\d+[^{}]*"weapon"\s*:\s*"[^"]*"[^{}]*"gold"\s*:\s*-?\d+[^{}]*\}/s;

function isStats(value: unknown): value is Stats {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.health === 'number' &&
    typeof candidate.weapon === 'string' &&
    typeof candidate.gold === 'number'
  );
}

export function extractStatsFromResponse(fullResponse: string): {
  cleanResponse: string;
  stats: Stats | null;
} {
  const match = fullResponse.match(STATS_JSON);
  if (!match) {
    return {
      cleanResponse: fullResponse.trim(),
      stats: null,
    };
  }

  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (!isStats(parsed)) {
      return {
        cleanResponse: fullResponse.trim(),
        stats: null,
      };
    }

    return {
      cleanResponse: fullResponse.replace(match[0], '').trim(),
      stats: parsed,
    };
  } catch {
    return {
      cleanResponse: fullResponse.trim(),
      stats: null,
    };
  }
}

export function splitNarrativeAndChoices(content: string): {
  narrative: string;
  choices: string[];
} {
  const narrativeLines: string[] = [];
  const choices: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (CHOICE_LINE.test(trimmed)) {
      choices.push(trimmed);
      continue;
    }

    if (!trimmed.startsWith('{') && !trimmed.endsWith('}')) {
      narrativeLines.push(trimmed);
    }
  }

  return {
    narrative: narrativeLines.join('\n'),
    choices,
  };
}

export function stripChoicePrefix(text: string): string {
  return text.replace(/^[1-3]\.\s*/, '').trim();
}
