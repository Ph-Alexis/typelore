import type { GameState } from "@typelore/shared";
import { Grid } from "./Grid";
import { CastleTower } from "./CastleTower";
import { CombatCorridor } from "./CombatCorridor";
import { BattleLog, type BattleLogEntry } from "./BattleLog";
import {
  CombatAnimationLayer,
  type BulletAnimItem,
  type RocketAnimItem,
} from "./CombatAnimationLayer";
import { FloatingCombatText, type CombatTextItem } from "./FloatingCombatText";
import { sound } from "../../audio/SoundEffects";
import styles from "./Battlefield.module.css";
import { useEffect, useRef, useState } from "react";
import { CommandInput } from "../input/CommandInput";
import { CommandHud } from "./CommandHud";
import { useLanguage } from "../../i18n/LanguageContext";
import { LanguageToggle } from "../common/LanguageToggle";

function formatSpeed(chars: number, durationSec: number): string {
  const mins = Math.max(durationSec, 1) / 60;
  const cpm = Math.round(chars / mins);
  const wpm = Math.round((chars / 5) / mins);
  return `${cpm} CPM (~${wpm} WPM)`;
}

export function Battlefield({ game, connectionId, busy, onLeave }: {
  game: GameState; connectionId: string | undefined; busy: boolean; onLeave: () => void;
}) {
  const { t } = useLanguage();
  const battlefield = useRef<HTMLElement>(null);
  const self = game.players.find((player) => player.connectionId === connectionId);
  const opponent = game.players.find((player) => player.connectionId !== connectionId);
  const [muted, setMuted] = useState(sound.muted);
  const [combatTexts, setCombatTexts] = useState<CombatTextItem[]>([]);
  const [bullets, setBullets] = useState<BulletAnimItem[]>([]);
  const [rockets, setRockets] = useState<RocketAnimItem[]>([]);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([
    {
      id: "init",
      time: "00:00",
      text: t("initLog"),
      type: "info",
    },
  ]);
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
    const newLogs: BattleLogEntry[] = [];
    const now = new Date();
    const timeStr = `${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

    // Castle HP changes
    if (self.castle.hp < prevSelf.castle.hp) {
      const diff = self.castle.hp - prevSelf.castle.hp;
      newTexts.push({ id: Math.random().toString(), text: `${diff}`, type: "damage", location: "self-castle" });
      newLogs.push({ id: Math.random().toString(), time: timeStr, text: t("castleDamageSelf", { amount: Math.abs(diff) }), type: "damage" });
      sound.playHit();
    } else if (self.castle.hp > prevSelf.castle.hp) {
      const diff = self.castle.hp - prevSelf.castle.hp;
      newTexts.push({ id: Math.random().toString(), text: `+${diff}`, type: "heal", location: "self-castle" });
      newLogs.push({ id: Math.random().toString(), time: timeStr, text: t("castleHealSelf", { amount: diff }), type: "heal" });
      sound.playHeal();
    }

    if (opponent.castle.hp < prevOpp.castle.hp) {
      const diff = opponent.castle.hp - prevOpp.castle.hp;
      newTexts.push({ id: Math.random().toString(), text: `${diff}`, type: "damage", location: "opponent-castle" });
      newLogs.push({ id: Math.random().toString(), time: timeStr, text: t("castleDamageOpp", { amount: Math.abs(diff) }), type: "action" });
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
        const actor = isOpp ? "Đối thủ" : "Bạn";
        if (cell.object && !prevCell.object) {
          const names: Record<string, string> = {
            PISTOL: "Súng lục",
            PROTECTOR: "Tường chắn",
            WATER: "Nước",
            CLAY: "Đất sét",
            BRICK: "Gạch",
          };
          const name = names[cell.object.type] ?? cell.object.type;
          newLogs.push({ id: Math.random().toString(), time: timeStr, text: `⚔️ ${actor} đặt ${name} ở ô ${cell.id}`, type: "info" });
        } else if (cell.object && prevCell.object && cell.object.hp < prevCell.object.hp) {
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
          newLogs.push({ id: Math.random().toString(), time: timeStr, text: `💥 Vật thể ở ô ${cell.id} (${actor}) bị phá hủy!`, type: "damage" });
          sound.playHit();
        } else if (cell.object?.type === "BRICK" && prevCell.object?.type !== "BRICK") {
          sound.playCraft();
          newTexts.push({
            id: Math.random().toString(),
            text: "+Gạch",
            type: "info",
            location: `cell-${cell.id}-${isOpp ? "opp" : "self"}`,
          });
          newLogs.push({ id: Math.random().toString(), time: timeStr, text: `✨ ${actor} đúc Gạch ở ô ${cell.id}!`, type: "spawn" });
        }
      });
    });

    // Pistol reload
    self.grid.forEach((cell, idx) => {
      const prevCell = prevSelf.grid[idx];
      if (cell.object?.type === "PISTOL" && prevCell?.object?.type === "PISTOL" && cell.object.ammo > prevCell.object.ammo) {
        sound.playReload();
        newLogs.push({ id: Math.random().toString(), time: timeStr, text: `🔄 Nạp đạn súng lục ở ô ${cell.id}!`, type: "info" });
      }
    });

    // Bird spawn & arrow
    if (self.birds.length > prevSelf.birds.length) {
      sound.playBirdSpawn();
      newLogs.push({ id: Math.random().toString(), time: timeStr, text: `🦅 Bạn thả Chim ném bom sang đối thủ!`, type: "spawn" });
    }
    if (opponent.birds.length > prevOpp.birds.length) {
      sound.playBirdSpawn();
      newLogs.push({ id: Math.random().toString(), time: timeStr, text: `⚠️ Đối thủ thả Chim ném bom sang bạn!`, type: "damage" });
    }
    if (self.birds.length < prevSelf.birds.length || opponent.birds.length < prevOpp.birds.length) {
      sound.playArrow();
      newLogs.push({ id: Math.random().toString(), time: timeStr, text: `🏹 Bắn tên trúng Chim!`, type: "action" });
    }

    const newBullets: BulletAnimItem[] = [];
    const newRockets: RocketAnimItem[] = [];

    const LANE_CELLS = {
      1: [9, 6, 3],
      2: [8, 5, 2],
      3: [7, 4, 1],
    } as const;

    // Pistol firing (bullets straight to obstacle)
    self.grid.forEach((cell, idx) => {
      const prevCell = prevSelf.grid[idx];
      if (cell.object?.type === "PISTOL" && prevCell?.object?.type === "PISTOL" && cell.object.ammo < prevCell.object.ammo) {
        const lane = (cell.id === 1 || cell.id === 4 || cell.id === 7) ? 1 : (cell.id === 2 || cell.id === 5 || cell.id === 8) ? 2 : 3;
        const targetLane = LANE_CELLS[lane];
        let hitCellId: number | null = null;
        for (const cid of targetLane) {
          const targetCell = opponent.grid.find((c) => c.id === cid);
          if (targetCell && targetCell.object !== null) {
            hitCellId = cid;
            break;
          }
        }
        newBullets.push({
          id: Math.random().toString(),
          fromOpponent: false,
          shooterCellId: cell.id,
          hitCellId,
          lane,
        });
      }
    });

    opponent.grid.forEach((cell, idx) => {
      const prevCell = prevOpp.grid[idx];
      if (cell.object?.type === "PISTOL" && prevCell?.object?.type === "PISTOL" && cell.object.ammo < prevCell.object.ammo) {
        const lane = (cell.id === 1 || cell.id === 4 || cell.id === 7) ? 1 : (cell.id === 2 || cell.id === 5 || cell.id === 8) ? 2 : 3;
        const targetLane = LANE_CELLS[lane];
        let hitCellId: number | null = null;
        for (const cid of targetLane) {
          const targetCell = self.grid.find((c) => c.id === cid);
          if (targetCell && targetCell.object !== null) {
            hitCellId = cid;
            break;
          }
        }
        newBullets.push({
          id: Math.random().toString(),
          fromOpponent: true,
          shooterCellId: cell.id,
          hitCellId,
          lane,
        });
      }
    });

    // Bazooka fired (rockets straight to target area/obstacle)
    if (prevSelf.bazookaBoost === 10 && self.bazookaBoost === 0) {
      sound.playBazooka();
      newLogs.push({ id: Math.random().toString(), time: timeStr, text: t("bazookaSelf"), type: "action" });
      const hitCell = opponent.grid.find((c, i) => {
        const pc = prevOpp.grid[i];
        return (c.object && pc?.object && c.object.hp < pc.object.hp) || (!c.object && pc?.object);
      });
      newRockets.push({
        id: Math.random().toString(),
        fromOpponent: false,
        targetCellId: hitCell ? hitCell.id : 5,
      });
    }
    if (prevOpp.bazookaBoost === 10 && opponent.bazookaBoost === 0) {
      sound.playBazooka();
      newLogs.push({ id: Math.random().toString(), time: timeStr, text: t("bazookaOpp"), type: "damage" });
      const hitCell = self.grid.find((c, i) => {
        const pc = prevSelf.grid[i];
        return (c.object && pc?.object && c.object.hp < pc.object.hp) || (!c.object && pc?.object);
      });
      newRockets.push({
        id: Math.random().toString(),
        fromOpponent: true,
        targetCellId: hitCell ? hitCell.id : 5,
      });
    }

    if (newBullets.length > 0) {
      const idsToRemove = new Set(newBullets.map((b) => b.id));
      setBullets((old) => [...old, ...newBullets]);
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        setBullets((old) => old.filter((b) => !idsToRemove.has(b.id)));
      }, 450);
      timersRef.current.add(timer);
    }

    if (newRockets.length > 0) {
      const idsToRemove = new Set(newRockets.map((r) => r.id));
      setRockets((old) => [...old, ...newRockets]);
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        setRockets((old) => old.filter((r) => !idsToRemove.has(r.id)));
      }, 850);
      timersRef.current.add(timer);
    }

    if (newLogs.length > 0) {
      setBattleLog((old) => [...old, ...newLogs].slice(-30));
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
  }, [game, connectionId, self, opponent, t]);

  if (!self || !opponent) return null;

  let resultTitle = "";
  let resultSubtitle = "";
  let resultClass = "";

  if (isGameOver) {
    if (isDraw) {
      resultTitle = t("draw");
      resultSubtitle = t("drawReason");
      resultClass = styles.gameOverDraw ?? "";
    } else if (isWinner) {
      resultTitle = t("victory");
      resultSubtitle = t("victoryReason");
      resultClass = styles.gameOverVictory ?? "";
    } else if (isLoser) {
      resultTitle = t("defeat");
      resultSubtitle = t("defeatReason");
      resultClass = styles.gameOverDefeat ?? "";
    }
  }

  const metrics = result?.metrics;
  const selfMetrics = metrics ? metrics.players[self.slot] : undefined;
  const oppMetrics = metrics ? metrics.players[opponent.slot] : undefined;

  return (
    <section ref={battlefield} className={styles.battlefield} aria-label="Battlefield">
      {/* 1. LEFT COLUMN: Header (TYPELORE, Mute, Leave) + Battle Log */}
      <aside className={styles.leftSidebar} aria-label="Thông tin trận đấu và nhật ký">
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarBrand}>
            <div className={styles.sidebarTitle}>TYPELORE</div>
            <div className={styles.brandControls}>
              <LanguageToggle />
              <span className={styles.sidebarRoomBadge}>#{game.roomId.slice(0, 6)}</span>
            </div>
          </div>
          <div className={styles.sidebarActions}>
            <button
              type="button"
              className={styles.muteBtn}
              onClick={handleToggleMute}
              aria-label={muted ? t("soundMuted") : t("soundOn")}
            >
              {muted ? t("soundMuted") : t("soundOn")}
            </button>
            {!isGameOver && (
              <button
                type="button"
                className={styles.leaveSidebarBtn}
                disabled={busy}
                onClick={onLeave}
              >
                {t("leaveRoom")}
              </button>
            )}
          </div>
        </div>

        <div className={styles.sidebarLog}>
          <BattleLog entries={battleLog} />
        </div>
      </aside>

      {/* 2. CENTER COLUMN: Player HUD (HP & Boost) + 5-Column Arena + Command Input */}
      <main className={styles.centerStage} aria-label="Khu vực chiến đấu">
        {/* Top HUD Bar */}
        <header className={styles.topHud} aria-label="Thông số trận đấu">
          <div className={styles.hudOpponent}>
            <span className={styles.hudLabel}>{t("opponent")}</span>
            <div className={styles.hudHpRow}>
              <span className={styles.hudHpText}>HP {opponent.castle.hp}/{opponent.castle.maxHp}</span>
              <progress
                className={styles.hudHpBarOpponent}
                value={opponent.castle.hp}
                max={opponent.castle.maxHp}
                aria-label={`Máu đối thủ ${opponent.castle.hp}/${opponent.castle.maxHp}`}
              />
            </div>
            <div className={styles.hudBoostRow}>
              <span className={styles.hudBoostText}>BOOST {opponent.bazookaBoost}/10</span>
              <progress
                className={styles.hudBoostBar}
                value={opponent.bazookaBoost}
                max={10}
                aria-label={`Boost đối thủ ${opponent.bazookaBoost}/10`}
              />
            </div>
          </div>

          <div className={styles.hudCenter}>
            <span className={styles.vsCenterBadge}>VS</span>
          </div>

          <div className={styles.hudSelf}>
            <span className={styles.hudLabel}>{t("self")}</span>
            <div className={styles.hudHpRow}>
              <span className={styles.hudHpText}>HP {self.castle.hp}/{self.castle.maxHp}</span>
              <progress
                className={styles.hudHpBarSelf}
                value={self.castle.hp}
                max={self.castle.maxHp}
                aria-label={`Máu của bạn ${self.castle.hp}/${self.castle.maxHp}`}
              />
            </div>
            <div className={styles.hudBoostRow}>
              <span className={styles.hudBoostText}>BOOST {self.bazookaBoost}/10</span>
              <progress
                className={styles.hudBoostBar}
                value={self.bazookaBoost}
                max={10}
                aria-label={`Boost của bạn ${self.bazookaBoost}/10`}
              />
            </div>
          </div>
        </header>

        {/* Main 5-Column Battle Arena (SÂN) */}
        <div className={styles.arenaContainer}>
          <FloatingCombatText items={combatTexts} />
          <CombatAnimationLayer
            selfBirds={self.birds}
            opponentBirds={opponent.birds}
            bullets={bullets}
            rockets={rockets}
          />

          <div className={styles.arenaStage}>
            {/* Opponent Castle Tower */}
            <CastleTower
              castle={opponent.castle}
              boost={opponent.bazookaBoost}
              opponent={true}
            />

            {/* Opponent Grid */}
            <div className={`${styles.gridSection} ${styles.gridOpponent}`}>
              <div className={styles.gridSectionHeader}>{t("opponentGrid")}</div>
              <Grid cells={opponent.grid} opponent={true} label={t("opponent")} />
            </div>

            {/* Central Neutral Corridor: Birds & Bullets */}
            <CombatCorridor
              selfBirds={self.birds}
              opponentBirds={opponent.birds}
              selfGrid={self.grid}
              opponentGrid={opponent.grid}
            />

            {/* Your Grid */}
            <div className={`${styles.gridSection} ${styles.gridSelf}`}>
              <div className={styles.gridSectionHeader}>{t("yourGrid")}</div>
              <Grid cells={self.grid} opponent={false} label={t("self")} />
            </div>

            {/* Your Castle Tower */}
            <CastleTower
              castle={self.castle}
              boost={self.bazookaBoost}
              opponent={false}
            />
          </div>

          {/* SÂN Ground Floor Line */}
          <div className={styles.arenaFloor} aria-hidden="true">
            <span className={styles.floorRail} />
            <span className={styles.floorBadge}>{t("arenaFloor")}</span>
            <span className={styles.floorRail} />
          </div>
        </div>

        {/* Centered Command Input Box */}
        <div className={styles.inputSection}>
          <CommandInput
            key={game.startId}
            roomId={game.roomId}
            startId={game.startId}
            enabled={!isGameOver}
            battlefield={battlefield}
          />
        </div>

        {/* Game Over Modal Overlay */}
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
                    <span>{t("matchStats")}</span>
                    <span>{Math.floor(metrics.durationSeconds / 60)}:{(metrics.durationSeconds % 60).toString().padStart(2, "0")}</span>
                  </div>
                  <table className={styles.statsTable} aria-label={t("matchStats")}>
                    <thead>
                      <tr>
                        <th scope="col">{t("metricCol")}</th>
                        <th scope="col">{t("youCol")}</th>
                        <th scope="col">{t("opponentCol")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{t("statPistolDamage")}</td>
                        <td className={styles.statsHighlight}>{selfMetrics.damageDealtPistol}</td>
                        <td>{oppMetrics.damageDealtPistol}</td>
                      </tr>
                      <tr>
                        <td>{t("statBirdDamage")}</td>
                        <td className={styles.statsHighlight}>{selfMetrics.damageDealtBird}</td>
                        <td>{oppMetrics.damageDealtBird}</td>
                      </tr>
                      <tr>
                        <td>{t("statBazookaDamage")}</td>
                        <td className={styles.statsHighlight}>{selfMetrics.damageDealtBazooka}</td>
                        <td>{oppMetrics.damageDealtBazooka}</td>
                      </tr>
                      <tr>
                        <td>{t("statCastleDamageTaken")}</td>
                        <td>{selfMetrics.castleDamageTaken}</td>
                        <td className={styles.statsHighlight}>{oppMetrics.castleDamageTaken}</td>
                      </tr>
                      <tr>
                        <td>{t("statPistolsPlacedAmmo")}</td>
                        <td>{selfMetrics.pistolsPlaced} / {selfMetrics.ammoLoaded}</td>
                        <td>{oppMetrics.pistolsPlaced} / {oppMetrics.ammoLoaded}</td>
                      </tr>
                      <tr>
                        <td>{t("statProtectors")}</td>
                        <td>{selfMetrics.protectorsPlaced} / {selfMetrics.protectorsDestroyed}</td>
                        <td>{oppMetrics.protectorsPlaced} / {oppMetrics.protectorsDestroyed}</td>
                      </tr>
                      <tr>
                        <td>{t("statBricksHeal")}</td>
                        <td>{selfMetrics.bricksCrafted} (+{selfMetrics.hpHealed})</td>
                        <td>{oppMetrics.bricksCrafted} (+{oppMetrics.hpHealed})</td>
                      </tr>
                      <tr>
                        <td>{t("statBirds")}</td>
                        <td>{selfMetrics.birdsLaunched} / {selfMetrics.birdsShotDown}</td>
                        <td>{oppMetrics.birdsLaunched} / {oppMetrics.birdsShotDown}</td>
                      </tr>
                      <tr>
                        <td>{t("statCommands")}</td>
                        <td>{selfMetrics.validCommands} / {selfMetrics.invalidCommands}</td>
                        <td>{oppMetrics.validCommands} / {oppMetrics.invalidCommands}</td>
                      </tr>
                      <tr>
                        <td>{t("statCharsTyped")}</td>
                        <td>{selfMetrics.charactersTyped}</td>
                        <td>{oppMetrics.charactersTyped}</td>
                      </tr>
                      <tr>
                        <td>{t("statTypingSpeed")}</td>
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
                {t("returnToLobby")}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 3. RIGHT COLUMN: Commands list cheatsheet */}
      <aside className={styles.rightSidebar} aria-label="Danh sách lệnh khả dụng">
        <CommandHud />
      </aside>
    </section>
  );
}
