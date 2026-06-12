/**
 * Get the current basemap layer, which the OL provider keeps at layer index 0.
 * A style switch replaces it, so re-read after one rather than caching.
 * @param {import('ol/Map').default} olMap
 * @returns {import('ol/layer/Layer').default}
 */
export function getBasemapLayer (olMap) {
  return /** @type {import('ol/layer/Layer').default} */ (olMap.getLayers().item(0))
}
