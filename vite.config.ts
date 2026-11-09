import { resolve } from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

const projectRoot = import.meta.dirname;

// The Vite root is src/web so that the admin page is served at /admin/.
// Paths given to the Cloudflare plugin are absolute because it would
// otherwise resolve them against that root, and the local database
// would no longer be the one that `wrangler d1 ... --local` writes to.
export default defineConfig({
  root: resolve(projectRoot, 'src/web'),
  publicDir: false,
  plugins: [
    preact(),
    cloudflare({
      configPath: resolve(projectRoot, 'wrangler.toml'),
      persistState: { path: resolve(projectRoot, '.wrangler/state') },
      // A fixed name keeps the build at dist/worker, whatever the Worker
      // is called in wrangler.toml; the deploy script relies on that path.
      viteEnvironment: { name: 'worker' },
    }),
  ],
  build: {
    outDir: resolve(projectRoot, 'dist'),
    emptyOutDir: true,
  },
  // The HTML entry belongs to the browser build only: set at the top
  // level, it would also be treated as an entry of the Worker build.
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: { admin: resolve(projectRoot, 'src/web/admin/index.html') },
        },
      },
    },
  },
});
