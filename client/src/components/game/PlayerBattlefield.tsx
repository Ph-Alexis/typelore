import type { PlayerBattlefieldState } from "@typelore/shared";
import { Castle } from "./Castle";
import { BazookaStatus } from "./BazookaStatus";
import { AirStatus } from "./AirStatus";
import { Grid } from "./Grid";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./Battlefield.module.css";

export function PlayerBattlefield({ player, opponent }: { player: PlayerBattlefieldState; opponent: boolean }) {
  const { t } = useLanguage();
  const label = opponent ? t("opponent") : t("you");
  return (
    <section className={`${styles.player} ${opponent ? styles.opponent : styles.self}`} aria-label={label}>
      <div className={styles.playerHeader}>
        <h3>{label}</h3>
        <span className={opponent ? styles.playerRoleOpponent : styles.playerRoleSelf}>
          {opponent ? t("p2Label") : t("p1Label")}
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
