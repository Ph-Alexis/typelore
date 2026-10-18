import { useLayoutEffect, useRef, useState } from "react";
import type { BirdState } from "@typelore/shared";
import styles from "./CombatAnimationLayer.module.css";

export interface BulletAnimItem {
  id: string;
  fromOpponent: boolean;
  shooterCellId: number;
  hitCellId: number | null; // null if hitting castle
  lane: 1 | 2 | 3;
}

export interface RocketAnimItem {
  id: string;
  fromOpponent: boolean;
  targetCellId?: number;
}

interface Point {
  x: number;
  y: number;
}

interface ArenaCoordinates {
  selfTower: Point;
  selfWeapon: Point;
  oppTower: Point;
  oppWeapon: Point;
  selfCells: Record<number, Point>;
  oppCells: Record<number, Point>;
}

function getFallbackCell(gridType: "self" | "opponent", cellId: number, w = 900, h = 320): Point {
  const colIndex =
    cellId === 7 || cellId === 4 || cellId === 1
      ? 0
      : cellId === 8 || cellId === 5 || cellId === 2
      ? 1
      : 2;
  const rowIndex =
    cellId === 7 || cellId === 8 || cellId === 9
      ? 0
      : cellId === 4 || cellId === 5 || cellId === 6
      ? 1
      : 2;
  const baseX = gridType === "opponent" ? 0.2 : 0.66;
  return {
    x: Math.round((baseX + colIndex * 0.08) * w),
    y: Math.round((0.3 + rowIndex * 0.2) * h),
  };
}

function getFallbackTower(towerType: "self" | "opponent", isWeapon = false, w = 900, h = 320): Point {
  return {
    x: Math.round((towerType === "opponent" ? 0.06 : 0.94) * w),
    y: Math.round((isWeapon ? 0.24 : 0.5) * h),
  };
}

function measureElCenter(el: Element | null, cRect: DOMRect): Point | null {
  if (!el) return null;
  const elRect = el.getBoundingClientRect();
  if (elRect.width === 0 && elRect.height === 0) return null;
  return {
    x: Math.round(elRect.left - cRect.left + elRect.width / 2),
    y: Math.round(elRect.top - cRect.top + elRect.height / 2),
  };
}

