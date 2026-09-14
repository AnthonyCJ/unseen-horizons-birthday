export const QUESTION_DRAFT_LIMIT: number;
export type QuestionDraftSnapshot = {
  text: string;
  canUndo: boolean;
  storageAvailable: boolean;
  clearPending: boolean;
  recoveryText: string | null;
};
export function createQuestionDraft(options: {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  preview?: boolean;
}): {
  read(): QuestionDraftSnapshot;
  edit(text: string): QuestionDraftSnapshot;
  clear(): QuestionDraftSnapshot;
  undoClear(): QuestionDraftSnapshot;
};
