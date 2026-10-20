import type { BirdState, GridCellState } from "@typelore/shared";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./Battlefield.module.css";

export function CombatCorridor({
  selfBirds,
  opponentBirds,
  selfGrid,
  opponentGrid,
  highlighted,
}: {
  selfBirds: BirdState[];
  opponentBirds: BirdState[];
  selfGrid: GridCellState[];
  opponentGrid: GridCellState[];
  highlighted?: boolean | undefined;
}) {
  const { t } = useLanguage();
  const hasSelfPistolArmed = selfGrid.some((c) => c.object?.type === "PISTOL" && c.object.ammo > 0);
  const hasOppPistolArmed = opponentGrid.some((c) => c.object?.type === "PISTOL" && c.object.ammo > 0);
  const allBirds = [
    ...selfBirds.map((b) => ({ ...b, direction: "to-opponent" as const })),
    ...opponentBirds.map((b) => ({ ...b, direction: "to-self" as const })),
  ];

  return (
    <div
      className={`${styles.combatCorridor} ${highlighted ? styles.corridorHighlighted : ""}`}
      data-tutorial-target="corridor"
      aria-label={t("corridorAria")}
    >
      <div className={styles.corridorSky}>
        {allBirds.length > 0 ? (
          allBirds.map((bird) => {
            const isToOpponent = bird.direction === "to-opponent";
            return (
              <div
                key={bird.id}
                className={`${styles.corridorBird} ${isToOpponent ? styles.birdToOpponent : styles.birdToSelf}`}
                title={t("birdTitle", { hp: bird.hp, maxHp: bird.maxHp, ticks: bird.ticksRemaining })}
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
                    aria-label={t("birdHpAria", { hp: bird.hp, maxHp: bird.maxHp })}
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
