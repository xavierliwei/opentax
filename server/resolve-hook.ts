/**
 * Registers an ESM resolve hook that redirects `better-sqlite3` imports to
 * the root node_modules copy (compiled for system Node), not the one inside
 * openclaw-plugin/node_modules (compiled for OpenClaw's runtime).
 */
import { register } from 'node:module'

register('./resolve-loader.ts', import.meta.url)
