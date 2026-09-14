import { countGraphemes, splitGraphemes } from "unicode-segmenter/grapheme";

export const QUESTION_DRAFT_LIMIT = 4000;
export const QUESTION_TEXT_BYTES = 256 * 1024;
export { splitGraphemes };
export const visibleLength = (text) => countGraphemes(text);
export const normalizeQuestionText = (text) => text.replace(/\r\n?/g, "\n");

export class QuestionTextError extends RangeError {
  constructor(code, message) { super(message); this.name = "QuestionTextError"; this.code = code; }
}

// The byte check runs before segmentation, including on a very large paste.
// Never truncate an edit: the caller retains its last complete valid draft.
export function validateQuestionText(value) {
  if (typeof value !== "string") throw new QuestionTextError("invalid", "这段内容无法识别，原有填写仍保留。");
  if (value.length > QUESTION_TEXT_BYTES || new TextEncoder().encode(value).length > QUESTION_TEXT_BYTES) {
    throw new QuestionTextError("bytes", "这段文字包含过长的组合字符，请缩短后再试。原有填写仍保留。");
  }
  const text = normalizeQuestionText(value);
  for (const char of text) {
    const point = char.codePointAt(0);
    if (point >= 0xd800 && point <= 0xdfff) throw new QuestionTextError("invalid", "这段文字包含不完整的字符，请重新复制。原有填写仍保留。");
  }
  const length = visibleLength(text);
  if (length > QUESTION_DRAFT_LIMIT) {
    throw new QuestionTextError("length", "这段内容放不下了，原有填写仍保留。最多可以写 4,000 个字符，空格和换行也计入。");
  }
  return { text, length };
}
