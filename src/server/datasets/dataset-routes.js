import Validate from '@hapi/validate'
import { statusCodes } from '../common/constants/status-codes.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import { serveAsset } from './s3/assets.js'
import { getDatasetMetadata, queryDatasets } from './geonetwork/catalogue.js'
import { BrokenReleaseError, VERSION_ID_SCHEMA, getManifest, getJson } from './s3/client.js'

const ASSET_FILES = { cog: 'data.tif', fgb: 'data.fgb' }
const DATASET_ID_SCHEMA = Validate.string().guid().required()
const logger = createLogger()

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
 * @param {string} id Dataset UUID
 * @param {string} filename
 * @param {string | null} version S3 version ID from the manifest
 * @returns {string}
 */
function assetUrl (id, filename, version) {
  const path = `/api/datasets/${id}/layer/assets/${filename}`
  return version === null ? path : `${path}?${new URLSearchParams({ v: version })}`
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
      params: Validate.object({ id: DATASET_ID_SCHEMA }),
      failAction: failWith(statusCodes.notFound, 'Dataset not found')
    }
  },
  async handler (request, h) {
    try {
      const record = await getDatasetMetadata(request.params.id)
      if (!record) {
        return h.response({ error: 'Dataset not found' }).code(statusCodes.notFound)
      }

      return record
    } catch (error) {
      return unavailable(error, h)
    }
  }
}

/**
 * @type {import('@hapi/hapi').ServerRoute<{ Params: { id: string } }>}
 */
const layerHandler = {
  method: 'GET',
  path: '/api/datasets/{id}/layer',
  options: {
    tags: ['api'],
    validate: {
      params: Validate.object({ id: DATASET_ID_SCHEMA }),
      failAction: failWith(statusCodes.notFound, 'Dataset layer not found')
    }
  },
  async handler (request, h) {
    const { id } = request.params

    try {
      const release = await getManifest(id)
      if (!release) {
        return h.response({ error: 'Dataset layer not found' }).code(statusCodes.notFound)
      }

      const { manifestVersion, generatedAt, files } = release
      const styleConfig = await getJson(id, 'style.json', files['style.json'])
      const assets = Object.fromEntries(Object.entries(ASSET_FILES)
        .filter(([, filename]) => Object.hasOwn(files, filename))
        .map(([type, filename]) => [type, assetUrl(id, filename, files[filename])]))

      return { manifestVersion, generatedAt, styleConfig, assets }
    } catch (error) {
      if (error instanceof BrokenReleaseError) {
        logger.error({ err: error }, 'Dataset layer release is broken')
        return h.response({ error: 'Dataset layer is invalid' }).code(statusCodes.internalServerError)
      }

      return unavailable(error, h)
    }
  }
}

/**
 *
 * @type {import('@hapi/hapi').ServerRoute<import('./s3/assets.js').AssetRequestRefs>}
 */
const assetHandler = {
  method: 'GET',
  path: '/api/datasets/{id}/layer/assets/{filename}',
  options: {
    tags: ['api'],
    response: { ranges: false },
    validate: {
      params: Validate.object({
        id: DATASET_ID_SCHEMA,
        filename: Validate.string().valid(...Object.values(ASSET_FILES)).required()
      }),
      query: Validate.object({ v: VERSION_ID_SCHEMA }),
      failAction: failWith(statusCodes.notFound, 'Dataset file not found')
    }
  },
  async handler (request, h) {
    try {
      return await serveAsset(request.params.id, request, h)
    } catch (error) {
      return unavailable(error, h)
    }
  }
}

export default [searchHandler, detailHandler, layerHandler, assetHandler]
