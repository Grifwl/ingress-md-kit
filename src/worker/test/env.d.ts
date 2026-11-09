import type { D1Migration } from 'cloudflare:test';
import type { Env as WorkerEnv } from '../env';

declare global {
  namespace Cloudflare {
    /** Environment of the test runner: the Worker's plus the migrations to apply. */
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
