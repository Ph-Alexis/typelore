import type { CastleState } from "@typelore/shared";
import styles from "./Battlefield.module.css";

export function Castle({ castle, label }: { castle: CastleState; label: string }) {
  return <div className={styles.castle}>
    <span>Castle {label}</span>
    <strong>{castle.hp}/{castle.maxHp} HP</strong>
    <progress aria-label={`HP Castle ${label}`} value={castle.hp} max={castle.maxHp} />
  </div>;
}
