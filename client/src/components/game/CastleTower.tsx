import { useEffect, useState } from "react";
import type { CastleState } from "@typelore/shared";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./Battlefield.module.css";

export function CastleTower({
  castle,
  bazookaCooldownUntil = 0,
  birdCooldownUntil = 0,
  opponent,
}: {
  castle: CastleState;
  bazookaCooldownUntil?: number;
  boost?: number;
  birdCooldownUntil?: number;
  opponent: boolean;
}) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const bazookaActive = bazookaCooldownUntil > 0 && now < bazookaCooldownUntil;
    const birdActive = birdCooldownUntil > 0 && now < birdCooldownUntil;
    if (!bazookaActive && !birdActive) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [bazookaCooldownUntil, birdCooldownUntil, now]);

  const hpPercent = Math.max(0, Math.min(100, Math.round((castle.hp / castle.maxHp) * 100)));
  const isCritical = hpPercent <= 25;
  const isBazookaReady = bazookaCooldownUntil <= 0 || now >= bazookaCooldownUntil;
  const bazookaRemainingSec = isBazookaReady ? 0 : Math.max(0, Math.ceil((bazookaCooldownUntil - now) / 1000));
  const isBirdReady = birdCooldownUntil <= 0 || now >= birdCooldownUntil;
  const birdRemainingSec = isBirdReady ? 0 : Math.max(0, Math.ceil((birdCooldownUntil - now) / 1000));

  return (
    <aside
      className={`${styles.castleTower} ${opponent ? styles.towerOpponent : styles.towerSelf} ${
        isBazookaReady ? styles.towerBoostReady : ""
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
        className={`${styles.towerBazookaStation} ${isBazookaReady ? styles.bazookaArmReady : styles.bazookaArmCooldown}`}
        title={`Bazooka: ${isBazookaReady ? t("readyCaps") : `${bazookaRemainingSec}s`}`}
        aria-label={`Bazooka: ${isBazookaReady ? t("readyCaps") : `${bazookaRemainingSec}s`}`}
      >
        <div className={styles.towerBazookaWeapon}>
          <span
            className={`${styles.bazookaIcon} ${
              opponent ? styles.bazookaOpponent : styles.bazookaSelf
            } ${isBazookaReady ? styles.bazookaCharged : ""}`}
            aria-hidden="true"
          >
            🚀
          </span>
          {isBazookaReady && <span className={styles.bazookaGlowAura} aria-hidden="true" />}
        </div>
        <div className={styles.towerBoostBox}>
          <div className={styles.towerBoostLabel}>
            {isBazookaReady ? (
              <span className={styles.boostReadyText}>🚀 BAZOOKA: {t("readyCaps")}</span>
            ) : (
              <span className={styles.bazookaCountdownText}>🚀 {bazookaRemainingSec}s</span>
            )}
          </div>
          <progress
            className={`${styles.towerBoostProgress} ${
              isBazookaReady ? styles.boostProgressReady : ""
            }`}
            value={isBazookaReady ? 60 : Math.max(0, 60 - bazookaRemainingSec)}
            max={60}
            aria-label={`Bazooka ${isBazookaReady ? t("readyCaps") : `${bazookaRemainingSec}s`}`}
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
