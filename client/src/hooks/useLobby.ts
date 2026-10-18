import { useEffect, useRef, useState } from "react";
import { GameStartSchema, RoomPlayerJoinedSchema, RoomPlayerLeftSchema, RoomStateSchema,
  type GameState, type RoomAck, type RoomState, type RoomErrorCode, type ProtocolErrorCode } from "@typelore/shared";
import { socket } from "../socket/client";
import { acceptGameSync } from "./gameSync";
import type { TranslationKey } from "../i18n/translations";

type Action = "CREATE" | "JOIN" | "READY" | "LEAVE";
interface LobbyState {
  room: RoomState | null;
  pending: Action | null;
  error: string;
  notice: string;
  startId: string | null;
  game: GameState | null;
}
const initial: LobbyState = { room: null, pending: null, error: "", notice: "", startId: null, game: null };
const errors: Record<RoomErrorCode | ProtocolErrorCode, TranslationKey> = {
  INVALID_PAYLOAD: "errInvalidPayload",
  PROTOCOL_MISMATCH: "errProtocolMismatch",
  INTERNAL_ERROR: "errInternalError",
  INVALID_ROOM_CODE: "errInvalidRoomCode",
  PROTOCOL_NOT_READY: "errProtocolNotReady",
  ALREADY_IN_ROOM: "errAlreadyInRoom",
  ROOM_NOT_FOUND: "errRoomNotFound",
  ROOM_FULL: "errRoomFull",
  ROOM_NOT_JOINABLE: "errRoomNotJoinable",
  NOT_IN_ROOM: "errNotInRoom",
  ROOM_MISMATCH: "errRoomMismatch",
  ROOM_NOT_WAITING: "errRoomNotWaiting",
  ROOM_CODE_EXHAUSTED: "errRoomCodeExhausted",
  ROOM_NOT_OVER: "errRoomNotOver",
};

