import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/** Prisma CLI configuration: schema, migrations, seed command and database URL. */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
});
