/**
 * OpenTax plugin for OpenClaw — agent-native tax filing.
 *
 * Provides agent tools, HTTP API with SSE, and a live dashboard server.
 */

import { join } from 'node:path'
import { TaxService } from './service/TaxService.ts'
import { registerAllTools } from './tools/registerTools.ts'
import { createHttpService } from './http/httpService.ts'
import { recognizeImageNode } from './ocr/ocrNodeEngine.ts'

interface OpenClawPluginServiceContext {
  workspaceDir?: string
  stateDir: string
}

interface OpenClawPluginApi {
  // Full OpenClaw config — use pluginConfig for plugin-specific settings
  config: Record<string, unknown>
  // Plugin-specific config from plugins.entries.<id>.config in openclaw.json
  pluginConfig?: Record<string, unknown>
  registerTool: (tool: {
    name: string
    description: string
    parameters: Record<string, unknown>
    execute: (id: string, params: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>
  }, opts?: { optional?: boolean }) => void
  registerService: (service: {
    id: string
    start: (ctx: OpenClawPluginServiceContext) => void | Promise<void>
    stop?: (ctx: OpenClawPluginServiceContext) => void | Promise<void>
  }) => void
  resolvePath: (input: string) => string
}

export default function openTaxPlugin(api: OpenClawPluginApi) {
  const cfg = api.pluginConfig ?? {}

  // Use plugin-specific workspace config; fall back to resolvePath('.')
  const workspace = (cfg.workspace as string | undefined) ?? api.resolvePath('.')
  const service = new TaxService(workspace)
  registerAllTools(api, service, recognizeImageNode)

  // Resolve staticDir: absolute paths used as-is; relative paths resolved against workspace
  const staticDirRaw = (cfg.staticDir as string | undefined) ?? './dist'
  const staticDir = staticDirRaw.startsWith('/')
    ? staticDirRaw
    : join(workspace, staticDirRaw.replace(/^\.\//, ''))

  const httpService = createHttpService(service, { staticDir })
  api.registerService({
    id: 'opentax-http',
    start: () => httpService.start(),
    stop: () => { httpService.stop(); service.close() },
  })

  return { service, httpService }
}
