import { defineConfig } from 'tsup'

/**
 * Four entries end up in dist/: the server; the one-off migration runner the deploy pipeline
 * executes before a new version takes traffic; and two commands run by hand as one-off tasks,
 * `reset-schema` (empties the database) and `seed`. Workspace packages export TypeScript source,
 * so they are bundled in; npm dependencies stay external and come from node_modules.
 */
export default defineConfig({
  entry: ['src/server.ts', 'src/migrate.ts', 'src/reset-schema.ts', 'src/seed.ts'],
  format: 'esm',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  noExternal: [/^@elevate\//],
})
