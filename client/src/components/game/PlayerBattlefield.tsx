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
      <h3>{label}</h3>
      {opponent && (
        <>
          <Castle castle={player.castle} label={label} />
          <BazookaStatus boost={player.bazookaBoost} label={label} />
          <AirStatus
            cooldownUntil={player.birdCooldownUntil}
            birds={player.birds}
            label={label}
            opponent={opponent}
          />
        </>
      )}
      <Grid cells={player.grid} opponent={opponent} label={label} />
      {!opponent && (
        <>
          <AirStatus
            cooldownUntil={player.birdCooldownUntil}
            birds={player.birds}
            label={label}
            opponent={opponent}
          />
          <BazookaStatus boost={player.bazookaBoost} label={label} />
          <Castle castle={player.castle} label={label} />
        </>
      )}
    </section>
  );
}
