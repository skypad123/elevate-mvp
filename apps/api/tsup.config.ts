import { defineConfig } from 'tsup'

/**
 * Seven entries end up in dist/: the server; the one-off migration runner the deploy pipeline
 * executes before a new version takes traffic; `check-api-role`, which the pipeline runs after a
 * deploy to confirm the database refuses the API's user an attendance update; `release`, the
 * release job that a schedule starts every 15 minutes to send seat refunds and pay profiles; and
 * three commands run by hand as one-off tasks, `reset-schema` (empties the database), `seed`, and
 * `previews` (hover-preview clips). Workspace packages export TypeScript source, so they are
 * bundled in; npm dependencies stay external and come from node_modules.
 */
export default defineConfig({
  entry: [
    'src/server.ts',
    'src/migrate.ts',
    'src/reset-schema.ts',
    'src/seed.ts',
    'src/previews.ts',
    'src/check-api-role.ts',
    'src/release.ts',
  ],
  format: 'esm',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  noExternal: [/^@elevate\//],
})
