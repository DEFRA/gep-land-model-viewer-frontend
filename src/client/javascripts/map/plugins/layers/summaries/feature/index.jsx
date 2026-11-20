import { createHighlight } from '../../inspection/highlight.js'
import { featureHasVisibleStyle, featureProperties, vectorFeaturesAt } from '../../data-layers/vector-features.js'
import { getLayerStyle } from '../../data-layers/layer-style.js'
import { isLayerStateVisible } from '../../reducer.js'
import { FEATURE_SUMMARY } from '../config.js'
import { combineRecords } from '../combine.js'
import { createOutline } from '../outline.js'
import { LandSummaryView } from '../components/LandSummaryView.jsx'
import { SelectionHeader } from '../components/SelectionHeader.jsx'
import { toFeatureRecord } from './data.js'
import { featuresIntersecting, readFeaturesInExtent } from './features-in-polygon.js'

const OS_FEATURE = 'OS feature'
const OS_FEATURES = 'OS features'

/** @param {number} count */
function featuresLabel (count) {
  return count === 1 ? OS_FEATURE : OS_FEATURES
}

/**
 * @typedef {object} SelectedFeature
 * @property {string} osid
 * @property {import('ol/geom/Polygon.js').default | import('ol/geom/MultiPolygon.js').default} geometry Kept, as the loader drops features outside the view
 * @property {() => Promise<import('../model.js').LandModelRecord>} loadDetails
 */

/** @typedef {{ units: Array<import('../model.js').GridUnit | import('../model.js').FeatureUnit>, record: import('../model.js').LandModelThemes }} SelectionDetails */

/**
 * @param {import('ol/Feature').default} feature
 * @param {import('../../reducer.js').LayerState} layerState
 * @returns {SelectedFeature}
 */
function toSelectedFeature (feature, layerState) {
  const properties = /** @type {import('./data.js').ParcelProperties} */ (featureProperties(feature))
  const { dataSources } = /** @type {import('./api.js').FeatureSource} */ (layerState.source)
  return {
    osid: properties.osid,
    geometry: /** @type {SelectedFeature['geometry']} */ (feature.getGeometry()),
    loadDetails: async () => toFeatureRecord(properties, dataSources)
  }
}

/** @param {import('../model.js').LandModelRecord} record */
function renderFeature (record) {
  return <LandSummaryView record={record} unit={record.unit} />
}

/**
 * @param {SelectedFeature[]} selected
 * @param {SelectedFeature} feature
 * @returns {SelectedFeature[]}
 */
function toggleFeature (selected, feature) {
  const isSelected = ({ osid }) => osid === feature.osid
  return selected.some(isSelected)
    ? selected.filter(candidate => !isSelected(candidate))
    : [...selected, feature]
}

/**
 * @param {import('ol/geom/Polygon.js').default} polygon
 * @param {string} url
 * @param {() => import('../../reducer.js').LayerState} getLayerState
 * @param {AbortSignal} signal
 * @returns {Promise<SelectedFeature[]>}
 */
async function selectableFeaturesIn (polygon, url, getLayerState, signal) {
  const inExtent = await readFeaturesInExtent(url, polygon.getExtent(), { signal })
  const layerState = getLayerState()
  if (signal.aborted || !isLayerStateVisible(layerState)) {
    return []
  }

  const { styleConfig } = getLayerStyle(layerState)
  const visible = inExtent.filter(feature => featureHasVisibleStyle(feature, styleConfig))
  return featuresIntersecting(polygon, visible).map(feature => toSelectedFeature(feature, layerState))
}

/**
 * @param {SelectedFeature[]} features
 * @returns {Promise<SelectionDetails>}
 */
async function loadSelectionDetails (features) {
  const records = await Promise.all(features.map(({ loadDetails }) => loadDetails()))
  const record = records.length === 1
    ? records[0]
    : combineRecords(features.map(({ geometry }, index) => ({ record: records[index], area: geometry.getArea() })))
  return { units: records.map(({ unit }) => unit), record }
}

/** @param {unknown} details */
function renderSelection (details) {
  const { units, record } = /** @type {SelectionDetails} */ (details)
  return units.length === 1
    ? renderFeature(/** @type {import('../model.js').LandModelRecord} */ (record))
    : <LandSummaryView record={record} header={<SelectionHeader count={units.length} label={OS_FEATURES} />} />
}

/**
 * @param {import('ol/Map').default} map
 * @param {() => import('../../reducer.js').LayerState[]} getLayers
 */
export function createFeatureSummary (map, getLayers) {
  const highlight = createHighlight(map)
  const outline = createOutline(map)
  /** @type {SelectedFeature[]} */
  let selected = []

  const featureLayer = () => getLayers().find(layer => layer.id === FEATURE_SUMMARY.id)
  const isVisible = () => isLayerStateVisible(featureLayer())

  /** @returns {SelectedFeature | null} */
  function featureAt (coords) {
    const layerState = featureLayer()
    if (!isLayerStateVisible(layerState)) {
      return null
    }

    const [match] = vectorFeaturesAt(map, [layerState], map.getPixelFromCoordinate(coords), coords).get(layerState.id)?.matches ?? []
    return match ? toSelectedFeature(match.feature, layerState) : null
  }

  /** @param {SelectedFeature[]} features */
  function setSelected (features) {
    selected = features
    highlight.show(features.map(({ geometry }) => geometry))
  }

  /** @type {import('../../inspection/index.js').Selection} */
  const selection = {
    toggleAt (coords) {
      const feature = featureAt(coords)
      if (!feature) {
        return false
      }

      setSelected(toggleFeature(selected, feature))
      return true
    },

    async selectIn (polygon, { signal }) {
      const layerState = featureLayer()
      if (!isLayerStateVisible(layerState) || map.getView().getZoom() < layerState.minZoom) {
        return false
      }

      const features = await selectableFeaturesIn(polygon, layerState.source.url, featureLayer, signal)
      if (!features.length) {
        return false
      }

      setSelected(features)
      outline.show(polygon)
      return true
    },

    isEmpty: () => !selected.length,

    title: () => featuresLabel(selected.length),

    label: () => `${selected.length} ${featuresLabel(selected.length)} selected`,

    stillValid: isVisible,

    loadDetails: () => loadSelectionDetails(selected),

    render: renderSelection
  }

  return {
    selection,

    getHits (coords) {
      const feature = featureAt(coords)
      if (!feature) {
        return []
      }

      return [{
        label: OS_FEATURE,
        stillValid: isVisible,
        // the feature becomes the selection, so Shift + click carries on from it
        select: () => setSelected([feature]),
        loadDetails: feature.loadDetails,
        render: details => renderFeature(/** @type {import('../model.js').LandModelRecord} */ (details))
      }]
    },

    clearSelection () {
      selected = []
      highlight.clear()
      outline.clear()
    },

    dispose () {
      highlight.dispose()
      outline.dispose()
    }
  }
}
