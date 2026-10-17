import { useState, type FormEvent } from "react";
import { RoomCodeInputSchema } from "@typelore/shared";
import styles from "./Lobby.module.css";

interface Props { busy: boolean; onCreate: () => void; onJoin: (code: string) => void }
export function LobbyHome({ busy, onCreate, onJoin }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = RoomCodeInputSchema.safeParse(code);
    if (!parsed.success) { setError("Nhập mã phòng 6 ký tự, không dùng 0, O, 1, I."); return; }
    setError("");
    onJoin(parsed.data);
  }
  return <div className={styles.stack}>
    <h2>Sảnh chờ</h2>
    <button className={styles.primary} type="button" disabled={busy} onClick={onCreate}>Tạo phòng mới</button>
    <form onSubmit={submit} className={styles.stack}>
      <label htmlFor="room-code">Mã phòng</label>
      <input id="room-code" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setError(""); }}
        maxLength={64} autoComplete="off" spellCheck={false} placeholder="ABC234" disabled={busy}
        aria-invalid={Boolean(error)} aria-describedby="room-code-help room-code-error" />
      <small id="room-code-help">6 ký tự, không dùng 0, O, 1, I.</small>
      <p id="room-code-error" role="alert">{error}</p>
      <button type="submit" disabled={busy}>Vào phòng</button>
    </form>
  </div>;
}
