import { TaxService } from '../openclaw-plugin/service/TaxService.ts'
import { createHttpService } from '../openclaw-plugin/http/httpService.ts'

const workspace = process.env.OPENTAX_WORKSPACE ?? '.'
const staticDir = process.env.OPENTAX_STATIC_DIR ?? './dist'
const port = parseInt(process.env.OPENTAX_PORT ?? '7891', 10)

const service = new TaxService(workspace)
const http = createHttpService(service, { port, staticDir })

http.start().then(() => {
  console.log(`OpenTax server running at http://localhost:${port}`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    http.stop().then(() => { service.close(); process.exit(0) })
  })
}
