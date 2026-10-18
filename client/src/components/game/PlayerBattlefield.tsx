import type { PlayerBattlefieldState } from "@typelore/shared";
import { Castle } from "./Castle";
import { BazookaStatus } from "./BazookaStatus";
import { AirStatus } from "./AirStatus";
import { Grid } from "./Grid";
import styles from "./Battlefield.module.css";

export function PlayerBattlefield({ player, opponent }: { player: PlayerBattlefieldState; opponent: boolean }) {
  const label = opponent ? "Đối thủ" : "Bạn";
  return (
    <section className={`${styles.player} ${opponent ? styles.opponent : styles.self}`} aria-label={label}>
      <div className={styles.playerHeader}>
        <h3>{label}</h3>
        <span className={opponent ? styles.playerRoleOpponent : styles.playerRoleSelf}>
          {opponent ? "P2 (Đối thủ)" : "P1 (Bạn)"}
        </span>
      </div>
      <Castle castle={player.castle} label={label} />
      <BazookaStatus boost={player.bazookaBoost} label={label} />
      <AirStatus
        cooldownUntil={player.birdCooldownUntil}
        birds={player.birds}
        label={label}
        opponent={opponent}
      />
      <Grid cells={player.grid} opponent={opponent} label={label} />
    </section>
  );
}
