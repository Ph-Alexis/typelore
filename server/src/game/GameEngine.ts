import { randomUUID } from "node:crypto";
import {
  CASTLE_HP,
  GRID_CELL_IDS,
  GameStateSchema,
  GameStartSchema,
  PISTOL_HP,
  PISTOL_MAX_AMMO,
  AMMO_PER_LOAD,
  PISTOL_DAMAGE,
  PROTECTOR_HP,
  WATER_HP,
  CLAY_HP,
  BRICK_HP,
  BRICK_HEAL,
  BAZOOKA_REQUIRED_BOOST,
  BAZOOKA_DAMAGE,
  BAZOOKA_AREAS,
  BIRD_HP,
  BIRD_DAMAGE,
  BIRD_FLIGHT_TIME_MS,
  BIRD_COOLDOWN_MS,
  ARROW_DAMAGE,
  BIRD_FLIGHT_TICKS,
  getTargetRowCells,
  type BazookaAreaId,
  type BirdState,
  type CommandIntent,
  type CommandErrorCode,
  type GameStart,
  type GameState,
  type MatchMetrics,
  type PlayerBattlefieldState,
  type PlayerMetrics,
} from "@typelore/shared";

export function createInitialPlayerMetrics(): PlayerMetrics {
  return {
    damageDealtPistol: 0,
    damageDealtBird: 0,
    damageDealtBazooka: 0,
    castleDamageTaken: 0,
    pistolsPlaced: 0,
    ammoLoaded: 0,
    protectorsPlaced: 0,
    protectorsDestroyed: 0,
    waterAdded: 0,
    clayAdded: 0,
    bricksCrafted: 0,
    hpHealed: 0,
    bazookaFired: 0,
    birdsLaunched: 0,
    birdsHitCastle: 0,
    birdsShotDown: 0,
    validCommands: 0,
    invalidCommands: 0,
    charactersTyped: 0,
  };
}

export const COMBAT_ROWS = {
  1: [7, 8, 9], // Row 1 (Top)
  2: [4, 5, 6], // Row 2 (Middle)
  3: [1, 2, 3], // Row 3 (Bottom)
} as const;

export function getCellRow(cellId: number): 1 | 2 | 3 {
  if (cellId === 7 || cellId === 8 || cellId === 9) return 1;
  if (cellId === 4 || cellId === 5 || cellId === 6) return 2;
  return 3;
}

export const getCellLane = getCellRow;
export const OPPONENT_LANE_CELLS = COMBAT_ROWS;

export function generateBirdChallengeWord(len = 15): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let word = "";
  for (let i = 0; i < len; i++) {
    word += chars[Math.floor(Math.random() * chars.length)];
  }
  return word;
}

export function createInitialGameState(start: GameStart): GameState {
  GameStartSchema.parse(start);
  return GameStateSchema.parse({
    roomId: start.room.roomId,
    startId: start.startId,
    revision: 1,
    status: "IN_GAME",
    result: null,
    players: start.room.players.map((player) => ({
      slot: player.slot,
      connectionId: player.connectionId,
      castle: { hp: CASTLE_HP, maxHp: CASTLE_HP },
      bazookaBoost: 0,
      birdCooldownUntil: 0,
      birds: [],
      grid: GRID_CELL_IDS.map((id) => ({ id, object: null })),
    })),
  });
}

export class GameEngine {
  private readonly games = new Map<string, GameState>();
  private readonly metrics = new Map<string, MatchMetrics>();
  private readonly now: () => number;

  constructor(options?: { now?: () => number }) {
    this.now = options?.now ?? Date.now;
  }

  get gameCount(): number { return this.games.size; }

  prepare(start: GameStart): GameState {
    if (this.games.has(start.room.roomId)) throw new Error("Game already initialized.");
    return createInitialGameState(start);
  }

  commit(candidate: GameState): void {
    if (this.games.has(candidate.roomId)) throw new Error("Game already initialized.");
    const state = GameStateSchema.parse(candidate);
    this.games.set(state.roomId, state);
    if (!this.metrics.has(state.roomId)) {
      this.metrics.set(state.roomId, {
        durationSeconds: 0,
        startedAt: this.now(),
        endedAt: 0,
        players: {
          PLAYER_1: createInitialPlayerMetrics(),
          PLAYER_2: createInitialPlayerMetrics(),
        },
      });
    }
  }

