import { z } from "zod";

export const COMMAND_RULES = {
  pistol: 9, "load ammo": 9, protector: 9, "add water": 9, "add clay": 9,
  bazooka: 4, "add brick": 0, boost: 0, "bird and bomb": 0, arrow: 0,
} as const;
export const GameCommandSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9 ]+$/)
  .transform((value) => value.toLowerCase()).pipe(z.enum(Object.keys(COMMAND_RULES) as (keyof typeof COMMAND_RULES)[]));
export type GameCommand = z.infer<typeof GameCommandSchema>;
export function parseGameCommand(value: unknown) { return GameCommandSchema.safeParse(value); }
export function parseCommandTarget(command: GameCommand, value: string): number | null {
  return /^[1-9]$/.test(value) && Number(value) <= COMMAND_RULES[command] ? Number(value) : null;
}
const identifiers = { requestId: z.uuid(), roomId: z.uuid(), startId: z.uuid() };
const commandFields = { ...identifiers, command: GameCommandSchema, target: z.number().int().optional() };
function validTarget(value: { command: GameCommand; target?: number | undefined }): boolean {
  const max = COMMAND_RULES[value.command];
  return max === 0 ? !Object.hasOwn(value, "target") :
    value.target !== undefined && value.target >= 1 && value.target <= max;
}
export const CommandIntentSchema = z.object(commandFields).strict().refine(validTarget, "Invalid command target.");
export const CommandValidationSchema = z.object({ ...commandFields, status: z.enum(["VALIDATED", "EXECUTED"]) })
  .strict().refine(validTarget, "Invalid command target.");
export const CommandErrorCodeSchema = z.enum([
  "INVALID_PAYLOAD", "PROTOCOL_MISMATCH", "INTERNAL_ERROR", "PROTOCOL_NOT_READY",
  "NOT_IN_ROOM", "ROOM_MISMATCH", "GAME_NOT_ACTIVE", "GAME_MISMATCH",
  "CELL_OCCUPIED", "NOT_A_PISTOL", "INVALID_TARGET", "NO_BRICK_AVAILABLE",
  "BOOST_NOT_READY", "BIRD_ON_COOLDOWN", "NO_AIR_TARGET",
]);
export const CommandAckSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: CommandValidationSchema, serverTime: z.number().finite().nonnegative() }).strict(),
  z.object({ ok: z.literal(false), error: z.object({ code: CommandErrorCodeSchema,
    message: z.string().max(256) }).strict(), serverTime: z.number().finite().nonnegative() }).strict(),
]);
export type CommandIntent = z.infer<typeof CommandIntentSchema>;
export type CommandValidation = z.infer<typeof CommandValidationSchema>;
export type CommandErrorCode = z.infer<typeof CommandErrorCodeSchema>;
