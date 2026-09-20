import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

const here = path.dirname(fileURLToPath(import.meta.url));

// One .env at the repo root serves every workspace, so the API, the web app
// and the Prisma CLI can never drift onto different databases. A local
// apps/api/.env still wins if someone needs to point one process elsewhere.
loadEnv({ path: path.resolve(here, '../../.env'), quiet: true });
loadEnv({ path: path.resolve(here, '.env'), override: true, quiet: true });

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
