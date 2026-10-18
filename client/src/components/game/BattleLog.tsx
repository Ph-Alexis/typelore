import { useEffect, useRef } from "react";
import styles from "./BattleLog.module.css";

export interface BattleLogEntry {
  id: string;
  time: string;
  text: string;
  type: "damage" | "heal" | "spawn" | "info" | "action";
}

export function BattleLog({ entries }: { entries: BattleLogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <section className={styles.logContainer} aria-label="Battle Log">
      <div className={styles.logHeader}>
        <span className={styles.logTitle}>BATTLE LOG</span>
        <span className={styles.logBadge}>{entries.length} sự kiện</span>
      </div>
      <div ref={scrollRef} className={styles.logList} role="log" aria-live="polite">
        {entries.length === 0 ? (
          <div className={styles.emptyLog}>Trận đấu bắt đầu. Nhập lệnh để tác chiến...</div>
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

