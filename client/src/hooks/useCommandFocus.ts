import { useEffect, useEffectEvent, type RefObject } from "react";
import { beforeInputAction, blockedShortcut, inputKeyAction, shouldRestoreTyping } from "../input/keyboardPolicy";

const INTERACTIVE = "button,a,input,textarea,select,[contenteditable=true],[role=dialog]";
export function useCommandFocus(input: RefObject<HTMLInputElement | null>,
  battlefield: RefObject<HTMLElement | null>, enabled: boolean,
  actions: { edit: (key: string) => void; confirm: () => void; cancel: () => void; draft: string }) {
  const edit = useEffectEvent((key: string) => actions.edit(key));
  const confirm = useEffectEvent(() => actions.confirm());
  const cancel = useEffectEvent(() => actions.cancel());
  const recover = useEffectEvent((event: Event) => {
    if (event.target instanceof HTMLInputElement) event.target.value = actions.draft;
  });
  useEffect(() => {
    const element = input.current;
    const root = battlefield.current;
    if (!enabled || !element || !root) return;
    let suppressedNativeInsert = false;
    let task: ReturnType<typeof setTimeout> | undefined;
    const focus = () => { if (!document.hidden && document.hasFocus()) element.focus({ preventScroll: true }); };
    const stop = (event: Event) => { event.preventDefault(); };
    function key(event: KeyboardEvent) {
      if (blockedShortcut(event) && root!.contains(event.target as Node)) { event.preventDefault(); return; }
      if (event.target === element) {
        const action = inputKeyAction(event);
        if (action === "NATIVE") return;
        event.preventDefault();
        suppressedNativeInsert = true;
        if (action === "INSERT" || action === "EDIT") edit(event.key);
        else if (action === "CONFIRM") confirm();
        else if (action === "CANCEL") cancel();
        return;
      }
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (document.hidden || !document.hasFocus() || !target || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const otherEditor = target.closest("input,textarea,select,[contenteditable=true],[role=dialog]");
      if (otherEditor || (!root!.contains(target) && target !== document.body)) return;
      if (!shouldRestoreTyping(event.key, Boolean(target.closest(INTERACTIVE)))) return;
      event.preventDefault(); suppressedNativeInsert = true; focus(); edit(event.key);
    }
    function before(event: InputEvent) {
      event.preventDefault();
      if (suppressedNativeInsert) return;
      const operation = beforeInputAction(event.inputType, event.data, event.isComposing);
      if (operation === "Enter") confirm();
      else if (operation) edit(operation);
    }
    const keyup = () => { suppressedNativeInsert = false; };
    const deferredFocus = () => {
      clearTimeout(task);
      task = setTimeout(() => {
        const target = document.activeElement;
        if (target === document.body || (target instanceof HTMLElement && root.contains(target) && !target.closest(INTERACTIVE))) focus();
      }, 0);
    };
    const refocusWindow = () => {
      suppressedNativeInsert = false;
      const target = document.activeElement;
      if (target === element || target === document.body || (target instanceof HTMLElement && root.contains(target) && !target.closest(INTERACTIVE))) focus();
    };
    const blockedEvents = ["copy", "cut", "paste", "contextmenu", "dragstart", "dragover", "drop"];
    for (const name of blockedEvents) root.addEventListener(name, stop, true);
    document.addEventListener("keydown", key, true);
    document.addEventListener("keyup", keyup, true);
    element.addEventListener("beforeinput", before);
    element.addEventListener("input", recover);
    element.addEventListener("compositionstart", stop);
    root.addEventListener("pointerup", deferredFocus);
    root.addEventListener("focusout", deferredFocus);
    window.addEventListener("focus", refocusWindow);
    document.addEventListener("visibilitychange", refocusWindow);
    focus();
    return () => {
      clearTimeout(task);
      for (const name of blockedEvents) root.removeEventListener(name, stop, true);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("keyup", keyup, true);
      element.removeEventListener("beforeinput", before);
      element.removeEventListener("input", recover);
      element.removeEventListener("compositionstart", stop);
      root.removeEventListener("pointerup", deferredFocus);
      root.removeEventListener("focusout", deferredFocus);
      window.removeEventListener("focus", refocusWindow);
      document.removeEventListener("visibilitychange", refocusWindow);
    };
  }, [input, battlefield, enabled]);
}
