import { parse, newParsingContext, ColorType, NumberType } from 'ol/expr/expression.js'
import { datasets } from './datasets.js'
import { buildCogColourExpression, buildVectorStyle } from '../plugins/layers/datasets/style-config.js'

describe('#datasets', () => {
  test('vector style expressions compile with the OpenLayers parser', () => {
    const fgbDatasets = datasets.filter(dataset => dataset.source.type === 'fgb')
    expect(fgbDatasets.length).toBeGreaterThan(0)

    for (const dataset of fgbDatasets) {
      for (const theme of dataset.source.styleConfig.themes) {
        const style = buildVectorStyle(theme)
        expect(() => parse(style['fill-color'], ColorType, newParsingContext())).not.toThrow()
        if (style['stroke-color'] !== undefined) {
          expect(() => parse(style['stroke-color'], ColorType, newParsingContext())).not.toThrow()
        }
        if (style['stroke-width'] !== undefined) {
          expect(() => parse(style['stroke-width'], NumberType, newParsingContext())).not.toThrow()
        }
      }
    }
  })

  test('COG style expressions compile with the OpenLayers parser', () => {
    const cogStyled = datasets.filter(dataset => dataset.source.type === 'cog' || dataset.source.overview?.type === 'cog')
    expect(cogStyled.length).toBeGreaterThan(0)

    for (const dataset of cogStyled) {
      for (const theme of dataset.source.styleConfig.themes) {
        expect(() => parse(buildCogColourExpression(theme), ColorType, newParsingContext())).not.toThrow()
      }
    }
  })
})
