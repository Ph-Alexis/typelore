import { z } from "zod";
import { PlayerSlotSchema, RoomStateSchema } from "./room.js";

export const CASTLE_HP = 200;
export const GRID_ROWS = 3;
export const GRID_COLUMNS = 3;
export const GRID_CELL_COUNT = GRID_ROWS * GRID_COLUMNS;
export const GRID_CELL_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const NUMPAD_CELL_ORDER = [7, 8, 9, 4, 5, 6, 1, 2, 3] as const;
export const OPPONENT_CELL_ORDER = [3, 2, 1, 6, 5, 4, 9, 8, 7] as const;

export const GridCellIdSchema = z.number().int().min(1).max(GRID_CELL_COUNT);
export const CastleStateSchema = z.object({
  hp: z.number().int().min(0).max(CASTLE_HP),
  maxHp: z.literal(CASTLE_HP),
}).strict();
export const GridCellStateSchema = z.object({ id: GridCellIdSchema, object: z.null() }).strict();
export const PlayerBattlefieldStateSchema = z.object({
  slot: PlayerSlotSchema,
  connectionId: z.string().min(1).max(128),
  castle: CastleStateSchema,
  grid: z.array(GridCellStateSchema).length(GRID_CELL_COUNT)
    .refine((grid) => grid.every((cell, index) => cell.id === GRID_CELL_IDS[index]),
      "Grid cells must be ordered from 1 through 9."),
}).strict();
export const GameStateSchema = z.object({
  roomId: z.uuid(), startId: z.uuid(), revision: z.number().int().positive(),
  status: z.literal("IN_GAME"),
  players: z.tuple([PlayerBattlefieldStateSchema, PlayerBattlefieldStateSchema]),
}).strict().refine(({ players: [first, second] }) => first.slot === "PLAYER_1" &&
  second.slot === "PLAYER_2" && first.connectionId !== second.connectionId,
"A game requires two distinct players in canonical slot order.");
export const GameStateSyncSchema = z.object({
  room: RoomStateSchema.refine((room) => room.status === "IN_GAME"),
  state: GameStateSchema,
  serverTime: z.number().finite().nonnegative(),
}).strict().refine(({ room, state }) => room.roomId === state.roomId && room.players.length === 2 &&
  room.players.every((player, index) => player.slot === state.players[index]?.slot &&
    player.connectionId === state.players[index]?.connectionId),
"Room and game membership must match.");

export type GridCellId = z.infer<typeof GridCellIdSchema>;
export type CastleState = z.infer<typeof CastleStateSchema>;
export type GridCellState = z.infer<typeof GridCellStateSchema>;
export type PlayerBattlefieldState = z.infer<typeof PlayerBattlefieldStateSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type GameStateSync = z.infer<typeof GameStateSyncSchema>;
