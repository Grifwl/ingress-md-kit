import { resolve } from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Tests read the tracked example configuration, so they also run on a
// fresh clone that has no instance-specific wrangler.toml.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(resolve(import.meta.dirname, 'migrations'));
  return {
    plugins: [
      cloudflareTest({
        main: './src/worker/index.ts',
        wrangler: { configPath: './wrangler.example.toml' },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      }),
    ],
    test: {
      include: ['src/**/*.test.ts'],
      setupFiles: ['./src/worker/test/apply-migrations.ts'],
    },
  };
});
