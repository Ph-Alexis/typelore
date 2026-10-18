import { useLobby } from "../../hooks/useLobby";
import { LobbyHome } from "./LobbyHome";
import { RoomView } from "./RoomView";
import { GameStarting } from "./GameStarting";
import { Battlefield } from "../game/Battlefield";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./Lobby.module.css";

export function Lobby({ online, connectionId }: { online: boolean; connectionId: string | undefined }) {
  const lobby = useLobby(online);
  const { t } = useLanguage();

  return <section className={styles.lobby} aria-label={t("lobbyTitle")} aria-busy={lobby.pending !== null}>
    <p className={styles.error} role="alert">{lobby.error}</p>
    <p aria-live="polite">{lobby.notice}</p>
    {lobby.pending && <p role="status">{t("processing")}</p>}
    {online && (lobby.room ? <>
      {(lobby.room.status === "IN_GAME" || lobby.room.status === "GAME_OVER") ? (lobby.game ?
        <Battlefield game={lobby.game} connectionId={connectionId} busy={lobby.pending !== null} onLeave={lobby.leave} /> :
        <><p role="status">{t("syncingMatch")}</p>
          <button type="button" disabled={lobby.pending !== null} onClick={lobby.leave}>{t("leaveRoom")}</button></>) : <>
      {lobby.room.status === "STARTING" && <GameStarting />}
      <RoomView key={lobby.room.roomId} room={lobby.room} connectionId={connectionId} busy={lobby.pending !== null}
        onReady={lobby.ready} onLeave={lobby.leave} /></>}
    </> : <LobbyHome busy={lobby.pending !== null} onCreate={lobby.create} onJoin={lobby.join} />)}
    {!online && <p>{t("connectPrompt")}</p>}
  </section>;
}
