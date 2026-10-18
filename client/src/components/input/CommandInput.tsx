import { useId, useRef, useEffect, type RefObject } from "react";
import { COMMAND_RULES } from "@typelore/shared";
import { useCommandInput } from "../../hooks/useCommandInput";
import { useCommandFocus } from "../../hooks/useCommandFocus";
import { sound } from "../../audio/SoundEffects";
import { CommandFeedback } from "./CommandFeedback";
import styles from "./CommandInput.module.css";

export function CommandInput({ roomId, startId, enabled, battlefield }: {
  roomId: string; startId: string; enabled: boolean; battlefield: RefObject<HTMLElement | null>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const typing = useCommandInput(roomId, startId, enabled, input);
  useCommandFocus(input, battlefield, enabled, { edit: typing.edit, confirm: typing.confirm, cancel: typing.cancel, draft: typing.state.draft });
  const id = useId();
  const { state } = typing;

  const prevError = useRef(false);
  useEffect(() => {
    if (state.error && !prevError.current) {
      sound.playError();
    }
    prevError.current = state.error;
  }, [state.error]);

  const hint = state.phase === "TARGET" && state.command ?
    `${state.command} — ${COMMAND_RULES[state.command] === 4 ? "Vùng 1–4" : "Vị trí 1–9"}. Enter để xác nhận, Escape để hủy.` :
    "Nhập lệnh rồi nhấn Enter. Khoảng trắng phải chính xác.";
  return <section className={`${styles.command} ${state.error ? styles.inputShake : ""}`} aria-label="Nhập lệnh">
    <label htmlFor={id}>{state.phase === "TARGET" ? "Chọn target" : "Lệnh"}</label>
    <p id={`${id}-hint`}>{hint}</p>
    <input ref={input} id={id} type="text" value={state.draft}
      readOnly={!enabled || state.phase === "SUBMIT"} maxLength={state.phase === "TARGET" ? 16 : 64}
      autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
      aria-describedby={`${id}-hint ${id}-feedback`} aria-invalid={state.error}
      onChange={(event) => { event.currentTarget.value = state.draft; }} />
    <CommandFeedback id={`${id}-feedback`} message={state.feedback} error={state.error} />
  </section>;
}
