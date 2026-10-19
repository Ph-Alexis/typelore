import { z } from "zod";
import { PlayerSlotSchema, RoomStateSchema } from "./room.js";

export const CASTLE_HP = 200;
export const GRID_ROWS = 3;
export const GRID_COLUMNS = 3;
export const GRID_CELL_COUNT = GRID_ROWS * GRID_COLUMNS;
export const GRID_CELL_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const NUMPAD_CELL_ORDER = [7, 8, 9, 4, 5, 6, 1, 2, 3] as const;
export const OPPONENT_CELL_ORDER = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

export const GridCellIdSchema = z.number().int().min(1).max(GRID_CELL_COUNT);
export const CastleStateSchema = z.object({
  hp: z.number().int().min(0).max(CASTLE_HP),
  maxHp: z.literal(CASTLE_HP),
}).strict();
export const PISTOL_HP = 15;
export const PISTOL_MAX_AMMO = 10;
export const AMMO_PER_LOAD = 5;
export const PISTOL_DAMAGE = 5;
export const PISTOL_FIRE_INTERVAL_MS = 1000;
export const PROTECTOR_HP = 30;
export const WATER_HP = 5;
export const CLAY_HP = 10;
export const BRICK_HP = 15;
export const BRICK_HEAL = 15;
export const BAZOOKA_REQUIRED_BOOST = 10;
export const BAZOOKA_DAMAGE = 10;

export const COMBAT_ROWS = {
  1: [7, 8, 9], // Row 1 (Top)
  2: [4, 5, 6], // Row 2 (Middle)
  3: [1, 2, 3], // Row 3 (Bottom)
} as const;
export type CombatRow = 1 | 2 | 3;

export function getCellRow(cellId: number): CombatRow {
  if (cellId === 7 || cellId === 8 || cellId === 9) return 1;
  if (cellId === 4 || cellId === 5 || cellId === 6) return 2;
  return 3;
}

export function getTargetRowCells(
  _shooterSlot: "PLAYER_1" | "PLAYER_2",
  row: CombatRow,
): readonly [number, number, number] {
  return COMBAT_ROWS[row];
}

export const BAZOOKA_AREAS = {
  A: [7, 8, 4, 5],
  B: [8, 9, 5, 6],
  C: [4, 5, 1, 2],
  D: [5, 6, 2, 3],
  1: [7, 8, 4, 5],
  2: [8, 9, 5, 6],
  3: [4, 5, 1, 2],
  4: [5, 6, 2, 3],
} as const;
export type BazookaAreaId = "A" | "B" | "C" | "D" | 1 | 2 | 3 | 4;
export const BIRD_HP = 15;
export const BIRD_DAMAGE = 20;
export const BIRD_FLIGHT_TIME_MS = 10000;
export const BIRD_COOLDOWN_MS = 60000;
export const BIRD_WORD_LENGTH = 12;
export const ARROW_DAMAGE = 5;
export const BIRD_FLIGHT_TICKS = 10;

export const BirdStateSchema = z.object({
  id: z.string().uuid(),
  hp: z.number().int().min(0).max(BIRD_HP),
  maxHp: z.literal(BIRD_HP),
  createdAt: z.number().finite().nonnegative(),
  flightDurationMs: z.literal(BIRD_FLIGHT_TIME_MS),
  ticksRemaining: z.number().int().min(0).max(BIRD_FLIGHT_TICKS),
  word: z.string().regex(/^[a-z]{12}$/, "Bird challenge word must be exactly 12 lowercase ASCII letters").default("typelorecomb"),
}).strict();

export const PistolObjectSchema = z.object({
  type: z.literal("PISTOL"),
  hp: z.number().int().min(0).max(PISTOL_HP),
  maxHp: z.literal(PISTOL_HP),
  ammo: z.number().int().min(0).max(PISTOL_MAX_AMMO),
  maxAmmo: z.literal(PISTOL_MAX_AMMO),
}).strict();

export const ProtectorObjectSchema = z.object({
  type: z.literal("PROTECTOR"),
  hp: z.number().int().min(0).max(PROTECTOR_HP),
  maxHp: z.literal(PROTECTOR_HP),
}).strict();

export const WaterObjectSchema = z.object({
  type: z.literal("WATER"),
  hp: z.number().int().min(0).max(WATER_HP),
  maxHp: z.literal(WATER_HP),
}).strict();

export const ClayObjectSchema = z.object({
  type: z.literal("CLAY"),
  hp: z.number().int().min(0).max(CLAY_HP),
  maxHp: z.literal(CLAY_HP),
}).strict();

export const BrickObjectSchema = z.object({
  type: z.literal("BRICK"),
  hp: z.number().int().min(0).max(BRICK_HP),
  maxHp: z.literal(BRICK_HP),
}).strict();

export const GameObjectSchema = z.discriminatedUnion("type", [
  PistolObjectSchema,
  ProtectorObjectSchema,
  WaterObjectSchema,
  ClayObjectSchema,
  BrickObjectSchema,
]);

