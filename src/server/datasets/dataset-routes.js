import Validate from '@hapi/validate'
import { statusCodes } from '../common/constants/status-codes.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import { serveDatasetAsset } from './s3/assets.js'
import { getDatasetMetadata, queryDatasets } from './geonetwork/catalogue.js'
import { ASSET_FILES, getDatasetAssetsAndStyle } from './s3/client.js'

const logger = createLogger()
const RANGE = /^bytes=(\d+)-(\d+)$/

/**
 * @param {string | undefined} header
 * @returns {boolean}
 */
function isValidRange (header) {
  const match = RANGE.exec(header ?? '')
  if (!match) {
    return false
  }

  const start = Number(match[1])
  const end = Number(match[2])
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end
}

/**
 * @template {import('@hapi/hapi').ReqRef} Refs
 * @param {unknown} error
 * @param {import('@hapi/hapi').ResponseToolkit<Refs>} h
 */
function unavailable (error, h) {
  logger.error({ err: error }, 'Dataset request failed')
  return h.response({ error: 'Dataset service unavailable' }).code(statusCodes.badGateway)
}

/**
 * @param {number} status
 * @param {string} error
 * @returns {import('@hapi/hapi').Lifecycle.Method}
 */
function failWith (status, error) {
  return (_request, h) => h.response({ error }).code(status).takeover()
}

/** @type {import('@hapi/hapi').ServerRoute<{ Query: { q: string } }>} */
const searchHandler = {
  method: 'GET',
  path: '/api/datasets',
  options: {
    tags: ['api'],
    validate: {
      query: Validate.object({ q: Validate.string().max(200).allow('').default('') }),
      failAction: failWith(statusCodes.badRequest, 'Use q with at most 200 characters')
    }
  },
  async handler (request, h) {
    try {
      return await queryDatasets(request.query.q.trim())
    } catch (error) {
      return unavailable(error, h)
    }
  }
}

/** @type {import('@hapi/hapi').ServerRoute<{ Params: { id: string } }>} */
const detailHandler = {
  method: 'GET',
  path: '/api/datasets/{id}',
  options: {
    tags: ['api'],
    validate: {
      params: Validate.object({ id: Validate.string().guid().required() }),
      failAction: failWith(statusCodes.notFound, 'Dataset not found')
    }
  },
  async handler (request, h) {
    const { id } = request.params

    try {
      const [record, { styleConfig, assets }] = await Promise.all([
        getDatasetMetadata(id),
        getDatasetAssetsAndStyle(id)
      ])
      if (!record) {
        return h.response({ error: 'Dataset not found' }).code(statusCodes.notFound)
      }

      const assetUrls = Object.fromEntries(Object.entries(assets)
        .map(([type, filename]) => [type, `/api/datasets/${id}/assets/${filename}`]))

      return { ...record, display: { styleConfig, assets: assetUrls } }
    } catch (error) {
      return unavailable(error, h)
    }
  }
}

/**
 * Range support is limited to what the map's COG and FlatGeobuf readers need.
 * GET requires a single byte range with a start and end to prevent accidental
 * full downloads. HEAD returns metadata without downloading the body.
 *
 * @type {import('@hapi/hapi').ServerRoute<import('./s3/assets.js').AssetRequestRefs>}
 */
const assetHandler = {
  method: 'GET',
  path: '/api/datasets/{id}/assets/{filename}',
  options: {
    tags: ['api'],
    response: { ranges: false },
    validate: {
      params: Validate.object({
        id: Validate.string().guid().required(),
        filename: Validate.string().valid(...Object.values(ASSET_FILES)).required()
      }),
      failAction: failWith(statusCodes.notFound, 'Dataset file not found')
    }
  },
  async handler (request, h) {
    const { range } = request.headers
    if ((request.method === 'get' || range !== undefined) && !isValidRange(range)) {
      return h.response({ error: 'A single byte range with a start and end is required' }).code(statusCodes.badRequest)
    }

    try {
      return await serveDatasetAsset(request, h)
    } catch (error) {
      return unavailable(error, h)
    }
  }
}

export default [searchHandler, detailHandler, assetHandler]
