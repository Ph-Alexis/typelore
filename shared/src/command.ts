import { z } from "zod";

export const COMMAND_RULES = {
  pistol: 9, "load ammo": 9, protector: 9, "add water": 9, "add clay": 9,
  bazooka: 4, "use brick": 0, "bird and bomb": 0, arrow: 0,
} as const;
export const GameCommandSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9 ]+$/)
  .transform((value) => value.toLowerCase()).pipe(z.enum(Object.keys(COMMAND_RULES) as (keyof typeof COMMAND_RULES)[]));
export type GameCommand = z.infer<typeof GameCommandSchema>;
export function parseGameCommand(value: unknown) { return GameCommandSchema.safeParse(value); }
export function parseCommandTarget(command: GameCommand, value: string): number | string | null {
  if (command === "bazooka") {
    if (/^[1-4]$/.test(value)) return Number(value);
    if (/^[a-dA-D]$/.test(value)) return value.toUpperCase();
    return null;
  }
  return /^[1-9]$/.test(value) && Number(value) <= COMMAND_RULES[command] ? Number(value) : null;
}
const identifiers = { requestId: z.uuid(), roomId: z.uuid(), startId: z.uuid() };
const commandFields = {
  ...identifiers,
  command: GameCommandSchema,
  target: z.union([
    z.number().int(),
    z.enum(["A", "B", "C", "D", "a", "b", "c", "d"]).transform((val) => val.toUpperCase() as "A" | "B" | "C" | "D"),
  ]).optional(),
};
function validTarget(value: { command: GameCommand; target?: unknown }): boolean {
  const max = COMMAND_RULES[value.command];
  if (max === 0) return !Object.hasOwn(value, "target");
  if (value.command === "bazooka") {
    return value.target === "A" || value.target === "B" || value.target === "C" || value.target === "D" ||
      (typeof value.target === "number" && value.target >= 1 && value.target <= 4);
  }
  return typeof value.target === "number" && value.target >= 1 && value.target <= max;
}
export const CommandIntentSchema = z.object(commandFields).strict().refine(validTarget, "Invalid command target.");
export const CommandValidationSchema = z.object({ ...commandFields, status: z.enum(["VALIDATED", "EXECUTED"]) })
  .strict().refine(validTarget, "Invalid command target.");
export const CommandErrorCodeSchema = z.enum([
  "INVALID_PAYLOAD", "PROTOCOL_MISMATCH", "INTERNAL_ERROR", "PROTOCOL_NOT_READY",
  "NOT_IN_ROOM", "ROOM_MISMATCH", "GAME_NOT_ACTIVE", "GAME_MISMATCH",
  "CELL_OCCUPIED", "NOT_A_PISTOL", "INVALID_TARGET", "NO_BRICK_AVAILABLE",
  "BOOST_NOT_READY", "BAZOOKA_ON_COOLDOWN", "BIRD_ON_COOLDOWN", "NO_AIR_TARGET",
]);
export const CommandAckSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: CommandValidationSchema, serverTime: z.number().finite().nonnegative() }).strict(),
  z.object({ ok: z.literal(false), error: z.object({ code: CommandErrorCodeSchema,
    message: z.string().max(256) }).strict(), serverTime: z.number().finite().nonnegative() }).strict(),
]);
export type CommandIntent = z.infer<typeof CommandIntentSchema>;
export type CommandValidation = z.infer<typeof CommandValidationSchema>;
export type CommandErrorCode = z.infer<typeof CommandErrorCodeSchema>;
