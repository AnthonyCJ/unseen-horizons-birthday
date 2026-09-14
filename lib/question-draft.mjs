import { validateQuestionText } from "./question-text.mjs";
export { QUESTION_DRAFT_LIMIT } from "./question-text.mjs";
const KEY_PREFIX = "unseen-horizons-birthday:2026:question-draft:v1";

// Only this tab's draft is stored. Preview and normal visits use separate keys;
// neither the gift key nor reading progress participates in this record.
export function createQuestionDraft({ storage, preview = false }) {
  const key = `${KEY_PREFIX}:${preview ? "preview" : "gift"}`;
  let text = "";
  let undoText = null;
  let storageAvailable = true;
  let clearPending = false;
  let recoveryText = null;
  try {
    const saved = storage.getItem(key);
    if (saved !== null) {
      try { text = validateQuestionText(saved).text; }
      catch (error) { if (typeof saved === "string") recoveryText = saved; throw error; }
    }
  } catch { storageAvailable = false; }

  const snapshot = () => ({ text, canUndo: undoText !== null, storageAvailable, clearPending, recoveryText });
  const persist = () => {
    try {
      if (text === "") storage.removeItem(key);
      else storage.setItem(key, text);
      storageAvailable = true;
    } catch { storageAvailable = false; }
    clearPending = text === "" && !storageAvailable;
    return snapshot();
  };
  return {
    read: snapshot,
    edit(next) {
      text = validateQuestionText(next).text;
      undoText = null;
      return persist();
    },
    clear() {
      if (text !== "") undoText = text;
      text = "";
      return persist();
    },
    undoClear() {
      if (undoText === null) return snapshot();
      text = undoText;
      undoText = null;
      return persist();
    },
  };
}
