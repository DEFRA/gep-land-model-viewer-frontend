import Validate from '@hapi/validate'
import { statusCodes } from '../common/constants/status-codes.js'
import { createLayerRoutes, failWith, unavailable } from '../common/helpers/s3/layer-routes.js'
import { getDatasetMetadata, queryDatasets } from './geonetwork/catalogue.js'

const DATASET_ID_SCHEMA = Validate.string().guid().required()

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
      return unavailable('Dataset', error, h)
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
      return unavailable('Dataset', error, h)
    }
  }
}

export default [
  searchHandler,
  detailHandler,
  ...createLayerRoutes({
    path: '/api/datasets/{id}/layer',
    params: { id: DATASET_ID_SCHEMA },
    prefixFor: ({ id }) => id,
    assetFiles: { cog: 'data.tif', fgb: 'data.fgb' },
    name: 'Dataset',
    service: 'Dataset'
  })
]
