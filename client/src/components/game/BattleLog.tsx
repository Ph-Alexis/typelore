import { useEffect, useRef } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./BattleLog.module.css";

export interface BattleLogEntry {
  id: string;
  time: string;
  text: string;
  type: "damage" | "heal" | "spawn" | "info" | "action";
}

export function BattleLog({ entries }: { entries: BattleLogEntry[] }) {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <section className={styles.logContainer} aria-label={t("battleLogTitle")}>
      <div className={styles.logHeader}>
        <span className={styles.logTitle}>{t("battleLogTitle")}</span>
        <span className={styles.logBadge}>{t("eventsCount", { count: entries.length })}</span>
      </div>
      <div ref={scrollRef} className={styles.logList} role="log" aria-live="polite">
        {entries.length === 0 ? (
          <div className={styles.emptyLog}>{t("initLog")}</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`${styles.logItem} ${styles[entry.type] ?? ""}`}
            >
              <span className={styles.logTime}>[{entry.time}]</span>
              <span className={styles.logText}>{entry.text}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

