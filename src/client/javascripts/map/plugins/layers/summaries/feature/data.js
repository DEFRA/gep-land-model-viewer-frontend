import { toLandModelRecord } from '../land-model-properties.js'

/** @typedef {import('../land-model-properties.js').LandModelProperties & { osid: string, toid?: string }} ParcelProperties */

/**
 * @param {ParcelProperties} properties
 * @param {import('../land-model-properties.js').Sources} [sources] The parcels release's data sources by theme
 * @returns {import('../model.js').LandModelRecord}
 */
export function toFeatureRecord (properties, sources) {
  return toLandModelRecord({ kind: 'feature', osid: properties.osid, toid: properties.toid }, properties, sources)
}
