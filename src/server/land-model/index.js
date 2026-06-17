import Boom from '@hapi/boom'
import Accept from '@hapi/accept'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const staticDir = path.join(dirname, 'static')

const ALLOWED_FILES = new Set(['parcels', 'grids'])

function acceptsBrotli (request) {
  return Accept.encoding(request.headers['accept-encoding'], ['br']) === 'br'
}

// Temporary static file handler for the land model until the model is hosted.
export const landModel = {
  plugin: {
    name: 'land-model',
    register (server) {
      server.route({
        method: 'GET',
        path: '/land-model/{file}.json',
        handler (request, h) {
          const { file } = request.params
          if (!ALLOWED_FILES.has(file)) {
            throw Boom.notFound()
          }

          if (!acceptsBrotli(request)) {
            throw Boom.notAcceptable('Brotli support is required')
          }

          const filePath = path.join(staticDir, `${file}.json.br`)

          return h.file(filePath, { confine: staticDir })
            .type('application/json')
            .header('content-encoding', 'br')
            .header('cache-control', 'private, no-cache')
        }
      })
    }
  }
}
