import { logExternalCall } from '../logging/logger.js'
import Validate from '@hapi/validate'
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { config } from '../../../../config/config.js'
import { statusCodes } from '../../constants/status-codes.js'

const TIMEOUT = 10_000

/** S3 version IDs are opaque strings of up to 1,024 bytes. */
export const VERSION_ID_SCHEMA = Validate.string().max(1024, 'utf8')

const FILE_VERSION_SCHEMA = VERSION_ID_SCHEMA.allow(null)

const MANIFEST_SCHEMA = Validate.object({
  generatedAt: Validate.string().required(),
  files: Validate.object({ 'style.json': FILE_VERSION_SCHEMA.required() })
    .pattern(Validate.string(), FILE_VERSION_SCHEMA)
    .required()
}).unknown()

const JSON_OBJECT_SCHEMA = Validate.object()

/** The manifest is invalid, or its listed style.json is missing or invalid. */
export class BrokenReleaseError extends Error {
  name = 'BrokenReleaseError'
}

/**
 * @typedef {object} Release
 * @property {string | null} manifestVersion S3 version ID of manifest.json, null when unavailable
 * @property {string} generatedAt When the pipeline published the release
 * @property {Record<string, string | null>} files S3 version ID of each file, null when unversioned
 */

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

/**
 * @param {string} prefix Object key prefix
 * @param {string} filename
 * @param {string | null | undefined} version S3 version ID; null or undefined reads the latest object
 */
function objectInput (prefix, filename, version) {
  const input = { Bucket: config.get('datasets.bucket'), Key: `${prefix}/${filename}` }
  return typeof version === 'string' ? { ...input, VersionId: version } : input
}

/**
 * @param {unknown} error
 * @returns {number | undefined}
 */
export function getS3ErrorStatus (error) {
  return /** @type {import('@aws-sdk/client-s3').S3ServiceException} */ (error).$metadata?.httpStatusCode
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isMissingObject (error) {
  const s3Error = /** @type {import('@aws-sdk/client-s3').S3ServiceException} */ (error)
  if (s3Error.name === 'NoSuchBucket') {
    return false
  }

  return getS3ErrorStatus(error) === statusCodes.notFound
}

/**
 * @param {string} prefix
 * @param {string} filename
 * @param {string | null} version
 * @returns {Promise<{ json: unknown, versionId: string | undefined }>}
 */
async function getJsonFile (prefix, filename, version) {
  const result = await logExternalCall('S3', 'GetObject', () => getClient().send(new GetObjectCommand(objectInput(prefix, filename, version)), { abortSignal: AbortSignal.timeout(TIMEOUT) }))
  const text = await result.Body.transformToString()

  try {
    return { json: JSON.parse(text), versionId: result.VersionId }
  } catch (error) {
    throw new BrokenReleaseError(`${prefix}/${filename} is not valid JSON`, { cause: error })
  }
}

/**
 * Reads the latest manifest under a prefix.
 *
 * @param {string} prefix
 * @returns {Promise<Release | null>} null when the prefix has no manifest
 */
export async function getManifest (prefix) {
  let manifest
  try {
    manifest = await getJsonFile(prefix, 'manifest.json', null)
  } catch (error) {
    if (isMissingObject(error)) {
      return null
    }

    throw error
  }

  const { error: validationError, value } = MANIFEST_SCHEMA.validate(manifest.json)
  if (validationError) {
    throw new BrokenReleaseError(`${prefix}/manifest.json is invalid: ${validationError.message}`)
  }

  return { manifestVersion: manifest.versionId ?? null, generatedAt: value.generatedAt, files: value.files }
}

/**
 * Reads and validates a JSON object file.
 *
 * @param {string} prefix
 * @param {string} filename
 * @param {string | null} version S3 version ID; null reads the latest object
 * @returns {Promise<object>}
 */
export async function getJson (prefix, filename, version) {
  let file
  try {
    file = await getJsonFile(prefix, filename, version)
  } catch (error) {
    if (isMissingObject(error)) {
      throw new BrokenReleaseError(`${prefix}/${filename} version ${version} was not found`, { cause: error })
    }

    throw error
  }

  const { error: validationError, value } = JSON_OBJECT_SCHEMA.validate(file.json)
  if (validationError) {
    throw new BrokenReleaseError(`${prefix}/${filename} is not a JSON object`)
  }

  return value
}

/**
 * Returns the S3 response with the requested byte range in its body stream.
 * The caller must consume or destroy the stream and abort when the browser disconnects.
 *
 * @param {string} prefix
 * @param {string} filename Validated asset filename
 * @param {string | undefined} version
 * @param {string} range Validated Range header
 * @param {AbortSignal} signal
 * @returns {Promise<import('@aws-sdk/client-s3').GetObjectCommandOutput>}
 */
export function getAsset (prefix, filename, version, range, signal) {
  const input = { ...objectInput(prefix, filename, version), Range: range }
  return logExternalCall('S3', 'GetObject', () => getClient().send(new GetObjectCommand(input), { abortSignal: signal }))
}

/**
 * Reads asset metadata without downloading the body.
 *
 * @param {string} prefix
 * @param {string} filename Validated asset filename
 * @param {string | undefined} version
 * @param {string | undefined} range Validated Range header, when supplied
 * @param {AbortSignal} signal
 * @returns {Promise<import('@aws-sdk/client-s3').HeadObjectCommandOutput>}
 */
export function getAssetMetadata (prefix, filename, version, range, signal) {
  const input = { ...objectInput(prefix, filename, version), Range: range }
  return logExternalCall('S3', 'HeadObject', () => getClient().send(new HeadObjectCommand(input), { abortSignal: signal }))
}