export function CombatAnimationLayer({
  selfBirds,
  opponentBirds,
  bullets,
  rockets,
  activeBirdLock,
}: {
  selfBirds: BirdState[];
  opponentBirds: BirdState[];
  bullets: BulletAnimItem[];
  rockets: RocketAnimItem[];
  activeBirdLock?: { active: boolean; targetBirdId: string | null; typedChars: string } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<ArenaCoordinates | null>(null);

  // Measure coordinates outside of render to keep rendering strictly pure
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measureAll() {
      if (!container || !container.parentElement) return;
      const cRect = container.getBoundingClientRect();
      const parent = container.parentElement;

      const newCoords: ArenaCoordinates = {
        selfTower:
          measureElCenter(parent.querySelector('[data-tower="self"]'), cRect) ??
          getFallbackTower("self", false, cRect.width, cRect.height),
        selfWeapon:
          measureElCenter(parent.querySelector('[data-tower="self"] [data-weapon="bazooka"]'), cRect) ??
          getFallbackTower("self", true, cRect.width, cRect.height),
        oppTower:
          measureElCenter(parent.querySelector('[data-tower="opponent"]'), cRect) ??
          getFallbackTower("opponent", false, cRect.width, cRect.height),
        oppWeapon:
          measureElCenter(parent.querySelector('[data-tower="opponent"] [data-weapon="bazooka"]'), cRect) ??
          getFallbackTower("opponent", true, cRect.width, cRect.height),
        selfCells: {},
        oppCells: {},
      };

      for (let id = 1; id <= 9; id++) {
        newCoords.selfCells[id] =
          measureElCenter(parent.querySelector(`[data-grid="self"] [data-cell-id="${id}"]`), cRect) ??
          getFallbackCell("self", id, cRect.width, cRect.height);
        newCoords.oppCells[id] =
          measureElCenter(parent.querySelector(`[data-grid="opponent"] [data-cell-id="${id}"]`), cRect) ??
          getFallbackCell("opponent", id, cRect.width, cRect.height);
      }

      setCoords(newCoords);
    }

    measureAll();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => measureAll());
      ro.observe(container);
      return () => ro.disconnect();
    }

    window.addEventListener("resize", measureAll);
    return () => window.removeEventListener("resize", measureAll);
  }, []);

  const getCellPos = (gridType: "self" | "opponent", cellId: number): Point => {
    if (gridType === "self") {
      return coords?.selfCells[cellId] ?? getFallbackCell("self", cellId);
    }
    return coords?.oppCells[cellId] ?? getFallbackCell("opponent", cellId);
  };

  const getTowerPos = (towerType: "self" | "opponent", isWeapon: boolean): Point => {
    if (towerType === "self") {
      return (isWeapon ? coords?.selfWeapon : coords?.selfTower) ?? getFallbackTower("self", isWeapon);
    }
    return (isWeapon ? coords?.oppWeapon : coords?.oppTower) ?? getFallbackTower("opponent", isWeapon);
  };

  // Fixed horizontal altitude across the sky so birds never tilt or fly diagonally
  const skyY = 34;

  return (
    <div ref={containerRef} className={styles.animationOverlay} aria-hidden="true">
      {/* 1. CHIM BAY ĐƯỜNG THẲNG NGANG (Pure Horizontal Flight in Sky) */}
      {selfBirds.map((bird) => {
        const startX = getCellPos("self", 8).x;
        const endX = getTowerPos("opponent", false).x;
        const progress = Math.max(0, Math.min(1, (5 - bird.ticksRemaining) / 5));
        const curX = Math.round(startX + (endX - startX) * progress);

        return (
          <div
            key={bird.id}
            className={`${styles.straightBird} ${styles.birdFlyLeft}`}
            style={{ left: `${curX}px`, top: `${skyY}px` }}
          >
            <div className={styles.birdAvatar}>
              <span className={styles.birdWing}>🪶</span>
              <span className={styles.birdBody}>🦅</span>
              <span className={styles.birdBomb}>💣</span>
            </div>
            <div className={styles.birdHud}>
              <span className={styles.birdTimer}>{bird.ticksRemaining}s</span>
              <div className={styles.birdHpMini}>
                <div
                  className={styles.birdHpFill}
                  style={{ width: `${Math.round((bird.hp / bird.maxHp) * 100)}%` }}
                />
              </div>
            </div>
            {bird.word && (
              <div className={styles.birdWordBadge}>
                {bird.word}
              </div>
            )}
          </div>
        );
      })}

      {opponentBirds.map((bird) => {
        const startX = getCellPos("opponent", 8).x;
        const endX = getTowerPos("self", false).x;
        const progress = Math.max(0, Math.min(1, (5 - bird.ticksRemaining) / 5));
        const curX = Math.round(startX + (endX - startX) * progress);

        return (
          <div
            key={bird.id}
            className={`${styles.straightBird} ${styles.birdFlyRight}`}
            style={{ left: `${curX}px`, top: `${skyY}px` }}
          >
            <div className={styles.birdAvatar}>
              <span className={styles.birdBomb}>💣</span>
              <span className={styles.birdBody}>🦅</span>
              <span className={styles.birdWing}>🪶</span>
            </div>
            <div className={styles.birdHud}>
              <span className={styles.birdTimer}>{bird.ticksRemaining}s</span>
              <div className={styles.birdHpMini}>
                <div
                  className={`${styles.birdHpFill} ${styles.oppBirdHpFill}`}
                  style={{ width: `${Math.round((bird.hp / bird.maxHp) * 100)}%` }}
                />
              </div>
            </div>
            {bird.word && (
              <div className={`${styles.birdWordBadge} ${styles.oppBirdWordBadge}`}>
                {activeBirdLock?.active && activeBirdLock.targetBirdId === bird.id ? (
                  <>
                    <span className={styles.typedBirdChars}>
                      {bird.word.slice(0, activeBirdLock.typedChars.length)}
                    </span>
                    <span className={styles.remainingBirdChars}>
                      {bird.word.slice(activeBirdLock.typedChars.length)}
                    </span>
                  </>
                ) : (
                  bird.word
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 2. ĐẠN SÚNG LỤC BAY ĐƯỜNG THẲNG NGANG (Pure Horizontal Line: Firing Row -> Obstacle) */}
      {bullets.map((bullet) => {
        const shooterGrid = bullet.fromOpponent ? "opponent" : "self";
        const targetGrid = bullet.fromOpponent ? "self" : "opponent";
        const start = getCellPos(shooterGrid, bullet.shooterCellId);
        
        // Bullet stays strictly on the exact horizontal row of the firing pistol (dy = 0)
        const rowY = start.y;
        const startX = start.x;

        const endX =
          bullet.hitCellId !== null
            ? getCellPos(targetGrid, bullet.hitCellId).x
            : getTowerPos(targetGrid, false).x;

        const dx = endX - startX;
        const isLeft = !bullet.fromOpponent;

        return (
          <div
            key={bullet.id}
            className={`${styles.straightBullet} ${styles.bulletFly} ${isLeft ? styles.bulletLeft : ""}`}
            style={
              {
                left: `${startX}px`,
                top: `${rowY}px`,
                "--fly-dx": `${dx}px`,
              } as React.CSSProperties
            }
          >
            <div className={styles.bulletBody}>
              <div className={styles.bulletHead} />
              <div className={styles.bulletTrail} />
            </div>
            <div className={styles.bulletImpactAtObstacle} />
          </div>
        );
      })}

      {/* 3. ROCKET BAZOOKA BAY ĐƯỜNG THẲNG NGANG (Pure Horizontal Line: Tower -> Target Obstacle Row) */}
      {rockets.map((rocket) => {
        const shooterTower = rocket.fromOpponent ? "opponent" : "self";
        const targetGrid = rocket.fromOpponent ? "self" : "opponent";

        // Target cell determines the exact horizontal row (dy = 0)
        const targetCell = getCellPos(targetGrid, rocket.targetCellId ?? 5);
        const rowY = targetCell.y;

        const towerPos = getTowerPos(shooterTower, false);
        const startX = rocket.fromOpponent ? towerPos.x + 35 : towerPos.x - 35;
        const targetX = targetCell.x;
        const dx = targetX - startX;
        const isLeft = !rocket.fromOpponent;

        return (
          <div
            key={rocket.id}
            className={styles.straightRocket}
            style={
              {
                left: `${startX}px`,
                top: `${rowY}px`,
                "--fly-dx": `${dx}px`,
              } as React.CSSProperties
            }
          >
            <div className={`${styles.rocketWarhead} ${isLeft ? styles.warheadLeft : ""}`}>
              <span className={styles.rocketFlame}>🔥💨</span>
              <span className={styles.rocketEmoji}>🚀</span>
            </div>
            <div className={styles.rocketBlastAtObstacle} />
          </div>
        );
      })}
    </div>
  );
}
