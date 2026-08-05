import { existsSync } from "fs";
import { config as loadEnv } from "dotenv";

// .env define os valores padrão (Neon). Se existir .env.development
// (config local do desenvolvedor, não versionado), ele sobrescreve —
// mesma precedência que o Next.js usa para next dev.
export function loadEnvWithLocalOverride() {
  loadEnv();
  if (existsSync(".env.development")) {
    loadEnv({ path: ".env.development", override: true });
  }
}
