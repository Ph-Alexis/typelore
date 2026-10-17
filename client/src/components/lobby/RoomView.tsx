import { useState } from "react";
import type { RoomState } from "@typelore/shared";
import styles from "./Lobby.module.css";

interface Props { room: RoomState; connectionId: string | undefined; busy: boolean; onReady: () => void; onLeave: () => void }
export function RoomView({ room, connectionId, busy, onReady, onLeave }: Props) {
  const [copyMessage, setCopyMessage] = useState("");
  const self = room.players.find((player) => player.connectionId === connectionId);
  async function copy(): Promise<void> {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(room.code);
      setCopyMessage("Đã sao chép mã phòng.");
    } catch { setCopyMessage("Không thể sao chép tự động. Hãy chọn mã phòng và sao chép thủ công."); }
  }
  return <div className={styles.stack}>
    <h2>Phòng chờ</h2>
    <div className={styles.codeRow}><span className={styles.code} aria-label={`Mã phòng ${room.code}`}>{room.code}</span>
      <button type="button" onClick={() => { void copy(); }}>Sao chép</button></div>
    <p aria-live="polite">{copyMessage}</p>
    <div className={styles.slots}>
      {(["PLAYER_1", "PLAYER_2"] as const).map((slot, index) => {
        const player = room.players.find((member) => member.slot === slot);
        return <div className={styles.slot} key={slot}>
          <h3>Player {index + 1} · {index === 0 ? "Host" : "Guest"}</h3>
          <p>{player ? `${player.connectionId === connectionId ? "Bạn · " : ""}${player.ready ? "Đã sẵn sàng" : "Đã kết nối"}` : "Đang chờ người chơi"}</p>
        </div>;
      })}
    </div>
    <button type="button" className={self?.ready ? styles.ready : styles.primary}
      disabled={busy || room.status !== "READY_TO_START"} aria-pressed={self?.ready ?? false} onClick={onReady}>
      {self?.ready ? "Hủy sẵn sàng" : "Sẵn sàng"}
    </button>
    {room.players.length < 2 && <p>Chờ đủ 2 người để sẵn sàng.</p>}
    <button type="button" disabled={busy} onClick={onLeave}>Rời phòng</button>
  </div>;
}
