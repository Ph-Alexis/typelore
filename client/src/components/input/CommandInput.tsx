import { useId, useRef, useEffect, type RefObject } from "react";
import { COMMAND_RULES } from "@typelore/shared";
import { useCommandInput } from "../../hooks/useCommandInput";
import { useCommandFocus } from "../../hooks/useCommandFocus";
import { sound } from "../../audio/SoundEffects";
import { useLanguage } from "../../i18n/LanguageContext";
import { CommandFeedback } from "./CommandFeedback";
import styles from "./CommandInput.module.css";

export function CommandInput({ roomId, startId, enabled, battlefield }: {
  roomId: string; startId: string; enabled: boolean; battlefield: RefObject<HTMLElement | null>;
}) {
  const { language } = useLanguage();
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

  const isEn = language === "en";

  const hint = state.phase === "TARGET" && state.command ?
    `${state.command} — ${COMMAND_RULES[state.command] === 4 ? (isEn ? "Area 1–4" : "Vùng 1–4") : (isEn ? "Position 1–9" : "Vị trí 1–9")}. ${isEn ? "Enter to confirm, Escape to cancel." : "Enter để xác nhận, Escape để hủy."}` :
    (isEn ? "Type command then press Enter. Spacing must be exact." : "Nhập lệnh rồi nhấn Enter. Khoảng trắng phải chính xác.");

  const labelText = state.phase === "TARGET"
    ? (isEn ? "🎯 Select Target:" : "🎯 Chọn vị trí:")
    : (isEn ? "⌨️ Combat Command:" : "⌨️ Lệnh chiến đấu:");

  const placeholderText = isEn
    ? "> Type command and press Enter (e.g. pistol 1, load ammo 1, protector 9, boost...)"
    : "> Nhập lệnh rồi nhấn Enter (ví dụ: pistol 1, load ammo 1, protector 9, boost...)";

  return (
    <section className={`${styles.command} ${state.error ? styles.inputShake : ""}`} aria-label={isEn ? "Command Input" : "Nhập lệnh"}>
      <div className={styles.commandHeaderRow}>
        <label htmlFor={id}>{labelText}</label>
        <p id={`${id}-hint`}>{hint}</p>
      </div>
      <input ref={input} id={id} type="text" value={state.draft}
        placeholder={placeholderText}
        readOnly={!enabled || state.phase === "SUBMIT"} maxLength={state.phase === "TARGET" ? 16 : 64}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        aria-describedby={`${id}-hint ${id}-feedback`} aria-invalid={state.error}
        onChange={(event) => { event.currentTarget.value = state.draft; }} />
      <CommandFeedback id={`${id}-feedback`} message={state.feedback} error={state.error} />
    </section>
  );
}
