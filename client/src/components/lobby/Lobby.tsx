import { useState } from "react";
import { useLobby } from "../../hooks/useLobby";
import { LobbyHome } from "./LobbyHome";
import { RoomView } from "./RoomView";
import { GameStarting } from "./GameStarting";
import { Battlefield } from "../game/Battlefield";
import { TutorialBattlefield } from "../tutorial/TutorialBattlefield";
import { useLanguage } from "../../i18n/LanguageContext";
import type { TranslationKey } from "../../i18n/translations";
import styles from "./Lobby.module.css";

export function Lobby({ online, connectionId }: { online: boolean; connectionId: string | undefined }) {
  const [inTutorial, setInTutorial] = useState(false);
  const lobby = useLobby(online);
  const { t } = useLanguage();
  const errorMessage = lobby.error ? t(lobby.error as TranslationKey) || lobby.error : "";
  const noticeMessage = lobby.notice ? t(lobby.notice as TranslationKey) || lobby.notice : "";

  if (inTutorial) {
    return <TutorialBattlefield onExit={() => setInTutorial(false)} />;
  }

  const isPlaying = (lobby.room?.status === "IN_GAME" || lobby.room?.status === "GAME_OVER") && Boolean(lobby.game);

  return <section className={styles.lobby} aria-label={t("lobbyTitle")} aria-busy={lobby.pending !== null}>
    {!isPlaying && errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
    {!isPlaying && noticeMessage ? <p aria-live="polite">{noticeMessage}</p> : null}
    {!isPlaying && lobby.pending ? <p role="status">{t("processing")}</p> : null}
    {online && (lobby.room ? <>
      {(lobby.room.status === "IN_GAME" || lobby.room.status === "GAME_OVER") ? (lobby.game ?
        <Battlefield game={lobby.game} connectionId={connectionId} busy={lobby.pending !== null} onLeave={lobby.leave} /> :
        <><p role="status">{t("syncingMatch")}</p>
          <button type="button" disabled={lobby.pending !== null} onClick={lobby.leave}>{t("leaveRoom")}</button></>) : <>
      {lobby.room.status === "STARTING" && <GameStarting />}
      <RoomView key={lobby.room.roomId} room={lobby.room} connectionId={connectionId} busy={lobby.pending !== null}
        onReady={lobby.ready} onLeave={lobby.leave} /></>}
    </> : <LobbyHome busy={lobby.pending !== null} onCreate={lobby.create} onJoin={lobby.join} onStartTutorial={() => setInTutorial(true)} />)}
    {!online && (
      <div>
        <p>{t("connectPrompt")}</p>
        <button
          className={styles.tutorialBtn}
          type="button"
          onClick={() => setInTutorial(true)}
          style={{ marginTop: 12 }}
        >
          🎮 {t("startTutorial")}
        </button>
      </div>
    )}
  </section>;
}
