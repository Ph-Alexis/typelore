import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandIntent } from "@typelore/shared";
import { confirmTyping, editDraft, initialTypingState, matchGroundCommand } from "../../client/src/input/typingMachine.js";
import { beforeInputAction, blockedShortcut, inputKeyAction, shouldRestoreTyping } from "../../client/src/input/keyboardPolicy.js";
import { CommandRequest } from "../../client/src/input/commandRequest.js";

afterEach(() => vi.useRealTimers());
describe("typing transitions and edit policy", () => {
  it("auto-submits ground commands upon exact match and rejects arrow from ground auto-submit", () => {
    expect(matchGroundCommand("boost")).toEqual({ command: "boost" });
    expect(matchGroundCommand("use brick")).toEqual({ command: "use brick" });
    expect(matchGroundCommand("pistol 1")).toEqual({ command: "pistol", target: 1 });
    expect(matchGroundCommand("bazooka a")).toEqual({ command: "bazooka", target: "A" });
    expect(matchGroundCommand("arrow")).toBeNull();
  });

  it("requires separate Enter for command and target, keeps invalid steps and blocks pending submit", () => {
    const command = confirmTyping({ ...initialTypingState, draft: "PISTOL" });
    expect(command.state.phase).toBe("TARGET"); expect(command.intent).toBeUndefined();
    const invalid = confirmTyping({ ...command.state, draft: "10" });
    expect(invalid.state).toMatchObject({ phase: "TARGET", draft: "10", error: true });
    const target = confirmTyping({ ...command.state, draft: "9" });
    expect(target.intent).toEqual({ command: "pistol", target: 9 });
    expect(target.state.phase).toBe("SUBMIT");
    expect(confirmTyping(target.state).intent).toBeUndefined();
    expect(confirmTyping({ ...initialTypingState, draft: "boost" }).intent).toEqual({ command: "boost" });
    expect(confirmTyping({ ...initialTypingState, draft: "boost " }).state.error).toBe(true);
  });
  it("edits selections and caret without truncating invalid input into a valid target", () => {
    expect(editDraft("pistol", 3, 3, "Backspace", 64)).toEqual({ draft: "pitol", caret: 2 });
    expect(editDraft("pistol", 0, 6, "Backspace", 64)).toEqual({ draft: "", caret: 0 });
    expect(editDraft("pistol", 2, 2, "Delete", 64)).toEqual({ draft: "", caret: 0 });
    expect(editDraft("pistol", 0, 6, "b", 64)).toEqual({ draft: "b", caret: 1 });
    expect(editDraft("1", 1, 1, "0", 16).draft).toBe("10");
    expect(editDraft("a".repeat(64), 64, 64, "a", 64).draft).toHaveLength(64);
    expect(editDraft("a", 0, 0, "pasted text", 64).draft).toBe("a");
  });
  it("blocks shortcut variants, replacement/history/composition and preserves permitted navigation", () => {
    const base = { key: "a", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, repeat: false, isComposing: false };
    for (const key of ["c", "V", "x", "z", "Y", "Insert"]) {
      for (const modifier of ["ctrlKey", "metaKey"] as const) {
        expect(blockedShortcut({ ...base, key, [modifier]: true, shiftKey: true })).toBe(true);
        expect(inputKeyAction({ ...base, key, [modifier]: true })).toBe("BLOCK");
      }
    }
    expect(inputKeyAction({ ...base, key: "Insert", shiftKey: true })).toBe("BLOCK");
    expect(inputKeyAction({ ...base, key: "a", ctrlKey: true })).toBe("NATIVE");
    expect(inputKeyAction({ ...base, key: "Enter", repeat: true })).toBe("BLOCK");
    expect(inputKeyAction({ ...base, key: "Enter" })).toBe("CONFIRM");
    expect(inputKeyAction({ ...base, key: "Escape" })).toBe("CANCEL");
    expect(inputKeyAction({ ...base, key: "Tab" })).toBe("NATIVE");
    expect(inputKeyAction({ ...base, isComposing: true })).toBe("BLOCK");
    for (const inputType of ["insertFromPaste", "insertFromDrop", "insertReplacementText", "historyUndo", "historyRedo", "insertCompositionText"]) {
      expect(beforeInputAction(inputType, "boost", false)).toBeNull();
    }
    expect(beforeInputAction("insertText", "boost", false)).toBeNull();
    expect(beforeInputAction("insertText", "b", true)).toBeNull();
    expect(beforeInputAction("insertText", "b", false)).toBe("b");
    expect(beforeInputAction("insertLineBreak", null, false)).toBe("Enter");
    expect(beforeInputAction("deleteContentBackward", null, false)).toBe("Backspace");
    expect(beforeInputAction("deleteContentForward", null, false)).toBe("Delete");
    expect(shouldRestoreTyping(" ", true)).toBe(false);
    expect(shouldRestoreTyping("Enter", true)).toBe(false);
    expect(shouldRestoreTyping("b", true)).toBe(true);
  });
});

