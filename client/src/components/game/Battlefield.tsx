import type { GameState } from "@typelore/shared";
import { PlayerBattlefield } from "./PlayerBattlefield";
import { FloatingCombatText, type CombatTextItem } from "./FloatingCombatText";
import { sound } from "../../audio/SoundEffects";
import styles from "./Battlefield.module.css";
import { useEffect, useRef, useState } from "react";
import { CommandInput } from "../input/CommandInput";

function formatSpeed(chars: number, durationSec: number): string {
  const mins = Math.max(durationSec, 1) / 60;
  const cpm = Math.round(chars / mins);
  const wpm = Math.round((chars / 5) / mins);
  return `${cpm} CPM (~${wpm} WPM)`;
}

export function Battlefield({ game, connectionId, busy, onLeave }: {
  game: GameState; connectionId: string | undefined; busy: boolean; onLeave: () => void;
}) {
  const battlefield = useRef<HTMLElement>(null);
  const self = game.players.find((player) => player.connectionId === connectionId);
  const opponent = game.players.find((player) => player.connectionId !== connectionId);
  const [muted, setMuted] = useState(sound.muted);
  const [combatTexts, setCombatTexts] = useState<CombatTextItem[]>([]);
  const prevGameRef = useRef<GameState | null>(null);
  const gameOverSoundPlayed = useRef(false);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const handleToggleMute = () => {
    const next = sound.toggleMute();
    setMuted(next);
  };

  const isGameOver = game.status === "GAME_OVER";
  const result = game.result;
  const isWinner = isGameOver && result?.winner === self?.slot;
  const isLoser = isGameOver && result?.loser === self?.slot;
  const isDraw = isGameOver && (result?.reason === "DRAW" || result?.winner === null);

  useEffect(() => {
    if (isGameOver && !gameOverSoundPlayed.current) {
      gameOverSoundPlayed.current = true;
      if (isWinner) sound.playVictory();
      else if (isLoser) sound.playDefeat();
    }
  }, [isGameOver, isWinner, isLoser]);

  useEffect(() => {
    if (!self || !opponent) return;
    if (!prevGameRef.current) {
      prevGameRef.current = game;
      return;
    }
    const prev = prevGameRef.current;
    prevGameRef.current = game;

    const prevSelf = prev.players.find((p) => p.connectionId === connectionId);
    const prevOpp = prev.players.find((p) => p.connectionId !== connectionId);
    if (!prevSelf || !prevOpp) return;

    const newTexts: CombatTextItem[] = [];

    // Castle HP changes
    if (self.castle.hp < prevSelf.castle.hp) {
      const diff = self.castle.hp - prevSelf.castle.hp;
      newTexts.push({ id: Math.random().toString(), text: `${diff}`, type: "damage", location: "self-castle" });
      sound.playHit();
    } else if (self.castle.hp > prevSelf.castle.hp) {
      const diff = self.castle.hp - prevSelf.castle.hp;
      newTexts.push({ id: Math.random().toString(), text: `+${diff}`, type: "heal", location: "self-castle" });
      sound.playHeal();
    }

    if (opponent.castle.hp < prevOpp.castle.hp) {
      const diff = opponent.castle.hp - prevOpp.castle.hp;
      newTexts.push({ id: Math.random().toString(), text: `${diff}`, type: "damage", location: "opponent-castle" });
      sound.playHit();
    }

    // Grid cells changes
    [
      { curr: self.grid, prevGrid: prevSelf.grid, isOpp: false },
      { curr: opponent.grid, prevGrid: prevOpp.grid, isOpp: true },
    ].forEach(({ curr, prevGrid, isOpp }) => {
      curr.forEach((cell, idx) => {
        const prevCell = prevGrid[idx];
        if (!prevCell) return;
        if (cell.object && prevCell.object && cell.object.hp < prevCell.object.hp) {
          const diff = cell.object.hp - prevCell.object.hp;
          newTexts.push({
            id: Math.random().toString(),
            text: `${diff}`,
            type: "damage",
            location: `cell-${cell.id}-${isOpp ? "opp" : "self"}`,
          });
          sound.playHit();
        } else if (!cell.object && prevCell.object && prevCell.object.hp > 0) {
          newTexts.push({
            id: Math.random().toString(),
            text: "Phá hủy!",
            type: "damage",
            location: `cell-${cell.id}-${isOpp ? "opp" : "self"}`,
          });
          sound.playHit();
        } else if (cell.object?.type === "BRICK" && prevCell.object?.type !== "BRICK") {
          sound.playCraft();
          newTexts.push({
            id: Math.random().toString(),
            text: "+Gạch",
            type: "info",
            location: `cell-${cell.id}-${isOpp ? "opp" : "self"}`,
          });
        }
      });
    });

    // Pistol reload
    self.grid.forEach((cell, idx) => {
      const prevCell = prevSelf.grid[idx];
      if (cell.object?.type === "PISTOL" && prevCell?.object?.type === "PISTOL" && cell.object.ammo > prevCell.object.ammo) {
        sound.playReload();
      }
    });

    // Bird spawn & arrow
    if (self.birds.length > prevSelf.birds.length || opponent.birds.length > prevOpp.birds.length) {
      sound.playBirdSpawn();
    }
    if (self.birds.length < prevSelf.birds.length || opponent.birds.length < prevOpp.birds.length) {
      sound.playArrow();
    }

    // Bazooka fired
    if (prevSelf.bazookaBoost === 10 && self.bazookaBoost === 0) {
      sound.playBazooka();
    }

    if (newTexts.length > 0) {
      const idsToRemove = new Set(newTexts.map((nt) => nt.id));
      const frame = requestAnimationFrame(() => {
        setCombatTexts((old) => [...old, ...newTexts].slice(-6));
      });
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        setCombatTexts((old) => old.filter((item) => !idsToRemove.has(item.id)));
      }, 1200);
      timersRef.current.add(timer);
      return () => {
        cancelAnimationFrame(frame);
      };
    }
  }, [game, connectionId, self, opponent]);

  if (!self || !opponent) return null;

  let resultTitle = "";
  let resultSubtitle = "";
  let resultClass = "";

  if (isGameOver) {
    if (isDraw) {
      resultTitle = "HÒA NHAU!";
      resultSubtitle = "Cả hai Castle đã sụp đổ cùng lúc.";
      resultClass = styles.gameOverDraw ?? "";
    } else if (isWinner) {
      resultTitle = "CHIẾN THẮNG!";
      resultSubtitle = "Castle của đối thủ đã bị phá hủy hoàn toàn.";
      resultClass = styles.gameOverVictory ?? "";
    } else if (isLoser) {
      resultTitle = "THẤT BẠI!";
      resultSubtitle = "Castle của bạn đã sụp đổ.";
      resultClass = styles.gameOverDefeat ?? "";
    }
  }

  const metrics = result?.metrics;
  const selfMetrics = metrics ? metrics.players[self.slot] : undefined;
  const oppMetrics = metrics ? metrics.players[opponent.slot] : undefined;

  return (
    <section ref={battlefield} className={styles.battlefield} aria-label="Battlefield">
      <div className={styles.battlefieldHeader}>
        <h2>Battlefield</h2>
        <button
          type="button"
          className={styles.muteBtn}
          onClick={handleToggleMute}
          aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
        >
          {muted ? "🔇 Tắt âm" : "🔊 Âm thanh"}
        </button>
      </div>

      <FloatingCombatText items={combatTexts} />

      <PlayerBattlefield player={opponent} opponent />
      <p className={styles.divider}>Đối diện</p>
      <PlayerBattlefield player={self} opponent={false} />

      {isGameOver && (
        <div
          className={`${styles.gameOverOverlay} ${resultClass}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-over-title"
          aria-describedby="game-over-desc"
        >
          <div className={styles.gameOverCard}>
            <h3 id="game-over-title" className={styles.gameOverTitle}>{resultTitle}</h3>
            <p id="game-over-desc" className={styles.gameOverReason}>{resultSubtitle}</p>

            {metrics && selfMetrics && oppMetrics && (
              <div className={styles.statsContainer}>
                <div className={styles.statsTitle}>
                  <span>Thống kê trận đấu</span>
                  <span>{Math.floor(metrics.durationSeconds / 60)}:{(metrics.durationSeconds % 60).toString().padStart(2, "0")}</span>
                </div>
                <table className={styles.statsTable} aria-label="Bảng thống kê số liệu trận đấu">
                  <thead>
                    <tr>
                      <th scope="col">Chỉ số</th>
                      <th scope="col">Bạn</th>
                      <th scope="col">Đối thủ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Sát thương Pistol</td>
                      <td className={styles.statsHighlight}>{selfMetrics.damageDealtPistol}</td>
                      <td>{oppMetrics.damageDealtPistol}</td>
                    </tr>
                    <tr>
                      <td>Sát thương Chim</td>
                      <td className={styles.statsHighlight}>{selfMetrics.damageDealtBird}</td>
                      <td>{oppMetrics.damageDealtBird}</td>
                    </tr>
                    <tr>
                      <td>Sát thương Bazooka</td>
                      <td className={styles.statsHighlight}>{selfMetrics.damageDealtBazooka}</td>
                      <td>{oppMetrics.damageDealtBazooka}</td>
                    </tr>
                    <tr>
                      <td>Sát thương Castle nhận</td>
                      <td>{selfMetrics.castleDamageTaken}</td>
                      <td className={styles.statsHighlight}>{oppMetrics.castleDamageTaken}</td>
                    </tr>
                    <tr>
                      <td>Pistol đã đặt / Nạp đạn</td>
                      <td>{selfMetrics.pistolsPlaced} / {selfMetrics.ammoLoaded}</td>
                      <td>{oppMetrics.pistolsPlaced} / {oppMetrics.ammoLoaded}</td>
                    </tr>
                    <tr>
                      <td>Protector dựng / bị phá</td>
                      <td>{selfMetrics.protectorsPlaced} / {selfMetrics.protectorsDestroyed}</td>
                      <td>{oppMetrics.protectorsPlaced} / {oppMetrics.protectorsDestroyed}</td>
                    </tr>
                    <tr>
                      <td>Gạch đúc / Hồi máu Castle</td>
                      <td>{selfMetrics.bricksCrafted} (+{selfMetrics.hpHealed})</td>
                      <td>{oppMetrics.bricksCrafted} (+{oppMetrics.hpHealed})</td>
                    </tr>
                    <tr>
                      <td>Chim thả / Chim bị bắn hạ</td>
                      <td>{selfMetrics.birdsLaunched} / {selfMetrics.birdsShotDown}</td>
                      <td>{oppMetrics.birdsLaunched} / {oppMetrics.birdsShotDown}</td>
                    </tr>
                    <tr>
                      <td>Lệnh hợp lệ / Lỗi</td>
                      <td>{selfMetrics.validCommands} / {selfMetrics.invalidCommands}</td>
                      <td>{oppMetrics.validCommands} / {oppMetrics.invalidCommands}</td>
                    </tr>
                    <tr>
                      <td>Ký tự đã gõ</td>
                      <td>{selfMetrics.charactersTyped}</td>
                      <td>{oppMetrics.charactersTyped}</td>
                    </tr>
                    <tr>
                      <td>Tốc độ gõ</td>
                      <td className={styles.statsHighlight}>{formatSpeed(selfMetrics.charactersTyped, metrics.durationSeconds)}</td>
                      <td>{formatSpeed(oppMetrics.charactersTyped, metrics.durationSeconds)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <button
              type="button"
              className={styles.gameOverLeaveBtn}
              disabled={busy}
              onClick={onLeave}
            >
              Rời phòng / Về sảnh
            </button>
          </div>
        </div>
      )}

      <CommandInput
        key={game.startId}
        roomId={game.roomId}
        startId={game.startId}
        enabled={!isGameOver}
        battlefield={battlefield}
      />
      {!isGameOver && <button type="button" disabled={busy} onClick={onLeave}>Rời phòng</button>}
    </section>
  );
}
