import { createHighlight } from '../../inspection/highlight.js'
import { featureProperties, vectorFeaturesAt } from '../../data-layers/vector-features.js'
import { isLayerStateVisible } from '../../reducer.js'
import { FEATURE_SUMMARY } from '../config.js'
import { combineRecords } from '../combine.js'
import { LandSummaryView } from '../components/LandSummaryView.jsx'
import { SelectionHeader } from '../components/SelectionHeader.jsx'
import { toFeatureRecord } from './data.js'

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
 * @param {import('ol/Map').default} map
 * @param {() => import('../../reducer.js').LayerState[]} getLayers
 */
export function createFeatureSummary (map, getLayers) {
  const highlight = createHighlight(map)
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

    isEmpty: () => !selected.length,

    title: () => featuresLabel(selected.length),

    label: () => `${selected.length} ${featuresLabel(selected.length)} selected`,

    stillValid: isVisible,

    /** @returns {Promise<SelectionDetails>} */
    async loadDetails () {
      const features = selected
      const records = await Promise.all(features.map(({ loadDetails }) => loadDetails()))
      const record = records.length === 1
        ? records[0]
        : combineRecords(features.map(({ geometry }, index) => ({ record: records[index], area: geometry.getArea() })))
      return { units: records.map(({ unit }) => unit), record }
    },

    render (details) {
      const { units, record } = /** @type {SelectionDetails} */ (details)
      return units.length === 1
        ? renderFeature(/** @type {import('../model.js').LandModelRecord} */ (record))
        : <LandSummaryView record={record} header={<SelectionHeader count={units.length} label={OS_FEATURES} />} />
    }
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
    },

    dispose () {
      highlight.dispose()
    }
  }
}
