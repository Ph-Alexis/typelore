import { randomInt } from "node:crypto";
import { ROOM_CODE_ALPHABET } from "@typelore/shared";

export function generateRoomCode(): string {
  return Array.from({ length: 6 }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join("");
}