export const GridCellStateSchema = z.object({ id: GridCellIdSchema, object: GameObjectSchema.nullable() }).strict();
export const PlayerBattlefieldStateSchema = z.object({
  slot: PlayerSlotSchema,
  connectionId: z.string().min(1).max(128),
  castle: CastleStateSchema,
  bazookaBoost: z.number().int().min(0).max(BAZOOKA_REQUIRED_BOOST),
  birdCooldownUntil: z.number().finite().nonnegative(),
  birds: z.array(BirdStateSchema),
  grid: z.array(GridCellStateSchema).length(GRID_CELL_COUNT)
    .refine((grid) => grid.every((cell, index) => cell.id === GRID_CELL_IDS[index]),
      "Grid cells must be ordered from 1 through 9."),
}).strict();
export const PlayerMetricsSchema = z.object({
  damageDealtPistol: z.number().int().nonnegative().default(0),
  damageDealtBird: z.number().int().nonnegative().default(0),
  damageDealtBazooka: z.number().int().nonnegative().default(0),
  castleDamageTaken: z.number().int().nonnegative().default(0),
  pistolsPlaced: z.number().int().nonnegative().default(0),
  ammoLoaded: z.number().int().nonnegative().default(0),
  protectorsPlaced: z.number().int().nonnegative().default(0),
  protectorsDestroyed: z.number().int().nonnegative().default(0),
  waterAdded: z.number().int().nonnegative().default(0),
  clayAdded: z.number().int().nonnegative().default(0),
  bricksCrafted: z.number().int().nonnegative().default(0),
  hpHealed: z.number().int().nonnegative().default(0),
  bazookaFired: z.number().int().nonnegative().default(0),
  birdsLaunched: z.number().int().nonnegative().default(0),
  birdsHitCastle: z.number().int().nonnegative().default(0),
  birdsShotDown: z.number().int().nonnegative().default(0),
  validCommands: z.number().int().nonnegative().default(0),
  invalidCommands: z.number().int().nonnegative().default(0),
  charactersTyped: z.number().int().nonnegative().default(0),
}).strict();

export const MatchMetricsSchema = z.object({
  durationSeconds: z.number().int().nonnegative().default(0),
  startedAt: z.number().finite().nonnegative(),
  endedAt: z.number().finite().nonnegative(),
  players: z.object({
    PLAYER_1: PlayerMetricsSchema,
    PLAYER_2: PlayerMetricsSchema,
  }).strict(),
}).strict().superRefine((metrics, ctx) => {
  if (metrics.endedAt > 0 && metrics.endedAt < metrics.startedAt) {
    ctx.addIssue({
      code: "custom",
      message: "endedAt must be greater than or equal to startedAt",
    });
  }
});

export const GameResultReasonSchema = z.enum([
  "CASTLE_DESTROYED",
  "DRAW",
  "FORFEIT_DISCONNECT",
]);
export const GameResultSchema = z.object({
  winner: PlayerSlotSchema.nullable(),
  loser: PlayerSlotSchema.nullable(),
  reason: GameResultReasonSchema,
  metrics: MatchMetricsSchema.optional(),
}).strict().superRefine((res, ctx) => {
  if (res.reason === "DRAW") {
    if (res.winner !== null || res.loser !== null) {
      ctx.addIssue({ code: "custom", message: "A draw cannot have a winner or loser." });
    }
  } else {
    if (res.winner === null || res.loser === null || res.winner === res.loser) {
      ctx.addIssue({ code: "custom", message: "A decisive game result requires distinct winner and loser slots." });
    }
  }
});
export const GameStatusSchema = z.enum(["IN_GAME", "GAME_OVER"]);

export const GameStateSchema = z.object({
  roomId: z.uuid(),
  startId: z.uuid(),
  revision: z.number().int().positive(),
  status: GameStatusSchema,
  result: GameResultSchema.nullable().default(null),
  players: z.tuple([PlayerBattlefieldStateSchema, PlayerBattlefieldStateSchema]),
}).strict()
  .refine(({ players: [first, second] }) => first.slot === "PLAYER_1" &&
    second.slot === "PLAYER_2" && first.connectionId !== second.connectionId,
  "A game requires two distinct players in canonical slot order.")
  .superRefine((game, ctx) => {
    if (game.status === "IN_GAME" && game.result !== null) {
      ctx.addIssue({ code: "custom", message: "An active game cannot have a result." });
    }
    if (game.status === "GAME_OVER" && game.result === null) {
      ctx.addIssue({ code: "custom", message: "A game over state must have a result." });
    }
  });
export const GameStateSyncSchema = z.object({
  room: RoomStateSchema.refine((room) => room.status === "IN_GAME" || room.status === "GAME_OVER"),
  state: GameStateSchema,
  serverTime: z.number().finite().nonnegative(),
}).strict().refine(({ room, state }) => room.roomId === state.roomId && room.players.length === 2 &&
  room.status === state.status &&
  room.players.every((player, index) => player.slot === state.players[index]?.slot &&
    player.connectionId === state.players[index]?.connectionId),
"Room and game membership must match.");

export type GridCellId = z.infer<typeof GridCellIdSchema>;
export type CastleState = z.infer<typeof CastleStateSchema>;
export type BirdState = z.infer<typeof BirdStateSchema>;
export type PistolObject = z.infer<typeof PistolObjectSchema>;
export type ProtectorObject = z.infer<typeof ProtectorObjectSchema>;
export type WaterObject = z.infer<typeof WaterObjectSchema>;
export type ClayObject = z.infer<typeof ClayObjectSchema>;
export type BrickObject = z.infer<typeof BrickObjectSchema>;
export type GameObject = z.infer<typeof GameObjectSchema>;
export type GridCellState = z.infer<typeof GridCellStateSchema>;
export type PlayerBattlefieldState = z.infer<typeof PlayerBattlefieldStateSchema>;
export type PlayerMetrics = z.infer<typeof PlayerMetricsSchema>;
export type MatchMetrics = z.infer<typeof MatchMetricsSchema>;
export type GameResultReason = z.infer<typeof GameResultReasonSchema>;
export type GameResult = z.infer<typeof GameResultSchema>;
export type GameStatus = z.infer<typeof GameStatusSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type GameStateSync = z.infer<typeof GameStateSyncSchema>;
