export interface KeyStroke {
  key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean;
  repeat: boolean; isComposing: boolean;
}
export function blockedShortcut(event: Pick<KeyStroke, "key" | "ctrlKey" | "metaKey" | "shiftKey">): boolean {
  const key = event.key.toLowerCase();
  return ((event.ctrlKey || event.metaKey) && ["c", "v", "x", "z", "y", "insert"].includes(key)) ||
    (event.shiftKey && key === "insert");
}
export function inputKeyAction(event: KeyStroke): "BLOCK" | "INSERT" | "EDIT" | "CONFIRM" | "CANCEL" | "NATIVE" {
  if (blockedShortcut(event) || event.isComposing) return "BLOCK";
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return event.key.length !== 1 || (event.key.toLowerCase() === "a" && !event.altKey) ? "NATIVE" : "BLOCK";
  }
  if (event.key === "Enter") return event.repeat ? "BLOCK" : "CONFIRM";
  if (event.key === "Escape") return "CANCEL";
  if (event.key === "Backspace" || event.key === "Delete") return "EDIT";
  if (/^[A-Za-z0-9 ]$/.test(event.key)) return "INSERT";
  return ["Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Shift", "Control", "Meta", "Alt"].includes(event.key) ? "NATIVE" : "BLOCK";
}
export function beforeInputAction(inputType: string, data: string | null, composing: boolean): string | null {
  if (!composing && (inputType === "insertLineBreak" || inputType === "insertParagraph")) return "Enter";
  return !composing && inputType === "insertText" && data !== null && /^[A-Za-z0-9 ]$/.test(data) ? data :
    !composing && inputType === "deleteContentBackward" ? "Backspace" :
      !composing && inputType === "deleteContentForward" ? "Delete" : null;
}
export function shouldRestoreTyping(key: string, interactive: boolean): boolean {
  return /^[A-Za-z0-9 ]$/.test(key) && !(interactive && key === " ");
}
