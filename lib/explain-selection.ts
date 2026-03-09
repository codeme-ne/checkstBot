export interface ExplainSelectionPayload {
  selectedText: string;
  context?: string;
}

const DISPLAY_MESSAGE_MAX_LENGTH = 95;
const DEFAULT_CONTEXT_WINDOW = 900;
const FUZZY_MATCH_LENGTH = 50;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeSelectedText(value: string): string {
  const normalized = normalizeWhitespace(value);

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith('“') && normalized.endsWith('”'))
  ) {
    return normalized.slice(1, -1).trim();
  }

  return normalized;
}

function truncateForDisplay(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function buildExplainDisplayMessage(selectedText: string): string {
  const cleanText = sanitizeSelectedText(selectedText);
  return `Bitte erkläre die markierte Stelle im Dokument: "${truncateForDisplay(cleanText, DISPLAY_MESSAGE_MAX_LENGTH)}"`;
}

export function extractSelectionContext(
  documentContent: string,
  selectedText: string,
  maxWindowChars: number = DEFAULT_CONTEXT_WINDOW
): string {
  const normalizedContent = normalizeWhitespace(documentContent);
  const cleanSelection = sanitizeSelectedText(selectedText);

  if (!normalizedContent || !cleanSelection) {
    return '';
  }

  const loweredContent = normalizedContent.toLowerCase();
  const candidates = [
    cleanSelection,
    cleanSelection.replace(/(\.\.\.|…)+$/g, '').trim(),
  ].filter(Boolean);

  let matchStart = -1;
  let matchLength = 0;

  for (const candidate of candidates) {
    matchStart = loweredContent.indexOf(candidate.toLowerCase());
    if (matchStart >= 0) {
      matchLength = candidate.length;
      break;
    }
  }

  if (matchStart < 0) {
    const prefix = cleanSelection.slice(0, Math.min(cleanSelection.length, FUZZY_MATCH_LENGTH)).trim();
    const suffix = cleanSelection.slice(Math.max(0, cleanSelection.length - FUZZY_MATCH_LENGTH)).trim();
    const prefixIndex = prefix ? loweredContent.indexOf(prefix.toLowerCase()) : -1;
    const suffixIndex = suffix ? loweredContent.indexOf(suffix.toLowerCase()) : -1;

    if (prefixIndex >= 0) {
      matchStart = prefixIndex;
      matchLength = prefix.length;
    } else if (suffixIndex >= 0) {
      matchStart = suffixIndex;
      matchLength = suffix.length;
    }
  }

  if (matchStart < 0) {
    return truncateForDisplay(normalizedContent, maxWindowChars);
  }

  const halfWindow = Math.floor(maxWindowChars / 2);
  const sliceStart = Math.max(0, matchStart - halfWindow);
  const sliceEnd = Math.min(normalizedContent.length, matchStart + matchLength + halfWindow);
  return normalizedContent.slice(sliceStart, sliceEnd).trim();
}