export function useLobby(online: boolean) {
  const [state, setState] = useState<LobbyState>(initial);
  const room = useRef<RoomState | null>(null);
  const startId = useRef<string | null>(null);
  const game = useRef<GameState | null>(null);
  const pending = useRef<Action | null>(null);
  const joinCode = useRef<string | null>(null);
  const generation = useRef(0);
  const active = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function applyRoom(candidate: unknown): void {
    const parsed = RoomStateSchema.safeParse(candidate);
    if (!parsed.success || !parsed.data.players.some((player) => player.connectionId === socket.id)) return;
    const next = parsed.data;
    const previous = room.current;
    if (previous) {
      if (previous.roomId !== next.roomId || next.revision <= previous.revision) return;
    } else if (pending.current !== "CREATE" && pending.current !== "JOIN") return;
    if (!previous && pending.current === "JOIN" && next.code !== joinCode.current) return;
    room.current = next;
    if (next.status !== "STARTING" && next.status !== "IN_GAME" && next.status !== "GAME_OVER") {
      startId.current = null;
      game.current = null;
    }
    setState((old) => ({ ...old, room: next, startId: startId.current, game: game.current }));
  }

  useEffect(() => {
    active.current = true;
    function reset(): void {
      generation.current += 1;
      clearTimeout(timer.current);
      pending.current = null;
      joinCode.current = null;
      room.current = null;
      startId.current = null;
      game.current = null;
      setState((old) => ({ ...initial, error: old.error,
        notice: "lobbyNoticeConnectionReset" }));
    }
    function update(payload: RoomState): void { applyRoom(payload); }
    function joined(payload: unknown): void {
      const parsed = RoomPlayerJoinedSchema.safeParse(payload);
      if (parsed.success && parsed.data.roomId === room.current?.roomId && parsed.data.revision === room.current.revision) {
        setState((old) => ({ ...old, notice: "lobbyNoticePlayerJoined" }));
      }
    }
    function left(payload: unknown): void {
      const parsed = RoomPlayerLeftSchema.safeParse(payload);
      if (parsed.success && parsed.data.roomId === room.current?.roomId && parsed.data.revision === room.current.revision) {
        setState((old) => ({ ...old, notice: parsed.data.reason === "DISCONNECTED"
          ? "lobbyNoticeOpponentDisconnected" : "lobbyNoticeOpponentLeft" }));
      }
    }
    function started(payload: unknown): void {
      const parsed = GameStartSchema.safeParse(payload);
      if (!parsed.success || parsed.data.room.roomId !== room.current?.roomId ||
        parsed.data.room.revision < room.current.revision) return;
      applyRoom(parsed.data.room);
      startId.current = parsed.data.startId;
      setState((old) => old.startId === parsed.data.startId ? old : { ...old, startId: parsed.data.startId });
    }
    function synced(payload: unknown): void {
      const next = acceptGameSync(payload, room.current, startId.current, game.current, socket.id);
      if (!next) return;
      room.current = next.room;
      game.current = next.state;
      setState((old) => ({ ...old, room: next.room, game: next.state, startId: next.state.startId }));
    }
    socket.on("room:updated", update);
    socket.on("room:player-joined", joined);
    socket.on("room:player-left", left);
    socket.on("game:start", started);
    socket.on("game:state-sync", synced);
    socket.on("connect", reset);
    socket.on("disconnect", reset);
    return () => {
      active.current = false;
      generation.current += 1;
      clearTimeout(timer.current);
      pending.current = null;
      room.current = null;
      startId.current = null;
      game.current = null;
      socket.off("room:updated", update);
      socket.off("room:player-joined", joined);
      socket.off("room:player-left", left);
      socket.off("game:start", started);
      socket.off("game:state-sync", synced);
      socket.off("connect", reset);
      socket.off("disconnect", reset);
    };
  }, []);

  function perform(action: Action, code?: string): void {
    if (!online || !socket.connected || pending.current || !active.current) return;
    const currentRoom = room.current;
    const self = currentRoom?.players.find((player) => player.connectionId === socket.id);
    if ((action === "READY" || action === "LEAVE") && !currentRoom) return;
    if (action === "READY" && (!self || currentRoom?.status !== "READY_TO_START")) return;
    const token = ++generation.current;
    pending.current = action;
    joinCode.current = code ?? null;
    setState((old) => ({ ...old, pending: action, error: "", notice: "" }));
    timer.current = setTimeout(() => {
      if (!active.current || generation.current !== token) return;
      setState((old) => ({ ...old, error: "lobbyErrorTimeout" }));
      socket.disconnect();
      socket.connect();
    }, 5000);
    function finish(response: RoomAck<{ room: RoomState } | { roomId: string }>): void {
      if (!active.current || generation.current !== token) return;
      clearTimeout(timer.current);
      if (!response.ok) {
        setState((old) => ({ ...old, pending: null, error: errors[response.error.code] ?? "lobbyErrorFailed" }));
      } else if (action === "LEAVE") {
        if (room.current?.roomId === currentRoom?.roomId) {
          room.current = null;
          startId.current = null;
          game.current = null;
          setState({ ...initial, notice: "lobbyNoticeYouLeft" });
        }
      } else if ("room" in response.data) {
        applyRoom(response.data.room);
        setState((old) => ({ ...old, pending: null }));
      }
      pending.current = null;
      joinCode.current = null;
    }
    switch (action) {
      case "CREATE": socket.emit("room:create", {}, finish); break;
      case "JOIN": socket.emit("room:join", { code: code ?? "" }, finish); break;
      case "READY": socket.emit("room:ready", { roomId: currentRoom!.roomId, ready: !self!.ready }, finish); break;
      case "LEAVE": socket.emit("room:leave", { roomId: currentRoom!.roomId }, finish); break;
    }
  }
  return { ...state, create: () => perform("CREATE"), join: (code: string) => perform("JOIN", code),
    ready: () => perform("READY"), leave: () => perform("LEAVE") };
}
