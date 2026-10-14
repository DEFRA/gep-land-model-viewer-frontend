import Validate from '@hapi/validate'
import { statusCodes } from '../../constants/status-codes.js'
import { createLogger } from '../logging/logger.js'
import { serveAsset } from './assets.js'
import { BrokenReleaseError, VERSION_ID_SCHEMA } from './client.js'
import { getLayer } from './layer.js'

const logger = createLogger()

/**
 * @param {number} status
 * @param {string} error
 * @returns {import('@hapi/hapi').Lifecycle.Method}
 */
export function failWith (status, error) {
  return (_request, h) => h.response({ error }).code(status).takeover()
}

/**
 * @template {import('@hapi/hapi').ReqRef} Refs
 * @param {string} service Names the service in the log and the error, such as 'Dataset'
 * @param {unknown} error
 * @param {import('@hapi/hapi').ResponseToolkit<Refs>} h
 */
export function unavailable (service, error, h) {
  logger.error({ err: error }, `${service} request failed`)
  return h.response({ error: `${service} service unavailable` }).code(statusCodes.badGateway)
}

/**
 * @param {object} options
 * @param {string} options.path Path of the layer route. Its assets are served below it
 * @param {Record<string, import('@hapi/validate').Schema>} [options.params]
 * @param {(params: Record<string, string>) => string} options.prefixFor Object key prefix of the layer's files
 * @param {Record<string, string>} options.assetFiles Asset filenames by type
 * @param {string} options.name Names the layer in errors, such as 'Dataset'
 * @param {string} options.service Names the service when S3 fails
 */
export function createLayerRoutes ({ path, params, prefixFor, assetFiles, name, service }) {
  /** @type {import('@hapi/hapi').ServerRoute<{ Params: Record<string, string> }>} */
  const layerRoute = {
    method: 'GET',
    path,
    options: {
      tags: ['api'],
      // hapi rejects parameter validation on a path without parameters.
      ...(params && {
        validate: {
          params: Validate.object(params),
          failAction: failWith(statusCodes.notFound, `${name} layer not found`)
        }
      })
    },
    async handler (request, h) {
      try {
        const layer = await getLayer(prefixFor(request.params), assetFiles, `${request.path}/assets`)
        if (!layer) {
          return h.response({ error: `${name} layer not found` }).code(statusCodes.notFound)
        }

        return layer
      } catch (error) {
        if (error instanceof BrokenReleaseError) {
          logger.error({ err: error }, `${name} layer release is broken`)
          return h.response({ error: `${name} layer is invalid` }).code(statusCodes.internalServerError)
        }

        return unavailable(service, error, h)
      }
    }
  }

  /** @type {import('@hapi/hapi').ServerRoute<import('./assets.js').AssetRequestRefs>} */
  const assetRoute = {
    method: 'GET',
    path: `${path}/assets/{filename}`,
    options: {
      tags: ['api'],
      response: { ranges: false },
      validate: {
        params: Validate.object({
          ...params,
          filename: Validate.string().valid(...Object.values(assetFiles)).required()
        }),
        query: Validate.object({ v: VERSION_ID_SCHEMA }),
        failAction: failWith(statusCodes.notFound, `${name} file not found`)
      }
    },
    async handler (request, h) {
      try {
        return await serveAsset(prefixFor(request.params), request, h)
      } catch (error) {
        return unavailable(service, error, h)
      }
    }
  }

  return [layerRoute, assetRoute]
}
