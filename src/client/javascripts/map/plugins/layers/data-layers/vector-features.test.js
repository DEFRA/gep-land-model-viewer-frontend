import { describe, test, expect } from 'vitest'
import { VECTOR_STYLE_PROPERTIES } from './style-config.js'
import { featureProperties, vectorFeaturesAt } from './vector-features.js'

const PIXEL = [100, 200]
const COORDS = [418700, 385100]

const WOODLAND = {
  id: 'woodland',
  source: {
    type: 'fgb',
    url: '/vector/woodland.fgb',
    styleConfig: {
      themes: [{
        label: 'Woodland',
        type: 'uniform',
        band: 1,
        classes: [{ bandValue: 1, label: 'Ancient Woodland', fill: [59, 104, 0, 1] }]
      }]
    }
  }
}

const HABITATS = {
  id: 'habitats',
  source: {
    type: 'fgb',
    url: '/vector/habitats.fgb',
    styleConfig: {
      themes: [{
        label: 'Habitat',
        type: 'match',
        band: 1,
        field: 'A_pred',
        classes: [{ bandValue: 2, fieldValues: ['Water'], label: 'Water', fill: [190, 232, 255, 1] }]
      }]
    }
  }
}

const PEAT = { id: 'peat', source: { type: 'cog', url: '/raster/peat.tif' } }

function stubLayer (id, { visible = true, featuresAtCoordinate = [] } = {}) {
  return {
    get: key => (key === 'id' ? id : undefined),
    isVisible: () => visible,
    getSource: () => ({ getFeaturesAtCoordinate: () => featuresAtCoordinate })
  }
}

function stubFeature (properties) {
  return {
    get: key => properties[key],
    getGeometryName: () => 'geometry',
    getProperties: () => properties
  }
}

function createOlMap ({ atPixel = [], layers = [] } = {}) {
  return {
    forEachFeatureAtPixel: (_pixel, callback, options) => {
      for (const { feature, layer } of atPixel) {
        if (options.layerFilter(layer)) {
          callback(feature, layer)
        }
      }
    },
    getLayers: () => ({ getArray: () => layers })
  }
}

describe('#vectorFeaturesAt', () => {
  test('groups the features at the pixel by their FlatGeobuf layer', () => {
    const woodland = stubLayer('gep-woodland')
    const habitats = stubLayer('gep-habitats')
    const first = stubFeature({ id: 1 })
    const second = stubFeature({ id: 2 })
    const water = stubFeature({ A_pred: 'Water' })
    const map = createOlMap({
      atPixel: [{ feature: first, layer: woodland }, { feature: water, layer: habitats }, { feature: second, layer: woodland }]
    })

    const grouped = vectorFeaturesAt(map, [WOODLAND, HABITATS], PIXEL, COORDS)

    expect([...grouped.keys()]).toEqual(['woodland', 'habitats'])
    expect(grouped.get('woodland')).toEqual({
      layerState: WOODLAND,
      matches: [{ feature: first, layer: woodland }, { feature: second, layer: woodland }]
    })
    expect(grouped.get('habitats').matches).toEqual([{ feature: water, layer: habitats }])
  })

  test('leaves out layers that are not FlatGeobuf or have no layer state', () => {
    const map = createOlMap({
      atPixel: [
        { feature: stubFeature({}), layer: stubLayer('gep-peat') },
        { feature: stubFeature({}), layer: stubLayer('gep-unknown') }
      ]
    })

    expect(vectorFeaturesAt(map, [WOODLAND, PEAT], PIXEL, COORDS).size).toBe(0)
  })

  test('skips features whose class has no visible style', () => {
    const map = createOlMap({
      atPixel: [{ feature: stubFeature({ A_pred: 'Bare ground' }), layer: stubLayer('gep-habitats') }]
    })

    expect(vectorFeaturesAt(map, [HABITATS], PIXEL, COORDS).size).toBe(0)
  })

  test('finds features at the coords from a visible detail layer\'s source, without repeating one found at the pixel', () => {
    const atPixel = stubFeature({ id: 1 })
    const outlineOnly = stubFeature({ id: 2 })
    const woodland = stubLayer('gep-woodland', { featuresAtCoordinate: [atPixel, outlineOnly] })
    const map = createOlMap({ atPixel: [{ feature: atPixel, layer: woodland }], layers: [woodland] })

    const grouped = vectorFeaturesAt(map, [WOODLAND], PIXEL, COORDS)

    expect(grouped.get('woodland').matches).toEqual([{ feature: atPixel, layer: woodland }, { feature: outlineOnly, layer: woodland }])
  })

  test('does not read the source of a detail layer that is not visible', () => {
    const woodland = stubLayer('gep-woodland', { visible: false, featuresAtCoordinate: [stubFeature({ id: 1 })] })
    const map = createOlMap({ layers: [woodland] })

    expect(vectorFeaturesAt(map, [WOODLAND], PIXEL, COORDS).size).toBe(0)
  })
})

describe('#featureProperties', () => {
  test('leaves out the geometry and the resolved style values', () => {
    const style = Object.fromEntries(VECTOR_STYLE_PROPERTIES.map(key => [key, 'style']))
    const feature = stubFeature({ id: 1, name: 'Wood', geometry: {}, ...style })

    expect(featureProperties(feature)).toEqual({ id: 1, name: 'Wood' })
  })
})
