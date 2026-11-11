import { defineConfig } from 'tsup'

/**
 * Two entries end up in dist/: the server and the one-off migration runner the deploy pipeline
 * executes before a new version takes traffic. Workspace packages export TypeScript source, so they
 * are bundled in; npm dependencies stay external and come from node_modules.
 */
export default defineConfig({
  entry: ['src/server.ts', 'src/migrate.ts'],
  format: 'esm',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  noExternal: [/^@elevate\//],
})
