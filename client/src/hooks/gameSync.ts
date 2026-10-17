import { GameStateSyncSchema, type GameState, type RoomState } from "@typelore/shared";

export function acceptGameSync(payload: unknown, room: RoomState | null,
  startId: string | null, game: GameState | null, connectionId: string | undefined) {
  const parsed = GameStateSyncSchema.safeParse(payload);
  if (!parsed.success || !room || !connectionId) return null;
  const next = parsed.data;
  if (next.room.roomId !== room.roomId || next.room.revision < room.revision ||
    next.state.startId !== startId ||
    !room.players.some((player) => player.connectionId === connectionId) ||
    !next.room.players.every((player, index) => player.connectionId === room.players[index]?.connectionId &&
      player.slot === room.players[index]?.slot) ||
    (game?.startId === startId && next.state.revision <= game.revision)) return null;
  return next;
}
