import { useState, type FormEvent } from "react";
import { RoomCodeInputSchema } from "@typelore/shared";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./Lobby.module.css";

interface Props { busy: boolean; onCreate: () => void; onJoin: (code: string) => void }
export function LobbyHome({ busy, onCreate, onJoin }: Props) {
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = RoomCodeInputSchema.safeParse(code);
    if (!parsed.success) { setError(t("roomCodeError")); return; }
    setError("");
    onJoin(parsed.data);
  }
  return <div className={styles.stack}>
    <h2>{t("lobbyTitle")}</h2>
    <button className={styles.primary} type="button" disabled={busy} onClick={onCreate}>{t("createNewRoom")}</button>
    <form onSubmit={submit} className={styles.stack}>
      <label htmlFor="room-code">{t("roomCode")}</label>
      <input id="room-code" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setError(""); }}
        maxLength={64} autoComplete="off" spellCheck={false} placeholder="ABC234" disabled={busy}
        aria-invalid={Boolean(error)} aria-describedby="room-code-help room-code-error" />
      <small id="room-code-help">{t("roomCodeHelp")}</small>
      <p id="room-code-error" role="alert">{error}</p>
      <button type="submit" disabled={busy}>{t("joinRoom")}</button>
    </form>
  </div>;
}
