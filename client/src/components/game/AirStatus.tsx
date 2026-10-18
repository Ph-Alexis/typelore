import { useEffect, useState } from "react";
import type { BirdState } from "@typelore/shared";
import styles from "./Battlefield.module.css";

export function AirStatus({
  cooldownUntil,
  birds,
  label,
  opponent,
}: {
  cooldownUntil: number;
  birds: BirdState[];
  label: string;
  opponent: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (cooldownUntil === 0 || now >= cooldownUntil) return;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [cooldownUntil, now]);

  const isCooldownReady = cooldownUntil === 0 || now >= cooldownUntil;
  const remainingSec = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  return (
    <div className={styles.airStatus} aria-label={`Không chiến ${label}`}>
      <div className={styles.airHeader}>
        <span className={styles.airTitle}>Không chiến {label}</span>
        {!opponent && (
          <span className={isCooldownReady ? styles.airReadyBadge : styles.airCooldownBadge}>
            {isCooldownReady ? "BIRD: SẴN SÀNG" : `BIRD: HỒI CHIÊU (${remainingSec}s)`}
          </span>
        )}
      </div>

      {birds.length > 0 ? (
        <div className={styles.birdsList} aria-label={`Danh sách Bird ${label}`}>
          {birds.map((bird) => (
            <div
              key={bird.id}
              className={`${styles.birdItem} ${opponent ? styles.enemyBirdItem : ""}`}
            >
              <div className={styles.birdInfo}>
                <span className={styles.birdIcon}>🦅</span>
                <span className={styles.birdTarget}>
                  {opponent ? "Tấn công Castle bạn!" : "Bay sang Castle đối thủ"}
                </span>
                <span className={styles.birdTimer}>{bird.ticksRemaining}s</span>
              </div>
              <div className={styles.birdHpBar}>
                <span className={styles.birdHpText}>
                  HP: {bird.hp}/{bird.maxHp}
                </span>
                <progress
                  aria-label={`Máu Bird ${bird.hp}/${bird.maxHp}`}
                  value={bird.hp}
                  max={bird.maxHp}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.noBirds}>Bầu trời yên tĩnh</div>
      )}
    </div>
  );
}
