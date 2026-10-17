import { useLobby } from "../../hooks/useLobby";
import { LobbyHome } from "./LobbyHome";
import { RoomView } from "./RoomView";
import { GameStarting } from "./GameStarting";
import styles from "./Lobby.module.css";

export function Lobby({ online, connectionId }: { online: boolean; connectionId: string | undefined }) {
  const lobby = useLobby(online);
  return <section className={styles.lobby} aria-label="Lobby và phòng chơi" aria-busy={lobby.pending !== null}>
    <p className={styles.error} role="alert">{lobby.error}</p>
    <p aria-live="polite">{lobby.notice}</p>
    {lobby.pending && <p role="status">Đang xử lý yêu cầu…</p>}
    {online && (lobby.room ? <>
      {lobby.room.status === "STARTING" && <GameStarting />}
      <RoomView key={lobby.room.roomId} room={lobby.room} connectionId={connectionId} busy={lobby.pending !== null}
        onReady={lobby.ready} onLeave={lobby.leave} />
    </> : <LobbyHome busy={lobby.pending !== null} onCreate={lobby.create} onJoin={lobby.join} />)}
    {!online && <p>Kết nối tới server để tạo hoặc vào phòng.</p>}
  </section>;
}
