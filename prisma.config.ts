import { defineConfig } from "prisma/config";
import { loadEnvWithLocalOverride } from "./lib/load-env";

loadEnvWithLocalOverride();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
