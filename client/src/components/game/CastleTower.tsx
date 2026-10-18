import type { CastleState } from "@typelore/shared";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./Battlefield.module.css";

export function CastleTower({
  castle,
  boost,
  opponent,
}: {
  castle: CastleState;
  boost: number;
  opponent: boolean;
}) {
  const { t } = useLanguage();
  const hpPercent = Math.max(0, Math.min(100, Math.round((castle.hp / castle.maxHp) * 100)));
  const isCritical = hpPercent <= 25;
  const isBoostReady = boost >= 10;

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

      {/* 2. Mounted Bazooka Turret Station on the Battlement */}
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
