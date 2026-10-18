import { CommandAckSchema, type CommandIntent, type CommandValidation, type CommandErrorCode } from "@typelore/shared";

const commandErrors: Record<CommandErrorCode, string> = {
  INVALID_PAYLOAD: "cmdErrInvalidPayload",
  PROTOCOL_MISMATCH: "cmdErrProtocolMismatch",
  INTERNAL_ERROR: "cmdErrInternalError",
  PROTOCOL_NOT_READY: "cmdErrProtocolNotReady",
  NOT_IN_ROOM: "cmdErrNotInRoom",
  ROOM_MISMATCH: "cmdErrRoomMismatch",
  GAME_NOT_ACTIVE: "cmdErrGameNotActive",
  GAME_MISMATCH: "cmdErrGameMismatch",
  CELL_OCCUPIED: "cmdErrCellOccupied",
  NOT_A_PISTOL: "cmdErrNotAPistol",
  INVALID_TARGET: "cmdErrInvalidTarget",
  NO_BRICK_AVAILABLE: "cmdErrNoBrickAvailable",
  BOOST_NOT_READY: "cmdErrBoostNotReady",
  BIRD_ON_COOLDOWN: "cmdErrBirdOnCooldown",
  NO_AIR_TARGET: "cmdErrNoAirTarget",
};

// One request per mounted session; invalidate both the timeout and late callbacks.
export class CommandRequest {
  private generation = 0;
  private pending = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  get busy(): boolean { return this.pending; }
  cancel(): void {
    this.generation += 1; this.pending = false; clearTimeout(this.timer);
  }
  submit(intent: CommandIntent, send: (intent: CommandIntent, ack: (value: unknown) => void) => void,
    finish: (result: { data: CommandValidation } | { error: string }) => void): boolean {
    if (this.pending) return false;
    this.pending = true;
    const token = ++this.generation;
    const settle = (result: Parameters<typeof finish>[0]) => {
      if (!this.pending || token !== this.generation) return;
      this.cancel(); finish(result);
    };
    this.timer = setTimeout(() => settle({ error: "cmdErrTimeout" }), 5000);
    try {
      send(intent, (value) => {
        if (!this.pending || token !== this.generation) return;
        const parsed = CommandAckSchema.safeParse(value);
        if (!parsed.success) return;
        const response = parsed.data;
        if (!response.ok) { settle({ error: commandErrors[response.error.code] ?? "cmdErrSendFailed" }); return; }
        const data = response.data;
        if (data.requestId !== intent.requestId || data.roomId !== intent.roomId || data.startId !== intent.startId ||
          data.command !== intent.command || data.target !== intent.target) return;
        settle({ data });
      });
    } catch { settle({ error: "cmdErrSendFailed" }); }
    return true;
  }
}
