import styles from "./Lobby.module.css";
export function GameStarting() {
  return <div className={styles.starting} role="status">
    <h2>Trận đấu đã sẵn sàng</h2>
    <p>Cả hai người chơi đã sẵn sàng. Đang đồng bộ trận đấu…</p>
  </div>;
}
