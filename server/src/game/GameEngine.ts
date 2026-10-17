import { CASTLE_HP, GRID_CELL_IDS, GameStateSchema, GameStartSchema,
  type GameStart, type GameState } from "@typelore/shared";

export function createInitialGameState(start: GameStart): GameState {
  GameStartSchema.parse(start);
  return GameStateSchema.parse({
    roomId: start.room.roomId, startId: start.startId, revision: 1, status: "IN_GAME",
    players: start.room.players.map((player) => ({
      slot: player.slot, connectionId: player.connectionId,
      castle: { hp: CASTLE_HP, maxHp: CASTLE_HP },
      grid: GRID_CELL_IDS.map((id) => ({ id, object: null })),
    })),
  });
}

export class GameEngine {
  private readonly games = new Map<string, GameState>();
  get gameCount(): number { return this.games.size; }

  prepare(start: GameStart): GameState {
    if (this.games.has(start.room.roomId)) throw new Error("Game already initialized.");
    return createInitialGameState(start);
  }

  commit(candidate: GameState): void {
    if (this.games.has(candidate.roomId)) throw new Error("Game already initialized.");
    const state = GameStateSchema.parse(candidate);
    this.games.set(state.roomId, state);
  }

  getSnapshot(roomId: string): GameState | undefined {
    const state = this.games.get(roomId);
    return state && structuredClone(state);
  }

  remove(roomId: string): void { this.games.delete(roomId); }
  clear(): void { this.games.clear(); }
}
