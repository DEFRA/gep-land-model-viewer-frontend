import { S3Client, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { config } from '../../../config/config.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { createLogger } from '../../common/helpers/logging/logger.js'

export const ASSET_FILES = { cog: 'data.tif', fgb: 'data.fgb' }
const TIMEOUT = 10_000

const logger = createLogger()

/** @type {S3Client} */
let client

function getClient () {
  if (!client) {
    const endpoint = config.get('datasets.endpoint') || undefined
    const accessKeyId = config.get('datasets.accessKeyId')

    client = new S3Client({
      region: config.get('datasets.region'),
      endpoint,
      forcePathStyle: Boolean(endpoint),
      requestHandler: { requestTimeout: TIMEOUT, throwOnRequestTimeout: true },
      credentials: accessKeyId ? { accessKeyId, secretAccessKey: config.get('datasets.secretAccessKey') } : undefined
    })
  }

  return client
}

function objectInput (id, filename) {
  return { Bucket: config.get('datasets.bucket'), Key: `${id}/${filename}` }
}

async function listDatasetFiles (id) {
  const prefix = `${id}/`
  const result = await getClient().send(new ListObjectsV2Command({
    Bucket: config.get('datasets.bucket'),
    Prefix: prefix
  }), { abortSignal: AbortSignal.timeout(TIMEOUT) })

  return (result.Contents ?? []).map(object => object.Key.slice(prefix.length))
}

async function getDatasetStyle (id) {
  let style
  try {
    const result = await getClient().send(new GetObjectCommand(objectInput(id, 'style.json')), { abortSignal: AbortSignal.timeout(TIMEOUT) })
    style = await result.Body.transformToString()
  } catch (error) {
    if (getS3ErrorStatus(error) === statusCodes.notFound) {
      return null
    }

    throw error
  }

  try {
    return JSON.parse(style)
  } catch (error) {
    logger.warn({ err: error }, `Dataset ${id} has an invalid style.json`)
    return null
  }
}

/**
 * @param {unknown} error
 * @returns {number | undefined}
 */
export function getS3ErrorStatus (error) {
  return /** @type {import('@aws-sdk/client-s3').S3ServiceException} */ (error).$metadata?.httpStatusCode
}

/**
 * Returns the S3 response with the requested byte range in its body stream.
 * The caller must consume or destroy the stream and abort when the browser disconnects.
 *
 * @param {string} id Dataset UUID
 * @param {string} filename Validated asset filename
 * @param {string} range Validated Range header
 * @param {AbortSignal} signal
 * @returns {Promise<import('@aws-sdk/client-s3').GetObjectCommandOutput>}
 */
export function getDatasetAsset (id, filename, range, signal) {
  const input = { ...objectInput(id, filename), Range: range }
  return getClient().send(new GetObjectCommand(input), { abortSignal: signal })
}

/**
 * Reads asset metadata without downloading the body.
 *
 * @param {string} id Dataset UUID
 * @param {string} filename Validated asset filename
 * @param {string | undefined} range Validated Range header, when supplied
 * @param {AbortSignal} signal
 * @returns {Promise<import('@aws-sdk/client-s3').HeadObjectCommandOutput>}
 */
export function getDatasetAssetMetadata (id, filename, range, signal) {
  const input = { ...objectInput(id, filename), Range: range }
  return getClient().send(new HeadObjectCommand(input), { abortSignal: signal })
}

/**
 * Loads style.json and lists available asset filenames.
 * styleConfig is null when style.json is missing or contains invalid JSON.
 * Other S3 failures reject.
 *
 * @param {string} id Dataset UUID
 * @returns {Promise<{ styleConfig: unknown, assets: { cog?: string, fgb?: string } }>}
 */
export async function getDatasetAssetsAndStyle (id) {
  const [styleConfig, files] = await Promise.all([getDatasetStyle(id), listDatasetFiles(id)])

  return {
    styleConfig,
    assets: Object.fromEntries(Object.entries(ASSET_FILES).filter(([, filename]) => files.includes(filename)))
  }
}
