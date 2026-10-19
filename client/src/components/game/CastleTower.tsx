import { useEffect, useState } from "react";
import type { CastleState } from "@typelore/shared";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./Battlefield.module.css";

export function CastleTower({
  castle,
  boost,
  birdCooldownUntil = 0,
  opponent,
}: {
  castle: CastleState;
  boost: number;
  birdCooldownUntil?: number;
  opponent: boolean;
}) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (birdCooldownUntil <= 0 || now >= birdCooldownUntil) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [birdCooldownUntil, now]);

  const hpPercent = Math.max(0, Math.min(100, Math.round((castle.hp / castle.maxHp) * 100)));
  const isCritical = hpPercent <= 25;
  const isBoostReady = boost >= 10;
  const isBirdReady = birdCooldownUntil <= 0 || now >= birdCooldownUntil;
  const birdRemainingSec = isBirdReady ? 0 : Math.max(0, Math.ceil((birdCooldownUntil - now) / 1000));

  return (
    <aside
      className={`${styles.castleTower} ${opponent ? styles.towerOpponent : styles.towerSelf} ${
        isBoostReady ? styles.towerBoostReady : ""
      }`}
      data-tower={opponent ? "opponent" : "self"}
      aria-label={opponent ? t("castleWallOpponentAria") : t("castleWallSelfAria")}
    >
      {/* 1. Stone Crenels at the top */}
      <div className={styles.towerCrenels} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      {/* 2. Mounted Bird Aviary Station (Above Bazooka) */}
      <div
        className={`${styles.towerBirdStation} ${isBirdReady ? styles.birdStationReady : styles.birdStationCooldown}`}
        title={`Bird & Bomb: ${isBirdReady ? t("readyCaps") : `${birdRemainingSec}s`}`}
        aria-label={`Bird & Bomb: ${isBirdReady ? t("readyCaps") : `${birdRemainingSec}s`}`}
      >
        <div className={styles.towerBirdWeapon}>
          <span className={styles.birdStationIcon} aria-hidden="true">🦅</span>
          <span className={styles.birdCountdownBadge}>
            {isBirdReady ? t("readyCaps") : `${birdRemainingSec}s`}
          </span>
        </div>
      </div>

      {/* 3. Mounted Bazooka Turret Station on the Battlement */}
      <div
        className={`${styles.towerBazookaStation} ${isBoostReady ? styles.bazookaArmReady : ""}`}
        title={`Bazooka ${isBoostReady ? t("readyCaps") : `Boost ${boost}/10`}`}
      >
        <div className={styles.towerBazookaWeapon}>
          <span
            className={`${styles.bazookaIcon} ${
              opponent ? styles.bazookaOpponent : styles.bazookaSelf
            } ${isBoostReady ? styles.bazookaCharged : ""}`}
            aria-hidden="true"
          >
            🚀
          </span>
          {isBoostReady && <span className={styles.bazookaGlowAura} aria-hidden="true" />}
        </div>
        <div className={styles.towerBoostBox}>
          <div className={styles.towerBoostLabel}>
            {isBoostReady ? (
              <span className={styles.boostReadyText}>{t("boostReadyText")}</span>
            ) : (
              <span>{t("boost")} {boost}/10</span>
            )}
          </div>
          <progress
            className={`${styles.towerBoostProgress} ${
              isBoostReady ? styles.boostProgressReady : ""
            }`}
            value={boost}
            max={10}
            aria-label={t("bazookaBoostAria", { boost })}
          />
        </div>
      </div>

      <div className={styles.towerDivider} aria-hidden="true" />

      {/* 3. Castle Wall & Title */}
      <div className={styles.towerTitle}>{t("castleWall")}</div>
      <div className={styles.towerIcon} aria-hidden="true">🏰</div>

      {/* 4. Castle HP */}
      <div className={styles.towerHpWrapper}>
        <div className={`${styles.towerHpNum} ${isCritical ? styles.hpCritical : ""}`}>
          {castle.hp}/{castle.maxHp} HP
        </div>
        <progress
          className={styles.towerProgress}
          value={castle.hp}
          max={castle.maxHp}
          aria-label={t("castleHpAria", { hp: castle.hp, maxHp: castle.maxHp })}
        />
      </div>
    </aside>
  );
}
