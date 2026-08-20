import { parse, newParsingContext, ColorType } from 'ol/expr/expression.js'
import { datasets } from './datasets.js'
import { operationalDatasets } from './operational-datasets.js'
import { validateStyleConfig, vectorStyleFor, cogColorFor } from '../plugins/layers/style-config.js'

const wmsDatasets = datasets.filter(dataset => dataset.source.type === 'wms')

describe('#datasets', () => {
  test('combines the operational datasets with the EA catalog', () => {
    expect(wmsDatasets.length).toBe(6)
    expect(datasets.slice(0, operationalDatasets.length)).toEqual(operationalDatasets)
  })

  test('every dataset has an id, label and typed source', () => {
    for (const dataset of datasets) {
      expect(dataset).toHaveProperty('id')
      expect(dataset).toHaveProperty('label')
      expect(dataset.source).toHaveProperty('url')
      expect(['wms', 'cog', 'fgb']).toContain(dataset.source.type)
    }
  })

  test('ids are unique', () => {
    const ids = datasets.map(dataset => dataset.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('EA datasets point at the EA spatial data host and carry attribution', () => {
    for (const dataset of wmsDatasets) {
      expect(dataset.source.url).toMatch(/^https:\/\/environment\.data\.gov\.uk\/spatialdata\//)
      expect(dataset.source.attribution).toMatch(/Environment Agency/)
    }
  })

  test('every operational dataset carries a valid style config', () => {
    for (const dataset of operationalDatasets) {
      expect(dataset.source.styleConfig, dataset.id).toBeDefined()
      const requireBandValues = dataset.source.overview?.type === 'cog'
      expect(() => validateStyleConfig(dataset.source.styleConfig, dataset.id, { requireBandValues })).not.toThrow()
    }
  })

  test('vector style expressions compile with the OpenLayers parser', () => {
    const fgbDatasets = datasets.filter(dataset => dataset.source.type === 'fgb')
    expect(fgbDatasets.length).toBeGreaterThan(0)

    for (const dataset of fgbDatasets) {
      const style = vectorStyleFor(dataset.source.styleConfig)
      expect(() => parse(style['fill-color'], ColorType, newParsingContext())).not.toThrow()
    }
  })

  test('COG style expressions compile with the OpenLayers parser', () => {
    const cogStyled = datasets.filter(dataset => dataset.source.type === 'cog' || dataset.source.overview?.type === 'cog')
    expect(cogStyled.length).toBeGreaterThan(0)

    for (const dataset of cogStyled) {
      expect(() => parse(cogColorFor(dataset.source.styleConfig), ColorType, newParsingContext())).not.toThrow()
    }
  })
})
