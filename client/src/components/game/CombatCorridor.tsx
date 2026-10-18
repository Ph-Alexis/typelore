import type { BirdState, GridCellState } from "@typelore/shared";
import styles from "./Battlefield.module.css";

export function CombatCorridor({
  selfBirds,
  opponentBirds,
  selfGrid,
  opponentGrid,
}: {
  selfBirds: BirdState[];
  opponentBirds: BirdState[];
  selfGrid: GridCellState[];
  opponentGrid: GridCellState[];
}) {
  const hasSelfPistolArmed = selfGrid.some((c) => c.object?.type === "PISTOL" && c.object.ammo > 0);
  const hasOppPistolArmed = opponentGrid.some((c) => c.object?.type === "PISTOL" && c.object.ammo > 0);
  const allBirds = [
    ...selfBirds.map((b) => ({ ...b, direction: "to-opponent" as const })),
    ...opponentBirds.map((b) => ({ ...b, direction: "to-self" as const })),
  ];

  return (
    <div className={styles.combatCorridor} aria-label="Không phận và đạn đạo giữa 2 sân">
      <div className={styles.corridorSky}>
        {allBirds.length > 0 ? (
          allBirds.map((bird) => {
            const isToOpponent = bird.direction === "to-opponent";
            return (
              <div
                key={bird.id}
                className={`${styles.corridorBird} ${isToOpponent ? styles.birdToOpponent : styles.birdToSelf}`}
                title={`Bird ${bird.hp}/${bird.maxHp} HP, còn ${bird.ticksRemaining}s`}
              >
                <div className={styles.birdFlightGraphic}>
                  {isToOpponent ? "🐦💣 →" : "← 🐦💣"}
                </div>
                <div className={styles.birdMiniMeta}>
                  <span className={styles.birdMiniTimer}>{bird.ticksRemaining}s</span>
                  <progress
                    className={styles.birdMiniProgress}
                    value={bird.hp}
                    max={bird.maxHp}
                    aria-label={`Bird HP ${bird.hp}/${bird.maxHp}`}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.peacefulSky} aria-hidden="true">
            <span className={styles.bulletTraceLeft}>{hasOppPistolArmed ? "• →" : "· ·"}</span>
            <span className={styles.vsCenterBadge}>VS</span>
            <span className={styles.bulletTraceRight}>{hasSelfPistolArmed ? "← •" : "· ·"}</span>
          </div>
        )}
      </div>

      <div className={styles.corridorGround} aria-hidden="true">
        <span className={styles.groundLine} />
      </div>
    </div>
  );
}

