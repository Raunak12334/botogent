import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local first, then fall back to .env
config({ path: '.env.local' });
config({ path: '.env' });

// Use direct/unpooled connection for migrations as recommended by Neon
const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'Neither DATABASE_URL_UNPOOLED nor DATABASE_URL is set in environment files.'
  );
}

export default defineConfig({
  schema: './lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
  },
});
