// Fails when more than one version of a must-be-singleton package is installed.
// Duplicate React copies crash React Native at runtime; duplicate hono copies break RPC types.
import { execSync } from 'node:child_process'

const singletons = ['react', 'react-dom', 'react-native', 'react-native-svg', 'hono', 'zod']

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

let failed = false
for (const name of singletons) {
  const found = [...(versions.get(name) ?? [])]
  if (found.length === 0) continue
  const ok = found.length === 1
  failed ||= !ok
  console.log(`${ok ? 'ok  ' : 'DUP '} ${name}: ${found.join(', ')}`)
}
process.exit(failed ? 1 : 0)