  getSnapshot(roomId: string): GameState | undefined {
    const state = this.games.get(roomId);
    return state && structuredClone(state);
  }

  getMetrics(roomId: string): MatchMetrics | undefined {
    const m = this.metrics.get(roomId);
    return m && structuredClone(m);
  }

  executeCommand(
    roomId: string,
    connectionId: string,
    intent: CommandIntent,
    currentTime?: number,
  ): { ok: true; state: GameState; changed: boolean } | { ok: false; code: CommandErrorCode } {
    const state = this.games.get(roomId);
    if (!state || state.status !== "IN_GAME") return { ok: false, code: "GAME_NOT_ACTIVE" };
    if (state.startId !== intent.startId) return { ok: false, code: "GAME_MISMATCH" };

    const player = state.players.find((p) => p.connectionId === connectionId);
    if (!player) return { ok: false, code: "NOT_IN_ROOM" };
    const now = currentTime ?? this.now();
    const matchMetrics = this.metrics.get(roomId);
    const playerMetrics = matchMetrics?.players[player.slot];

    const typedLen = intent.target !== undefined ? `${intent.command} ${intent.target}`.length : intent.command.length;

    const fail = (code: CommandErrorCode) => {
      if (playerMetrics) {
        playerMetrics.invalidCommands += 1;
        playerMetrics.charactersTyped += typedLen;
      }
      return { ok: false as const, code };
    };

    if (intent.command === "pistol") {
      if (typeof intent.target !== "number") return fail("INVALID_TARGET");
      const cell = player.grid.find((c) => c.id === intent.target);
      if (!cell) return fail("INVALID_TARGET");
      if (cell.object !== null) return fail("CELL_OCCUPIED");
      cell.object = { type: "PISTOL", hp: PISTOL_HP, maxHp: PISTOL_HP, ammo: 0, maxAmmo: PISTOL_MAX_AMMO };
      if (playerMetrics) {
        playerMetrics.validCommands += 1;
        playerMetrics.charactersTyped += typedLen;
        playerMetrics.pistolsPlaced += 1;
      }
      state.revision += 1;
      return { ok: true, state: structuredClone(state), changed: true };
    }

    if (intent.command === "load ammo") {
      if (typeof intent.target !== "number") return fail("INVALID_TARGET");
      const cell = player.grid.find((c) => c.id === intent.target);
      if (!cell) return fail("INVALID_TARGET");
      if (cell.object?.type !== "PISTOL") return fail("NOT_A_PISTOL");
      cell.object.ammo = Math.min(PISTOL_MAX_AMMO, cell.object.ammo + AMMO_PER_LOAD);
      if (playerMetrics) {
        playerMetrics.validCommands += 1;
        playerMetrics.charactersTyped += typedLen;
        playerMetrics.ammoLoaded += AMMO_PER_LOAD;
      }
      state.revision += 1;
      return { ok: true, state: structuredClone(state), changed: true };
    }

    if (intent.command === "protector") {
      if (typeof intent.target !== "number") return fail("INVALID_TARGET");
      const cell = player.grid.find((c) => c.id === intent.target);
      if (!cell) return fail("INVALID_TARGET");
      if (cell.object !== null) return fail("CELL_OCCUPIED");
      cell.object = { type: "PROTECTOR", hp: PROTECTOR_HP, maxHp: PROTECTOR_HP };
      if (playerMetrics) {
        playerMetrics.validCommands += 1;
        playerMetrics.charactersTyped += typedLen;
        playerMetrics.protectorsPlaced += 1;
      }
      state.revision += 1;
      return { ok: true, state: structuredClone(state), changed: true };
    }

    if (intent.command === "add water") {
      if (typeof intent.target !== "number") return fail("INVALID_TARGET");
      const cell = player.grid.find((c) => c.id === intent.target);
      if (!cell) return fail("INVALID_TARGET");
      if (cell.object === null) {
        cell.object = { type: "WATER", hp: WATER_HP, maxHp: WATER_HP };
        if (playerMetrics) {
          playerMetrics.validCommands += 1;
          playerMetrics.charactersTyped += typedLen;
          playerMetrics.waterAdded += 1;
        }
        state.revision += 1;
        return { ok: true, state: structuredClone(state), changed: true };
      }
      if (cell.object.type === "CLAY") {
        cell.object = { type: "BRICK", hp: BRICK_HP, maxHp: BRICK_HP };
        if (playerMetrics) {
          playerMetrics.validCommands += 1;
          playerMetrics.charactersTyped += typedLen;
          playerMetrics.waterAdded += 1;
          playerMetrics.bricksCrafted += 1;
        }
        state.revision += 1;
        return { ok: true, state: structuredClone(state), changed: true };
      }
      return fail("CELL_OCCUPIED");
    }

    if (intent.command === "add clay") {
      if (typeof intent.target !== "number") return fail("INVALID_TARGET");
      const cell = player.grid.find((c) => c.id === intent.target);
      if (!cell) return fail("INVALID_TARGET");
      if (cell.object === null) {
        cell.object = { type: "CLAY", hp: CLAY_HP, maxHp: CLAY_HP };
        if (playerMetrics) {
          playerMetrics.validCommands += 1;
          playerMetrics.charactersTyped += typedLen;
          playerMetrics.clayAdded += 1;
        }
        state.revision += 1;
        return { ok: true, state: structuredClone(state), changed: true };
      }
      if (cell.object.type === "WATER") {
        cell.object = { type: "BRICK", hp: BRICK_HP, maxHp: BRICK_HP };
        if (playerMetrics) {
          playerMetrics.validCommands += 1;
          playerMetrics.charactersTyped += typedLen;
          playerMetrics.clayAdded += 1;
          playerMetrics.bricksCrafted += 1;
        }
        state.revision += 1;
        return { ok: true, state: structuredClone(state), changed: true };
      }
      return fail("CELL_OCCUPIED");
    }

    if (intent.command === "use brick") {
      const cell = player.grid.find((c) => c.object?.type === "BRICK");
      if (!cell) return fail("NO_BRICK_AVAILABLE");
      cell.object = null;
      const healed = Math.min(BRICK_HEAL, CASTLE_HP - player.castle.hp);
      player.castle.hp = Math.min(CASTLE_HP, player.castle.hp + BRICK_HEAL);
      if (playerMetrics) {
        playerMetrics.validCommands += 1;
        playerMetrics.charactersTyped += typedLen;
        playerMetrics.hpHealed += healed;
      }
      state.revision += 1;
      return { ok: true, state: structuredClone(state), changed: true };
    }

    if (intent.command === "boost") {
      player.bazookaBoost = Math.min(BAZOOKA_REQUIRED_BOOST, player.bazookaBoost + 1);
      if (playerMetrics) {
        playerMetrics.validCommands += 1;
        playerMetrics.charactersTyped += typedLen;
      }
      state.revision += 1;
      return { ok: true, state: structuredClone(state), changed: true };
    }

    if (intent.command === "bazooka") {
      const areaKey = (typeof intent.target === "string" ? intent.target.toUpperCase() : intent.target) as BazookaAreaId;
      if (!intent.target || !(areaKey in BAZOOKA_AREAS)) {
        return fail("INVALID_TARGET");
      }
      if (player.bazookaBoost < BAZOOKA_REQUIRED_BOOST) {
        return fail("BOOST_NOT_READY");
      }
      const opponent = state.players.find((p) => p.connectionId !== connectionId);
      if (!opponent) return { ok: false, code: "NOT_IN_ROOM" };

      const targetCells = BAZOOKA_AREAS[areaKey];
      let totalBazookaDamage = 0;
      for (const cellId of targetCells) {
        const cell = opponent.grid.find((c) => c.id === cellId);
        if (cell && cell.object !== null) {
          const prevHp = cell.object.hp;
          const actualDamage = Math.min(prevHp, BAZOOKA_DAMAGE);
          totalBazookaDamage += actualDamage;
          cell.object.hp = Math.max(0, cell.object.hp - BAZOOKA_DAMAGE);
          if (cell.object.hp === 0) {
            if (cell.object.type === "PROTECTOR") {
              const oppMetrics = matchMetrics?.players[opponent.slot];
              if (oppMetrics) oppMetrics.protectorsDestroyed += 1;
            }
            cell.object = null;
          }
        }
      }
      player.bazookaBoost = 0;
      if (playerMetrics) {
        playerMetrics.validCommands += 1;
        playerMetrics.charactersTyped += typedLen;
        playerMetrics.bazookaFired += 1;
        playerMetrics.damageDealtBazooka += totalBazookaDamage;
      }
      state.revision += 1;
      return { ok: true, state: structuredClone(state), changed: true };
    }

    if (intent.command === "bird and bomb") {
      if (now < player.birdCooldownUntil) {
        return fail("BIRD_ON_COOLDOWN");
      }
      const newBird: BirdState = {
        id: randomUUID(),
        hp: BIRD_HP,
        maxHp: BIRD_HP,
        createdAt: now,
        flightDurationMs: BIRD_FLIGHT_TIME_MS,
        ticksRemaining: BIRD_FLIGHT_TICKS,
        word: generateBirdChallengeWord(15),
      };
      player.birds.push(newBird);
      player.birdCooldownUntil = now + BIRD_COOLDOWN_MS;
      if (playerMetrics) {
        playerMetrics.validCommands += 1;
        playerMetrics.charactersTyped += typedLen;
        playerMetrics.birdsLaunched += 1;
      }
      state.revision += 1;
      return { ok: true, state: structuredClone(state), changed: true };
    }

    if (intent.command === "arrow") {
      const opponent = state.players.find((p) => p.connectionId !== connectionId);
      if (!opponent) return { ok: false, code: "NOT_IN_ROOM" };
      const firstBird = opponent.birds[0];
      if (!firstBird) {
        return fail("NO_AIR_TARGET");
      }

      let targetIndex = 0;
      let bestBird = firstBird;
      for (let i = 1; i < opponent.birds.length; i++) {
        const current = opponent.birds[i];
        if (!current) continue;
        if (
          current.ticksRemaining < bestBird.ticksRemaining ||
          (current.ticksRemaining === bestBird.ticksRemaining && current.createdAt < bestBird.createdAt)
        ) {
          targetIndex = i;
          bestBird = current;
        }
      }

      bestBird.hp = Math.max(0, bestBird.hp - ARROW_DAMAGE);
      if (playerMetrics) {
        playerMetrics.validCommands += 1;
        playerMetrics.charactersTyped += typedLen;
      }
      if (bestBird.hp === 0) {
        if (playerMetrics) playerMetrics.birdsShotDown += 1;
        opponent.birds.splice(targetIndex, 1);
      }
      state.revision += 1;
      return { ok: true, state: structuredClone(state), changed: true };
    }

    return { ok: true, state: structuredClone(state), changed: false };
  }

