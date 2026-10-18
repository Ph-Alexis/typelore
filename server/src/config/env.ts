import { z } from "zod";

const EnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65_535).default(3_001),
  CLIENT_ORIGIN: z.string().min(1).default("http://localhost:5173"),
});

export interface ServerEnvironment {
  port: number;
  clientOrigin: string;
}

export function loadEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): ServerEnvironment {
  const parsed = EnvironmentSchema.parse(environment);

  return {
    port: parsed.PORT,
    clientOrigin: parsed.CLIENT_ORIGIN,
  };
}
