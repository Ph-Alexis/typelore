import { COMMAND_RULES, parseGameCommand, parseCommandTarget, type GameCommand } from "@typelore/shared";

export interface TypingState {
  phase: "COMMAND" | "TARGET" | "SUBMIT";
  draft: string;
  command: GameCommand | null;
  feedback: string;
  error: boolean;
}
export const initialTypingState: TypingState = {
  phase: "COMMAND", draft: "", command: null, feedback: "", error: false,
};
export type ParsedCommand = { command: GameCommand; target?: number };
export function editDraft(draft: string, start: number, end: number,
  operation: string, limit: number): { draft: string; caret: number } {
  if (operation === "Delete") return { draft: "", caret: 0 };
  if (operation === "Backspace") {
    const from = start === end ? Math.max(0, start - 1) : start;
    return { draft: draft.slice(0, from) + draft.slice(end), caret: from };
  }
  if (!/^[A-Za-z0-9 ]$/.test(operation)) return { draft, caret: start };
  const next = draft.slice(0, start) + operation + draft.slice(end);
  return next.length <= limit ? { draft: next, caret: start + 1 } : { draft, caret: start };
}
export function confirmTyping(state: TypingState): { state: TypingState; intent?: ParsedCommand } {
  if (state.phase === "SUBMIT") return { state };
  if (state.phase === "COMMAND") {
    const parsed = parseGameCommand(state.draft);
    if (!parsed.success) return { state: { ...state, error: true, feedback: "Lệnh không hợp lệ. Kiểm tra tên và khoảng trắng." } };
    const command = parsed.data;
    if (COMMAND_RULES[command] > 0) return { state: {
      phase: "TARGET", command, draft: "", feedback: "", error: false,
    } };
    return { state: { ...state, phase: "SUBMIT", command, feedback: "Đang xác thực lệnh…", error: false }, intent: { command } };
  }
  const target = state.command && parseCommandTarget(state.command, state.draft);
  if (target === null || !state.command) return { state: { ...state, error: true, feedback: "Vị trí không hợp lệ. Nhập đúng một số trong vùng cho phép." } };
  return { state: { ...state, phase: "SUBMIT", feedback: "Đang xác thực lệnh…", error: false },
    intent: { command: state.command, target } };
}
