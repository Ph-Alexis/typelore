import { useEffect, useState } from "react";
import styles from "./Battlefield.module.css";

export function BazookaStatus({
  cooldownUntil = 0,
  label,
}: {
  cooldownUntil?: number;
  label: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (cooldownUntil <= 0 || now >= cooldownUntil) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [cooldownUntil, now]);

  const isReady = cooldownUntil <= 0 || now >= cooldownUntil;
  const remainingSec = isReady ? 0 : Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  return (
    <div className={`${styles.bazooka} ${isReady ? styles.bazookaReady : ""}`}>
      <span className={styles.bazookaTitle}>Bazooka {label}</span>
      <strong>
        {isReady ? (
          <span className={styles.readyBadge}>READY!</span>
        ) : (
          <span className={styles.chargingText}>{remainingSec}s</span>
        )}
      </strong>
      <progress
        aria-label={`Bazooka ${label}`}
        value={isReady ? 60 : Math.max(0, 60 - remainingSec)}
        max={60}
      />
    </div>
  );
}