  tick(roomId: string): { ok: true; state: GameState; changed: boolean } | { ok: false; code: string } {
    const state = this.games.get(roomId);
    if (!state || state.status !== "IN_GAME") return { ok: false, code: "GAME_NOT_ACTIVE" };

    const matchMetrics = this.metrics.get(roomId);
    const [player1, player2] = state.players;
    const p1Shots: (1 | 2 | 3)[] = [];
    for (const cell of player1.grid) {
      if (cell.object?.type === "PISTOL" && cell.object.ammo > 0) {
        cell.object.ammo -= 1;
        p1Shots.push(getCellLane(cell.id));
      }
    }

    const p2Shots: (1 | 2 | 3)[] = [];
    for (const cell of player2.grid) {
      if (cell.object?.type === "PISTOL" && cell.object.ammo > 0) {
        cell.object.ammo -= 1;
        p2Shots.push(getCellLane(cell.id));
      }
    }

    for (const lane of p1Shots) {
      this.resolveShotAgainst(player1, player2, lane, matchMetrics);
    }

    for (const lane of p2Shots) {
      this.resolveShotAgainst(player2, player1, lane, matchMetrics);
    }

    let airChanged = false;
    for (const player of state.players) {
      const opponent = state.players.find((p) => p.connectionId !== player.connectionId);
      if (!opponent || player.birds.length === 0) continue;

      const remainingBirds: BirdState[] = [];
      for (const bird of player.birds) {
        bird.ticksRemaining -= 1;
        airChanged = true;
        if (bird.ticksRemaining <= 0) {
          if (bird.hp > 0) {
            const prevCastleHp = opponent.castle.hp;
            const actualBirdDamage = Math.min(prevCastleHp, BIRD_DAMAGE);
            opponent.castle.hp = Math.max(0, opponent.castle.hp - BIRD_DAMAGE);
            if (matchMetrics) {
              matchMetrics.players[player.slot].birdsHitCastle += 1;
              matchMetrics.players[player.slot].damageDealtBird += actualBirdDamage;
              matchMetrics.players[opponent.slot].castleDamageTaken += actualBirdDamage;
            }
          }
        } else {
          remainingBirds.push(bird);
        }
      }
      player.birds = remainingBirds;
    }

    const p1Dead = player1.castle.hp <= 0;
    const p2Dead = player2.castle.hp <= 0;
    if (p1Dead || p2Dead) {
      state.status = "GAME_OVER";
      const now = this.now();
      let completedMetrics: MatchMetrics | undefined;
      if (matchMetrics) {
        matchMetrics.endedAt = now;
        matchMetrics.durationSeconds = Math.max(0, Math.floor((now - matchMetrics.startedAt) / 1000));
        completedMetrics = structuredClone(matchMetrics);
      }
      if (p1Dead && p2Dead) {
        state.result = {
          winner: null,
          loser: null,
          reason: "DRAW",
          metrics: completedMetrics,
        };
      } else if (p1Dead) {
        state.result = {
          winner: player2.slot,
          loser: player1.slot,
          reason: "CASTLE_DESTROYED",
          metrics: completedMetrics,
        };
      } else {
        state.result = {
          winner: player1.slot,
          loser: player2.slot,
          reason: "CASTLE_DESTROYED",
          metrics: completedMetrics,
        };
      }
    }

    const changed = p1Shots.length > 0 || p2Shots.length > 0 || airChanged || p1Dead || p2Dead;
    if (!changed) {
      return { ok: true, state: structuredClone(state), changed: false };
    }

    state.revision += 1;
    return { ok: true, state: structuredClone(state), changed: true };
  }

