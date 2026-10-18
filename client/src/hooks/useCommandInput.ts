import { useEffect, useRef, useState, type RefObject } from "react";
import { parseCommandTarget, type BirdState, type CommandIntent } from "@typelore/shared";
import { socket } from "../socket/client";
import {
  confirmTyping,
  editDraft,
  initialTypingState,
  matchGroundCommand,
  type TypingState,
} from "../input/typingMachine";
import { CommandRequest } from "../input/commandRequest";
import { sound } from "../audio/SoundEffects";

export interface BirdLockState {
  active: boolean;
  targetBirdId: string | null;
  targetWord: string;
  typedChars: string;
}

const initialBirdLock: BirdLockState = {
  active: false,
  targetBirdId: null,
  targetWord: "",
  typedChars: "",
};

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

export function useCommandInput(
  roomId: string,
  startId: string,
  enabled: boolean,
  input: RefObject<HTMLInputElement | null>,
  opponentBirds: BirdState[] = [],
) {
  const [state, setState] = useState<TypingState>(initialTypingState);
  const [birdLock, setBirdLock] = useState<BirdLockState>(initialBirdLock);
  const current = useRef(state);
  const currentBirdLock = useRef(birdLock);
  const request = useRef(new CommandRequest());
  const active = useRef(false);
  const caretTask = useRef<number | undefined>(undefined);

  function update(next: TypingState) {
    current.current = next;
    setState(next);
  }

  function updateBirdLock(next: BirdLockState) {
    currentBirdLock.current = next;
    setBirdLock(next);
  }

  // Release bird lock if the target bird is no longer airborne
  useEffect(() => {
    if (currentBirdLock.current.active) {
      const exists = opponentBirds.some((b) => b.id === currentBirdLock.current.targetBirdId);
      if (!exists) {
        updateBirdLock(initialBirdLock);
      }
    }
  }, [opponentBirds]);

  useEffect(() => {
    active.current = enabled;
    const coordinator = request.current;
    function reset() {
      active.current = false;
      coordinator.cancel();
      current.current = initialTypingState;
      setState(initialTypingState);
      updateBirdLock(initialBirdLock);
    }
    socket.on("disconnect", reset);
    return () => {
      active.current = false;
      coordinator.cancel();
      socket.off("disconnect", reset);
      if (caretTask.current !== undefined) cancelAnimationFrame(caretTask.current);
    };
  }, [roomId, startId, enabled]);

  function submitIntent(intent: CommandIntent) {
    request.current.submit(
      intent,
      (payload, ack) => socket.emit("game:command", payload, ack),
      (result) => {
        if (!active.current) return;
        if ("error" in result) {
          if (intent.target !== undefined) {
            const targetStr = String(intent.target);
            update({
              phase: "TARGET",
              command: intent.command,
              draft: targetStr,
              feedback: result.error,
              error: true,
            });
            const element = input.current;
            if (element) {
              element.value = targetStr;
              if (caretTask.current !== undefined) cancelAnimationFrame(caretTask.current);
              caretTask.current = requestAnimationFrame(() => element.select());
            }
            return;
          }
          update({
            phase: "COMMAND",
            command: null,
            draft: intent.command,
            feedback: result.error,
            error: true,
          });
          const element = input.current;
          if (element) {
            element.value = intent.command;
            if (caretTask.current !== undefined) cancelAnimationFrame(caretTask.current);
            caretTask.current = requestAnimationFrame(() =>
              element.setSelectionRange(intent.command.length, intent.command.length),
            );
          }
          return;
        }
        update({ ...initialTypingState, error: false, feedback: "cmdSuccessFeedback" });
        const element = input.current;
        if (element) {
          element.value = "";
          element.setSelectionRange(0, 0);
        }
      },
    );
  }

  function edit(operation: string) {
    const element = input.current;
    const old = current.current;
    if (!active.current || request.current.busy || old.phase === "SUBMIT" || !element) return;

    // 1. Check Bird Lock mode if opponent has airborne birds
    const targetBird =
      opponentBirds.length > 0
        ? [...opponentBirds].sort(
            (a, b) => a.ticksRemaining - b.ticksRemaining || a.createdAt - b.createdAt,
          )[0]
        : null;
    const isBirdActive = currentBirdLock.current.active;

    if (
      targetBird &&
      (isBirdActive ||
        (old.draft === "" &&
          /^[a-z]$/i.test(operation) &&
          operation.toLowerCase() === targetBird.word[0]))
    ) {
      const lock = currentBirdLock.current;
      const targetWord = isBirdActive ? lock.targetWord : targetBird.word;
      const birdId = isBirdActive ? lock.targetBirdId! : targetBird.id;
      const currentTyped = isBirdActive ? lock.typedChars : "";

      if (operation === "Backspace") {
        if (currentTyped.length > 0) {
          const nextTyped = currentTyped.slice(0, -1);
          if (nextTyped.length === 0) {
            updateBirdLock(initialBirdLock);
            update({ ...old, draft: "", feedback: "", error: false });
          } else {
            updateBirdLock({ active: true, targetBirdId: birdId, targetWord, typedChars: nextTyped });
            update({ ...old, draft: nextTyped, feedback: "", error: false });
          }
        }
        return;
      }

      if (/^[a-z]$/i.test(operation)) {
        const nextChar = operation.toLowerCase();
        const expectedChar = targetWord[currentTyped.length];
        if (nextChar === expectedChar) {
          const nextTyped = currentTyped + nextChar;
          sound.playTyping();
          // Every 5 characters (5, 10, 15), fire arrow
          if (nextTyped.length === 5 || nextTyped.length === 10 || nextTyped.length === 15) {
            sound.playArrow();
            const arrowIntent: CommandIntent = {
              command: "arrow",
              roomId,
              startId,
              requestId: generateUUID(),
            };
            socket.emit("game:command", arrowIntent, () => {});
          }
          if (nextTyped.length >= targetWord.length) {
            updateBirdLock(initialBirdLock);
            update({ ...initialTypingState, error: false, feedback: "cmdBirdShotDownFeedback" });
            if (element) {
              if (caretTask.current !== undefined) cancelAnimationFrame(caretTask.current);
              caretTask.current = requestAnimationFrame(() => element.setSelectionRange(0, 0));
            }
          } else {
            updateBirdLock({ active: true, targetBirdId: birdId, targetWord, typedChars: nextTyped });
            update({ ...old, draft: nextTyped, feedback: "", error: false });
          }
        } else {
          sound.playError();
          update({ ...old, error: true });
        }
        return;
      }
    }

    // 2. Normal ground command typing
    const result = editDraft(
      old.draft,
      element.selectionStart ?? old.draft.length,
      element.selectionEnd ?? old.draft.length,
      operation,
      old.phase === "TARGET" ? 16 : 64,
    );

    // 3. Auto-submit without Enter key upon exact syntax match
    if (old.phase === "TARGET" && old.command) {
      const target = parseCommandTarget(old.command, result.draft);
      if (target !== null) {
        update({ ...old, draft: result.draft, feedback: "", error: false });
        const intent: CommandIntent = {
          command: old.command,
          target,
          roomId,
          startId,
          requestId: generateUUID(),
        } as CommandIntent;
        submitIntent(intent);
        return;
      }
    } else {
      const match = matchGroundCommand(result.draft);
      if (match) {
        update({ ...old, draft: result.draft, feedback: "", error: false });
        const intent: CommandIntent = {
          ...match,
          roomId,
          startId,
          requestId: generateUUID(),
        } as CommandIntent;
        submitIntent(intent);
        return;
      }
    }

    update({ ...old, draft: result.draft, feedback: "", error: false });
    if (caretTask.current !== undefined) cancelAnimationFrame(caretTask.current);
    caretTask.current = requestAnimationFrame(() =>
      element.setSelectionRange(result.caret, result.caret),
    );
  }

  function confirm() {
    if (!active.current || !socket.connected || request.current.busy) return;
    const next = confirmTyping(current.current);
    update(next.state);
    if (!next.intent) {
      if (next.state.error && input.current) {
        const element = input.current;
        if (caretTask.current !== undefined) cancelAnimationFrame(caretTask.current);
        caretTask.current = requestAnimationFrame(() => element.select());
      }
      return;
    }
    const intent: CommandIntent = {
      ...next.intent,
      roomId,
      startId,
      requestId: generateUUID(),
    } as CommandIntent;
    submitIntent(intent);
  }

  function cancel() {
    if (active.current && !request.current.busy) {
      updateBirdLock(initialBirdLock);
      update(initialTypingState);
    }
  }

  return { state, edit, confirm, cancel, birdLock };
}
