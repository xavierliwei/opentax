import { TaxService } from '../openclaw-plugin/service/TaxService.ts'
import { createHttpService } from '../openclaw-plugin/http/httpService.ts'
import { logger } from '../openclaw-plugin/utils/logger.ts'
import { createShutdownManager } from '../openclaw-plugin/utils/shutdown.ts'

const workspace = process.env.OPENTAX_WORKSPACE ?? '.'
const staticDir = process.env.OPENTAX_STATIC_DIR ?? './dist'
const port = parseInt(process.env.OPENTAX_PORT ?? '7891', 10)

const corsOrigin = process.env.OPENTAX_CORS_ORIGIN

const service = new TaxService(workspace)
const httpService = createHttpService(service, { port, staticDir, corsOrigin })

const shutdown = createShutdownManager()
shutdown.register('taxService', () => service.close())
shutdown.register('http', () => httpService.stop())
shutdown.installSignalHandlers()

httpService.start().then(() => {
  logger.info('Server started', {
    port,
    workspace,
    staticDir,
    nodeVersion: process.version,
    logLevel: process.env.LOG_LEVEL ?? 'info',
  })
})
