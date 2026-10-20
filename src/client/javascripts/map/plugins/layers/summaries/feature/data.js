import { toLandModelRecord } from '../land-model-properties.js'

/** @typedef {import('../land-model-properties.js').LandModelProperties & { osid: string, toid: string }} ParcelProperties */

/**
 * @param {ParcelProperties} properties
 * @returns {import('../model.js').LandModelRecord}
 */
export function toFeatureRecord (properties) {
  return toLandModelRecord({ kind: 'feature', osid: properties.osid, toid: properties.toid }, properties)
}
