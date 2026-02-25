import { TaxService } from '../openclaw-plugin/service/TaxService.ts'
import { createHttpService } from '../openclaw-plugin/http/httpService.ts'
import { logger } from '../openclaw-plugin/utils/logger.ts'

const workspace = process.env.OPENTAX_WORKSPACE ?? '.'
const staticDir = process.env.OPENTAX_STATIC_DIR ?? './dist'
const port = parseInt(process.env.OPENTAX_PORT ?? '7891', 10)

const corsOrigin = process.env.OPENTAX_CORS_ORIGIN

const service = new TaxService(workspace)
const http = createHttpService(service, { port, staticDir, corsOrigin })

http.start().then(() => {
  logger.info('OpenTax server started', {
    port,
    workspace,
    staticDir,
    nodeVersion: process.version,
    logLevel: process.env.LOG_LEVEL ?? 'info',
  })
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    logger.info('Shutting down', { signal: sig })
    http.stop().then(() => { service.close(); process.exit(0) })
  })
}