  private resolveShotAgainst(
    shooter: PlayerBattlefieldState,
    targetPlayer: PlayerBattlefieldState,
    lane: 1 | 2 | 3,
    matchMetrics?: MatchMetrics,
  ): void {
    const targetCells = getTargetRowCells(shooter.slot, lane);
    if (!targetCells) return;
    for (const cellId of targetCells) {
      const cell = targetPlayer.grid.find((c) => c.id === cellId);
      if (cell && cell.object !== null) {
        const prevHp = cell.object.hp;
        const actualDamage = Math.min(prevHp, PISTOL_DAMAGE);
        cell.object.hp = Math.max(0, cell.object.hp - PISTOL_DAMAGE);
        if (matchMetrics) {
          matchMetrics.players[shooter.slot].damageDealtPistol += actualDamage;
        }
        if (cell.object.hp === 0) {
          if (cell.object.type === "PROTECTOR" && matchMetrics) {
            matchMetrics.players[targetPlayer.slot].protectorsDestroyed += 1;
          }
          cell.object = null;
        }
        return;
      }
    }
    const prevCastleHp = targetPlayer.castle.hp;
    const actualCastleDamage = Math.min(prevCastleHp, PISTOL_DAMAGE);
    targetPlayer.castle.hp = Math.max(0, targetPlayer.castle.hp - PISTOL_DAMAGE);
    if (matchMetrics) {
      matchMetrics.players[shooter.slot].damageDealtPistol += actualCastleDamage;
      matchMetrics.players[targetPlayer.slot].castleDamageTaken += actualCastleDamage;
    }
  }

  remove(roomId: string): void {
    this.games.delete(roomId);
    this.metrics.delete(roomId);
  }
  clear(): void {
    this.games.clear();
    this.metrics.clear();
  }
}
