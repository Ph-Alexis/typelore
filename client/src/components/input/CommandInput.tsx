import { useId, useRef, useEffect, type RefObject } from "react";
import { COMMAND_RULES, type BirdState } from "@typelore/shared";
import { useCommandInput } from "../../hooks/useCommandInput";
import { useCommandFocus } from "../../hooks/useCommandFocus";
import { sound } from "../../audio/SoundEffects";
import { useLanguage } from "../../i18n/LanguageContext";
import { CommandFeedback } from "./CommandFeedback";
import styles from "./CommandInput.module.css";

export function CommandInput({
  roomId,
  startId,
  enabled,
  battlefield,
  opponentBirds = [],
  onBirdLockChange,
}: {
  roomId: string;
  startId: string;
  enabled: boolean;
  battlefield: RefObject<HTMLElement | null>;
  opponentBirds?: BirdState[];
  onBirdLockChange?: (lock: { active: boolean; targetBirdId: string | null; typedChars: string }) => void;
}) {
  const { language, t } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const typing = useCommandInput(roomId, startId, enabled, input, opponentBirds);
  useCommandFocus(input, battlefield, enabled, {
    edit: typing.edit,
    confirm: typing.confirm,
    cancel: typing.cancel,
    draft: typing.state.draft,
  });
  const id = useId();
  const { state, birdLock } = typing;

  useEffect(() => {
    onBirdLockChange?.({
      active: birdLock.active,
      targetBirdId: birdLock.targetBirdId,
      typedChars: birdLock.typedChars,
    });
  }, [birdLock.active, birdLock.targetBirdId, birdLock.typedChars, onBirdLockChange]);

  const prevError = useRef(false);
  useEffect(() => {
    if (state.error && !prevError.current) {
      sound.playError();
    }
    prevError.current = state.error;
  }, [state.error]);

  const isEn = language === "en";

  let labelText =
    state.phase === "TARGET"
      ? (isEn ? "🎯 Select Target:" : "🎯 Chọn vị trí:")
      : (isEn ? "⌨️ Combat Command:" : "⌨️ Lệnh chiến đấu:");

  let hint =
    state.phase === "TARGET" && state.command
      ? `${state.command} — ${
          COMMAND_RULES[state.command] === 4
            ? (isEn ? "Area A–D / 1–4" : "Vùng A–D / 1–4")
            : (isEn ? "Position 1–9" : "Vị trí 1–9")
        }`
      : (isEn
          ? "Type command to auto-submit (Enter not required)."
          : "Gõ lệnh để tự động kích hoạt (không cần Enter).");

  let placeholderText = isEn
    ? "> Type command (e.g. pistol 1, load ammo 1, protector 9, use brick 9, boost...)"
    : "> Nhập lệnh (ví dụ: pistol 1, load ammo 1, protector 9, use brick 9, boost...)";

  if (birdLock.active) {
    labelText = isEn ? "🦅 BIRD TARGET LOCKED:" : "🦅 KHÓA MỤC TIÊU CHIM:";
    hint = t("birdLockHint");
    placeholderText = `> ${birdLock.targetWord} (${birdLock.typedChars.length}/${birdLock.targetWord.length})`;
  } else if (opponentBirds.length > 0) {
    const primary = [...opponentBirds].sort(
      (a, b) => a.ticksRemaining - b.ticksRemaining || a.createdAt - b.createdAt,
    )[0];
    if (primary) {
      hint = isEn
        ? `⚠️ Air Threat! Type "${primary.word}" to shoot down bird.`
        : `⚠️ Nguy hiểm trên không! Gõ "${primary.word}" để bắn hạ chim.`;
    }
  }

  return (
    <section
      className={`${styles.command} ${state.error ? styles.inputShake : ""}`}
      aria-label={t("commandAria")}
    >
      <div className={styles.commandHeaderRow}>
        <label htmlFor={id}>{labelText}</label>
        <p id={`${id}-hint`}>{hint}</p>
      </div>
      <input
        ref={input}
        id={id}
        type="text"
        value={state.draft}
        placeholder={placeholderText}
        readOnly={!enabled || state.phase === "SUBMIT"}
        maxLength={state.phase === "TARGET" ? 16 : 64}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-describedby={`${id}-hint ${id}-feedback`}
        aria-invalid={state.error}
        onChange={(event) => {
          event.currentTarget.value = state.draft;
        }}
      />
      <CommandFeedback id={`${id}-feedback`} message={state.feedback} error={state.error} />
    </section>
  );
}