describe("command request lifecycle", () => {
  const intent = (): CommandIntent => ({ requestId: randomUUID(), roomId: randomUUID(), startId: randomUUID(), command: "boost" });
  it("allows one request, rejects malformed/uncorrelated ACKs and handles success once", () => {
    vi.useFakeTimers(); const coordinator = new CommandRequest(); const payload = intent();
    let callback: (value: unknown) => void = () => { throw new Error("not sent"); };
    const send = vi.fn((_value, ack) => { callback = ack; }); const finish = vi.fn();
    expect(coordinator.submit(payload, send, finish)).toBe(true);
    expect(coordinator.submit(payload, send, finish)).toBe(false);
    callback({ ok: true });
    for (const field of ["requestId", "roomId", "startId"]) callback({ ok: true,
      data: { ...payload, [field]: randomUUID(), status: "VALIDATED" }, serverTime: 0 });
    expect(finish).not.toHaveBeenCalled();
    const data = { ...payload, status: "VALIDATED" };
    callback({ ok: true, data, serverTime: 0 }); callback({ ok: true, data, serverTime: 0 });
    vi.advanceTimersByTime(5000);
    expect(finish).toHaveBeenCalledExactlyOnceWith({ data }); expect(send).toHaveBeenCalledTimes(1);
  });
  it("times out without retry and ignores late ACKs, cancellation and previous generation", () => {
    vi.useFakeTimers(); const coordinator = new CommandRequest(); const payload = intent();
    const callbacks: ((value: unknown) => void)[] = []; const finish = vi.fn();
    const send = vi.fn((_value, ack) => { callbacks.push(ack); });
    coordinator.submit(payload, send, finish); vi.advanceTimersByTime(5000);
    expect(finish).toHaveBeenCalledTimes(1); expect(finish.mock.calls[0]?.[0]).toHaveProperty("error");
    coordinator.submit(payload, send, finish);
    callbacks[0]!({ ok: true, data: { ...payload, status: "VALIDATED" }, serverTime: 0 });
    expect(coordinator.busy).toBe(true);
    coordinator.cancel();
    callbacks[1]!({ ok: true, data: { ...payload, status: "VALIDATED" }, serverTime: 0 });
    vi.advanceTimersByTime(5000);
    expect(finish).toHaveBeenCalledTimes(1); expect(send).toHaveBeenCalledTimes(2);
  });
  it("settles explicit failure and thrown transport without an automatic retry", () => {
    const coordinator = new CommandRequest(); const finish = vi.fn();
    coordinator.submit(intent(), (_value, ack) => ack({ ok: false,
      error: { code: "GAME_MISMATCH", message: "stale" }, serverTime: 0 }), finish);
    expect(coordinator.busy).toBe(false); expect(finish).toHaveBeenCalledTimes(1);
    coordinator.submit(intent(), () => { throw new Error("transport"); }, finish);
    expect(coordinator.busy).toBe(false); expect(finish).toHaveBeenCalledTimes(2);
  });
});
