import { statusCodes } from '../../common/constants/status-codes.js'
import { getAsset, getAssetMetadata, getS3ErrorStatus, isMissingObject } from './client.js'

const RANGE = /^bytes=(\d+)-(\d+)$/

/** @typedef {import('@hapi/hapi').ResponseObject} ResponseObject */

/**
 * @typedef {object} AssetRequestRefs
 * @property {{ id: string, filename: string }} Params
 * @property {{ v?: string }} Query
 * @property {{ range?: string }} Headers
 */

/**
 * Hapi supports passThrough(), but its response types omit the method.
 * @typedef {ResponseObject & { passThrough(enabled: boolean): ResponseObject }} StreamResponse
 */

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
  if (isMissingObject(error)) {
    return h.response().code(statusCodes.notFound)
  }

  const status = getS3ErrorStatus(error)
  if (status !== statusCodes.rangeNotSatisfiable) {
    throw error
  }

  const response = h.response().code(status)
  const s3Error = /** @type {import('@aws-sdk/client-s3').S3ServiceException} */ (error)
  const contentRange = s3Error.$response?.headers?.['content-range']
  if (contentRange) {
    response.header('content-range', contentRange)
  }

  return response
}

/**
 * GET requires one byte range with a start and end to prevent accidental full downloads.
 * HEAD returns metadata and may omit the range. Conditional headers (e.g. If-Range) are
 * ignored because the map readers don't use them.
 *
 * @param {string} prefix
 * @param {import('@hapi/hapi').Request<AssetRequestRefs>} request
 * @param {import('@hapi/hapi').ResponseToolkit<AssetRequestRefs>} h
 * @returns {Promise<ResponseObject>}
 */
export async function serveAsset (prefix, request, h) {
  const method = request.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    throw new Error(`Unsupported asset method: ${method}`)
  }

  const { range } = request.headers
  if ((method === 'GET' || range !== undefined) && !isValidRange(range)) {
    return h.response({ error: 'A single byte range with a start and end is required' }).code(statusCodes.badRequest)
  }

  const { filename } = request.params
  const { v: version } = request.query
  const controller = new AbortController()
  request.raw.res.once('close', () => controller.abort())

  try {
    if (method === 'HEAD') {
      const metadata = await getAssetMetadata(prefix, filename, version, range, controller.signal)
      return createAssetResponse(metadata, null, h)
    }

    const result = await getAsset(prefix, filename, version, range, controller.signal)
    const body = /** @type {import('node:stream').Readable | undefined} */ (result.Body)

    if (result.$metadata.httpStatusCode !== statusCodes.partialContent) {
      body?.destroy()
      controller.abort()
      throw new Error('S3 did not return partial content')
    }

    return createAssetResponse(result, body, h)
  } catch (error) {
    return handleError(error, h)
  }
}
