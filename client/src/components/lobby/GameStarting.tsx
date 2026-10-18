import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./Lobby.module.css";

export function GameStarting() {
  const { t } = useLanguage();
  return <div className={styles.starting} role="status">
    <h2>{t("gameStartingTitle")}</h2>
    <p>{t("gameStartingDesc")}</p>
  </div>;
}
