import type { PlayerBattlefieldState } from "@typelore/shared";
import { Castle } from "./Castle";
import { Grid } from "./Grid";
import styles from "./Battlefield.module.css";

export function PlayerBattlefield({ player, opponent }: { player: PlayerBattlefieldState; opponent: boolean }) {
  const label = opponent ? "Đối thủ" : "Bạn";
  return <section className={`${styles.player} ${opponent ? styles.opponent : styles.self}`} aria-label={label}>
    <h3>{label}</h3>
    {opponent && <Castle castle={player.castle} label={label} />}
    <Grid cells={player.grid} opponent={opponent} label={label} />
    {!opponent && <Castle castle={player.castle} label={label} />}
  </section>;
}
