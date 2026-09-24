import { statusCodes } from '../../common/constants/status-codes.js'
import { getDatasetAsset, getDatasetAssetMetadata, getS3ErrorStatus } from './client.js'

/** @typedef {import('@hapi/hapi').ResponseObject} ResponseObject */

/**
 * @typedef {object} AssetRequestRefs
 * @property {{ id: string, filename: string }} Params
 * @property {{ range?: string }} Headers
 */

/**
 * Hapi supports passThrough(), but its response types omit the method.
 * @typedef {ResponseObject & { passThrough(enabled: boolean): ResponseObject }} StreamResponse
 */

/**
 * Copies the asset's content and range headers into the response.
 *
 * @param {import('@aws-sdk/client-s3').GetObjectCommandOutput | import('@aws-sdk/client-s3').HeadObjectCommandOutput} result
 * @param {import('node:stream').Readable | null | undefined} body
 * @param {import('@hapi/hapi').ResponseToolkit<AssetRequestRefs>} h
 */
function createAssetResponse (result, body, h) {
  const response = /** @type {StreamResponse} */ (h.response(body))
    .passThrough(false)
    .code(result.$metadata.httpStatusCode)

  const headers = {
    'content-type': result.ContentType,
    'content-length': result.ContentLength,
    'content-range': result.ContentRange,
    'accept-ranges': result.AcceptRanges ?? 'bytes'
  }
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined) {
      response.header(name, String(value))
    }
  }

  return response
}

/**
 * @param {unknown} error
 * @param {import('@hapi/hapi').ResponseToolkit<AssetRequestRefs>} h
 * @returns {ResponseObject}
 */
function handleError (error, h) {
  const status = getS3ErrorStatus(error)
  if (status !== statusCodes.notFound && status !== statusCodes.rangeNotSatisfiable) {
    throw error
  }

  const response = h.response().code(status)
  const s3Error = /** @type {import('@aws-sdk/client-s3').S3ServiceException} */ (error)
  const contentRange = s3Error.$response?.headers?.['content-range']
  if (status === statusCodes.rangeNotSatisfiable && contentRange) {
    response.header('content-range', contentRange)
  }

  return response
}

/**
 * Serves byte ranges from S3 and metadata for HEAD requests.
 * Conditional headers (e.g. If-Range) are ignored because the map readers don't use them.
 *
 * @param {import('@hapi/hapi').Request<AssetRequestRefs>} request
 * @param {import('@hapi/hapi').ResponseToolkit<AssetRequestRefs>} h
 * @returns {Promise<ResponseObject>}
 */
export async function serveDatasetAsset (request, h) {
  const method = request.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    throw new Error(`Unsupported dataset asset method: ${method}`)
  }

  const { id, filename } = request.params
  const controller = new AbortController()
  request.raw.res.once('close', () => controller.abort())

  try {
    const result = method === 'HEAD'
      ? await getDatasetAssetMetadata(id, filename, request.headers.range, controller.signal)
      : await getDatasetAsset(id, filename, request.headers.range, controller.signal)
    const body = /** @type {import('node:stream').Readable | undefined} */ ('Body' in result ? result.Body : undefined)

    if (method === 'GET' && result.$metadata.httpStatusCode !== statusCodes.partialContent) {
      body?.destroy()
      controller.abort()
      throw new Error('S3 did not return partial content')
    }

    return createAssetResponse(result, method === 'HEAD' ? null : body, h)
  } catch (error) {
    return handleError(error, h)
  }
}
