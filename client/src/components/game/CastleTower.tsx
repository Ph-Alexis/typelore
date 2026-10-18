import type { CastleState } from "@typelore/shared";
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
  const hpPercent = Math.max(0, Math.min(100, Math.round((castle.hp / castle.maxHp) * 100)));
  const isCritical = hpPercent <= 25;
  const isBoostReady = boost >= 10;

  return (
    <aside
      className={`${styles.castleTower} ${opponent ? styles.towerOpponent : styles.towerSelf} ${
        isBoostReady ? styles.towerBoostReady : ""
      }`}
      data-tower={opponent ? "opponent" : "self"}
      aria-label={`Tường thành ${opponent ? "Đối thủ" : "Bạn"}`}
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
        title={`Bazooka ${isBoostReady ? "SẴN SÀNG" : `Nạp ${boost}/10`}`}
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
              <span className={styles.boostReadyText}>READY! (10/10)</span>
            ) : (
              <span>BOOST {boost}/10</span>
            )}
          </div>
          <progress
            className={`${styles.towerBoostProgress} ${
              isBoostReady ? styles.boostProgressReady : ""
            }`}
            value={boost}
            max={10}
            aria-label={`Bazooka Boost ${boost}/10`}
          />
        </div>
      </div>

      <div className={styles.towerDivider} aria-hidden="true" />

      {/* 3. Castle Wall & Title */}
      <div className={styles.towerTitle}>TƯỜNG THÀNH</div>
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
          aria-label={`Máu tường thành ${castle.hp}/${castle.maxHp}`}
        />
      </div>
    </aside>
  );
}
