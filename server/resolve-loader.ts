/**
 * ESM loader hook — intercepts resolution of `better-sqlite3` and redirects
 * to the root node_modules build (system-Node-compatible).
 */
import { resolve as resolvePath, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(resolvePath(__dirname, '..', 'package.json'))
const rootBetterSqlite3Path = require.resolve('better-sqlite3')
const rootBetterSqlite3URL = pathToFileURL(rootBetterSqlite3Path).href

export function resolve(
  specifier: string,
  context: { parentURL?: string; conditions: string[] },
  nextResolve: Function,
) {
  if (specifier === 'better-sqlite3') {
    return { url: rootBetterSqlite3URL, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
