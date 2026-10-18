import { CommandAckSchema, type CommandIntent, type CommandValidation, type CommandErrorCode } from "@typelore/shared";

const commandErrors: Record<CommandErrorCode, string> = {
  INVALID_PAYLOAD: "Lệnh hoặc vị trí không hợp lệ. Vui lòng nhập lại.",
  PROTOCOL_MISMATCH: "Phiên bản không tương thích. Hãy tải lại trang.",
  INTERNAL_ERROR: "Server chưa xác thực được lệnh. Vui lòng thử lại.",
  PROTOCOL_NOT_READY: "Kết nối chưa sẵn sàng. Vui lòng đợi kết nối lại.",
  NOT_IN_ROOM: "Bạn không còn trong phòng chơi.",
  ROOM_MISMATCH: "Phòng chơi đã thay đổi. Vui lòng vào lại phòng.",
  GAME_NOT_ACTIVE: "Trận đấu chưa bắt đầu hoặc đã bị hủy.",
  GAME_MISMATCH: "Trận đấu đã thay đổi. Vui lòng nhập lại lệnh trong trận mới.",
  CELL_OCCUPIED: "Ô mục tiêu đã có vật thể.",
  NOT_A_PISTOL: "Ô mục tiêu không phải Pistol để nạp đạn.",
  INVALID_TARGET: "Vị trí mục tiêu không hợp lệ.",
  NO_BRICK_AVAILABLE: "Không có Brick trên sân để hồi máu Castle.",
  BOOST_NOT_READY: "Chưa tích đủ 10 boost để bắn Bazooka.",
  BIRD_ON_COOLDOWN: "Bird đang hồi chiêu (20 giây từ lúc thả).",
  NO_AIR_TARGET: "Không có Bird đối thủ trên không để bắn tên.",
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
    this.timer = setTimeout(() => settle({ error: "Chưa nhận xác nhận; vui lòng nhập lại." }), 5000);
    try {
      send(intent, (value) => {
        if (!this.pending || token !== this.generation) return;
        const parsed = CommandAckSchema.safeParse(value);
        if (!parsed.success) return;
        const response = parsed.data;
        if (!response.ok) { settle({ error: commandErrors[response.error.code] }); return; }
        const data = response.data;
        if (data.requestId !== intent.requestId || data.roomId !== intent.roomId || data.startId !== intent.startId ||
          data.command !== intent.command || data.target !== intent.target) return;
        settle({ data });
      });
    } catch { settle({ error: "Không gửi được lệnh. Vui lòng nhập lại." }); }
    return true;
  }
}
