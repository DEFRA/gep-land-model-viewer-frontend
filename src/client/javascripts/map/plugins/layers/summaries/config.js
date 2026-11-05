import { GOVUK_DARK_GREY } from '../../../config/colours.js'

export const GRID_SUMMARY = {
  id: 'grid',
  label: 'Grid squares',
  description: 'Uniform squares based on the British National Grid.',
  catalogueCategory: 'landModelGrids',
  layerUrl: '/api/land-model/grid/layer',
  symbol: {
    type: 'line',
    colour: GOVUK_DARK_GREY,
    width: 1,
    directions: ['right', 'bottom']
  }
}

export const FEATURE_SUMMARY = {
  id: 'features',
  label: 'OS features',
  description: 'Real-world boundaries derived from Ordnance Survey.',
  catalogueCategory: 'landModelParcels',
  layerUrl: '/api/land-model/parcels/layer'
}

export const SUMMARIES = [
  GRID_SUMMARY,
  FEATURE_SUMMARY
]
