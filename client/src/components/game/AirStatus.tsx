import { useEffect, useState } from "react";
import type { BirdState } from "@typelore/shared";
import { useLanguage } from "../../i18n/LanguageContext";
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
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (cooldownUntil === 0 || now >= cooldownUntil) return;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [cooldownUntil, now]);

  const isCooldownReady = cooldownUntil === 0 || now >= cooldownUntil;
  const remainingSec = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  return (
    <div className={styles.airStatus} aria-label={`${t("groupAir")} ${label}`}>
      <div className={styles.airHeader}>
        <span className={styles.airTitle}>{t("groupAir")} {label}</span>
        {!opponent && (
          <span className={isCooldownReady ? styles.airReadyBadge : styles.airCooldownBadge}>
            {isCooldownReady ? "BIRD: READY" : `BIRD: COOLDOWN (${remainingSec}s)`}
          </span>
        )}
      </div>

      {birds.length > 0 ? (
        <div className={styles.birdsList} aria-label={`Birds ${label}`}>
          {birds.map((bird) => (
            <div
              key={bird.id}
              className={`${styles.birdItem} ${opponent ? styles.enemyBirdItem : ""}`}
            >
              <div className={styles.birdInfo}>
                <span className={styles.birdIcon}>🦅</span>
                <span className={styles.birdTarget}>
                  {opponent ? t("birdAttackingYou") : t("birdFlyingToOpp")}
                </span>
                <span className={styles.birdTimer}>{bird.ticksRemaining}s</span>
              </div>
              <div className={styles.birdHpBar}>
                <span className={styles.birdHpText}>
                  HP: {bird.hp}/{bird.maxHp}
                </span>
                <progress
                  aria-label={`Bird HP ${bird.hp}/${bird.maxHp}`}
                  value={bird.hp}
                  max={bird.maxHp}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.noBirds}>{t("quietSky")}</div>
      )}
    </div>
  );
}
