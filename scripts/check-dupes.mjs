// Fails when a must-be-singleton package is installed more than once: in two versions, or as two
// copies of one version in different folders.
// Duplicate React copies crash React Native at runtime; duplicate hono copies break RPC types;
// duplicate drizzle-orm copies make queries built in one package fail type checks in another.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const singletons = [
  'react',
  'react-dom',
  'react-native',
  'react-native-svg',
  'hono',
  'zod',
  'drizzle-orm',
]

const raw = execSync('npm ls --all --json --silent || true', {
  encoding: 'utf8',
  maxBuffer: 512 * 1024 * 1024,
})
const tree = JSON.parse(raw)
const versions = new Map()

function walk(node) {
  for (const [name, dep] of Object.entries(node.dependencies ?? {})) {
    if (singletons.includes(name) && dep.version) {
      const set = versions.get(name) ?? new Set()
      set.add(dep.version)
      versions.set(name, set)
    }
    walk(dep)
  }
}
walk(tree)

// `npm ls` reports versions, not folders, so two copies of one version look like one. npm can
// install such copies when a peer dependency stops a package being hoisted to the root; the
// lockfile lists every folder a package is installed in.
const locations = new Map()
const lockfile = new URL('../package-lock.json', import.meta.url)
if (existsSync(lockfile)) {
  const { packages = {} } = JSON.parse(readFileSync(lockfile, 'utf8'))
  for (const path of Object.keys(packages)) {
    const at = path.lastIndexOf('node_modules/')
    if (at === -1) continue
    const name = path.slice(at + 'node_modules/'.length)
    if (!singletons.includes(name)) continue
    locations.set(name, [...(locations.get(name) ?? []), path])
  }
}

let failed = false
for (const name of singletons) {
  const found = [...(versions.get(name) ?? [])]
  const paths = locations.get(name) ?? []
  if (found.length === 0 && paths.length === 0) continue
  const ok = found.length <= 1 && paths.length <= 1
  failed ||= !ok
  const copies = paths.length > 1 ? ` (${paths.length} copies: ${paths.join(', ')})` : ''
  console.log(`${ok ? 'ok  ' : 'DUP '} ${name}: ${found.join(', ')}${copies}`)
}
process.exit(failed ? 1 : 0)
