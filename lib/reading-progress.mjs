export const READING_STORAGE_KEY = "unseen-horizons-birthday:2026:reading:v2";
export const EMPTY_READING_PROGRESS = Object.freeze({ version: 2, overview: false, opened: 0 });

export function parseReadingProgress(value) {
  try {
    const record = JSON.parse(value);
    if (record?.version !== 2 || typeof record.overview !== "boolean" ||
      !Number.isInteger(record.opened) || record.opened < 0 || record.opened > 7) return { ...EMPTY_READING_PROGRESS };
    return { version: 2, overview: record.overview || record.opened > 0, opened: record.opened };
  } catch { return { ...EMPTY_READING_PROGRESS }; }
}

export function advanceReadingProgress(record, { atOverview = false, openedFinding = null } = {}) {
  const validIndex = Number.isInteger(openedFinding) && openedFinding >= 0 && openedFinding < 3;
  return {
    version: 2,
    overview: record.overview || atOverview || validIndex,
    opened: record.opened | (validIndex ? 1 << openedFinding : 0),
  };
}

export function readingShortcutLabel(record) {
  if (!record.overview) return null;
  return record.opened === 7 ? "回看三件小东西" : "继续翻阅三件小东西";
}

// Preview visits never read or write the normal browser record. The legacy
// overview-only flag cannot establish that any of the three details was opened.
export function updateReadingProgress({ storage, preview, current, atOverview = false, openedFinding = null }) {
  let record = current;
  if (!preview) {
    try {
      const stored = parseReadingProgress(storage.getItem(READING_STORAGE_KEY));
      record = { version: 2, overview: current.overview || stored.overview, opened: current.opened | stored.opened };
    } catch { /* Continue with this visit's memory when storage is unavailable. */ }
  }
  const next = advanceReadingProgress(record, { atOverview, openedFinding });
  if (!preview) {
    try { storage.setItem(READING_STORAGE_KEY, JSON.stringify(next)); } catch { /* The shortcut still works for this visit. */ }
  }
  return next;
}
