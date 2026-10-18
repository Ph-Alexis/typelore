import { z } from "zod";

export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const RoomCodeSchema = z.string().regex(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
export const RoomCodeInputSchema = z.string().max(64).trim().toUpperCase().pipe(RoomCodeSchema);
export const PlayerSlotSchema = z.enum(["PLAYER_1", "PLAYER_2"]);
export const RoomStatusSchema = z.enum([
  "WAITING_FOR_PLAYERS", "READY_TO_START", "STARTING", "IN_GAME", "GAME_OVER",
]);
export const RoomPlayerSchema = z.object({
  connectionId: z.string().min(1).max(128),
  slot: PlayerSlotSchema,
  ready: z.boolean(),
}).strict();
export const RoomStateSchema = z.object({
  roomId: z.uuid(),
  code: RoomCodeSchema,
  revision: z.number().int().positive(),
  status: RoomStatusSchema,
  players: z.array(RoomPlayerSchema).min(1).max(2),
}).strict().superRefine((room, context) => {
  const [first, second] = room.players;
  const invalidSlots = first?.slot !== "PLAYER_1" ||
    (second !== undefined && (second.slot !== "PLAYER_2" || first.connectionId === second.connectionId));
  const invalidWaiting = room.status === "WAITING_FOR_PLAYERS" &&
    (room.players.length !== 1 || first?.ready);
  const bothReady = room.players.length === 2 && room.players.every((player) => player.ready);
  const invalidReady = room.status === "READY_TO_START" &&
    (room.players.length !== 2 || bothReady);
  const invalidStarting = room.status === "STARTING" && !bothReady;
  if (invalidSlots || invalidWaiting || invalidReady || invalidStarting ||
    (room.players.length === 1 && room.status !== "WAITING_FOR_PLAYERS" && room.status !== "IN_GAME" && room.status !== "GAME_OVER")) {
    context.addIssue({ code: "custom", message: "The room state is inconsistent." });
  }
});
export const RoomCreateSchema = z.object({}).strict();
export const RoomJoinSchema = z.object({ code: RoomCodeInputSchema }).strict();
export const RoomReadySchema = z.object({ roomId: z.uuid(), ready: z.boolean() }).strict();
export const RoomLeaveSchema = z.object({ roomId: z.uuid() }).strict();
export const RoomRematchSchema = z.object({ roomId: z.uuid() }).strict();
export const RoomPlayerJoinedSchema = z.object({
  roomId: z.uuid(), revision: z.number().int().positive(), player: RoomPlayerSchema,
}).strict();
export const RoomPlayerLeftSchema = z.object({
  roomId: z.uuid(), revision: z.number().int().positive(),
  connectionId: z.string().min(1).max(128), reason: z.enum(["LEFT", "DISCONNECTED"]),
}).strict();
export const GameStartSchema = z.object({
  room: RoomStateSchema.refine((room) => room.status === "STARTING"),
  startId: z.uuid(), serverTime: z.number().finite().nonnegative(),
}).strict();
export type RoomPlayer = z.infer<typeof RoomPlayerSchema>;
export type RoomState = z.infer<typeof RoomStateSchema>;
export type RoomCreate = z.infer<typeof RoomCreateSchema>;
export type RoomJoin = z.infer<typeof RoomJoinSchema>;
export type RoomReady = z.infer<typeof RoomReadySchema>;
export type RoomLeave = z.infer<typeof RoomLeaveSchema>;
export type RoomRematch = z.infer<typeof RoomRematchSchema>;
export type RoomPlayerJoined = z.infer<typeof RoomPlayerJoinedSchema>;
export type RoomPlayerLeft = z.infer<typeof RoomPlayerLeftSchema>;
export type GameStart = z.infer<typeof GameStartSchema>;
export type RoomErrorCode =
  | "INVALID_ROOM_CODE" | "PROTOCOL_NOT_READY" | "ALREADY_IN_ROOM"
  | "ROOM_NOT_FOUND" | "ROOM_FULL" | "ROOM_NOT_JOINABLE" | "NOT_IN_ROOM"
  | "ROOM_MISMATCH" | "ROOM_NOT_WAITING" | "ROOM_CODE_EXHAUSTED" | "ROOM_NOT_OVER";
