import { z } from "zod";

export const PROTOCOL_VERSION = "1.0.0" as const;

export const ProtocolHelloSchema = z
  .object({
    protocolVersion: z.string().min(1).max(32),
  })
  .strict();

export const ConnectionPingSchema = z
  .object({
    nonce: z.string().min(1).max(64),
    clientTime: z.number().finite().nonnegative(),
  })
  .strict();

export type ProtocolHello = z.infer<typeof ProtocolHelloSchema>;
export type ConnectionPing = z.infer<typeof ConnectionPingSchema>;

export interface ProtocolWelcome {
  protocolVersion: typeof PROTOCOL_VERSION;
  serverTime: number;
  connectionId: string;
}

export interface ConnectionPong extends ConnectionPing {
  serverTime: number;
}
