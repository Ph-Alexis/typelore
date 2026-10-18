import { useState } from "react";
import type { RoomState } from "@typelore/shared";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./Lobby.module.css";

interface Props { room: RoomState; connectionId: string | undefined; busy: boolean; onReady: () => void; onLeave: () => void }

function fallbackCopyText(text: string): boolean {
  if (typeof document === "undefined") return false;
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.width = "2em";
  textArea.style.height = "2em";
  textArea.style.padding = "0";
  textArea.style.border = "none";
  textArea.style.outline = "none";
  textArea.style.boxShadow = "none";
  textArea.style.background = "transparent";
  textArea.setAttribute("readonly", "");
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, textArea.value.length);
  try {
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return success;
  } catch {
    document.body.removeChild(textArea);
    return false;
  }
}

export function RoomView({ room, connectionId, busy, onReady, onLeave }: Props) {
  const { t } = useLanguage();
  const [copyMessage, setCopyMessage] = useState("");
  const self = room.players.find((player) => player.connectionId === connectionId);

  async function copy(): Promise<void> {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(room.code);
        setCopyMessage(t("codeCopied"));
        return;
      }
    } catch {
      // Fallback to execCommand if navigator.clipboard fails (insecure HTTP / LAN / permissions)
    }

    const copied = fallbackCopyText(room.code);
    if (copied) {
      setCopyMessage(t("codeCopied"));
    } else {
      setCopyMessage(t("copyManual"));
    }
  }
  return <div className={styles.stack}>
    <h2>{t("waitingRoom")}</h2>
    <div className={styles.codeRow}><span className={styles.code} aria-label={`${t("roomCode")} ${room.code}`}>{room.code}</span>
      <button type="button" onClick={() => { void copy(); }}>{t("copyCode")}</button></div>
    <p aria-live="polite">{copyMessage}</p>
    <div className={styles.slots}>
      {(["PLAYER_1", "PLAYER_2"] as const).map((slot, index) => {
        const player = room.players.find((member) => member.slot === slot);
        return <div className={styles.slot} key={slot}>
          <h3>{t("player")} {index + 1} · {index === 0 ? t("host") : t("guest")}</h3>
          <p>{player ? `${player.connectionId === connectionId ? `${t("you")} · ` : ""}${player.ready ? t("isReady") : t("isConnected")}` : t("waitingPlayer")}</p>
        </div>;
      })}
    </div>
    <button type="button" className={self?.ready ? styles.ready : styles.primary}
      disabled={busy || room.status !== "READY_TO_START"} aria-pressed={self?.ready ?? false} onClick={onReady}>
      {self?.ready ? t("cancelReady") : t("ready")}
    </button>
    {room.players.length < 2 && <p>{t("waitTwoPlayers")}</p>}
    <button type="button" disabled={busy} onClick={onLeave}>{t("leaveRoom")}</button>
  </div>;
}
