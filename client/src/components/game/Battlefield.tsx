import type { GameState } from "@typelore/shared";
import { PlayerBattlefield } from "./PlayerBattlefield";
import styles from "./Battlefield.module.css";

export function Battlefield({ game, connectionId, busy, onLeave }: {
  game: GameState; connectionId: string | undefined; busy: boolean; onLeave: () => void;
}) {
  const self = game.players.find((player) => player.connectionId === connectionId);
  const opponent = game.players.find((player) => player.connectionId !== connectionId);
  if (!self || !opponent) return null;
  return <section className={styles.battlefield} aria-label="Battlefield">
    <h2>Battlefield</h2>
    <PlayerBattlefield player={opponent} opponent />
    <p className={styles.divider}>Đối diện</p>
    <PlayerBattlefield player={self} opponent={false} />
    <button type="button" disabled={busy} onClick={onLeave}>Rời phòng</button>
  </section>;
}
