import styles from "./Battlefield.module.css";

export function BazookaStatus({ boost, label }: { boost: number; label: string }) {
  const isReady = boost >= 10;
  return (
    <div className={`${styles.bazooka} ${isReady ? styles.bazookaReady : ""}`}>
      <span className={styles.bazookaTitle}>Bazooka {label}</span>
      <strong>
        {isReady ? (
          <span className={styles.readyBadge}>READY (10/10)</span>
        ) : (
          <span className={styles.chargingText}>Boost {boost}/10</span>
        )}
      </strong>
      <progress aria-label={`Bazooka Boost ${label}`} value={boost} max={10} />
    </div>
  );
}

