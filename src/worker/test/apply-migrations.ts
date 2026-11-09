import { applyD1Migrations, env } from 'cloudflare:test';

// Runs before each test file, so every file starts from the real schema.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
