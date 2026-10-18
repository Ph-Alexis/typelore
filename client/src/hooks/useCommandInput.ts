import { useEffect, useRef, useState, type RefObject } from "react";
import type { CommandIntent } from "@typelore/shared";
import { socket } from "../socket/client";
import { confirmTyping, editDraft, initialTypingState, type TypingState } from "../input/typingMachine";
import { CommandRequest } from "../input/commandRequest";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useCommandInput(roomId: string, startId: string, enabled: boolean, input: RefObject<HTMLInputElement | null>) {
  const [state, setState] = useState<TypingState>(initialTypingState);
  const current = useRef(state);
  const request = useRef(new CommandRequest());
  const active = useRef(false);
  const caretTask = useRef<number | undefined>(undefined);
  function update(next: TypingState) { current.current = next; setState(next); }

  useEffect(() => {
    active.current = enabled;
    const coordinator = request.current;
    function reset() {
      active.current = false; coordinator.cancel();
      current.current = initialTypingState; setState(initialTypingState);
    }
    socket.on("disconnect", reset);
    return () => {
      active.current = false; coordinator.cancel();
      socket.off("disconnect", reset);
      if (caretTask.current !== undefined) cancelAnimationFrame(caretTask.current);
    };
  }, [roomId, startId, enabled]);

  function edit(operation: string) {
    const element = input.current;
    const old = current.current;
    if (!active.current || request.current.busy || old.phase === "SUBMIT" || !element) return;
    const result = editDraft(old.draft, element.selectionStart ?? old.draft.length,
      element.selectionEnd ?? old.draft.length, operation, old.phase === "TARGET" ? 16 : 64);
    update({ ...old, draft: result.draft, feedback: "", error: false });
    if (caretTask.current !== undefined) cancelAnimationFrame(caretTask.current);
    caretTask.current = requestAnimationFrame(() => element.setSelectionRange(result.caret, result.caret));
  }

  function confirm() {
    if (!active.current || !socket.connected || request.current.busy) return;
    const next = confirmTyping(current.current);
    update(next.state);
    if (!next.intent) return;
    const intent: CommandIntent = { ...next.intent, roomId, startId, requestId: generateUUID() };
    request.current.submit(intent, (payload, ack) => socket.emit("game:command", payload, ack), (result) => {
      if (!active.current) return;
      update({ ...initialTypingState, error: "error" in result, feedback: "error" in result ? result.error :
        "Lệnh đã được thực thi thành công." });
    });
  }
  function cancel() { if (active.current && !request.current.busy) update(initialTypingState); }
  return { state, edit, confirm, cancel };
}
